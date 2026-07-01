# Paper trading — daily runbook

Forward paper-trading runs the validated strategies on **live Kite data with zero real money**.
This is the evidence that earns a strategy its go-live nudge. Do this every trading day.

## Every morning (before ~9:15 IST)

Kite access tokens expire daily, so step 1 is non-negotiable:

```bash
cd ~/kite-mean-reversion-bot
python3 login.py            # opens Kite login → paste the redirect URL/token back
./start_paper.sh           # verifies the token, starts the dashboard API + paper harness
```

`start_paper.sh` will **refuse to start** if the token is stale and tell you to re-run `login.py`.
Leave the terminal running through the session. `Ctrl-C` stops it and saves state.

## What runs

| Strategy | Cadence | Status |
|---|---|---|
| Mean Reversion (RSI+BB) | every 5-min cycle, squared off ~15:15 | candidate (chop-only) |
| Momentum Breakout | once/day after 15:20 (daily bars) | **validated (Bull)** |
| Pairs Stat-Arb | once/day after 15:20 | **validated (market-neutral)** |

State persists to `paper_state.json`, so a multi-day run survives restarts.
Trades stream to `paper_trades.log` and into the dashboard's **Forward Test** tab.

## Watching it

- Dashboard: open TradePro → **Algo → Forward Test** (live paper P&L, open positions, trade feed).
- The **Marketplace** banner shows each proven strategy's forward evidence: `N/10 closed trades`.
  When a strategy reaches **≥10 profitable** closed trades, a green **go-live nudge** appears.

## The two-key gate before ANY real money

A nudge is an invitation to *review*, never an auto-switch. Going live needs BOTH:

1. **Fund the account** — clears the `Funds ≥ minimum` gate (₹0 today).
2. **Arm `ALLOW_LIVE`** — set `ALLOW_LIVE=true` in `.env` on this machine. Without it,
   the system physically cannot place a real order, no matter what you click in the UI.

Run the full audit any time:

```bash
curl -s "http://localhost:8756/api/readiness?strategy=momentum" | python3 -m json.tool
```

## Segments on THIS account (from your live Kite profile)

`NSE · NFO · BSE · BFO · MF` enabled. **Commodity (MCX) is NOT enabled** — the commodity
strategies are correctly blocked by the readiness checklist until you activate that segment (KYC).
