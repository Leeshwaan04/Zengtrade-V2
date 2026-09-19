// zengtrade: connect the user's OWN Binance account for real order execution. Non-custodial - the
// key/secret are sent once to connect-exchange (which validates them against Binance itself and
// stores them encrypted), never held in the browser beyond that one request, never read back.
import { sb } from "./auth.js";
import { SUPABASE_URL } from "./config.js";

// Only ever the safe columns - never select("*") on this table, even though the key columns are
// encrypted ciphertext, minimizing what a browser ever needs to ask for is free.
export async function getExchangeStatus() {
  const { data, error } = await sb.from("exchange_connection").select("exchange,connected_at").eq("exchange", "binance").maybeSingle();
  if (error) return { connected: false };
  return data ? { connected: true, connectedAt: data.connected_at } : { connected: false };
}

async function callFn(name, body) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return { error: "Please sign in first." };
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return { error: d.error || "Something went wrong, please try again." };
  return d;
}

export async function connectExchange(apiKey, apiSecret) {
  return callFn("exchange-connect", { apiKey, apiSecret });
}

// RLS makes this safe as a plain client-side delete - no Edge Function needed for disconnect.
export async function disconnectExchange() {
  const { error } = await sb.from("exchange_connection").delete().eq("exchange", "binance");
  return error ? { error: error.message } : { ok: true };
}
