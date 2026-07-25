// SaaS billing-webhook signature test — the P0 gate that stops a forged webhook granting Pro.
//
// It imports the REAL verify()/tierFor() from the Edge Function module (verify.mjs) — not a copy —
// so a drift in the actual signing logic breaks this test. Two tiers:
//
//   UNIT (always runs, Node ≥20 / Deno): a correctly-signed body verifies; a tampered body,
//     a wrong signature, a length-mismatched signature, and an empty secret all FAIL. tierFor()
//     maps LS statuses to the right tier.
//   LIVE (runs if the function is deployed): a forged/unsigned POST must get HTTP 401. If the
//     function isn't deployed yet (404), it SKIPS with a note instead of failing.
//
// Run:  node saas/tests/webhook_signature.mjs
// Exit: 0 = all ran checks passed, 1 = a real failure.
import { verify, tierFor } from "../supabase/functions/lemonsqueezy-webhook/verify.mjs";

const results = [];
const check = (ok, name, detail = "") => {
  results.push([!!ok, name]);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? "  — " + detail : ""}`);
  return !!ok;
};

// build a genuine LS-style signature (hex HMAC-SHA256) the way Lemon Squeezy does.
async function sign(raw, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(raw));
  return [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function unit() {
  console.log("\nUNIT — real verify() logic (imported from the Edge Function):");
  const secret = "whsec_test_" + "a".repeat(24);
  const body = JSON.stringify({ meta: { event_name: "subscription_created" }, data: { id: "42", attributes: { status: "active" } } });
  const good = await sign(body, secret);

  check(await verify(body, good, secret) === true, "correctly-signed body verifies");
  check(await verify(body + " ", good, secret) === false, "tampered body is rejected");
  check(await verify(body, good, secret + "x") === false, "wrong secret is rejected");
  check(await verify(body, "deadbeef", secret) === false, "short/garbage signature is rejected (length guard)");
  check(await verify(body, good.slice(0, -1) + (good.endsWith("0") ? "1" : "0"), secret) === false,
        "one-char-flipped signature is rejected");
  check(await verify(body, good, "") === false, "empty secret fails closed");
  check(await verify(body, "", secret) === false, "empty signature is rejected");

  check(tierFor("active") === "pro" && tierFor("on_trial") === "pro" && tierFor("paid") === "pro",
        "active / on_trial / paid map to pro");
  check(tierFor("cancelled") === "free" && tierFor("expired") === "free" && tierFor("past_due") === "free",
        "cancelled / expired / past_due map to free");
  check(tierFor("something_new") === null, "unknown status leaves tier unchanged (null)");
}

async function live() {
  const SB = process.env.ZT_SUPABASE_URL || "https://ponvarxeytfcntckczbn.supabase.co";
  const ANON = process.env.ZT_SUPABASE_ANON || "sb_publishable_w-pQMK0bj-91EPHXtA0sMQ__CTu_rf1";
  const FN = `${SB}/functions/v1/lemonsqueezy-webhook`;
  const body = JSON.stringify({ meta: { event_name: "subscription_created", custom_data: { user_id: "00000000-0000-0000-0000-000000000000" } }, data: { id: "1", attributes: { status: "active" } } });
  const post = (sig) => fetch(FN, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json", ...(sig ? { "X-Signature": sig } : {}) }, body });

  console.log("\nLIVE — deployed webhook rejects forgeries:");
  let r;
  try { r = await post(null); }
  catch (e) { console.log("  [SKIP] webhook unreachable —", e.message); return; }
  if (r.status === 404) {
    console.log("  [SKIP] webhook not deployed yet (404). Deploy with:");
    console.log("         supabase functions deploy lemonsqueezy-webhook");
    console.log("         supabase secrets set LEMONSQUEEZY_WEBHOOK_SECRET=<your LS signing secret>");
    return;
  }
  check(r.status === 401, "unsigned POST is rejected (401)", `got ${r.status}`);
  const r2 = await post("deadbeef".repeat(8));
  check(r2.status === 401, "forged-signature POST is rejected (401)", `got ${r2.status}`);
}

const failed = () => results.filter(([ok]) => !ok).length;
console.log("=".repeat(64));
console.log("  zengtrade SaaS — billing webhook signature");
console.log("=".repeat(64));
await unit();
await live();
console.log("\n" + "=".repeat(64));
console.log(`  ${results.length - failed()}/${results.length} checks passed`);
console.log("=".repeat(64));
process.exit(failed() ? 1 : 0);
