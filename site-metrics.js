"use strict";

(function () {
  const HEADER_METRICS_VERSION = 2;
  if (window.PokemonDexSiteMetrics?.headerMetricsVersion === HEADER_METRICS_VERSION) return;

  const SDK_VERSION = "12.16.0";
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const OWNER_EMAIL = String(CONFIG.ownerEmail || "").trim().toLowerCase();
  const KNOWN_VIEWER_UID = "9K11y6y4U4dlVmmi9bkxaT4Ci8u2";
  const VISITOR_STORAGE_KEY = "pokemonDexVisitorIdV1";
  const METRICS_COLLECTION = "siteMetrics";
  const METRICS_DOCUMENT = "public";
  const DAILY_COLLECTION = "siteDailyMetrics";
  const USER_COLLECTION = "siteUserRegistry";

  function installStyles() {
    if (document.querySelector("#site-header-metrics-style")) return;
    const style = document.createElement("style");
    style.id = "site-header-metrics-style";
    style.textContent = `
      .site-header-metrics{display:flex;align-items:center;gap:0;min-width:0;margin-left:clamp(18px,3.2vw,52px);color:#73798a;white-space:nowrap}
      .site-header-metric{display:inline-flex;align-items:baseline;gap:5px;min-height:30px;padding:6px 11px;border-left:1px solid #e7e9f1;font-size:.6rem;font-weight:800;line-height:1}
      .site-header-metric:first-of-type{border-left:0;padding-left:0}
      .site-header-metric-label{color:#8b91a1;font-weight:700}
      .site-header-metric strong{color:#26365b;font-size:.76rem;font-weight:900;letter-spacing:-.025em}
      .site-header-metric small{color:#9aa0ae;font-size:.52rem;font-weight:700}
      .site-header-metric--today strong{color:#13795b}
      .site-header-metric--users strong{color:#6b50c8}
      .site-header-metric[hidden]{display:none!important}
      .site-header-metrics-status{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
      #dashboard-traffic{display:none!important}
      @media(max-width:1180px){.site-header-metrics{margin-left:20px}.site-header-metric{padding-right:7px;padding-left:7px;font-size:.55rem}.site-header-metric strong{font-size:.7rem}}
      @media(max-width:860px){.site-header-metrics{display:none!important}}
      @media print{.site-header-metrics{display:none!important}}
    `;
    document.head.append(style);
  }

  function ensureHeaderMetrics() {
    installStyles();
    document.querySelector("#dashboard-traffic")?.setAttribute("hidden", "");
    const header = document.querySelector(".site-header");
    if (!header) return null;
    let panel = document.querySelector("#site-header-metrics");
    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = "site-header-metrics";
    panel.className = "site-header-metrics";
    panel.setAttribute("role", "status");
    panel.setAttribute("aria-label", "사이트 이용 현황");
    panel.innerHTML = `
      <span class="site-header-metric site-header-metric--today">
        <span class="site-header-metric-label">오늘 방문자</span>
        <strong id="header-metric-today-visits">—</strong><small>명</small>
      </span>
      <span class="site-header-metric site-header-metric--total">
        <span class="site-header-metric-label">누적 방문자</span>
        <strong id="header-metric-total-visits">—</strong><small>명</small>
      </span>
      <span id="header-metric-users-wrap" class="site-header-metric site-header-metric--users" hidden>
        <span class="site-header-metric-label">사용 인원</span>
        <strong id="header-metric-users">—</strong><small>명</small>
      </span>
      <span id="site-header-metrics-status" class="site-header-metrics-status" aria-live="polite">이용 현황을 불러오는 중입니다.</span>
    `;
    const brand = header.querySelector(".brand");
    if (brand) brand.after(panel);
    else header.prepend(panel);
    return panel;
  }

  const panel = ensureHeaderMetrics();
  const elements = {
    panel,
    total: document.querySelector("#header-metric-total-visits"),
    today: document.querySelector("#header-metric-today-visits"),
    users: document.querySelector("#header-metric-users"),
    usersWrap: document.querySelector("#header-metric-users-wrap"),
    status: document.querySelector("#site-header-metrics-status"),
  };

  function configured() {
    const config = CONFIG.config || {};
    return Boolean(
      CONFIG.enabled &&
        config.apiKey &&
        config.authDomain &&
        config.projectId,
    );
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("ko-KR").format(Math.max(0, Number(value) || 0));
  }

  function counter(value) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : 0;
  }

  function updateMetric(element, value) {
    if (element) element.textContent = value === null ? "—" : formatNumber(value);
  }

  function updateStatus(message) {
    if (elements.status) elements.status.textContent = message;
  }

  function isOwner(user) {
    return Boolean(
      user &&
        OWNER_EMAIL &&
        String(user.email || "").trim().toLowerCase() === OWNER_EMAIL,
    );
  }

  function setOwnerVisibility(user) {
    if (elements.usersWrap) elements.usersWrap.hidden = !isOwner(user);
  }

  function renderMetrics(summary = null, daily = null, user = null) {
    updateMetric(
      elements.total,
      summary ? counter(summary.cumulativeVisits) : null,
    );
    updateMetric(elements.today, daily ? counter(daily.visits) : 0);
    setOwnerVisibility(user);
    if (isOwner(user)) {
      updateMetric(elements.users, summary ? counter(summary.userCount) : null);
    }
    elements.panel?.setAttribute("aria-busy", "false");
  }

  function dateKeyInKorea(date = new Date()) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(date);
      const values = Object.fromEntries(
        parts
          .filter((part) => part.type !== "literal")
          .map((part) => [part.type, part.value]),
      );
      return `${values.year}-${values.month}-${values.day}`;
    } catch (error) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }

  function createVisitorId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    if (window.crypto?.getRandomValues) {
      const values = new Uint8Array(16);
      window.crypto.getRandomValues(values);
      return Array.from(values, (value) =>
        value.toString(16).padStart(2, "0"),
      ).join("");
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }

  function validVisitorId(value) {
    return /^[A-Za-z0-9-]{24,64}$/.test(String(value || ""));
  }

  function visitorId() {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      try {
        const stored = storage.getItem(VISITOR_STORAGE_KEY);
        if (validVisitorId(stored)) return stored;
      } catch (error) {
        // Continue with the next browser storage option.
      }
    }

    const created = createVisitorId();
    for (const storage of [window.localStorage, window.sessionStorage]) {
      try {
        storage.setItem(VISITOR_STORAGE_KEY, created);
        return created;
      } catch (error) {
        // Continue with the next browser storage option.
      }
    }
    return created;
  }

  function firstAuthUser(auth, authModule) {
    return new Promise((resolve) => {
      let unsubscribe = () => {};
      unsubscribe = authModule.onAuthStateChanged(
        auth,
        (user) => {
          unsubscribe();
          resolve(user || null);
        },
        () => {
          unsubscribe();
          resolve(null);
        },
      );
    });
  }

  function summaryPayload(data, changes, firestoreModule) {
    return {
      cumulativeVisits: counter(
        changes.cumulativeVisits ?? data.cumulativeVisits,
      ),
      userCount: counter(changes.userCount ?? data.userCount),
      lastVisitDate: String(
        changes.lastVisitDate ?? data.lastVisitDate ?? "",
      ),
      lastVisitorId: String(
        changes.lastVisitorId ?? data.lastVisitorId ?? "",
      ),
      updatedAt: firestoreModule.serverTimestamp(),
    };
  }

  async function ensureDailyVisit(db, firestoreModule, day, id) {
    const summaryRef = firestoreModule.doc(
      db,
      METRICS_COLLECTION,
      METRICS_DOCUMENT,
    );
    const dailyRef = firestoreModule.doc(db, DAILY_COLLECTION, day);
    const visitorRef = firestoreModule.doc(
      db,
      DAILY_COLLECTION,
      day,
      "visitors",
      id,
    );

    await firestoreModule.runTransaction(db, async (transaction) => {
      const visitorSnapshot = await transaction.get(visitorRef);
      const summarySnapshot = await transaction.get(summaryRef);
      const dailySnapshot = await transaction.get(dailyRef);

      if (visitorSnapshot.exists()) return;

      const summary = summarySnapshot.exists()
        ? summarySnapshot.data() || {}
        : {};
      const daily = dailySnapshot.exists() ? dailySnapshot.data() || {} : {};

      transaction.set(visitorRef, {
        visitorId: id,
        date: day,
        createdAt: firestoreModule.serverTimestamp(),
      });
      transaction.set(
        summaryRef,
        summaryPayload(
          summary,
          {
            cumulativeVisits: counter(summary.cumulativeVisits) + 1,
            lastVisitDate: day,
            lastVisitorId: id,
          },
          firestoreModule,
        ),
      );
      transaction.set(dailyRef, {
        date: day,
        visits: counter(daily.visits) + 1,
        lastVisitorId: id,
        updatedAt: firestoreModule.serverTimestamp(),
      });
    });
  }

  async function registerUser(
    db,
    firestoreModule,
    userId,
    source = "login",
  ) {
    const summaryRef = firestoreModule.doc(
      db,
      METRICS_COLLECTION,
      METRICS_DOCUMENT,
    );
    const userRef = firestoreModule.doc(db, USER_COLLECTION, userId);

    await firestoreModule.runTransaction(db, async (transaction) => {
      const userSnapshot = await transaction.get(userRef);
      const summarySnapshot = await transaction.get(summaryRef);

      if (userSnapshot.exists() || !summarySnapshot.exists()) return;

      const summary = summarySnapshot.data() || {};
      transaction.set(userRef, {
        createdAt: firestoreModule.serverTimestamp(),
        source,
      });
      transaction.set(
        summaryRef,
        summaryPayload(
          summary,
          { userCount: counter(summary.userCount) + 1 },
          firestoreModule,
        ),
      );
    });
  }

  async function loadMetrics(db, firestoreModule, day, user) {
    const [summarySnapshot, dailySnapshot] = await Promise.all([
      firestoreModule.getDoc(
        firestoreModule.doc(db, METRICS_COLLECTION, METRICS_DOCUMENT),
      ),
      firestoreModule.getDoc(
        firestoreModule.doc(db, DAILY_COLLECTION, day),
      ),
    ]);
    renderMetrics(
      summarySnapshot.exists() ? summarySnapshot.data() || {} : {},
      dailySnapshot.exists() ? dailySnapshot.data() || {} : {},
      user,
    );
  }

  async function initialize() {
    if (!configured()) {
      renderMetrics();
      updateStatus("집계 기능을 연결하지 못했습니다.");
      return;
    }

    const day = dateKeyInKorea();
    const id = visitorId();
    let writeFailed = false;

    try {
      const [appModule, authModule, firestoreModule] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
      ]);
      const app = appModule.getApps().length
        ? appModule.getApp()
        : appModule.initializeApp(CONFIG.config);
      const auth = authModule.getAuth(app);
      const db = firestoreModule.getFirestore(app);

      try {
        await ensureDailyVisit(db, firestoreModule, day, id);
      } catch (error) {
        writeFailed = true;
        console.warn("사이트 접속 집계를 저장하지 못했습니다.", error);
      }

      const user = await firstAuthUser(auth, authModule);
      setOwnerVisibility(user);
      if (user) {
        try {
          await registerUser(db, firestoreModule, user.uid, "login");
          if (isOwner(user)) {
            await registerUser(
              db,
              firestoreModule,
              KNOWN_VIEWER_UID,
              "seeded",
            );
          }
        } catch (error) {
          writeFailed = true;
          console.warn("사이트 사용 인원을 저장하지 못했습니다.", error);
        }
      }

      await loadMetrics(db, firestoreModule, day, user);
      updateStatus(
        writeFailed
          ? "현재 수치를 표시하고 있습니다. 새 접속 반영은 잠시 지연될 수 있습니다."
          : "같은 기기에서는 하루에 한 번만 집계됩니다.",
      );
    } catch (error) {
      console.warn("사이트 이용 현황을 불러오지 못했습니다.", error);
      renderMetrics();
      updateStatus("이용 현황을 불러오지 못했습니다.");
    }
  }

  window.PokemonDexSiteMetrics = {
    dateKeyInKorea,
    headerMetricsVersion: HEADER_METRICS_VERSION,
  };

  initialize();
})();
