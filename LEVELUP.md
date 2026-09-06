# TradePro: Level-Up & Optimization Backlog
*Everywhere we can improve the end-to-end experience & user satisfaction. Private working doc.*

**North-star theme (from the audits):** *every mode's #1 gap is "make the last mile real"*. The intelligence/analysis layer is genuinely real; most user **actions** are still simulated. The biggest satisfaction wins come from (1) converting honest-labelled demos into real capabilities, and (2) removing friction around connection, onboarding and feedback.

**Legend:** Priority `P0` (do first / blocks trust) · `P1` (high value) · `P2` (nice) · Effort `S/M/L` · 🟢 safe · ⚠️ needs a decision/creds/live-token · 💰 real-money risk

---

## ⭐ Top 10 by satisfaction-per-effort (start here)
1. ~~**Onboarding / first-run wizard**, guided "connect Kite + set up auto-login"~~ ✅ **DONE** *(2-step wizard: persona → connect Kite with live status, exact `login.py` command, reconnect & real/paper/demo legend)*
2. **Real historical backtests** (UI → your Python engine), P1 · M · 🟢 *(closes the credibility gap in your best mode)*
3. **Real futures OI** (live Kite quote OI vs `dseed()`): P2 · S · 🟢 *(kills the last synthetic data display)*
4. **Price/indicator alerts** (server-side via the bot), P1 · M · 🟢 *(the #1 retention feature in any trading app)*
5. **Bot monitoring + alerting** (crash / kill-switch / token-down / unfilled), P0 · M · ⚠️ *(can't run real money blind)*
6. ~~**AI copilot → real tools/agent**~~ ✅ **DONE** *(6 real tools: get_portfolio / get_market / get_quote / search_instruments / run_backtest / get_option_chain + navigate; full tool_use→tool_result agentic loop; every number fetched live, honest connected:false offline: verified against live Kite data)*
7. **Loading skeletons + perceived-speed polish** everywhere, P2 · S · 🟢 *(feels faster, more premium)*
8. **Command palette (Cmd+K)** (jump to any instrument/mode/action) P2 · M · 🟢 *(power-user delight)*
9. **Portfolio Analyser → real holdings** (drift/concentration/sector/overlap), P1 · S · 🟢 *(makes Investing partly real, cheap)*
10. **Real order execution** (gated order service → Kite + order book). P0 · M · 💰 *(the terminal's whole point; needs a design pass)*

---

## A. Make-it-real (stubbed → functional), biggest trust/UX levers
| Item | P | Effort | Notes |
|---|---|---|---|
| Real order execution + live order book + positions panel | P0 | M | 💰 needs a gated order-service design (don't break the read-only API) |
| Real "Deploy / pause / stop" from the UI (control the bot harness) | P1 | M | ⚠️ wire UI → bot control endpoint (gated) |
| Real historical backtests (UI → Python `regime_backtest`/`backtest`) | P1 | M | 🟢 new `/api/backtest`; verify on next login |
| Price/indicator alerts (server-side, push to UI) | P1 | M | 🟢 currently *sold in Trader tier but doesn't exist* |
| Real futures OI (Kite quote `oi`) | P2 | S | 🟢 same pattern as the option chain |
| Stock SIP → real recurring CNC orders | P2 | M | ⚠️ Kite supports; one genuinely-real investor action |
| IPO / Mutual Funds tools → relabel or retire | P2 | S | 🟢 Zerodha doesn't expose these APIs cleanly |
| AI copilot live by default (run proxy + configure) | P1 | S | onboarding step |

## B. Per-mode UX optimizations
**📈 Trading**
- Order book + positions panel (pairs with real orders) · alerts · **multiple named watchlists** · inline instrument quick-stats (lot/expiry/OI) on search · **stream the option chain + indices** (currently 15s/30s REST) · always-real depth ladder.

**💰 Investing**
- Real Portfolio Analyser (drift/concentration/sector/overlap) · holdings-aware insights ("38% Banks. Concentrated") · what-if allocation ("if I add ₹50k…") · HOLDING badges from real holdings (not seed) · drop/relabel remaining demo tools.

**🤖 Algo**
- ~~Real backtests~~ ✅ · Strategy Builder → an actually-runnable param strategy · **forward→go-live→live continuity in-UI** (no CLI cliff) · ~~strategy comparison / leaderboard by regime~~ ✅ *(Leaderboard tab: ranked + regime matrix)* · ~~per-trade analytics + OOS validation on backtests~~ ✅ · clearer regime-fit explainer.

**✨ AI**
- Real tools/agent (holdings, backtest, chain, gated draft-order) · **portfolio-aware context** injected · conversation **memory** across sessions · answers cite the real data they fetched.

## C. Cross-cutting UX & performance
| Item | P | Effort | Why |
|---|---|---|---|
| First-run onboarding wizard (connect broker, TOTP setup) | P1 | M | removes the cold-start cliff |
| Front-end smoke tests (drive 4 modes, assert no errors + key DOM) | P1 | M | catch the regressions we kept hitting |
| Loading skeletons / optimistic UI everywhere | P2 | S | perceived speed |
| Command palette (Cmd+K) + a keyboard-shortcuts sheet | P2 | M | power-user speed & delight |
| Mobile/responsive pass (or an honest "best on desktop") | P2 | L | investors especially |
| Accessibility audit (contrast, full keyboard nav, screen-reader) | P1 | M | broadens reach; already partly strong |
| Extend WebSocket to indices/VIX/chain/commodities | P2 | M | true real-time everywhere |
| Perf: instrument-index memory, quote batching, render throttling | P2 | M | scale headroom |
| ~~Auto cache-busting (`serve.py`)~~ | ✅ | (| **DONE**) run `python3 serve.py` |

## D. Trust, safety & observability (the bot, gate to real money)
| Item | P | Effort | Why |
|---|---|---|---|
| Monitoring + push alerts (crash / kill-switch trip / token-down / unfilled order) | P0 | M | ⚠️ needs Telegram/email creds; can't run blind |
| P&L reconciliation (internal vs `kite.positions()`) | P0 | M | 💰 silent drift = risk |
| Live canary (1 strategy, tiny ₹, heavily monitored) | P0 | M | 💰 operational decision, the only honest path to trusting live execution |
| Structured logging + a small health/status dashboard | P1 | S | operability |

## E. Onboarding & education
- In-app **"Connect Kite"** guide + **auto-login setup wizard** (TOTP seed, `--setup`, launchd) · a one-time guided tour · a visible **"what's real vs paper vs demo"** legend (we have the ethos; surface it once) · keep the strong info-icon tooltips.

## F. Delight & polish
- More micro-interactions (the regime cascade is great. Extend) · **undo** on destructive actions (delete watchlist/layout) · toast consistency · full UI-state persistence · day/night parity audit · friendlier API-offline state.

## G. Monetization / product infra (when productizing, not before it's real)
- Accounts/auth → **Razorpay** subscriptions → **server-side** entitlement (gates can't be client-bypassed) · usage metering (AI credits, automation slots) · **B2B/white-label** packaging (the real revenue path) · the pricing **roadmap preview** doubles as public transparency.

## ✅ End-user QA pass (2026-06-29), found & fixed
Drove all 4 modes in-browser as an end user (token down → tested honest-offline states). **8 issues fixed, 0 JS errors:**
1. `SEED_ORDERS` seeded 4 fabricated "EXECUTED" orders at fake prices (+ dead TATAMOTORS) → emptied; honest "No orders yet" state.
2. Positions/Holdings tab badges showed a static "6" offline → hidden when no live session (body already said "connect").
3. Breakout scanner showed fabricated setups + fake Chg% (not gated) → gated offline (`emptyConnect`).
4. Context module: hardcoded trade ideas (fake ₹) + *simulated* sector heatmap offline → gated offline, keeps regime framing.
5. Investor order pad divided by ₹0 offline → **"APPROX UNITS Infinity"** → honest ", "; placing offline blocked with a toast.
6. AI `aiCardOptions` **crashed** offline (`buildChain` null → `pcr` reads `.rows`) → gated; no crash.
7. AI hedge/portfolio/sectors/movers cards leaked seed `HOLDINGS`/`ALLOC`/`SECTORS` offline → all gated to "connect Kite, I won't invent" (these get *real* data in the AI-agent rebuild).
8. Dead **TATAMOTORS** (demerged) purged from all displayed content (scanner, context, baskets, research call → MARUTI).
*Verified: onboarding e2e, all 4 personas render, reconnect graceful, no Infinity/NaN/dead-symbol, 0 errors. app.js v69.*

## H. Honesty / consistency (protect the moat)
- Convert the remaining labelled-demos (futures OI, "hypothetical" backtest, add-funds/pledge, option-basket) to real **or** keep them clearly labelled · a single **live / paper / demo** indicator system applied uniformly · never gate or sell a stub (fixed).

---

## Suggested sequencing
1. **This week (safe, high-value, no real-money risk):** real backtests · real futures OI · Portfolio Analyser real · onboarding wizard · loading skeletons.
2. **Before real money:** bot monitoring + reconciliation → live canary.
3. **The keystone:** real gated order execution + order book (design pass first).
4. **The wow:** AI copilot agent with real tools.
5. **Productizing (only once the above are real):** accounts → billing → B2B.

*Updated 2026-06-29. ✅ done so far: 100% real charts/chain/search/portfolio/forward-test/monitor/streaming, real backtests + leaderboard + per-trade/OOS analytics, honest offline states everywhere, auto-login + self-heal, auto cache-busting, integrity pass (paper/demo labels), monetization roadmap preview, first-run onboarding wizard.*
