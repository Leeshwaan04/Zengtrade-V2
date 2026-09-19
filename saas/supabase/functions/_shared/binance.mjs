// zengtrade — Binance REST client: public (key-less) market data + signed (HMAC-SHA256) trading
// calls. Plain JS (no type annotations) so the SAME code runs in Deno (the Edge Functions) AND in
// Node (saas/tests/binance_signing.mjs), same convention as nowpayments-ipn/verify.mjs.
//
// Signing spec (Binance's own docs): HMAC-SHA256 over the exact query string that will be sent
// (already percent-encoded, params in the order they're appended), secretKey as the HMAC key,
// hex-encoded, appended as `&signature=...`. Ported from the shape of the real, working client
// this project had before the crypto-only pivot (git show 41b2b9b^:backend/bot/live/binance_client.py) -
// same timestamp+recvWindow+sign-then-append approach, re-verified here against Binance's own
// published worked example rather than assumed correct by inheritance.
//
// baseUrl is a parameter, not hardcoded, specifically so the exact same code path can run against
// testnet.binance.vision in QA and api.binance.com in production - never a parallel/mocked signer.

const enc = new TextEncoder();

async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class BinanceClient {
  /** @param {{apiKey?: string, apiSecret?: string, baseUrl?: string}} [opts] */
  constructor({ apiKey, apiSecret, baseUrl = "https://api.binance.com" } = {}) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = baseUrl;
  }

  async #public(path, params = {}) {
    const qs = new URLSearchParams(params).toString();
    const r = await fetch(`${this.baseUrl}${path}${qs ? "?" + qs : ""}`);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`binance ${path} failed: HTTP ${r.status} ${JSON.stringify(data)}`);
    return data;
  }

  async #signed(method, path, params = {}) {
    if (!this.apiKey || !this.apiSecret) throw new Error("binance: no API key/secret configured");
    const p = new URLSearchParams({ ...params, timestamp: String(Date.now()), recvWindow: "5000" });
    const qs = p.toString();
    const signature = await hmacSha256Hex(this.apiSecret, qs);
    const url = `${this.baseUrl}${path}?${qs}&signature=${signature}`;
    const r = await fetch(url, { method, headers: { "X-MBX-APIKEY": this.apiKey } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { const err = new Error(data?.msg || `binance ${path} failed: HTTP ${r.status}`); err.binance = data; err.status = r.status; throw err; }
    return data;
  }

  // ---- public (safe, no key) ----
  price(symbol) { return this.#public("/api/v3/ticker/price", { symbol }).then((d) => parseFloat(d.price)); }
  async symbolFilters(symbol) {
    const info = await this.#public("/api/v3/exchangeInfo", { symbol });
    const s = info.symbols?.[0];
    if (!s) throw new Error(`unknown symbol ${symbol}`);
    const f = Object.fromEntries((s.filters || []).map((x) => [x.filterType, x]));
    return {
      minNotional: parseFloat((f.NOTIONAL || f.MIN_NOTIONAL || {}).minNotional || "0"),
      stepSize: parseFloat((f.LOT_SIZE || {}).stepSize || "0"),
      minQty: parseFloat((f.LOT_SIZE || {}).minQty || "0"),
      status: s.status,
    };
  }

  // ---- signed (account/orders) ----
  account() { return this.#signed("GET", "/api/v3/account", {}); }
  newOrder(params) { return this.#signed("POST", "/api/v3/order", params); }
}

// round a quantity down to the symbol's LOT_SIZE step, e.g. stepSize 0.00001 -> 5 decimal places.
export function roundToStep(qty, stepSize) {
  if (!(stepSize > 0)) return qty;
  const precision = Math.max(0, Math.round(-Math.log10(stepSize)));
  const factor = 10 ** precision;
  return Math.floor(qty * factor) / factor;
}

export { hmacSha256Hex };
