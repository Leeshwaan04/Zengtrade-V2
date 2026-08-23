// zengtrade, the post-login product. A small hash-routed SPA over Supabase (RLS-isolated data):
// Dashboard · Strategies · Activity · Account, plus first-run onboarding. Every render is defensive
// (loading / empty / error states), every action gives feedback, all user data is escaped.
import { requireAuth, signOut, sb, niceError } from "./auth.js";
import { maybeWorkerBanner, isWorkerAlive } from "./worker-status.js";
import { getTier, isPro, openCheckout, checkoutReady, PLANS, FREE_DEPLOY_LIMIT } from "./billing.js";
import { STRATEGIES, byKey, nameOf } from "./strategies.js";
import { esc, money, pct, num, timeAgo, tone, toast, skeletonRows, equityCurve } from "./ui.js";

const $ = s => document.querySelector(s);
const app = $("#view");
let user = null, tier = "free", billCycle = "month";
let state = { deployments: [], trades: [], loading: true, error: null, workerAlive: true };

const ROUTES = ["dashboard", "strategies", "forward", "accuracy", "analytics", "activity", "account"];
const route = () => (location.hash.replace("#", "") || "dashboard");

// ---------------------------------------------------------------- boot
(async function boot() {
  user = await requireAuth();                 // redirects to /login if signed out
  if (!user) return;
  try {
    await sb.from("event").insert({
      name: "pageview",
      path: ("/app" + location.hash).slice(0, 290),
      ref: (document.referrer || "").slice(0, 290),
    });
  } catch { /* funnel */ }
  $("#userEmail").textContent = user.email;
  $("#signout").onclick = () => signOut();
  $("#upgradeBtn").onclick = () => location.hash = "pricing";
  window.addEventListener("hashchange", render);
  window.addEventListener("resize", debounce(() => { if (route() === "dashboard") drawCurve(); }, 150));
  buildNav();
  render();                                   // paint shell immediately (loading state)
  await load();                               // then hydrate
  await maybeOnboard();
  await maybeWorkerBanner();
  render();
  if (new URLSearchParams(location.search).get("paid") === "1") maybePaidReturn();
  else maybeIntentUpgrade();                   // a "Get Pro/Elite" signup lands on the plan chooser
})();

// A visitor who clicked "Get Pro/Elite" on the pricing page arrives here after signup with an intent
// stashed by login.html. Route them to the plan chooser instead of a generic dashboard.
function maybeIntentUpgrade() {
  let p = null;
  try { p = localStorage.getItem("zt_intent_plan"); } catch { return; }
  if (!p) return;
  try { localStorage.removeItem("zt_intent_plan"); } catch { /* ignore */ }
  if (isPro(tier)) return;                     // already on a paid plan, nothing to upsell
  location.hash = "pricing";
  toast(`You're all set. Choose ${p === "elite" ? "Elite" : "Pro"} below to go live.`, "info");
}

// ---------------------------------------------------------------- return from checkout (?paid=1)
// The success_url lands the user here the instant they finish the hosted invoice, but the on-chain
// confirmation + IPN webhook (which actually grants the tier) can take a few minutes. So we show a
// reassuring "confirming" banner and poll profile.tier until it flips, then swap to a success state.
async function maybePaidReturn() {
  const q = new URLSearchParams(location.search);
  if (q.get("paid") !== "1") return;
  history.replaceState({}, "", location.pathname + location.hash);   // don't replay on refresh
  if (isPro(tier)) { toast(`You're on ${tier === "elite" ? "Elite" : "Pro"} — thank you!`, "ok"); return; }

  if (!document.getElementById("ztSpinKf")) {
    const s = document.createElement("style"); s.id = "ztSpinKf";
    s.textContent = "@keyframes ztspin{to{transform:rotate(360deg)}}"; document.head.appendChild(s);
  }
  const bar = document.createElement("div");
  bar.id = "paidBanner";
  bar.setAttribute("role", "status");
  bar.style.cssText = "position:sticky;top:0;z-index:70;display:flex;gap:10px;align-items:center;" +
    "justify-content:center;padding:12px 18px;background:var(--green-soft,#e7f8ef);" +
    "color:var(--green-d,#067a3a);border-bottom:1px solid var(--green-line,#bfe9cf);" +
    "font:600 13.5px/1.45 var(--sans,system-ui,sans-serif);text-align:center";
  bar.innerHTML = '<span style="width:14px;height:14px;border:2px solid currentColor;' +
    'border-top-color:transparent;border-radius:50%;display:inline-block;animation:ztspin .8s linear infinite">' +
    '</span> Payment received. Your upgrade activates the moment the network confirms it (usually a few minutes). This page updates automatically.';
  document.body.prepend(bar);

  const started = Date.now();
  const poll = async () => {
    let t = "free";
    try { t = await getTier(user.id); } catch { /* transient; keep polling */ }
    if (isPro(t)) {
      tier = t;
      bar.style.background = "var(--green,#00ab4e)"; bar.style.color = "#04140a";
      bar.innerHTML = `✓ You're on ${t === "elite" ? "Elite" : "Pro"} now. Enjoy the full library.`;
      $("#upgradeBtn").style.display = "none";
      await load(); render();
      setTimeout(() => bar.remove(), 7000);
      return;
    }
    if (Date.now() - started > 240000) {           // give up after ~4 min
      bar.querySelector("span")?.remove();
      bar.textContent = "Still confirming on-chain. Some coins take a few minutes, refresh this page once your wallet shows the payment sent, or we'll update it automatically.";
      return;
    }
    setTimeout(poll, 10000);                        // re-check every 10s
  };
  setTimeout(poll, 6000);                           // first check after 6s
}

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// ---------------------------------------------------------------- data
async function load() {
  state.loading = true; state.error = null;
  try {
    const [dep, tr, prof] = await Promise.all([
      sb.from("deployment").select("*").order("deployed_at", { ascending: false }),
      sb.from("trade").select("strategy_key,symbol,pnl,cost,entry,exit,closed_at").not("closed_at", "is", null).order("closed_at", { ascending: true }),
      sb.from("profile").select("tier").eq("id", user.id).maybeSingle(),
    ]);
    if (dep.error) throw dep.error; if (tr.error) throw tr.error;
    state.deployments = dep.data || [];
    state.trades = tr.data || [];
    tier = isPro(prof.data?.tier) ? prof.data.tier : "free";   // keep the real tier (pro OR elite)
    state.workerAlive = await isWorkerAlive();
  } catch (e) {
    state.error = niceError(e);
    toast(state.error, "error");
  } finally {
    state.loading = false;
  }
  $("#upgradeBtn").style.display = isPro(tier) ? "none" : "inline-flex";
}

// ---------------------------------------------------------------- derived metrics
function metrics() {
  const t = state.trades, n = t.length;
  const net = t.reduce((a, x) => a + Number(x.pnl || 0), 0);
  const wins = t.filter(x => Number(x.pnl) > 0).length;
  const curve = []; let eq = 0; for (const x of t) { eq += Number(x.pnl || 0); curve.push(eq); }
  const grossW = t.filter(x => x.pnl > 0).reduce((a, x) => a + x.pnl, 0);
  const grossL = Math.abs(t.filter(x => x.pnl <= 0).reduce((a, x) => a + x.pnl, 0));
  return { n, net, win: n ? (100 * wins / n) : 0, curve, pf: grossL ? grossW / grossL : (grossW ? 99 : 0) };
}
function perStrategy() {
  const map = {};
  for (const d of state.deployments) map[d.strategy_key] = { key: d.strategy_key, dep: d, net: 0, n: 0, wins: 0 };
  for (const t of state.trades) {
    const m = map[t.strategy_key] || (map[t.strategy_key] = { key: t.strategy_key, dep: null, net: 0, n: 0, wins: 0 });
    m.net += Number(t.pnl || 0); m.n++; if (t.pnl > 0) m.wins++;
  }
  return Object.values(map);
}

// ---------------------------------------------------------------- router / render
function buildNav() {
  $("#nav").innerHTML = ROUTES.map(r =>
    `<a href="#${r}" data-r="${r}">${r[0].toUpperCase() + r.slice(1)}</a>`).join("");
}
function render() {
  if (route() === "pricing") { document.querySelectorAll("#nav a").forEach(a=>a.classList.remove("on")); return renderPricing(); }
  const r = ROUTES.includes(route()) ? route() : "dashboard";
  document.querySelectorAll("#nav a").forEach(a => a.classList.toggle("on", a.dataset.r === r));
  if (state.error && !state.loading) { app.innerHTML = errorState(); $("#retry").onclick = async () => { render(); await load(); render(); }; return; }
  ({ dashboard: renderDashboard, strategies: renderStrategies, forward: renderForward,
     accuracy: renderAccuracy, analytics: renderAnalytics,
     activity: renderActivity, account: renderAccount }[r])();
}

const errorState = () => `<div class="empty big"><h3>Couldn't load your data</h3>
  <p>${esc(state.error)}</p><button class="btn primary" id="retry">Try again</button></div>`;

function activationChecklist() {
  const deployed = state.deployments.some(d => d.status === "running");
  const traded = metrics().n > 0;
  if (deployed && traded) return "";
  const s1 = "done", s2 = deployed ? "done" : "on", s3 = traded ? "done" : (deployed ? "on" : "");
  const workerNote = deployed && !traded && !state.workerAlive
    ? `<p class="muted" style="margin:8px 0 0;font-size:13px">Paper worker is offline — deploys are saved but trades pause until the worker is running. <a href="/how-it-works/">How paper trading works</a></p>`
    : deployed && !traded && state.workerAlive
    ? `<p class="muted" style="margin:8px 0 0;font-size:13px">Worker is running — first closed trade usually within 5–15 min. Open <a href="#forward">Forward Test</a>.</p>`
    : "";
  return `<div class="card" id="activation">
    <div class="card-h"><h3>Activation checklist</h3><span class="muted">signup → deploy → trades</span></div>
    <ol class="act-steps">
      <li class="${s1}"><span class="dot"></span><span><b>Account created</b><br><span class="muted">You're signed in as ${esc(user.email)}</span></span></li>
      <li class="${s2}"><span class="dot"></span><span><b>Deploy a paper strategy</b><br><span class="muted">Use Algo Studio or Strategies tab — live Binance prices, zero risk.</span></span></li>
      <li class="${s3}"><span class="dot"></span><span><b>First closed trade</b><br><span class="muted">Worker runs every ~5 min; check Forward Test for evidence.</span>${workerNote}</span></li>
    </ol>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
      <a class="btn primary sm" href="/dashboard">Open Algo Studio</a>
      <button class="btn ghost sm" id="act-strat" type="button">Deploy here</button>
    </div>
  </div>`;
}

// ---- Dashboard ----
function renderDashboard() {
  if (state.loading) { app.innerHTML = `<div class="grid stats">${skeletonRows(4)}</div><div class="card" style="height:220px;margin-top:16px">${skeletonRows(1)}</div>`; return; }
  const m = metrics(), ps = perStrategy();
  const upsell = !isPro(tier) && state.deployments.length >= FREE_DEPLOY_LIMIT
    ? `<div class="upsell"><div><b>You're on Free, ${FREE_DEPLOY_LIMIT} strategy.</b><span>Upgrade to Pro for unlimited strategies and live execution when a strategy clears the bar.</span></div><button class="btn primary" id="up2">Upgrade, $19/mo founding</button></div>` : "";
  app.innerHTML = `
    ${activationChecklist()}
    ${upsell}
    <div class="grid stats">
      <div class="stat"><span>Net P&amp;L · after costs</span><b class="${tone(m.net)}">${money(m.net)}</b></div>
      <div class="stat"><span>Closed trades</span><b>${num(m.n)}</b></div>
      <div class="stat"><span>Win rate</span><b>${m.n ? pct(m.win) : "—"}</b></div>
      <div class="stat"><span>Plan</span><b>${isPro(tier) ? "Pro" : "Free"}</b></div>
    </div>
    <div class="card curve-card">
      <div class="card-h"><h3>Equity curve</h3><span class="muted">paper · your deployed strategies</span></div>
      <canvas id="curve" height="200"></canvas>
    </div>
    <div class="card">
      <div class="card-h"><h3>Your strategies</h3><button class="btn sm primary" id="goStrat">+ Deploy</button></div>
      ${ps.length ? ps.map(stratRow).join("") : emptyStrategies()}
    </div>
    <p class="iso">🔒 Your data is yours alone, isolated per account and enforced at the database level (row-level security).</p>`;
  drawCurve();
  $("#goStrat") && ($("#goStrat").onclick = () => location.hash = "strategies");
  $("#up2") && ($("#up2").onclick = () => location.hash = "pricing");
  $("#firstDeploy") && ($("#firstDeploy").onclick = () => location.hash = "strategies");
  $("#act-strat") && ($("#act-strat").onclick = () => location.hash = "strategies");
}
function drawCurve() { const m = metrics(); equityCurve($("#curve"), m.curve); }
function stratRow(s) {
  const meta = byKey[s.key] || { name: s.key, style: "" };
  const w = s.n ? (100 * s.wins / s.n) : 0;
  return `<div class="srow">
    <div class="srow-main"><b>${esc(meta.name)}</b><span class="tag">${esc(meta.style || "paper")}</span></div>
    <div class="srow-metric"><span>${num(s.n)}</span><small>trades</small></div>
    <div class="srow-metric"><span>${s.n ? pct(w) : "—"}</span><small>win</small></div>
    <div class="srow-metric"><span class="${tone(s.net)}">${money(s.net)}</span><small>net</small></div>
  </div>`;
}
const emptyStrategies = () => `<div class="empty">
  <p><b>No strategies deployed yet.</b></p>
  <p class="muted">Deploy one to start paper-trading on live crypto prices, zero money at risk.</p>
  <button class="btn primary" id="firstDeploy">Browse strategies</button></div>`;

const emptyDeployCta = (title, blurb) => `<div class="empty"><p><b>${title}</b></p><p class="muted">${blurb}</p>
  <button class="btn primary" id="ev-deploy">Deploy a strategy</button>
  <a class="btn ghost" href="/dashboard" style="margin-left:8px">Open Algo Studio</a></div>`;
function wireEmptyDeploy() {
  const b = $("#ev-deploy");
  if (b) b.onclick = () => { location.hash = "strategies"; };
}

function showPostDeployHint() {
  if (document.getElementById("ztPostDeployHint")) return;
  const workerNote = state.workerAlive
    ? "Trades appear in Forward Test as the worker runs (~15 min)."
    : "Worker is offline — deploy saved; trades start when the worker is live.";
  const el = document.createElement("div");
  el.id = "ztPostDeployHint";
  el.setAttribute("role", "status");
  el.style.cssText =
    "position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:90;" +
    "max-width:min(480px,calc(100% - 24px));padding:14px 16px;border-radius:14px;" +
    "background:var(--surface,#fff);border:1px solid var(--line,#e2e8f0);box-shadow:0 8px 24px rgba(0,0,0,.12);" +
    "font:600 13px/1.45 var(--sans,system-ui);display:flex;gap:12px;align-items:center;flex-wrap:wrap";
  el.innerHTML =
    `<div style="flex:1"><b>Strategy deployed</b><br><span style="font-weight:500;color:var(--slate,#64748b)">${workerNote}</span></div>` +
    `<a href="#forward" style="padding:8px 14px;border-radius:9px;background:var(--green,#00ab4e);color:#04140a;text-decoration:none;font-weight:700">Forward Test</a>` +
    `<button type="button" style="border:0;background:transparent;cursor:pointer;color:var(--slate,#64748b)" aria-label="Dismiss">✕</button>`;
  el.querySelector("button").onclick = () => el.remove();
  document.body.appendChild(el);
}

// ---- Forward Test (closed-trade evidence) ----
function renderForward() {
  if (state.loading) { app.innerHTML = `<div class="card">${skeletonRows(6)}</div>`; return; }
  const rows = [...state.trades].reverse();
  const m = metrics();
  app.innerHTML = `
    <div class="page-h"><h2>Forward Test</h2><p class="muted">Your out-of-sample paper track record — every closed trade on live crypto prices, net of costs. This is the evidence that earns go-live consideration.</p></div>
    <div class="grid stats">
      <div class="stat"><span>Closed trades</span><b>${num(m.n)}</b></div>
      <div class="stat"><span>Win rate</span><b>${m.n ? pct(m.win) : "—"}</b></div>
      <div class="stat"><span>Net P&amp;L</span><b class="${tone(m.net)}">${money(m.net)}</b></div>
      <div class="stat"><span>Profit factor</span><b>${m.n ? (m.pf >= 99 ? "∞" : m.pf.toFixed(2)) : "—"}</b></div>
    </div>
    <div class="card table-card">${rows.length ? `
      <div class="tbl-scroll"><table><thead><tr><th>When</th><th>Strategy</th><th>Symbol</th><th class="r">P&amp;L</th><th class="r">Cost</th></tr></thead>
      <tbody>${rows.slice(0, 100).map(t => `<tr>
        <td class="muted">${timeAgo(t.closed_at)}</td><td>${esc(nameOf(t.strategy_key))}</td>
        <td class="mono">${esc(t.symbol)}</td>
        <td class="r mono ${tone(t.pnl)}">${money(t.pnl, 2)}</td>
        <td class="r mono muted">${money(t.cost, 2)}</td></tr>`).join("")}</tbody></table></div>
      ${rows.length > 100 ? `<div class="tbl-foot">showing latest 100 of ${num(rows.length)}</div>` : ""}
    ` : emptyDeployCta("No closed trades yet.", "Deploy a strategy — the worker fills this in as trades close on live prices.")}</div>`;
  wireEmptyDeploy();
}

// ---- Accuracy (per-strategy forward stats) ----
function renderAccuracy() {
  if (state.loading) { app.innerHTML = `<div class="card">${skeletonRows(4)}</div>`; return; }
  const ps = perStrategy();
  app.innerHTML = `
    <div class="page-h"><h2>Accuracy</h2><p class="muted">Per-strategy forward accuracy from your closed paper trades — win rate, net P&amp;L, and trade count. Backtest figures are not shown here; only your live forward evidence counts.</p></div>
    <div class="card">${ps.length ? ps.map(s => {
      const w = s.n ? (100 * s.wins / s.n) : 0;
      const meta = byKey[s.key] || { name: s.key };
      return `<div class="srow"><div class="srow-main"><b>${esc(meta.name)}</b><span class="tag">forward</span></div>
        <div class="srow-metric"><span>${num(s.n)}</span><small>trades</small></div>
        <div class="srow-metric"><span>${s.n ? pct(w) : "—"}</span><small>win</small></div>
        <div class="srow-metric"><span class="${tone(s.net)}">${money(s.net)}</span><small>net</small></div></div>`;
    }).join("") : emptyDeployCta("No forward data yet.", "Accuracy builds as your deployed strategies close trades.")}</div>`;
  wireEmptyDeploy();
}

// ---- Analytics (attribution) ----
function renderAnalytics() {
  if (state.loading) { app.innerHTML = `<div class="card">${skeletonRows(4)}</div>`; return; }
  const m = metrics();
  const bySym = {};
  for (const t of state.trades) {
    const k = t.symbol || "—";
    const row = bySym[k] || (bySym[k] = { sym: k, n: 0, net: 0, wins: 0 });
    row.n++; row.net += Number(t.pnl || 0); if (t.pnl > 0) row.wins++;
  }
  const symRows = Object.values(bySym).sort((a, b) => b.net - a.net);
  const byStrat = perStrategy().sort((a, b) => b.net - a.net);
  app.innerHTML = `
    <div class="page-h"><h2>Analytics</h2><p class="muted">P&amp;L attribution across your paper book — by strategy and symbol. All figures are net of booked costs from closed trades.</p></div>
    <div class="grid stats">
      <div class="stat"><span>Total net</span><b class="${tone(m.net)}">${money(m.net)}</b></div>
      <div class="stat"><span>Strategies</span><b>${num(byStrat.length)}</b></div>
      <div class="stat"><span>Symbols traded</span><b>${num(symRows.length)}</b></div>
      <div class="stat"><span>Expectancy / trade</span><b class="${tone(m.n ? m.net / m.n : 0)}">${m.n ? money(m.net / m.n, 2) : "—"}</b></div>
    </div>
    <div class="card"><div class="card-h"><h3>By strategy</h3></div>
      ${byStrat.length ? byStrat.map(s => `<div class="srow"><div class="srow-main"><b>${esc((byKey[s.key] || {}).name || s.key)}</b></div>
        <div class="srow-metric"><span class="${tone(s.net)}">${money(s.net)}</span><small>net</small></div></div>`).join("")
        : `<div class="empty"><p class="muted">Deploy strategies to see attribution.</p><button class="btn primary sm" id="ev-deploy">Deploy</button></div>`}</div>
    <div class="card"><div class="card-h"><h3>By symbol</h3></div>
      ${symRows.length ? symRows.slice(0, 12).map(s => `<div class="srow"><div class="srow-main"><b class="mono">${esc(s.sym)}</b></div>
        <div class="srow-metric"><span>${num(s.n)}</span><small>trades</small></div>
        <div class="srow-metric"><span class="${tone(s.net)}">${money(s.net)}</span><small>net</small></div></div>`).join("")
        : `<div class="empty"><p class="muted">Symbol breakdown appears after your first closed trades.</p></div>`}</div>`;
  wireEmptyDeploy();
}

// ---- Strategies (marketplace) ----
function renderStrategies() {
  if (state.loading) { app.innerHTML = `<div class="grid cards">${skeletonRows(3)}</div>`; return; }
  const deployed = new Set(state.deployments.map(d => d.strategy_key));
  app.innerHTML = `
    <div class="page-h"><h2>Strategies</h2><p class="muted">Deploy to paper-trade free. Backtest figures are ~2 years of real data, net of fees, <b>backtest, not forward-proven.</b> Watch each earn its track record in your own book before it ever runs live.</p></div>
    <div class="grid cards">${STRATEGIES.map(s => stratCard(s, deployed.has(s.key))).join("")}</div>`;
  STRATEGIES.forEach(s => {
    const b = document.getElementById(`act-${s.key}`);
    if (b) b.onclick = () => deployed.has(s.key) ? stop(s.key) : deploy(s.key);
  });
}
function stratCard(s, isDeployed) {
  return `<div class="scard${isDeployed ? " on" : ""}">
    <div class="scard-top"><b>${esc(s.name)}</b><span class="tag">${esc(s.style)}</span></div>
    <p class="scard-desc">${esc(s.desc)}</p>
    <div class="scard-bt">
      <div><b class="${tone(s.bt.net)}">${money(s.bt.net)}</b><small>net 2yr</small></div>
      <div><b>${pct(s.bt.win)}</b><small>win</small></div>
      <div><b>${s.bt.pf}</b><small>PF</small></div>
      <div><b>${s.bt.trades}</b><small>trades</small></div>
    </div>
    <div class="scard-bt-label">Backtest · net of fees · not forward-proven</div>
    <button class="btn ${isDeployed ? "ghost" : "primary"} full" id="act-${s.key}">${isDeployed ? "Stop" : "Deploy to paper"}</button>
  </div>`;
}

// ---- Activity ----
function renderActivity() {
  if (state.loading) { app.innerHTML = `<div class="card">${skeletonRows(6)}</div>`; return; }
  const rows = [...state.trades].reverse();     // most recent first
  app.innerHTML = `
    <div class="page-h"><h2>Activity</h2><p class="muted">Every closed paper trade in your book, newest first. Cost is booked on each.</p></div>
    <div class="card table-card">${rows.length ? `
      <div class="tbl-scroll"><table><thead><tr><th>When</th><th>Strategy</th><th>Symbol</th><th class="r">Entry</th><th class="r">Exit</th><th class="r">Cost</th><th class="r">P&amp;L</th></tr></thead>
      <tbody>${rows.slice(0, 200).map(tradeRow).join("")}</tbody></table></div>
      ${rows.length > 200 ? `<div class="tbl-foot">showing latest 200 of ${num(rows.length)}</div>` : ""}
    ` : emptyDeployCta("No trades yet.", "Deploy a strategy and the worker will start filling this in.")}</div>`;
  wireEmptyDeploy();
}
function tradeRow(t) {
  return `<tr>
    <td class="muted">${timeAgo(t.closed_at)}</td>
    <td>${esc(nameOf(t.strategy_key))}</td>
    <td class="mono">${esc(t.symbol)}</td>
    <td class="r mono">${t.entry != null ? Number(t.entry).toLocaleString() : "—"}</td>
    <td class="r mono">${t.exit != null ? Number(t.exit).toLocaleString() : "—"}</td>
    <td class="r mono muted">${money(t.cost, 2)}</td>
    <td class="r mono ${tone(t.pnl)}">${money(t.pnl, 2)}</td></tr>`;
}

// ---- Account ----
function renderAccount() {
  app.innerHTML = `
    <div class="page-h"><h2>Account</h2></div>
    <div class="card acc">
      <div class="acc-row"><span>Email</span><b>${esc(user.email)}</b></div>
      <div class="acc-row"><span>Plan</span><b>${isPro(tier) ? "Pro" : "Free"}</b>
        ${isPro(tier) ? "" : `<button class="btn sm primary" id="accUp">Upgrade to Pro</button>`}</div>
      <div class="acc-row"><span>Trading mode</span><b>Paper only <span class="muted">· non-custodial · no real orders</span></b></div>
    </div>
    <div class="card acc">
      <div class="acc-row"><span>Legal</span><span class="links"><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/risk">Risk</a></span></div>
      <div class="acc-row"><span>Support</span><a href="mailto:hello@zengtrade.in">hello@zengtrade.in</a></div>
    </div>
    <div class="card acc danger">
      <div class="acc-row"><span>Sign out</span><button class="btn ghost sm" id="accOut">Sign out</button></div>
    </div>`;
  $("#accUp") && ($("#accUp").onclick = () => location.hash = "pricing");
  $("#accOut").onclick = () => signOut();
}

// ---------------------------------------------------------------- actions (optimistic + toast)
async function deploy(key) {
  const already = state.deployments.some(d => d.strategy_key === key);
  if (!isPro(tier) && !already && state.deployments.length >= FREE_DEPLOY_LIMIT) {
    toast(`Free includes ${FREE_DEPLOY_LIMIT} strategy, upgrade to Pro for unlimited.`, "info");
    setTimeout(() => location.hash = "pricing", 500); return;
  }
  const { error } = await sb.from("deployment").upsert(
    { user_id: user.id, strategy_key: key, mode: "paper", status: "running" },
    { onConflict: "user_id,strategy_key" });
  if (error) {
    const m = niceError(error);
    if (/free_limit|more than one strategy/i.test(m)) {
      toast(`Free includes ${FREE_DEPLOY_LIMIT} strategy — upgrade to Pro for unlimited.`, "info");
      setTimeout(() => { location.hash = "pricing"; }, 500);
      return;
    }
    return toast(m, "error");
  }
  try {
    await sb.from("event").insert({ name: "deploy_click", path: (location.pathname + location.hash).slice(0, 290) });
    await sb.from("event").insert({ name: "deploy_success", path: (location.pathname + location.hash).slice(0, 290) });
  } catch { /* funnel */ }
  toast(`${nameOf(key)} deployed to paper.`, "success");
  showPostDeployHint();
  await load(); render();
}
async function stop(key) {
  const dep = state.deployments.find(d => d.strategy_key === key);
  if (!dep) return;
  const { error } = await sb.from("deployment").delete().eq("id", dep.id);
  if (error) return toast(niceError(error), "error");
  toast(`${nameOf(key)} stopped.`, "info");
  await load(); render();
}

// ---- Pricing ----
function renderPricing() {
  const ready = checkoutReady();
  const soon = ready ? "" : `<div class="soon-banner">${"⏳"} <div><b>Paid plans open in a few days.</b><span>The checkout is going through payment-provider activation. Free is fully live now, start there, and you'll be able to upgrade in-place the moment it opens (no re-signup).</span></div></div>`;
  app.innerHTML = `
    <div class="page-h center"><h2>Simple, honest pricing</h2>
      <p class="muted">Start free. Upgrade when you want more, cancel anytime.</p>
      <div class="cycle">
        <button data-c="month" class="${billCycle === "month" ? "on" : ""}">Monthly</button>
        <button data-c="year" class="${billCycle === "year" ? "on" : ""}">Annual <span class="save">2 months free</span></button>
      </div></div>
    ${soon}
    <div class="grid plans">${PLANS.map(p => planCard(p, ready)).join("")}</div>
    <p class="iso center">* Live execution unlocks per strategy only after it clears the go-live bar in paper. Non-custodial, your keys, your coins. Not investment advice.</p>`;
  app.querySelectorAll(".cycle button").forEach(b => b.onclick = () => { billCycle = b.dataset.c; renderPricing(); });
  PLANS.forEach(p => {
    const b = document.getElementById(`plan-${p.id}`);
    if (b) b.onclick = () => p.id === "free" ? (location.hash = "strategies") : openCheckout(user, p.id, billCycle);
  });
}
function planCard(p, ready = true) {
  const price = billCycle === "year" ? p.annual : p.monthly;
  const per = p.id === "free" ? "" : (billCycle === "year" ? "/yr" : "/mo");
  const current = (p.id === "free" && !isPro(tier)) || (p.id === "pro" && isPro(tier));
  const paidNotReady = p.id !== "free" && !ready;   // checkout still activating
  const cta = current ? "Current plan"
    : p.id === "free" ? "Get started"
    : paidNotReady ? "Opening soon" : `Choose ${esc(p.name)}`;
  return `<div class="plan${p.featured ? " feat" : ""}">
    ${p.featured ? `<div class="ribbon">Most popular</div>` : ""}
    <div class="plan-name">${esc(p.name)}</div>
    <div class="plan-price">$${price}<span>${per}</span></div>
    <div class="plan-tag">${esc(p.tagline)}</div>
    <ul>${p.features.map(f => `<li>${esc(f)}</li>`).join("")}</ul>
    <button class="btn ${p.featured ? "primary" : "ghost"} full" id="plan-${p.id}" ${current ? "disabled" : ""}${paidNotReady ? ' data-soon="1"' : ""}>${cta}</button>
  </div>`;
}

// ---------------------------------------------------------------- onboarding (first run)
async function maybeOnboard() {
  if (localStorage.getItem("zt_onboarded")) return;
  if (state.deployments.length > 0) { localStorage.setItem("zt_onboarded", "1"); return; }
  const dlg = $("#onboard"); if (!dlg) return;
  dlg.showModal();
  $("#ob-deploy").onclick = async () => {
    dlg.close(); localStorage.setItem("zt_onboarded", "1");
    location.hash = "strategies";
  };
  $("#ob-skip").onclick = () => { dlg.close(); localStorage.setItem("zt_onboarded", "1"); };
}
