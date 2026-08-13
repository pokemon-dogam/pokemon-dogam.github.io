"use strict";

(function () {
  const AGE_CONFIRMATION_KEY = "pokemonDexAge14ConfirmedV1";
  const LOGIN_SELECTOR = "#firebase-login, #dashboard-login-cta";
  const SDK_VERSION = "12.16.0";
  const PROFILE_HREF = "./collector-settings.html";
  const CURRENT_METRICS_SCRIPT = "./site-metrics.js?v=20260813-2";

  function policyLinks(className = "login-policy-links") {
    const wrapper = document.createElement("span");
    wrapper.className = className;
    wrapper.setAttribute("aria-label", "로그인 이용 조건 및 정책");
    wrapper.innerHTML = `
      <span class="login-age-badge" title="Google 로그인은 만 14세 이상만 이용할 수 있습니다.">14+</span>
      <a href="./privacy.html">개인정보</a>
      <span aria-hidden="true">·</span>
      <a href="./terms.html">이용약관</a>
    `;
    return wrapper;
  }

  function decorateAuthPanel(panel) {
    if (!panel) return false;
    if (!panel.querySelector(".login-policy-links")) panel.append(policyLinks());
    document.body?.classList.add("has-universal-auth-panel");
    const chip = document.querySelector(".site-header .header-chip");
    if (chip) chip.hidden = true;
    return true;
  }

  function normalizeSidebarLabels() {
    document.querySelectorAll(".sidebar-label").forEach((label) => {
      if (label.textContent.trim().toUpperCase() === "MY COLLECTIONS") {
        label.textContent = "COLLECTIONS";
      }
    });
  }

  function ensureCurrentSiteMetrics() {
    if (!document.querySelector(".site-layout")) return;
    const alreadyLoaded = [...document.scripts].some((script) =>
      script.src.includes("site-metrics.js?v=20260813-2"),
    );
    if (alreadyLoaded) return;
    const script = document.createElement("script");
    script.src = CURRENT_METRICS_SCRIPT;
    script.defer = true;
    document.head.append(script);
  }

  function decorateDashboardLogin() {
    const note = document.querySelector("#dashboard-account-note > div");
    if (!note || note.querySelector(".dashboard-login-policy")) return;

    const policy = document.createElement("p");
    policy.className = "dashboard-login-policy";
    policy.append("로그인 기능은 만 14세 이상만 이용할 수 있습니다. ");
    policy.append(policyLinks("dashboard-policy-links"));
    note.append(policy);
  }

  function updateCopyrightYears() {
    const year = String(new Date().getFullYear());
    document.querySelectorAll("[data-current-year]").forEach((element) => {
      element.textContent = year;
    });
  }

  function ageConfirmed() {
    try {
      return window.sessionStorage.getItem(AGE_CONFIRMATION_KEY) === "yes";
    } catch (error) {
      return false;
    }
  }

  function rememberAgeConfirmation() {
    try {
      window.sessionStorage.setItem(AGE_CONFIRMATION_KEY, "yes");
    } catch (error) {
      // 세션 저장소를 사용할 수 없어도 현재 로그인 시도는 계속할 수 있습니다.
    }
  }

  function confirmLoginAge(event) {
    const loginButton = event.target.closest?.(LOGIN_SELECTOR);
    if (!loginButton || ageConfirmed()) return;

    const confirmed = window.confirm(
      "Google 로그인은 만 14세 이상만 이용할 수 있습니다.\n\n만 14세 이상이며 이용약관과 개인정보처리방침을 확인하셨나요?",
    );

    if (confirmed) {
      rememberAgeConfirmation();
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    window.alert("만 14세 미만은 Google 로그인과 건의 기능을 이용할 수 없습니다.");
  }

  function createUniversalPanel() {
    const header = document.querySelector(".site-header");
    if (!header) return null;
    const existing = document.querySelector("#firebase-auth-panel");
    if (existing) return existing;

    const panel = document.createElement("div");
    panel.id = "firebase-auth-panel";
    panel.className = "firebase-auth-panel universal-auth-panel";
    panel.dataset.universalAuth = "true";
    panel.innerHTML = `
      <span class="firebase-auth-dot" aria-hidden="true"></span>
      <a id="firebase-auth-status" href="${PROFILE_HREF}">로그인 상태 확인 중</a>
      <button id="firebase-login" type="button" hidden>Google 로그인</button>
      <button id="firebase-logout" type="button" hidden>로그아웃</button>
    `;
    header.append(panel);
    decorateAuthPanel(panel);
    return panel;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find((script) => script.src.includes(src));
      if (existing) {
        if (window.POKEMON_DEX_FIREBASE) resolve();
        else existing.addEventListener("load", resolve, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", reject, { once: true });
      document.head.append(script);
    });
  }

  async function ensureFirebaseConfig() {
    if (window.POKEMON_DEX_FIREBASE?.config?.projectId) {
      return window.POKEMON_DEX_FIREBASE;
    }
    await loadScript("firebase-config.js");
    return window.POKEMON_DEX_FIREBASE || {};
  }

  async function firstAuthUser(auth, authModule) {
    if (typeof auth.authStateReady === "function") {
      await auth.authStateReady();
      return auth.currentUser || null;
    }
    return new Promise((resolve, reject) => {
      let unsubscribe = () => {};
      unsubscribe = authModule.onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(user || null);
      }, reject);
    });
  }

  function updateUniversalPanel(panel, user, configured = true) {
    if (!panel?.dataset.universalAuth) return;
    const status = panel.querySelector("#firebase-auth-status");
    const login = panel.querySelector("#firebase-login");
    const logout = panel.querySelector("#firebase-logout");
    panel.classList.toggle("is-account", Boolean(user));
    status.href = PROFILE_HREF;
    status.classList.toggle("firebase-profile-link", Boolean(user));
    status.textContent = user ? "프로필설정" : configured ? "방문자" : "로그인 설정 확인 필요";
    if (user) status.setAttribute("aria-label", "프로필설정 · 내 프로필 관리 열기");
    else status.removeAttribute("aria-label");
    login.hidden = Boolean(user) || !configured;
    logout.hidden = !user;
  }

  async function initializeUniversalAuth() {
    const existing = document.querySelector("#firebase-auth-panel");
    if (existing && !existing.dataset.universalAuth) {
      decorateAuthPanel(existing);
      return;
    }

    const panel = existing || createUniversalPanel();
    if (!panel) return;

    try {
      const configRoot = await ensureFirebaseConfig();
      const config = configRoot.config || {};
      const configured = Boolean(
        configRoot.enabled && config.apiKey && config.authDomain && config.projectId,
      );
      if (!configured) {
        updateUniversalPanel(panel, null, false);
        return;
      }

      const [appModule, authModule] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
      ]);
      const app = appModule.getApps().length
        ? appModule.getApp()
        : appModule.initializeApp(config);
      const auth = authModule.getAuth(app);
      const user = await firstAuthUser(auth, authModule);
      updateUniversalPanel(panel, user, true);

      panel.querySelector("#firebase-login")?.addEventListener("click", async () => {
        const provider = new authModule.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        try {
          await authModule.signInWithPopup(auth, provider);
          window.location.reload();
        } catch (error) {
          if (error.code !== "auth/popup-closed-by-user") {
            window.alert(`Google 로그인에 실패했습니다.\n${error.message || ""}`);
          }
        }
      });
      panel.querySelector("#firebase-logout")?.addEventListener("click", async () => {
        await authModule.signOut(auth);
        window.location.reload();
      });
    } catch (error) {
      console.warn("공통 로그인 상태를 확인하지 못했습니다.", error);
      updateUniversalPanel(panel, null, false);
    }
  }

  function initialize() {
    updateCopyrightYears();
    normalizeSidebarLabels();
    ensureCurrentSiteMetrics();
    decorateDashboardLogin();
    void initializeUniversalAuth();

    if (decorateAuthPanel(document.querySelector("#firebase-auth-panel"))) return;

    const authObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          const panel = node.matches?.("#firebase-auth-panel")
            ? node
            : node.querySelector?.("#firebase-auth-panel");
          if (!decorateAuthPanel(panel)) continue;
          authObserver.disconnect();
          return;
        }
      }
    });
    authObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  document.addEventListener("click", confirmLoginAge, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
