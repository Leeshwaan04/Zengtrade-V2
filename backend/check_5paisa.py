"""Non-destructive 5paisa connection test. Places ZERO orders.

    python check_5paisa.py

Verifies: credentials present -> login (TOTP session) -> historical candles for
one symbol work. Run this once you've filled the FIVEPAISA_* fields in .env.
"""
from __future__ import annotations

import os

from bot.config import load_env
from bot.fivepaisa_scrips import scrip_for


def _ok(m):  print(f"  \033[32m✓\033[0m {m}")
def _bad(m): print(f"  \033[31m✗\033[0m {m}")

FIELDS = ["FIVEPAISA_APP_NAME", "FIVEPAISA_APP_SOURCE", "FIVEPAISA_USER_ID",
          "FIVEPAISA_USER_KEY", "FIVEPAISA_ENCRYPTION_KEY",
          "FIVEPAISA_CLIENT_CODE", "FIVEPAISA_PIN"]


def main() -> None:
    load_env()
    print("\n[1] Checking .env credentials ...")
    missing = [f for f in FIELDS if not os.environ.get(f)]
    if not (os.environ.get("FIVEPAISA_TOTP_SECRET") or os.environ.get("FIVEPAISA_TOTP")):
        missing.append("FIVEPAISA_TOTP_SECRET (or FIVEPAISA_TOTP)")
    if missing:
        _bad(f"missing: {', '.join(missing)}")
        print("    Fill the FIVEPAISA_* fields in .env, then re-run.")
        return
    _ok("all FIVEPAISA_* fields present")

    print("\n[2] Logging in (TOTP session) ...")
    try:
        from bot.fivepaisa_data import make_client
        client = make_client()
        _ok("login OK")
    except Exception as e:
        _bad(f"login failed: {e}")
        print("    Note: TOTP is time-sensitive — generate a fresh one and retry quickly.")
        return

    print("\n[3] Fetching historical candles (RELIANCE, 5m, last 30d) ...")
    try:
        from bot.fivepaisa_data import history
        df = history(client, scrip_for("RELIANCE"), interval="5m",
                     frm="2026-05-25", to="2026-06-24")
        if df is None or df.empty:
            _bad("no candles returned — check market-data entitlement / dates")
        else:
            _ok(f"{len(df)} candles; last close {df['close'].iloc[-1]:.2f} @ {df.index[-1]}")
    except Exception as e:
        _bad(f"historical fetch failed: {e}")

    print("\nDone. No orders were placed.\n")


if __name__ == "__main__":
    main()
