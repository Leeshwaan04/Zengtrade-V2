"""Library of globally-recognised equity strategy archetypes.

Each conforms to the same interface (compute / _entry_long / _exit_long) so it
plugs straight into the Backtester and the regime backtest. Long-only (valid for
delivery). These are real, named strategies traders use worldwide — but each
still has to EARN its place by passing the regime-segmented backtest.
"""
from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from . import indicators


# ---------------------------------------------------------------- RSI(2), Connors
@dataclass
class RSI2Config:
    rsi_period: int = 2
    rsi_buy: float = 10.0
    exit_sma: int = 5
    trend_period: int = 200
    atr_period: int = 14


class RSI2Strategy:
    """Larry Connors RSI(2): buy deep short-term oversold INSIDE a long uptrend,
    exit when price closes back above a fast SMA. A classic mean-reversion edge."""

    def __init__(self, cfg: RSI2Config | None = None):
        self.cfg = cfg or RSI2Config()

    def compute(self, df):
        out = df.copy(); c = out["close"]
        out["rsi2"] = indicators.rsi(c, self.cfg.rsi_period)
        out["exit_sma"] = indicators.sma(c, self.cfg.exit_sma)
        out["trend_sma"] = indicators.sma(c, self.cfg.trend_period)
        out["atr"] = indicators.atr(out["high"], out["low"], out["close"], self.cfg.atr_period)
        out["bb_lower"] = out["trend_sma"]  # warmup gate for the backtester
        return out

    def _entry_long(self, row):
        t = row.get("trend_sma")
        if t is None or pd.isna(t) or row["close"] < t:
            return False
        r = row.get("rsi2")
        return r is not None and not pd.isna(r) and r < self.cfg.rsi_buy

    def _exit_long(self, row):
        s = row.get("exit_sma")
        return s is not None and not pd.isna(s) and row["close"] > s


# ---------------------------------------------------------------- MA crossover (Golden Cross)
@dataclass
class MACrossConfig:
    fast: int = 50
    slow: int = 200
    trend_period: int = 200
    atr_period: int = 14


class MACrossStrategy:
    """50/200 SMA 'golden cross' trend-following: hold while fast > slow."""

    def __init__(self, cfg: MACrossConfig | None = None):
        self.cfg = cfg or MACrossConfig()

    def compute(self, df):
        out = df.copy(); c = out["close"]
        out["ma_fast"] = indicators.sma(c, self.cfg.fast)
        out["ma_slow"] = indicators.sma(c, self.cfg.slow)
        out["trend_sma"] = out["ma_slow"]
        out["atr"] = indicators.atr(out["high"], out["low"], out["close"], self.cfg.atr_period)
        out["bb_lower"] = out["ma_slow"]
        return out

    def _entry_long(self, row):
        f, s = row.get("ma_fast"), row.get("ma_slow")
        return None not in (f, s) and not pd.isna(f) and not pd.isna(s) and f > s

    def _exit_long(self, row):
        f, s = row.get("ma_fast"), row.get("ma_slow")
        return None not in (f, s) and not pd.isna(s) and f < s


# ---------------------------------------------------------------- Supertrend
@dataclass
class SupertrendConfig:
    period: int = 10
    mult: float = 3.0
    trend_period: int = 50
    atr_period: int = 14


def supertrend_direction(high, low, close, period=10, mult=3.0):
    atr = indicators.atr(high, low, close, period)
    hl2 = (high + low) / 2
    upper = hl2 + mult * atr
    lower = hl2 - mult * atr
    fu = upper.copy(); fl = lower.copy()
    direction = pd.Series(1, index=close.index)
    for i in range(1, len(close)):
        fu.iat[i] = upper.iat[i] if (upper.iat[i] < fu.iat[i-1] or close.iat[i-1] > fu.iat[i-1]) else fu.iat[i-1]
        fl.iat[i] = lower.iat[i] if (lower.iat[i] > fl.iat[i-1] or close.iat[i-1] < fl.iat[i-1]) else fl.iat[i-1]
        if close.iat[i] > fu.iat[i-1]:
            direction.iat[i] = 1
        elif close.iat[i] < fl.iat[i-1]:
            direction.iat[i] = -1
        else:
            direction.iat[i] = direction.iat[i-1]
    return direction


class SupertrendStrategy:
    """Supertrend (ATR-band) trend-follower — very popular in Indian markets.
    Long while the trend direction is up."""

    def __init__(self, cfg: SupertrendConfig | None = None):
        self.cfg = cfg or SupertrendConfig()

    def compute(self, df):
        out = df.copy()
        out["st_dir"] = supertrend_direction(out["high"], out["low"], out["close"],
                                             self.cfg.period, self.cfg.mult)
        out["atr"] = indicators.atr(out["high"], out["low"], out["close"], self.cfg.atr_period)
        out["bb_lower"] = indicators.sma(out["close"], self.cfg.trend_period)  # warmup gate
        return out

    def _entry_long(self, row):
        return row.get("st_dir") == 1

    def _exit_long(self, row):
        return row.get("st_dir") == -1


# ---------------------------------------------------------------- EMA Crossover (faster trend)
@dataclass
class EMACrossConfig:
    fast: int = 20
    slow: int = 50
    trend_period: int = 50      # warmup gate = slow EMA
    atr_period: int = 14


class EMACrossStrategy:
    """20/50 EMA crossover — a faster trend-follower than the 50/200 golden cross.
    Long while the fast EMA is above the slow EMA and price holds the slow EMA."""

    def __init__(self, cfg: EMACrossConfig | None = None):
        self.cfg = cfg or EMACrossConfig()

    def compute(self, df):
        out = df.copy(); c = out["close"]
        out["ema_fast"] = indicators.ema(c, self.cfg.fast)
        out["ema_slow"] = indicators.ema(c, self.cfg.slow)
        out["atr"] = indicators.atr(out["high"], out["low"], out["close"], self.cfg.atr_period)
        out["bb_lower"] = out["ema_slow"]   # warmup NaN-gate for the backtester/engine
        return out

    def _entry_long(self, row):
        f, s = row.get("ema_fast"), row.get("ema_slow")
        if None in (f, s) or pd.isna(f) or pd.isna(s):
            return False
        return f > s and row["close"] >= s

    def _exit_long(self, row):
        f, s = row.get("ema_fast"), row.get("ema_slow")
        return None not in (f, s) and not pd.isna(f) and not pd.isna(s) and f < s


# ---------------------------------------------------------------- ADX Trend Filter (DI cross + strength)
@dataclass
class ADXTrendConfig:
    adx_period: int = 14
    adx_min: float = 25.0
    trend_period: int = 50      # only go long above this SMA
    atr_period: int = 14


class ADXTrendStrategy:
    """Directional-movement trend system: long only when ADX confirms a strong trend
    (ADX > 25), +DI leads -DI, and price is above the trend SMA. Exits when the trend
    fades (DI cross down or ADX collapses). The ADX filter is what cuts chop trades."""

    def __init__(self, cfg: ADXTrendConfig | None = None):
        self.cfg = cfg or ADXTrendConfig()

    def compute(self, df):
        out = df.copy()
        a, pdi, mdi = indicators.adx(out["high"], out["low"], out["close"], self.cfg.adx_period)
        out["adx"] = a; out["plus_di"] = pdi; out["minus_di"] = mdi
        out["trend_sma"] = indicators.sma(out["close"], self.cfg.trend_period)
        out["atr"] = indicators.atr(out["high"], out["low"], out["close"], self.cfg.atr_period)
        out["bb_lower"] = out["trend_sma"]
        return out

    def _entry_long(self, row):
        a, pdi, mdi, t = row.get("adx"), row.get("plus_di"), row.get("minus_di"), row.get("trend_sma")
        if any(v is None or pd.isna(v) for v in (a, pdi, mdi, t)):
            return False
        return a >= self.cfg.adx_min and pdi > mdi and row["close"] >= t

    def _exit_long(self, row):
        a, pdi, mdi = row.get("adx"), row.get("plus_di"), row.get("minus_di")
        if any(v is None or pd.isna(v) for v in (a, pdi, mdi)):
            return False
        return mdi > pdi or a < (self.cfg.adx_min - 5)


# ---------------------------------------------------------------- Bollinger Band Reversion
@dataclass
class BollingerRevConfig:
    bb_period: int = 20
    num_std: float = 2.0
    trend_period: int = 200     # mean-revert only INSIDE an uptrend (avoids catching falling knives)
    atr_period: int = 14


class BollingerRevStrategy:
    """Buys a close below the lower Bollinger band while still in a 200-SMA uptrend,
    exits on a reversion back to the band mid. A range/dip-buy mean-reversion edge."""

    def __init__(self, cfg: BollingerRevConfig | None = None):
        self.cfg = cfg or BollingerRevConfig()

    def compute(self, df):
        out = df.copy(); c = out["close"]
        mid, upper, lower = indicators.bollinger_bands(c, self.cfg.bb_period, self.cfg.num_std)
        out["bb_mid"] = mid; out["bb_up_band"] = upper; out["bb_low_band"] = lower
        out["trend_sma"] = indicators.sma(c, self.cfg.trend_period)
        out["atr"] = indicators.atr(out["high"], out["low"], out["close"], self.cfg.atr_period)
        out["bb_lower"] = out["trend_sma"]   # warmup gate waits for the (longer) trend filter
        return out

    def _entry_long(self, row):
        lb, t = row.get("bb_low_band"), row.get("trend_sma")
        if None in (lb, t) or pd.isna(lb) or pd.isna(t):
            return False
        return row["close"] < lb and row["close"] >= t

    def _exit_long(self, row):
        m = row.get("bb_mid")
        return m is not None and not pd.isna(m) and row["close"] >= m


# ---------------------------------------------------------------- Z-Score Mean Reversion
@dataclass
class ZScoreRevConfig:
    z_period: int = 10          # FASTER lookback than Bollinger(20) → a distinct, quicker reversion
    entry_z: float = -1.5       # shallower trigger (a 2σ trigger is identical to the Bollinger band)
    exit_z: float = 0.0
    trend_period: int = 200
    atr_period: int = 14


class ZScoreRevStrategy:
    """Buys when price is >1.5 standard deviations below its 10-bar rolling mean
    (statistically stretched) inside an uptrend; exits on reversion to the mean
    (z >= 0). Faster and shallower than the Bollinger band reversion — deliberately
    a different trade profile, exits on the signal (run with target_atr_mult=0)."""

    def __init__(self, cfg: ZScoreRevConfig | None = None):
        self.cfg = cfg or ZScoreRevConfig()

    def compute(self, df):
        out = df.copy(); c = out["close"]
        out["zs"] = indicators.zscore(c, self.cfg.z_period)
        out["trend_sma"] = indicators.sma(c, self.cfg.trend_period)
        out["atr"] = indicators.atr(out["high"], out["low"], out["close"], self.cfg.atr_period)
        out["bb_lower"] = out["trend_sma"]
        return out

    def _entry_long(self, row):
        z, t = row.get("zs"), row.get("trend_sma")
        if None in (z, t) or pd.isna(z) or pd.isna(t):
            return False
        return z <= self.cfg.entry_z and row["close"] >= t

    def _exit_long(self, row):
        z = row.get("zs")
        return z is not None and not pd.isna(z) and z >= self.cfg.exit_z


# ---------------------------------------------------------------- NR7 Inside-Bar Breakout
@dataclass
class NR7Config:
    nr_lookback: int = 7        # narrowest range of the last N bars
    trend_period: int = 50      # only trade breakouts in the trend direction
    atr_period: int = 14


class NR7Strategy:
    """Volatility-contraction breakout: after the narrowest-range bar in 7 (a coiled
    spring), go long on a break above that bar's high — but only in an uptrend.
    Exits below the trend SMA (the trailing structure) or the ATR stop."""

    def __init__(self, cfg: NR7Config | None = None):
        self.cfg = cfg or NR7Config()

    def compute(self, df):
        out = df.copy()
        rng = out["high"] - out["low"]
        is_nr = rng <= rng.rolling(self.cfg.nr_lookback).min()      # narrowest (ties count)
        out["nr_prev"] = is_nr.shift(1, fill_value=False)           # was PRIOR bar the coil?
        out["trigger_high"] = out["high"].shift(1)                  # break PRIOR bar's high
        out["trend_sma"] = indicators.sma(out["close"], self.cfg.trend_period)
        out["atr"] = indicators.atr(out["high"], out["low"], out["close"], self.cfg.atr_period)
        out["bb_lower"] = out["trend_sma"]
        return out

    def _entry_long(self, row):
        t, th = row.get("trend_sma"), row.get("trigger_high")
        if None in (t, th) or pd.isna(t) or pd.isna(th):
            return False
        return bool(row.get("nr_prev")) and row["close"] > th and row["close"] >= t

    def _exit_long(self, row):
        t = row.get("trend_sma")
        return t is not None and not pd.isna(t) and row["close"] < t


# ================== INTRADAY (5-minute, session-aware) ==================
# These run on the 5-min paper engine with daily square-off. compute() groups by
# trading day so the opening range / VWAP reset each session (no cross-day leakage).

@dataclass
class ORBConfig:
    or_bars: int = 3            # first 3×5min = first 15 minutes = the opening range
    vol_mult: float = 1.3       # breakout bar must carry above-average volume (real conviction)
    buf_atr: float = 0.10       # require a close this many ATRs ABOVE the range high (skip a marginal poke)
    trend_period: int = 12      # small warmup gate (intraday)
    atr_period: int = 14


class ORBStrategy:
    """Opening Range Breakout: marks the first 15 minutes' high/low, then goes long on a
    break above the range high; exits on a break below the range low (or the engine's
    daily square-off). A classic high-volatility intraday momentum play.

    Two confirmations reject the fakeout breaks that bled the naive version:
      • ATR buffer   → the close must clear the range high by buf_atr×ATR, not just tick past it.
      • volume       → the breakout bar must trade ≥ vol_mult × its 20-bar average volume;
                        a break on thin volume is the classic bull-trap and is skipped."""

    def __init__(self, cfg: ORBConfig | None = None):
        self.cfg = cfg or ORBConfig()

    def compute(self, df):
        out = df.copy()
        day = out.index.normalize()
        out["_n"] = out.groupby(day).cumcount()                 # bar index within the session
        in_or = out["_n"] < self.cfg.or_bars
        # OR high/low = max/min over the opening bars, broadcast to the whole session.
        # Entry is gated to _n >= or_bars, so those bars are all in the past → no look-ahead.
        out["or_high"] = out["high"].where(in_or).groupby(day).transform("max")
        out["or_low"] = out["low"].where(in_or).groupby(day).transform("min")
        out["vsma"] = indicators.sma(out["volume"], 20)
        out["atr"] = indicators.atr(out["high"], out["low"], out["close"], self.cfg.atr_period)
        out["bb_lower"] = out["or_high"]                        # warmup gate
        return out

    def _entry_long(self, row):
        oh, n, a, vs = row.get("or_high"), row.get("_n"), row.get("atr"), row.get("vsma")
        if oh is None or pd.isna(oh) or n is None or n < self.cfg.or_bars:
            return False
        buf = self.cfg.buf_atr * a if a and not pd.isna(a) else 0.0
        if row["close"] <= oh + buf:
            return False                                        # not a clean break beyond the range
        if vs is not None and not pd.isna(vs) and vs > 0 and row["volume"] < self.cfg.vol_mult * vs:
            return False                                        # thin-volume break = bull trap → skip
        return True

    def _exit_long(self, row):
        ol = row.get("or_low")
        return ol is not None and not pd.isna(ol) and row["close"] < ol


@dataclass
class VWAPRevConfig:
    dist_atr: float = 1.5       # enter when price is this many ATRs BELOW the session VWAP
    adx_max: float = 22.0       # ONLY fade on a range day — never into a strong trend (falling-knife guard)
    adx_period: int = 14
    trend_period: int = 12
    atr_period: int = 14


class VWAPRevStrategy:
    """Intraday VWAP reversion: when price stretches well below the session VWAP (a panic
    dip on a BALANCED day), buy expecting reversion back to VWAP; exit at VWAP (or square-off).

    Two guards keep it from fading a genuine one-way trend (the classic mean-reversion killer):
      • ADX < adx_max  → the tape is ranging, not trending. A high-ADX down-day is NOT faded.
      • bounce confirm → the current bar must close ABOVE the prior bar (the knife has stopped
        falling). No catching a live down-move; wait for the first up-tick.
    Session VWAP resets each day via a per-day cumulative calc (no look-ahead)."""

    def __init__(self, cfg: VWAPRevConfig | None = None):
        self.cfg = cfg or VWAPRevConfig()

    def compute(self, df):
        out = df.copy()
        day = out.index.normalize()
        tp = (out["high"] + out["low"] + out["close"]) / 3.0
        out["vwap"] = (tp * out["volume"]).groupby(day).cumsum() / out["volume"].groupby(day).cumsum()
        adx, _pdi, _mdi = indicators.adx(out["high"], out["low"], out["close"], self.cfg.adx_period)
        out["adx"] = adx
        out["prev_close"] = out["close"].groupby(day).shift(1)   # per-day → no cross-session bleed
        out["atr"] = indicators.atr(out["high"], out["low"], out["close"], self.cfg.atr_period)
        out["bb_lower"] = out["vwap"]                           # warmup gate
        return out

    def _entry_long(self, row):
        v, a, adx, pc = row.get("vwap"), row.get("atr"), row.get("adx"), row.get("prev_close")
        if v is None or pd.isna(v) or not a:
            return False
        if adx is None or pd.isna(adx) or adx >= self.cfg.adx_max:
            return False                                        # trending tape → don't fade it
        if pc is None or pd.isna(pc) or row["close"] <= pc:
            return False                                        # no up-tick yet → don't catch the knife
        return (v - row["close"]) >= self.cfg.dist_atr * a      # stretched below VWAP + range + bounce

    def _exit_long(self, row):
        v = row.get("vwap")
        return v is not None and not pd.isna(v) and row["close"] >= v   # reverted to VWAP


# ---------------------------------------------------------------- VWAP Momentum (intraday trend)
@dataclass
class VWAPMomConfig:
    vol_mult: float = 1.2       # require firm volume
    trend_period: int = 12
    atr_period: int = 14


class VWAPMomStrategy:
    """Intraday VWAP momentum (the trend side, opposite of VWAP reversion): long when price
    holds ABOVE the session VWAP with a rising EMA9 and above-average volume — riding the day's
    trend. Exits when price loses VWAP, or at square-off. The workhorse intraday trend play."""

    def __init__(self, cfg: VWAPMomConfig | None = None):
        self.cfg = cfg or VWAPMomConfig()

    def compute(self, df):
        out = df.copy()
        day = out.index.normalize()
        tp = (out["high"] + out["low"] + out["close"]) / 3.0
        out["vwap"] = (tp * out["volume"]).groupby(day).cumsum() / out["volume"].groupby(day).cumsum()
        out["ema9"] = indicators.ema(out["close"], 9)
        out["vsma"] = indicators.sma(out["volume"], 20)
        out["atr"] = indicators.atr(out["high"], out["low"], out["close"], self.cfg.atr_period)
        out["bb_lower"] = out["vwap"]
        return out

    def _entry_long(self, row):
        v, e, vs = row.get("vwap"), row.get("ema9"), row.get("vsma")
        if any(x is None or pd.isna(x) for x in (v, e, vs)):
            return False
        return row["close"] > v and row["close"] >= e and row["volume"] >= self.cfg.vol_mult * vs

    def _exit_long(self, row):
        v = row.get("vwap")
        return v is not None and not pd.isna(v) and row["close"] < v


# ---------------------------------------------------------------- EMA 9/21 Scalp (fast intraday momentum)
@dataclass
class EMAScalpConfig:
    fast: int = 9
    slow: int = 21
    vol_mult: float = 1.1
    trend_period: int = 21
    atr_period: int = 14


class EMAScalpStrategy:
    """Fast 5-min momentum scalp: long when EMA9 > EMA21, price holds above EMA9, and volume is
    firm. Exits on a close back below EMA21 (or square-off). Pair with a tight ATR stop + quick
    target for in-and-out intraday momentum bursts."""

    def __init__(self, cfg: EMAScalpConfig | None = None):
        self.cfg = cfg or EMAScalpConfig()

    def compute(self, df):
        out = df.copy(); c = out["close"]
        out["ema_f"] = indicators.ema(c, self.cfg.fast)
        out["ema_s"] = indicators.ema(c, self.cfg.slow)
        out["vsma"] = indicators.sma(out["volume"], 20)
        out["atr"] = indicators.atr(out["high"], out["low"], out["close"], self.cfg.atr_period)
        out["bb_lower"] = out["ema_s"]
        return out

    def _entry_long(self, row):
        f, s, vs = row.get("ema_f"), row.get("ema_s"), row.get("vsma")
        if any(x is None or pd.isna(x) for x in (f, s, vs)):
            return False
        return f > s and row["close"] >= f and row["volume"] >= self.cfg.vol_mult * vs

    def _exit_long(self, row):
        s = row.get("ema_s")
        return s is not None and not pd.isna(s) and row["close"] < s


# ---------------------------------------------------------------- Bollinger Squeeze Breakout (intraday)
@dataclass
class BBBreakConfig:
    period: int = 20
    num_std: float = 2.0
    squeeze_lookback: int = 30   # bandwidth must be in the tighter half of this window (a coil)
    trend_period: int = 21
    atr_period: int = 14


class BBBreakStrategy:
    """Intraday Bollinger squeeze breakout: after a volatility contraction (bands tighter than
    their recent average — a coil), go long on a close above the upper band with volume — riding
    the expansion. Exits on a close back below the mid band (or square-off)."""

    def __init__(self, cfg: BBBreakConfig | None = None):
        self.cfg = cfg or BBBreakConfig()

    def compute(self, df):
        out = df.copy(); c = out["close"]
        mid, upper, lower = indicators.bollinger_bands(c, self.cfg.period, self.cfg.num_std)
        out["bb_mid"] = mid; out["bb_up"] = upper
        bw = (upper - lower) / mid
        out["bw"] = bw
        out["bw_avg"] = bw.rolling(self.cfg.squeeze_lookback).mean()
        out["vsma"] = indicators.sma(out["volume"], 20)
        out["atr"] = indicators.atr(out["high"], out["low"], out["close"], self.cfg.atr_period)
        out["bb_lower"] = out["bb_mid"]
        return out

    def _entry_long(self, row):
        up, m, bw, bwa, vs = (row.get("bb_up"), row.get("bb_mid"), row.get("bw"),
                              row.get("bw_avg"), row.get("vsma"))
        if any(x is None or pd.isna(x) for x in (up, m, bw, bwa, vs)):
            return False
        coiled = bw <= bwa            # bands tighter than their recent average = a squeeze
        return coiled and row["close"] > up and row["volume"] >= vs

    def _exit_long(self, row):
        m = row.get("bb_mid")
        return m is not None and not pd.isna(m) and row["close"] < m


# ---------------------------------------------------------------- VWAP Pullback (intraday trend-continuation)
@dataclass
class VWAPPullbackConfig:
    near_atr: float = 0.30      # "at VWAP" = within this many ATRs of the session VWAP
    trend_period: int = 12
    atr_period: int = 14


class VWAPPullbackStrategy:
    """Intraday trend-continuation: on a day trending UP (rising session VWAP, price above it), buy the
    first PULLBACK back to the VWAP that bounces — riding strength, not fading it (the opposite of VWAP
    reversion). Exits when price loses VWAP (trend broke) or at square-off."""

    def __init__(self, cfg: VWAPPullbackConfig | None = None):
        self.cfg = cfg or VWAPPullbackConfig()

    def compute(self, df):
        out = df.copy()
        day = out.index.normalize()
        tp = (out["high"] + out["low"] + out["close"]) / 3.0
        out["vwap"] = (tp * out["volume"]).groupby(day).cumsum() / out["volume"].groupby(day).cumsum()
        out["vwap_prev"] = out["vwap"].groupby(day).shift(1)
        out["prev_close"] = out["close"].groupby(day).shift(1)
        out["atr"] = indicators.atr(out["high"], out["low"], out["close"], self.cfg.atr_period)
        out["bb_lower"] = out["vwap"]
        return out

    def _entry_long(self, row):
        v, vp, a, pc = row.get("vwap"), row.get("vwap_prev"), row.get("atr"), row.get("prev_close")
        if any(x is None or pd.isna(x) for x in (v, vp, a, pc)) or not a:
            return False
        rising = v > vp                                     # session trend is up
        pulled = (row["low"] - v) <= self.cfg.near_atr * a  # dipped to the VWAP
        holds = row["close"] >= v and row["close"] > pc     # reclaimed VWAP + up-tick
        return rising and pulled and holds

    def _exit_long(self, row):
        v = row.get("vwap")
        return v is not None and not pd.isna(v) and row["close"] < v


# ---------------------------------------------------------------- Opening Drive (first-30-min momentum)
@dataclass
class OpeningDriveConfig:
    window: int = 6             # first 6×5min = first 30 minutes = the drive window
    vol_mult: float = 1.2
    trend_period: int = 12
    atr_period: int = 14


class OpeningDriveStrategy:
    """Morning momentum: in the first 30 minutes, if price holds ABOVE the day's open and above the
    session VWAP on above-average volume, ride the opening drive (the most liquid, most trending part of
    the day). Exits on a loss of VWAP or at square-off. Only enters in the opening window."""

    def __init__(self, cfg: OpeningDriveConfig | None = None):
        self.cfg = cfg or OpeningDriveConfig()

    def compute(self, df):
        out = df.copy()
        day = out.index.normalize()
        out["_n"] = out.groupby(day).cumcount()
        out["day_open"] = out["open"].groupby(day).transform("first")
        tp = (out["high"] + out["low"] + out["close"]) / 3.0
        out["vwap"] = (tp * out["volume"]).groupby(day).cumsum() / out["volume"].groupby(day).cumsum()
        out["vsma"] = indicators.sma(out["volume"], 20)
        out["atr"] = indicators.atr(out["high"], out["low"], out["close"], self.cfg.atr_period)
        out["bb_lower"] = out["vwap"]
        return out

    def _entry_long(self, row):
        n, o, v, vs = row.get("_n"), row.get("day_open"), row.get("vwap"), row.get("vsma")
        if any(x is None or pd.isna(x) for x in (o, v, vs)) or n is None:
            return False
        if n < 1 or n >= self.cfg.window:                   # only during the opening drive window
            return False
        firm_vol = vs > 0 and row["volume"] >= self.cfg.vol_mult * vs
        return row["close"] > o and row["close"] > v and firm_vol

    def _exit_long(self, row):
        v = row.get("vwap")
        return v is not None and not pd.isna(v) and row["close"] < v


# ---------------------------------------------------------------- Relative-Volume Breakout (intraday)
@dataclass
class RelVolBreakoutConfig:
    brk_bars: int = 6           # break the high of the last N bars
    vol_mult: float = 2.0       # require a genuine relative-volume spike
    trend_period: int = 12
    atr_period: int = 14


class RelVolBreakoutStrategy:
    """Intraday momentum breakout with a HARD volume filter: go long when price breaks the high of the
    last N bars AND that bar trades ≥ vol_mult × its 20-bar average volume AND price is above the session
    VWAP (intraday uptrend). The relative-volume gate rejects the thin fakeouts that bleed naive breakouts."""

    def __init__(self, cfg: RelVolBreakoutConfig | None = None):
        self.cfg = cfg or RelVolBreakoutConfig()

    def compute(self, df):
        out = df.copy()
        day = out.index.normalize()
        # prior-N-bar high (shifted so the current bar isn't in its own breakout level), per session
        out["brk_hi"] = out["high"].groupby(day).transform(lambda s: s.shift(1).rolling(self.cfg.brk_bars, min_periods=self.cfg.brk_bars).max())
        tp = (out["high"] + out["low"] + out["close"]) / 3.0
        out["vwap"] = (tp * out["volume"]).groupby(day).cumsum() / out["volume"].groupby(day).cumsum()
        out["vsma"] = indicators.sma(out["volume"], 20)
        out["atr"] = indicators.atr(out["high"], out["low"], out["close"], self.cfg.atr_period)
        out["bb_lower"] = out["vwap"]
        return out

    def _entry_long(self, row):
        bh, v, vs = row.get("brk_hi"), row.get("vwap"), row.get("vsma")
        if any(x is None or pd.isna(x) for x in (bh, v, vs)):
            return False
        vol_ok = vs > 0 and row["volume"] >= self.cfg.vol_mult * vs
        return row["close"] > bh and row["close"] >= v and vol_ok

    def _exit_long(self, row):
        v = row.get("vwap")
        return v is not None and not pd.isna(v) and row["close"] < v


# ---------------------------------------------------------------- Intraday RSI(2) reversion (5-min)
@dataclass
class IntradayRSIConfig:
    rsi_period: int = 2
    rsi_buy: float = 10.0
    rsi_exit: float = 60.0
    trend_ema: int = 20         # intraday trend filter — don't fade a falling knife
    trend_period: int = 20
    atr_period: int = 14


class IntradayRSIStrategy:
    """Fast intraday mean-reversion: buy a 5-min RSI(2) oversold dip ONLY while price is above its EMA20
    (an intraday uptrend, so it's a pullback not a collapse) and ticking back up. Exits when RSI recovers
    or price loses the EMA20, or at square-off. Frequent, small-edge — for range-bound days."""

    def __init__(self, cfg: IntradayRSIConfig | None = None):
        self.cfg = cfg or IntradayRSIConfig()

    def compute(self, df):
        out = df.copy(); c = out["close"]
        out["rsi2"] = indicators.rsi(c, self.cfg.rsi_period)
        out["ema_t"] = indicators.ema(c, self.cfg.trend_ema)
        out["prev_close"] = c.groupby(out.index.normalize()).shift(1)
        out["atr"] = indicators.atr(out["high"], out["low"], out["close"], self.cfg.atr_period)
        out["bb_lower"] = out["ema_t"]
        return out

    def _entry_long(self, row):
        r, e, pc = row.get("rsi2"), row.get("ema_t"), row.get("prev_close")
        if any(x is None or pd.isna(x) for x in (r, e, pc)):
            return False
        return r < self.cfg.rsi_buy and row["close"] >= e and row["close"] > pc

    def _exit_long(self, row):
        r, e = row.get("rsi2"), row.get("ema_t")
        if r is not None and not pd.isna(r) and r >= self.cfg.rsi_exit:
            return True
        return e is not None and not pd.isna(e) and row["close"] < e
