// zengtrade — the post-login product. A small hash-routed SPA over Supabase (RLS-isolated data):
// Dashboard · Strategies · Activity · Account, plus first-run onboarding. Every render is defensive
// (loading / empty / error states), every action gives feedback, all user data is escaped.
import { requireAuth, signOut, sb, niceError } from "./auth.js";
import { getTier, isPro, openCheckout, checkoutReady, PLANS, FREE_DEPLOY_LIMIT } from "./billing.js";
import { STRATEGIES, byKey, nameOf } from "./strategies.js";
import { esc, money, pct, num, timeAgo, tone, toast, skeletonRows, equityCurve } from "./ui.js";

const $ = s => document.querySelector(s);
const app = $("#view");
let user = null, tier = "free", billCycle = "month";
let state = { deployments: [], trades: [], loading: true, error: null };

const ROUTES = ["dashboard", "strategies", "activity", "account"];
const route = () => (location.hash.replace("#", "") || "dashboard");

// ---------------------------------------------------------------- boot
(async function boot() {
  user = await requireAuth();                 // redirects to /login.html if signed out
  if (!user) return;
  $("#userEmail").textContent = user.email;
  $("#signout").onclick = () => signOut();
  $("#upgradeBtn").onclick = () => location.hash = "pricing";
  window.addEventListener("hashchange", render);
  window.addEventListener("resize", debounce(() => { if (route() === "dashboard") drawCurve(); }, 150));
  buildNav();
  render();                                   // paint shell immediately (loading state)
  await load();                               // then hydrate
  await maybeOnboard();
  render();
})();

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
    tier = prof.data?.tier === "pro" ? "pro" : "free";
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
  ({ dashboard: renderDashboard, strategies: renderStrategies, activity: renderActivity, account: renderAccount }[r])();
}

const errorState = () => `<div class="empty big"><h3>Couldn't load your data</h3>
  <p>${esc(state.error)}</p><button class="btn primary" id="retry">Try again</button></div>`;

// ---- Dashboard ----
function renderDashboard() {
  if (state.loading) { app.innerHTML = `<div class="grid stats">${skeletonRows(4)}</div><div class="card" style="height:220px;margin-top:16px">${skeletonRows(1)}</div>`; return; }
  const m = metrics(), ps = perStrategy();
  const upsell = !isPro(tier) && state.deployments.length >= FREE_DEPLOY_LIMIT
    ? `<div class="upsell"><div><b>You're on Free — ${FREE_DEPLOY_LIMIT} strategy.</b><span>Upgrade to Pro for unlimited strategies and live execution when a strategy clears the bar.</span></div><button class="btn primary" id="up2">Upgrade — $29/mo</button></div>` : "";
  app.innerHTML = `
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
    <p class="iso">🔒 Your data is yours alone — isolated per account and enforced at the database level (row-level security).</p>`;
  drawCurve();
  $("#goStrat") && ($("#goStrat").onclick = () => location.hash = "strategies");
  $("#up2") && ($("#up2").onclick = () => location.hash = "pricing");
  $("#firstDeploy") && ($("#firstDeploy").onclick = () => location.hash = "strategies");
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
  <p class="muted">Deploy one to start paper-trading on live crypto prices — zero money at risk.</p>
  <button class="btn primary" id="firstDeploy">Browse strategies</button></div>`;

// ---- Strategies (marketplace) ----
function renderStrategies() {
  if (state.loading) { app.innerHTML = `<div class="grid cards">${skeletonRows(3)}</div>`; return; }
  const deployed = new Set(state.deployments.map(d => d.strategy_key));
  app.innerHTML = `
    <div class="page-h"><h2>Strategies</h2><p class="muted">Deploy to paper-trade free. Backtest figures are ~2 years of real data, net of fees — <b>backtest, not forward-proven.</b> Watch each earn its track record in your own book before it ever runs live.</p></div>
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
    ` : `<div class="empty"><p><b>No trades yet.</b></p><p class="muted">Deploy a strategy and the worker will start filling this in.</p></div>`}</div>`;
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
      <div class="acc-row"><span>Legal</span><span class="links"><a href="/terms.html">Terms</a><a href="/privacy.html">Privacy</a><a href="/risk.html">Risk</a></span></div>
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
    toast(`Free includes ${FREE_DEPLOY_LIMIT} strategy — upgrade to Pro for unlimited.`, "info");
    setTimeout(() => location.hash = "pricing", 500); return;
  }
  const { error } = await sb.from("deployment").upsert(
    { user_id: user.id, strategy_key: key, mode: "paper", status: "running" },
    { onConflict: "user_id,strategy_key" });
  if (error) return toast(niceError(error), "error");
  toast(`${nameOf(key)} deployed to paper.`, "success");
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
  const soon = ready ? "" : `<div class="soon-banner">${"⏳"} <div><b>Paid plans open in a few days.</b><span>The checkout is going through payment-provider activation. Free is fully live now — start there, and you'll be able to upgrade in-place the moment it opens (no re-signup).</span></div></div>`;
  app.innerHTML = `
    <div class="page-h center"><h2>Simple, honest pricing</h2>
      <p class="muted">Start free. Upgrade when you want more — cancel anytime.</p>
      <div class="cycle">
        <button data-c="month" class="${billCycle === "month" ? "on" : ""}">Monthly</button>
        <button data-c="year" class="${billCycle === "year" ? "on" : ""}">Annual <span class="save">2 months free</span></button>
      </div></div>
    ${soon}
    <div class="grid plans">${PLANS.map(p => planCard(p, ready)).join("")}</div>
    <p class="iso center">* Live execution unlocks per strategy only after it clears the go-live bar in paper. Non-custodial — your keys, your coins. Not investment advice.</p>`;
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
