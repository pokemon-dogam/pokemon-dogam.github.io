"use strict";

(function () {
  const registry = window.CollectorCollectionRegistry;
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const PROFILE_SETTINGS_HREF = "./collector-settings.html";
  const CARD_COLUMNS_STORAGE_KEY = "pokemonDexCardColumnsV1";
  const COMPACT_CARD_COLUMNS_STORAGE_KEY = "pokemonDexCompactCardColumnsV1";
  const COMPACT_CARD_LAYOUT_QUERY = "(max-width: 920px)";
  const compactCardLayoutMedia = typeof window.matchMedia === "function"
    ? window.matchMedia(COMPACT_CARD_LAYOUT_QUERY)
    : null;
  const CARD_LAYOUT_MODES = {
    desktop: {
      defaultColumns: "4",
      alternateColumns: "3",
      storageKey: CARD_COLUMNS_STORAGE_KEY,
    },
    compact: {
      defaultColumns: "2",
      alternateColumns: "4",
      storageKey: COMPACT_CARD_COLUMNS_STORAGE_KEY,
    },
  };

  function navigationLink(href, icon, title, subtitle) {
    const link = document.createElement("a");
    link.className = "collection-link";
    link.href = href;
    link.innerHTML = `
      <span class="collection-icon" aria-hidden="true">${icon}</span>
      <span><strong>${title}</strong><small>${subtitle}</small></span>
    `;
    return link;
  }

  function targetPage(link) {
    try {
      const url = new URL(link.getAttribute("href") || "", window.location.href);
      return url.pathname.split("/").pop() || "index.html";
    } catch {
      return "";
    }
  }

  function normalizeNavigationState(nav) {
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    const activePage = currentPage === "collector.html" ? "collectors.html" : currentPage;
    nav.querySelectorAll(".collection-link").forEach((link) => {
      const active = targetPage(link) === activePage;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
      const icon = link.querySelector(".collection-icon");
      if (icon) icon.classList.toggle("collection-icon--red", active);
    });
  }

  function arrangeCollectorNavigation() {
    const nav = document.querySelector(".collection-nav");
    if (!nav) return;

    const dashboard = nav.querySelector(".collection-link");
    if (!dashboard) return;
    const settings = nav.querySelector('[href*="collector-settings.html"]');
    const directory =
      nav.querySelector('[href*="collectors.html"]') ||
      navigationLink(
        "./collectors.html",
        "PB",
        "도감 갤러리",
        "PUBLIC BOARD",
      );
    const customDex =
      nav.querySelector('[href*="custom.html"]') ||
      navigationLink(
        "./custom.html",
        "08",
        "나만의 도감",
        "MY CUSTOM DEX",
      );

    const directoryTitle = directory.querySelector("strong");
    if (directoryTitle) directoryTitle.textContent = "도감 갤러리";

    const pokemonCollections = nav.querySelector('[href*="pokemon-collections.html"]');
    const pokemonCount = pokemonCollections?.querySelector("small");
    if (pokemonCount) pokemonCount.textContent = "67 POKÉMON";

    settings?.remove();
    dashboard.after(directory);
    const people = nav.querySelector('[href*="people.html"]');
    if (people) people.after(customDex);
    else nav.append(customDex);
    normalizeNavigationState(nav);
  }

  function decorateAccountProfileEntry(panel) {
    if (!panel) return;
    let status = panel.querySelector("#firebase-auth-status");
    if (!status) return;

    if (status.tagName !== "A") {
      const link = document.createElement("a");
      link.id = status.id;
      link.className = status.className;
      link.textContent = status.textContent;
      status.replaceWith(link);
      status = link;
    }

    const publicCollectionView = Boolean(window.CollectorPublicView?.requested);
    const profileEnabled =
      panel.classList.contains("is-account") &&
      !panel.classList.contains("is-shared-readonly") &&
      !publicCollectionView;
    status.classList.toggle("firebase-profile-link", profileEnabled);

    if (!profileEnabled) {
      status.removeAttribute("href");
      status.removeAttribute("title");
      status.removeAttribute("aria-label");
      status.removeAttribute("aria-current");
      return;
    }

    status.textContent = "프로필설정";
    status.href = PROFILE_SETTINGS_HREF;
    status.title = "내 프로필 관리";
    status.setAttribute("aria-label", "프로필설정 · 내 프로필 관리 열기");
    if (window.location.pathname.endsWith("/collector-settings.html")) {
      status.setAttribute("aria-current", "page");
    } else {
      status.removeAttribute("aria-current");
    }
  }

  function watchAccountProfileEntry() {
    const watchPanel = (panel) => {
      decorateAccountProfileEntry(panel);
      const stateObserver = new MutationObserver(() => {
        decorateAccountProfileEntry(panel);
      });
      stateObserver.observe(panel, {
        attributes: true,
        attributeFilter: ["class"],
      });
    };

    const existing = document.querySelector("#firebase-auth-panel");
    if (existing) {
      watchPanel(existing);
      return;
    }

    const panelObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          const panel = node.matches?.("#firebase-auth-panel")
            ? node
            : node.querySelector?.("#firebase-auth-panel");
          if (!panel) continue;
          panelObserver.disconnect();
          watchPanel(panel);
          return;
        }
      }
    });
    panelObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  async function firstAuthUser(auth, authModule) {
    if (typeof auth.authStateReady === "function") {
      await auth.authStateReady();
      return auth.currentUser || null;
    }
    return new Promise((resolve, reject) => {
      let unsubscribe = () => {};
      unsubscribe = authModule.onAuthStateChanged(
        auth,
        (user) => {
          unsubscribe();
          resolve(user || null);
        },
        reject,
      );
    });
  }

  function replaceHeaderChipWithProfileShortcut() {
    const chip = document.querySelector(".header-chip");
    if (!chip || chip.matches("a[href*='collector-settings.html']")) return;
    const link = document.createElement("a");
    link.className = chip.className;
    link.href = PROFILE_SETTINGS_HREF;
    link.textContent = "프로필설정";
    link.title = "내 프로필 관리";
    link.setAttribute("aria-label", "프로필설정 · 내 프로필 관리 열기");
    chip.replaceWith(link);
  }

  function ensureProfileShortcutWithoutPanel() {
    window.setTimeout(async () => {
      if (document.querySelector("#firebase-auth-panel")) return;
      const config = CONFIG.config || {};
      if (!CONFIG.enabled || !config.apiKey || !config.authDomain || !config.projectId) return;
      try {
        const SDK_VERSION = "12.16.0";
        const [appModule, authModule] = await Promise.all([
          import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
          import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
        ]);
        const app = appModule.getApps().length
          ? appModule.getApp()
          : appModule.initializeApp(config);
        const auth = authModule.getAuth(app);
        const user = await firstAuthUser(auth, authModule);
        if (user && !document.querySelector("#firebase-auth-panel")) {
          replaceHeaderChipWithProfileShortcut();
        }
      } catch (error) {
        console.warn("프로필설정 바로가기를 확인하지 못했습니다.", error);
      }
    }, 700);
  }

  function activeCardLayoutMode() {
    return compactCardLayoutMedia?.matches
      ? CARD_LAYOUT_MODES.compact
      : CARD_LAYOUT_MODES.desktop;
  }

  function storedCardColumns(mode) {
    try {
      const stored = window.localStorage.getItem(mode.storageKey);
      return [mode.defaultColumns, mode.alternateColumns].includes(stored)
        ? stored
        : mode.defaultColumns;
    } catch (error) {
      return mode.defaultColumns;
    }
  }

  function saveCardColumns(columns, mode) {
    try {
      window.localStorage.setItem(mode.storageKey, columns);
    } catch (error) {
      // 저장소 접근이 제한되어도 현재 화면의 열 전환은 계속 제공합니다.
    }
  }

  function updateCardLayout(columns, button, mode) {
    const normalized = columns === mode.alternateColumns
      ? mode.alternateColumns
      : mode.defaultColumns;
    const compact = mode === CARD_LAYOUT_MODES.compact;
    const alternateActive = normalized === mode.alternateColumns;
    document.documentElement.dataset.cardColumns = normalized;
    button.dataset.columns = normalized;
    button.dataset.layoutMode = compact ? "compact" : "desktop";
    button.setAttribute("aria-pressed", String(alternateActive));

    if (compact) {
      button.textContent = normalized === "4"
        ? "▦ 2열 기본 보기"
        : "▦ 4열로 보기";
      button.title = normalized === "4"
        ? "카드를 한 줄에 2개씩 크게 표시합니다."
        : "카드를 한 줄에 4개씩 표시합니다.";
    } else {
      button.textContent = normalized === "3"
        ? "▦ 4열 기본 보기"
        : "▦ 3열 크게 보기";
      button.title = normalized === "3"
        ? "카드를 한 줄에 4개씩 표시합니다."
        : "카드를 한 줄에 3개씩 크게 표시합니다.";
    }
    button.setAttribute("aria-label", button.title);
  }

  function addCardLayoutToggle() {
    if (!registry?.collectionIdForPage?.()) return;
    const resultsBar = document.querySelector(
      ".catalog-panel .results-bar:not(.promo-results-bar)",
    );
    if (!resultsBar || resultsBar.querySelector(".card-layout-toggle")) return;

    const actions = document.createElement("div");
    actions.className = "results-bar-actions";
    for (const child of [...resultsBar.children]) {
      if (child.matches("button")) actions.append(child);
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "card-layout-toggle";
    actions.append(button);
    resultsBar.append(actions);

    const restoreLayout = () => {
      const mode = activeCardLayoutMode();
      updateCardLayout(storedCardColumns(mode), button, mode);
    };

    restoreLayout();
    button.addEventListener("click", () => {
      const mode = activeCardLayoutMode();
      const next = button.dataset.columns === mode.alternateColumns
        ? mode.defaultColumns
        : mode.alternateColumns;
      updateCardLayout(next, button, mode);
      saveCardColumns(next, mode);
    });

    if (typeof compactCardLayoutMedia?.addEventListener === "function") {
      compactCardLayoutMedia.addEventListener("change", restoreLayout);
    } else if (typeof compactCardLayoutMedia?.addListener === "function") {
      compactCardLayoutMedia.addListener(restoreLayout);
    }
  }

  function addHeroActions() {
    if (["collector-settings", "collector-directory", "collector-public", "custom-dex"].includes(document.body.dataset.page)) {
      return;
    }
    const heroContent = document.querySelector(".hero .hero-content");
    if (!heroContent || heroContent.querySelector(".collector-page-actions")) return;
    const collectionId = registry?.collectionIdForPage?.() || "";
    const publicView = window.CollectorPublicView;
    const actions = document.createElement("div");
    actions.className = "collector-page-actions";

    if (publicView?.requested) {
      const publicId = publicView.requestedShareId
        ? ""
        : publicView.requestedPublicId;
      if (/^[a-z0-9]{12}$/.test(publicId)) {
        const profile = document.createElement("a");
        profile.href = `./collector.html?id=${encodeURIComponent(publicId)}`;
        profile.textContent = "컬렉터 프로필로 돌아가기";
        actions.append(profile);
      }
      heroContent.append(actions);
      window.addEventListener(
        "pokemon-dex:collector-public-ready",
        (event) => {
          if (actions.querySelector("a")) return;
          const profile = document.createElement("a");
          profile.href = `./collector.html?id=${encodeURIComponent(event.detail.publicId)}`;
          profile.textContent = "컬렉터 프로필로 돌아가기";
          actions.append(profile);
        },
        { once: true },
      );
      return;
    }

    const settings = document.createElement("a");
    settings.href = collectionId
      ? `./collector-settings.html?collection=${encodeURIComponent(collectionId)}`
      : "./collector-settings.html";
    settings.textContent = collectionId ? "이 도감 공유·설정" : "대시보드 편집";
    actions.append(settings);

    if (!collectionId) {
      const profile = document.createElement("a");
      profile.id = "collector-profile-shortcut";
      profile.href = "./collector-settings.html#collector-profile-title";
      profile.textContent = "컬렉터 프로필";
      actions.append(profile);
    }
    heroContent.append(actions);
  }

  function showPublicSyncWarning(event) {
    const main = document.querySelector(".main-content");
    if (!main) return;
    let warning = document.querySelector("#collector-sync-warning");
    if (!warning) {
      warning = document.createElement("div");
      warning.id = "collector-sync-warning";
      warning.className = "collector-sync-warning";
      warning.setAttribute("role", "status");
      warning.innerHTML = `
        <div><strong>개인 도감은 저장했지만 공개 화면 갱신이 지연되고 있습니다.</strong><span></span></div>
        <a href="./collector-settings.html">내 프로필 관리에서 다시 확인</a>
      `;
      main.prepend(warning);
    }
    const collectionId = event.detail?.collectionId || "";
    const meta = registry?.COLLECTIONS?.[collectionId];
    warning.querySelector("span").textContent = meta
      ? ` ${meta.title}의 공개 범위와 네트워크를 확인해 주세요.`
      : " 공개 범위와 네트워크를 확인해 주세요.";
    warning.querySelector("a").href = collectionId
      ? `./collector-settings.html?collection=${encodeURIComponent(collectionId)}`
      : "./collector-settings.html";
  }

  window.addEventListener("pokemon-dex:public-sync-error", showPublicSyncWarning);
  arrangeCollectorNavigation();
  watchAccountProfileEntry();
  ensureProfileShortcutWithoutPanel();
  addCardLayoutToggle();
  addHeroActions();
})();
