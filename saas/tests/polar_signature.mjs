// zengtrade Polar webhook signature test — stops a forged webhook granting Pro.
// Imports the REAL verify()/tierFor()/statusFromEvent() from the Edge Function module (not a copy).
//
//   UNIT (always): a correctly Standard-Webhooks-signed body verifies; tampered body, wrong secret,
//     missing/blank headers, and empty secret all FAIL. tierFor + statusFromEvent map correctly.
//   LIVE (if deployed): a forged POST to the deployed function must 401. SKIPs on 404.
//
// Run:  node saas/tests/polar_signature.mjs
import { verify, tierFor, statusFromEvent } from "../supabase/functions/polar-webhook/verify.mjs";

const results = [];
const check = (ok, name, detail = "") => {
  results.push([!!ok, name]);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? "  — " + detail : ""}`);
  return !!ok;
};

const enc = new TextEncoder();
const b64 = (buf) => { const b = new Uint8Array(buf); let s = ""; for (const x of b) s += String.fromCharCode(x); return btoa(s); };
const bytesFromB64 = (s) => { const bin = atob(s); const o = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return o; };

// build a genuine Standard-Webhooks signature the way Polar does.
async function sign(id, ts, body, secret) {
  const keyBytes = bytesFromB64(secret.replace(/^whsec_/, ""));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${id}.${ts}.${body}`));
  return `v1,${b64(mac)}`;
}

async function unit() {
  console.log("\nUNIT — real Standard-Webhooks verify() (imported from the Edge Function):");
  const secret = "whsec_" + b64(crypto.getRandomValues(new Uint8Array(32)));
  const id = "msg_123", ts = "1700000000";
  const body = JSON.stringify({ type: "subscription.active", data: { id: "sub_1", status: "active", customer: { external_id: "user-abc" } } });
  const good = await sign(id, ts, body, secret);
  const H = (sig) => ({ "webhook-id": id, "webhook-timestamp": ts, "webhook-signature": sig });

  check(await verify(body, H(good), secret) === true, "correctly-signed body verifies");
  check(await verify(body + " ", H(good), secret) === false, "tampered body is rejected");
  check(await verify(body, H(good), "whsec_" + b64(crypto.getRandomValues(new Uint8Array(32)))) === false, "wrong secret is rejected");
  check(await verify(body, H("v1,deadbeef"), secret) === false, "garbage signature is rejected");
  check(await verify(body, { "webhook-id": id, "webhook-timestamp": ts, "webhook-signature": "" }, secret) === false, "missing signature is rejected");
  check(await verify(body, { "webhook-signature": good }, secret) === false, "missing id/timestamp is rejected");
  check(await verify(body, H(good), "") === false, "empty secret fails closed");
  // multi-signature header: any valid entry passes
  check(await verify(body, H(`v1,AAAA ${good}`), secret) === true, "passes when one of several sigs is valid");

  check(tierFor("active") === "pro" && tierFor("trialing") === "pro", "active / trialing -> pro");
  check(tierFor("canceled") === "free" && tierFor("revoked") === "free" && tierFor("past_due") === "free", "canceled / revoked / past_due -> free");
  check(tierFor("incomplete") === null, "incomplete leaves tier unchanged");
  check(statusFromEvent({ type: "subscription.revoked", data: { status: "active" } }) === "revoked", "revoked event forces revoked (access ended)");
  check(statusFromEvent({ type: "subscription.updated", data: { status: "past_due" } }) === "past_due", "updated event reads entity status");
}

async function live() {
  const SB = process.env.ZT_SUPABASE_URL || "https://ponvarxeytfcntckczbn.supabase.co";
  const ANON = process.env.ZT_SUPABASE_ANON || "sb_publishable_w-pQMK0bj-91EPHXtA0sMQ__CTu_rf1";
  const FN = `${SB}/functions/v1/polar-webhook`;
  const body = JSON.stringify({ type: "subscription.active", data: { id: "sub_1", status: "active", customer: { external_id: "x" } } });
  console.log("\nLIVE — deployed webhook rejects forgeries:");
  let r;
  try { r = await fetch(FN, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json", "webhook-id": "m", "webhook-timestamp": "1", "webhook-signature": "v1,forged" }, body }); }
  catch (e) { console.log("  [SKIP] unreachable —", e.message); return; }
  if (r.status === 404) { console.log("  [SKIP] polar-webhook not deployed yet (404). Deploy with saas/deploy_polar.sh"); return; }
  check(r.status === 401, "forged-signature POST is rejected (401)", `got ${r.status}`);
}

const failed = () => results.filter(([ok]) => !ok).length;
console.log("=".repeat(64));
console.log("  zengtrade SaaS — Polar webhook signature");
console.log("=".repeat(64));
await unit();
await live();
console.log("\n" + "=".repeat(64));
console.log(`  ${results.length - failed()}/${results.length} checks passed`);
console.log("=".repeat(64));
process.exit(failed() ? 1 : 0);
