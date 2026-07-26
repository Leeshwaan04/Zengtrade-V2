// zengtrade — create a NOWPayments hosted invoice for the logged-in user (Supabase Edge Function).
// verify_jwt=false at the gateway (so the CORS preflight isn't 401'd); instead we validate the
// caller IN-CODE via auth.getUser() on their token, and NEVER trust a client-sent price. The API
// key is a SECRET (Supabase secret), never sent to a browser.
//
// Secrets (set with `supabase secrets set ...`):
//   NOWPAYMENTS_API_KEY                                    — from NOWPayments → Integrations
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY  — auto-available
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// server-side price catalog — the ONLY source of truth for what a plan costs.
const PRICES: Record<string, Record<string, number>> = {
  pro:   { month: 29, year: 290 },
  elite: { month: 79, year: 790 },
};
const SITE = "https://zengtrade.in";
const cors = {
  "Access-Control-Allow-Origin": SITE,
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  try {
    // identify the caller from their Supabase JWT (verify_jwt=true already checked it)
    const auth = req.headers.get("Authorization") ?? "";
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } }, auth: { persistSession: false },
    });
    const { data: { user } } = await db.auth.getUser();
    if (!user) return json({ error: "not signed in" }, 401);

    const { plan, cycle } = await req.json().catch(() => ({}));
    const price = PRICES[plan]?.[cycle];
    if (!price) return json({ error: "invalid plan or cycle" }, 400);

    const key = Deno.env.get("NOWPAYMENTS_API_KEY") ?? "";
    if (!key) return json({ error: "billing not configured" }, 503);

    // order_id carries everything the IPN webhook needs to grant the right tier for the right user.
    const order_id = `${user.id}:${plan}:${cycle}:${Date.now()}`;
    const resp = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        price_amount: price,
        price_currency: "usd",
        order_id,
        order_description: `zengtrade ${plan} plan (${cycle})`,
        ipn_callback_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/nowpayments-ipn`,
        success_url: `${SITE}/dashboard?paid=1`,
        cancel_url: `${SITE}/pricing/`,
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.invoice_url) {
      console.error("NOWPayments invoice failed", resp.status, data);
      return json({ error: data?.message || "could not create invoice" }, 502);
    }
    return json({ invoice_url: data.invoice_url });
  } catch (e) {
    console.error(e);
    return json({ error: "server error" }, 500);
  }
});
