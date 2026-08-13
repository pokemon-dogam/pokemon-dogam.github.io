"use strict";

(function () {
  const SDK_VERSION = "12.16.0";
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const sync = window.CollectorPublicSync;
  const registry = window.CollectorCollectionRegistry;
  if (!sync || !registry?.supportedCollectionId?.("custom")) return;

  let firebase = null;
  let user = null;
  let profile = null;
  let setting = null;
  let publicDexIds = null;
  let syncTimer = 0;
  let syncing = false;

  function selectedDexId() {
    return document.querySelector(".custom-dex-tile.is-active")?.dataset.dexId || "";
  }

  function copyText(value) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    return Promise.resolve();
  }

  function selectedDexIsPublic() {
    const dexId = selectedDexId();
    if (!dexId) return false;
    // null은 세부 공개 설정을 한 번도 저장하지 않은 기존 전체 공개 상태입니다.
    return publicDexIds === null || publicDexIds.has(dexId);
  }

  function shareUrl() {
    const dexId = selectedDexId();
    if (
      !dexId ||
      !setting ||
      setting.visibility !== "public" ||
      !profile?.publicId ||
      !selectedDexIsPublic()
    ) {
      return "";
    }
    const url = new URL("./custom.html", window.location.href);
    url.searchParams.set("collector", profile.publicId);
    url.searchParams.set("dex", dexId);
    return url.href;
  }

  function updateShareButton() {
    const button = document.querySelector("#custom-share-button");
    if (!button) return;
    const url = shareUrl();
    button.textContent = url ? "이 도감 공유 링크 복사" : "이 도감 공개 설정";
    button.title = url
      ? "현재 선택한 나만의 도감의 PUBLIC 링크를 복사합니다."
      : "프로필설정에서 현재 도감의 공개 범위를 설정합니다.";
  }

  function ensureShareButton() {
    const toolbar = document.querySelector(".custom-toolbar");
    if (!toolbar || toolbar.querySelector("#custom-share-button")) return;
    const button = document.createElement("button");
    button.id = "custom-share-button";
    button.className = "manager-button";
    button.type = "button";
    button.textContent = "이 도감 공개 설정";
    button.addEventListener("click", async () => {
      const url = shareUrl();
      if (!url) {
        window.location.href = "./collector-settings.html?collection=custom";
        return;
      }
      try {
        await copyText(url);
        const previous = button.textContent;
        button.textContent = "복사했습니다";
        window.setTimeout(() => {
          button.textContent = previous;
          updateShareButton();
        }, 1500);
      } catch (error) {
        console.warn("나만의 도감 공유 링크 복사 실패", error);
      }
    });
    const edit = toolbar.querySelector("#edit-dex-button");
    if (edit) toolbar.insertBefore(button, edit);
    else toolbar.append(button);
    updateShareButton();
  }

  async function loadContext() {
    const sourceReference = sync.sourceRef(
      firebase.firestoreModule,
      firebase.db,
      user.uid,
      "custom",
    );
    const [profileSnapshot, settingSnapshot, sourceSnapshot] = await Promise.all([
      firebase.firestoreModule.getDoc(
        sync.profileRef(firebase.firestoreModule, firebase.db, user.uid),
      ),
      firebase.firestoreModule.getDoc(
        sync.settingRef(firebase.firestoreModule, firebase.db, user.uid, "custom"),
      ),
      firebase.firestoreModule.getDoc(sourceReference),
    ]);
    profile = profileSnapshot.exists() ? profileSnapshot.data() || null : null;
    setting = registry.normalizeSetting(
      "custom",
      settingSnapshot.exists() ? settingSnapshot.data() || {} : null,
    );
    const source = sourceSnapshot.exists() ? sourceSnapshot.data() || {} : {};
    if (Object.prototype.hasOwnProperty.call(source, "customDexVisibility")) {
      publicDexIds = registry.customPublicDexIds
        ? registry.customPublicDexIds(source)
        : new Set(
            Object.entries(source.customDexVisibility || {})
              .filter(([, value]) => value === true || value === "public")
              .map(([id]) => id),
          );
    } else {
      publicDexIds = null;
    }
  }

  async function syncNow() {
    if (!firebase || !user || !setting || setting.visibility !== "public" || syncing) return;
    syncing = true;
    try {
      await sync.syncCollectionWithRetry({
        db: firebase.db,
        firestoreModule: firebase.firestoreModule,
        user,
        collectionId: "custom",
      });
      await loadContext();
      updateShareButton();
    } catch (error) {
      console.warn("나만의 도감 공개 projection 갱신 실패", error);
    } finally {
      syncing = false;
    }
  }

  function scheduleSync() {
    updateShareButton();
    if (!setting || setting.visibility !== "public") return;
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => void syncNow(), 1200);
  }

  async function firstUser(auth, authModule) {
    if (typeof auth.authStateReady === "function") {
      await auth.authStateReady();
      return auth.currentUser || null;
    }
    return new Promise((resolve, reject) => {
      let unsubscribe = () => {};
      unsubscribe = authModule.onAuthStateChanged(auth, (next) => {
        unsubscribe();
        resolve(next || null);
      }, reject);
    });
  }

  async function init() {
    ensureShareButton();
    if (!CONFIG.enabled || !CONFIG.config?.projectId) return;
    try {
      const [appModule, authModule, firestoreModule] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
      ]);
      const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(CONFIG.config);
      const auth = authModule.getAuth(app);
      user = await firstUser(auth, authModule);
      if (!user) return;
      firebase = { db: firestoreModule.getFirestore(app), firestoreModule };
      await loadContext();
      updateShareButton();
      void syncNow();

      const targets = [document.querySelector("#custom-dex-list"), document.querySelector("#custom-card-grid")].filter(Boolean);
      const observer = new MutationObserver(scheduleSync);
      targets.forEach((target) => observer.observe(target, { childList: true, subtree: true, attributes: true }));
      document.querySelector("#custom-dex-list")?.addEventListener("click", () => {
        requestAnimationFrame(updateShareButton);
      });
    } catch (error) {
      console.warn("나만의 도감 공유 상태를 불러오지 못했습니다.", error);
    }
  }

  void init();
})();
