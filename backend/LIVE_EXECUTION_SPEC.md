# Live-Execution Spec — Indian (Kite) + Crypto (Binance)

**Status:** design, not yet built. This document guides the build so that going live is *fast
and safe* the moment a strategy earns it — **it does not lower the go-live bar.**

**Prime directive (unchanged):** *Be very safe in Indian AND crypto markets, then make profits.*
Building this layer ≠ permission to trade real money. Real orders remain gated on evidence.

---

## 0. What this changes — and what it deliberately does NOT

The system today: **poll every 300 s → compute signal on the last closed bar → simulate a fill at
the close.** That is the honest paper harness. It stays exactly as-is.

We add ONE new thing: an **execution plane** that turns a strategy's *intent* (enter / exit / stop /
target) into a **real order**, confirms the fill, and watches **tick-level stops between bars**.

```
        SIGNAL PLANE  (unchanged — this is the proven edge)          EXECUTION PLANE (new)
        ┌───────────────────────────────────────────┐              ┌──────────────────────────┐
  5-min │ bar close → compute() → _entry/_exit       │   intent     │ OrderRouter              │
  bars  │ edge-gate, profit-lock, runner, regime-fit │ ───────────▶ │  • place / cancel / retry│
        │ governor, cull                             │              │  • idempotent client IDs │
        └───────────────────────────────────────────┘              │  • reconcile vs exchange │
                                                                    │ websocket: marks + fills │
        ┌───────────────────────────────────────────┐   tick       │  • tick-level STOP fire  │
        │ live ticks (websocket)                     │ ───────────▶ │  • breakeven/trail watch │
        └───────────────────────────────────────────┘              │  • daily-loss kill-switch│
                                                                    └──────────────────────────┘
```

**Non-goal: sub-millisecond latency.** Impossible retail (home link → exchange is 20–250 ms of
physics) and irrelevant to 5-min/daily-bar strategies (measured compute: **1–12 ms/signal**). The
target is **fill fidelity** — *the fill matches the decision* — at ~100–500 ms signal-to-fill, which
for a 300 s bar is effectively instant. See "Latency budget" below.

---

## 1. Preconditions — the gate STAYS (nothing here is optional)

A strategy may send real orders only when ALL are true:

1. **Cleared the honest go-live gate** — positive expectancy **net of real costs** (incl. crypto 1%
   TDS), over **≥ 50 closed trades**, **regime-fit = "fit"** in the live regime. Per-strategy, not
   book-wide.
2. **`ALLOW_LIVE` two-key OS-env lock is armed** (below). The browser/API can NEVER arm it.
3. **On the live allowlist** `LIVE_ALLOWED_STRATEGIES` — an explicit per-strategy opt-in.
4. **Inside hard caps** — order notional, daily-loss, open-position caps all configured.
5. **Starts tiny** — ₹5k crypto / minimal Indian; scale only after live fills track paper.

If any is false → the order is refused and logged. Fails **closed**.

---

## 2. Market data — websocket feeds (replaces REST poll for marks + fills)

### Crypto (Binance)
- **Marks:** `<symbol>@bookTicker` (best bid/ask, push on change) for fill pricing + live marks.
- **Bars:** `<symbol>@kline_5m` — the `x=true` close event drives the signal plane (no polling drift).
- **Order/fill events:** **User Data Stream** via `listenKey` (keep-alive every 30 min) → executionReport.
- **Fallback:** on disconnect → exponential-backoff reconnect; meanwhile REST poll resumes. **Staleness
  guard:** if newest tick is older than `FEED_STALE_SEC` (e.g. 10 s) → **halt new entries**, keep
  managing exits from REST. Never enter on a stale book.

### Indian (Kite / Zerodha)
- **Marks/bars:** **KiteTicker** websocket — subscribe instrument tokens in `full` mode; build 5-min
  bars locally or keep REST `historical_data` for bar closes + Ticker for live LTP/stops.
- **Order/fill events:** Kite **postback** (webhook) or order-update websocket → reconcile fills.
- **Fallback + staleness guard:** identical policy. Respect Kite rate limits (~3 req/s) on any REST
  fallback so a large universe can't throttle the cycle.

---

## 3. Order-execution layer

**Interface** (one router, two adapters):
```
OrderRouter.place(order)   -> client_order_id           # idempotent
OrderRouter.cancel(coid)
OrderRouter.on_fill(cb)                                  # driven by user/postback stream
adapters: KiteBroker (extend bot/broker.py) · BinanceBroker (new)
```

**Rules:**
- **Marketable-limit, not raw market.** Send a LIMIT at bid/ask ± a small buffer with a **max-slippage
  cap**; if unfilled within `ORDER_TIMEOUT_SEC`, cancel + re-evaluate. Protects against spike fills.
- **Idempotency.** Deterministic client order IDs → a reconnect/retry can never double-send.
- **Reconciliation.** On startup and every reconnect, pull **open orders + positions from the
  exchange** and reconcile against local state. For real money **the exchange is the source of truth.**
- **Ambiguous state.** On a timeout with no ack → **query order status before re-sending.** Never
  assume; never double-fill.
- **Partial fills.** Track filled qty; manage the position on what actually filled, not what was sent.

---

## 4. Tick-level risk — the real payoff of the stream

Between 5-min bars, the execution plane watches live ticks and acts *immediately* (today a stop waits
up to 5 min for the next cycle):
- **Stop-loss** hit on a tick → fire the exit now.
- **Breakeven-after-cost lock / trailing** (the `position_intel` ladder) → evaluated on ticks.
- **Runner / target** → same logic as paper, tick-responsive.
- **Daily-loss kill-switch** → if day P&L (realised + unrealised) breaches `LIVE_MAX_DAILY_LOSS`,
  **flatten all + disable new entries** until a manual reset. Hard stop, no override from the UI.

The *signals* stay bar-based (that's the edge); only *risk management* becomes real-time.

---

## 5. Safety rails (hard, OS-level — the browser can't touch any of these)

| Rail | Mechanism |
|---|---|
| `ALLOW_LIVE` | Two-key OS-env lock (already in `bot/safety.py`). Absent/one-key → paper. |
| `LIVE_ALLOWED_STRATEGIES` | Allowlist. Only listed, gate-cleared strategies can send orders. |
| `LIVE_MAX_ORDER_NOTIONAL` | Per-order cap. Over → refuse + log. |
| `LIVE_MAX_DAILY_LOSS` | Kill-switch trigger. |
| `LIVE_MAX_OPEN` | Max concurrent live positions. |
| API keys | **Trade permission only, NO withdrawal**, IP-restricted. In `.env` (gitignored). Never in code/state/logs. |
| Kill-switch | One command flattens + disables; also auto-fires on daily-loss breach or feed loss > threshold. |
| Shadow mode | Live path routes to a **mock that logs what it WOULD send** — validate everything before a single real order. |

Config is **OS-env only**. The API/UI can read live status but can **never** arm live or change a cap.

---

## 6. Rollout — staged, per-strategy, never "all at once"

- **Phase 0 — Shadow.** Build the execution plane in shadow mode: real websocket feeds, real
  reconciliation, but orders go to a mock. Prove routing / fills / reconnect / tick-stops / kill-switch
  with zero capital at risk.
- **Phase 1 — One strategy live.** Arm the *single* gate-cleared strategy, smallest size, one symbol,
  `ALLOW_LIVE` + allowlist. Watch **live fills vs paper** → measure real slippage vs the modelled ~15 bps.
- **Phase 2 — Widen slowly.** Only if live tracks paper within tolerance for N sessions, add the next
  gate-cleared strategy. Repeat.
- **Never** arm the whole book at once. Crypto and Indian roll out independently, each on its own gate.

---

## 7. Test & sign-off checklist (the "hardening" gate)

**Unit:** order router (place/cancel/timeout/retry/idempotency) · reconciliation · staleness guard ·
kill-switch · cap enforcement (each cap refuses correctly).

**Integration (shadow, live feeds, full session, both books):**
- [ ] Intents identical to the paper harness (zero divergence) for a full session.
- [ ] Websocket reconnect + backoff verified by forced disconnect.
- [ ] **Fault injection:** kill the feed mid-position · time out an order · duplicate a fill event ·
      double-send under reconnect → **no duplicate orders, correct recovery** every time.
- [ ] Tick-stop fires within one tick of breach; daily-loss kill-switch flattens + disables.

**Sign-off to arm real money (all required):**
- [ ] Shadow clean for **N sessions** (define N, e.g. 5) on the target book.
- [ ] The specific strategy is **past the honest go-live gate**.
- [ ] Caps + allowlist configured; kill-switch tested live with **one minimal real order**.
- [ ] Keys are trade-only + IP-restricted; nothing secret in git.

---

## 8. Latency budget (set the expectation correctly)

| Stage | Time |
|---|---|
| Websocket tick → machine | ~20–150 ms (network, unavoidable) |
| Strategy decision (**measured**) | **1–12 ms** |
| Order → exchange ack | ~50–300 ms |
| **Signal-to-fill total** | **~100–500 ms** — i.e. 0.1–0.5 s of a 300 s bar |

Sub-millisecond is an explicit **non-goal** (co-location/HFT territory, no effect on bar-strategy edge).
The objective is **fill fidelity**: the price you fill ≈ the price you decided on.

---

## 9. Build order (when we start)

1. `BinanceBroker` + extend `KiteBroker`; `OrderRouter` with idempotency + reconciliation. **Shadow.**
2. Websocket feed adapters (Binance streams · KiteTicker) + staleness guard + reconnect.
3. Tick-level risk loop (stops / trail / kill-switch) layered on `position_intel`.
4. Safety-rail wiring (`ALLOW_LIVE`, allowlist, caps) + hard kill-switch command.
5. Fault-injection test suite → shadow soak → Phase-1 arm one strategy.

**Everything in `bot/` (signals, edge-gate, profit-lock, runner, governor, regime-fit, cull) is reused
unchanged.** Live changes only HOW an intent becomes a fill, never WHAT the intent is.
