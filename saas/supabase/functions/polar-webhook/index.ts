// zengtrade — Polar webhook (Supabase Edge Function, Deno).
// Polar calls this on every subscription event. We verify the Standard-Webhooks signature, read our
// user_id (passed at checkout as customer_external_id / metadata.user_id), and flip that user's tier
// via the SERVICE ROLE (bypasses RLS). Idempotent via the webhook_event log.
//
// Secret (supabase secrets set ...):   POLAR_WEBHOOK_SECRET   (the "whsec_..." from Polar)
// Auto-available in Edge Functions:     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verify, tierFor, statusFromEvent } from "./verify.mjs";

Deno.serve(async (req) => {
  const secret = Deno.env.get("POLAR_WEBHOOK_SECRET") ?? "";
  const raw = await req.text();
  const headers = {
    "webhook-id": req.headers.get("webhook-id") ?? "",
    "webhook-timestamp": req.headers.get("webhook-timestamp") ?? "",
    "webhook-signature": req.headers.get("webhook-signature") ?? "",
  };
  if (!secret || !(await verify(raw, headers, secret))) {
    return new Response("bad signature", { status: 401 });
  }

  const evt = JSON.parse(raw);
  const data = evt?.data ?? {};
  // user_id: prefer the external id we set at checkout, fall back to metadata.
  const userId = data?.customer?.external_id ?? data?.customer_external_id ?? data?.metadata?.user_id;
  const status = statusFromEvent(evt);
  const eventId = data?.id ? `${evt?.type}:${data.id}:${status}` : crypto.randomUUID();
  if (!userId) return new Response("no user_id", { status: 200 });   // nothing to map, ack

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } });

  const { error: dupErr } = await db.from("webhook_event").insert({ id: eventId, provider: "polar" });
  if (dupErr && dupErr.code === "23505") return new Response("dup ok", { status: 200 });

  const tier = tierFor(status);
  if (tier) {
    await db.from("profile").update({ tier }).eq("id", userId);
    await db.from("subscription").upsert({
      user_id: userId,
      plan: tier === "pro" ? "pro" : "free",
      status: tier === "pro" ? "active" : (status ?? "inactive"),
      provider_ref: String(data?.id ?? ""),
      current_period_end: data?.current_period_end ?? null,
    });
  }
  console.log(`POLAR ${evt?.type} · user ${userId} · status ${status} -> tier ${tier}`);
  return new Response("ok", { status: 200 });
});
