# zengtrade: Crypto Algo Studio

Systematic crypto trading on **live Binance spot prices**. Paper-first, regime-aware, honest costs.

## Quick start

```bash
# Install deps
.cursor/scripts/install.sh

# Frontend (port 8011): the Algo Studio terminal shell, zero deps
python3 serve.py
```

Open http://localhost:8011 for the terminal UI itself. Live crypto data (Monitor, Forward Test,
Analytics) is published by the 24/7 worker, not a local API server, run it against the real
Supabase backend to see live data locally:

```bash
cd saas/worker && python3 worker.py --interval 300
```

This writes to the same `engine_state`/`trade`/`book_state` tables the deployed `/dashboard`
reads, so the fastest way to see it end-to-end is the deployed site itself
(https://zengtrade.in/dashboard) rather than the bare local terminal shell.

## What it does

- **Backtest** strategies on real Binance historical data with honest friction (135 bps spot)
- **Forward paper trade** 24/7 on live prices, no exchange keys required
- **Regime engine**: Bull / Bear / Choppy / High-Vol gates which strategies may trade
- **Risk governor**: concentration caps, drawdown tiers, anti-churn cost gate
- **Monitor**: per-strategy realised + unrealised P&L marked to live LTP

See [docs/CRYPTO_PRODUCT.md](docs/CRYPTO_PRODUCT.md) for the full product vision and user problems solved.

## Tests

```bash
python3 saas/tests/rls_isolation.py
node saas/tests/nowpayments_signature.mjs
```

## Indian market

This product is crypto-only, trading via Binance's public API. The prior NSE/Kite/Zerodha
integration and its local dev harness (`backend/`, `archive/indian/`) have been removed entirely,
not just archived.

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
