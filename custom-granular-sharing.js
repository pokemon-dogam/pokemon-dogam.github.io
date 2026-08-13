"use strict";

(function () {
  const registry = window.CollectorCollectionRegistry;
  if (!registry?.supportedCollectionId?.("custom")) return;

  const originalBuildProjection = registry.buildProjection.bind(registry);

  function clean(value) {
    return String(value || "").trim();
  }

  function configuredVisibilitySource(sourceDocument = {}) {
    const draft = window.CustomDexVisibilityDraft;
    if (draft && typeof draft === "object" && !Array.isArray(draft)) {
      return draft;
    }
    if (Object.prototype.hasOwnProperty.call(sourceDocument, "customDexVisibility")) {
      return sourceDocument.customDexVisibility;
    }
    return null;
  }

  function visibilityMap(sourceDocument = {}) {
    const source = configuredVisibilitySource(sourceDocument);
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

    // 기존에 '나만의 도감 전체'를 PUBLIC으로 쓰던 사용자는 세부 설정을
    // 처음 저장하기 전까지 기존 공개 상태를 그대로 유지합니다.
    if (configuredVisibilitySource(sourceDocument || {}) === null) {
      return projection;
    }

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
