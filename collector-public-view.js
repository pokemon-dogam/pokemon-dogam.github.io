"use strict";

(function () {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(
    String(window.location.hash || "").replace(/^#/, ""),
  );
  const requestedShareId = hashParams.get("share") || "";
  const requestedPublicId = params.get("collector") || "";
  const requested = Boolean(requestedShareId || requestedPublicId);
  let activeContext = null;

  function validPublicId(value) {
    return /^[a-z0-9]{12}$/.test(String(value || ""));
  }

  function validShareId(value) {
    return /^[A-Za-z0-9_-]{32}$/.test(String(value || ""));
  }

  function projectionOverrides(projection) {
    return Object.fromEntries(
      (Array.isArray(projection?.ownedKeys) ? projection.ownedKeys : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .map((key) => [key, { owned: true }]),
    );
  }

  function projectionPackDocument(projection) {
    return {
      baseMode: "empty",
      ownedCodes: Array.isArray(projection?.ownedKeys) ? projection.ownedKeys : [],
      ownedPromoPackIds: Array.isArray(projection?.promoOwnedKeys)
        ? projection.promoOwnedKeys
        : [],
      customPromoPacks: [],
    };
  }

  function projectionPeopleDocument(projection) {
    return {
      baseMode: "empty",
      peopleOwned: Object.fromEntries(
        (Array.isArray(projection?.ownedKeys) ? projection.ownedKeys : [])
          .map((value) => String(value || "").trim())
          .filter(Boolean)
          .map((key) => [key, true]),
      ),
      peopleOverrides: {},
    };
  }

  async function loadPublicProfile(db, firestoreModule, publicId) {
    const reference = firestoreModule.doc(db, "publicProfiles", publicId);
    const snapshot = await firestoreModule.getDoc(reference);
    if (!snapshot.exists()) throw new Error("공개 컬렉터 프로필을 찾지 못했습니다.");
    const profile = snapshot.data() || {};
    if (!profile.profileCompleted) {
      throw new Error("공개 컬렉터 프로필을 사용할 수 없습니다.");
    }
    return profile;
  }

  async function loadProjection(db, firestoreModule, collectionId) {
    if (!requested) return null;
    const registry = window.CollectorCollectionRegistry;
    if (!registry?.supportedCollectionId?.(collectionId)) {
      throw new Error("지원하지 않는 공개 도감입니다.");
    }

    let publicId = requestedPublicId;
    let projectionSnapshot;
    let mode;

    if (requestedShareId) {
      if (!validShareId(requestedShareId)) {
        throw new Error("공유 링크 형식이 올바르지 않습니다.");
      }
      mode = "unlisted";
      projectionSnapshot = await firestoreModule.getDoc(
        firestoreModule.doc(db, "sharedCollections", requestedShareId),
      );
      if (!projectionSnapshot.exists()) {
        throw new Error("비공개로 전환되었거나 만료된 공유 링크입니다.");
      }
      publicId = String(projectionSnapshot.data()?.publicId || "");
    } else {
      if (!validPublicId(publicId)) {
        throw new Error("컬렉터 프로필 링크 형식이 올바르지 않습니다.");
      }
      mode = "public";
      projectionSnapshot = await firestoreModule.getDoc(
        firestoreModule.doc(
          db,
          "publicProfiles",
          publicId,
          "collections",
          collectionId,
        ),
      );
      if (!projectionSnapshot.exists()) {
        throw new Error("이 도감은 공개되어 있지 않습니다.");
      }
    }

    const projection = projectionSnapshot.data() || {};
    if (
      projection.schemaVersion !== 1 ||
      projection.collectionId !== collectionId ||
      projection.publicId !== publicId ||
      !validPublicId(publicId)
    ) {
      throw new Error("공유 도감 데이터를 확인하지 못했습니다.");
    }

    const profile = await loadPublicProfile(db, firestoreModule, publicId);
    activeContext = { mode, publicId, collectionId, projection, profile };
    activateReadOnlyUi(activeContext);
    return activeContext;
  }

  function activateReadOnlyUi(context) {
    document.documentElement.classList.add(
      "shared-readonly-view",
      "collector-public-readonly",
    );
    document.body?.setAttribute("data-collector-readonly", context.mode);
    const chip = document.querySelector(".header-chip");
    if (chip) chip.textContent = "READ ONLY";
    const title = document.querySelector("#page-title, .hero h1");
    if (title && !title.dataset.collectorTitle) {
      title.dataset.collectorTitle = "true";
      title.insertAdjacentHTML(
        "afterend",
        `<p class="collector-readonly-owner"><strong></strong>님의 공개 도감 · READ ONLY</p>`,
      );
      title.nextElementSibling?.querySelector("strong")?.append(
        document.createTextNode(context.profile.nickname || "컬렉터"),
      );
    }
    ensureReturnLink(context);
    window.dispatchEvent(
      new CustomEvent("pokemon-dex:collector-public-ready", {
        detail: {
          publicId: context.publicId,
          collectionId: context.collectionId,
          nickname: context.profile.nickname || "컬렉터",
        },
      }),
    );
  }

  function ensureReturnLink(context) {
    const main = document.querySelector(".main-content");
    if (!main || document.querySelector("#collector-readonly-return")) return;
    const bar = document.createElement("div");
    bar.id = "collector-readonly-return";
    bar.className = "collector-readonly-bar";
    bar.innerHTML = `
      <span><b></b>님의 컬렉션을 읽기 전용으로 보고 있습니다.</span>
      <a href="./collector.html?id=${encodeURIComponent(context.publicId)}">컬렉터 프로필로 돌아가기</a>
    `;
    bar.querySelector("b").textContent = context.profile.nickname || "컬렉터";
    main.prepend(bar);
  }

  function showAccessError(error) {
    document.documentElement.classList.add(
      "shared-readonly-view",
      "collector-public-readonly",
    );
    const main = document.querySelector(".main-content");
    if (!main || document.querySelector("#collector-access-error")) return;
    const panel = document.createElement("section");
    panel.id = "collector-access-error";
    panel.className = "collector-access-error";
    panel.innerHTML = `
      <strong>이 공유 도감을 열 수 없습니다.</strong>
      <p></p>
      <a href="./">디지털 카드 바인더 홈으로</a>
    `;
    panel.querySelector("p").textContent =
      error?.message || "공개 범위가 변경되었거나 링크가 올바르지 않습니다.";
    main.prepend(panel);
  }

  function authLabel(fallback = "공개 도감") {
    return activeContext
      ? `${activeContext.profile.nickname || "컬렉터"} · 읽기 전용`
      : fallback;
  }

  window.CollectorPublicView = {
    authLabel,
    get active() {
      return activeContext;
    },
    loadProjection,
    projectionOverrides,
    projectionPackDocument,
    projectionPeopleDocument,
    requested,
    requestedPublicId,
    requestedShareId,
    showAccessError,
  };
})();
