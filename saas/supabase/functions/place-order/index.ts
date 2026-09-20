// zengtrade — place ONE real MARKET order on the caller's OWN connected Binance account.
// Supabase Edge Function. Manual, single-order, human-supervised (Trading mode's Buy/Sell button
// with an explicit confirm step) - NOT the autonomous strategy execution docs/LIVE_EXECUTION_SPEC.md
// describes, which is a separate, later, much bigger initiative.
//
// Safety rails, all enforced HERE server-side (never trust the client):
//   - re-checks canTrade/canWithdraw on THIS call, not just at connect time (permissions can be
//     edited on Binance after connecting)
//   - refuses if LIVE_MAX_ORDER_NOTIONAL_USD isn't configured (fails closed, not an arbitrary
//     default - this is a real risk number the founder has to set deliberately)
//   - refuses an order over that per-order notional cap
//   - refuses if the caller has placed a live order in the last few seconds (cooldown) or too
//     many today (daily cap), both checked against live_order, not trusted from the client
//   - rounds qty down to the symbol's LOT_SIZE step and checks minNotional via Binance's public
//     exchangeInfo before ever signing a request
//
// Secrets: EXCHANGE_KEY_ENC_MASTER, BINANCE_FORCE_TESTNET, LIVE_MAX_ORDER_NOTIONAL_USD,
//   LIVE_MAX_DAILY_ORDERS (optional, default 20), SUPABASE_URL, SUPABASE_ANON_KEY.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BinanceClient, roundToStep } from "../_shared/binance.mjs";
import { decryptSecret, fromPgBytea } from "../_shared/crypto.mjs";
import { requirePaidTier } from "../_shared/tier.mjs";

const SITE = "https://zengtrade.in";
const cors = {
  "Access-Control-Allow-Origin": SITE,
  "Access-Control-Allow-Headers": "apikey, authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

function binanceBase() {
  return Deno.env.get("BINANCE_FORCE_TESTNET") === "1" ? "https://testnet.binance.vision" : "https://api.binance.com";
}
const COOLDOWN_MS = 3000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } }, auth: { persistSession: false },
    });
    const { data: { user } } = await db.auth.getUser();
    if (!user) return json({ error: "not signed in" }, 401);

    // MONETIZATION FIX (2026-09-20): see _shared/tier.mjs - checked again here, not just at
    // connect time, so a downgrade after connecting can't leave live orders still placeable.
    const gate = await requirePaidTier(db, user.id);
    if (!gate.ok) return json({ error: gate.error }, gate.status);

    const capUsd = parseFloat(Deno.env.get("LIVE_MAX_ORDER_NOTIONAL_USD") || "");
    if (!(capUsd > 0)) return json({ error: "live trading is not configured yet" }, 503);
    const dailyCap = parseInt(Deno.env.get("LIVE_MAX_DAILY_ORDERS") || "20", 10);

    const { symbol, side, qty } = await req.json().catch(() => ({}));
    if (typeof symbol !== "string" || !symbol) return json({ error: "symbol is required" }, 400);
    if (side !== "BUY" && side !== "SELL") return json({ error: "side must be BUY or SELL" }, 400);
    if (typeof qty !== "number" || !(qty > 0)) return json({ error: "qty must be a positive number" }, 400);

    // cooldown + daily cap, both checked against real rows this user actually placed - not trusted
    // from the client, and cheap since this table only ever holds this user's own orders (RLS).
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: recent, error: recentErr } = await db
      .from("live_order").select("created_at").eq("user_id", user.id).gte("created_at", since)
      .order("created_at", { ascending: false });
    if (recentErr) { console.error("live_order lookup failed", recentErr.message); return json({ error: "server error" }, 500); }
    if (recent && recent.length) {
      const lastMs = new Date(recent[0].created_at).getTime();
      if (Date.now() - lastMs < COOLDOWN_MS) return json({ error: "please wait a few seconds between live orders" }, 429);
    }
    if (recent && recent.length >= dailyCap) return json({ error: `daily live-order limit (${dailyCap}) reached` }, 429);

    // load + decrypt this user's own connection (RLS already scopes the select to their own row)
    const { data: conn, error: connErr } = await db
      .from("exchange_connection").select("api_key_enc, api_secret_enc")
      .eq("user_id", user.id).eq("exchange", "binance").maybeSingle();
    if (connErr) { console.error("exchange_connection lookup failed", connErr.message); return json({ error: "server error" }, 500); }
    if (!conn) return json({ error: "connect your Binance account first" }, 400);

    const master = Deno.env.get("EXCHANGE_KEY_ENC_MASTER");
    if (!master) return json({ error: "live trading is not configured yet" }, 503);
    const apiKey = await decryptSecret(fromPgBytea(conn.api_key_enc), master);
    const apiSecret = await decryptSecret(fromPgBytea(conn.api_secret_enc), master);
    const client = new BinanceClient({ apiKey, apiSecret, baseUrl: binanceBase() });

    // re-check permissions on THIS call - a key can be edited on Binance after connecting.
    let account;
    try { account = await client.account(); }
    catch (e) { console.error("binance account re-check failed", (e as Error).message); return json({ error: "could not verify your Binance connection, please reconnect" }, 400); }
    if (account.canWithdraw || !account.canTrade) {
      return json({ error: "this key's permissions changed on Binance and no longer meet our safety requirements - please reconnect a trade-only key" }, 400);
    }

    // price + lot-size/minNotional check, public endpoints, before ever signing an order
    const [price, filters] = await Promise.all([client.price(symbol), client.symbolFilters(symbol)]);
    if (filters.status !== "TRADING") return json({ error: `${symbol} is not currently tradeable on Binance` }, 400);
    const roundedQty = roundToStep(qty, filters.stepSize || 0.00000001);
    if (!(roundedQty > 0)) return json({ error: "quantity rounds down to zero at this coin's lot size" }, 400);
    const notionalUsd = roundedQty * price;
    if (filters.minNotional && notionalUsd < filters.minNotional) {
      return json({ error: `order value $${notionalUsd.toFixed(2)} is below Binance's minimum ($${filters.minNotional}) for ${symbol}` }, 400);
    }
    if (notionalUsd > capUsd) {
      return json({ error: `order value $${notionalUsd.toFixed(2)} exceeds the live-order limit ($${capUsd})` }, 400);
    }

    let fill;
    try {
      fill = await client.newOrder({ symbol, side, type: "MARKET", quantity: String(roundedQty) });
    } catch (e) {
      const err = e as Error & { binance?: unknown };
      console.error("binance order failed", err.message, err.binance);
      await db.from("live_order").insert({
        user_id: user.id, exchange: "binance", symbol, side, qty: roundedQty,
        avg_price: null, notional_usd: notionalUsd, binance_order_id: null,
        status: "rejected", raw_response: err.binance ?? { message: err.message },
      });
      return json({ error: (err.binance as { msg?: string } | undefined)?.msg || "Binance rejected this order" }, 502);
    }

    const avgPrice = fill.fills?.length
      ? fill.fills.reduce((s: number, f: { price: string; qty: string }) => s + parseFloat(f.price) * parseFloat(f.qty), 0) /
        fill.fills.reduce((s: number, f: { qty: string }) => s + parseFloat(f.qty), 0)
      : price;
    const { error: insertErr } = await db.from("live_order").insert({
      user_id: user.id, exchange: "binance", symbol, side, qty: roundedQty,
      avg_price: avgPrice, notional_usd: notionalUsd, binance_order_id: String(fill.orderId ?? ""),
      status: fill.status || "FILLED", raw_response: fill,
    });
    if (insertErr) console.error("live_order insert failed (order already placed on Binance)", insertErr.message);

    return json({ filled: true, symbol, side, qty: roundedQty, avgPrice, orderId: fill.orderId, status: fill.status });
  } catch (e) {
    console.error(e);
    return json({ error: "server error" }, 500);
  }
});
