"use strict";

(function () {
  const SDK_VERSION = "12.16.0";
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const SERIES_URL = "./data/series.json";
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const publicId = params.get("collector") || "";
  const shareId = hash.get("share") || "";
  const requestedDexId = params.get("dex") || "";
  const state = {
    dexes: [],
    selectedDexId: requestedDexId,
    catalogMap: new Map(),
    filter: "all",
    query: "",
  };
  const $ = (id) => document.getElementById(id);

  function clean(value) {
    return String(value || "").trim();
  }

  function normalize(value) {
    return clean(value).toLocaleLowerCase("ko-KR");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  async function loadCatalog() {
    const response = await fetch(SERIES_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`series.json ${response.status}`);
    const groups = await response.json();
    const catalog = [];
    for (const group of groups || []) {
      for (const card of group.cards || []) {
        const rawCode = clean(card.code || card.meta || `${group.code}_${card.order || catalog.length}`);
        const key = `${clean(group.code)}::${rawCode}`;
        const codePart = rawCode.includes("_") ? rawCode.slice(rawCode.indexOf("_") + 1) : rawCode;
        catalog.push({
          key,
          name: clean(card.name || card.pokemonName || rawCode) || rawCode,
          setCode: clean(group.code),
          setTitle: clean(group.title),
          cardNumber: codePart,
          imageUrl: clean(card.originalImage || card.image),
        });
      }
    }
    state.catalogMap = new Map(catalog.map((card) => [card.key, card]));
  }

  function normalizeManual(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const result = {
      name: clean(value.name).slice(0, 80),
      setCode: clean(value.setCode).slice(0, 30),
      cardNumber: clean(value.cardNumber).slice(0, 40),
      imageUrl: clean(value.imageUrl).slice(0, 600),
    };
    return result.name && result.imageUrl ? result : null;
  }

  function normalizeDexes(source) {
    if (!Array.isArray(source)) return [];
    return source.slice(0, 30).map((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const id = clean(value.id).slice(0, 120);
      const title = clean(value.title).slice(0, 60);
      if (!id || !title) return null;
      const seen = new Set();
      const cards = (Array.isArray(value.cards) ? value.cards : [])
        .slice(0, 1500)
        .map((card) => {
          if (!card || typeof card !== "object" || Array.isArray(card)) return null;
          const key = clean(card.key).slice(0, 220);
          if (!key || seen.has(key)) return null;
          seen.add(key);
          return { key, owned: Boolean(card.owned), manual: normalizeManual(card.manual) };
        })
        .filter(Boolean);
      return { id, title, description: clean(value.description).slice(0, 180), cards };
    }).filter(Boolean);
  }

  function displayCard(entry) {
    if (entry.manual) {
      return {
        name: entry.manual.name,
        setCode: entry.manual.setCode || "직접 추가",
        setTitle: "",
        cardNumber: entry.manual.cardNumber || "",
        imageUrl: entry.manual.imageUrl,
      };
    }
    return state.catalogMap.get(entry.key) || {
      name: "카드 정보를 찾을 수 없음",
      setCode: "—",
      setTitle: "",
      cardNumber: entry.key,
      imageUrl: "",
    };
  }

  function currentDex() {
    return state.dexes.find((dex) => dex.id === state.selectedDexId) || null;
  }

  function setUrlDex(id) {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("dex", id);
    else url.searchParams.delete("dex");
    history.replaceState(null, "", url);
  }

  function setFilter(value) {
    state.filter = value;
    document.querySelectorAll("#custom-status button[data-status]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.status === value);
    });
  }

  function visibleCards(dex) {
    const query = normalize(state.query);
    return dex.cards.filter((entry) => {
      if (state.filter === "owned" && !entry.owned) return false;
      if (state.filter === "missing" && entry.owned) return false;
      if (!query) return true;
      const card = displayCard(entry);
      return normalize([card.name, card.setCode, card.setTitle, card.cardNumber].join(" ")).includes(query);
    });
  }

  function renderCard(entry) {
    const card = displayCard(entry);
    const article = document.createElement("article");
    article.className = `pokemon-card custom-card${entry.owned ? " is-owned" : " is-missing"}`;
    const imageWrap = document.createElement("div");
    imageWrap.className = "card-image-wrap custom-card-image";
    if (card.imageUrl) {
      const image = document.createElement("img");
      image.className = "card-image";
      image.loading = "lazy";
      image.src = card.imageUrl;
      image.alt = `${card.name} 카드`;
      image.onerror = () => article.classList.add("has-image-error");
      imageWrap.append(image);
    }
    const fallback = document.createElement("span");
    fallback.className = "image-fallback";
    fallback.textContent = "이미지를 불러오지 못했습니다";
    imageWrap.append(fallback);
    if (!entry.owned) {
      const overlay = document.createElement("span");
      overlay.className = "missing-overlay";
      overlay.textContent = "미보유";
      imageWrap.append(overlay);
    }
    const body = document.createElement("div");
    body.className = "card-body";
    body.innerHTML = `
      <span class="card-topline"><span class="number-badge">${escapeHtml(card.setCode || "MY")}</span><span class="status-badge ${entry.owned ? "is-owned" : "is-missing"}">${entry.owned ? "보유" : "미보유"}</span></span>
      <strong class="card-name-ko">${escapeHtml(card.name)}</strong>
      <span class="custom-card-set">${escapeHtml(card.setTitle || card.setCode)}</span>
      <span class="card-meta">${escapeHtml(card.cardNumber || "직접 추가 카드")}</span>
    `;
    article.append(imageWrap, body);
    return article;
  }

  function renderSummary() {
    let cards = 0;
    let owned = 0;
    state.dexes.forEach((dex) => {
      cards += dex.cards.length;
      owned += dex.cards.filter((card) => card.owned).length;
    });
    $("custom-dex-count").textContent = String(state.dexes.length);
    $("custom-card-count").textContent = String(cards);
    $("custom-owned-count").textContent = String(owned);
  }

  function renderDexList() {
    const container = $("custom-dex-list");
    if (!state.selectedDexId || !state.dexes.some((dex) => dex.id === state.selectedDexId)) {
      state.selectedDexId = state.dexes[0]?.id || "";
    }
    container.replaceChildren();
    if (!state.dexes.length) {
      container.innerHTML = `<div class="custom-empty-card"><strong>공개된 나만의 도감이 없습니다.</strong><span>컬렉터가 공개 범위를 변경하면 이곳에 표시됩니다.</span></div>`;
      return;
    }
    const fragment = document.createDocumentFragment();
    state.dexes.forEach((dex) => {
      const owned = dex.cards.filter((card) => card.owned).length;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `custom-dex-tile${dex.id === state.selectedDexId ? " is-active" : ""}`;
      button.innerHTML = `
        <span class="custom-dex-tile-icon">MY</span>
        <span class="custom-dex-tile-copy"><strong>${escapeHtml(dex.title)}</strong><small>${owned} / ${dex.cards.length}장 보유</small></span>
        <span class="custom-dex-tile-arrow">›</span>`;
      button.addEventListener("click", () => {
        state.selectedDexId = dex.id;
        state.query = "";
        $("custom-search").value = "";
        setFilter("all");
        setUrlDex(dex.id);
        renderAll();
      });
      fragment.append(button);
    });
    container.append(fragment);
  }

  function renderWorkspace() {
    const dex = currentDex();
    if (!dex) {
      $("custom-workspace").hidden = true;
      $("custom-no-selection").hidden = false;
      return;
    }
    $("custom-workspace").hidden = false;
    $("custom-no-selection").hidden = true;
    $("selected-dex-title").textContent = dex.title;
    $("selected-dex-description").textContent = dex.description || "설명 없음";
    const owned = dex.cards.filter((card) => card.owned).length;
    $("selected-dex-progress").textContent = `${owned} / ${dex.cards.length}장 보유`;
    const entries = visibleCards(dex);
    $("custom-result-count").textContent = String(entries.length);
    const grid = $("custom-card-grid");
    grid.replaceChildren(...entries.map(renderCard));
    $("custom-card-empty").hidden = entries.length > 0;
  }

  function renderAll() {
    renderSummary();
    renderDexList();
    renderWorkspace();
  }

  async function loadProjection() {
    if (!CONFIG.enabled || !CONFIG.config?.projectId) throw new Error("Firebase 설정을 확인하지 못했습니다.");
    const [appModule, firestoreModule] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
    ]);
    const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(CONFIG.config);
    const db = firestoreModule.getFirestore(app);
    let projectionRef;
    if (/^[a-z0-9]{12}$/.test(publicId)) {
      projectionRef = firestoreModule.doc(db, "publicProfiles", publicId, "collections", "custom");
    } else if (/^[A-Za-z0-9_-]{32}$/.test(shareId)) {
      projectionRef = firestoreModule.doc(db, "sharedCollections", shareId);
    } else {
      throw new Error("공유 링크 형식이 올바르지 않습니다.");
    }
    const projectionSnapshot = await firestoreModule.getDoc(projectionRef);
    if (!projectionSnapshot.exists()) throw new Error("공개된 나만의 도감을 찾지 못했습니다.");
    const projection = projectionSnapshot.data() || {};
    if (projection.collectionId !== "custom" || projection.schemaVersion !== 1) {
      throw new Error("나만의 도감 공유 데이터가 올바르지 않습니다.");
    }
    state.dexes = normalizeDexes(projection.customDexes);
    let nickname = "컬렉터";
    if (/^[a-z0-9]{12}$/.test(projection.publicId || "")) {
      try {
        const profileSnapshot = await firestoreModule.getDoc(
          firestoreModule.doc(db, "publicProfiles", projection.publicId),
        );
        if (profileSnapshot.exists()) nickname = clean(profileSnapshot.data()?.nickname) || nickname;
      } catch (error) {
        console.warn("공개 프로필 이름을 불러오지 못했습니다.", error);
      }
    }
    return nickname;
  }

  function prepareReadonlyUi(nickname) {
    document.body.classList.add("shared-readonly-view", "collector-public-readonly");
    document.querySelector(".header-chip").textContent = "READ ONLY";
    $("custom-auth-status").textContent = `${nickname}님의 나만의 도감 · 읽기 전용`;
    $("custom-login").hidden = true;
    $("custom-logout").hidden = true;
    $("new-dex-button").hidden = true;
    $("add-card-button").hidden = true;
    $("edit-dex-button").hidden = true;
    $("delete-dex-button").hidden = true;
    document.querySelector(".custom-sort-hint").textContent = "공개된 카드 순서대로 표시합니다.";
    document.querySelector(".custom-hero .hero-description").textContent = `${nickname}님이 공개한 나만의 포켓몬 카드 도감`;
    document.querySelector(".custom-sidebar-heading small").textContent = "PUBLIC DEXES";
    document.querySelector(".catalog-caption").textContent = "컬렉터가 공개한 나만의 도감을 읽기 전용으로 보고 있습니다.";
  }

  function bindFilters() {
    $("custom-search").addEventListener("input", (event) => {
      state.query = event.currentTarget.value;
      renderWorkspace();
    });
    $("custom-status").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-status]");
      if (!button) return;
      setFilter(button.dataset.status);
      renderWorkspace();
    });
  }

  async function init() {
    bindFilters();
    try {
      const [nickname] = await Promise.all([loadProjection(), loadCatalog()]);
      prepareReadonlyUi(nickname);
      renderAll();
      setUrlDex(state.selectedDexId);
    } catch (error) {
      console.error("나만의 도감 공개 보기 초기화 실패", error);
      $("custom-auth-status").textContent = error.message || "공유 도감을 불러오지 못했습니다.";
      $("custom-error").hidden = false;
    }
  }

  void init();
})();
