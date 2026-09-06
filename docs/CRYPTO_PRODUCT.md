# zengtrade: Crypto Product Vision

zengtrade is a **crypto-only algorithmic trading studio** for systematic traders who want honest evidence before risking capital. We paper-trade proven strategies on **live Binance spot prices**, 24/7, with full cost modelling, then gate live execution behind a real forward track record.

---

## Who we serve

| Persona | Profile | Primary job |
|---------|---------|-------------|
| **Systematic trader** | Trades BTC/ETH/alts with rules, not gut feel | Find, test, and deploy strategies with measurable edge |
| **Quant-curious builder** | Technical, may code or tune parameters | Backtest → forward-test → deploy without building infra |
| **Risk-conscious allocator** | Won't YOLO; wants survival-first compounding | Know when *not* to trade; size positions by regime |

We do **not** target: manual scalpers who want a slick charting terminal, Indian equity investors, or users who want guaranteed returns.

---

## Problems we solve (and how)

### 1. “I can't trust backtests”

**Problem:** Most crypto tools show cherry-picked backtests with unrealistic fills, no fees, and no slippage. Strategies look amazing in-sample and die live.

**How zengtrade helps:**
- Backtests use **real Binance historical klines** with honest round-trip costs (135 bps for spot, includes fee + slippage + tax friction model).
- **Out-of-sample splits** and regime-fit matrices show *where* a strategy works (Bull vs Bear vs High-Vol), not just average CAGR fantasy.
- Forward paper trading runs on **live prices** with the same engine, so backtest → forward is apples-to-apples.

### 2. “I overtrade in chop and bleed on fees”

**Problem:** Crypto spot has brutal friction (especially with Indian TDS on INR rails). High-turnover strategies churn to death.

**How zengtrade helps:**
- **Cost gate:** trades below `EDGE_MULT × round-trip cost` are skipped: anti-churn by design.
- **Regime gating:** in Bear/High-Vol, directional longs stand down; only market-neutral and carry strategies take new risk.
- **Governor:** portfolio-level caps on concentration, sector crowding (all alts = one bet), and drawdown tiers.

### 3. “I don't know when the market regime changed”

**Problem:** A momentum strategy that crushes in a bull run gets destroyed in a bear. Most bots keep trading blindly.

**How zengtrade helps:**
- **Regime engine** (Bull / Bear / Choppy / High-Vol) derived from BTC structure (50/200 SMA + ATR).
- **Regime-fit matrix** per strategy, see which specialists are enabled in each regime.
- **Rebalancer** auto-pauses strategies that don't belong in the current regime.

### 4. “Paper trading elsewhere is fake”

**Problem:** Many “paper” modes use stale prices, invented fills, or reset P&L. You can't learn anything.

**How zengtrade helps:**
- Paper book marks to **live Binance spot LTP** every cycle.
- State persists in `crypto_state.json`: survives restarts.
- Monitor shows **realised + unrealised** P&L per strategy, per position, with health scores and stop rationale.
- **No fabricated numbers**: if data is unavailable, UI shows `-`, not a lie.

### 5. “Going live is a cliff: no evidence bar”

**Problem:** Users flip from backtest to real money with no forward proof. One bad week wipes the account.

**How zengtrade helps:**
- **Forward Test tab**: watch strategies trade live on paper for weeks.
- **Accuracy / Readiness gates**, closed-trade count, positive expectancy, regime-fit before nudging live.
- **Three-key safety:** `PAPER` default + `ALLOW_LIVE` OS flag + explicit user arming (live unlocks only after track record clears the bar).
- Non-custodial: **no exchange keys in the browser** for cloud edition; paper only until proven.

### 6. “I can't monitor 20 strategies at once”

**Problem:** Running multiple bots manually means missed stops, duplicate exposure, and no portfolio view.

**How zengtrade helps:**
- **Algo Studio**: Monitor, Library, Positions, Forward Test, Accuracy, Analytics, Risk Governor, Backtest in one surface.
- **Opportunity engine** (meta-strategy) scores setups 0–100 and refuses low-quality trades.
- **Allocation dials**: set capital weight per strategy (0–100%).
- **Analytics**: correlation, drawdown, win rate, cost drag across the book.

### 7. “I need 24/7 coverage without babysitting”

**Problem:** Crypto never sleeps. Manual traders miss moves; cron jobs miss regime shifts.

**How zengtrade helps:**
- **24/7 paper harness** (`paper_trade_crypto.py`): 5-minute cycle, no square-off.
- Cloud **worker** (SaaS) runs deployed strategies per user on live prices.
- Regime + governor rebalance automatically between cycles.

### 8. “SaaS crypto bots feel like black boxes”

**Problem:** Subscribe to a signal service → no idea what's inside, no control, no audit trail.

**How zengtrade helps:**
- **Explainable decisions**: every trade logged with strategy id, regime, and gate outcome.
- **Strategy library** with plain-English verdicts (validated vs candidate vs retired).
- **Per-user isolation** (RLS): your book is yours; multi-tenant by design.
- Open cost model and regime rules, not a secret sauce pitch.

---

## Core feature map (crypto)

| Feature | User benefit |
|---------|--------------|
| **Live crypto tape** | Real-time BTC/ETH/SOL+ prices via Binance public API |
| **Regime engine** | Trade the right strategies for the current market structure |
| **Strategy library** | 15+ systematic strategies (momentum, mean-rev, pairs, perps, options structures) |
| **Backtest** | Historical proof on Binance data with honest costs |
| **Forward paper** | Live proof before capital risk |
| **Monitor** | Real-time P&L, positions, governor health |
| **Risk Governor** | Portfolio-level survival controls |
| **Allocation** | Capital dials per strategy |
| **Analytics** | Book-level stats, correlation, drawdown |
| **Cloud SaaS** | Sign up, deploy, track record, no local Mac required |

---

## What we explicitly don't promise

- Guaranteed returns or “moonshot” compounding targets
- Financial advice or personalised recommendations
- Instant live execution on signup (paper-first is deliberate)
- Indian equities, NSE, Kite, or fiat INR brokerage integration

---

## Positioning statement

> **zengtrade is the honest crypto algo studio**. Prove your edge on live prices with real costs, survive bad regimes with portfolio controls, and only go live when the forward book earns it.
