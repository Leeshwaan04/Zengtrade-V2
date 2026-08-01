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
    st.textContent = css + ZTB_CSS;
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

  var ZTB_CSS =
    ".ztb{max-width:880px;margin:0 auto;display:flex;flex-direction:column;gap:14px;padding:4px 2px 26px;font-size:13.5px}" +
    ".ztb-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-s);padding:14px 16px;box-shadow:var(--shadow)}" +
    ".ztb-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}" +
    ".ztb-head b{font-size:15.5px;color:var(--navy)}" +
    ".ztb-head p{margin:2px 0 0;color:var(--slate);font-size:12.5px}" +
    ".ztb-badge{font-size:10.5px;font-weight:800;letter-spacing:.06em;color:var(--green-d);background:var(--up-flash);border-radius:99px;padding:4px 11px;white-space:nowrap}" +
    ".ztb-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:16px 26px}" +
    "@media(max-width:760px){.ztb-grid{grid-template-columns:1fr}}" +
    ".ztb-lbl{display:block;font-size:10.5px;font-weight:700;letter-spacing:.08em;color:var(--slate);text-transform:uppercase;margin:0 0 6px}" +
    ".ztb-inp,.ztb-sel{width:100%;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--navy);font:inherit;font-size:13.5px;padding:8px 11px;transition:.15s;-webkit-appearance:none;appearance:none}" +
    ".ztb-sel{background-image:url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"10\" height=\"6\"><path d=\"M1 1l4 4 4-4\" stroke=\"%2364748b\" stroke-width=\"1.6\" fill=\"none\" stroke-linecap=\"round\"/></svg>');background-repeat:no-repeat;background-position:right 11px center;padding-right:28px}" +
    ".ztb-inp:focus,.ztb-sel:focus{outline:none;border-color:var(--green);box-shadow:0 0 0 3px var(--up-flash)}" +
    ".ztb-chips{display:flex;gap:8px;flex-wrap:wrap}" +
    ".ztb-chip{border:1px solid var(--line);background:var(--surface);border-radius:99px;padding:6px 14px;font:inherit;font-size:12.5px;font-weight:700;color:var(--slate);cursor:pointer;transition:.15s}" +
    ".ztb-chip:hover{border-color:var(--slate)}" +
    ".ztb-chip.on{background:var(--green);border-color:var(--green);color:#fff}" +
    ".ztb-seg{display:inline-flex;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:3px;gap:2px}" +
    ".ztb-seg button{border:0;background:transparent;color:var(--slate);font:inherit;font-size:12.5px;font-weight:600;padding:6px 13px;border-radius:7px;cursor:pointer;transition:.15s;white-space:nowrap}" +
    ".ztb-seg button.on{background:var(--surface);color:var(--green-d);box-shadow:var(--shadow)}" +
    ".ztb-presets{display:flex;gap:8px;flex-wrap:wrap;align-items:center;color:var(--slate);font-size:12px;font-weight:600}" +
    ".ztb-rules{display:grid;grid-template-columns:1fr 1fr;gap:14px}" +
    "@media(max-width:860px){.ztb-rules{grid-template-columns:1fr}}" +
    ".ztb-rule{border-left:3px solid var(--green)}" +
    ".ztb-rule[data-side=exit]{border-left-color:var(--amber)}" +
    ".ztb-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:2px}" +
    ".ztb-f{flex:1 1 86px;min-width:86px}" +
    ".ztb-f.sig{flex:2 1 100%}" +
    ".ztb-sent{margin-top:11px;font-size:12.5px;color:var(--slate);background:var(--bg);border-radius:8px;padding:8px 11px;line-height:1.5}" +
    ".ztb-sent b{color:var(--navy)}" +
    ".ztb-note{display:block;font-size:12.5px;color:var(--slate);background:var(--tint-info);border:1px solid var(--line);border-radius:var(--radius-s);padding:11px 14px;line-height:1.6}" +
    ".ztb-note b{color:var(--navy)}" +
    ".ztb-deploy{background:var(--green);color:#fff;border:0;border-radius:11px;font:inherit;font-weight:800;font-size:14px;padding:12px 24px;cursor:pointer;box-shadow:var(--shadow);transition:.15s;align-self:flex-start}" +
    ".ztb-deploy:hover{background:var(--green-d);transform:translateY(-1px)}" +
    ".ztb-err{color:var(--red-d);background:var(--tint-down);border:1px solid var(--bd-down);border-radius:9px;padding:9px 12px;font-size:12.5px}" +
    ".ztb-item{display:flex;align-items:center;gap:12px;padding:11px 2px;border-top:1px solid var(--line)}" +
    ".ztb-item:first-of-type{border-top:0}" +
    ".ztb-dot{width:8px;height:8px;border-radius:50%;background:#c3ccd9;flex:0 0 auto}" +
    ".ztb-item.run .ztb-dot{background:var(--green);box-shadow:0 0 0 3px var(--up-flash)}" +
    ".ztb-item .nm{font-weight:700;color:var(--navy)}" +
    ".ztb-item .stt{font-size:11px;color:var(--slate)}" +
    ".ztb-item .pnl{margin-left:auto;font-weight:800;font-variant-numeric:tabular-nums}" +
    ".ztb-item .pnl.up{color:var(--green-d)}.ztb-item .pnl.dn{color:var(--red-d)}" +
    ".ztb-ghost{border:1px solid var(--line);background:var(--surface);border-radius:8px;padding:5px 12px;font:inherit;font-size:12px;font-weight:600;color:var(--slate);cursor:pointer;transition:.15s}" +
    ".ztb-ghost:hover{color:var(--navy);border-color:var(--slate)}";

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
      '<span class="ztb-f sig"><span class="ztb-lbl">Signal</span><select class="ztb-sel" data-f="ind">' + opts + "</select></span>" +
      '<span class="ztb-f" data-p="p1"><span class="ztb-lbl" data-lbl="p1">Period</span><input class="ztb-inp" data-f="p1" type="number" min="2" max="200" value="' + d.p1 + '"></span>' +
      '<span class="ztb-f" data-p="p2" hidden><span class="ztb-lbl" data-lbl="p2">Slow</span><input class="ztb-inp" data-f="p2" type="number" min="3" max="400" value="' + d.p2 + '"></span>' +
      '<span class="ztb-f"><span class="ztb-lbl">Condition</span><select class="ztb-sel" data-f="op"><option value="<"' + (d.op === "<" ? " selected" : "") + ">below</option><option value=\">\"" + (d.op === ">" ? " selected" : "") + ">above</option></select></span>" +
      '<span class="ztb-f" data-p="value"><span class="ztb-lbl">Value</span><input class="ztb-inp" data-f="value" type="number" step="any" value="' + d.value + '"></span>' +
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
      return '<div class="ztb-item' + (run ? " run" : "") + '" data-key="' + r.key + '">' +
        '<span class="ztb-dot"></span>' +
        '<span><span class="nm">' + r.name + '</span><br><span class="stt">' + (run ? "Running · paper · live prices" : "Stopped") + "</span></span>" +
        '<b class="pnl ' + (r.realised >= 0 ? "up" : "dn") + '">' + (r.realised >= 0 ? "+" : "") + "$" + r.realised.toFixed(2) + "</b>" +
        '<button class="ztb-ghost" data-zta="' + (run ? "stop" : "resume") + '">' + (run ? "Stop" : "Resume") + "</button>" +
        '<button class="ztb-ghost" data-zta="delete">Delete</button></div>';
    }).join("");
  }
  function builderPane() {
    return '<div class="av-scroll"><div class="ztb">' +
      '<div class="ztb-card ztb-head"><div><b>Strategy Builder</b><p>You compose the signals - the engine keeps the rails.</p></div><span class="ztb-badge">PAPER · LIVE PRICES</span></div>' +

      '<div class="ztb-presets"><span>Start from:</span>' +
      '<button class="ztb-chip" data-ztpreset="dip">RSI dip buyer</button>' +
      '<button class="ztb-chip" data-ztpreset="cross">Golden cross rider</button>' +
      '<button class="ztb-chip" data-ztpreset="snap">Stretch snap-back</button></div>' +

      '<div class="ztb-card"><div class="ztb-grid">' +
      '<span><span class="ztb-lbl">Name</span><input class="ztb-inp" id="ztbName" maxlength="40" placeholder="My RSI dip buyer" value="My RSI dip buyer"></span>' +
      '<span><span class="ztb-lbl">Coins</span><span class="ztb-chips">' + COINS.map(function (c, i) {
        return '<button class="ztb-chip' + (i < 2 ? " on" : "") + '" data-coin="' + c + '">' + c.replace("USDT", "") + "</button>";
      }).join("") + "</span></span>" +
      '<span><span class="ztb-lbl">Timeframe</span><span class="ztb-seg" id="ztbIvl"><button class="on" data-v="day">Daily</button><button data-v="5minute">5-minute</button></span></span>' +
      '<span><span class="ztb-lbl">Exit style</span><span class="ztb-seg" id="ztbStyle"><button data-v="trend">Trend · trail the stop</button><button class="on" data-v="reversion">Reversion · fixed target</button></span></span>' +
      "</div></div>" +

      '<div class="ztb-rules">' + condHtml("entry") + condHtml("exit") + "</div>" +

      '<span class="ztb-note"><b>The rails are not optional.</b> Every custom strategy runs through the same engine as the built-ins: ATR stops, a cost-aware entry gate that refuses trades which only feed fees, an anti-churn cooldown, a breakeven-after-cost profit lock, and a $1,000 paper notional per position. Global cost model: 35bps round-trip.</span>' +
      '<div class="ztb-err" id="ztbErr" hidden></div>' +
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
  function deployCustom() {
    var root = document.querySelector(".ztb"); if (!root) return;
    var err = document.getElementById("ztbErr");
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
