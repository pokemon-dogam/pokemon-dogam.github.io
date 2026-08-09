"use strict";

const SPRITE_COLUMNS = 10;
const SPRITE_ROWS = 7;
const FIREBASE_SDK_VERSION = "10.12.5";

const packs = [
  ["S","소드","s1W",0],["S","실드","s1H",0],["S","VMAX라이징","s1a",0],["S","반역크래시","s2",0],["S","폭염워커","s2a",0],["S","무한존","s3",0],["S","전설의 고동","s3a",0],["S","앙천의 볼트태클","s4",0],["S","샤이니스타V","s4a",0],["S","일격마스터","s5I",0],["S","연격마스터","s5R",0],["S","쌍벽의 파이터","s5a",0],["S","백은의 랜스","s6H",0],["S","칠흑의 가이스트","s6K",0],["S","이브이 히어로즈","s6a",0],["S","마천퍼펙트","s7D",0],["S","창공스트림","s7R",0],["S","퓨전아츠","s8",0],["S","25th","s8a",0],["S","VMAX 클라이맥스","s8b",0],["S","스타버스","s9",0],["S","배틀리전","s9a",0],["S","스페이스저글러","s10P",0],["S","타임게이저","s10D",0],["S","다크판타스마","s10a",0],["S","Pokémon GO","s10b",0],["S","로스트어비스","s11",0],["S","백열의 아르카나","s11a",0],["S","패러다임트리거","s12",0],["S","VSTAR유니버스","s12a",0],

  ["SV","스칼렛ex","sv1S",1],["SV","바이올렛ex","sv1V",0],["SV","트리플렛비트","sv1a",1],["SV","클레이버스트","sv2D",0],["SV","스노해저드","sv2P",0],["SV","포켓몬카드 151","sv2a",0],["SV","흑염의 지배자","sv3",1],["SV","레이징서프","sv3a",1],["SV","고대의 포효","sv4K",0],["SV","미래의 일섬","sv4M",0],["SV","샤이니트레저ex","sv4a",0],["SV","와일드포스","sv5K",1],["SV","사이버저지","sv5M",0],["SV","크림슨헤이즈","sv5a",1],["SV","변환의 가면","sv6",0],["SV","나이트원더러","sv6a",1],["SV","스텔라미라클","sv7",0],["SV","낙원드래고나","sv7a",1],["SV","초전브레이커","sv8",1],["SV","테라스탈페스ex","sv8a",0],["SV","배틀파트너즈","sv9",1],["SV","열풍의 아레나","sv9a",0],["SV","로켓단의 영광","sv10",1],["SV","블랙볼트","sv11B",0],["SV","화이트플레어","sv11W",0],

  ["M","메가심포니아","m1S",0],["M","메가브레이브","m1L",0],["M","인페르노X","m2",1],["M","MEGA드림ex","m2a",0],["M","니힐제로","m3",0],["M","닌자스피너","m4",1],["M","어비스아이","m5",1],

  ["S-P","소드&실드 프로모팩 제1탄","promo-s-01",0],["S-P","소드&실드 프로모팩 제2탄","promo-s-02",0],["S-P","소드&실드 프로모팩 제3탄","promo-s-03",0],["S-P","소드&실드 프로모팩 제4탄","promo-s-04",0],["S-P","소드&실드 프로모팩 제5탄","promo-s-05",0],["S-P","소드&실드 프로모팩 제6탄","promo-s-06",0],["S-P","소드&실드 프로모팩 제7탄","promo-s-07",0],["S-P","소드&실드 프로모팩 제8탄","promo-s-08",0],["S-P","소드&실드 프로모팩 제9탄","promo-s-09",0],["S-P","소드&실드 프로모팩 제10탄","promo-s-10",0],["S-P","소드&실드 프로모팩 제11탄","promo-s-11",0],["S-P","소드&실드 프로모팩 제12탄","promo-s-12",0],

  ["SV-P","스칼렛&바이올렛 프로모 카드 팩 제1탄","promo-sv-01",0],["SV-P","스칼렛&바이올렛 프로모 카드 팩 제2탄","promo-sv-02",0],["SV-P","스칼렛&바이올렛 프로모 카드 팩 제3탄","promo-sv-03",0],["SV-P","스칼렛&바이올렛 프로모 카드 팩 제4탄","promo-sv-04",0],["SV-P","스칼렛&바이올렛 프로모 카드 팩 제5탄","promo-sv-05",0],["SV-P","스칼렛&바이올렛 프로모 카드 팩 제6탄","promo-sv-06",0],["SV-P","스칼렛&바이올렛 프로모 카드 팩 제7탄","promo-sv-07",0],["SV-P","스칼렛&바이올렛 프로모 카드 팩 제8탄","promo-sv-08",0],["SV-P","스칼렛&바이올렛 프로모 카드 팩 제9탄","promo-sv-09",0],

  ["M-P","MEGA 프로모 카드 팩 제1탄","promo-m-01",0],["M-P","MEGA 프로모 카드 팩 제2탄","promo-m-02",0],["M-P","MEGA 프로모 카드 팩 제3탄","promo-m-03",0],["M-P","MEGA 프로모 카드 팩 제4탄","promo-m-04",0]
].map(([era, name, code, owned], i) => ({
  era,
  name,
  code,
  displayCode: era.endsWith("-P")
    ? `${era} · ${Number(code.match(/(\d+)$/)?.[1] || 0)}탄`
    : code,
  kind: era.endsWith("-P")
    ? "promo"
    : "booster",
  volume: era.endsWith("-P")
    ? Number(code.match(/(\d+)$/)?.[1] || 0)
    : 0,
  legacyOwned: Boolean(owned),
  owned: false,
  i
}));

const palettes = {
  S: ["#3759b6", "#8a5bd4"],
  SV: ["#d94c60", "#6366c7"],
  M: ["#24314f", "#19a690"],
  "S-P": ["#c99a38", "#725729"],
  "SV-P": ["#7a5b4d", "#b48a68"],
  "M-P": ["#2187bb", "#195b91"]
};

const promoPalettes = {
  "S-P": [
    ["#cf9b35", "#8c6422"],
    ["#4f88c7", "#264f87"],
    ["#45a573", "#246647"],
    ["#7554a0", "#453263"],
    ["#d2555c", "#8d3036"],
    ["#39a7a9", "#246c76"],
    ["#e08243", "#9e4728"],
    ["#ba6ca4", "#74446d"],
    ["#4566a9", "#293d73"],
    ["#719d4c", "#405f2f"],
    ["#b8b9bd", "#6f737b"],
    ["#5b5194", "#322e62"]
  ],
  "SV-P": [
    ["#80604f", "#4d382f"],
    ["#4d8bcb", "#285789"],
    ["#41a873", "#246746"],
    ["#755546", "#44322c"],
    ["#df4c52", "#942f36"],
    ["#d3b33a", "#8f7723"],
    ["#df6a9c", "#914366"],
    ["#2faeb7", "#20727b"],
    ["#7e62c4", "#4d3d81"]
  ],
  "M-P": [
    ["#278fc4", "#1c5b91"],
    ["#d25555", "#8f3038"],
    ["#42a36e", "#286445"],
    ["#805ec0", "#4d3980"]
  ]
};

const packGroups = [
  ["S", "S 시리즈"],
  ["SV", "SV 시리즈"],
  ["M", "M 시리즈"],
  ["S-P", "소드&실드 프로모 팩"],
  ["SV-P", "스칼렛&바이올렛 프로모 팩"],
  ["M-P", "MEGA 프로모 팩"]
];

const promoSeriesLabels = {
  "S-P": "소드&실드",
  "SV-P": "스칼렛&바이올렛",
  "M-P": "MEGA"
};

let era = "all";
let status = "all";
let query = "";
let packFirebase = null;
let packUser = null;
let packUserDocumentRef = null;
let packBaseMode = "empty";
let packSharedViewActive = false;
let packSaveQueue = Promise.resolve();
let activePack = null;

const $ = id => document.getElementById(id);
const pct = (n, d) => Math.round(n / d * 1000) / 10;

function getLegacyOwnedCodes() {
  return packs
    .filter(pack => pack.legacyOwned)
    .map(pack => pack.code);
}

function applyOwnedCodes(ownedCodes) {
  const ownedSet = new Set(
    Array.isArray(ownedCodes)
      ? ownedCodes.map(code => String(code).trim().toLowerCase())
      : []
  );

  packs.forEach(pack => {
    pack.owned = ownedSet.has(pack.code.toLowerCase());
  });

  drawSummary();
  render();
}

function ensurePackAuthControls() {
  if (document.getElementById("firebase-auth-panel")) {
    return;
  }

  const header = document.querySelector(".site-header");

  if (!header) {
    return;
  }

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
  controls
    .querySelector("#firebase-login")
    ?.addEventListener("click", signInPackUser);
  controls
    .querySelector("#firebase-logout")
    ?.addEventListener("click", signOutPackUser);
}

function updatePackAuthControls(user, message = "") {
  ensurePackAuthControls();

  const panel = $("firebase-auth-panel");
  const label = $("firebase-auth-status");
  const login = $("firebase-login");
  const logout = $("firebase-logout");

  if (!panel || !label || !login || !logout) {
    return;
  }

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

  const ownerEmail = String(
    window.POKEMON_DEX_FIREBASE?.ownerEmail || ""
  )
    .trim()
    .toLowerCase();
  const userEmail = String(user?.email || "")
    .trim()
    .toLowerCase();

  panel.classList.toggle("is-account", Boolean(user));
  panel.classList.toggle(
    "is-owner",
    Boolean(user && userEmail === ownerEmail)
  );

  if (user) {
    const account =
      user.displayName ||
      user.email ||
      "로그인 사용자";
    const modeText =
      userEmail === ownerEmail
        ? "기존 도감 유지"
        : "0장부터 시작";

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
    applyOwnedCodes([]);
    updatePackAuthControls(null);
    return;
  }

  const email = String(user.email || "")
    .trim()
    .toLowerCase();

  const ownerEmail = String(
    window.POKEMON_DEX_FIREBASE?.ownerEmail || ""
  )
    .trim()
    .toLowerCase();

  const baseMode =
    email === ownerEmail
      ? "legacy"
      : "empty";
  packBaseMode = baseMode;

  const defaultOwnedCodes =
    baseMode === "legacy"
      ? getLegacyOwnedCodes()
      : [];

  const {
    db,
    firestoreModule
  } = packFirebase;

  const shared = window.PokemonDexSharedReadonly;
  await shared?.ensureOwnerShare?.(
    db,
    firestoreModule,
    user
  );
  packSharedViewActive = Boolean(
    shared?.isActive?.(user)
  );

  if (packSharedViewActive) {
    packBaseMode = "legacy";
    try {
      const ownerDocument =
        await shared.loadOwnerDocument(
          db,
          firestoreModule,
          "packDex"
        );

      if (!ownerDocument) {
        throw new Error(
          "packDex 공유 문서를 찾지 못했습니다."
        );
      }

      const data =
        ownerDocument.data || {};
      const ownedCodes =
        Array.isArray(data.ownedCodes)
          ? data.ownedCodes
          : getLegacyOwnedCodes();

      applyOwnedCodes(ownedCodes);
      updatePackAuthControls(user);
      return;
    } catch (error) {
      console.warn(
        "팩도감 읽기 전용 공유 데이터를 불러오지 못했습니다.",
        error
      );

      applyOwnedCodes(
        getLegacyOwnedCodes()
      );
      updatePackAuthControls(user);
      return;
    }
  }

  const docRef = firestoreModule.doc(
    db,
    "users",
    user.uid,
    "collections",
    "packDex"
  );
  packUserDocumentRef = docRef;

  try {
    const snapshot =
      await firestoreModule.getDoc(docRef);

    if (!snapshot.exists()) {
      await firestoreModule.setDoc(docRef, {
        baseMode,
        email: user.email || "",
        displayName:
          user.displayName || "",
        ownedCodes: defaultOwnedCodes,
        updatedAt:
          firestoreModule.serverTimestamp()
      });

      applyOwnedCodes(defaultOwnedCodes);
      updatePackAuthControls(user);
      return;
    }

    const data = snapshot.data() || {};

    const ownedCodes =
      Array.isArray(data.ownedCodes)
        ? data.ownedCodes
        : defaultOwnedCodes;

    applyOwnedCodes(ownedCodes);
    updatePackAuthControls(user);
  } catch (error) {
    console.warn(
      "팩도감 정보를 불러오지 못했습니다.",
      error
    );

    applyOwnedCodes(defaultOwnedCodes);
    updatePackAuthControls(user);
  }
}

async function initializePackFirebase() {
  ensurePackAuthControls();

  const firebaseConfig =
    window.POKEMON_DEX_FIREBASE;

  if (
    !firebaseConfig ||
    !firebaseConfig.enabled ||
    !firebaseConfig.config
  ) {
    applyOwnedCodes([]);

    updatePackAuthControls(
      null,
      "Firebase 설정 없음 · 전체 미보유"
    );

    return;
  }

  try {
    const [
      appModule,
      authModule,
      firestoreModule
    ] = await Promise.all([
      import(
        `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`
      ),
      import(
        `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`
      ),
      import(
        `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`
      )
    ]);

    const app = appModule.getApps().length
      ? appModule.getApp()
      : appModule.initializeApp(
          firebaseConfig.config
        );

    const auth =
      authModule.getAuth(app);

    const db =
      firestoreModule.getFirestore(app);

    try {
      await authModule.setPersistence(
        auth,
        authModule.browserLocalPersistence
      );
    } catch (error) {
      console.warn(
        "로그인 유지 설정에 실패했습니다.",
        error
      );
    }

    packFirebase = {
      auth,
      db,
      authModule,
      firestoreModule
    };

    authModule.onAuthStateChanged(
      auth,
      user => {
        void applyPackUserState(user);
      },
      error => {
        console.warn(
          "팩도감 로그인 확인 실패",
          error
        );

        applyOwnedCodes([]);

        updatePackAuthControls(
          null,
          "로그인 확인 실패 · 전체 미보유"
        );
      }
    );
  } catch (error) {
    console.warn(
      "팩도감 Firebase 초기화 실패",
      error
    );

    applyOwnedCodes([]);

    updatePackAuthControls(
      null,
      "연결 실패 · 전체 미보유"
    );
  }
}

async function signInPackUser() {
  if (!packFirebase) {
    alert("로그인 기능을 불러오지 못했습니다.");
    return;
  }

  const {
    auth,
    authModule
  } = packFirebase;

  const button =
    $("firebase-login");

  if (button) {
    button.disabled = true;
    button.textContent = "로그인 중…";
  }

  const provider =
    new authModule.GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: "select_account"
  });

  try {
    await authModule.signInWithPopup(
      auth,
      provider
    );
  } catch (error) {
    console.error(
      "팩도감 Google 로그인 오류",
      error
    );

    if (
      error.code !==
      "auth/popup-closed-by-user"
    ) {
      let message =
        "Google 로그인에 실패했습니다.";

      if (
        error.code === "auth/popup-blocked"
      ) {
        message =
          "로그인 팝업이 차단되었습니다.\nChrome 또는 Safari에서 사이트를 직접 열고 다시 시도하세요.";
      } else if (
        error.code ===
        "auth/unauthorized-domain"
      ) {
        message =
          "Firebase 승인 도메인에 pokemon-dogam.github.io가 등록되지 않았습니다.";
      } else if (error.message) {
        message += `\n${error.message}`;
      }

      alert(message);
    }

    updatePackAuthControls(packUser);
  }
}

async function signOutPackUser() {
  if (!packFirebase) {
    return;
  }

  const button =
    $("firebase-logout");

  if (button) {
    button.disabled = true;
    button.textContent = "로그아웃 중…";
  }

  try {
    window.PokemonDexSharedReadonly?.clear?.();
    await packFirebase.authModule.signOut(
      packFirebase.auth
    );
  } catch (error) {
    console.error(
      "팩도감 로그아웃 오류",
      error
    );

    alert("로그아웃에 실패했습니다.");
    updatePackAuthControls(packUser);
  }
}

function canEditPackCollection() {
  return Boolean(
    packUser &&
      packFirebase &&
      packUserDocumentRef &&
      !packSharedViewActive
  );
}

function updatePackCompletionButton(
  button,
  pack
) {
  const owned = Boolean(pack.owned);

  button.classList.toggle(
    "is-complete",
    owned
  );

  button.classList.remove("is-saving");
  button.disabled = false;

  button.setAttribute(
    "aria-pressed",
    String(owned)
  );

  button.setAttribute(
    "aria-label",
    owned
      ? `${pack.name} 팩 수집완료 취소`
      : `${pack.name} 팩 수집완료로 표시`
  );

  button.title = owned
    ? "다시 누르면 미수집으로 변경됩니다."
    : "로그인한 내 도감에 수집완료로 저장합니다.";

  button.textContent = owned
    ? "✓ 수집완료"
    : "수집완료";
}

async function persistPackOwned(
  pack,
  owned
) {
  if (!canEditPackCollection()) {
    throw new Error(
      "Google 로그인 후 내 팩 수집 상태를 저장할 수 있습니다."
    );
  }

  const operation = async () => {
    const nextOwned = new Set(
      packs
        .filter(item => item.owned)
        .map(item => item.code)
    );

    if (owned) {
      nextOwned.add(pack.code);
    } else {
      nextOwned.delete(pack.code);
    }

    const ownedCodes = packs
      .filter(item => nextOwned.has(item.code))
      .map(item => item.code);

    await packFirebase.firestoreModule.setDoc(
      packUserDocumentRef,
      {
        baseMode: packBaseMode,
        email: packUser.email || "",
        displayName:
          packUser.displayName || "",
        ownedCodes,
        updatedAt:
          packFirebase.firestoreModule.serverTimestamp()
      },
      { merge: true }
    );

    pack.owned = owned;
    window.dispatchEvent(
      new CustomEvent(
        "pokemon-dex:collection-changed",
        {
          detail: {
            category: "pack",
            key: pack.code
          }
        }
      )
    );
    return pack;
  };

  const queued =
    packSaveQueue.then(operation, operation);

  packSaveQueue =
    queued.catch(() => undefined);

  return queued;
}

async function togglePackCompletion(
  pack,
  button
) {
  if (!canEditPackCollection()) {
    alert(
      "Google 로그인 후 내 팩 수집 상태를 저장할 수 있습니다."
    );
    return;
  }

  button.disabled = true;
  button.classList.add("is-saving");
  button.textContent = "저장 중…";

  try {
    await persistPackOwned(
      pack,
      !pack.owned
    );

    drawSummary();

    if (activePack === pack) {
      updatePackDialog(pack);
    }

    render();
  } catch (error) {
    console.error(error);

    alert(
      error.message ||
        "팩 수집 상태를 저장하지 못했습니다."
    );

    updatePackCompletionButton(
      button,
      pack
    );
  }
}

function makePackCompletionButton(pack) {
  const button =
    document.createElement("button");

  button.type = "button";
  button.className =
    "collection-complete-button";

  updatePackCompletionButton(
    button,
    pack
  );

  button.addEventListener(
    "click",
    event => {
      event.preventDefault();
      event.stopPropagation();

      void togglePackCompletion(
        pack,
        button
      );
    }
  );

  return button;
}

function drawSummary() {
  const owned =
    packs.filter(pack => pack.owned).length;

  const total = packs.length;
  const rate = pct(owned, total);

  $("pack-owned").textContent = owned;
  $("pack-total").textContent = total;
  $("pack-missing").textContent =
    total - owned;

  $("pack-rate").textContent =
    `${rate}%`;

  $("stat-pack-owned").textContent =
    owned;

  $("stat-pack-missing").textContent =
    total - owned;

  $("stat-pack-rate").textContent =
    rate;

  $("pack-progress-ring")
    .style
    .setProperty("--progress", rate);
}

function paletteFor(pack) {
  if (pack.kind !== "promo") {
    return palettes[pack.era];
  }

  const seriesPalettes =
    promoPalettes[pack.era] || [];

  return (
    seriesPalettes[pack.volume - 1] ||
    palettes[pack.era]
  );
}

function appendPromoPackArtwork(
  image,
  pack
) {
  const hole =
    document.createElement("span");
  hole.className = "promo-pack-hole";
  hole.setAttribute("aria-hidden", "true");

  const brand =
    document.createElement("span");
  brand.className = "promo-pack-brand";
  brand.textContent = "POKÉMON CARD GAME";

  const series =
    document.createElement("strong");
  series.className = "promo-pack-series";
  series.textContent =
    promoSeriesLabels[pack.era] ||
    pack.era;

  const title =
    document.createElement("span");
  title.className = "promo-pack-title";
  title.textContent = "프로모 카드 팩";

  const volume =
    document.createElement("b");
  volume.className = "promo-pack-volume";
  volume.textContent =
    `제 ${pack.volume} 탄`;

  const notForSale =
    document.createElement("small");
  notForSale.className =
    "promo-pack-not-for-sale";
  notForSale.textContent = "비매품";

  image.append(
    hole,
    brand,
    series,
    title,
    volume,
    notForSale
  );
}

function configurePackImage(
  image,
  pack
) {
  const colors =
    paletteFor(pack);

  image.style.setProperty(
    "--pack-a",
    colors[0]
  );

  image.style.setProperty(
    "--pack-b",
    colors[1]
  );

  image.setAttribute(
    "aria-label",
    `${pack.name} 팩 이미지`
  );

  image.classList.toggle(
    "is-promo",
    pack.kind === "promo"
  );
  image.replaceChildren();

  if (pack.kind === "promo") {
    image.style.removeProperty(
      "--sprite-x"
    );
    image.style.removeProperty(
      "--sprite-y"
    );
    appendPromoPackArtwork(
      image,
      pack
    );
    return;
  }

  const pos =
    spritePosition(pack.i);

  image.style.setProperty(
    "--sprite-x",
    `${pos.x}%`
  );

  image.style.setProperty(
    "--sprite-y",
    `${pos.y}%`
  );
}

function spritePosition(index) {
  const col =
    index % SPRITE_COLUMNS;

  const row =
    Math.floor(index / SPRITE_COLUMNS);

  return {
    x: SPRITE_COLUMNS === 1
      ? 0
      : (
          col /
          (SPRITE_COLUMNS - 1)
        ) * 100,

    y: SPRITE_ROWS === 1
      ? 0
      : (
          row /
          (SPRITE_ROWS - 1)
        ) * 100
  };
}

function updatePackDialog(pack) {
  const image =
    $("pack-dialog-image");

  const imageWrap =
    $("pack-dialog-image-wrap");

  configurePackImage(
    image,
    pack
  );

  imageWrap.classList.toggle(
    "is-missing",
    !pack.owned
  );

  $("pack-dialog-code").textContent =
    pack.displayCode;

  $("pack-dialog-status").textContent =
    pack.owned
      ? "수집완료"
      : "미수집";

  $("pack-dialog-status").className =
    `status-badge ${
      pack.owned
        ? "is-owned"
        : "is-missing"
    }`;

  $("pack-dialog-name").textContent =
    pack.name;

  $("pack-dialog-era").textContent =
    pack.kind === "promo"
      ? `${promoSeriesLabels[pack.era]} 프로모 팩`
      : `${pack.era} 시리즈`;

  $("pack-dialog-category").textContent =
    pack.kind === "promo"
      ? "PROMO PACK COLLECTION"
      : "BOOSTER PACK COLLECTION";

  $("pack-dialog-ownership").textContent =
    pack.owned
      ? "보유 중"
      : "아직 미수집";
}

function openPackDialog(pack) {
  const dialog =
    $("pack-dialog");

  activePack = pack;
  updatePackDialog(pack);

  if (
    typeof dialog.showModal === "function"
  ) {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

function closePackDialog() {
  const dialog =
    $("pack-dialog");

  if (
    typeof dialog.close === "function"
  ) {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
}

function createCard(pack) {
  const element =
    document.createElement("article");

  element.className =
    `pack-card has-completion-action${
      pack.owned
        ? ""
        : " is-missing"
    }`;

  const colors =
    paletteFor(pack);

  element.style.setProperty(
    "--pack-a",
    colors[0]
  );

  element.style.setProperty(
    "--pack-b",
    colors[1]
  );

  const detailButton =
    document.createElement("button");

  detailButton.type = "button";
  detailButton.className =
    "pack-card-detail";

  detailButton.setAttribute(
    "aria-label",
    `${pack.name} 상세 보기`
  );

  const art =
    document.createElement("div");

  art.className = "pack-art";

  const image =
    document.createElement("span");

  image.className = "pack-image";
  image.setAttribute("role", "img");

  image.setAttribute(
    "aria-label",
    `${pack.name} 팩 이미지`
  );

  configurePackImage(
    image,
    pack
  );

  art.append(image);

  const body =
    document.createElement("div");

  body.className =
    "pack-card-body";

  const top =
    document.createElement("div");

  top.className =
    "pack-card-top";

  const code =
    document.createElement("span");

  code.className = "pack-code";
  code.textContent = pack.displayCode;

  const state =
    document.createElement("span");

  state.className = "pack-status";

  state.textContent =
    pack.owned
      ? "수집완료"
      : "미수집";

  top.append(code, state);

  const name =
    document.createElement("strong");

  name.className = "pack-name";
  name.textContent = pack.name;

  body.append(top, name);
  detailButton.append(art, body);

  detailButton.addEventListener(
    "click",
    () => openPackDialog(pack)
  );

  element.append(
    detailButton,
    makePackCompletionButton(pack)
  );

  return element;
}

function render() {
  const normalizedQuery =
    query.trim().toLowerCase();

  const shown = packs.filter(pack => {
    const eraMatches =
      era === "all" ||
      (
        era === "PROMO"
          ? pack.kind === "promo"
          : pack.era === era
      );

    const statusMatches =
      status === "all" ||
      (
        status === "owned"
      ) === pack.owned;

    const queryMatches =
      !normalizedQuery ||
      `${pack.name} ${pack.code} ${pack.displayCode} ${
        pack.kind === "promo"
          ? "프로모 팩"
          : "확장팩"
      }`
        .toLowerCase()
        .includes(normalizedQuery);

    return (
      eraMatches &&
      statusMatches &&
      queryMatches
    );
  });

  const host =
    $("pack-groups");

  host.replaceChildren();

  packGroups.forEach(([key, label]) => {
    const items =
      shown.filter(
        pack => pack.era === key
      );

    if (!items.length) {
      return;
    }

    const section =
      document.createElement("section");

    section.className =
      "pack-series";

    const heading =
      document.createElement("div");

    heading.className =
      "pack-series-heading";

    const title =
      document.createElement("h3");

    title.textContent = label;

    const summary =
      document.createElement("p");

    summary.textContent =
      `${
        items.filter(
          pack => pack.owned
        ).length
      } / ${items.length}팩 수집완료`;

    heading.append(title, summary);

    const grid =
      document.createElement("div");

    grid.className = "pack-grid";

    items.forEach(pack => {
      grid.append(
        createCard(pack)
      );
    });

    section.append(heading, grid);
    host.append(section);
  });

  $("pack-result-count").textContent =
    shown.length;

  $("pack-empty").hidden =
    shown.length !== 0;
}

function initFilters() {
  const host =
    $("era-filters");

  [
    ["all", "전체"],
    ["S", "S"],
    ["SV", "SV"],
    ["M", "M"],
    ["PROMO", "프로모 팩"]
  ].forEach(([value, label]) => {
    const button =
      document.createElement("button");

    button.type = "button";
    button.textContent = label;
    button.dataset.era = value;

    button.className =
      value === "all"
        ? "is-active"
        : "";

    button.addEventListener(
      "click",
      () => {
        era = value;

        host
          .querySelectorAll("button")
          .forEach(item => {
            item.classList.toggle(
              "is-active",
              item === button
            );
          });

        render();
      }
    );

    host.append(button);
  });

  $("pack-status-filters")
    .addEventListener(
      "click",
      event => {
        const button =
          event.target.closest("button");

        if (!button) {
          return;
        }

        status =
          button.dataset.status;

        event.currentTarget
          .querySelectorAll("button")
          .forEach(item => {
            item.classList.toggle(
              "is-active",
              item === button
            );
          });

        render();
      }
    );

  $("pack-search")
    .addEventListener(
      "input",
      event => {
        query = event.target.value;
        render();
      }
    );
}

function initDialog() {
  const dialog =
    $("pack-dialog");

  $("pack-dialog-close")
    .addEventListener(
      "click",
      closePackDialog
    );

  dialog.addEventListener(
    "click",
    event => {
      if (event.target === dialog) {
        closePackDialog();
      }
    }
  );
}

function bootstrapPackDex() {
  initFilters();
  initDialog();

  // 로그인 확인 전에는 전부 미보유로 표시
  applyOwnedCodes([]);

  void initializePackFirebase();
}

bootstrapPackDex();
