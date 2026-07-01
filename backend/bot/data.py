"""Market data access via Kite Connect: instrument lookup, historical candles,
and live quotes. Returns clean pandas DataFrames the strategy can consume.
"""
from __future__ import annotations

from datetime import datetime, timedelta

import pandas as pd


class DataFeed:
    def __init__(self, kite, exchange: str = "NSE"):
        self.kite = kite
        self.exchange = exchange
        self._instruments: pd.DataFrame | None = None

    def load_instruments(self) -> None:
        self._instruments = pd.DataFrame(self.kite.instruments(self.exchange))

    def token_for(self, symbol: str) -> int:
        """Map a trading symbol (e.g. 'RELIANCE') to its instrument_token."""
        if self._instruments is None:
            self.load_instruments()
        match = self._instruments[self._instruments["tradingsymbol"] == symbol]
        if match.empty:
            raise ValueError(f"Symbol {symbol!r} not found on {self.exchange}")
        return int(match.iloc[0]["instrument_token"])

    def historical(
        self, token: int, interval: str = "5minute", days: int = 30
    ) -> pd.DataFrame:
        """Fetch OHLCV candles. interval: minute, 5minute, 15minute, day, etc."""
        to = datetime.now()
        frm = to - timedelta(days=days)
        records = self.kite.historical_data(token, frm, to, interval)
        df = pd.DataFrame(records)
        if df.empty:
            return df
        df = df.rename(columns={"date": "datetime"})
        df["datetime"] = pd.to_datetime(df["datetime"])
        return df.set_index("datetime")[["open", "high", "low", "close", "volume"]]

    def ltp(self, symbols: list[str]) -> dict[str, float]:
        """Last traded price for a list of symbols (e.g. ['RELIANCE'])."""
        keys = [f"{self.exchange}:{s}" for s in symbols]
        data = self.kite.ltp(keys)
        return {k.split(":", 1)[1]: v["last_price"] for k, v in data.items()}
