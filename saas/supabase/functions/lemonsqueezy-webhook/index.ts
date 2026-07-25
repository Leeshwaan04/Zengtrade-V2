// zengtrade — Lemon Squeezy webhook (Supabase Edge Function, Deno).
// LS calls this on every subscription event. We verify the HMAC signature, read our user_id from
// the checkout custom data, and flip that user's tier in Postgres using the SERVICE ROLE (bypasses
// RLS — a trusted server writing on the user's behalf). Idempotent via a webhook_event log.
//
// Secrets (set with `supabase secrets set ...`, NEVER in code/frontend):
//   LEMONSQUEEZY_WEBHOOK_SECRET   — the signing secret you set in LS → Settings → Webhooks
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  — auto-available in Edge Functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// signature verification + tier mapping live in a shared plain-JS module so the SAME code is
// exercised by saas/tests/webhook_signature.mjs (the security boundary is tested, not a copy).
import { verify, tierFor } from "./verify.mjs";

Deno.serve(async (req) => {
  const secret = Deno.env.get("LEMONSQUEEZY_WEBHOOK_SECRET") ?? "";
  const raw = await req.text();
  const sig = req.headers.get("X-Signature") ?? "";
  if (!secret || !(await verify(raw, sig, secret))) {
    return new Response("bad signature", { status: 401 });
  }

  const evt = JSON.parse(raw);
  const eventId = evt?.data?.id ? `${evt.meta?.event_name}:${evt.data.id}:${evt.data?.attributes?.status}` : crypto.randomUUID();
  const userId = evt?.meta?.custom_data?.user_id;
  const status = evt?.data?.attributes?.status;
  const eventName = evt?.meta?.event_name;
  if (!userId) return new Response("no user_id", { status: 200 }); // nothing to do, ack

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } });

  // idempotency: skip if we've processed this exact event before
  const { error: dupErr } = await db.from("webhook_event").insert({ id: eventId, provider: "lemonsqueezy" });
  if (dupErr && dupErr.code === "23505") return new Response("dup ok", { status: 200 });

  const tier = tierFor(status);
  if (tier) {
    await db.from("profile").update({ tier }).eq("id", userId);
    await db.from("subscription").upsert({
      user_id: userId,
      plan: tier === "pro" ? "pro" : "free",
      status: tier === "pro" ? "active" : status,
      provider_ref: String(evt?.data?.id ?? ""),
      current_period_end: evt?.data?.attributes?.renews_at ?? null,
    });
  }
  console.log(`LS ${eventName} · user ${userId} · status ${status} -> tier ${tier}`);
  return new Response("ok", { status: 200 });
});
