// zengtrade — connect a user's OWN Binance account (non-custodial: their key, their funds, their
// exchange account; zengtrade never holds anything). Supabase Edge Function.
// verify_jwt=false at the gateway (CORS preflight would otherwise 401); the caller is instead
// validated IN-CODE via auth.getUser() on their own token, same pattern as
// nowpayments-create-invoice. The submitted key/secret are validated against Binance itself
// before anything is stored, then encrypted (AES-256-GCM, saas/supabase/functions/_shared/crypto.mjs)
// and written to exchange_connection using the CALLER'S OWN JWT, never the service-role key - RLS
// already scopes every row to auth.uid(), so this function never needs elevated privileges at all.
//
// Secrets (set with `supabase secrets set ...`):
//   EXCHANGE_KEY_ENC_MASTER  — 32 random bytes, base64 (generate once: openssl rand -base64 32)
//   BINANCE_FORCE_TESTNET    — "1" to validate against testnet.binance.vision instead of mainnet
//   SUPABASE_URL, SUPABASE_ANON_KEY — auto-available
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BinanceClient } from "../_shared/binance.mjs";
import { encryptSecret, toPgBytea } from "../_shared/crypto.mjs";

const SITE = "https://zengtrade.in";
const cors = {
  "Access-Control-Allow-Origin": SITE,
  "Access-Control-Allow-Headers": "apikey, authorization, content-type",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

function binanceBase() {
  return Deno.env.get("BINANCE_FORCE_TESTNET") === "1" ? "https://testnet.binance.vision" : "https://api.binance.com";
}

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

    const { apiKey, apiSecret } = await req.json().catch(() => ({}));
    if (typeof apiKey !== "string" || typeof apiSecret !== "string" || !apiKey.trim() || !apiSecret.trim()) {
      return json({ error: "API key and secret are both required" }, 400);
    }

    // validate against Binance itself BEFORE storing anything - a key that doesn't work, or that
    // has withdrawal permission enabled, is refused outright rather than saved and discovered later.
    const client = new BinanceClient({ apiKey, apiSecret, baseUrl: binanceBase() });
    let account;
    try {
      account = await client.account();
    } catch (e) {
      console.error("binance account check failed", (e as Error).message);
      return json({ error: "Binance rejected this key/secret. Double-check you copied both values correctly." }, 400);
    }
    if (account.canWithdraw) {
      return json({ error: "This key has withdrawal permission enabled. For your safety, create a new key with only Spot & Margin Trading checked, and leave withdrawals disabled." }, 400);
    }
    if (!account.canTrade) {
      return json({ error: "This key doesn't have trading enabled. Check \"Enable Spot & Margin Trading\" when creating it on Binance." }, 400);
    }

    const master = Deno.env.get("EXCHANGE_KEY_ENC_MASTER");
    if (!master) return json({ error: "exchange connections are not configured yet" }, 503);
    const apiKeyEnc = toPgBytea(await encryptSecret(apiKey, master));
    const apiSecretEnc = toPgBytea(await encryptSecret(apiSecret, master));

    const { error: upsertError } = await db.from("exchange_connection").upsert(
      { user_id: user.id, exchange: "binance", api_key_enc: apiKeyEnc, api_secret_enc: apiSecretEnc, scope: "trade" },
      { onConflict: "user_id,exchange" },
    );
    if (upsertError) {
      console.error("exchange_connection upsert failed", upsertError.message);
      return json({ error: "could not save the connection, please try again" }, 500);
    }
    return json({ connected: true });
  } catch (e) {
    console.error(e);
    return json({ error: "server error" }, 500);
  }
});
