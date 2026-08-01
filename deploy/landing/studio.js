/* zengtrade Studio shim v2 — the REAL terminal as a MULTI-USER crypto product.
 *
 * Loaded BEFORE app.js in the deployed /dashboard copy only (build.py injects it;
 * the operator's local terminal never loads this file).
 *
 * Data plane (crypto-global, no operator-Mac dependency in steady state):
 *   shared  : engine_state table in Supabase (regime, catalog, metrics) —
 *             published server-side, read by every client (RLS: public read).
 *             Falls back to /dashboard/data/*.json static seeds if a key is missing.
 *   per-user: deployment / book_state / trade rows under RLS — each customer
 *             sees exactly their own book, overlaid onto the shared payloads.
 *   writes  : Deploy/Pause/Stop buttons upsert the user's own deployment rows;
 *             the 24/7 worker picks them up next cycle. Live mode stays locked.
 *   prices  : Binance public REST/WS run directly in the customer's browser.
 */
(function () {
  "use strict";

  var SUPA = "https://ponvarxeytfcntckczbn.supabase.co";
  var ANON = "sb_publishable_w-pQMK0bj-91EPHXtA0sMQ__CTu_rf1";
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

  /* ---- first-run: Algo persona, crypto book ---- */
  try {
    var K = "tradepro.terminal.v1";
    var st0 = JSON.parse(localStorage.getItem(K) || "null") || { persona: "algo" };
    st0.algo = st0.algo || {}; st0.algo.market = "crypto"; st0.algo.view = st0.algo.view || "monitor";
    localStorage.setItem(K, JSON.stringify(st0));
  } catch (e) {}

  var ORIG = window.fetch.bind(window);

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
  function cryptoMonitor() {
    return Promise.all([
      engineGet("api_crypto_monitor"),
      mine("deployment?select=strategy_key,status&mode=eq.paper"),
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
        var pos = (b && b.positions) || {};
        var posList = Object.keys(pos).map(function (sym) {
          var p = pos[sym] || {};
          return { sym: sym, qty: p.qty, entry: p.entry };
        });
        s.realisedPnl = b ? Number(b.realised || 0) : 0;
        s.openPnl = 0;                       // client marks-to-market later; honest zero for now
        s.paperPnl = s.realisedPnl;
        s.positions = posList;
        s.openPositions = posList.length;
        s.deployed = !!running[s.id];
        s.wired = !!DEPLOYABLE[s.id];        // only worker-runnable strategies are deployable
        totalReal += s.realisedPnl; totalOpen += posList.length;
      });
      out.totals = { realised: +totalReal.toFixed(4), unreal: 0,
                     pnl: +totalReal.toFixed(4), open: totalOpen };
      out.running = deps.some(function (d) { return d.status === "running"; });
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
    if (!DEPLOYABLE[id])
      return Promise.resolve(jresp({ error: "This strategy needs a venue not yet enabled for customer accounts (perps/options/pairs land later)." }));
    if (want === "paper") {
      return ORIG(SUPA + "/rest/v1/deployment?on_conflict=user_id,strategy_key", {
        method: "POST",
        headers: sbHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify({ user_id: s.uid, strategy_key: id, mode: "paper", status: "running" }),
      }).then(function (r) {
        if (r.ok) return jresp({ ok: true, id: id, state: "paper" });
        return r.json().then(function (e) {
          return jresp({ error: (e && (e.message || e.hint)) || "Deploy failed - try again." });
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
    ".mkt-live", ".mkt-dot", ".he-stat.off", ".tix-offline"
  ].join(",") + "{display:none !important}";
  function inject() {
    var st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", inject);
  else inject();

  /* ---- force the crypto book after boot (full setMarket path: live tape + WS) ---- */
  function forceCrypto(tries) {
    var b = document.querySelector('[data-algomkt="crypto"]');
    if (b && !b.classList.contains("on")) b.click();
    else if (!b && tries > 0) setTimeout(function () { forceCrypto(tries - 1); }, 700);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", function () { setTimeout(function () { forceCrypto(6); }, 700); });
  else setTimeout(function () { forceCrypto(6); }, 700);
})();
