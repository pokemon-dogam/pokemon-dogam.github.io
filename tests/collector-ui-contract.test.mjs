import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const collectionPages = {
  national: ["national.html", "firebase-collection-manager.js"],
  pack: ["packs.html", "packs.js"],
  artist: ["artists.html", "firebase-page-manager.js"],
  series: ["series.html", "firebase-page-manager.js"],
  pokemon: ["pokemon-collections.html", "firebase-page-manager.js"],
  ar: ["ar.html", "firebase-page-manager.js"],
  people: ["people.html", "firebase-people-manager.js"],
};
const sitePages = [
  "index.html",
  "national.html",
  "packs.html",
  "artists.html",
  "series.html",
  "pokemon-collections.html",
  "ar.html",
  "people.html",
  "custom.html",
  "collectors.html",
  "collector.html",
  "collector-settings.html",
  "privacy.html",
  "terms.html",
];

async function source(file) {
  return readFile(new URL(`../${file}`, import.meta.url), "utf8");
}

function publicViewContext(search, hash = "") {
  const addedClasses = new Set();
  const bodyAttributes = new Map();
  const context = {
    URLSearchParams,
    CustomEvent: class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
      }
    },
    console,
    document: {
      documentElement: { classList: { add: (...values) => values.forEach((value) => addedClasses.add(value)) } },
      body: { setAttribute: (name, value) => bodyAttributes.set(name, value) },
      querySelector: () => null,
    },
  };
  context.window = {
    location: { search, hash },
    dispatchEvent: () => {},
    CollectorCollectionRegistry: {
      supportedCollectionId: (value) => Object.hasOwn(collectionPages, value),
    },
  };
  vm.createContext(context);
  return { context, addedClasses, bodyAttributes };
}

function navigationLayoutContext(moduleSource, compact) {
  class FakeElement {
    constructor(tagName = "div") {
      this.tagName = tagName.toUpperCase();
      this.attributes = new Map();
      this.children = [];
      this.className = "";
      this.dataset = {};
      this.listeners = new Map();
      this.textContent = "";
      this.title = "";
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }

    append(...children) {
      this.children.push(...children);
    }

    matches(selector) {
      return selector === "button" && this.tagName === "BUTTON";
    }

    querySelector(selector) {
      const className = selector.startsWith(".") ? selector.slice(1) : "";
      for (const child of this.children) {
        if (className && child.className.split(/\s+/).includes(className)) return child;
        const nested = child.querySelector?.(selector);
        if (nested) return nested;
      }
      return null;
    }

    setAttribute(name, value) {
      this.attributes.set(name, value);
    }

    trigger(type) {
      this.listeners.get(type)?.();
    }
  }

  const mediaListeners = [];
  const media = {
    matches: compact,
    addEventListener: (type, listener) => {
      if (type === "change") mediaListeners.push(listener);
    },
  };
  const stored = new Map();
  const resultsBar = new FakeElement("div");
  const documentElement = new FakeElement("html");
  const context = {
    console,
    Element: FakeElement,
    MutationObserver: class MutationObserver {
      observe() {}
    },
    document: {
      body: Object.assign(new FakeElement("body"), { dataset: {} }),
      createElement: (tagName) => new FakeElement(tagName),
      documentElement,
      querySelector: (selector) => selector.includes(".catalog-panel .results-bar")
        ? resultsBar
        : null,
    },
  };
  context.window = {
    CollectorCollectionRegistry: { collectionIdForPage: () => "national" },
    addEventListener: () => {},
    localStorage: {
      getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value),
    },
    location: { pathname: "/national.html" },
    matchMedia: () => media,
  };
  vm.createContext(context);
  vm.runInContext(moduleSource, context);
  return {
    button: resultsBar.querySelector(".card-layout-toggle"),
    documentElement,
    media,
    mediaListeners,
    stored,
  };
}

test("every page uses the one-line Digital Card Binder brand and tab title", async () => {
  for (const page of sitePages) {
    const html = await source(page);
    assert.match(html, /<title>디지털 카드 바인더<\/title>/, `${page}: browser title`);
    assert.match(
      html,
      /<span class="brand-copy">\s*<strong>디지털 카드 바인더<\/strong>\s*<\/span>/,
      `${page}: one-line brand`,
    );
    assert.equal(html.includes("MY POKÉMON DEX"), false, `${page}: legacy brand`);
    assert.equal(html.includes("COLLECTION ARCHIVE"), false, `${page}: legacy subtitle`);
  }

  const collectorClient = await source("collector.js");
  assert.match(collectorClient, /document[.]title = "디지털 카드 바인더"/);
});

test("every existing collection page loads the public adapter before its manager", async () => {
  for (const [collectionId, [page, manager]] of Object.entries(collectionPages)) {
    const html = await source(page);
    const registryIndex = html.indexOf("collector-collection-registry.js");
    const publicIndex = html.indexOf("collector-public-view.js");
    const syncIndex = html.indexOf("collector-public-sync.js");
    const managerIndex = html.indexOf(manager);
    assert.ok(registryIndex >= 0, `${collectionId}: registry missing`);
    assert.ok(publicIndex > registryIndex, `${collectionId}: public adapter order`);
    assert.ok(syncIndex > publicIndex, `${collectionId}: public sync order`);
    assert.ok(managerIndex > syncIndex, `${collectionId}: manager order`);
    assert.ok(html.includes("collector.css"), `${collectionId}: collector CSS missing`);
  }
});

test("new pages have unique element IDs and mobile/read-only CSS contracts", async () => {
  for (const page of ["collector-settings.html", "collectors.html", "collector.html"]) {
    const html = await source(page);
    const ids = [...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${page}: duplicate id`);
  }
  const settings = await source("collector-settings.html");
  for (const id of [
    "collector-nickname",
    "collector-profile-avatar-fallback",
    "collector-settings-grid",
    "collector-settings-save",
  ]) {
    assert.ok(settings.includes(`id="${id}"`), `${id} missing`);
  }
  const css = await source("collector.css");
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /collector-public-readonly \.collector-private-detail/);
});

test("collector settings restores the existing login before showing its sign-in gate", async () => {
  const settingsPage = await source("collector-settings.html");
  const settingsClient = await source("collector-settings.js");
  const css = await source("collector.css");
  assert.match(
    settingsPage,
    /id="collector-signin-gate"[^>]*hidden/,
    "the sign-in gate must stay hidden until auth restoration finishes",
  );
  assert.match(css, /collector-signin-gate\[hidden\]/);
  assert.match(settingsClient, /auth[.]authStateReady/);
  assert.match(settingsClient, /현재 세션 확인/);
  assert.equal(settingsClient.includes('prompt: "select_account"'), false);
});

test("profile management leaves the sidebar and public collectors stays below dashboard", async () => {
  const navigation = await source("collector-nav.js");
  assert.match(navigation, /settings[?][.]remove\(\)/);
  assert.match(navigation, /dashboard[.]after\(directory\)/);
  assert.equal(navigation.includes('"도감 관리"'), false);
  assert.match(navigation, /공개 컬렉터/);
  for (const [page] of Object.values(collectionPages)) {
    assert.match(await source(page), /collector-nav[.]js\?v=20260812-1/);
  }
  const settingsPage = await source("collector-settings.html");
  assert.match(settingsPage, /collector-nav[.]js\?v=20260812-1/);
  assert.match(settingsPage, /<title>디지털 카드 바인더<\/title>/);
  assert.match(settingsPage, /<h1 id="page-title">내 프로필 관리<\/h1>/);
  for (const page of [settingsPage, await source("collectors.html")]) {
    const navStart = page.indexOf('<nav class="collection-nav">');
    const nav = page.slice(navStart, page.indexOf("</nav>", navStart));
    assert.equal(nav.includes('href="./collector-settings.html"'), false);
    assert.ok(nav.indexOf('href="./collectors.html"') > nav.indexOf('href="./"'));
    assert.ok(nav.indexOf('href="./national.html"') > nav.indexOf('href="./collectors.html"'));
  }
});

test("the signed-in account name opens profile management", async () => {
  const navigation = await source("collector-nav.js");
  const css = await source("collector.css");
  assert.match(navigation, /PROFILE_SETTINGS_HREF = "[.]\/collector-settings[.]html"/);
  assert.match(navigation, /status[.]tagName !== "A"/);
  assert.match(navigation, /panel[.]classList[.]contains\("is-account"\)/);
  assert.match(navigation, /status[.]href = PROFILE_SETTINGS_HREF/);
  assert.match(navigation, /내 프로필 관리 열기/);
  assert.match(css, /#firebase-auth-status[.]firebase-profile-link/);
});

test("desktop uses four or three columns while compact screens use two or four", async () => {
  const navigation = await source("collector-nav.js");
  const commonCss = await source("styles.css");
  const collectorCss = await source("collector.css");
  const packCss = await source("packs.css");

  assert.equal(/@media \(min-width: 1500px\)[\s\S]*?[.]card-grid[\s\S]*?repeat\(5/.test(commonCss), false);
  assert.match(commonCss, /[.]card-grid \{[\s\S]*?repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(packCss, /[.]promo-pack-grid \{[\s\S]*?repeat\(4, minmax\(0, 1fr\)\)/);
  for (const grid of ["card-grid", "pack-grid", "promo-pack-grid"]) {
    assert.match(collectorCss, new RegExp(`data-card-columns="4"[^}]*[.]${grid}`));
    assert.match(collectorCss, new RegExp(`data-card-columns="3"[^}]*[.]${grid}`));
    assert.match(collectorCss, new RegExp(`data-card-columns="2"[^}]*[.]${grid}`));
  }
  assert.match(navigation, /pokemonDexCardColumnsV1/);
  assert.match(navigation, /pokemonDexCompactCardColumnsV1/);
  assert.match(navigation, /COMPACT_CARD_LAYOUT_QUERY = "\(max-width: 920px\)"/);
  assert.match(navigation, /defaultColumns: "2"/);
  assert.match(navigation, /alternateColumns: "4"/);
  assert.match(navigation, /3열 크게 보기/);
  assert.match(navigation, /4열 기본 보기/);
  assert.match(navigation, /4열로 보기/);
  assert.match(navigation, /2열 기본 보기/);
  assert.match(navigation, /compactCardLayoutMedia[.]addEventListener\("change", restoreLayout\)/);
  assert.match(navigation, /localStorage[.]setItem/);
  const compactMediaCss = collectorCss.slice(
    collectorCss.indexOf("@media (max-width: 920px)"),
    collectorCss.indexOf("@media (max-width: 560px)"),
  );
  assert.equal(compactMediaCss.includes("display: none"), false);
  assert.match(
    collectorCss,
    /@media \(max-width: 560px\)[\s\S]*?data-card-columns="4"[\s\S]*?[.]pack-image[\s\S]*?calc\(100% - 8px\)/,
  );
  for (const [page] of Object.values(collectionPages)) {
    const html = await source(page);
    assert.match(html, /collector[.]css\?v=20260811-3/);
    assert.match(html, /collector-nav[.]js\?v=20260812-1/);
  }
});

test("compact and desktop column choices restore independently across viewport changes", async () => {
  const layout = navigationLayoutContext(await source("collector-nav.js"), true);

  assert.equal(layout.documentElement.dataset.cardColumns, "2");
  assert.match(layout.button.textContent, /4열로 보기/);

  layout.button.trigger("click");
  assert.equal(layout.documentElement.dataset.cardColumns, "4");
  assert.equal(layout.stored.get("pokemonDexCompactCardColumnsV1"), "4");
  assert.match(layout.button.textContent, /2열 기본 보기/);

  layout.media.matches = false;
  layout.mediaListeners.forEach((listener) => listener());
  assert.equal(layout.documentElement.dataset.cardColumns, "4");
  assert.match(layout.button.textContent, /3열 크게 보기/);

  layout.button.trigger("click");
  assert.equal(layout.documentElement.dataset.cardColumns, "3");
  assert.equal(layout.stored.get("pokemonDexCardColumnsV1"), "3");

  layout.media.matches = true;
  layout.mediaListeners.forEach((listener) => listener());
  assert.equal(layout.documentElement.dataset.cardColumns, "4");
  assert.match(layout.button.textContent, /2열 기본 보기/);
});

test("public collector board reads only directory and existing public projections", async () => {
  const boardPage = await source("collectors.html");
  const boardClient = await source("collector-directory.js");
  const settingsClient = await source("collector-settings.js");
  assert.match(boardPage, /id="collector-directory-grid"/);
  assert.match(boardPage, /PRIVATE·UNLISTED/);
  assert.match(boardClient, /publicCollectorDirectory/);
  assert.match(boardClient, /publicProfiles/);
  assert.match(boardClient, /"collections"/);
  assert.equal(boardClient.includes('"users"'), false);
  assert.equal(boardClient.includes("ownerUid"), false);
  assert.equal(boardClient.includes("email"), false);
  assert.match(settingsClient, /syncDirectoryInBatch/);
  assert.match(settingsClient, /visibility === "public"/);
});

test("public projection adapters discard private card and people details", async () => {
  const moduleSource = await source("collector-public-view.js");
  const { context } = publicViewContext("?collector=abc123def456");
  vm.runInContext(moduleSource, context);
  const view = context.window.CollectorPublicView;

  const overrides = view.projectionOverrides({
    ownedKeys: ["1"],
    note: "private",
    quantity: 9,
    tradeStatus: "sale",
  });
  assert.deepEqual(JSON.parse(JSON.stringify(overrides)), { "1": { owned: true } });
  assert.deepEqual(
    JSON.parse(JSON.stringify(view.projectionPackDocument({
      ownedKeys: ["sv1S"],
      promoOwnedKeys: ["promo-1"],
      customPromoPacks: [{ note: "private" }],
    }))),
    {
      baseMode: "empty",
      ownedCodes: ["sv1S"],
      ownedPromoPackIds: ["promo-1"],
      customPromoPacks: [],
    },
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(view.projectionPeopleDocument({
      ownedKeys: ["red"],
      peopleOverrides: { red: { imageUrl: "private" } },
    }))),
    {
      baseMode: "empty",
      peopleOwned: { red: true },
      peopleOverrides: {},
    },
  );
});

test("public and unlisted collection loads never request a private users path", async () => {
  const moduleSource = await source("collector-public-view.js");
  const profile = { nickname: "드기", profileCompleted: true };
  const projection = {
    schemaVersion: 1,
    publicId: "abc123def456",
    collectionId: "national",
    ownedKeys: ["1"],
  };

  for (const [search, hash] of [
    ["?collector=abc123def456", ""],
    ["", "#share=AbCdEfGhIjKlMnOpQrStUvWxYz012345"],
  ]) {
    const { context, addedClasses } = publicViewContext(search, hash);
    vm.runInContext(moduleSource, context);
    const reads = [];
    const firestoreModule = {
      doc: (db, ...parts) => ({ path: parts.join("/") }),
      getDoc: async (reference) => {
        reads.push(reference.path);
        if (reference.path === "sharedCollections/AbCdEfGhIjKlMnOpQrStUvWxYz012345") {
          return { exists: () => true, data: () => projection };
        }
        if (reference.path === "publicProfiles/abc123def456") {
          return { exists: () => true, data: () => profile };
        }
        if (reference.path === "publicProfiles/abc123def456/collections/national") {
          return { exists: () => true, data: () => projection };
        }
        return { exists: () => false, data: () => undefined };
      },
    };
    await context.window.CollectorPublicView.loadProjection(
      {},
      firestoreModule,
      "national",
    );
    const route = search || hash;
    assert.equal(reads.some((path) => path.startsWith("users/")), false, route);
    assert.equal(addedClasses.has("collector-public-readonly"), true, route);
  }
});

test("unlisted tokens use URL fragments and are never placed in query strings", async () => {
  const publicClient = await source("collector-public-view.js");
  const settingsClient = await source("collector-settings.js");
  assert.match(publicClient, /window[.]location[.]hash/);
  assert.equal(publicClient.includes('params.get("share")'), false);
  assert.match(settingsClient, /url[.]hash = new URLSearchParams/);
  assert.equal(settingsClient.includes('searchParams.set("share"'), false);
  assert.match(settingsClient, /draft[.]visibility === "unlisted" [^\n]* previousShareId/);
  assert.match(settingsClient, /batch[.]delete\(previousShareOwnerReference\)/);
});

test("the public profile client has no private user-document read route", async () => {
  const client = await source("collector.js");
  assert.equal(client.includes('"users"'), false);
  assert.equal(client.includes("ownerUid"), false);
  assert.equal(client.includes("email"), false);
  assert.match(client, /publicProfiles/);
  assert.match(client, /code === "permission-denied"/);
  assert.match(client, /showError\(publicProfileErrorMessage\(error\)\)/);
  assert.equal(client.includes("showError(error.message"), false);
});

test("the free profile path has no Firebase Storage or image URL dependency", async () => {
  const settingsClient = await source("collector-settings.js");
  const settingsPage = await source("collector-settings.html");
  const publicPage = await source("collector.html");
  const firestoreRules = await source("firestore.rules");
  const firebaseConfig = await source("firebase.json");
  assert.equal(settingsClient.includes("firebase-storage.js"), false);
  assert.equal(settingsClient.includes("avatarUrl"), false);
  assert.equal(settingsPage.includes('type="file"'), false);
  assert.equal(publicPage.includes("collector-public-avatar\""), false);
  assert.equal(firestoreRules.includes("avatarUrl"), false);
  assert.equal(firestoreRules.includes("profileImageUrl"), false);
  assert.equal(JSON.parse(firebaseConfig).storage, undefined);
  assert.match(settingsPage, /닉네임 첫 글자/);
});

test("nickname creation and rename use server-backed Firestore transactions", async () => {
  const settingsClient = await source("collector-settings.js");
  assert.ok(
    [...settingsClient.matchAll(/runTransaction/g)].length >= 2,
    "profile creation and rename must both use transactions",
  );
  assert.match(settingsClient, /transaction[.]get\(nicknameRef\)/);
  assert.match(settingsClient, /transaction[.]get\(nextNicknameRef\)/);
});

test("owner Sheets writes also refresh an enabled public projection", async () => {
  const ownerSync = await source("owner-sheets-sync.js");
  const dashboard = await source("index.html");
  assert.match(ownerSync, /CollectorPublicSync[?][.]syncCollectionWithRetry/);
  assert.ok(
    [...ownerSync.matchAll(/projectionCategories[.]push\(category\)/g)].length >= 2,
    "pack and card-catalog Sheet writes must both refresh projections",
  );
  assert.match(ownerSync, /projectionCategories[.]map/);
  assert.match(ownerSync, /projectionCategories[.]includes\("pack"\)/);
  assert.match(ownerSync, /getIdToken\(user, true\)/);
  assert.match(ownerSync, /권한을 확인하지 못했습니다/);
  assert.ok(
    dashboard.indexOf("collector-public-sync.js") <
      dashboard.indexOf("owner-sheets-sync.js"),
    "dashboard must load projection sync before owner Sheets sync",
  );
});
