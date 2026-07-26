// zengtrade — NOWPayments IPN webhook (Supabase Edge Function, Deno).
// NOWPayments POSTs here on every payment status change. We verify the HMAC-SHA512 signature,
// read our user_id + plan + cycle out of order_id, and on a fully-paid status grant that tier for
// the paid period using the SERVICE ROLE (a trusted server writing on the user's behalf, bypassing
// RLS). Idempotent via the webhook_event log.
//
// Secrets (set with `supabase secrets set ...`, NEVER in code/frontend):
//   NOWPAYMENTS_IPN_SECRET                     — the IPN key from NOWPayments → Integrations
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY    — auto-available in Edge Functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verify, parseOrder, grants, tierFor } from "./verify.mjs";

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
  return new Response("ok", { status: 200 });
});
