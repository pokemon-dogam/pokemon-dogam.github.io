"use strict";

(function () {
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const COLLECTION_ORDER = [
    "national",
    "pack",
    "artist",
    "series",
    "pokemon",
    "ar",
    "people",
  ];
  const COLLECTIONS = {
    national: {
      number: "01",
      title: "전국도감",
      description: "1세대부터 9세대까지",
      href: "./national.html",
      documentId: CONFIG.userDocument || "nationalDex",
      unit: "종",
      defaultDashboardVisible: true,
    },
    pack: {
      number: "02",
      title: "팩 전종수집",
      description: "S · SV · M 확장팩",
      href: "./packs.html",
      documentId: "packDex",
      unit: "팩",
      defaultDashboardVisible: true,
    },
    artist: {
      number: "03",
      title: "작가 도감",
      description: "일러스트레이터별 카드",
      href: "./artists.html",
      documentId: "artistDex",
      unit: "장",
      defaultDashboardVisible: true,
    },
    series: {
      number: "04",
      title: "시리즈 도감",
      description: "확장팩별 카드 목록",
      href: "./series.html",
      documentId: "seriesDex",
      unit: "장",
      defaultDashboardVisible: true,
    },
    pokemon: {
      number: "05",
      title: "포켓몬 컬렉션",
      description: "좋아하는 포켓몬별 카드",
      href: "./pokemon-collections.html",
      documentId: "pokemonCollectionsDex",
      unit: "장",
      defaultDashboardVisible: true,
    },
    ar: {
      number: "06",
      title: "AR 전종도감",
      description: "SV · M 시리즈 AR",
      href: "./ar.html",
      documentId: "arDex",
      unit: "장",
      defaultDashboardVisible: true,
    },
    people: {
      number: "07",
      title: "인물도감",
      description: "트레이너·주요 인물 아카이브",
      href: "./people.html",
      documentId: CONFIG.userDocument || "nationalDex",
      unit: "명",
      defaultDashboardVisible: false,
    },
  };
  const catalogPromises = new Map();
  let promoIdsPromise = null;

  function cleanString(value) {
    return String(value || "").trim();
  }

  function supportedCollectionId(value) {
    return Object.prototype.hasOwnProperty.call(COLLECTIONS, value);
  }

  function groupIdentity(group, groupIndex) {
    return String(group.code || group.name || group.title || groupIndex);
  }

  function cardIdentity(collectionId, group, card, groupIndex, cardIndex) {
    const groupId = groupIdentity(group, groupIndex);
    const accountIndex = Number.isInteger(card.accountIndex)
      ? card.accountIndex
      : cardIndex;

    if (collectionId === "artist") {
      return [
        groupId,
        card.set || "",
        card.cardNumber || "",
        card.order ?? cardIndex,
      ].join("::");
    }

    if (collectionId === "series") {
      return [groupId, card.code || card.meta || cardIndex, cardIndex].join("::");
    }

    return [
      groupId,
      card.meta || card.code || card.name || cardIndex,
      accountIndex,
    ].join("::");
  }

  async function fetchJson(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`${path} ${response.status}`);
    return response.json();
  }

  async function loadPackCatalog() {
    const response = await fetch("./packs.js", { cache: "no-store" });
    if (!response.ok) throw new Error(`./packs.js ${response.status}`);
    const source = await response.text();
    const items = [];
    const pattern = /\["([^"]+)","([^"]+)","([^"]+)",([01])\]/g;
    let match;

    while ((match = pattern.exec(source))) {
      items.push({
        key: match[3],
        name: match[2],
        groupKey: match[1],
        groupName: `${match[1]} 시리즈`,
        baselineOwned: match[4] === "1",
      });
    }

    if (!items.length) throw new Error("팩도감 목록을 확인하지 못했습니다.");
    return makeCatalog("pack", items);
  }

  function makeCatalog(collectionId, items) {
    const groups = new Map();
    for (const item of items) {
      if (!groups.has(item.groupKey)) {
        groups.set(item.groupKey, {
          key: item.groupKey,
          name: item.groupName,
          itemKeys: [],
        });
      }
      groups.get(item.groupKey).itemKeys.push(item.key);
    }
    return {
      collectionId,
      items,
      itemMap: new Map(items.map((item) => [item.key, item])),
      groups: [...groups.values()],
    };
  }

  async function buildCatalog(collectionId) {
    if (collectionId === "pack") return loadPackCatalog();

    if (collectionId === "national") {
      const data = await fetchJson("./data/pokedex.json");
      return makeCatalog(
        collectionId,
        (data.records || []).map((record) => ({
          key: String(record.number),
          name: record.nameKo,
          groupKey: `generation-${record.generation}`,
          groupName: `${record.generation}세대 전국도감`,
          baselineOwned: Boolean(record.owned),
        })),
      );
    }

    if (collectionId === "people") {
      const data = await fetchJson("./data/people.json");
      return makeCatalog(
        collectionId,
        (data.people || []).map((person) => ({
          key: String(person.id),
          name: person.nameKo,
          groupKey: `generation-${person.generation}`,
          groupName: `${person.generation}세대 인물도감`,
          baselineOwned: false,
        })),
      );
    }

    const pathByCollection = {
      artist: "./data/artists.json",
      series: "./data/series.json",
      pokemon: "./data/pokemon-collections.json",
      ar: "./data/ar.json",
    };
    const payload = await fetchJson(pathByCollection[collectionId]);
    const sourceGroups = collectionId === "artist" ? payload.artists || [] : payload || [];
    const items = [];

    sourceGroups.forEach((group, groupIndex) => {
      const groupKey = groupIdentity(group, groupIndex);
      const groupName =
        collectionId === "artist"
          ? group.name
          : collectionId === "series"
            ? `${group.code || ""} ${group.title || ""}`.trim()
            : collectionId === "ar"
              ? `${group.code || ""} · ${group.title || ""}`.trim()
              : group.name;

      (group.cards || []).forEach((card, cardIndex) => {
        items.push({
          key: cardIdentity(collectionId, group, card, groupIndex, cardIndex),
          name: card.name || card.pokemonName || card.code || groupName,
          groupKey,
          groupName,
          baselineOwned: Boolean(card.owned),
        });
      });
    });
    return makeCatalog(collectionId, items);
  }

  function loadCatalog(collectionId) {
    if (!supportedCollectionId(collectionId)) {
      return Promise.reject(new Error("지원하지 않는 도감입니다."));
    }
    if (!catalogPromises.has(collectionId)) {
      catalogPromises.set(
        collectionId,
        buildCatalog(collectionId).catch((error) => {
          catalogPromises.delete(collectionId);
          throw error;
        }),
      );
    }
    return catalogPromises.get(collectionId);
  }

  async function loadPromoIds() {
    if (!promoIdsPromise) {
      promoIdsPromise = fetchJson("./data/promo-packs.json")
        .then((payload) => {
          const values = Array.isArray(payload) ? payload : payload.packs || [];
          return new Set(values.map((item) => cleanString(item.id)).filter(Boolean));
        })
        .catch((error) => {
          promoIdsPromise = null;
          throw error;
        });
    }
    return promoIdsPromise;
  }

  function normalizedOverrides(source) {
    return source && typeof source === "object" && !Array.isArray(source)
      ? source
      : {};
  }

  function overrideOwned(value) {
    if (typeof value === "boolean") return value;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return Boolean(value.owned);
  }

  async function ownershipFor(collectionId, sourceDocument = {}) {
    const catalog = await loadCatalog(collectionId);
    const source = sourceDocument && typeof sourceDocument === "object"
      ? sourceDocument
      : {};

    if (collectionId === "people") {
      const ownedMap = normalizedOverrides(source.peopleOwned);
      return {
        catalog,
        ownedKeys: catalog.items
          .filter((item) => ownedMap[item.key] === true)
          .map((item) => item.key),
        promoOwnedKeys: [],
      };
    }

    if (collectionId === "pack") {
      const sourceCodes = Array.isArray(source.ownedCodes)
        ? source.ownedCodes.map((value) => cleanString(value))
        : source.baseMode === "legacy"
          ? catalog.items.filter((item) => item.baselineOwned).map((item) => item.key)
          : [];
      const normalizedCodes = new Set(sourceCodes.map((value) => value.toLowerCase()));
      const promoIds = await loadPromoIds();
      const promoCandidates = [
        ...(Array.isArray(source.ownedPromoPackIds) ? source.ownedPromoPackIds : []),
        ...sourceCodes,
      ].map((value) => cleanString(value));
      return {
        catalog,
        ownedKeys: catalog.items
          .filter((item) => normalizedCodes.has(item.key.toLowerCase()))
          .map((item) => item.key),
        promoOwnedKeys: [...new Set(promoCandidates.filter((id) => promoIds.has(id)))],
      };
    }

    const overrides = normalizedOverrides(source.overrides);
    const useLegacy = source.baseMode === "legacy";
    return {
      catalog,
      ownedKeys: catalog.items
        .filter((item) => {
          const explicit = overrideOwned(overrides[item.key]);
          return explicit === null ? useLegacy && item.baselineOwned : explicit;
        })
        .map((item) => item.key),
      promoOwnedKeys: [],
    };
  }

  async function buildProjection(collectionId, sourceDocument, publicId) {
    if (!/^[a-z0-9]{12}$/.test(cleanString(publicId))) {
      throw new Error("공개 프로필 식별값이 올바르지 않습니다.");
    }
    const ownership = await ownershipFor(collectionId, sourceDocument);
    return {
      schemaVersion: 1,
      publicId,
      collectionId,
      ownedKeys: ownership.ownedKeys,
      ownedCount: ownership.ownedKeys.length,
      totalCount: ownership.catalog.items.length,
      promoOwnedKeys: ownership.promoOwnedKeys,
      promoOwnedCount: ownership.promoOwnedKeys.length,
    };
  }

  function projectionOwnership(projection, catalog) {
    const allowed = catalog?.itemMap || new Map();
    const values = Array.isArray(projection?.ownedKeys) ? projection.ownedKeys : [];
    return new Set(
      values
        .map((value) => cleanString(value))
        .filter((key) => key && allowed.has(key)),
    );
  }

  function defaultSetting(collectionId) {
    const meta = COLLECTIONS[collectionId];
    return {
      schemaVersion: 1,
      collectionId,
      dashboardVisible: Boolean(meta?.defaultDashboardVisible),
      visibility: "private",
      displayOrder: COLLECTION_ORDER.indexOf(collectionId),
      shareId: "",
    };
  }

  function normalizeSetting(collectionId, source) {
    const fallback = defaultSetting(collectionId);
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      return fallback;
    }
    const visibility = ["private", "unlisted", "public"].includes(source.visibility)
      ? source.visibility
      : "private";
    const shareId = /^[A-Za-z0-9_-]{32}$/.test(cleanString(source.shareId))
      ? cleanString(source.shareId)
      : "";
    return {
      ...fallback,
      dashboardVisible:
        typeof source.dashboardVisible === "boolean"
          ? source.dashboardVisible
          : fallback.dashboardVisible,
      visibility,
      displayOrder: Number.isInteger(source.displayOrder)
        ? source.displayOrder
        : fallback.displayOrder,
      shareId,
    };
  }

  function collectionIdForPage() {
    const catalog = document.body?.dataset.catalog;
    if (catalog && supportedCollectionId(catalog)) return catalog;
    const path = window.location.pathname.split("/").pop() || "index.html";
    return COLLECTION_ORDER.find((collectionId) => {
      const href = COLLECTIONS[collectionId].href.replace(/^\.\//, "");
      return href === path;
    }) || "";
  }

  function pageUrl(collectionId, params = {}) {
    const meta = COLLECTIONS[collectionId];
    if (!meta) return "./";
    const url = new URL(meta.href, window.location.href);
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
    return `${url.pathname.split("/").pop() || ""}${url.search}`;
  }

  window.CollectorCollectionRegistry = {
    COLLECTION_ORDER,
    COLLECTIONS,
    buildProjection,
    cardIdentity,
    collectionIdForPage,
    defaultSetting,
    loadCatalog,
    normalizeSetting,
    ownershipFor,
    pageUrl,
    projectionOwnership,
    supportedCollectionId,
  };
})();
