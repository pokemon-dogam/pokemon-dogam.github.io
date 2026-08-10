"use strict";

const SPRITE_COLUMNS = 10;
const SPRITE_ROWS = 7;
const FIREBASE_SDK_VERSION = "10.12.5";
const PROMO_DATA_URL = "./data/promo-packs.json?v=20260810-2";

// 정규 확장팩 목록은 대시보드와 Google Sheets 동기화에서도 이 배열을 읽는다.
// 프로모팩은 data/promo-packs.json에서 별도로 불러온다.
const packs = [
  ["S","소드","s1W",0],["S","실드","s1H",0],["S","VMAX라이징","s1a",0],["S","반역크래시","s2",0],["S","폭염워커","s2a",0],["S","무한존","s3",0],["S","전설의 고동","s3a",0],["S","앙천의 볼트태클","s4",0],["S","샤이니스타V","s4a",0],["S","일격마스터","s5I",0],["S","연격마스터","s5R",0],["S","쌍벽의 파이터","s5a",0],["S","백은의 랜스","s6H",0],["S","칠흑의 가이스트","s6K",0],["S","이브이 히어로즈","s6a",0],["S","마천퍼펙트","s7D",0],["S","창공스트림","s7R",0],["S","퓨전아츠","s8",0],["S","25th","s8a",0],["S","VMAX 클라이맥스","s8b",0],["S","스타버스","s9",0],["S","배틀리전","s9a",0],["S","스페이스저글러","s10P",0],["S","타임게이저","s10D",0],["S","다크판타스마","s10a",0],["S","Pokémon GO","s10b",0],["S","로스트어비스","s11",0],["S","백열의 아르카나","s11a",0],["S","패러다임트리거","s12",0],["S","VSTAR유니버스","s12a",0],
  ["SV","스칼렛ex","sv1S",1],["SV","바이올렛ex","sv1V",0],["SV","트리플렛비트","sv1a",1],["SV","클레이버스트","sv2D",0],["SV","스노해저드","sv2P",0],["SV","포켓몬카드 151","sv2a",0],["SV","흑염의 지배자","sv3",1],["SV","레이징서프","sv3a",1],["SV","고대의 포효","sv4K",0],["SV","미래의 일섬","sv4M",0],["SV","샤이니트레저ex","sv4a",0],["SV","와일드포스","sv5K",1],["SV","사이버저지","sv5M",0],["SV","크림슨헤이즈","sv5a",1],["SV","변환의 가면","sv6",0],["SV","나이트원더러","sv6a",1],["SV","스텔라미라클","sv7",0],["SV","낙원드래고나","sv7a",1],["SV","초전브레이커","sv8",1],["SV","테라스탈페스ex","sv8a",0],["SV","배틀파트너즈","sv9",1],["SV","열풍의 아레나","sv9a",0],["SV","로켓단의 영광","sv10",1],["SV","블랙볼트","sv11B",0],["SV","화이트플레어","sv11W",0],
  ["M","메가심포니아","m1S",0],["M","메가브레이브","m1L",0],["M","인페르노X","m2",1],["M","MEGA드림ex","m2a",0],["M","니힐제로","m3",0],["M","닌자스피너","m4",1],["M","어비스아이","m5",1]
].map(([era, name, code, owned], index) => ({
  era,
  name,
  code,
  displayCode: code,
  legacyOwned: Boolean(owned),
  owned: false,
  i: index
}));

const palettes = {
  S: ["#3759b6", "#8a5bd4"],
  SV: ["#d94c60", "#6366c7"],
  M: ["#24314f", "#19a690"]
};

const promoPalettes = {
  S: [
    ["#cf9b35", "#8c6422"], ["#4f88c7", "#264f87"],
    ["#45a573", "#246647"], ["#7554a0", "#453263"],
    ["#d2555c", "#8d3036"], ["#39a7a9", "#246c76"],
    ["#e08243", "#9e4728"], ["#ba6ca4", "#74446d"],
    ["#4566a9", "#293d73"], ["#719d4c", "#405f2f"],
    ["#b8b9bd", "#6f737b"], ["#5b5194", "#322e62"]
  ],
  SV: [
    ["#80604f", "#4d382f"], ["#4d8bcb", "#285789"],
    ["#41a873", "#246746"], ["#755546", "#44322c"],
    ["#df4c52", "#942f36"], ["#d3b33a", "#8f7723"],
    ["#df6a9c", "#914366"], ["#2faeb7", "#20727b"],
    ["#7e62c4", "#4d3d81"]
  ],
  M: [
    ["#278fc4", "#1c5b91"], ["#d25555", "#8f3038"],
    ["#42a36e", "#286445"], ["#805ec0", "#4d3980"]
  ],
  OTHER: [
    ["#58647d", "#29344c"], ["#8a5a88", "#4f365b"],
    ["#278c89", "#195b60"], ["#a26d32", "#65431f"]
  ]
};

const packGroups = [
  ["S", "S 시리즈"],
  ["SV", "SV 시리즈"],
  ["M", "M 시리즈"]
];

const promoEraLabels = {
  S: "S",
  SV: "SV",
  M: "M",
  OTHER: "기타"
};

const defaultPromoTypeLabels = {
  regular: "정규 프로모팩",
  campaign: "캠페인",
  purchase: "구매 특전",
  event: "이벤트",
  bundle: "상품 동봉",
  gift: "기프트 캠페인",
  other: "기타"
};

const allowedPromoEras = new Set(Object.keys(promoEraLabels));
const allowedPromoTypes = new Set(Object.keys(defaultPromoTypeLabels));
const legacyPromoIdPattern = /^promo-(?:s|sv|m)-\d{2}$/i;

let era = "all";
let status = "all";
let query = "";
let promoQuery = "";
let promoEra = "all";
let promoType = "all";
let promoMaster = [];
let promoTypeLabels = { ...defaultPromoTypeLabels };
let customPromoPacks = [];
let ownedPromoPackIds = new Set();
let preservedLegacyPromoCodes = new Set();
let packFirebase = null;
let packUser = null;
let packUserDocumentRef = null;
let packBaseMode = "empty";
let packSharedViewActive = false;
let packSaveQueue = Promise.resolve();
let activePack = null;

const $ = (id) => document.getElementById(id);
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);

function safeText(value, maxLength = 300) {
  return String(value || "").normalize("NFKC").trim().slice(0, maxLength);
}

function normalizeSearch(value) {
  return safeText(value, 500).toLocaleLowerCase("ko");
}

function validHttpUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(String(value));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function sanitizePromoPack(value, custom = false) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = safeText(value.id, 100).toLowerCase();
  const name = safeText(value.name, 100);
  const eraValue = safeText(value.era, 10).toUpperCase();
  const typeValue = safeText(value.type, 20).toLowerCase();
  const yearValue = Number(value.year);
  const year = Number.isInteger(yearValue) && yearValue >= 1996 && yearValue <= 2100
    ? yearValue
    : null;

  if (!/^[a-z0-9-]{3,100}$/.test(id) || !name) return null;

  return {
    id,
    name,
    era: allowedPromoEras.has(eraValue) ? eraValue : "OTHER",
    year,
    type: allowedPromoTypes.has(typeValue) ? typeValue : "other",
    volume: Math.max(0, Math.min(99, Number(value.volume) || 0)),
    image: validHttpUrl(value.image),
    description: safeText(value.description, 300),
    note: safeText(value.note, 500),
    keywords: Array.isArray(value.keywords)
      ? value.keywords.slice(0, 20).map((item) => safeText(item, 50)).filter(Boolean)
      : [],
    source: validHttpUrl(value.source),
    custom: Boolean(custom),
    createdAt: custom ? safeText(value.createdAt, 40) : ""
  };
}

function sanitizeCustomPromoPacks(source) {
  if (!Array.isArray(source)) return [];
  const unique = new Map();
  source.slice(0, 200).forEach((item) => {
    const pack = sanitizePromoPack(item, true);
    if (pack && !unique.has(pack.id)) unique.set(pack.id, pack);
  });
  return [...unique.values()];
}

function sanitizePromoIds(source) {
  if (!Array.isArray(source)) return new Set();
  return new Set(
    source
      .map((value) => safeText(value, 100).toLowerCase())
      .filter((value) => /^[a-z0-9-]{3,100}$/.test(value))
  );
}

function getLegacyOwnedCodes() {
  return packs.filter((pack) => pack.legacyOwned).map((pack) => pack.code);
}

function allPromoPacks() {
  const masterIds = new Set(promoMaster.map((pack) => pack.id));
  return [
    ...promoMaster,
    ...customPromoPacks.filter((pack) => !masterIds.has(pack.id))
  ];
}

function applyOwnedCodes(ownedCodes, shouldRender = true) {
  const ownedSet = new Set(
    Array.isArray(ownedCodes)
      ? ownedCodes.map((code) => safeText(code, 100).toLowerCase())
      : []
  );
  packs.forEach((pack) => {
    pack.owned = ownedSet.has(pack.code.toLowerCase());
  });
  if (shouldRender) {
    drawSummary();
    render();
  }
}

function applyPackDocument(data = {}, fallbackOwnedCodes = []) {
  const ownedCodes = Array.isArray(data.ownedCodes)
    ? data.ownedCodes
    : fallbackOwnedCodes;
  const explicitPromoIds = sanitizePromoIds(data.ownedPromoPackIds);
  const legacyIds = sanitizePromoIds(ownedCodes).values();

  preservedLegacyPromoCodes = new Set(
    [...legacyIds, ...explicitPromoIds].filter((id) => legacyPromoIdPattern.test(id))
  );
  ownedPromoPackIds = new Set([...explicitPromoIds, ...preservedLegacyPromoCodes]);
  customPromoPacks = sanitizeCustomPromoPacks(data.customPromoPacks);
  applyOwnedCodes(ownedCodes, false);
  drawSummary();
  render();
  renderPromo();
}

async function loadPromoMaster() {
  const response = await fetch(PROMO_DATA_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`프로모팩 DB HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.packs)) throw new Error("프로모팩 DB 형식이 올바르지 않습니다.");

  const unique = new Map();
  data.packs.forEach((item) => {
    const pack = sanitizePromoPack(item, false);
    if (!pack || unique.has(pack.id)) {
      throw new Error(`프로모팩 DB 항목을 확인해 주세요: ${item?.id || "unknown"}`);
    }
    unique.set(pack.id, pack);
  });

  promoMaster = [...unique.values()];
  if (data.types && typeof data.types === "object" && !Array.isArray(data.types)) {
    for (const type of allowedPromoTypes) {
      const label = safeText(data.types[type], 30);
      if (label) promoTypeLabels[type] = label;
    }
  }
  $("promo-master-count").textContent = promoMaster.length;
  renderPromo();
}

function ensurePackAuthControls() {
  if ($("firebase-auth-panel")) return;
  const header = document.querySelector(".site-header");
  if (!header) return;
  const controls = document.createElement("div");
  controls.id = "firebase-auth-panel";
  controls.className = "firebase-auth-panel";
  controls.innerHTML = `
    <span class="firebase-auth-dot" aria-hidden="true"></span>
    <span id="firebase-auth-status">로그인 상태 확인 중</span>
    <button id="firebase-login" type="button">Google 로그인</button>
    <button id="firebase-logout" type="button" hidden>로그아웃</button>
  `;
  header.append(controls);
  $("firebase-login")?.addEventListener("click", signInPackUser);
  $("firebase-logout")?.addEventListener("click", signOutPackUser);
}

function updatePackAuthControls(user, message = "") {
  ensurePackAuthControls();
  const panel = $("firebase-auth-panel");
  const label = $("firebase-auth-status");
  const login = $("firebase-login");
  const logout = $("firebase-logout");
  if (!panel || !label || !login || !logout) return;

  const headerChip = document.querySelector(".header-chip");
  const shared = window.PokemonDexSharedReadonly;
  packSharedViewActive = Boolean(shared?.updateControl?.(user));
  if (headerChip) {
    headerChip.textContent = packSharedViewActive
      ? "READ ONLY"
      : user
        ? "SIGNED IN"
        : "PUBLIC VIEW";
  }

  const ownerEmail = safeText(window.POKEMON_DEX_FIREBASE?.ownerEmail, 200).toLowerCase();
  const userEmail = safeText(user?.email, 200).toLowerCase();
  panel.classList.toggle("is-account", Boolean(user));
  panel.classList.toggle("is-owner", Boolean(user && userEmail === ownerEmail));

  if (user) {
    const account = user.displayName || user.email || "로그인 사용자";
    const modeText = userEmail === ownerEmail ? "기존 도감 유지" : "0장부터 시작";
    label.textContent = packSharedViewActive
      ? `${shared.buttonLabel()} · 읽기 전용`
      : message
        ? `${account} · ${message}`
        : `${account} · ${modeText}`;
    login.hidden = true;
    logout.hidden = false;
  } else {
    label.textContent = message || "방문자";
    login.hidden = false;
    logout.hidden = true;
  }

  login.disabled = false;
  login.textContent = "Google 로그인";
  logout.disabled = false;
  logout.textContent = "로그아웃";
}

async function applyPackUserState(user) {
  packUser = user;
  packUserDocumentRef = null;
  packBaseMode = "empty";
  packSharedViewActive = false;

  if (!user) {
    applyPackDocument({}, []);
    updatePackAuthControls(null);
    return;
  }

  const email = safeText(user.email, 200).toLowerCase();
  const ownerEmail = safeText(window.POKEMON_DEX_FIREBASE?.ownerEmail, 200).toLowerCase();
  const baseMode = email === ownerEmail ? "legacy" : "empty";
  const defaultOwnedCodes = baseMode === "legacy" ? getLegacyOwnedCodes() : [];
  packBaseMode = baseMode;

  const { db, firestoreModule } = packFirebase;
  const shared = window.PokemonDexSharedReadonly;
  await shared?.ensureOwnerShare?.(db, firestoreModule, user);
  packSharedViewActive = Boolean(shared?.isActive?.(user));

  if (packSharedViewActive) {
    packBaseMode = "legacy";
    try {
      const ownerDocument = await shared.loadOwnerDocument(db, firestoreModule, "packDex");
      if (!ownerDocument) throw new Error("packDex 공유 문서를 찾지 못했습니다.");
      applyPackDocument(ownerDocument.data || {}, getLegacyOwnedCodes());
    } catch (error) {
      console.warn("팩도감 읽기 전용 공유 데이터를 불러오지 못했습니다.", error);
      applyPackDocument({}, getLegacyOwnedCodes());
    }
    updatePackAuthControls(user);
    return;
  }

  packUserDocumentRef = firestoreModule.doc(
    db,
    "users",
    user.uid,
    "collections",
    "packDex"
  );

  try {
    const snapshot = await firestoreModule.getDoc(packUserDocumentRef);
    if (!snapshot.exists()) {
      const initialData = {
        baseMode,
        email: user.email || "",
        displayName: user.displayName || "",
        ownedCodes: defaultOwnedCodes,
        ownedPromoPackIds: [],
        customPromoPacks: [],
        updatedAt: firestoreModule.serverTimestamp()
      };
      await firestoreModule.setDoc(packUserDocumentRef, initialData);
      applyPackDocument(initialData, defaultOwnedCodes);
    } else {
      applyPackDocument(snapshot.data() || {}, defaultOwnedCodes);
    }
    updatePackAuthControls(user);
  } catch (error) {
    console.warn("팩도감 정보를 불러오지 못했습니다.", error);
    applyPackDocument({}, defaultOwnedCodes);
    updatePackAuthControls(user, "저장 데이터 불러오기 실패");
  }
}

async function initializePackFirebase() {
  ensurePackAuthControls();
  const firebaseConfig = window.POKEMON_DEX_FIREBASE;
  if (!firebaseConfig?.enabled || !firebaseConfig.config) {
    applyPackDocument({}, []);
    updatePackAuthControls(null, "Firebase 설정 없음 · 전체 미보유");
    return;
  }

  try {
    const [appModule, authModule, firestoreModule] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`)
    ]);
    const app = appModule.getApps().length
      ? appModule.getApp()
      : appModule.initializeApp(firebaseConfig.config);
    const auth = authModule.getAuth(app);
    const db = firestoreModule.getFirestore(app);
    try {
      await authModule.setPersistence(auth, authModule.browserLocalPersistence);
    } catch (error) {
      console.warn("로그인 유지 설정에 실패했습니다.", error);
    }
    packFirebase = { auth, db, authModule, firestoreModule };
    authModule.onAuthStateChanged(
      auth,
      (user) => void applyPackUserState(user),
      (error) => {
        console.warn("팩도감 로그인 확인 실패", error);
        applyPackDocument({}, []);
        updatePackAuthControls(null, "로그인 확인 실패 · 전체 미보유");
      }
    );
  } catch (error) {
    console.warn("팩도감 Firebase 초기화 실패", error);
    applyPackDocument({}, []);
    updatePackAuthControls(null, "연결 실패 · 전체 미보유");
  }
}

async function signInPackUser() {
  if (!packFirebase) {
    alert("로그인 기능을 불러오지 못했습니다.");
    return;
  }
  const button = $("firebase-login");
  if (button) {
    button.disabled = true;
    button.textContent = "로그인 중…";
  }
  const provider = new packFirebase.authModule.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await packFirebase.authModule.signInWithPopup(packFirebase.auth, provider);
  } catch (error) {
    console.error("팩도감 Google 로그인 오류", error);
    if (error.code !== "auth/popup-closed-by-user") {
      const message = error.code === "auth/popup-blocked"
        ? "로그인 팝업이 차단되었습니다.\nChrome 또는 Safari에서 사이트를 직접 열고 다시 시도하세요."
        : error.code === "auth/unauthorized-domain"
          ? "Firebase 승인 도메인에 pokemon-dogam.github.io가 등록되지 않았습니다."
          : `Google 로그인에 실패했습니다.${error.message ? `\n${error.message}` : ""}`;
      alert(message);
    }
    updatePackAuthControls(packUser);
  }
}

async function signOutPackUser() {
  if (!packFirebase) return;
  const button = $("firebase-logout");
  if (button) {
    button.disabled = true;
    button.textContent = "로그아웃 중…";
  }
  try {
    window.PokemonDexSharedReadonly?.clear?.();
    await packFirebase.authModule.signOut(packFirebase.auth);
  } catch (error) {
    console.error("팩도감 로그아웃 오류", error);
    alert("로그아웃에 실패했습니다.");
    updatePackAuthControls(packUser);
  }
}

function canEditPackCollection() {
  return Boolean(
    packUser && packFirebase && packUserDocumentRef && !packSharedViewActive
  );
}

function identityFields() {
  return {
    baseMode: packBaseMode,
    email: packUser?.email || "",
    displayName: packUser?.displayName || ""
  };
}

function enqueuePackWrite(operation) {
  const queued = packSaveQueue.then(operation, operation);
  packSaveQueue = queued.catch(() => undefined);
  return queued;
}

async function writePackDocument(fields) {
  await packFirebase.firestoreModule.setDoc(
    packUserDocumentRef,
    {
      ...identityFields(),
      ...fields,
      updatedAt: packFirebase.firestoreModule.serverTimestamp()
    },
    { merge: true }
  );
}

function currentOwnedCodes(regularOverride = null, legacyOverride = null) {
  const regular = regularOverride || new Set(
    packs.filter((pack) => pack.owned).map((pack) => pack.code)
  );
  const legacy = legacyOverride || preservedLegacyPromoCodes;
  return [
    ...packs.filter((pack) => regular.has(pack.code)).map((pack) => pack.code),
    ...legacy
  ];
}

function dispatchPackChange(key) {
  window.dispatchEvent(new CustomEvent("pokemon-dex:collection-changed", {
    detail: { category: "pack", key }
  }));
}

function updatePackCompletionButton(button, pack) {
  const owned = Boolean(pack.owned);
  button.classList.toggle("is-complete", owned);
  button.classList.remove("is-saving");
  button.disabled = false;
  button.setAttribute("aria-pressed", String(owned));
  button.setAttribute(
    "aria-label",
    owned ? `${pack.name} 팩 수집완료 취소` : `${pack.name} 팩 수집완료로 표시`
  );
  button.title = owned
    ? "다시 누르면 미수집으로 변경됩니다."
    : "로그인한 내 도감에 수집완료로 저장합니다.";
  button.textContent = owned ? "✓ 수집완료" : "수집완료";
}

async function persistPackOwned(pack, owned) {
  if (!canEditPackCollection()) {
    throw new Error("Google 로그인 후 내 팩 수집 상태를 저장할 수 있습니다.");
  }
  return enqueuePackWrite(async () => {
    const nextRegular = new Set(
      packs.filter((item) => item.owned).map((item) => item.code)
    );
    if (owned) nextRegular.add(pack.code);
    else nextRegular.delete(pack.code);
    await writePackDocument({ ownedCodes: currentOwnedCodes(nextRegular) });
    pack.owned = owned;
    dispatchPackChange(pack.code);
    return pack;
  });
}

async function togglePackCompletion(pack, button) {
  if (!canEditPackCollection()) {
    alert("Google 로그인 후 내 팩 수집 상태를 저장할 수 있습니다.");
    return;
  }
  button.disabled = true;
  button.classList.add("is-saving");
  button.textContent = "저장 중…";
  try {
    await persistPackOwned(pack, !pack.owned);
    drawSummary();
    if (activePack === pack) updatePackDialog(pack);
    render();
  } catch (error) {
    console.error(error);
    alert(error.message || "팩 수집 상태를 저장하지 못했습니다.");
    updatePackCompletionButton(button, pack);
  }
}

function makePackCompletionButton(pack) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "collection-complete-button";
  updatePackCompletionButton(button, pack);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void togglePackCompletion(pack, button);
  });
  return button;
}

function drawSummary() {
  const owned = packs.filter((pack) => pack.owned).length;
  const total = packs.length;
  const rate = pct(owned, total);
  $("pack-owned").textContent = owned;
  $("pack-total").textContent = total;
  $("pack-missing").textContent = total - owned;
  $("pack-rate").textContent = `${rate}%`;
  $("stat-pack-owned").textContent = owned;
  $("stat-pack-missing").textContent = total - owned;
  $("stat-pack-rate").textContent = rate;
  $("pack-progress-ring").style.setProperty("--progress", rate);
}

function spritePosition(index) {
  const col = index % SPRITE_COLUMNS;
  const row = Math.floor(index / SPRITE_COLUMNS);
  return {
    x: SPRITE_COLUMNS === 1 ? 0 : (col / (SPRITE_COLUMNS - 1)) * 100,
    y: SPRITE_ROWS === 1 ? 0 : (row / (SPRITE_ROWS - 1)) * 100
  };
}

function configurePackImage(image, pack) {
  const colors = palettes[pack.era];
  const pos = spritePosition(pack.i);
  image.style.setProperty("--pack-a", colors[0]);
  image.style.setProperty("--pack-b", colors[1]);
  image.style.setProperty("--sprite-x", `${pos.x}%`);
  image.style.setProperty("--sprite-y", `${pos.y}%`);
  image.setAttribute("aria-label", `${pack.name} 팩 이미지`);
}

function updatePackDialog(pack) {
  configurePackImage($("pack-dialog-image"), pack);
  $("pack-dialog-image-wrap").classList.toggle("is-missing", !pack.owned);
  $("pack-dialog-code").textContent = pack.displayCode;
  $("pack-dialog-status").textContent = pack.owned ? "수집완료" : "미수집";
  $("pack-dialog-status").className = `status-badge ${
    pack.owned ? "is-owned" : "is-missing"
  }`;
  $("pack-dialog-name").textContent = pack.name;
  $("pack-dialog-era").textContent = `${pack.era} 시리즈`;
  $("pack-dialog-category").textContent = "BOOSTER PACK COLLECTION";
  $("pack-dialog-ownership").textContent = pack.owned ? "보유 중" : "아직 미수집";
}

function openPackDialog(pack) {
  const dialog = $("pack-dialog");
  activePack = pack;
  updatePackDialog(pack);
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closePackDialog() {
  const dialog = $("pack-dialog");
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

function createCard(pack) {
  const element = document.createElement("article");
  element.className = `pack-card has-completion-action${pack.owned ? "" : " is-missing"}`;
  element.dataset.packCode = pack.code;
  const colors = palettes[pack.era];
  element.style.setProperty("--pack-a", colors[0]);
  element.style.setProperty("--pack-b", colors[1]);

  const detailButton = document.createElement("button");
  detailButton.type = "button";
  detailButton.className = "pack-card-detail";
  detailButton.setAttribute("aria-label", `${pack.name} 상세 보기`);

  const art = document.createElement("div");
  art.className = "pack-art";
  const image = document.createElement("span");
  image.className = "pack-image";
  image.setAttribute("role", "img");
  configurePackImage(image, pack);
  art.append(image);

  const body = document.createElement("div");
  body.className = "pack-card-body";
  const top = document.createElement("div");
  top.className = "pack-card-top";
  const code = document.createElement("span");
  code.className = "pack-code";
  code.textContent = pack.displayCode;
  const state = document.createElement("span");
  state.className = "pack-status";
  state.textContent = pack.owned ? "수집완료" : "미수집";
  top.append(code, state);
  const name = document.createElement("strong");
  name.className = "pack-name";
  name.textContent = pack.name;
  body.append(top, name);
  detailButton.append(art, body);
  detailButton.addEventListener("click", () => openPackDialog(pack));
  element.append(detailButton, makePackCompletionButton(pack));
  return element;
}

function render() {
  const normalizedQuery = normalizeSearch(query);
  const shown = packs.filter((pack) => {
    const eraMatches = era === "all" || pack.era === era;
    const statusMatches = status === "all" || (status === "owned") === pack.owned;
    const queryMatches = !normalizedQuery || normalizeSearch(
      `${pack.name} ${pack.code} ${pack.displayCode} 확장팩`
    ).includes(normalizedQuery);
    return eraMatches && statusMatches && queryMatches;
  });

  const host = $("pack-groups");
  host.replaceChildren();
  packGroups.forEach(([key, label]) => {
    const items = shown.filter((pack) => pack.era === key);
    if (!items.length) return;
    const section = document.createElement("section");
    section.className = "pack-series";
    const heading = document.createElement("div");
    heading.className = "pack-series-heading";
    const title = document.createElement("h3");
    title.textContent = label;
    const summary = document.createElement("p");
    summary.textContent = `${items.filter((pack) => pack.owned).length} / ${items.length}팩 수집완료`;
    heading.append(title, summary);
    const grid = document.createElement("div");
    grid.className = "pack-grid";
    items.forEach((pack) => grid.append(createCard(pack)));
    section.append(heading, grid);
    host.append(section);
  });
  $("pack-result-count").textContent = shown.length;
  $("pack-empty").hidden = shown.length !== 0;
}

function promoPaletteFor(pack) {
  const palettesForEra = promoPalettes[pack.era] || promoPalettes.OTHER;
  if (pack.volume > 0) return palettesForEra[(pack.volume - 1) % palettesForEra.length];
  const hash = [...pack.id].reduce((total, char) => total + char.charCodeAt(0), 0);
  return palettesForEra[hash % palettesForEra.length];
}

function createPromoFallback(pack) {
  const artwork = document.createElement("span");
  artwork.className = "promo-artwork";
  artwork.setAttribute("role", "img");
  artwork.setAttribute("aria-label", `${pack.name} 기본 프로모팩 이미지`);
  const colors = promoPaletteFor(pack);
  artwork.style.setProperty("--pack-a", colors[0]);
  artwork.style.setProperty("--pack-b", colors[1]);

  const hole = document.createElement("span");
  hole.className = "promo-pack-hole";
  hole.setAttribute("aria-hidden", "true");
  const brand = document.createElement("span");
  brand.className = "promo-pack-brand";
  brand.textContent = "POKÉMON CARD GAME";
  const series = document.createElement("strong");
  series.className = "promo-pack-series";
  series.textContent = `${promoEraLabels[pack.era]} PROMO`;
  const title = document.createElement("span");
  title.className = "promo-pack-title";
  title.textContent = "프로모 카드 팩";
  const volume = document.createElement("b");
  volume.className = "promo-pack-volume";
  volume.textContent = pack.volume > 0
    ? `제 ${pack.volume} 탄`
    : promoTypeLabels[pack.type] || "프로모";
  const notForSale = document.createElement("small");
  notForSale.className = "promo-pack-not-for-sale";
  notForSale.textContent = "PROMO · NOT FOR SALE";
  artwork.append(hole, brand, series, title, volume, notForSale);
  return artwork;
}

function createPromoVisual(pack) {
  const visual = document.createElement("div");
  visual.className = "promo-card-art";
  const badge = document.createElement("span");
  badge.className = "promo-badge";
  badge.textContent = "PROMO";
  if (pack.image) {
    const image = document.createElement("img");
    image.className = "promo-pack-photo";
    image.src = pack.image;
    image.alt = `${pack.name} 이미지`;
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => image.replaceWith(createPromoFallback(pack)), {
      once: true
    });
    visual.append(image);
  } else {
    visual.append(createPromoFallback(pack));
  }
  visual.append(badge);
  return visual;
}

function updatePromoAction(button, pack) {
  const owned = ownedPromoPackIds.has(pack.id);
  button.classList.toggle("is-owned", owned);
  button.classList.remove("is-saving");
  button.disabled = false;
  button.setAttribute("aria-pressed", String(owned));
  button.textContent = owned ? "컬렉션에서 제거" : "내 컬렉션에 등록";
  button.setAttribute(
    "aria-label",
    owned ? `${pack.name} 컬렉션에서 제거` : `${pack.name} 내 컬렉션에 등록`
  );
}

async function togglePromoPack(pack, button) {
  if (!canEditPackCollection()) {
    alert("Google 로그인 후 내 프로모팩 컬렉션을 변경할 수 있습니다.");
    return;
  }
  button.disabled = true;
  button.classList.add("is-saving");
  button.textContent = "저장 중…";
  try {
    await enqueuePackWrite(async () => {
      const nextOwned = new Set(ownedPromoPackIds);
      const nextLegacy = new Set(preservedLegacyPromoCodes);
      const nextValue = !nextOwned.has(pack.id);
      if (nextValue) nextOwned.add(pack.id);
      else nextOwned.delete(pack.id);
      if (legacyPromoIdPattern.test(pack.id)) {
        if (nextValue) nextLegacy.add(pack.id);
        else nextLegacy.delete(pack.id);
      }
      await writePackDocument({
        ownedCodes: currentOwnedCodes(null, nextLegacy),
        ownedPromoPackIds: [...nextOwned],
        customPromoPacks
      });
      ownedPromoPackIds = nextOwned;
      preservedLegacyPromoCodes = nextLegacy;
      dispatchPackChange(`promo:${pack.id}`);
    });
    renderPromo();
  } catch (error) {
    console.error(error);
    alert(error.message || "프로모팩 컬렉션을 저장하지 못했습니다.");
    updatePromoAction(button, pack);
  }
}

function createPromoCard(pack, collectionView = false) {
  const owned = ownedPromoPackIds.has(pack.id);
  const article = document.createElement("article");
  article.className = `promo-collection-card${owned ? " is-owned" : ""}${
    collectionView ? " is-collection-view" : ""
  }`;
  article.dataset.promoId = pack.id;
  article.append(createPromoVisual(pack));

  const body = document.createElement("div");
  body.className = "promo-card-body";
  const top = document.createElement("div");
  top.className = "promo-card-top";
  const meta = document.createElement("span");
  meta.className = "promo-card-meta";
  meta.textContent = `${promoEraLabels[pack.era]} · ${pack.year || "연도 미확인"}`;
  top.append(meta);
  if (pack.custom) {
    const custom = document.createElement("span");
    custom.className = "promo-custom-badge";
    custom.textContent = "직접 등록";
    top.append(custom);
  } else if (owned) {
    const ownedBadge = document.createElement("span");
    ownedBadge.className = "status-badge is-owned";
    ownedBadge.textContent = "보유중";
    top.append(ownedBadge);
  }

  const name = document.createElement("h3");
  name.textContent = pack.name;
  const type = document.createElement("span");
  type.className = "promo-type-label";
  type.textContent = promoTypeLabels[pack.type] || promoTypeLabels.other;
  const description = document.createElement("p");
  description.textContent = pack.description || "사용자가 직접 등록한 프로모팩입니다.";
  body.append(top, name, type, description);

  if (collectionView && pack.note) {
    const note = document.createElement("small");
    note.className = "promo-note";
    note.textContent = `메모 · ${pack.note}`;
    body.append(note);
  }

  const actions = document.createElement("div");
  actions.className = "promo-card-actions";
  if (pack.source) {
    const source = document.createElement("a");
    source.href = pack.source;
    source.target = "_blank";
    source.rel = "noopener noreferrer";
    source.textContent = "공식 확인 ↗";
    actions.append(source);
  }
  const action = document.createElement("button");
  action.type = "button";
  action.className = "promo-collection-action promo-edit-action";
  updatePromoAction(action, pack);
  action.addEventListener("click", () => void togglePromoPack(pack, action));
  actions.append(action);
  body.append(actions);
  article.append(body);
  return article;
}

function promoMatches(pack) {
  if (promoEra !== "all" && pack.era !== promoEra) return false;
  if (promoType !== "all" && pack.type !== promoType) return false;
  const normalized = normalizeSearch(promoQuery);
  if (!normalized) return true;
  return normalizeSearch([
    pack.name,
    pack.era,
    promoEraLabels[pack.era],
    pack.year,
    pack.type,
    promoTypeLabels[pack.type],
    pack.description,
    pack.note,
    ...(pack.keywords || [])
  ].join(" ")).includes(normalized);
}

function renderMyPromoCollection() {
  const owned = allPromoPacks().filter((pack) => ownedPromoPackIds.has(pack.id));
  owned.sort((a, b) => (b.year || 0) - (a.year || 0) || a.name.localeCompare(b.name, "ko"));
  $("promo-owned-count").textContent = owned.length;

  const breakdown = $("promo-owned-breakdown");
  breakdown.replaceChildren();
  ["S", "SV", "M", "OTHER"].forEach((eraKey) => {
    const chip = document.createElement("span");
    chip.innerHTML = `<b>${promoEraLabels[eraKey]}</b> ${
      owned.filter((pack) => pack.era === eraKey).length
    }`;
    breakdown.append(chip);
  });

  const grid = $("my-promo-grid");
  grid.replaceChildren(...owned.map((pack) => createPromoCard(pack, true)));
  grid.hidden = owned.length === 0;
  $("my-promo-empty").hidden = owned.length !== 0;
}

function renderPromoResults() {
  const shown = allPromoPacks().filter(promoMatches);
  const host = $("promo-results");
  host.replaceChildren(...shown.map((pack) => createPromoCard(pack, false)));
  host.hidden = shown.length === 0;
  $("promo-result-count").textContent = shown.length;
  $("promo-empty").hidden = shown.length !== 0;
}

function renderPromo() {
  if (!$("promo-results")) return;
  renderMyPromoCollection();
  renderPromoResults();
}

function openPromoCreateDialog() {
  if (!canEditPackCollection()) {
    alert("Google 로그인 후 새로운 프로모팩을 등록할 수 있습니다.");
    return;
  }
  const form = $("promo-create-form");
  form.reset();
  $("promo-create-year").value = String(new Date().getFullYear());
  $("promo-create-message").textContent = "";
  const dialog = $("promo-create-dialog");
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  $("promo-create-name").focus();
}

function closePromoCreateDialog() {
  const dialog = $("promo-create-dialog");
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

function createCustomPromoId() {
  const random = window.crypto?.randomUUID?.().replaceAll("-", "").slice(0, 12)
    || Math.random().toString(36).slice(2, 14);
  return `custom-${Date.now().toString(36)}-${random}`.toLowerCase();
}

function setPromoCreateMessage(message, state = "") {
  const target = $("promo-create-message");
  target.textContent = message;
  target.dataset.state = state;
}

async function saveCustomPromo(event) {
  event.preventDefault();
  if (!canEditPackCollection()) {
    setPromoCreateMessage("Google 로그인 후 저장할 수 있습니다.", "error");
    return;
  }
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  if (customPromoPacks.length >= 200) {
    setPromoCreateMessage("직접 등록 프로모팩은 계정당 최대 200종까지 저장할 수 있습니다.", "error");
    return;
  }
  const draft = sanitizePromoPack({
    id: createCustomPromoId(),
    name: $("promo-create-name").value,
    era: $("promo-create-era").value,
    year: $("promo-create-year").value,
    type: $("promo-create-type").value,
    image: $("promo-create-image").value,
    description: $("promo-create-description").value,
    note: $("promo-create-note").value,
    keywords: [$("promo-create-name").value, $("promo-create-description").value],
    createdAt: new Date().toISOString()
  }, true);

  if (!draft) {
    setPromoCreateMessage("입력 내용을 확인해 주세요.", "error");
    return;
  }
  const duplicate = allPromoPacks().some(
    (pack) => normalizeSearch(pack.name) === normalizeSearch(draft.name)
  );
  if (duplicate) {
    setPromoCreateMessage("같은 이름의 프로모팩이 이미 있습니다. 검색 결과에서 등록해 주세요.", "error");
    return;
  }

  const save = $("promo-create-save");
  save.disabled = true;
  save.textContent = "저장 중…";
  setPromoCreateMessage("내 프로모팩 컬렉션에 저장하고 있습니다.", "loading");
  try {
    await enqueuePackWrite(async () => {
      const nextCustom = [...customPromoPacks, draft];
      const nextOwned = new Set(ownedPromoPackIds);
      nextOwned.add(draft.id);
      await writePackDocument({
        ownedCodes: currentOwnedCodes(),
        ownedPromoPackIds: [...nextOwned],
        customPromoPacks: nextCustom
      });
      customPromoPacks = nextCustom;
      ownedPromoPackIds = nextOwned;
      dispatchPackChange(`promo:${draft.id}`);
    });
    promoQuery = draft.name;
    $("promo-search").value = draft.name;
    renderPromo();
    closePromoCreateDialog();
    $("my-promo-title")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error(error);
    setPromoCreateMessage(error.message || "프로모팩을 저장하지 못했습니다.", "error");
  } finally {
    save.disabled = false;
    save.textContent = "내 컬렉션에 저장";
  }
}

function initFilters() {
  const host = $("era-filters");
  [["all", "전체"], ["S", "S"], ["SV", "SV"], ["M", "M"]].forEach(
    ([value, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.dataset.era = value;
      button.className = value === "all" ? "is-active" : "";
      button.addEventListener("click", () => {
        era = value;
        host.querySelectorAll("button").forEach((item) => {
          item.classList.toggle("is-active", item === button);
        });
        render();
      });
      host.append(button);
    }
  );

  $("pack-status-filters").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-status]");
    if (!button) return;
    status = button.dataset.status;
    event.currentTarget.querySelectorAll("button").forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });
    render();
  });
  $("pack-search").addEventListener("input", (event) => {
    query = event.target.value;
    render();
  });
}

function initDialogs() {
  const packDialog = $("pack-dialog");
  $("pack-dialog-close").addEventListener("click", closePackDialog);
  packDialog.addEventListener("click", (event) => {
    if (event.target === packDialog) closePackDialog();
  });

  const createDialog = $("promo-create-dialog");
  document.querySelectorAll("[data-open-promo-create]").forEach((button) => {
    button.addEventListener("click", openPromoCreateDialog);
  });
  $("promo-create-close").addEventListener("click", closePromoCreateDialog);
  $("promo-create-cancel").addEventListener("click", closePromoCreateDialog);
  $("promo-create-form").addEventListener("submit", saveCustomPromo);
  createDialog.addEventListener("click", (event) => {
    if (event.target === createDialog) closePromoCreateDialog();
  });
}

function initPromoControls() {
  $("promo-search").addEventListener("input", (event) => {
    promoQuery = event.target.value;
    renderPromoResults();
  });
  $("promo-era-filter").addEventListener("change", (event) => {
    promoEra = event.target.value;
    renderPromoResults();
  });
  $("promo-type-filter").addEventListener("change", (event) => {
    promoType = event.target.value;
    renderPromoResults();
  });
}

async function bootstrapPackDex() {
  initFilters();
  initDialogs();
  initPromoControls();
  applyPackDocument({}, []);
  try {
    await loadPromoMaster();
  } catch (error) {
    console.error("프로모팩 마스터 DB를 불러오지 못했습니다.", error);
    $("promo-master-count").textContent = "0";
    $("promo-empty").hidden = false;
    $("promo-empty").querySelector("h3").textContent = "프로모팩 DB를 불러오지 못했습니다";
    $("promo-empty").querySelector("p").textContent = "잠시 후 페이지를 새로고침해 주세요.";
  }
  void initializePackFirebase();
}

void bootstrapPackDex();
