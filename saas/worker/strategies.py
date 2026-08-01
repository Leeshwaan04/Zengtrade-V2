"""zengtrade — strategy registry (shared by the live worker and the evaluator).

Only strategies that EARNED their place on real out-of-sample-style testing are 'featured' for
users. The crypto-native trend follower is the flagship: robustly positive net of global costs
across every parameter setting on ~2 years of daily data (PF ~2).
"""
import os, sys
BOT = os.path.expanduser("~/kite-mean-reversion-bot")
if BOT not in sys.path: sys.path.insert(0, BOT)
from bot import strategies_lib as S
import bot.indicators as IND
import pandas as pd

class TrendFollow:
    """Breakout entry (new hi-N high above the trend mean) + trailing chandelier exit (in engine)."""
    def __init__(self, hi=20, trend=100, atr=14): self.hi=hi; self.trend=trend; self.atr=atr
    def compute(self, df):
        out=df.copy(); c=out["close"]
        out["atr"]=IND.atr(out["high"], out["low"], out["close"], self.atr)
        out["hiN"]=c.rolling(self.hi).max().shift(1)
        out["trend_sma"]=c.rolling(self.trend).mean()
        out["bb_lower"]=out["trend_sma"]
        return out
    def _entry_long(self, row):
        h,t,px=row.get("hiN"),row.get("trend_sma"),row.get("close")
        if h is None or t is None or pd.isna(h) or pd.isna(t): return False
        return px>h and px>t
    def _exit_long(self, row): return False
class Momo(TrendFollow):
    def __init__(self): super().__init__(hi=10, trend=50)

# key -> (class, interval, style, featured?)
# Keys deliberately MATCH the terminal catalog ids (assets/app.js Algo Studio), so a customer
# deploy row written by the Studio maps 1:1 to an engine here. "momentum" aliases Momo (the
# terminal's name for it). Spot-only: perp_*/cx_*/pairs/xs_* need other venues/engines -> not here.
REGISTRY = {
    "trend_follow": (TrendFollow,             "day",     "trend",     True),
    "momo":         (Momo,                    "day",     "trend",     True),
    "momentum":     (Momo,                    "day",     "trend",     True),
    "bollinger":    (S.BollingerRevStrategy,  "day",     "reversion", True),
    "rsi2":         (S.RSI2Strategy,          "day",     "reversion", True),
    "macross":      (S.MACrossStrategy,       "day",     "trend",     True),
    "ema_cross":    (S.EMACrossStrategy,      "day",     "trend",     True),
    "adx_trend":    (S.ADXTrendStrategy,      "day",     "trend",     True),
    "zscore":       (S.ZScoreRevStrategy,     "day",     "reversion", True),
    "nr7":          (S.NR7Strategy,           "day",     "reversion", True),
    # intraday (5-minute bars; heavier data pull, non-featured until validated net of costs)
    "orb":          (S.ORBStrategy,           "5minute", "reversion", False),
    "vwap_rev":     (S.VWAPRevStrategy,       "5minute", "reversion", False),
    "vwap_mom":     (S.VWAPMomStrategy,       "5minute", "trend",     False),
    "ema_scalp":    (S.EMAScalpStrategy,      "5minute", "trend",     False),
    "bb_breakout":  (S.BBBreakStrategy,       "5minute", "trend",     False),
    # kept for research / not featured to users (fail after costs so far)
    "supertrend":   (S.SupertrendStrategy,    "day",     "trend",     False),
    "vwap_pull":    (S.VWAPPullbackStrategy,  "5minute", "reversion", False),
    "rsi_intraday": (S.IntradayRSIStrategy,   "5minute", "reversion", False),
}
DEPLOYABLE = sorted(REGISTRY)   # what the Studio may offer customers
FEATURED = [k for k,v in REGISTRY.items() if v[3]]

def make(key): return REGISTRY[key][0]()
def interval(key): return REGISTRY[key][1]
def cfg_for(key, base):
    style = REGISTRY[key][2]
    if style == "trend": return dict(base, target_atr=0.0, stop_atr=3.0, cooldown_bars=12, edge_mult=2.0)
    return dict(base, target_atr=3.0, stop_atr=2.0)
