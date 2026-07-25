"""Real Binance REST client. PUBLIC endpoints work now (no key). SIGNED endpoints (orders, account)
HARD-REFUSE unless ALLOW_LIVE is armed AND keys are configured — so we can wire + test connectivity
and $10 feasibility with ZERO risk of a real order. HMAC-SHA256 request signing per Binance spec."""
from __future__ import annotations
import time, hmac, hashlib, urllib.parse
import requests
from bot.safety import live_armed

DATA_BASES = ["https://data-api.binance.vision", "https://api.binance.com", "https://api.binance.us"]
TRADE_BASE = "https://api.binance.com"   # live orders route here (region/account dependent)

class BinanceRestClient:
    def __init__(self, api_key=None, api_secret=None):
        self.key, self.secret = api_key, api_secret
        self.s = requests.Session()
        if api_key:
            self.s.headers["X-MBX-APIKEY"] = api_key

    def _pub(self, path, params=None):
        last = None
        for base in DATA_BASES:
            try:
                r = self.s.get(base + path, params=params or {}, timeout=8)
                if r.status_code == 200:
                    return r.json()
                last = f"HTTP {r.status_code}"
            except Exception as e:
                last = e
        raise RuntimeError(f"binance public {path} failed: {last}")

    # ---------- PUBLIC (safe, no key) ----------
    def server_time(self):        return self._pub("/api/v3/time")
    def price(self, symbol):      return float(self._pub("/api/v3/ticker/price", {"symbol": symbol})["price"])
    def symbol_filters(self, symbol):
        info = self._pub("/api/v3/exchangeInfo", {"symbol": symbol})
        s = info["symbols"][0]
        f = {x["filterType"]: x for x in s["filters"]}
        return {
            "min_notional": float((f.get("NOTIONAL") or f.get("MIN_NOTIONAL") or {}).get("minNotional", 0)),
            "step_size": float((f.get("LOT_SIZE") or {}).get("stepSize", 0)),
            "min_qty": float((f.get("LOT_SIZE") or {}).get("minQty", 0)),
            "status": s.get("status"),
        }

    # ---------- SIGNED (orders/account) — HARD-GUARDED ----------
    def _signed(self, method, path, params):
        if not live_armed():
            raise PermissionError("binance: ALLOW_LIVE not armed → refusing signed/live call (fails safe)")
        if not (self.key and self.secret):
            raise RuntimeError("binance: no API keys configured")
        p = dict(params, timestamp=int(time.time() * 1000), recvWindow=5000)
        qs = urllib.parse.urlencode(p)
        sig = hmac.new(self.secret.encode(), qs.encode(), hashlib.sha256).hexdigest()
        r = self.s.request(method, f"{TRADE_BASE}{path}?{qs}&signature={sig}", timeout=8)
        r.raise_for_status()
        return r.json()

    def new_order(self, params):     return self._signed("POST",   "/api/v3/order", params)
    def query_order(self, params):   return self._signed("GET",    "/api/v3/order", params)
    def cancel_order(self, params):  return self._signed("DELETE", "/api/v3/order", params)
    def open_orders(self, symbol=None): return self._signed("GET", "/api/v3/openOrders", {"symbol": symbol} if symbol else {})
    def account(self):               return self._signed("GET",    "/api/v3/account", {})
