"use strict";

(function () {
  const SDK_VERSION = "12.16.0";
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const registry = window.CollectorCollectionRegistry;
  const elements = {
    search: document.querySelector("#collector-directory-search"),
    count: document.querySelector("#collector-directory-count strong"),
    grid: document.querySelector("#collector-directory-grid"),
    loading: document.querySelector("#collector-directory-loading"),
    empty: document.querySelector("#collector-directory-empty"),
    error: document.querySelector("#collector-directory-error"),
  };
  let collectors = [];

  function configured() {
    const config = CONFIG.config || {};
    return Boolean(
      CONFIG.enabled &&
        config.apiKey &&
        config.authDomain &&
        config.projectId,
    );
  }

  function normalizedCustomDexes(source) {
    if (!Array.isArray(source)) return [];
    return source
      .map((dex) => {
        if (!dex || typeof dex !== "object" || Array.isArray(dex)) return null;
        const id = String(dex.id || "").trim();
        const title = String(dex.title || "").trim();
        if (!id || !title) return null;
        return { id, title };
      })
      .filter(Boolean);
  }

  function normalizedProjection(snapshot, publicId) {
    const data = snapshot.data() || {};
    const ownedCount = Math.max(0, Number(data.ownedCount) || 0);
    const totalCount = Math.max(0, Number(data.totalCount) || 0);
    if (
      data.schemaVersion !== 1 ||
      data.publicId !== publicId ||
      data.collectionId !== snapshot.id ||
      !registry.supportedCollectionId(snapshot.id) ||
      ownedCount > totalCount
    ) {
      return null;
    }
    return {
      collectionId: snapshot.id,
      ownedCount,
      totalCount,
      customDexes:
        snapshot.id === "custom"
          ? normalizedCustomDexes(data.customDexes)
          : [],
    };
  }

  function projectionDexCount(projection) {
    if (projection.collectionId !== "custom") return 1;
    return projection.customDexes.length || 1;
  }

  function projectionTagNames(projection) {
    if (projection.collectionId !== "custom") {
      return [registry.COLLECTIONS[projection.collectionId].title];
    }
    if (projection.customDexes.length) {
      return projection.customDexes.map((dex) => dex.title);
    }
    return [registry.COLLECTIONS.custom?.title || "나만의 도감"];
  }

  function publicDexCount(projections) {
    return projections.reduce(
      (total, projection) => total + projectionDexCount(projection),
      0,
    );
  }

  async function loadCollector(directorySnapshot, db, firestoreModule) {
    const publicId = String(directorySnapshot.id || "");
    const directory = directorySnapshot.data() || {};
    if (!/^[a-z0-9]{12}$/.test(publicId) || directory.publicId !== publicId) {
      return null;
    }

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
    const profile = profileSnapshot.data() || {};
    if (!profileSnapshot.exists() || profile.profileCompleted !== true) {
      return null;
    }

    const projections = collectionSnapshots.docs
      .map((snapshot) => normalizedProjection(snapshot, publicId))
      .filter(Boolean);
    if (!projections.length) return null;

    const ownedCount = projections.reduce(
      (total, projection) => total + projection.ownedCount,
      0,
    );
    const totalCount = projections.reduce(
      (total, projection) => total + projection.totalCount,
      0,
    );
    return {
      publicId,
      nickname: String(profile.nickname || "컬렉터").trim() || "컬렉터",
      bio: String(profile.bio || "").trim(),
      projections,
      dexCount: publicDexCount(projections),
      ownedCount,
      totalCount,
      rate: totalCount ? (ownedCount / totalCount) * 100 : 0,
    };
  }

  function profileUrl(publicId) {
    const url = new URL("./collector.html", window.location.href);
    url.searchParams.set("id", publicId);
    return url.href;
  }

  function createCard(collector) {
    const link = document.createElement("a");
    link.className = "collector-directory-card";
    link.href = profileUrl(collector.publicId);
    link.setAttribute(
      "aria-label",
      `${collector.nickname} 컬렉터의 공개 프로필, 공개 도감 ${collector.dexCount}개`,
    );
    link.innerHTML = `
      <div class="collector-directory-card-head">
        <span class="collector-directory-avatar" aria-hidden="true"></span>
        <span class="collector-directory-card-title"><strong></strong><small></small></span>
      </div>
      <p class="collector-directory-bio"></p>
      <div class="collector-directory-tags" aria-label="공개 도감"></div>
      <div class="collector-directory-summary">
        <span>공개 도감<strong></strong></span>
        <span>공개 항목<strong></strong></span>
        <b class="collector-directory-rate"></b>
      </div>
    `;
    link.querySelector(".collector-directory-avatar").textContent = collector.nickname
      .slice(0, 1)
      .toUpperCase();
    link.querySelector(".collector-directory-card-title strong").textContent =
      collector.nickname;
    link.querySelector(".collector-directory-card-title small").textContent =
      `PUBLIC ID · ${collector.publicId}`;
    link.querySelector(".collector-directory-bio").textContent =
      collector.bio || "한 줄 소개가 없습니다.";
    const tags = collector.projections
      .flatMap((projection) => projectionTagNames(projection))
      .map((name) => {
        const tag = document.createElement("span");
        tag.textContent = name;
        return tag;
      });
    link.querySelector(".collector-directory-tags").replaceChildren(...tags);
    const summaries = link.querySelectorAll(".collector-directory-summary strong");
    summaries[0].textContent = `${collector.dexCount}개`;
    summaries[1].textContent = `${collector.ownedCount.toLocaleString("ko-KR")} / ${collector.totalCount.toLocaleString("ko-KR")}`;
    link.querySelector(".collector-directory-rate").textContent =
      `${collector.rate.toFixed(1)}%`;
    return link;
  }

  function normalizedSearch(value) {
    return String(value || "")
      .normalize("NFKC")
      .trim()
      .toLocaleLowerCase("ko-KR");
  }

  function matchesSearch(collector, query) {
    if (!query) return true;
    const collectionNames = collector.projections
      .flatMap((projection) => projectionTagNames(projection))
      .join(" ");
    return normalizedSearch(
      `${collector.nickname} ${collector.bio} ${collectionNames}`,
    ).includes(query);
  }

  function render() {
    const query = normalizedSearch(elements.search.value);
    const visible = collectors.filter((collector) =>
      matchesSearch(collector, query),
    );
    elements.grid.replaceChildren(...visible.map(createCard));
    elements.count.textContent = visible.length.toLocaleString("ko-KR");
    elements.grid.hidden = visible.length === 0;
    elements.empty.hidden = visible.length > 0;
    elements.error.hidden = true;
  }

  async function initialize() {
    if (!configured() || !registry) {
      elements.loading.hidden = true;
      elements.error.hidden = false;
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
      const directorySnapshots = await firestoreModule.getDocs(
        firestoreModule.query(
          firestoreModule.collection(db, "publicCollectorDirectory"),
          firestoreModule.limit(100),
        ),
      );
      const loaded = await Promise.all(
        directorySnapshots.docs.map((snapshot) =>
          loadCollector(snapshot, db, firestoreModule),
        ),
      );
      collectors = loaded.filter(Boolean).sort((left, right) =>
        left.nickname.localeCompare(right.nickname, "ko-KR", {
          numeric: true,
          sensitivity: "base",
        }),
      );
      elements.loading.hidden = true;
      render();
    } catch (error) {
      console.error("공개 컬렉터 보드 초기화 실패", error);
      elements.loading.hidden = true;
      elements.grid.hidden = true;
      elements.empty.hidden = true;
      elements.error.hidden = false;
      elements.count.textContent = "—";
    }
  }

  elements.search.addEventListener("input", render);
  void initialize();
})();
