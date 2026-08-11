"use strict";

(function () {
  const registry = window.CollectorCollectionRegistry;

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
    const settings =
      nav.querySelector('[href*="collector-settings.html"]') ||
      navigationLink(
        "./collector-settings.html",
        "CS",
        "도감 관리",
        "PROFILE · SHARING",
      );
    const directory =
      nav.querySelector('[href*="collectors.html"]') ||
      navigationLink(
        "./collectors.html",
        "PB",
        "공개 컬렉터",
        "PUBLIC BOARD",
      );

    dashboard.after(settings);
    settings.after(directory);

    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    for (const [link, page] of [
      [settings, "collector-settings.html"],
      [directory, "collectors.html"],
    ]) {
      const active = currentPage === page;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
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
        <a href="./collector-settings.html">도감 관리에서 다시 확인</a>
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
  addHeroActions();
})();
