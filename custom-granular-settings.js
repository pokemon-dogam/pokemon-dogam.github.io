"use strict";

(function () {
  const SDK_VERSION = "12.16.0";
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const SOURCE_DOCUMENT = "pokemonCollectionsDex";
  const CUSTOM_CARD_SELECTOR = '[data-collection-id="custom"]';
  let firebase = null;
  let user = null;
  let sourceRef = null;
  let dexes = [];
  let draft = {};
  let hadVisibilityConfig = false;
  let dirty = false;
  let bypassSave = false;
  let initialized = false;

  function clean(value) {
    return String(value || "").trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function normalizeVisibility(source) {
    const result = {};
    if (!source || typeof source !== "object" || Array.isArray(source)) return result;
    Object.entries(source).forEach(([id, value]) => {
      const key = clean(id).slice(0, 120);
      if (key) result[key] = value === true || value === "public";
    });
    return result;
  }

  function normalizeDexes(source) {
    if (!source || typeof source !== "object" || Array.isArray(source)) return [];
    return Object.entries(source)
      .map(([fallbackId, value]) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return null;
        const id = clean(value.id || fallbackId).slice(0, 120);
        const title = clean(value.title).slice(0, 60);
        if (!id || !title) return null;
        const cards = Array.isArray(value.cards) ? value.cards : [];
        const owned = cards.filter((card) => Boolean(card?.owned)).length;
        return {
          id,
          title,
          total: cards.length,
          owned,
          updatedAt: clean(value.updatedAt),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  function setInternalVisibility(card) {
    const select = card?.querySelector('[data-setting="visibility"]');
    if (!select) return;
    select.value = Object.values(draft).some(Boolean) ? "public" : "private";
    window.CustomDexVisibilityDraft = { ...draft };
  }

  function addStyles() {
    if (document.querySelector("#custom-granular-settings-style")) return;
    const style = document.createElement("style");
    style.id = "custom-granular-settings-style";
    style.textContent = `
      .custom-granular-settings{grid-column:1/-1;margin-top:4px;border-top:1px solid #e7e9f1;padding-top:16px}
      .custom-granular-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}
      .custom-granular-heading strong{font-size:.74rem}.custom-granular-heading small{color:#8b91a1;font-size:.6rem;line-height:1.5;text-align:right}
      .custom-granular-list{display:grid;gap:8px}.custom-granular-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;border:1px solid #e4e7ef;border-radius:12px;background:#fafbfc;padding:10px 11px}
      .custom-granular-copy{display:grid;gap:3px;min-width:0}.custom-granular-copy strong{overflow:hidden;font-size:.7rem;text-overflow:ellipsis;white-space:nowrap}.custom-granular-copy small{color:#8b91a1;font-size:.58rem}
      .custom-granular-row select{min-width:168px;border:1px solid #dfe3ec;border-radius:9px;background:#fff;color:#596078;font-size:.62rem;font-weight:800;padding:8px 9px}
      .custom-granular-empty{border:1px dashed #dfe3ec;border-radius:12px;color:#8b91a1;font-size:.64rem;padding:12px;text-align:center}
      .custom-granular-status{min-height:18px;margin:9px 0 0;color:#8b91a1;font-size:.6rem}.custom-granular-status[data-state=success]{color:#13795b}.custom-granular-status[data-state=error]{color:#b93647}
      ${CUSTOM_CARD_SELECTOR} .collector-setting-visibility,${CUSTOM_CARD_SELECTOR} .collector-setting-share{display:none!important}
      @media(max-width:620px){.custom-granular-row{grid-template-columns:1fr}.custom-granular-row select{width:100%;min-width:0}.custom-granular-heading{display:grid}.custom-granular-heading small{text-align:left}}
    `;
    document.head.append(style);
  }

  function migrateLegacyVisibility(card) {
    if (hadVisibilityConfig || !dexes.length) return;
    const select = card.querySelector('[data-setting="visibility"]');
    if (select?.value === "public") {
      dexes.forEach((dex) => {
        draft[dex.id] = true;
      });
    }
  }

  function render(card) {
    if (!card || card.querySelector(".custom-granular-settings")) return;
    migrateLegacyVisibility(card);
    addStyles();
    const section = document.createElement("div");
    section.className = "custom-granular-settings";
    section.innerHTML = `
      <div class="custom-granular-heading">
        <strong>만든 도감별 공개 설정</strong>
        <small>PUBLIC으로 선택한 도감만 내 공개 프로필에 각각 표시됩니다.</small>
      </div>
      <div class="custom-granular-list"></div>
      <p class="custom-granular-status" aria-live="polite"></p>
    `;
    const list = section.querySelector(".custom-granular-list");
    if (!dexes.length) {
      list.innerHTML = '<div class="custom-granular-empty">아직 만든 나만의 도감이 없습니다.</div>';
    } else {
      dexes.forEach((dex) => {
        const row = document.createElement("label");
        row.className = "custom-granular-row";
        row.dataset.dexId = dex.id;
        row.innerHTML = `
          <span class="custom-granular-copy"><strong>${escapeHtml(dex.title)}</strong><small>${dex.owned.toLocaleString("ko-KR")} / ${dex.total.toLocaleString("ko-KR")}장 보유</small></span>
          <select aria-label="${escapeHtml(dex.title)} 공개 범위">
            <option value="private">PRIVATE · 나만 보기</option>
            <option value="public">PUBLIC · 프로필에 표시</option>
          </select>
        `;
        const select = row.querySelector("select");
        select.value = draft[dex.id] ? "public" : "private";
        select.addEventListener("change", () => {
          draft[dex.id] = select.value === "public";
          dirty = true;
          card.classList.add("is-dirty");
          setInternalVisibility(card);
          const status = section.querySelector(".custom-granular-status");
          status.dataset.state = "";
          status.textContent = "저장하지 않은 나만의 도감 공개 설정이 있습니다.";
        });
        list.append(row);
      });
    }
    card.append(section);
    setInternalVisibility(card);
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

  async function loadData() {
    const [appModule, authModule, firestoreModule] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
    ]);
    const app = appModule.getApps().length
      ? appModule.getApp()
      : appModule.initializeApp(CONFIG.config);
    const auth = authModule.getAuth(app);
    user = await firstUser(auth, authModule);
    if (!user) return false;
    const db = firestoreModule.getFirestore(app);
    firebase = { firestoreModule };
    sourceRef = firestoreModule.doc(
      db,
      "users",
      user.uid,
      CONFIG.userCollection || "collections",
      SOURCE_DOCUMENT,
    );
    const snapshot = await firestoreModule.getDoc(sourceRef);
    const source = snapshot.exists() ? snapshot.data() || {} : {};
    dexes = normalizeDexes(source.customDexes || {});
    hadVisibilityConfig = Object.prototype.hasOwnProperty.call(source, "customDexVisibility");
    draft = normalizeVisibility(source.customDexVisibility || {});
    dexes.forEach((dex) => {
      if (!Object.prototype.hasOwnProperty.call(draft, dex.id)) draft[dex.id] = false;
    });
    if (hadVisibilityConfig) window.CustomDexVisibilityDraft = { ...draft };
    return true;
  }

  async function persistVisibility() {
    if (!dirty || !sourceRef || !firebase) return;
    const cleanDraft = {};
    dexes.forEach((dex) => {
      cleanDraft[dex.id] = Boolean(draft[dex.id]);
    });
    await firebase.firestoreModule.setDoc(
      sourceRef,
      {
        customDexVisibility: cleanDraft,
        updatedAt: firebase.firestoreModule.serverTimestamp(),
      },
      { merge: true },
    );
    draft = cleanDraft;
    hadVisibilityConfig = true;
    window.CustomDexVisibilityDraft = { ...draft };
  }

  function installSaveBridge() {
    const save = document.querySelector("#collector-settings-save");
    if (!save || save.dataset.customGranularBridge) return;
    save.dataset.customGranularBridge = "true";
    save.addEventListener("click", async (event) => {
      if (bypassSave || !dirty) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const card = document.querySelector(CUSTOM_CARD_SELECTOR);
      const status = card?.querySelector(".custom-granular-status");
      save.disabled = true;
      if (status) {
        status.dataset.state = "";
        status.textContent = "개별 도감 공개 설정을 저장하고 있습니다…";
      }
      try {
        await persistVisibility();
        setInternalVisibility(card);
        dirty = false;
        if (status) {
          status.dataset.state = "success";
          status.textContent = "개별 도감 공개 설정을 저장했습니다.";
        }
        bypassSave = true;
        save.disabled = false;
        save.click();
        bypassSave = false;
      } catch (error) {
        console.error("개별 나만의 도감 공개 설정 저장 실패", error);
        save.disabled = false;
        if (status) {
          status.dataset.state = "error";
          status.textContent = error.message || "개별 도감 공개 설정을 저장하지 못했습니다.";
        }
      }
    }, true);
  }

  function waitForCustomCard() {
    const attach = () => {
      const card = document.querySelector(CUSTOM_CARD_SELECTOR);
      if (!card) return false;
      render(card);
      installSaveBridge();
      return true;
    };
    if (attach()) return;
    const observer = new MutationObserver(() => {
      if (!attach()) return;
      observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  async function init() {
    if (initialized || !CONFIG.enabled || !CONFIG.config?.projectId) return;
    initialized = true;
    try {
      if (!(await loadData())) return;
      waitForCustomCard();
    } catch (error) {
      console.warn("나만의 도감 세부 공개 설정을 불러오지 못했습니다.", error);
    }
  }

  void init();
})();
