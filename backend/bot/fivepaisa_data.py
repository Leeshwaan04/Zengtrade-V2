"""Free historical data via 5paisa's Xstream API (py5paisa SDK).

Why 5paisa: the API is free (no monthly fee like Zerodha's ₹500) and provides
~6 months of intraday candles (1m/5m/15m/30m/60m) + daily since inception —
deeper than yfinance's 60-day intraday cap, ideal for free strategy validation.

SETUP (you provide, one-time):
  1. A 5paisa trading account.
  2. Create an API app at https://tradestation.5paisa.com / the dev portal to get:
       APP_NAME, APP_SOURCE, USER_ID, USER_KEY, ENCRYPTION_KEY
  3. Your CLIENT_CODE, web-login PIN, and a TOTP (from your authenticator).
Put these in .env (see .env.example). Nothing here runs without them.

Scrip codes: 5paisa identifies instruments by a numeric ScripCode, not the
symbol. Map your symbols in settings.FIVEPAISA_SCRIP (e.g. RELIANCE -> 2885).
"""
from __future__ import annotations

import os

import pandas as pd


def make_client():
    """Build and log in a FivePaisaClient from env credentials (TOTP session)."""
    from py5paisa import FivePaisaClient

    cred = {
        "APP_NAME": os.environ["FIVEPAISA_APP_NAME"],
        "APP_SOURCE": os.environ["FIVEPAISA_APP_SOURCE"],
        "USER_ID": os.environ["FIVEPAISA_USER_ID"],
        "USER_KEY": os.environ["FIVEPAISA_USER_KEY"],
        "ENCRYPTION_KEY": os.environ["FIVEPAISA_ENCRYPTION_KEY"],
        "PASSWORD": os.environ.get("FIVEPAISA_PASSWORD", ""),
    }
    client = FivePaisaClient(cred=cred)
    # Prefer a TOTP SECRET (seed) so we can generate a fresh code each login —
    # essential for an unattended bot. Fall back to a one-shot live TOTP code.
    totp = os.environ.get("FIVEPAISA_TOTP")
    secret = os.environ.get("FIVEPAISA_TOTP_SECRET")
    if not totp and secret:
        import pyotp
        totp = pyotp.TOTP(secret.replace(" ", "")).now()
    if not totp:
        raise SystemExit("Set FIVEPAISA_TOTP_SECRET (preferred) or FIVEPAISA_TOTP in .env")
    client.get_totp_session(
        os.environ["FIVEPAISA_CLIENT_CODE"], totp, os.environ["FIVEPAISA_PIN"]
    )
    return client


# our intervals map straight onto 5paisa's TimeFrame strings
_TF = {"1minute": "1m", "5minute": "5m", "15minute": "15m",
       "30minute": "30m", "60minute": "60m", "day": "1d",
       "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m", "60m": "60m", "1d": "1d"}


def history(
    client, scrip_code: int, interval: str = "5m",
    frm: str = "2026-01-01", to: str = "2026-06-24",
    exchange: str = "N", exchange_type: str = "C",
) -> pd.DataFrame:
    """Fetch OHLCV candles. exchange N=NSE/B=BSE, exchange_type C=cash/D=deriv.

    Returns a DataFrame indexed by datetime with open/high/low/close/volume —
    same shape the strategy/backtester expect, so it drops straight in.
    """
    tf = _TF.get(interval, interval)
    df = client.historical_data(exchange, exchange_type, scrip_code, tf, frm, to)
    if df is None or len(df) == 0:
        return pd.DataFrame()
    df = df.rename(columns=str.lower)
    df = df.rename(columns={"datetime": "datetime"})
    df["datetime"] = pd.to_datetime(df["datetime"])
    return df.set_index("datetime")[["open", "high", "low", "close", "volume"]]
