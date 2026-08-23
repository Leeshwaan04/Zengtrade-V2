# zengtrade — Crypto Algo Studio

Systematic crypto trading on **live Binance spot prices**. Paper-first, regime-aware, honest costs.

## Quick start

```bash
# Install deps
.cursor/scripts/install.sh

# Terminal 1 — crypto API (port 8756)
cd backend && python3 crypto_api.py

# Terminal 2 — 24/7 paper harness
cd backend && python3 paper_trade_crypto.py

# Terminal 3 — frontend (port 8011)
python3 serve.py
```

Open http://localhost:8011 — Algo Studio loads in crypto-only mode.

## What it does

- **Backtest** strategies on real Binance historical data with honest friction (135 bps spot)
- **Forward paper trade** 24/7 on live prices — no exchange keys required
- **Regime engine** — Bull / Bear / Choppy / High-Vol gates which strategies may trade
- **Risk governor** — concentration caps, drawdown tiers, anti-churn cost gate
- **Monitor** — per-strategy realised + unrealised P&L marked to live LTP

See [docs/CRYPTO_PRODUCT.md](docs/CRYPTO_PRODUCT.md) for the full product vision and user problems solved.

## Tests

```bash
cd backend
python3 tests/test_indicators.py
python3 tests/test_crypto_guards.py
python3 demo_backtest.py
```

## Indian market (removed)

NSE/Kite/Zerodha integration has been archived to `archive/indian/`. This repository targets crypto markets only.

## Production launch (zengtrade.in)

**Founder dashboard:** https://zengtrade.in/ops · **P0 checklist:** https://zengtrade.in/ops/p0

| Doc | Purpose |
|-----|---------|
| [docs/STATUS.md](docs/STATUS.md) | Live ship gates + P0 blocker |
| [docs/FOUNDER_DEPLOY.md](docs/FOUNDER_DEPLOY.md) | Supabase, worker, billing |
| [docs/GROWTH_DASHBOARD.md](docs/GROWTH_DASHBOARD.md) | Daily autopilot progress |
| [docs/LAUNCH_RUNBOOK.md](docs/LAUNCH_RUNBOOK.md) | P0/P1/P2 checklist |

```bash
./scripts/run-p0-if-ready.sh              # agent: auto-apply when DATABASE_PASSWORD set
./scripts/check-parallel-growth.sh        # while worker blocked
./scripts/guide-founder-parallel.sh       # founder playbook (parallel + sales + manuals)
./tests/e2e_smoke.sh
SITE=https://zengtrade.in ./scripts/check-production.sh
```
