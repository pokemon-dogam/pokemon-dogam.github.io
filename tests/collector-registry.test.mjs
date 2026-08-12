import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const source = await readFile(new URL("../collector-collection-registry.js", import.meta.url), "utf8");

function localPath(input) {
  return new URL(String(input).replace(/^\.\//, ""), root);
}

const context = {
  URL,
  Map,
  Set,
  Promise,
  console,
  document: { body: { dataset: {} } },
  location: { href: "https://pokemon-dogam.github.io/", pathname: "/" },
  fetch: async (input) => {
    try {
      const body = await readFile(localPath(input), "utf8");
      return {
        ok: true,
        status: 200,
        text: async () => body,
        json: async () => JSON.parse(body),
      };
    } catch {
      return { ok: false, status: 404 };
    }
  },
};
context.window = {
  POKEMON_DEX_FIREBASE: {
    userDocument: "nationalDex",
  },
  location: context.location,
};
vm.createContext(context);
vm.runInContext(source, context);
const registry = context.window.CollectorCollectionRegistry;

test("all existing catalogs retain their expected item counts", async () => {
  const expected = {
    national: 1025,
    pack: 62,
    artist: 451,
    series: 4105,
    pokemon: 679,
    ar: 498,
    people: 179,
  };
  for (const [collectionId, count] of Object.entries(expected)) {
    const catalog = await registry.loadCatalog(collectionId);
    assert.equal(catalog.items.length, count, collectionId);
    assert.equal(catalog.itemMap.size, count, `${collectionId} unique account keys`);
  }
});

test("existing nonempty top-level catalog group counts stay unchanged", async () => {
  const expected = {
    national: 9,
    pack: 3,
    artist: 29,
    series: 33,
    pokemon: 47,
    ar: 31,
    people: 9,
  };
  for (const [collectionId, count] of Object.entries(expected)) {
    const catalog = await registry.loadCatalog(collectionId);
    assert.equal(catalog.groups.length, count, collectionId);
  }
});

test("series catalog includes complete sv5a and sv8a sets in release order", async () => {
  const groups = JSON.parse(
    await readFile(new URL("../data/series.json", import.meta.url), "utf8"),
  );
  const expectations = [
    {
      code: "sv5a",
      previous: "sv5M",
      next: "sv6",
      count: 96,
      denominator: "066",
      imageCode: "SV5a",
    },
    {
      code: "sv8a",
      previous: "sv8",
      next: "sv9",
      count: 237,
      denominator: "187",
      imageCode: "SV8a",
    },
  ];

  for (const expectation of expectations) {
    const index = groups.findIndex((group) => group.code === expectation.code);
    assert.notEqual(index, -1, expectation.code);
    assert.equal(groups[index - 1]?.code, expectation.previous);
    assert.equal(groups[index + 1]?.code, expectation.next);

    const cards = groups[index].cards;
    assert.equal(cards.length, expectation.count, expectation.code);
    cards.forEach((card, cardIndex) => {
      const number = String(cardIndex + 1).padStart(3, "0");
      assert.equal(
        card.code,
        `${expectation.code}_${number}/${expectation.denominator}`,
      );
      assert.equal(card.order, cardIndex + 1);
      assert.equal(
        card.image,
        `https://cards.image.pokemonkorea.co.kr/data/wmimages/SV/${expectation.imageCode}/${expectation.imageCode}_${number}.png`,
      );
    });
  }
});

test("legacy national projection matches the current baseline without private fields", async () => {
  const projection = await registry.buildProjection(
    "national",
    {
      baseMode: "legacy",
      email: "private@example.com",
      overrides: {
        "1": {
          owned: true,
          note: "private note",
          quantity: 8,
          tradeStatus: "sale",
        },
      },
    },
    "abc123def456",
  );
  assert.equal(projection.totalCount, 1025);
  assert.ok(projection.ownedCount > 0);
  assert.deepEqual(
    Object.keys(projection).sort(),
    [
      "collectionId",
      "ownedCount",
      "ownedKeys",
      "promoOwnedCount",
      "promoOwnedKeys",
      "publicId",
      "schemaVersion",
      "totalCount",
    ].sort(),
  );
  assert.equal(JSON.stringify(projection).includes("private@example.com"), false);
  assert.equal(JSON.stringify(projection).includes("private note"), false);
  assert.equal(JSON.stringify(projection).includes("tradeStatus"), false);
  assert.equal(JSON.stringify(projection).includes("quantity"), false);
});

test("pack projection keeps every official promo item and excludes custom promo details", async () => {
  const promoPayload = JSON.parse(
    await readFile(new URL("../data/promo-packs.json", import.meta.url), "utf8"),
  );
  const promos = Array.isArray(promoPayload)
    ? promoPayload
    : [
        ...(promoPayload.packs || []),
        ...(promoPayload.cards || []),
      ];
  const projection = await registry.buildProjection(
    "pack",
    {
      baseMode: "empty",
      ownedPromoPackIds: promos.map((item) => item.id),
      customPromoPacks: [
        { id: "private-custom", note: "private", imageUrl: "private" },
      ],
    },
    "abc123def456",
  );
  assert.equal(promos.length, 222);
  assert.equal(projection.promoOwnedCount, 222);
  assert.equal(projection.promoOwnedKeys.includes("promo-card-s-p-008"), true);
  assert.equal(projection.promoOwnedKeys.includes("private-custom"), false);
  assert.equal(JSON.stringify(projection).includes("private"), false);
});

test("the same physical card remains independent across catalogs", async () => {
  const nationalCatalog = await registry.loadCatalog("national");
  const artistCatalog = await registry.loadCatalog("artist");
  const nationalKey = nationalCatalog.items[0].key;
  const artistKey = artistCatalog.items[0].key;
  const national = await registry.ownershipFor("national", {
    baseMode: "empty",
    overrides: { [nationalKey]: { owned: true } },
  });
  const artist = await registry.ownershipFor("artist", {
    baseMode: "empty",
    overrides: { [artistKey]: { owned: false } },
  });
  assert.equal(national.ownedKeys.includes(nationalKey), true);
  assert.equal(artist.ownedKeys.includes(artistKey), false);
});

test("people ownership stays inside nationalDex peopleOwned", async () => {
  const catalog = await registry.loadCatalog("people");
  const personId = catalog.items[0].key;
  const owned = await registry.ownershipFor("people", {
    overrides: { [personId]: { owned: true } },
    peopleOwned: { [personId]: true },
  });
  assert.deepEqual([...owned.ownedKeys], [personId]);
});

test("dashboard defaults preserve the old six-category summary", () => {
  for (const collectionId of registry.COLLECTION_ORDER) {
    const setting = registry.defaultSetting(collectionId);
    assert.equal(
      setting.dashboardVisible,
      collectionId !== "people",
      collectionId,
    );
    assert.equal(setting.visibility, "private");
  }
});
