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

# ---------------- user-composed strategies (the Builder) ----------------
# A deployment row with params jsonb carries a rule SPEC the customer composed in the
# Studio. RuleStrategy interprets it: users pick the SIGNALS; the engine keeps the
# RAILS (ATR stops, cost gate, cooldown, profit lock) exactly like every built-in.
# Spec: {name, universe:[...], interval:'day'|'5minute', style:'trend'|'reversion',
#        entry:{ind,p1,p2?,op:'>'|'<',value}, exit:{ind,p1,p2?,op,value}}
# inds: rsi | zscore | price_vs_sma | price_vs_ema | sma_cross | ema_cross | macd_cross
#       | bollinger_touch | breakout | roc | stoch | dist_sma | vol_spike
RULE_INDS = ("rsi", "zscore", "price_vs_sma", "price_vs_ema", "sma_cross", "ema_cross",
             "macd_cross", "bollinger_touch", "breakout", "roc", "stoch", "dist_sma", "vol_spike")
# per-indicator sane range for the free "value" field: (lo, hi, default-if-unusable)
VALUE_CLAMP = {"bollinger_touch": (0.5, 5.0, 2.0), "stoch": (0.0, 100.0, 20.0),
               "vol_spike": (0.5, 20.0, 2.0), "rsi": (0.0, 100.0, 30.0)}

def _clampi(v, lo, hi, d):
    try: v = int(v)
    except Exception: return d
    return min(max(v, lo), hi)

def validate_spec(raw):
    """Whitelist-validate an untrusted spec -> clean dict, or None if hopeless."""
    if not isinstance(raw, dict): return None
    def cond(c):
        if not isinstance(c, dict) or c.get("ind") not in RULE_INDS: return None
        out = {"ind": c["ind"], "p1": _clampi(c.get("p1"), 2, 200, 14),
               "p2": _clampi(c.get("p2"), 3, 400, 50),
               "op": c.get("op") if c.get("op") in (">", "<") else ">"}
        try: out["value"] = min(max(float(c.get("value", 0)), -1e6), 1e6)
        except Exception: out["value"] = 0.0
        if out["ind"] in VALUE_CLAMP:
            lo, hi, d = VALUE_CLAMP[out["ind"]]
            out["value"] = min(max(out["value"], lo), hi) if lo <= out["value"] <= hi or out["value"] else d
            if out["value"] < lo or out["value"] > hi: out["value"] = d
        if out["p2"] <= out["p1"]: out["p2"] = out["p1"] + 1
        return out
    entry, exit_ = cond(raw.get("entry")), cond(raw.get("exit"))
    if not entry or not exit_: return None
    uni = [s for s in (raw.get("universe") or []) if isinstance(s, str)]
    return {
        "name": str(raw.get("name", "Custom"))[:40],
        "universe": uni or None,                    # None -> worker UNIVERSE
        "interval": raw.get("interval") if raw.get("interval") in ("day", "5minute") else "day",
        "style": raw.get("style") if raw.get("style") in ("trend", "reversion") else "reversion",
        "entry": entry, "exit": exit_,
    }

def _rsi(close, n):
    d = close.diff()
    up = d.clip(lower=0).rolling(n).mean()
    dn = (-d.clip(upper=0)).rolling(n).mean()
    rs = up / dn.replace(0, 1e-12)
    return 100 - 100 / (1 + rs)

class RuleStrategy:
    def __init__(self, spec): self.spec = spec
    def _cols(self, df, c):
        i, p1, p2 = c["ind"], c["p1"], c["p2"]
        if i == "rsi" and f"rsi{p1}" not in df:    df[f"rsi{p1}"] = _rsi(df["close"], p1)
        if i == "zscore" and f"z{p1}" not in df:
            m = df["close"].rolling(p1).mean(); s = df["close"].rolling(p1).std()
            df[f"z{p1}"] = (df["close"] - m) / s.replace(0, 1e-12)
        if i in ("price_vs_sma", "sma_cross", "dist_sma") and f"sma{p1}" not in df:
            df[f"sma{p1}"] = df["close"].rolling(p1).mean()
        if i == "sma_cross" and f"sma{p2}" not in df:  df[f"sma{p2}"] = df["close"].rolling(p2).mean()
        if i in ("ema_cross",) or i == "price_vs_ema":
            if f"ema{p1}" not in df: df[f"ema{p1}"] = df["close"].ewm(span=p1, adjust=False).mean()
            if i == "ema_cross" and f"ema{p2}" not in df: df[f"ema{p2}"] = df["close"].ewm(span=p2, adjust=False).mean()
        if i == "macd_cross" and f"macd{p1}_{p2}" not in df:
            macd = df["close"].ewm(span=p1, adjust=False).mean() - df["close"].ewm(span=p2, adjust=False).mean()
            df[f"macd{p1}_{p2}"] = macd
            df[f"macds{p1}_{p2}"] = macd.ewm(span=9, adjust=False).mean()
        if i == "bollinger_touch" and f"bbm{p1}" not in df:
            df[f"bbm{p1}"] = df["close"].rolling(p1).mean()
            df[f"bbs{p1}"] = df["close"].rolling(p1).std()
        if i == "breakout" and f"hh{p1}" not in df:
            df[f"hh{p1}"] = df["high"].rolling(p1).max().shift(1)
            df[f"ll{p1}"] = df["low"].rolling(p1).min().shift(1)
        if i == "roc" and f"roc{p1}" not in df:    df[f"roc{p1}"] = df["close"].pct_change(p1) * 100
        if i == "stoch" and f"stk{p1}" not in df:
            lo = df["low"].rolling(p1).min(); hi = df["high"].rolling(p1).max()
            df[f"stk{p1}"] = (df["close"] - lo) / (hi - lo).replace(0, 1e-12) * 100
        if i == "dist_sma" and f"dsma{p1}" not in df:
            df[f"dsma{p1}"] = (df["close"] / df["close"].rolling(p1).mean().replace(0, 1e-12) - 1) * 100
        if i == "vol_spike" and f"rv{p1}" not in df and "volume" in df:
            df[f"rv{p1}"] = df["volume"] / df["volume"].rolling(p1).mean().replace(0, 1e-12)
    def compute(self, df):
        out = df.copy()
        tr = pd.concat([(out["high"] - out["low"]),
                        (out["high"] - out["close"].shift()).abs(),
                        (out["low"] - out["close"].shift()).abs()], axis=1).max(axis=1)
        out["atr"] = tr.rolling(14).mean()
        self._cols(out, self.spec["entry"]); self._cols(out, self.spec["exit"])
        return out.dropna()
    def _test(self, row, c):
        i, p1, p2, op, v = c["ind"], c["p1"], c["p2"], c["op"], c["value"]
        try:
            if i == "rsi":            lhs, rhs = row[f"rsi{p1}"], v
            elif i == "zscore":       lhs, rhs = row[f"z{p1}"], v
            elif i == "price_vs_sma": lhs, rhs = row["close"], row[f"sma{p1}"]
            elif i == "price_vs_ema": lhs, rhs = row["close"], row[f"ema{p1}"]
            elif i == "sma_cross":    lhs, rhs = row[f"sma{p1}"], row[f"sma{p2}"]
            elif i == "ema_cross":    lhs, rhs = row[f"ema{p1}"], row[f"ema{p2}"]
            elif i == "macd_cross":   lhs, rhs = row[f"macd{p1}_{p2}"], row[f"macds{p1}_{p2}"]
            elif i == "bollinger_touch":
                lhs = row["close"]
                rhs = row[f"bbm{p1}"] + v * row[f"bbs{p1}"] if op == ">" else row[f"bbm{p1}"] - v * row[f"bbs{p1}"]
            elif i == "breakout":     lhs, rhs = row["close"], (row[f"hh{p1}"] if op == ">" else row[f"ll{p1}"])
            elif i == "roc":          lhs, rhs = row[f"roc{p1}"], v
            elif i == "stoch":        lhs, rhs = row[f"stk{p1}"], v
            elif i == "dist_sma":     lhs, rhs = row[f"dsma{p1}"], v
            else:                     lhs, rhs = row[f"rv{p1}"], v          # vol_spike
            return (lhs > rhs) if op == ">" else (lhs < rhs)
        except Exception:
            return False
    def _entry_long(self, row): return self._test(row, self.spec["entry"])
    def _exit_long(self, row):  return self._test(row, self.spec["exit"])
FEATURED = [k for k,v in REGISTRY.items() if v[3]]

def make(key): return REGISTRY[key][0]()
def interval(key): return REGISTRY[key][1]
def cfg_for(key, base):
    style = REGISTRY[key][2]
    if style == "trend": return dict(base, target_atr=0.0, stop_atr=3.0, cooldown_bars=12, edge_mult=2.0)
    return dict(base, target_atr=3.0, stop_atr=2.0)
