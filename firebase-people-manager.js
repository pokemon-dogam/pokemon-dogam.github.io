"use strict";

(function () {
  const SDK_VERSION = "12.16.0";
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const DOCUMENT_ID = CONFIG.userDocument || "nationalDex";
  const originalFetch = window.fetch.bind(window);

  let firebase = null;
  let currentUser = null;
  let userDocumentRef = null;
  let accountProfile = null;
  let remoteOverrides = {};
  let remoteOwned = {};
  let sharedViewActive = false;
  let collectorPublicViewActive = false;
  let currentPerson = null;
  let peopleOwnedSaveQueue = Promise.resolve();
  let resolveReady;

  const firebaseReady = new Promise((resolve) => {
    resolveReady = resolve;
  });

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isOwnerAccount(user) {
    return Boolean(
      user &&
        normalizeEmail(CONFIG.ownerEmail) &&
        normalizeEmail(user.email) === normalizeEmail(CONFIG.ownerEmail),
    );
  }

  function configured() {
    const config = CONFIG.config || {};
    return Boolean(
      CONFIG.enabled &&
        config.apiKey &&
        config.authDomain &&
        config.projectId &&
        normalizeEmail(CONFIG.ownerEmail),
    );
  }

  function normalizeOverride(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const imageUrl = String(value.imageUrl || "").trim();
    if (!imageUrl) return null;
    return {
      imageUrl,
      cardUrl: String(value.cardUrl || "").trim(),
      cardName: String(value.cardName || "").trim(),
      setName: String(value.setName || "").trim(),
      cardNumber: String(value.cardNumber || "").trim(),
      updatedAt: value.updatedAt || null,
      updatedBy: String(value.updatedBy || "").trim(),
    };
  }

  function sanitizeOverrides(source) {
    const cleaned = {};
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      return cleaned;
    }

    for (const [key, value] of Object.entries(source)) {
      const item = normalizeOverride(value);
      if (/^[a-z0-9-]{1,80}$/.test(key) && item) cleaned[key] = item;
    }
    return cleaned;
  }

  function sanitizeOwned(source) {
    const cleaned = {};
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      return cleaned;
    }

    for (const [key, value] of Object.entries(source)) {
      if (/^[a-z0-9-]{1,80}$/.test(key) && value === true) cleaned[key] = true;
    }
    return cleaned;
  }

  function validHttpUrl(value) {
    if (!value) return null;
    try {
      const url = new URL(value, window.location.href);
      return ["http:", "https:"].includes(url.protocol) ? url : null;
    } catch {
      return null;
    }
  }

  function isOfficialKoreanImage(value) {
    const url = validHttpUrl(value);
    return Boolean(
      url &&
        url.protocol === "https:" &&
        url.hostname === "cards.image.pokemonkorea.co.kr",
    );
  }

  function imageLoads(url, timeout = 7000) {
    return new Promise((resolve) => {
      const image = new Image();
      let settled = false;
      const finish = (success) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        image.onload = null;
        image.onerror = null;
        resolve(success);
      };
      const timer = window.setTimeout(() => finish(false), timeout);
      image.onload = () => finish(image.naturalWidth > 0);
      image.onerror = () => finish(false);
      image.src = url;
    });
  }

  function applyAccountState(data) {
    if (!Array.isArray(data.people)) return data;

    for (const person of data.people) {
      person.owned = Boolean(remoteOwned[person.id]);
      const item = normalizeOverride(remoteOverrides[person.id]);
      if (!item) continue;

      person.image = item.imageUrl;
      person.imageLarge = item.imageUrl;
      person.cardExists = true;
      person.cardStatus = "account-override";
      person.cards = [
        {
          id: `account-${person.id}`,
          name: item.cardName || person.nameKo,
          nameEn: "",
          set: item.setName || "직접 입력",
          setCode: "MANUAL",
          number: item.cardNumber || "—",
          rarity: "",
          language: "ko",
          edition: "KR",
          solo: true,
          image: item.imageUrl,
          imageLarge: item.imageUrl,
          source: validHttpUrl(item.cardUrl)?.href || item.imageUrl,
          officialImageSource: item.imageUrl,
          accountOverride: true,
        },
      ];
    }

    const confirmed = data.people.filter((person) => person.cardExists).length;
    const owned = data.people.filter((person) => person.owned).length;
    data.metadata.counts.cardConfirmed = confirmed;
    data.metadata.counts.unconfirmed = data.people.length - confirmed;
    data.metadata.counts.owned = owned;
    data.metadata.counts.missingOwned = data.people.length - owned;
    return data;
  }

  window.fetch = async function peopleManagedFetch(input, init) {
    const response = await originalFetch(input, init);
    const url = typeof input === "string" ? input : input?.url || "";
    if (!response.ok || !/data\/people\.json(?:$|[?#])/.test(url)) {
      return response;
    }

    try {
      await Promise.race([
        firebaseReady,
        new Promise((resolve) => window.setTimeout(resolve, 8000)),
      ]);
      const data = applyAccountState(await response.clone().json());
      const headers = new Headers(response.headers);
      headers.set("content-type", "application/json; charset=utf-8");
      headers.delete("content-length");
      return new Response(JSON.stringify(data), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      console.warn("계정별 인물 카드 이미지를 적용하지 못했습니다.", error);
      return response;
    }
  };

  async function firstAuthUser(auth, authModule) {
    return new Promise((resolve, reject) => {
      let unsubscribe = () => {};
      unsubscribe = authModule.onAuthStateChanged(
        auth,
        (user) => {
          unsubscribe();
          resolve(user);
        },
        reject,
      );
    });
  }

  async function loadAccountDocument(user) {
    const { db, firestoreModule } = firebase;
    const shared = window.PokemonDexSharedReadonly;
    await shared?.ensureOwnerShare?.(db, firestoreModule, user);
    sharedViewActive = Boolean(shared?.isActive?.(user));
    userDocumentRef = null;
    remoteOverrides = {};
    remoteOwned = {};

    if (sharedViewActive) {
      const ownerDocument = await shared.loadOwnerDocument(
        db,
        firestoreModule,
        DOCUMENT_ID,
      );
      const data = ownerDocument?.data || {};
      accountProfile = {
        baseMode: data.baseMode === "legacy" ? "legacy" : "empty",
        email: data.email || CONFIG.ownerEmail || "",
      };
      remoteOverrides = sanitizeOverrides(data.peopleOverrides || {});
      remoteOwned = sanitizeOwned(data.peopleOwned || {});
      return;
    }

    userDocumentRef = firestoreModule.doc(
      db,
      "users",
      user.uid,
      CONFIG.userCollection || "collections",
      DOCUMENT_ID,
    );
    const snapshot = await firestoreModule.getDoc(userDocumentRef);
    if (snapshot.exists()) {
      const data = snapshot.data() || {};
      accountProfile = {
        baseMode: data.baseMode === "legacy" ? "legacy" : "empty",
        email: data.email || user.email || "",
      };
      remoteOverrides = sanitizeOverrides(data.peopleOverrides || {});
      remoteOwned = sanitizeOwned(data.peopleOwned || {});
      return;
    }

    const baseMode = isOwnerAccount(user) ? "legacy" : "empty";
    accountProfile = { baseMode, email: user.email || "" };
    await firestoreModule.setDoc(userDocumentRef, {
      baseMode,
      email: user.email || "",
      displayName: user.displayName || "",
      overrides: {},
      peopleOverrides: {},
      peopleOwned: {},
      createdAt: firestoreModule.serverTimestamp(),
      updatedAt: firestoreModule.serverTimestamp(),
    });
  }

  async function initializeFirebase() {
    if (!configured()) {
      document.documentElement.classList.add("firebase-not-configured");
      resolveReady();
      updateAuthUi();
      return;
    }

    try {
      const [appModule, authModule, firestoreModule] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
      ]);
      const app = appModule.getApps().length
        ? appModule.getApp()
        : appModule.initializeApp(CONFIG.config);
      const auth = authModule.getAuth(app);
      const db = firestoreModule.getFirestore(app);
      auth.useDeviceLanguage();
      await authModule.setPersistence(auth, authModule.browserLocalPersistence);

      firebase = { auth, db, authModule, firestoreModule };
      try {
        await authModule.getRedirectResult(auth);
      } catch (error) {
        console.warn("Google 로그인 리디렉션 결과를 확인하지 못했습니다.", error);
      }

      currentUser = await firstAuthUser(auth, authModule);
      if (window.CollectorPublicView?.requested) {
        collectorPublicViewActive = true;
        sharedViewActive = true;
        accountProfile = { baseMode: "empty", email: "" };
        userDocumentRef = null;
        try {
          const context = await window.CollectorPublicView.loadProjection(
            db,
            firestoreModule,
            "people",
          );
          const data = window.CollectorPublicView.projectionPeopleDocument(
            context.projection,
          );
          remoteOverrides = {};
          remoteOwned = sanitizeOwned(data.peopleOwned);
        } catch (error) {
          remoteOverrides = {};
          remoteOwned = {};
          window.CollectorPublicView.showAccessError(error);
          console.warn("공개 인물도감을 불러오지 못했습니다.", error);
        }
      } else if (currentUser) {
        await loadAccountDocument(currentUser);
      }
      resolveReady();
      updateAuthUi();
      updateAccountAccess();
    } catch (error) {
      console.error("인물도감 Firebase 초기화에 실패했습니다.", error);
      document.documentElement.classList.add("firebase-error");
      resolveReady();
      updateAuthUi(error);
    }
  }

  function createAuthUi() {
    if (document.querySelector("#firebase-auth-panel")) return;
    const panel = document.createElement("div");
    panel.id = "firebase-auth-panel";
    panel.className = "firebase-auth-panel";
    panel.innerHTML = `
      <span class="firebase-auth-dot" aria-hidden="true"></span>
      <span id="firebase-auth-status">로그인 상태 확인 중</span>
      <button id="firebase-login" type="button">Google 로그인</button>
      <button id="firebase-logout" type="button" hidden>로그아웃</button>
    `;
    document.querySelector(".site-header")?.append(panel);
    panel.querySelector("#firebase-login")?.addEventListener("click", signIn);
    panel.querySelector("#firebase-logout")?.addEventListener("click", signOutUser);
  }

  function updateAuthUi(error) {
    const panel = document.querySelector("#firebase-auth-panel");
    if (!panel) return;
    const status = panel.querySelector("#firebase-auth-status");
    const login = panel.querySelector("#firebase-login");
    const logout = panel.querySelector("#firebase-logout");
    const headerChip = document.querySelector(".header-chip");
    const shared = window.PokemonDexSharedReadonly;
    sharedViewActive = collectorPublicViewActive
      || Boolean(shared?.updateControl?.(currentUser));
    panel.classList.toggle("is-account", Boolean(currentUser));
    panel.classList.toggle("is-owner", isOwnerAccount(currentUser));

    if (headerChip) {
      headerChip.textContent = sharedViewActive
        ? "READ ONLY"
        : currentUser
          ? "SIGNED IN"
          : "PUBLIC VIEW";
    }
    if (!configured()) {
      status.textContent = "Firebase 설정 필요 · 공개 도감";
      login.hidden = true;
      logout.hidden = true;
    } else if (error || document.documentElement.classList.contains("firebase-error")) {
      status.textContent = "Firebase 연결 오류 · 공개 도감";
      login.hidden = false;
      logout.hidden = true;
    } else if (collectorPublicViewActive) {
      status.textContent = window.CollectorPublicView?.authLabel?.("공개 인물도감 · 읽기 전용")
        || "공개 인물도감 · 읽기 전용";
      login.hidden = true;
      logout.hidden = true;
    } else if (!currentUser) {
      status.textContent = "방문자 · 공개 인물도감";
      login.hidden = false;
      logout.hidden = true;
    } else {
      status.textContent = sharedViewActive
        ? `${shared.buttonLabel()} · 읽기 전용`
        : `${currentUser.displayName || currentUser.email || "내 계정"} · 보유 체크·카드 교체 가능`;
      login.hidden = true;
      logout.hidden = false;
    }
  }

  async function signIn() {
    if (!firebase) return;
    const provider = new firebase.authModule.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await firebase.authModule.signInWithPopup(firebase.auth, provider);
      window.location.reload();
    } catch (error) {
      if (error.code === "auth/popup-closed-by-user") return;
      const message =
        error.code === "auth/popup-blocked"
          ? "로그인 팝업이 차단되었습니다. 팝업을 허용한 뒤 다시 시도해 주세요."
          : `Google 로그인에 실패했습니다.\n${error.message || ""}`;
      alert(message);
    }
  }

  async function signOutUser() {
    if (!firebase) return;
    window.PokemonDexSharedReadonly?.clear?.();
    await firebase.authModule.signOut(firebase.auth);
    window.location.reload();
  }

  function canEdit() {
    return Boolean(currentUser && firebase && userDocumentRef && !sharedViewActive);
  }

  function updateAccountAccess() {
    document.querySelectorAll(".account-only-control").forEach((element) => {
      element.hidden = !canEdit();
    });
  }

  function setEditorMessage(message, state = "") {
    const element = document.querySelector("#people-editor-message");
    if (!element) return;
    element.textContent = message;
    element.dataset.state = state;
  }

  function createEditor() {
    const archive = document.querySelector("#people-dialog .people-card-archive");
    if (!archive || document.querySelector("#people-card-editor")) return;
    const editor = document.createElement("section");
    editor.id = "people-card-editor";
    editor.className = "collection-editor account-only-control";
    editor.hidden = true;
    editor.innerHTML = `
      <div class="collection-editor-heading">
        <div><span>TRAINER CARD LINK</span><strong>대표 한국어판 카드 직접 교체</strong></div>
      </div>
      <div class="collection-editor-grid">
        <label class="collection-editor-wide"><span>카드 이미지 URL</span><input id="people-edit-image-url" type="url" inputmode="url" placeholder="https://cards.image.pokemonkorea.co.kr/..." /></label>
        <label class="collection-editor-wide"><span>카드 상세 링크</span><input id="people-edit-card-url" type="url" inputmode="url" placeholder="https://pokemoncard.co.kr/... 또는 카드 정보 페이지" /></label>
        <label><span>카드명</span><input id="people-edit-card-name" type="text" /></label>
        <label><span>세트명</span><input id="people-edit-set-name" type="text" /></label>
        <label class="collection-editor-wide"><span>카드번호</span><input id="people-edit-card-number" type="text" placeholder="예: 191/173" /></label>
        <label class="owned-switch people-solo-confirm collection-editor-wide"><input id="people-edit-solo-confirm" type="checkbox" checked /><span>한국어판이며 해당 인물이 단독으로 나온 카드임을 확인했습니다.</span></label>
      </div>
      <p id="people-editor-message" class="collection-editor-message">포켓몬코리아 이미지 주소만 저장할 수 있습니다.</p>
      <div class="collection-editor-actions">
        <button id="people-reset-card" class="manager-button manager-button--danger" type="button">기본 카드로 되돌리기</button>
        <button id="people-save-card" class="primary-button" type="button">대표 카드 교체</button>
      </div>
      <p class="collection-save-hint">교체한 링크는 로그인한 Google 계정에 저장되며, 전국도감 카드 교체와 같은 방식으로 이 기기와 다른 기기에서 동기화됩니다.</p>
    `;
    archive.after(editor);
    editor.querySelector("#people-save-card")?.addEventListener("click", saveCurrent);
    editor.querySelector("#people-reset-card")?.addEventListener("click", resetCurrent);
  }

  function setInput(id, value) {
    const input = document.querySelector(`#${id}`);
    if (input) input.value = value || "";
  }

  function openEditor(person) {
    currentPerson = person;
    const item = normalizeOverride(remoteOverrides[person.id]);
    const card = person.cards?.[0] || null;
    setInput("people-edit-image-url", item?.imageUrl || person.image || "");
    setInput("people-edit-card-url", item?.cardUrl || card?.source || "");
    setInput("people-edit-card-name", item?.cardName || card?.name || person.nameKo);
    setInput("people-edit-set-name", item?.setName || card?.set || "");
    setInput("people-edit-card-number", item?.cardNumber || card?.number || "");
    const confirmInput = document.querySelector("#people-edit-solo-confirm");
    if (confirmInput) confirmInput.checked = true;
    const reset = document.querySelector("#people-reset-card");
    if (reset) reset.disabled = !item;
    setEditorMessage(
      item
        ? "이 계정에서 직접 교체한 카드입니다."
        : "포켓몬코리아 이미지 주소만 저장할 수 있습니다.",
    );
    updateAccountAccess();
  }

  async function writeOverrides(nextOverrides) {
    await firebase.firestoreModule.setDoc(
      userDocumentRef,
      {
        baseMode: accountProfile?.baseMode || (isOwnerAccount(currentUser) ? "legacy" : "empty"),
        email: currentUser.email || "",
        displayName: currentUser.displayName || "",
        peopleOverrides: nextOverrides,
        updatedAt: firebase.firestoreModule.serverTimestamp(),
      },
      { merge: true },
    );
    remoteOverrides = nextOverrides;
  }

  async function saveOwned(personId, owned) {
    if (!canEdit()) {
      throw new Error("Google 로그인 후 내 보유 상태를 저장할 수 있습니다.");
    }
    if (!/^[a-z0-9-]{1,80}$/.test(String(personId || ""))) {
      throw new Error("인물 식별값을 확인하지 못했습니다.");
    }

    const operation = async () => {
      const nextOwned = { ...remoteOwned };
      if (owned) nextOwned[personId] = true;
      else delete nextOwned[personId];

      await firebase.firestoreModule.setDoc(
        userDocumentRef,
        {
          baseMode: accountProfile?.baseMode || (isOwnerAccount(currentUser) ? "legacy" : "empty"),
          email: currentUser.email || "",
          displayName: currentUser.displayName || "",
          peopleOwned: nextOwned,
          updatedAt: firebase.firestoreModule.serverTimestamp(),
        },
        { merge: true },
      );
      remoteOwned = nextOwned;
      try {
        await window.CollectorPublicSync?.syncCollectionWithRetry?.({
          db: firebase.db,
          firestoreModule: firebase.firestoreModule,
          user: currentUser,
          collectionId: "people",
        });
      } catch (error) {
        console.warn("인물도감 공개 projection 갱신 실패", error);
      }
      return { owned: Boolean(remoteOwned[personId]) };
    };
    const queued = peopleOwnedSaveQueue.then(operation, operation);
    peopleOwnedSaveQueue = queued.catch(() => undefined);
    return queued;
  }

  async function saveCurrent() {
    if (!currentPerson || !canEdit()) return;
    const imageUrl = document.querySelector("#people-edit-image-url")?.value.trim() || "";
    const cardUrl = document.querySelector("#people-edit-card-url")?.value.trim() || "";
    const soloConfirmed = Boolean(
      document.querySelector("#people-edit-solo-confirm")?.checked,
    );
    const save = document.querySelector("#people-save-card");

    if (!isOfficialKoreanImage(imageUrl)) {
      setEditorMessage(
        "cards.image.pokemonkorea.co.kr로 시작하는 한국어판 카드 이미지 URL을 입력해 주세요.",
        "error",
      );
      return;
    }
    if (cardUrl && !validHttpUrl(cardUrl)) {
      setEditorMessage("카드 상세 링크 형식을 확인해 주세요.", "error");
      return;
    }
    if (!soloConfirmed) {
      setEditorMessage("한국어판 단독 인물 카드 확인란을 선택해 주세요.", "error");
      return;
    }

    save.disabled = true;
    save.textContent = "이미지 확인 중…";
    setEditorMessage("카드 이미지를 불러올 수 있는지 확인하고 있습니다.", "loading");
    try {
      if (!(await imageLoads(imageUrl))) {
        throw new Error("입력한 카드 이미지를 불러오지 못했습니다.");
      }
      const item = {
        imageUrl,
        cardUrl: validHttpUrl(cardUrl)?.href || "",
        cardName: document.querySelector("#people-edit-card-name")?.value.trim() || "",
        setName: document.querySelector("#people-edit-set-name")?.value.trim() || "",
        cardNumber: document.querySelector("#people-edit-card-number")?.value.trim() || "",
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.email || currentUser.uid,
      };
      await writeOverrides({ ...remoteOverrides, [currentPerson.id]: item });
      setEditorMessage("대표 카드를 교체했습니다.", "success");
      window.location.reload();
    } catch (error) {
      console.error(error);
      setEditorMessage(error.message || "대표 카드를 저장하지 못했습니다.", "error");
      save.disabled = false;
      save.textContent = "대표 카드 교체";
    }
  }

  async function resetCurrent() {
    if (!currentPerson || !canEdit() || !remoteOverrides[currentPerson.id]) return;
    if (!confirm(`${currentPerson.nameKo}의 대표 카드를 기본 이미지로 되돌릴까요?`)) return;
    const next = { ...remoteOverrides };
    delete next[currentPerson.id];
    try {
      await writeOverrides(next);
      window.location.reload();
    } catch (error) {
      setEditorMessage(error.message || "기본 카드로 되돌리지 못했습니다.", "error");
    }
  }

  window.PokemonPeopleManager = {
    open: openEditor,
    canEdit,
    saveOwned,
  };
  createAuthUi();
  createEditor();
  updateAccountAccess();
  void initializeFirebase();
})();
