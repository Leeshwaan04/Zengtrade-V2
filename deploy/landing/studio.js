/* zengtrade Studio shim — makes the REAL terminal safe as the customer product.
 *
 * Loaded BEFORE app.js in the deployed /dashboard copy only (build.py injects it;
 * the operator's local terminal never loads this file). Three jobs:
 *   1. Auth guard: no Supabase session on this origin -> /login.
 *   2. Data: the terminal's local-engine calls (localhost:8756 or /api/*) are
 *      served from published read-only snapshots under /dashboard/data/.
 *      Writes (deploy/harness/relogin/arm) are refused politely - per-account
 *      deploys land next, wired to Supabase.
 *   3. Cockpit trim: operator-only controls hidden; crypto book is the default
 *      and the Indian toggle is hidden (customers get NSE via their own broker
 *      connection later - never via the operator's data license).
 * Live crypto prices stay genuinely live: Binance public REST/WS run in the
 * customer's own browser, allowed by CSP.
 */
(function () {
  "use strict";

  /* ---- 1. auth guard (session written by /login via supabase-js) ---- */
  var authed = false;
  try {
    var raw = localStorage.getItem("sb-ponvarxeytfcntckczbn-auth-token");
    if (raw) {
      var s = JSON.parse(raw);
      var exp = (s && (s.expires_at || (s.session && s.session.expires_at))) || 0;
      authed = exp * 1000 > Date.now();
    }
  } catch (e) { authed = false; }
  if (!authed) { location.replace("/login"); return; }

  /* ---- 2a. first-run: land every customer in the Algo Studio, crypto book ---- */
  try {
    var K = "tradepro.terminal.v1";
    if (!localStorage.getItem(K)) {
      localStorage.setItem(K, JSON.stringify({ persona: "algo", algo: { market: "crypto", view: "monitor" } }));
    } else {
      var st = JSON.parse(localStorage.getItem(K) || "{}");
      st.algo = st.algo || {};
      if (st.algo.market !== "crypto") { st.algo.market = "crypto"; localStorage.setItem(K, JSON.stringify(st)); }
    }
  } catch (e) {}

  /* ---- 2b. fetch shim: engine endpoints -> /dashboard/data snapshots ---- */
  var ORIG = window.fetch.bind(window);
  function isEngine(u) {
    return u.indexOf("/api/") === 0 ||
           u.indexOf("http://localhost:8756") === 0 ||
           u.indexOf("http://127.0.0.1:8756") === 0;
  }
  window.fetch = function (input, init) {
    var u = typeof input === "string" ? input : (input && input.url) || "";
    if (!isEngine(u)) return ORIG(input, init);
    var method = ((init && init.method) || "GET").toUpperCase();
    if (method !== "GET") {
      return Promise.resolve(new Response(
        JSON.stringify({ ok: false, error: "Studio preview is read-only. Per-account deploys are coming next." }),
        { status: 403, headers: { "Content-Type": "application/json" } }));
    }
    var path = u.replace(/^https?:\/\/[^/]+/, "").split("?")[0].replace(/^\//, "");
    var file = "/dashboard/data/" + path.replace(/\//g, "_") + ".json";
    return ORIG(file).then(function (r) {
      if (r.ok) return r;
      return new Response("{}", { status: 404, headers: { "Content-Type": "application/json" } });
    });
  };

  /* ---- 2c. SSE stream -> inert (terminal falls back to its polling path) ---- */
  var RealES = window.EventSource;
  if (RealES) {
    window.EventSource = function (url, cfg) {
      if (String(url).indexOf("/api/stream") !== -1) {
        return { readyState: 2, url: String(url), withCredentials: false,
                 close: function () {}, addEventListener: function () {},
                 removeEventListener: function () {}, dispatchEvent: function () { return false; },
                 onopen: null, onmessage: null, onerror: null };
      }
      return new RealES(url, cfg);
    };
    window.EventSource.prototype = RealES.prototype;
  }

  /* ---- 3. hide operator-only controls (they act on the operator's Mac/broker) ---- */
  var css = [
    ".funds-chip", "[data-relogin]", ".mkt-relogin", ".pf-relogin", ".bot-relogin",
    ".ais-relogin", "[data-harness]", "#glGo", "[data-stopall]", '[data-algomkt="in"]',
    ".mkt-live", ".mkt-dot", ".he-stat.off", ".tix-offline"   // Kite/engine offline chrome
  ].join(",") + "{display:none !important}";
  function inject() {
    var st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", inject);
  else inject();

  /* ---- 4. force the crypto book after boot (customers get NSE via their own
   *        broker later; clicking the real toggle runs the full setMarket path:
   *        live Binance tape + WS + Studio re-scope). Retries because the header
   *        renders asynchronously during boot. ---- */
  function forceCrypto(tries) {
    var b = document.querySelector('[data-algomkt="crypto"]');
    if (b && !b.classList.contains("on")) b.click();
    else if (!b && tries > 0) setTimeout(function () { forceCrypto(tries - 1); }, 700);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", function () { setTimeout(function () { forceCrypto(6); }, 700); });
  else setTimeout(function () { forceCrypto(6); }, 700);
})();
