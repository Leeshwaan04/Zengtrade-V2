"""Non-destructive Kite connection test. Places ZERO orders.

Verifies, in order:
  1. .env has API key/secret/token
  2. access_token is valid (fetches your profile)
  3. funds/margins are readable
  4. historical data add-on works (pulls candles for one symbol)
  5. live quote (LTP) works

    python check_connection.py
    python check_connection.py INFY      # test a specific symbol
"""
from __future__ import annotations

import sys

import settings
from bot.config import load_env
from bot import auth
from bot.data import DataFeed


def _ok(msg):  print(f"  \033[32m✓\033[0m {msg}")
def _bad(msg): print(f"  \033[31m✗\033[0m {msg}")


def main() -> None:
    load_env()
    import os

    print("\n[1] Checking .env ...")
    missing = [k for k in ("KITE_API_KEY", "KITE_API_SECRET", "KITE_ACCESS_TOKEN")
               if not os.environ.get(k)]
    if "KITE_API_KEY" in missing or "KITE_API_SECRET" in missing:
        _bad("API key/secret missing in .env — fill them in first.")
        return
    _ok("API key + secret present")
    if "KITE_ACCESS_TOKEN" in missing:
        _bad("KITE_ACCESS_TOKEN empty — run:  python login.py  first.")
        return
    _ok("access_token present")

    kite = auth.make_kite(os.environ["KITE_API_KEY"], os.environ["KITE_ACCESS_TOKEN"])

    print("\n[2] Verifying access_token (profile) ...")
    try:
        profile = kite.profile()
        _ok(f"logged in as {profile['user_name']} ({profile['user_id']})")
    except Exception as e:
        _bad(f"token invalid/expired — re-run python login.py  ({e})")
        return

    print("\n[3] Reading funds/margins ...")
    try:
        eq = kite.margins("equity")
        _ok(f"available cash: ₹{eq['available']['live_balance']:,.2f}")
    except Exception as e:
        _bad(f"could not read margins: {e}")

    symbol = (sys.argv[1] if len(sys.argv) > 1 else settings.SYMBOLS[0]).upper()
    data = DataFeed(kite, exchange="NSE")

    print(f"\n[4] Historical data add-on (testing {symbol}) ...")
    try:
        data.load_instruments()
        token = data.token_for(symbol)
        df = data.historical(token, settings.INTERVAL, 5)
        if df.empty:
            _bad("no candles returned — historical-data subscription may be inactive.")
        else:
            last = df.iloc[-1]
            _ok(f"{len(df)} candles; last close {last['close']:.2f} @ {df.index[-1]}")
    except Exception as e:
        _bad(f"historical data failed (add-on not subscribed?): {e}")

    print(f"\n[5] Live quote (LTP) for {symbol} ...")
    try:
        ltp = data.ltp([symbol])
        _ok(f"{symbol} last price: ₹{ltp[symbol]:,.2f}")
    except Exception as e:
        _bad(f"LTP failed: {e}")

    print("\nDone. No orders were placed.\n")


if __name__ == "__main__":
    main()
