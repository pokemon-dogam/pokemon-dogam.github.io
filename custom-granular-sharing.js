"use strict";

(function () {
  const registry = window.CollectorCollectionRegistry;
  if (!registry?.supportedCollectionId?.("custom")) return;

  const originalBuildProjection = registry.buildProjection.bind(registry);

  function clean(value) {
    return String(value || "").trim();
  }

  function visibilityMap(sourceDocument = {}) {
    const draft = window.CustomDexVisibilityDraft;
    const source = draft && typeof draft === "object" && !Array.isArray(draft)
      ? draft
      : sourceDocument.customDexVisibility;
    if (!source || typeof source !== "object" || Array.isArray(source)) return {};
    const result = {};
    Object.entries(source).forEach(([id, value]) => {
      const key = clean(id).slice(0, 120);
      if (key) result[key] = value === true || value === "public";
    });
    return result;
  }

  function publicDexIds(sourceDocument = {}) {
    const map = visibilityMap(sourceDocument);
    return new Set(Object.keys(map).filter((id) => map[id]));
  }

  registry.customDexVisibilityMap = visibilityMap;
  registry.customPublicDexIds = publicDexIds;

  registry.buildProjection = async function buildProjectionWithGranularCustom(
    collectionId,
    sourceDocument,
    publicId,
  ) {
    const projection = await originalBuildProjection(
      collectionId,
      sourceDocument,
      publicId,
    );
    if (collectionId !== "custom") return projection;

    const allowed = publicDexIds(sourceDocument || {});
    const dexes = (Array.isArray(projection.customDexes) ? projection.customDexes : [])
      .filter((dex) => allowed.has(clean(dex?.id)));
    const ownedKeys = [];
    let totalCount = 0;
    dexes.forEach((dex) => {
      (Array.isArray(dex.cards) ? dex.cards : []).forEach((card) => {
        totalCount += 1;
        if (card?.owned) ownedKeys.push(`${dex.id}::${card.key}`);
      });
    });

    return {
      ...projection,
      customDexes: dexes,
      ownedKeys,
      ownedCount: ownedKeys.length,
      totalCount,
    };
  };
})();
