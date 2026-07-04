# Phase 0 — Shadow Execution Plane · User Stories (in depth)

**Goal:** build the full live-order pipeline for both books (Kite + Binance) and run it in
**shadow mode** — real logic, real feeds, but orders hit a *mock exchange* that logs what it
*would* send. Prove every path (happy + failure) with **zero capital at risk**, so arming real
money later is one OS-env flip, not a rewrite.

**Legend:** ✅ BUILT & TESTED this increment · 🔜 NEXT increment · 📋 spec-only (later phase)
Each story: role/want/why · Acceptance (Given/When/Then) · Edge cases · Definition of Done.

---

## Epic A — Order Router (the spine)

### A1 · Submit an intent → shadow order ✅
**As** the signal engine, **I want** to hand an *intent* (strategy, symbol, side, qty, ref price)
to one router, **so that** in shadow mode it produces a realistic simulated fill without touching a
real exchange.
- **Given** a valid intent and an armed shadow router **When** `submit(intent)` **Then** an `Order`
  is created `NEW→ACK→FILLED`, a `Fill` is recorded at ref ± modelled slippage, and the local
  position updates.
- **Edge:** zero/negative qty → rejected pre-flight, no order; unknown cost-kind → default cost used, logged.
- **DoD:** unit test asserts state machine + position delta + slippage direction (buy fills *higher*).

### A2 · Idempotent client order IDs ✅
**As** the router, **I want** every logical order to carry a *deterministic* client-order-id,
**so that** a retry or reconnect can never create a duplicate order.
- **Given** an order submitted with coid `X` **When** the same logical order is submitted again
  (retry) **Then** the broker recognises `X` and returns the existing order — **no second fill**.
- **Edge:** two *different* intents must never collide on a coid (id includes strategy|symbol|side|seq).
- **DoD:** test submits the same order twice → exactly one fill, one position delta.

### A3 · Hard caps enforced pre-trade ✅
**As** the router, **I want** to enforce order-notional / max-open / daily-loss caps **before** any
order leaves, **so that** a bug or bad signal can't exceed the risk budget.
- **Given** `LIVE_MAX_ORDER_NOTIONAL=5000` **When** an intent worth 6000 is submitted **Then** it is
  **refused** with a reason and **no order** is placed.
- **Given** `LIVE_MAX_OPEN=1` and one position open **When** a second entry is submitted **Then** refused.
- **Edge:** exits are **never** blocked by max-open (you must always be able to reduce risk).
- **DoD:** tests for each cap: over-notional refused, max-open refused, exit-while-full allowed.

### A4 · Two-key live gate, fails safe ✅
**As** the operator, **I want** real orders impossible unless `ALLOW_LIVE` + allowlist + gate all
hold, **so that** no browser click or config flip alone can ever spend real money.
- **Given** live mode requested but `ALLOW_LIVE` unset **When** submit **Then** refused → paper/shadow
  (reuses `bot/safety.live_execution_allowed`).
- **Given** a strategy **not** in `LIVE_ALLOWED_STRATEGIES` **When** submit in live mode **Then** refused.
- **Edge:** shadow mode enforces caps/allowlist but does **not** require ALLOW_LIVE (that's the point).
- **DoD:** test — live path without ALLOW_LIVE refuses; allowlist miss refuses.

---

## Epic B — Broker adapters

### B1 · Uniform adapter interface ✅
**As** a developer, **I want** `BrokerAdapter` (place/cancel/status/open_orders/positions), **so that**
Kite, Binance, and the shadow mock are swappable behind one contract.
- **DoD:** ABC defined; ShadowBroker implements it fully; Kite/Binance stubs conform (raise until built).

### B2 · Shadow (mock) exchange ✅
**As** a tester, **I want** a deterministic mock exchange that simulates ack, (partial) fills with
cost-model slippage, rejects, and keeps an order book + positions, **so that** shadow soak exercises
every code path with no network.
- **Given** a placed order **When** the mock processes it **Then** it acks, fills at
  `ref + adverse_slippage`, appends a fill, and updates its own positions (source of truth for recon).
- **Edge:** configurable **reject** (e.g. qty over an exchange limit) and **partial-fill** injection.
- **DoD:** deterministic (no wall-clock/random in fill price) so tests are stable.

### B3 · Kite live adapter 🔜
Wrap `kiteconnect` (extend existing `bot/broker.py:KiteBroker`) as a `BrokerAdapter`: marketable-limit
with slippage cap, `place_order` + `order_history` for status, `positions()` for recon, algo-tag on
every order. **Refuses to place unless `live_armed()`.**

### B4 · Binance live adapter 🔜
REST order placement + status; `newClientOrderId` = our coid (native idempotency); positions/balances
for recon. **Refuses unless `live_armed()`.**

---

## Epic C — Reconciliation & fills

### C1 · Reconcile against the exchange on start/reconnect ✅
**As** the router, **I want** to pull open orders + positions from the broker and reconcile to *its*
truth on startup and every reconnect, **so that** the exchange — not my local memory — is authoritative
for real money.
- **Given** local state says flat but the broker shows a position **When** `reconcile()` **Then** local
  state is corrected to the broker's, and the divergence is logged loudly.
- **DoD:** test injects divergence → reconcile fixes local to broker truth.

### C2 · Partial fills ✅
**As** the router, **I want** to manage the position on *filled* qty and track the remainder, **so that**
a half-filled order is never treated as fully filled.
- **Given** an order for 10 that fills 4 **When** the fill arrives **Then** position = 4, order `PARTIAL`,
  remaining 6 tracked; on the rest filling → `FILLED`, position 10.
- **DoD:** partial-fill test asserts position + order-state progression.

### C3 · Ambiguous state — query before resend ✅
**As** the router, **I want** to *query order status* on a timeout before re-sending, **so that** a slow
ack never causes a double-fill.
- **Given** an order that times out with no ack **When** the router recovers **Then** it calls
  `status(coid)`; if the exchange already has it, it **does not resend**.
- **DoD:** timeout test — status shows live → no duplicate; status shows missing → single resend.

---

## Epic D — Websocket feeds

### D1 · Feed adapter (marks + fills) 🔜
`FeedAdapter.subscribe(symbols)`, `on_tick`, `on_order_update`. Binance combined streams
(`bookTicker`+`kline_5m`+user-data via listenKey); KiteTicker in `full` mode + order postback.
Shadow uses a **replay/simulated tick generator** over historical bars (safe, offline).

### D2 · Staleness guard 🔜
If newest tick is older than `FEED_STALE_SEC`, **halt new entries** (keep managing exits from REST).
Never enter on a stale book. Test: age the feed → entries refused, exits allowed.

### D3 · Reconnect with backoff 🔜
Exponential-backoff reconnect; on reconnect re-subscribe **and** `reconcile()`. Test: forced disconnect
→ reconnect → no lost/duplicated orders.

---

## Epic E — Tick-level risk

### E1 · Tick-driven stops / trail / runner 🔜
Between 5-min bars, evaluate `position_intel` (breakeven-after-cost lock, trailing, runner) on **each
tick** and fire exits immediately instead of waiting for the next cycle. Reuses existing logic verbatim.

### E2 · Daily-loss kill-switch ✅ (core) / 🔜 (feed-driven)
**As** the operator, **I want** a hard daily-loss kill-switch, **so that** a bad day flattens
everything and disables new entries until I manually reset.
- **Given** day P&L ≤ `-LIVE_MAX_DAILY_LOSS` **When** the check runs **Then** all positions flatten,
  new entries are refused, and only a manual `reset()` re-enables.
- **DoD (core):** unit test — breach → kill fires → subsequent submits refused → flatten requested.

---

## Epic F — Safety & ops

### F1 · OS-env config, read-only to the UI ✅
`LiveConfig` from env only (`ALLOW_LIVE`, `LIVE_ALLOWED_STRATEGIES`, caps, timeouts). The API may
*read* live status; it can **never** set arming or caps. **DoD:** loader test + "no setter" assertion.

### F2 · One-command kill-switch ✅
`router.kill(reason)` flattens + disables from a single call; also auto-fires on daily-loss breach and
(later) on feed-loss > threshold. **DoD:** kill → state disabled → submits refused → flatten issued.

### F3 · Secrets hygiene 📋
Keys **trade-only, no withdrawal**, IP-restricted, in `.env` (gitignored); never logged. Redaction
check in the logger. (Ops/checklist item, not code this increment.)

---

## Epic G — Fault-injection & sign-off (the hardening)

### G1 · Feed dies mid-position 🔜   ### G2 · Order timeout → no dup ✅ (see C3)
### G3 · Duplicate fill event deduped ✅
- **Given** the same fill (coid+seq) delivered twice **When** processed **Then** position counts it
  **once**. **DoD:** dup-fill test asserts no double-count.
### G4 · Double-send under reconnect ✅ (see A2 idempotency)
### G5 · Every cap refuses correctly ✅ (see A3)
### G6 · Shadow intents == paper intents 🔜
Run shadow alongside the paper harness for a session; assert the *intents* are identical (the edge is
unchanged; only execution differs). Sign-off requires **N clean sessions**.

---

## This increment (BUILT & TESTED): A1 A2 A3 A4 · B1 B2 · C1 C2 C3 · E2(core) · F1 F2 · G3 G4 G5
## Next increment: B3 B4 (real adapters) · D1 D2 D3 (websocket) · E1 (tick risk) · G1 G6 (soak)
## Arming real money still requires: a strategy past the honest go-live gate + N clean shadow sessions.
