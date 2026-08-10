# Archived — Indian market edition (deprecated)

These scripts powered the original NSE/Kite/Zerodha integration. zengtrade is now **crypto-only**.

| File | Was |
|------|-----|
| `paper_trade_all.py` | NSE paper forward harness |
| `login.py` / `auto_login.py` | Kite daily token refresh |
| `start_paper.sh` | One-command Indian paper day |
| `run_bot.py` | Legacy live Kite runner (4 strategies) |
| `validate_kite.py` | Kite OOS validation |
| `qa_e2e.py` | Kite-dependent E2E QA |

**Active crypto stack:** `crypto_api.py`, `paper_trade_crypto.py`, `demo_backtest.py`, `tests/test_crypto_guards.py`.

Shared strategy engines remain in `backend/bot/` — they are market-agnostic and used by the crypto harness.
