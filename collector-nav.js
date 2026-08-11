"use strict";

(function () {
  const registry = window.CollectorCollectionRegistry;
  const PROFILE_SETTINGS_HREF = "./collector-settings.html";
  const CARD_COLUMNS_STORAGE_KEY = "pokemonDexCardColumnsV1";

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
        "공개 컬렉터",
        "PUBLIC BOARD",
      );

    settings?.remove();
    dashboard.after(directory);

    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    const active = currentPage === "collectors.html";
    directory.classList.toggle("is-active", active);
    if (active) directory.setAttribute("aria-current", "page");
    else directory.removeAttribute("aria-current");
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

    status.href = PROFILE_SETTINGS_HREF;
    status.title = "내 프로필 관리";
    status.setAttribute("aria-label", `${status.textContent} · 내 프로필 관리 열기`);
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

  function storedCardColumns() {
    try {
      return window.localStorage.getItem(CARD_COLUMNS_STORAGE_KEY) === "3"
        ? "3"
        : "4";
    } catch (error) {
      return "4";
    }
  }

  function saveCardColumns(columns) {
    try {
      window.localStorage.setItem(CARD_COLUMNS_STORAGE_KEY, columns);
    } catch (error) {
      // 저장소 접근이 제한되어도 현재 화면의 열 전환은 계속 제공합니다.
    }
  }

  function updateCardLayout(columns, button) {
    const normalized = columns === "3" ? "3" : "4";
    document.documentElement.dataset.cardColumns = normalized;
    button.dataset.columns = normalized;
    button.setAttribute("aria-pressed", String(normalized === "3"));
    button.textContent = normalized === "3"
      ? "▦ 4열 기본 보기"
      : "▦ 3열 크게 보기";
    button.title = normalized === "3"
      ? "카드를 한 줄에 4개씩 표시합니다."
      : "카드를 한 줄에 3개씩 크게 표시합니다.";
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

    updateCardLayout(storedCardColumns(), button);
    button.addEventListener("click", () => {
      const next = button.dataset.columns === "3" ? "4" : "3";
      updateCardLayout(next, button);
      saveCardColumns(next);
    });
  }

  function addHeroActions() {
    if (["collector-settings", "collector-directory"].includes(document.body.dataset.page)) {
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
  addCardLayoutToggle();
  addHeroActions();
})();
