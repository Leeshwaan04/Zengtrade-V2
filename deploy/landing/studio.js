/* zengtrade Studio shim v2: the REAL terminal as a MULTI-USER crypto product.
 *
 * Loaded BEFORE app.js in the deployed /dashboard copy only (build.py injects it;
 * the operator's local terminal never loads this file).
 *
 * Data plane (crypto-global, no operator-Mac dependency in steady state):
 *   shared  : engine_state table in Supabase (regime, catalog, metrics), 
 *             published server-side, read by every client (RLS: public read).
 *             Falls back to /dashboard/data/*.json static seeds if a key is missing.
 *   per-user: deployment / book_state / trade rows under RLS, each customer
 *             sees exactly their own book, overlaid onto the shared payloads.
 *   writes  : Deploy/Pause/Stop buttons upsert the user's own deployment rows;
 *             the 24/7 worker picks them up next cycle. Live mode stays locked.
 *   prices  : Binance public REST/WS run directly in the customer's browser.
 */
(function () {
  "use strict";

  /* OAuth callbacks must land on /login so Supabase can exchange ?code= before session checks. */
  if (/[?&]code=/.test(location.search) || /access_token=/.test(location.hash)) {
    location.replace("/login" + location.search + location.hash);
    return;
  }

  var SUPA = "https://ponvarxeytfcntckczbn.supabase.co";
  var ANON = "sb_publishable_w-pQMK0bj-91EPHXtA0sMQ__CTu_rf1";

  function trackPageview() {
    try {
      fetch(SUPA + "/rest/v1/event", {
        method: "POST",
        headers: { apikey: ANON, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          name: "pageview",
          path: ("/dashboard" + location.hash).slice(0, 290),
          ref: (document.referrer || "").slice(0, 290),
        }),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }
  var LS_AUTH = "sb-ponvarxeytfcntckczbn-auth-token";

  /* strategy_keys the cloud worker can actually run (mirror of worker REGISTRY).
   * Everything else in the catalog is research/other-venue: visible, not deployable. */
  var DEPLOYABLE = {};
  ["trend_follow","momo","momentum","bollinger","rsi2","macross","ema_cross","adx_trend",
   "zscore","nr7","orb","vwap_rev","vwap_mom","ema_scalp","bb_breakout","supertrend",
   "vwap_pull","rsi_intraday"].forEach(function (k) { DEPLOYABLE[k] = 1; });

  /* ---- session ---- */
  function session() {
    try {
      var s = JSON.parse(localStorage.getItem(LS_AUTH) || "null");
      if (!s) return null;
      var exp = s.expires_at || (s.session && s.session.expires_at) || 0;
      if (exp * 1000 <= Date.now()) return null;
      var tok = s.access_token || (s.session && s.session.access_token);
      var uid = (s.user && s.user.id) || (s.session && s.session.user && s.session.user.id);
      return tok && uid ? { tok: tok, uid: uid } : null;
    } catch (e) { return null; }
  }
  var sess = session();
  if (!sess) { location.replace("/login"); return; }
  trackPageview();

  function sbHeaders(extra) {
    var h = { apikey: ANON, Authorization: "Bearer " + (session() || {}).tok,
              "Content-Type": "application/json" };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }
  function jresp(obj, code) {
    return new Response(JSON.stringify(obj),
      { status: code || 200, headers: { "Content-Type": "application/json" } });
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---- toasts: reuse the terminal's own #toastWrap/.toast component (same one every other
   * tab's confirmations use) instead of a bespoke floating card. Fixes two real bugs the ad hoc
   * version had: (1) it rendered at document.body scale with up to 4 action links, so on shorter
   * viewports it grew tall enough to cover the very form it was nudging the user to fill in;
   * (2) it looked and behaved differently from every other notification in the product. */
  function ztToast(o) {
    var host = document.getElementById("toastWrap");
    if (!host || (o.uniqueClass && host.querySelector("." + o.uniqueClass))) return null;
    var t = document.createElement("div");
    t.className = "toast" + (o.uniqueClass ? " " + o.uniqueClass : "");
    t.setAttribute("role", "status");
    var icoFn = typeof window.icon === "function" ? window.icon : function () { return ""; };
    var acts = (o.actions || []).map(function (a) {
      return '<button type="button" class="tbtn ' + a.cls + '" data-zt-act="' + a.key + '">' + esc(a.label) + "</button>";
    }).join("");
    t.innerHTML = '<div class="toast-ico">' + icoFn(o.icon, 22) + '</div>' +
      '<div class="toast-body"><b>' + esc(o.title) + "</b><span>" + o.body + "</span></div>" +
      '<div class="toast-acts">' + acts + "</div>";
    host.appendChild(t);
    function dismissToast() {
      if (typeof window.dismiss === "function") { window.dismiss(t); return; }
      t.classList.add("out");
      setTimeout(function () { t.remove(); }, 300);
    }
    (o.actions || []).forEach(function (a) {
      var btn = t.querySelector('[data-zt-act="' + a.key + '"]');
      if (btn) btn.onclick = function () { if (a.onClick) a.onClick(); dismissToast(); };
    });
    t._ztDismiss = dismissToast;
    if (o.timeout) t._timer = setTimeout(function () { if (document.body.contains(t)) dismissToast(); }, o.timeout);
    return t;
  }

  function trackEvent(name) {
    try {
      ORIG(SUPA + "/rest/v1/event", {
        method: "POST",
        headers: sbHeaders({ Prefer: "return=minimal" }),
        body: JSON.stringify({ name: name, path: location.pathname.slice(0, 290) }),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }

  /* GA4 (zengtrade, web stream 15728393601): not an ES module here, so a plain defensive
   * wrapper around window.gtag rather than importing js/ga.js. Fires alongside every
   * trackEvent() call, a second destination, not a replacement for the Supabase funnel. */
  function gaEvent(name, params) {
    try {
      if (typeof window.gtag === "function") window.gtag("event", name, params || {});
    } catch (e) {}
  }

  function showForwardHint() {
    try {
      if (localStorage.getItem("zt_seen_forward")) return;
      localStorage.setItem("zt_seen_forward", "1");
    } catch (e) { return; }
    function renderHint(workerUp) {
      setTimeout(function () {
        var sub = workerUp
          ? "Trades appear in Evidence as the worker runs on live prices (usually within 15 min)."
          : "Deploy saved. Trades will run when the paper worker is back online. Check the banner above.";
        /* the toast itself stays a clean 2-button confirmation (matching every other toast in the
         * app); this inline link is a secondary funnel touchpoint, not a 3rd action button, kept
         * as a small text link (.mon-acc-link, same class the Monitor row's own inline link uses)
         * so it doesn't compete visually with "View evidence". */
        var coinsLink = ' <a class="mon-acc-link" href="/coins/?utm_source=site&amp;utm_medium=organic&amp;utm_campaign=deploy_success_coins">More coin strategies</a>';
        ztToast({
          uniqueClass: "zt-forward-toast",
          icon: "check",
          title: "Strategy deployed",
          body: sub + coinsLink,
          timeout: 9000,
          actions: [
            { key: "view", cls: "primary", label: "View evidence", onClick: function () { location.href = "/app#forward"; } },
            { key: "ok", cls: "ghost", label: "Dismiss" },
          ],
        });
      }, 800);
    }
    ORIG(SUPA + "/rest/v1/engine_state?key=eq._worker_heartbeat&select=updated_at", {
      headers: sbHeaders(),
    }).then(function (r) { return r.json(); }).then(function (rows) {
      var ts = rows && rows[0] && rows[0].updated_at;
      var up = ts && (Date.now() - new Date(ts).getTime() <= 12 * 60 * 1000);
      renderHint(!!up);
    }).catch(function () { renderHint(false); });
  }

  var FREE_DEPLOY_LIMIT = 1;

  function markCheckoutRef(ref) {
    try {
      sessionStorage.setItem("zt_checkout_ref", ref);
      localStorage.setItem("zt_checkout_ref", ref);
    } catch (e) {}
  }
  function goUpgradeFromFreeLimit() {
    markCheckoutRef("free_limit_upgrade");
    location.href = "/app#pricing";
  }

  function maybeWorkerBanner() {
    ORIG(SUPA + "/rest/v1/engine_state?key=eq._worker_heartbeat&select=updated_at", {
      headers: sbHeaders(),
    }).then(function (r) { return r.json(); }).then(function (rows) {
      var ts = rows && rows[0] && rows[0].updated_at;
      if (!ts) return showWorkerDown();
      var age = Date.now() - new Date(ts).getTime();
      if (age > 12 * 60 * 1000) showWorkerDown();
    }).catch(function () {});
  }
  function showWorkerDown() {
    if (document.getElementById("ztWorkerDown")) return;
    var el = document.createElement("div");
    el.id = "ztWorkerDown";
    el.className = "zt-banner-warn";
    el.setAttribute("role", "status");
    el.innerHTML = "Paper worker offline: deploys save, but trades pause until the worker restarts. " +
      '<a href="/app#forward">View evidence</a> · ' +
      '<a href="/ops/worker">Worker status</a> · ' +
      '<a href="/ops/e2e">E2E status</a> · ' +
      '<a href="/how-it-works/">How paper trading works</a>';
    /* in-flow, not fixed: every other system banner in the terminal (rdy-banner, bot-banner,
     * rg-banner) sits in the page instead of floating over it. A fixed top bar here used to
     * render on top of the sticky .topbar (position:sticky;top:0;z-index:50) on every tab. */
    document.body.insertBefore(el, document.body.firstChild);
  }

  /* ---- customers live in the Algo Studio: persona pinned, crypto book pinned ---- */
  try {
    var K = "tradepro.terminal.v1";
    var st0 = JSON.parse(localStorage.getItem(K) || "null") || {};
    st0.persona = "algo";                    // Trading/Investing/AI personas are operator surfaces
    st0.algo = st0.algo || {}; st0.algo.market = "crypto"; st0.algo.view = st0.algo.view || "monitor";
    localStorage.setItem(K, JSON.stringify(st0));
  } catch (e) {}

  var ORIG = window.fetch.bind(window);

  // BUG FIX (2026-09-06): this used to be called right after its definition, BEFORE the
  // `var ORIG = ...` line below: ORIG was still undefined at that point (var hoisting only
  // hoists the declaration, not the assignment), so maybeWorkerBanner() threw "ORIG is not a
  // function" on every single /dashboard/ page load. That uncaught error silently skipped this
  // call, meaning the "paper worker is offline" banner never showed even while the worker was
  // genuinely down. Now it only runs once ORIG actually holds the native fetch.
  maybeWorkerBanner();

  /* ---- shared payloads: engine_state row, else static seed ---- */
  function engineGet(fileKey) {
    return ORIG(SUPA + "/rest/v1/engine_state?key=eq." + fileKey + "&select=value",
                { headers: sbHeaders() })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        if (rows && rows.length) return rows[0].value;
        return ORIG("/dashboard/data/" + fileKey + ".json")
          .then(function (r) { return r.ok ? r.json() : {}; });
      })
      .catch(function () { return {}; });
  }

  /* ---- per-user rows (RLS scopes automatically to the JWT's user) ---- */
  function mine(pathq) {
    return ORIG(SUPA + "/rest/v1/" + pathq, { headers: sbHeaders() })
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; });
  }

  /* ---- overlay: shared crypto monitor + THIS user's deployments/book ---- */
  function posList(b) {
    var pos = (b && b.positions) || {};
    return Object.keys(pos).map(function (sym) {
      var p = pos[sym] || {};
      return { sym: sym, qty: p.qty, entry: p.entry };
    });
  }
  function cryptoMonitor() {
    return Promise.all([
      engineGet("api_crypto_monitor"),
      mine("deployment?select=strategy_key,status,params&mode=eq.paper"),
      mine("book_state?select=strategy_key,realised,positions"),
    ]).then(function (all) {
      var shared = all[0] || {}, deps = all[1] || [], books = all[2] || [];
      var running = {}, book = {};
      deps.forEach(function (d) { if (d.status === "running") running[d.strategy_key] = 1; });
      books.forEach(function (b) { book[b.strategy_key] = b; });
      var out = JSON.parse(JSON.stringify(shared));
      var totalReal = 0, totalOpen = 0;
      (out.strategies || []).forEach(function (s) {
        var b = book[s.id];
        var pl = posList(b);
        s.realisedPnl = b ? Number(b.realised || 0) : 0;
        s.openPnl = 0;                       // client marks-to-market later; honest zero for now
        s.paperPnl = s.realisedPnl;
        s.positions = pl;
        s.openPositions = pl.length;
        s.deployed = !!running[s.id];
        s.wired = !!DEPLOYABLE[s.id];        // only worker-runnable strategies are deployable
        totalReal += s.realisedPnl; totalOpen += pl.length;
      });
      /* NOTE: custom (Builder) strategies are NOT injected into the Monitor here.
       * The terminal renders Monitor rows from its fixed CRYPTO_STRATEGIES catalog and
       * ignores unknown ids, so a pushed custom row would never render yet WOULD skew
       * the header totals. Custom strategies live fully in the Builder tab (deploy,
       * status, per-strategy P&L). Their realised P&L is intentionally excluded from
       * the built-in Monitor totals to keep rows and totals consistent. */
      out.totals = { realised: +totalReal.toFixed(4), unreal: 0,
                     pnl: +totalReal.toFixed(4), open: totalOpen };
      /* the customer's "harness" is the cloud worker, and it is ALWAYS running -
       * never show the operator's "start python3 ..." empty state to a customer */
      out.running = true;
      out.perUser = true;
      return out;
    });
  }

  /* ---- deploy / pause / stop -> the user's own deployment rows ---- */
  function strategyPost(body) {
    var id = body.id, want = body.state;
    var s = session();
    if (!s) { location.replace("/login"); return Promise.resolve(jresp({ error: "signed out" }, 401)); }
    if (want === "live")
      return Promise.resolve(jresp({ locked: true, reason: "Live trading unlocks after your paper track record clears the gate." }));
    if (!DEPLOYABLE[id] && id.indexOf("custom_") !== 0)
      return Promise.resolve(jresp({ error: "This strategy needs a venue not yet enabled for customer accounts (perps/options/pairs land later)." }));
    if (want === "paper") {
      return ORIG(SUPA + "/rest/v1/deployment?on_conflict=user_id,strategy_key", {
        method: "POST",
        headers: sbHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify({ user_id: s.uid, strategy_key: id, mode: "paper", status: "running" }),
      }).then(function (r) {
        if (r.ok) {
          trackEvent("deploy_click");
          trackEvent("deploy_success");
          gaEvent("deploy_click", { strategy: id });
          gaEvent("deploy_success", { strategy: id });
          showForwardHint();
          return jresp({ ok: true, id: id, state: "paper" });
        }
        return r.json().then(function (e) {
          var msg = (e && (e.message || e.details || e.hint)) || "Deploy failed - try again.";
          if (/FREE_LIMIT/i.test(msg)) {
            setTimeout(goUpgradeFromFreeLimit, 900);
            return jresp({
              error: "Free includes " + FREE_DEPLOY_LIMIT + " paper strategy. Upgrade to Pro for unlimited.",
              upgrade: "/app#pricing",
              upgrade_ref: "free_limit_upgrade",
            });
          }
          return jresp({ error: msg });
        }).catch(function () { return jresp({ error: "Deploy failed - try again." }); });
      });
    }
    /* pause / stop -> stopped (worker only distinguishes running/stopped) */
    return ORIG(SUPA + "/rest/v1/deployment?strategy_key=eq." + encodeURIComponent(id), {
      method: "PATCH",
      headers: sbHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify({ status: "stopped" }),
    }).then(function (r) {
      return jresp(r.ok ? { ok: true, id: id, state: want } : { error: "Update failed - try again." });
    });
  }

  /* ---- the fetch shim ---- */
  function isEngine(u) {
    return u.indexOf("/api/") === 0 ||
           u.indexOf("http://localhost:8756") === 0 ||
           u.indexOf("http://127.0.0.1:8756") === 0;
  }
  window.fetch = function (input, init) {
    var u = typeof input === "string" ? input : (input && input.url) || "";
    if (!isEngine(u)) return ORIG(input, init);
    var method = ((init && init.method) || "GET").toUpperCase();
    var path = u.replace(/^https?:\/\/[^/]+/, "").split("?")[0].replace(/^\//, "");
    var fileKey = path.replace(/\//g, "_");

    if (method === "POST" && path === "api/strategy") {
      var body = {};
      try { body = JSON.parse((init && init.body) || "{}"); } catch (e) {}
      return strategyPost(body);
    }
    if (method !== "GET")
      return Promise.resolve(jresp({ ok: false, error: "Not available in the customer Studio." }, 403));
    if (fileKey === "api_crypto_monitor")
      return cryptoMonitor().then(function (payload) { return jresp(payload); });
    return engineGet(fileKey).then(function (payload) { return jresp(payload); });
  };

  /* ---- SSE stream -> inert (terminal falls back to its polling path) ---- */
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

  /* ---- hide operator-only controls (they act on the operator's Mac/broker) ---- */
  var css = [
    ".funds-chip", "[data-relogin]", ".mkt-relogin", ".pf-relogin", ".bot-relogin",
    ".ais-relogin", "[data-harness]", "#glGo", "[data-stopall]", '[data-algomkt="in"]',
    ".mkt-live", ".mkt-dot", ".he-stat.off", ".tix-offline",
    "#modeFab", "#personaGate"               // persona switcher removed: the Studio IS the product
  ].join(",") + "{display:none !important}" +
    /* worker-down banner: same warn tokens as every other caution note in the terminal
     * (.note-warn, .rdy-banner.no), just in the page flow instead of floating over it. */
    ".zt-banner-warn{padding:8px 14px;text-align:center;font:600 12.5px/1.4 var(--sans);" +
    "background:var(--tint-warn);color:var(--amber);border-bottom:1px solid var(--bd-warn)}" +
    ".zt-banner-warn a{color:inherit;font-weight:700;text-decoration:none;margin:0 2px}" +
    ".zt-banner-warn a:hover{text-decoration:underline}";
  function nudgeDeployIfCold() {
    var delay = 5000;
    try { if (localStorage.getItem("zt_fresh_signup")) { delay = 800; localStorage.removeItem("zt_fresh_signup"); } } catch (e) {}
    setTimeout(function () {
      mine("deployment?select=strategy_key&status=eq.running&limit=1").then(function (rows) {
        if (rows && rows.length) return;
        /* the CTA below is "Open Library", showing it to someone already composing a custom
         * strategy in Builder is exactly the noisy, badly-timed nudge this used to be. */
        if (document.querySelector(".ztb")) return;
        ztToast({
          uniqueClass: "zt-cold-nudge",
          icon: "send",
          title: "Deploy your first strategy",
          body: "Paper-trade on live Binance prices: it takes under a minute, zero risk.",
          timeout: 9000,
          actions: [
            { key: "lib", cls: "primary", label: "Open Library", onClick: function () {
                var lib = document.querySelector('[data-algoview="library"]');
                if (lib) lib.click();
              } },
            { key: "later", cls: "ghost", label: "Not now" },
          ],
        });
      });
    }, delay);
  }
  function inject() {
    var st = document.createElement("style");
    st.textContent = css + ZTB_CSS;
    document.head.appendChild(st);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", inject);
  else inject();
  nudgeDeployIfCold();

  function injectAppLink() {
    var spacer = document.querySelector(".topbar .tb-spacer");
    if (!spacer || document.getElementById("zt-app-link")) return;
    var a = document.createElement("a");
    a.id = "zt-app-link";
    a.href = "/app";
    a.title = "Forward test, accuracy, activity, and Pro billing";
    a.textContent = "Evidence & billing";
    a.style.cssText = "font:600 12.5px/1 var(--sans,system-ui);color:var(--slate,#64748b);" +
      "text-decoration:none;padding:6px 10px;border:1px solid var(--line,#e2e8f0);border-radius:8px;" +
      "white-space:nowrap;margin-right:8px";
    a.onmouseover = function () { a.style.color = "var(--navy,#101e36)"; };
    a.onmouseout = function () { a.style.color = "var(--slate,#64748b)"; };
    spacer.parentNode.insertBefore(a, spacer);
  }
  function injectStudioBlurb() {
    if (document.getElementById("zt-studio-blurb")) return;
    var bar = document.querySelector(".topbar");
    if (!bar) return;
    var p = document.createElement("p");
    p.id = "zt-studio-blurb";
    p.textContent = "Algo Studio: deploy paper strategies here. Evidence & billing live in /app.";
    p.style.cssText = "margin:0;padding:8px 16px 10px;font:500 12.5px/1.45 var(--sans,system-ui);" +
      "color:var(--slate,#64748b);background:var(--bg,#f8fafc);border-bottom:1px solid var(--line,#e2e8f0)";
    bar.parentNode.insertBefore(p, bar.nextSibling);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(function () { injectAppLink(); injectStudioBlurb(); }, 1200);
    });
  else setTimeout(function () { injectAppLink(); injectStudioBlurb(); }, 1200);

  /* ---- force the crypto book after boot (full setMarket path: live tape + WS) ---- */
  function forceCrypto(tries) {
    var b = document.querySelector('[data-algomkt="crypto"]');
    if (b && !b.classList.contains("on")) b.click();
    else if (!b && tries > 0) setTimeout(function () { forceCrypto(tries - 1); }, 700);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", function () { setTimeout(function () { forceCrypto(6); }, 700); });
  else setTimeout(function () { forceCrypto(6); }, 700);

  /* ================= Strategy Builder tab =================
   * Injected into the Algo Studio tab bar, rendered with the terminal's own
   * component classes (.av-tab, .flow-*, .sel, .seg, .btn-primary) so it is
   * visually indistinguishable from a built-in tab. Users compose the SIGNALS;
   * the engine keeps the RAILS (ATR stops, cost gate, cooldown, profit lock). */
  /* label = dropdown text · p1/p2 = param labels · value:true shows the free value
   * field (vlbl = its label, def = sensible default applied when switching signal) */
  var IND_META = {
    rsi:             { label: "RSI (oversold / overbought)",       p1: "Period",     value: true, vlbl: "Level 0-100", def: 30 },
    stoch:           { label: "Stochastic %K (turn timing)",       p1: "Period",     value: true, vlbl: "Level 0-100", def: 20 },
    zscore:          { label: "Z-score (stretch from mean)",       p1: "Lookback",   value: true, vlbl: "Std devs",    def: -2 },
    dist_sma:        { label: "% distance from average",           p1: "SMA period", value: true, vlbl: "Percent",     def: -5 },
    roc:             { label: "Momentum % (rate of change)",       p1: "Bars",       value: true, vlbl: "Percent",     def: 5 },
    price_vs_sma:    { label: "Price vs SMA",                      p1: "SMA period" },
    price_vs_ema:    { label: "Price vs EMA",                      p1: "EMA period" },
    sma_cross:       { label: "SMA cross (fast vs slow)",          p1: "Fast", p2: "Slow" },
    ema_cross:       { label: "EMA cross (fast vs slow)",          p1: "Fast", p2: "Slow" },
    macd_cross:      { label: "MACD vs signal line",               p1: "Fast", p2: "Slow" },
    bollinger_touch: { label: "Bollinger band touch",              p1: "Period",     value: true, vlbl: "Std devs",    def: 2 },
    breakout:        { label: "N-bar breakout (Donchian)",         p1: "Lookback" },
    vol_spike:       { label: "Volume spike (× average)",          p1: "Avg window", value: true, vlbl: "× average",   def: 2 },
  };
  var COINS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT"];

  function slug(name) {
    return "custom_" + String(name || "my_strategy").toLowerCase()
      .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);
  }

  /* Layout scaffolding only below, every actual control (inputs, selects, segmented toggles,
   * pill chips, buttons, notes, errors) is drawn with the terminal's own component classes
   * (.flow-input, .seg/.seg-btn, .preset, .type-pill, .flow-note, .flow-err, .btn-ghost, .num)
   * so Builder looks and behaves like a tab the rest of the app actually shipped, not a bolt-on.
   * The few *-ztb classes that remain have no existing counterpart: they only place things on
   * the page (grid/row/card shells), they don't reskin anything the app already themes. */
  var ZTB_CSS =
    ".ztb{max-width:880px;margin:0 auto;display:flex;flex-direction:column;gap:14px;padding:4px 2px 26px;font-size:13.5px}" +
    ".ztb-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:14px 16px;box-shadow:var(--shadow)}" +
    ".ztb-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}" +
    ".ztb-head b{font-size:15.5px;color:var(--navy)}" +
    ".ztb-head p{margin:2px 0 0;color:var(--slate);font-size:12.5px}" +
    ".ztb-badge{font-size:10.5px;font-weight:800;letter-spacing:.06em;color:var(--green-d);background:var(--up-flash);border-radius:99px;padding:4px 11px;white-space:nowrap}" +
    ".ztb-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:16px 26px}" +
    "@media(max-width:760px){.ztb-grid{grid-template-columns:1fr}}" +
    ".ztb-lbl{display:block;font-size:10.5px;font-weight:700;letter-spacing:.08em;color:var(--slate);text-transform:uppercase;margin:0 0 6px}" +
    /* coin toggles: same soft-accent "on" treatment as the Library's holding-style pills
     * (.lib-hold-tab), so a selected chip means the same thing on every tab. */
    ".ztb-chips{display:flex;gap:8px;flex-wrap:wrap}" +
    ".ztb-chip{display:inline-flex;align-items:center;border:1px solid var(--line);background:var(--surface-2);border-radius:999px;padding:6px 13px;font:inherit;font-size:12.5px;font-weight:700;color:var(--slate);cursor:pointer;transition:.15s}" +
    ".ztb-chip:hover{border-color:var(--green);color:var(--navy)}" +
    ".ztb-chip.on{background:var(--accent-soft);border-color:var(--accent-line);color:var(--green-d)}" +
    ".ztb-chip:focus-visible{outline:none;box-shadow:var(--ring)}" +
    ".ztb-presets{display:flex;gap:8px;flex-wrap:wrap;align-items:center;color:var(--slate);font-size:12px;font-weight:600}" +
    ".ztb-rules{display:grid;grid-template-columns:1fr 1fr;gap:14px}" +
    "@media(max-width:860px){.ztb-rules{grid-template-columns:1fr}}" +
    ".ztb-rule{border-left:3px solid var(--green)}" +
    ".ztb-rule[data-side=exit]{border-left-color:var(--amber)}" +
    ".ztb-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:2px}" +
    ".ztb-f{flex:1 1 86px;min-width:86px}" +
    ".ztb-f.sig{flex:2 1 100%}" +
    ".ztb-sent{margin-top:11px;font-size:12.5px;color:var(--slate);background:var(--surface-2);border-radius:8px;padding:8px 11px;line-height:1.5}" +
    ".ztb-sent b{color:var(--navy)}" +
    /* Deploy is the page's one primary action, sized up from the standard .btn-primary the way
     * a form's submit button reasonably is elsewhere in the app, but on the same --accent
     * token, so it still tracks the regime color like every other primary CTA instead of a
     * hardcoded green that drifts from the rest of the UI the moment the regime isn't bull. */
    ".ztb-deploy{background:var(--accent);color:#fff;border:0;border-radius:11px;font:inherit;font-weight:800;font-size:14px;padding:12px 24px;cursor:pointer;box-shadow:var(--shadow);transition:.15s;align-self:flex-start}" +
    ".ztb-deploy:hover{background:var(--accent-d);box-shadow:var(--shadow-hover)}" +
    ".ztb-item{display:flex;align-items:center;gap:12px;padding:11px 2px;border-top:1px solid var(--line)}" +
    ".ztb-item:first-of-type{border-top:0}" +
    ".ztb-item .nm{font-weight:700;color:var(--navy)}" +
    ".ztb-item .stt{font-size:11px;color:var(--slate)}" +
    ".ztb-item .num{margin-left:auto;font-weight:800}";

  var PRESETS = {
    dip:   { name: "RSI dip buyer",      style: "reversion", ivl: "day", coins: ["BTCUSDT", "ETHUSDT"],
             entry: { ind: "rsi", p1: 14, p2: 50, op: "<", value: 30 },  exit: { ind: "rsi", p1: 14, p2: 50, op: ">", value: 55 } },
    cross: { name: "Golden cross rider", style: "trend",     ivl: "day", coins: ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
             entry: { ind: "ema_cross", p1: 12, p2: 26, op: ">", value: 0 }, exit: { ind: "ema_cross", p1: 12, p2: 26, op: "<", value: 0 } },
    snap:  { name: "Stretch snap-back",  style: "reversion", ivl: "day", coins: ["BTCUSDT", "ETHUSDT"],
             entry: { ind: "zscore", p1: 20, p2: 50, op: "<", value: -2 }, exit: { ind: "zscore", p1: 20, p2: 50, op: ">", value: 0 } },
  };

  function describe(c) {
    var dir = c.op === "<" ? "drops below" : "rises above";
    var rel = c.op === "<" ? "below" : "above";
    switch (c.ind) {
      case "rsi":             return "RSI(" + c.p1 + ") " + dir + " <b>" + c.value + "</b>";
      case "stoch":           return "Stochastic %K(" + c.p1 + ") " + dir + " <b>" + c.value + "</b>";
      case "zscore":          return "Z-score(" + c.p1 + ") " + dir + " <b>" + c.value + "</b>";
      case "dist_sma":        return "price stretches " + (c.op === "<" ? "more than <b>" + Math.abs(c.value) + "% below</b>" : "more than <b>" + c.value + "% above</b>") + " its " + c.p1 + "-bar average";
      case "roc":             return c.p1 + "-bar momentum " + dir + " <b>" + c.value + "%</b>";
      case "price_vs_sma":    return "price is " + rel + " its <b>" + c.p1 + "-bar SMA</b>";
      case "price_vs_ema":    return "price is " + rel + " its <b>" + c.p1 + "-bar EMA</b>";
      case "sma_cross":       return "SMA(" + c.p1 + ") is " + rel + " <b>SMA(" + c.p2 + ")</b>";
      case "ema_cross":       return "EMA(" + c.p1 + ") is " + rel + " <b>EMA(" + c.p2 + ")</b>";
      case "macd_cross":      return "MACD(" + c.p1 + "," + c.p2 + ") is " + rel + " its <b>signal line</b>";
      case "bollinger_touch": return "price closes " + (c.op === ">" ? "<b>above the upper</b>" : "<b>below the lower</b>") + " Bollinger band (" + c.p1 + ", " + c.value + "σ)";
      case "breakout":        return "price breaks " + (c.op === ">" ? "<b>above the " + c.p1 + "-bar high</b>" : "<b>below the " + c.p1 + "-bar low</b>");
      default:                return "volume runs " + rel + " <b>" + c.value + "×</b> its " + c.p1 + "-bar average";
    }
  }
  function condHtml(side, d) {
    d = d || (side === "entry" ? PRESETS.dip.entry : PRESETS.dip.exit);
    var opts = Object.keys(IND_META).map(function (k) {
      return '<option value="' + k + '"' + (k === d.ind ? " selected" : "") + ">" + IND_META[k].label + "</option>";
    }).join("");
    return '<div class="ztb-card ztb-rule ztb-cond" data-side="' + side + '">' +
      '<span class="ztb-lbl">' + (side === "entry" ? "Enter when" : "Exit when") + "</span>" +
      '<div class="ztb-row">' +
      '<span class="ztb-f sig"><span class="ztb-lbl">Signal</span><select class="flow-input" data-f="ind">' + opts + "</select></span>" +
      '<span class="ztb-f" data-p="p1"><span class="ztb-lbl" data-lbl="p1">Period</span><input class="flow-input num" data-f="p1" type="number" min="2" max="200" value="' + d.p1 + '"></span>' +
      '<span class="ztb-f" data-p="p2" hidden><span class="ztb-lbl" data-lbl="p2">Slow</span><input class="flow-input num" data-f="p2" type="number" min="3" max="400" value="' + d.p2 + '"></span>' +
      '<span class="ztb-f"><span class="ztb-lbl">Condition</span><select class="flow-input" data-f="op"><option value="<"' + (d.op === "<" ? " selected" : "") + ">below</option><option value=\">\"" + (d.op === ">" ? " selected" : "") + ">above</option></select></span>" +
      '<span class="ztb-f" data-p="value"><span class="ztb-lbl">Value</span><input class="flow-input num" data-f="value" type="number" step="any" value="' + d.value + '"></span>' +
      "</div>" +
      '<div class="ztb-sent" data-sent></div>' +
      "</div>";
  }
  function readCond(root, side) {
    var el = root.querySelector('.ztb-cond[data-side="' + side + '"]');
    var g = function (f) { var n = el.querySelector('[data-f="' + f + '"]'); return n ? n.value : null; };
    return { ind: g("ind"), p1: +g("p1") || 14, p2: +g("p2") || 50, op: g("op"), value: +g("value") || 0 };
  }
  function syncCond(el, applyDefault) {
    var meta = IND_META[el.querySelector('[data-f="ind"]').value] || {};
    el.querySelector('[data-p="p1"] [data-lbl]').textContent = meta.p1 || "Period";
    el.querySelector('[data-p="p2"]').hidden = !meta.p2;
    if (meta.p2) el.querySelector('[data-lbl="p2"]').textContent = meta.p2;
    var vf = el.querySelector('[data-p="value"]');
    vf.hidden = !meta.value;
    if (meta.value) {
      vf.querySelector(".ztb-lbl").textContent = meta.vlbl || "Value";
      if (applyDefault && meta.def !== undefined) vf.querySelector("[data-f=value]").value = meta.def;
    }
    var side = el.dataset.side, root = el.closest(".ztb");
    var s = el.querySelector("[data-sent]");
    if (s && root) s.innerHTML = (side === "entry" ? "Buy when " : "Sell when ") + describe(readCond(root, side)) +
      (side === "entry" ? "" : " - or earlier if the engine's stop or target fires.");
  }
  function applyPreset(p) {
    var root = document.querySelector(".ztb"); if (!root) return;
    document.getElementById("ztbName").value = p.name;
    root.querySelectorAll(".ztb-chip[data-coin]").forEach(function (c) {
      c.classList.toggle("on", p.coins.indexOf(c.dataset.coin) >= 0);
    });
    ["ztbIvl", "ztbStyle"].forEach(function (id) {
      var v = id === "ztbIvl" ? p.ivl : p.style;
      root.querySelectorAll("#" + id + " button").forEach(function (b) { b.classList.toggle("on", b.dataset.v === v); });
    });
    ["entry", "exit"].forEach(function (side) {
      var el = root.querySelector('.ztb-cond[data-side="' + side + '"]');
      if (el) { el.outerHTML = condHtml(side, p[side]); }
    });
    root.querySelectorAll(".ztb-cond").forEach(syncCond);
  }

  function myCustoms() {
    return Promise.all([
      mine("deployment?select=strategy_key,status,params&strategy_key=like.custom_*"),
      mine("book_state?select=strategy_key,realised"),
    ]).then(function (all) {
      var books = {}; (all[1] || []).forEach(function (b) { books[b.strategy_key] = Number(b.realised || 0); });
      return (all[0] || []).map(function (d) {
        return { key: d.strategy_key, name: (d.params && d.params.name) || d.strategy_key,
                 status: d.status, realised: books[d.strategy_key] || 0 };
      });
    });
  }
  function customList(rows) {
    if (!rows.length) return '<div class="ztb-sent">No strategies yet. Compose one above, hit Deploy, and it starts trading paper on live prices within about five minutes.</div>';
    return rows.map(function (r) {
      var run = r.status === "running";
      return '<div class="ztb-item" data-key="' + esc(r.key) + '">' +
        '<span class="live-dot' + (run ? " live" : "") + '"></span>' +
        '<span><span class="nm">' + esc(r.name) + '</span><br><span class="stt">' + (run ? "Running · paper · live prices" : "Stopped") + "</span></span>" +
        '<b class="num ' + (r.realised >= 0 ? "up" : "down") + '">' + (r.realised >= 0 ? "+" : "") + "$" + r.realised.toFixed(2) + "</b>" +
        '<button class="btn-ghost sm" data-zta="' + (run ? "stop" : "resume") + '">' + (run ? "Stop" : "Resume") + "</button>" +
        '<button class="btn-ghost sm danger" data-zta="delete">Delete</button></div>';
    }).join("");
  }
  function builderPane() {
    return '<div class="av-scroll"><div class="ztb">' +
      '<div class="ztb-card ztb-head"><div><b>Strategy Builder</b><p>You compose the signals - the engine keeps the rails.</p></div><span class="ztb-badge">PAPER · LIVE PRICES</span></div>' +

      '<div class="ztb-presets"><span>Start from:</span>' +
      '<button class="preset" data-ztpreset="dip">RSI dip buyer</button>' +
      '<button class="preset" data-ztpreset="cross">Golden cross rider</button>' +
      '<button class="preset" data-ztpreset="snap">Stretch snap-back</button></div>' +

      '<div class="ztb-card"><div class="ztb-grid">' +
      '<span><span class="ztb-lbl">Name</span><input class="flow-input" id="ztbName" maxlength="40" placeholder="My RSI dip buyer" value="My RSI dip buyer"></span>' +
      '<span><span class="ztb-lbl">Coins</span><span class="ztb-chips">' + COINS.map(function (c, i) {
        return '<button class="ztb-chip' + (i < 2 ? " on" : "") + '" data-coin="' + c + '">' + c.replace("USDT", "") + "</button>";
      }).join("") + "</span></span>" +
      '<span><span class="ztb-lbl">Timeframe</span><span class="seg" id="ztbIvl"><button class="seg-btn on" data-v="day">Daily</button><button class="seg-btn" data-v="5minute">5-minute</button></span></span>' +
      '<span><span class="ztb-lbl">Exit style</span><span class="seg" id="ztbStyle"><button class="seg-btn" data-v="trend">Trend · trail the stop</button><button class="seg-btn on" data-v="reversion">Reversion · fixed target</button></span></span>' +
      "</div></div>" +

      '<div class="ztb-rules">' + condHtml("entry") + condHtml("exit") + "</div>" +

      '<p class="flow-note">' + icon("shield", 13) + '<span><b>The rails are not optional.</b> Every custom strategy runs through the same engine as the built-ins: ATR stops, a cost-aware entry gate that refuses trades which only feed fees, an anti-churn cooldown, a breakeven-after-cost profit lock, and a $1,000 paper notional per position. Global cost model: 35bps round-trip.</span></p>' +
      '<div id="ztbErrHost"></div>' +
      '<button class="ztb-deploy" id="ztbDeploy">Deploy in Paper</button>' +

      '<div class="ztb-card"><span class="ztb-lbl">My strategies</span><div id="ztbList">Loading…</div></div>' +
      "</div></div>";
  }
  function renderBuilder() {
    var v = document.getElementById("algoView"); if (!v) return;
    var head = v.querySelector(".av-head"); if (!head) return;
    v.querySelectorAll(".av-tab").forEach(function (t) { t.classList.toggle("on", t.hasAttribute("data-ztbuilder")); });
    while (head.nextSibling) head.parentNode.removeChild(head.nextSibling);
    head.insertAdjacentHTML("afterend", builderPane());
    v.querySelectorAll(".ztb-cond").forEach(syncCond);
    myCustoms().then(function (rows) {
      var el = document.getElementById("ztbList"); if (el) el.innerHTML = customList(rows);
    });
  }
  function refreshList() {
    myCustoms().then(function (rows) {
      var el = document.getElementById("ztbList"); if (el) el.innerHTML = customList(rows);
    });
  }
  /* create/remove, not hidden-attribute toggling, matches flowError()/clearFlowError() in
   * app.js. (.flow-err sets display:flex, which as author CSS beats the UA [hidden] rule, so
   * toggling .hidden on a pre-rendered .flow-err leaves an empty bar visible when "hidden".) */
  function ztbShowError(msg) {
    var host = document.getElementById("ztbErrHost"); if (!host) return;
    host.innerHTML = '<div class="flow-err" role="alert">' + icon("alert", 13) + "<span>" + esc(msg) + "</span></div>";
  }
  function ztbClearError() {
    var host = document.getElementById("ztbErrHost"); if (host) host.innerHTML = "";
  }
  function deployCustom() {
    var root = document.querySelector(".ztb"); if (!root) return;
    var name = (document.getElementById("ztbName").value || "").trim() || "My strategy";
    var coins = [].slice.call(root.querySelectorAll(".ztb-chip.on[data-coin]")).map(function (c) { return c.dataset.coin; });
    var seg = function (id) { var b = root.querySelector("#" + id + " .on"); return b ? b.dataset.v : null; };
    var spec = { name: name, universe: coins.length ? coins : COINS,
                 interval: seg("ztbIvl") || "day", style: seg("ztbStyle") || "reversion",
                 entry: readCond(root, "entry"), exit: readCond(root, "exit") };
    var s = session(); if (!s) { location.replace("/login"); return; }
    ORIG(SUPA + "/rest/v1/deployment?on_conflict=user_id,strategy_key", {
      method: "POST",
      headers: sbHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({ user_id: s.uid, strategy_key: slug(name), mode: "paper",
                             status: "running", params: spec }),
    }).then(function (r) {
      if (r.ok) {
        ztbClearError(); trackEvent("deploy_click"); trackEvent("deploy_success");
        gaEvent("deploy_click", { strategy: slug(name), custom: true });
        gaEvent("deploy_success", { strategy: slug(name), custom: true });
        showForwardHint(); refreshList();
      }
      else r.json().then(function (e) {
        var msg = (e && (e.message || e.details || e.hint)) || "Deploy failed - try again.";
        if (/FREE_LIMIT/i.test(msg)) {
          ztbShowError("Free includes 1 strategy: upgrade at /app#pricing");
          setTimeout(goUpgradeFromFreeLimit, 900);
          return;
        }
        ztbShowError(msg);
      }).catch(function () { ztbShowError("Deploy failed - try again."); });
    });
  }
  function customAction(key, act) {
    if (act === "delete")
      return ORIG(SUPA + "/rest/v1/deployment?strategy_key=eq." + encodeURIComponent(key),
                  { method: "DELETE", headers: sbHeaders({ Prefer: "return=minimal" }) }).then(refreshList);
    return ORIG(SUPA + "/rest/v1/deployment?strategy_key=eq." + encodeURIComponent(key), {
      method: "PATCH", headers: sbHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify({ status: act === "resume" ? "running" : "stopped" }),
    }).then(refreshList);
  }

  /* keep our tab present across the app's full innerHTML re-renders, and keep the
   * Builder pane alive: the app's async data loads call renderAlgo() which rebuilds
   * #algoView wholesale - if the user is on Builder, we re-render it on top. */
  var builderOn = false;
  function injectTab() {
    var bar = document.querySelector("#algoView .av-tabs");
    if (bar && !bar.querySelector("[data-ztbuilder]")) {
      var b = document.createElement("button");
      b.className = "av-tab"; b.setAttribute("role", "tab"); b.setAttribute("data-ztbuilder", "1");
      b.textContent = "Builder";
      bar.appendChild(b);
    }
    if (builderOn && document.getElementById("algoView") && !document.querySelector(".ztb"))
      renderBuilder();
  }
  function watch() {
    var v = document.getElementById("algoView"); if (!v) return setTimeout(watch, 600);
    injectTab();
    new MutationObserver(injectTab).observe(v, { childList: true, subtree: true });
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-ztbuilder]");
    if (t) {
      e.preventDefault(); builderOn = true; renderBuilder();
      var nudge = document.querySelector(".zt-cold-nudge");
      if (nudge && nudge._ztDismiss) nudge._ztDismiss();
      return;
    }
    if (e.target.closest && e.target.closest("[data-algoview]")) { builderOn = false; }
    if (e.target.id === "ztbDeploy") { deployCustom(); return; }
    var pre = e.target.closest && e.target.closest("[data-ztpreset]");
    if (pre) { applyPreset(PRESETS[pre.dataset.ztpreset]); return; }
    var coin = e.target.closest && e.target.closest(".ztb-chip[data-coin]");
    if (coin) { coin.classList.toggle("on"); return; }
    var seg = e.target.closest && e.target.closest("#ztbIvl button, #ztbStyle button");
    if (seg) { seg.parentNode.querySelectorAll("button").forEach(function (x) { x.classList.remove("on"); }); seg.classList.add("on"); return; }
    var act = e.target.closest && e.target.closest("[data-zta]");
    if (act) { customAction(act.closest(".ztb-item").dataset.key, act.dataset.zta); return; }
  });
  document.addEventListener("change", function (e) {
    if (e.target.matches && e.target.matches('.ztb-cond [data-f="ind"]'))
      syncCond(e.target.closest(".ztb-cond"), true);   // switching signal applies its sane default value
  });
  document.addEventListener("input", function (e) {
    var c = e.target.closest && e.target.closest(".ztb-cond");
    if (c) syncCond(c);                       // live plain-English sentence as they type
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch);
  else watch();
})();
