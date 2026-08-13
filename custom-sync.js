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

  function shareUrl() {
    const dexId = selectedDexId();
    if (!dexId || !setting || setting.visibility === "private") return "";
    const url = new URL("./custom.html", window.location.href);
    url.searchParams.set("dex", dexId);
    if (setting.visibility === "public" && profile?.publicId) {
      url.searchParams.set("collector", profile.publicId);
      return url.href;
    }
    if (setting.visibility === "unlisted" && setting.shareId) {
      url.hash = new URLSearchParams({ share: setting.shareId }).toString();
      return url.href;
    }
    return "";
  }

  function updateShareButton() {
    const button = document.querySelector("#custom-share-button");
    if (!button) return;
    const url = shareUrl();
    button.textContent = url ? "공유 링크 복사" : "공유 설정";
    button.title = url
      ? "현재 선택한 나만의 도감 링크를 복사합니다."
      : "내 프로필 관리에서 나만의 도감 공개 범위를 설정합니다.";
  }

  function ensureShareButton() {
    const toolbar = document.querySelector(".custom-toolbar");
    if (!toolbar || toolbar.querySelector("#custom-share-button")) return;
    const button = document.createElement("button");
    button.id = "custom-share-button";
    button.className = "manager-button";
    button.type = "button";
    button.textContent = "공유 설정";
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
    const [profileSnapshot, settingSnapshot] = await Promise.all([
      firebase.firestoreModule.getDoc(
        sync.profileRef(firebase.firestoreModule, firebase.db, user.uid),
      ),
      firebase.firestoreModule.getDoc(
        sync.settingRef(firebase.firestoreModule, firebase.db, user.uid, "custom"),
      ),
    ]);
    profile = profileSnapshot.exists() ? profileSnapshot.data() || null : null;
    setting = registry.normalizeSetting(
      "custom",
      settingSnapshot.exists() ? settingSnapshot.data() || {} : null,
    );
  }

  async function syncNow() {
    if (!firebase || !user || !setting || setting.visibility === "private" || syncing) return;
    syncing = true;
    try {
      await sync.syncCollectionWithRetry({
        db: firebase.db,
        firestoreModule: firebase.firestoreModule,
        user,
        collectionId: "custom",
      });
    } catch (error) {
      console.warn("나만의 도감 공개 projection 갱신 실패", error);
    } finally {
      syncing = false;
    }
  }

  function scheduleSync() {
    updateShareButton();
    if (!setting || setting.visibility === "private") return;
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
