"use strict";

(function () {
  const SDK_VERSION = "12.16.0";
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const registry = window.CollectorCollectionRegistry;
  const elements = {
    profile: document.querySelector("#collector-public-profile"),
    avatarFallback: document.querySelector("#collector-public-avatar-fallback"),
    name: document.querySelector("#collector-public-name"),
    bio: document.querySelector("#collector-public-bio"),
    share: document.querySelector("#collector-public-share"),
    collections: document.querySelector("#collector-public-collections"),
    grid: document.querySelector("#collector-public-grid"),
    empty: document.querySelector("#collector-public-empty"),
    loading: document.querySelector("#collector-public-loading"),
    error: document.querySelector("#collector-public-error"),
  };
  const publicId = new URLSearchParams(window.location.search).get("id") || "";
  const MISSING_PROFILE_MESSAGE =
    "공개가 중단되었거나 존재하지 않는 컬렉터 프로필입니다.";
  const LOAD_ERROR_MESSAGE =
    "공개 컬렉터 프로필을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";

  function clean(value, limit = 0) {
    const text = String(value || "").trim();
    return limit ? text.slice(0, limit) : text;
  }

  function configured() {
    const config = CONFIG.config || {};
    return Boolean(
      CONFIG.enabled &&
        config.apiKey &&
        config.authDomain &&
        config.projectId,
    );
  }

  function canonicalUrl() {
    const url = new URL("./collector.html", window.location.href);
    url.searchParams.set("id", publicId);
    return url.href;
  }

  async function copyProfileUrl() {
    const value = canonicalUrl();
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const input = document.createElement("textarea");
      input.value = value;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.append(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    elements.share.textContent = "복사했습니다";
    window.setTimeout(() => {
      elements.share.textContent = "프로필 링크 복사";
    }, 1800);
  }

  function renderProfile(profile) {
    elements.name.textContent = profile.nickname || "컬렉터";
    elements.bio.textContent = profile.bio || "Pokémon Collection";
    elements.avatarFallback.textContent = (profile.nickname || "C")
      .slice(0, 1)
      .toUpperCase();
    document.title = `${profile.nickname || "Collector"}의 Pokémon Collection | MY POKÉMON DEX`;
    elements.profile.hidden = false;
  }

  function normalizeCustomDexes(source) {
    if (!Array.isArray(source)) return [];
    return source.slice(0, 30).map((dex) => {
      if (!dex || typeof dex !== "object" || Array.isArray(dex)) return null;
      const id = clean(dex.id, 120);
      const title = clean(dex.title, 60);
      if (!id || !title) return null;
      const cards = Array.isArray(dex.cards) ? dex.cards.slice(0, 1500) : [];
      return {
        id,
        title,
        description: clean(dex.description, 180) || "직접 만든 테마 카드 도감",
        totalCount: cards.length,
        ownedCount: cards.filter((card) => Boolean(card?.owned)).length,
      };
    }).filter(Boolean);
  }

  function normalizedProjection(snapshot) {
    const data = snapshot.data() || {};
    if (
      data.schemaVersion !== 1 ||
      data.collectionId !== snapshot.id ||
      data.publicId !== publicId ||
      !registry.supportedCollectionId(snapshot.id)
    ) {
      return null;
    }
    const ownedKeys = Array.isArray(data.ownedKeys) ? data.ownedKeys : [];
    const promoOwnedKeys = Array.isArray(data.promoOwnedKeys)
      ? data.promoOwnedKeys
      : [];
    const totalCount = Math.max(0, Number(data.totalCount) || 0);
    return {
      collectionId: snapshot.id,
      ownedCount: Math.min(totalCount, ownedKeys.length),
      totalCount,
      promoOwnedCount: promoOwnedKeys.length,
      customDexes: snapshot.id === "custom"
        ? normalizeCustomDexes(data.customDexes)
        : [],
    };
  }

  function createCardShell({ number, title, description, href, ownedCount, totalCount, unit = "장", promoOwnedCount = 0 }) {
    const rate = totalCount
      ? Number(((ownedCount / totalCount) * 100).toFixed(1))
      : 0;
    const link = document.createElement("a");
    link.href = href;
    link.className = "collector-public-card";
    link.style.setProperty("--rate", rate);
    link.setAttribute(
      "aria-label",
      `${title} ${ownedCount}/${totalCount}${unit}, ${rate.toFixed(1)}%`,
    );
    link.innerHTML = `
      <div>
        <div class="collector-public-card-top">
          <span class="collector-public-card-number" aria-hidden="true">${number}</span>
          <span class="collector-public-card-rate">${rate.toFixed(1)}%</span>
        </div>
        <h3></h3>
        <p></p>
      </div>
      <div>
        <div class="collector-public-card-count"><strong></strong><span></span></div>
        <div class="collector-public-card-progress" aria-hidden="true"><span></span></div>
      </div>
    `;
    link.querySelector("h3").textContent = title;
    link.querySelector("p").textContent = description;
    link.querySelector(".collector-public-card-count strong").textContent =
      ownedCount.toLocaleString("ko-KR");
    link.querySelector(".collector-public-card-count span").textContent =
      `/ ${totalCount.toLocaleString("ko-KR")}${unit}`;
    if (promoOwnedCount > 0) {
      const promo = document.createElement("small");
      promo.className = "collector-public-card-promo";
      promo.textContent = `프로모 ${promoOwnedCount.toLocaleString("ko-KR")}종`;
      link.querySelector(".collector-public-card-count").after(promo);
    }
    return link;
  }

  function createCollectionCard(projection) {
    const meta = registry.COLLECTIONS[projection.collectionId];
    const url = new URL(meta.href, window.location.href);
    url.searchParams.set("collector", publicId);
    return createCardShell({
      number: meta.number,
      title: meta.title,
      description: meta.description,
      href: url.href,
      ownedCount: projection.ownedCount,
      totalCount: projection.totalCount,
      unit: meta.unit,
      promoOwnedCount: projection.collectionId === "pack"
        ? projection.promoOwnedCount
        : 0,
    });
  }

  function createCustomDexCard(dex) {
    const url = new URL("./custom.html", window.location.href);
    url.searchParams.set("collector", publicId);
    url.searchParams.set("dex", dex.id);
    return createCardShell({
      number: "08",
      title: dex.title,
      description: dex.description,
      href: url.href,
      ownedCount: dex.ownedCount,
      totalCount: dex.totalCount,
      unit: "장",
    });
  }

  function renderCollections(projections) {
    const order = new Map(
      registry.COLLECTION_ORDER.map((collectionId, index) => [collectionId, index]),
    );
    projections.sort(
      (a, b) => order.get(a.collectionId) - order.get(b.collectionId),
    );
    const cards = projections.flatMap((projection) => {
      if (projection.collectionId === "custom") {
        return projection.customDexes.map(createCustomDexCard);
      }
      return [createCollectionCard(projection)];
    });
    elements.grid.replaceChildren(...cards);
    elements.empty.hidden = cards.length > 0;
    elements.grid.hidden = cards.length === 0;
    elements.collections.hidden = false;
  }

  function showError(message) {
    elements.loading.hidden = true;
    elements.error.hidden = false;
    const paragraph = elements.error.querySelector("p");
    if (paragraph && message) paragraph.textContent = message;
  }

  function publicProfileErrorMessage(error) {
    const code = String(error?.code || "").replace(/^firestore\//, "");
    if (
      code === "permission-denied" ||
      code === "not-found" ||
      error?.message === MISSING_PROFILE_MESSAGE
    ) {
      return MISSING_PROFILE_MESSAGE;
    }
    return LOAD_ERROR_MESSAGE;
  }

  async function initialize() {
    if (!/^[a-z0-9]{12}$/.test(publicId)) {
      showError("컬렉터 프로필 링크 형식이 올바르지 않습니다.");
      return;
    }
    if (!configured()) {
      showError("공개 프로필 연결 설정을 확인하지 못했습니다.");
      return;
    }

    try {
      const [appModule, firestoreModule] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
      ]);
      const app = appModule.getApps().length
        ? appModule.getApp()
        : appModule.initializeApp(CONFIG.config);
      const db = firestoreModule.getFirestore(app);
      const [profileSnapshot, collectionSnapshots] = await Promise.all([
        firestoreModule.getDoc(
          firestoreModule.doc(db, "publicProfiles", publicId),
        ),
        firestoreModule.getDocs(
          firestoreModule.collection(
            db,
            "publicProfiles",
            publicId,
            "collections",
          ),
        ),
      ]);
      if (!profileSnapshot.exists() || !profileSnapshot.data()?.profileCompleted) {
        throw new Error(MISSING_PROFILE_MESSAGE);
      }
      const profile = profileSnapshot.data() || {};
      const projections = collectionSnapshots.docs
        .map(normalizedProjection)
        .filter(Boolean);
      renderProfile(profile);
      renderCollections(projections);
      elements.loading.hidden = true;
    } catch (error) {
      console.error("공개 컬렉터 프로필 초기화 실패", error);
      showError(publicProfileErrorMessage(error));
    }
  }

  elements.share.addEventListener("click", copyProfileUrl);
  void initialize();
})();
