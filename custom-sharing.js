"use strict";

(function () {
  const registry = window.CollectorCollectionRegistry;
  if (!registry || registry.COLLECTIONS.custom) return;

  const MAX_DEXES = 30;
  const MAX_CARDS_PER_DEX = 1500;
  const originalSupportedCollectionId = registry.supportedCollectionId.bind(registry);
  const originalOwnershipFor = registry.ownershipFor.bind(registry);
  const originalBuildProjection = registry.buildProjection.bind(registry);

  registry.COLLECTION_ORDER.push("custom");
  registry.COLLECTIONS.custom = {
    number: "08",
    title: "나만의 도감",
    description: "직접 만드는 테마 도감",
    href: "./custom.html",
    documentId: "pokemonCollectionsDex",
    unit: "장",
    defaultDashboardVisible: true,
  };

  function clean(value, limit = 0) {
    const text = String(value || "").trim();
    return limit ? text.slice(0, limit) : text;
  }

  function normalizeManual(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const manual = {
      name: clean(value.name, 80),
      setCode: clean(value.setCode, 30),
      cardNumber: clean(value.cardNumber, 40),
      imageUrl: clean(value.imageUrl, 600),
    };
    return manual.name && manual.imageUrl ? manual : null;
  }

  function normalizeCard(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const key = clean(value.key, 220);
    if (!key) return null;
    return {
      key,
      owned: Boolean(value.owned),
      manual: normalizeManual(value.manual),
    };
  }

  function normalizeDex(value, fallbackId) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const id = clean(value.id || fallbackId, 120);
    const title = clean(value.title, 60);
    if (!id || !title) return null;
    const seen = new Set();
    const cards = (Array.isArray(value.cards) ? value.cards : [])
      .map(normalizeCard)
      .filter(Boolean)
      .filter((card) => {
        if (seen.has(card.key)) return false;
        seen.add(card.key);
        return true;
      })
      .slice(0, MAX_CARDS_PER_DEX);
    return {
      id,
      title,
      description: clean(value.description, 180),
      cards,
    };
  }

  function projectionDexes(source) {
    const customDexes = source?.customDexes;
    if (!customDexes || typeof customDexes !== "object" || Array.isArray(customDexes)) {
      return [];
    }
    return Object.entries(customDexes)
      .slice(0, MAX_DEXES)
      .map(([id, value]) => normalizeDex(value, id))
      .filter(Boolean);
  }

  function customOwnership(sourceDocument = {}) {
    const dexes = projectionDexes(sourceDocument);
    const items = [];
    const ownedKeys = [];
    dexes.forEach((dex) => {
      dex.cards.forEach((card) => {
        const key = `${dex.id}::${card.key}`;
        items.push({
          key,
          name: card.manual?.name || dex.title,
          groupKey: dex.id,
          groupName: dex.title,
          baselineOwned: false,
        });
        if (card.owned) ownedKeys.push(key);
      });
    });
    const itemMap = new Map(items.map((item) => [item.key, item]));
    return {
      catalog: {
        collectionId: "custom",
        items,
        itemMap,
        groups: dexes.map((dex) => ({
          key: dex.id,
          name: dex.title,
          itemKeys: dex.cards.map((card) => `${dex.id}::${card.key}`),
        })),
      },
      ownedKeys,
      promoOwnedKeys: [],
    };
  }

  registry.supportedCollectionId = function supportedCollectionIdWithCustom(value) {
    return value === "custom" || originalSupportedCollectionId(value);
  };

  registry.ownershipFor = async function ownershipForWithCustom(
    collectionId,
    sourceDocument = {},
  ) {
    if (collectionId === "custom") return customOwnership(sourceDocument);
    return originalOwnershipFor(collectionId, sourceDocument);
  };

  registry.buildProjection = async function buildProjectionWithCustom(
    collectionId,
    sourceDocument,
    publicId,
  ) {
    if (collectionId !== "custom") {
      return originalBuildProjection(collectionId, sourceDocument, publicId);
    }
    if (!/^[a-z0-9]{12}$/.test(clean(publicId))) {
      throw new Error("공개 프로필 식별값이 올바르지 않습니다.");
    }
    const dexes = projectionDexes(sourceDocument || {});
    const ownedKeys = [];
    let totalCount = 0;
    dexes.forEach((dex) => {
      dex.cards.forEach((card) => {
        totalCount += 1;
        if (card.owned) ownedKeys.push(`${dex.id}::${card.key}`);
      });
    });
    return {
      schemaVersion: 1,
      publicId,
      collectionId: "custom",
      ownedKeys,
      ownedCount: ownedKeys.length,
      totalCount,
      promoOwnedKeys: [],
      promoOwnedCount: 0,
      customDexes: dexes,
    };
  };
})();
