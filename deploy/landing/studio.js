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

  /* ---- customers live in the Algo Studio: persona pinned, crypto book pinned ---- */
  try {
    var K = "tradepro.terminal.v1";
    var st0 = JSON.parse(localStorage.getItem(K) || "null") || {};
    st0.persona = "algo";                    // Trading/Investing/AI personas are operator surfaces
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
      /* the user's OWN composed strategies join the monitor as first-class entries */
      deps.forEach(function (d) {
        if (d.strategy_key.indexOf("custom_") !== 0) return;
        var b = book[d.strategy_key], pl = posList(b);
        var real = b ? Number(b.realised || 0) : 0;
        out.strategies = out.strategies || [];
        out.strategies.push({
          id: d.strategy_key,
          name: ((d.params && d.params.name) || "Custom") + " · yours",
          instr: "CUSTOM", realisedPnl: real, openPnl: 0, paperPnl: real,
          positions: pl, openPositions: pl.length,
          deployed: d.status === "running", wired: true, custom: true,
        });
        totalReal += real; totalOpen += pl.length;
      });
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
    ".mkt-live", ".mkt-dot", ".he-stat.off", ".tix-offline",
    "#modeFab", "#personaGate"               // persona switcher removed: the Studio IS the product
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

  /* ================= Strategy Builder tab =================
   * Injected into the Algo Studio tab bar, rendered with the terminal's own
   * component classes (.av-tab, .flow-*, .sel, .seg, .btn-primary) so it is
   * visually indistinguishable from a built-in tab. Users compose the SIGNALS;
   * the engine keeps the RAILS (ATR stops, cost gate, cooldown, profit lock). */
  var IND_META = {
    rsi:          { label: "RSI (oversold / overbought)",  p1: "Period", value: true },
    zscore:       { label: "Z-score (stretch from mean)",  p1: "Lookback", value: true },
    price_vs_sma: { label: "Price vs moving average",      p1: "SMA period" },
    sma_cross:    { label: "SMA cross (fast vs slow)",     p1: "Fast", p2: "Slow" },
    ema_cross:    { label: "EMA cross (fast vs slow)",     p1: "Fast", p2: "Slow" },
  };
  var COINS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT"];

  function slug(name) {
    return "custom_" + String(name || "my_strategy").toLowerCase()
      .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);
  }
  function condHtml(side, d) {
    d = d || { ind: "rsi", p1: 14, p2: 50, op: side === "entry" ? "<" : ">", value: side === "entry" ? 30 : 55 };
    var opts = Object.keys(IND_META).map(function (k) {
      return '<option value="' + k + '"' + (k === d.ind ? " selected" : "") + ">" + IND_META[k].label + "</option>";
    }).join("");
    return '<div class="flow-rows ztb-cond" data-side="' + side + '">' +
      '<div><span>Signal</span><select class="sel" data-f="ind">' + opts + "</select></div>" +
      '<div data-p="p1"><span data-lbl="p1">Period</span><input class="flow-input" data-f="p1" type="number" min="2" max="200" value="' + d.p1 + '"></div>' +
      '<div data-p="p2" hidden><span data-lbl="p2">Slow</span><input class="flow-input" data-f="p2" type="number" min="3" max="400" value="' + d.p2 + '"></div>' +
      '<div><span>Condition</span><select class="sel" data-f="op"><option value="<"' + (d.op === "<" ? " selected" : "") + ">below</option><option value=\">\"" + (d.op === ">" ? " selected" : "") + ">above</option></select></div>" +
      '<div data-p="value"><span>Value</span><input class="flow-input" data-f="value" type="number" step="any" value="' + d.value + '"></div>' +
      "</div>";
  }
  function readCond(root, side) {
    var el = root.querySelector('.ztb-cond[data-side="' + side + '"]');
    var g = function (f) { var n = el.querySelector('[data-f="' + f + '"]'); return n ? n.value : null; };
    return { ind: g("ind"), p1: +g("p1") || 14, p2: +g("p2") || 50, op: g("op"), value: +g("value") || 0 };
  }
  function syncCond(el) {
    var meta = IND_META[el.querySelector('[data-f="ind"]').value] || {};
    el.querySelector('[data-p="p1"] [data-lbl]').textContent = meta.p1 || "Period";
    el.querySelector('[data-p="p2"]').hidden = !meta.p2;
    if (meta.p2) el.querySelector('[data-lbl="p2"]').textContent = meta.p2;
    el.querySelector('[data-p="value"]').hidden = !meta.value;
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
    if (!rows.length) return '<p class="flow-note"><span>No strategies yet - compose one above and deploy it. It trades on live prices within about five minutes.</span></p>';
    return rows.map(function (r) {
      var run = r.status === "running";
      return '<div class="flow-rows ztb-row" data-key="' + r.key + '">' +
        "<div><span>" + r.name + '</span><b class="num ' + (r.realised >= 0 ? "up" : "sell") + '">$' + r.realised.toFixed(2) + "</b></div>" +
        '<div><span class="badge ' + (run ? "b-up" : "b-neu") + '">' + (run ? "Running" : "Stopped") + "</span>" +
        '<button class="btn-ghost" data-zta="' + (run ? "stop" : "resume") + '">' + (run ? "Stop" : "Resume") + "</button>" +
        '<button class="btn-ghost" data-zta="delete">Delete</button></div></div>';
    }).join("");
  }
  function builderPane() {
    return '<div class="av-scroll"><div class="ztb" style="max-width:860px;margin:0 auto;padding:18px 6px">' +
      '<div class="flow-top"><div><b>Strategy Builder</b><span class="flow-sub">You compose the signals - the engine keeps the rails</span></div><span class="badge b-up">Paper · live prices</span></div>' +
      '<div class="flow-rows"><div><span>Name</span><input class="flow-input" id="ztbName" maxlength="40" placeholder="My RSI dip buyer" value="My RSI dip buyer"></div>' +
      '<div><span>Coins</span><span>' + COINS.map(function (c, i) {
        return '<label class="flow-check" style="margin-right:10px"><input type="checkbox" data-coin="' + c + '"' + (i < 2 ? " checked" : "") + "> " + c.replace("USDT", "") + "</label>";
      }).join("") + "</span></div>" +
      '<div><span>Timeframe</span><span class="seg" id="ztbIvl"><button class="on" data-v="day">Daily</button><button data-v="5minute">5-minute</button></span></div>' +
      '<div><span>Exit style</span><span class="seg" id="ztbStyle"><button data-v="trend">Trend - trail the stop</button><button class="on" data-v="reversion">Reversion - fixed target</button></span></div></div>' +
      "<h4>Enter when</h4>" + condHtml("entry") +
      "<h4>Exit when</h4>" + condHtml("exit") +
      '<p class="flow-note"><span><b>The rails are not optional.</b> Every custom strategy runs through the same engine as the built-ins: ATR stops, a cost-aware entry gate (trades that only feed fees are refused), an anti-churn cooldown, breakeven-after-cost profit lock, and a $1,000 paper notional per position. Global cost model: 35bps round-trip.</span></p>' +
      '<div class="flow-err" id="ztbErr" hidden></div>' +
      '<button class="btn-primary" id="ztbDeploy">Deploy in Paper</button>' +
      '<h4 style="margin-top:26px">My strategies</h4><div id="ztbList">Loading…</div>' +
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
  function deployCustom() {
    var root = document.querySelector(".ztb"); if (!root) return;
    var err = document.getElementById("ztbErr");
    var name = (document.getElementById("ztbName").value || "").trim() || "My strategy";
    var coins = [].slice.call(root.querySelectorAll("[data-coin]:checked")).map(function (c) { return c.dataset.coin; });
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
      if (r.ok) { err.hidden = true; refreshList(); }
      else r.json().then(function (e) {
        err.textContent = (e && (e.message || e.hint)) || "Deploy failed - try again.";
        err.hidden = false;
      }).catch(function () { err.textContent = "Deploy failed - try again."; err.hidden = false; });
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
    if (t) { e.preventDefault(); builderOn = true; renderBuilder(); return; }
    if (e.target.closest && e.target.closest("[data-algoview]")) { builderOn = false; }
    if (e.target.id === "ztbDeploy") { deployCustom(); return; }
    var seg = e.target.closest && e.target.closest("#ztbIvl button, #ztbStyle button");
    if (seg) { seg.parentNode.querySelectorAll("button").forEach(function (x) { x.classList.remove("on"); }); seg.classList.add("on"); return; }
    var act = e.target.closest && e.target.closest("[data-zta]");
    if (act) { customAction(act.closest(".ztb-row").dataset.key, act.dataset.zta); return; }
  });
  document.addEventListener("change", function (e) {
    if (e.target.matches && e.target.matches('.ztb-cond [data-f="ind"]')) syncCond(e.target.closest(".ztb-cond"));
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch);
  else watch();
})();
