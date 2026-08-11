"use strict";

(function () {
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};

  function profileRef(firestoreModule, db, uid) {
    return firestoreModule.doc(db, "users", uid, "profile", "main");
  }

  function settingRef(firestoreModule, db, uid, collectionId) {
    return firestoreModule.doc(
      db,
      "users",
      uid,
      "collectionSettings",
      collectionId,
    );
  }

  function sourceRef(firestoreModule, db, uid, collectionId) {
    const registry = window.CollectorCollectionRegistry;
    const meta = registry?.COLLECTIONS?.[collectionId];
    if (!meta) throw new Error("지원하지 않는 도감입니다.");
    return firestoreModule.doc(
      db,
      "users",
      uid,
      CONFIG.userCollection || "collections",
      meta.documentId,
    );
  }

  function publicProjectionRef(firestoreModule, db, publicId, collectionId) {
    return firestoreModule.doc(
      db,
      "publicProfiles",
      publicId,
      "collections",
      collectionId,
    );
  }

  function sharedProjectionRef(firestoreModule, db, shareId) {
    return firestoreModule.doc(db, "sharedCollections", shareId);
  }

  function sourceDocumentFromSnapshot(snapshot, user) {
    const source = snapshot?.exists?.() ? { ...(snapshot.data() || {}) } : {};
    if (source.baseMode !== "legacy" && source.baseMode !== "empty") {
      const ownerEmail = String(CONFIG.ownerEmail || "").trim().toLowerCase();
      const userEmail = String(user?.email || "").trim().toLowerCase();
      source.baseMode = ownerEmail && userEmail === ownerEmail ? "legacy" : "empty";
    }
    return source;
  }

  async function loadPrivateContext({ db, firestoreModule, user, collectionId }) {
    const registry = window.CollectorCollectionRegistry;
    if (!registry?.supportedCollectionId?.(collectionId)) {
      throw new Error("지원하지 않는 도감입니다.");
    }
    if (!user?.uid) throw new Error("Google 로그인이 필요합니다.");

    const [profileSnapshot, settingSnapshot, sourceSnapshot] = await Promise.all([
      firestoreModule.getDoc(profileRef(firestoreModule, db, user.uid)),
      firestoreModule.getDoc(
        settingRef(firestoreModule, db, user.uid, collectionId),
      ),
      firestoreModule.getDoc(
        sourceRef(firestoreModule, db, user.uid, collectionId),
      ),
    ]);
    const profile = profileSnapshot.exists() ? profileSnapshot.data() || {} : null;
    const setting = registry.normalizeSetting(
      collectionId,
      settingSnapshot.exists() ? settingSnapshot.data() || {} : null,
    );
    const source = sourceDocumentFromSnapshot(sourceSnapshot, user);
    return { profile, setting, source };
  }

  async function buildForUser(options) {
    const registry = window.CollectorCollectionRegistry;
    const context = await loadPrivateContext(options);
    if (!context.profile?.profileCompleted || !context.profile.publicId) {
      throw new Error("컬렉터 프로필을 먼저 완성해 주세요.");
    }
    const projection = await registry.buildProjection(
      options.collectionId,
      context.source,
      context.profile.publicId,
    );
    return { ...context, projection };
  }

  async function syncCollection(options) {
    const { db, firestoreModule, user, collectionId } = options || {};
    if (!db || !firestoreModule || !user?.uid) return { synced: false };

    const context = await loadPrivateContext({
      db,
      firestoreModule,
      user,
      collectionId,
    });
    const { setting, profile } = context;
    if (setting.visibility === "private") return { synced: false, visibility: "private" };
    if (!profile?.profileCompleted || !profile.publicId) {
      throw new Error("컬렉터 프로필을 먼저 완성해 주세요.");
    }
    const projection = await window.CollectorCollectionRegistry.buildProjection(
      collectionId,
      context.source,
      profile.publicId,
    );

    const payload = { ...projection };

    if (setting.visibility === "public") {
      await firestoreModule.setDoc(
        publicProjectionRef(
          firestoreModule,
          db,
          profile.publicId,
          collectionId,
        ),
        payload,
      );
      return { synced: true, visibility: "public" };
    }

    if (!setting.shareId) {
      throw new Error("링크 공개 식별값을 확인하지 못했습니다.");
    }
    await firestoreModule.setDoc(
      sharedProjectionRef(firestoreModule, db, setting.shareId),
      payload,
    );
    return { synced: true, visibility: "unlisted" };
  }

  async function syncCollectionWithRetry(options) {
    let lastError;
    for (const delay of [0, 350, 1200]) {
      if (delay) {
        await new Promise((resolve) => window.setTimeout(resolve, delay));
      }
      try {
        return await syncCollection(options);
      } catch (error) {
        lastError = error;
      }
    }

    window.dispatchEvent(
      new CustomEvent("pokemon-dex:public-sync-error", {
        detail: {
          collectionId: options?.collectionId || "",
          message: lastError?.message || "공개 도감 동기화 실패",
        },
      }),
    );
    throw lastError;
  }

  function syncAfterCollectionWrite(options) {
    void syncCollectionWithRetry(options).catch((error) => {
      console.warn("공개 도감 projection을 갱신하지 못했습니다.", error);
    });
  }

  window.CollectorPublicSync = {
    buildForUser,
    loadPrivateContext,
    profileRef,
    publicProjectionRef,
    settingRef,
    sharedProjectionRef,
    sourceRef,
    sourceDocumentFromSnapshot,
    syncAfterCollectionWrite,
    syncCollection,
    syncCollectionWithRetry,
  };
})();
