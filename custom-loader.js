"use strict";

(function () {
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const publicRequested = /^[a-z0-9]{12}$/.test(params.get("collector") || "");
  const sharedRequested = /^[A-Za-z0-9_-]{32}$/.test(hash.get("share") || "");
  window.CustomDexPublicViewRequested = publicRequested || sharedRequested;

  function load(src, onload) {
    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    if (onload) script.addEventListener("load", onload, { once: true });
    document.head.append(script);
  }

  if (window.CustomDexPublicViewRequested) {
    load("./custom-public.js?v=20260813-1");
    return;
  }

  load("./custom.js?v=20260813-2", () => {
    load("./custom-sync.js?v=20260813-1");
  });
})();
