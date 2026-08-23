# Go-live bar (product spec)

A strategy may be considered for **live execution** (future Pro feature) only when **all** are true on the user's forward paper book:

| Gate | Threshold |
|------|-----------|
| Closed trades | ≥ 30 |
| Net P&L after costs | > 0 |
| Profit factor | ≥ 1.1 |
| Regime coverage | Positive expectancy in ≥ 2 of Bull / Bear / Choppy / High-Vol |
| User tier | Pro or Elite |
| Technical | Live execution rail shipped per `backend/LIVE_EXECUTION_SPEC.md` |

Until the live rail exists, the UI shows **locked** with this checklist (read-only).

**Principle:** No user arms live on backtest alone.
