// zengtrade — NOWPayments IPN webhook (Supabase Edge Function, Deno).
// NOWPayments POSTs here on every payment status change. We verify the HMAC-SHA512 signature,
// read our user_id + plan + cycle out of order_id, and on a fully-paid status grant that tier for
// the paid period using the SERVICE ROLE (a trusted server writing on the user's behalf, bypassing
// RLS). Idempotent via the webhook_event log.
//
// Also reports the completed payment to GA4 (property "zengtrade", stream 15728393601) via the
// Measurement Protocol — this is the ONE funnel event that genuinely cannot be fired client-side:
// the money actually lands here, in a server-to-server webhook with no browser present, so a
// gtag.js call anywhere in the frontend can only ever mean "invoice created," never "paid."
//
// Secrets (set with `supabase secrets set ...`, NEVER in code/frontend):
//   NOWPAYMENTS_IPN_SECRET                     — the IPN key from NOWPayments → Integrations
//   GA_MEASUREMENT_PROTOCOL_SECRET             — GA4 Admin → Data Streams → zengtrade → Measurement
//                                                 Protocol API secrets (nickname "zengtrade-api")
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY    — auto-available in Edge Functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verify, parseOrder, grants, tierFor } from "./verify.mjs";

// mirrors PRICES in nowpayments-create-invoice/index.ts — that function is the source of truth
// for what NOWPayments actually charges; this copy only feeds the GA4 "value" on the events
// above, so a report worth cents doesn't hold up a webhook worth a paid subscription.
const PRICES: Record<string, Record<string, number>> = {
  pro: { month: 19, year: 190 },
  elite: { month: 79, year: 790 },
};

// GA4 Measurement Protocol needs a client_id shaped like two dot-separated integers. There is no
// browser here to read one from the _ga cookie, so derive a small, STABLE pseudo-id from the
// Supabase user id: the same user always maps to the same client_id, so a renewal correctly shows
// up as a repeat "client" instead of a new one each time. user_id is also sent alongside it so a
// user who's ALSO been tracked client-side (sign_up, begin_checkout) resolves to the same GA4 user.
function pseudoClientId(userId: string): string {
  let h1 = 0, h2 = 0;
  for (let i = 0; i < userId.length; i++) {
    h1 = (h1 * 31 + userId.charCodeAt(i)) >>> 0;
    h2 = (h2 * 131 + userId.charCodeAt(i)) >>> 0;
  }
  return `${h1}.${h2}`;
}

async function reportPurchaseToGA(opts: {
  userId: string; plan: string; cycle: string; paymentId: string;
}): Promise<void> {
  const secret = Deno.env.get("GA_MEASUREMENT_PROTOCOL_SECRET");
  if (!secret) { console.log("GA4 report skipped: GA_MEASUREMENT_PROTOCOL_SECRET not set"); return; }
  const value = PRICES[opts.plan]?.[opts.cycle] ?? 0;
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=G-HTP82WBWMH&api_secret=${secret}`;
  const body = {
    client_id: pseudoClientId(opts.userId),
    user_id: opts.userId,
    events: [{
      name: "purchase",
      params: {
        transaction_id: opts.paymentId,
        currency: "USD",
        value,
        items: [{ item_id: opts.plan, item_name: `zengtrade ${opts.plan} (${opts.cycle})`, price: value, quantity: 1 }],
      },
    }],
  };
  try {
    const r = await fetch(url, { method: "POST", body: JSON.stringify(body) });
    // GA4 MP returns 204 with no body on success and never fails the caller's request even when
    // the payload is malformed (use the /debug/mp/collect endpoint to validate shape changes) —
    // logging the status is the only signal available that something's actually wrong here.
    if (r.status !== 204) console.log(`GA4 report non-204: ${r.status}`);
  } catch (e) {
    console.log("GA4 report failed (non-fatal):", e);
  }
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("NOWPAYMENTS_IPN_SECRET") ?? "";
  const raw = await req.text();
  const sig = req.headers.get("x-nowpayments-sig") ?? "";
  if (!(await verify(raw, sig, secret))) {
    return new Response("bad signature", { status: 401 });   // fail closed
  }

  const evt = JSON.parse(raw);
  const status = evt?.payment_status;
  const { userId, plan, cycle } = parseOrder(evt?.order_id);
  const tier = tierFor(plan);

  // Ack (200) anything we don't act on — waiting/partially_paid/expired — so NOWPayments stops retrying.
  if (!userId || !tier || !grants(status)) {
    console.log(`NOWPayments no-op · status ${status} · order ${evt?.order_id}`);
    return new Response("ack", { status: 200 });
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } });

  // ONE atomic call: dedup (by payment_id) + tier grant + period extension all commit-or-rollback
  // together, and the period extends from GREATEST(existing end, now) so early renewals don't lose time.
  const { data: result, error } = await db.rpc("grant_paid", {
    p_user: userId, p_tier: tier, p_cycle: cycle, p_payment: String(evt?.payment_id ?? ""),
  });
  if (error) {
    console.error("grant_paid failed", error);
    return new Response("grant failed", { status: 500 });   // 5xx → NOWPayments retries; nothing committed
  }
  if (result === "dup") return new Response("dup ok", { status: 200 });
  console.log(`NOWPayments ${status} · user ${userId} · ${tier}/${cycle} → until ${result}`);
  // fire-and-forget: a GA4 hiccup must never turn a successful, already-committed grant into a
  // 5xx that makes NOWPayments retry the whole webhook (which would try to re-grant, safely
  // no-op via the dedup guard above, but there's no reason to risk it for an analytics call).
  reportPurchaseToGA({ userId, plan: plan || tier, cycle: cycle || "month", paymentId: String(evt?.payment_id ?? "") })
    .catch(() => {});
  return new Response("ok", { status: 200 });
});
