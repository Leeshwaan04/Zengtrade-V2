// zengtrade — Polar webhook: signature verification (Standard Webhooks spec) + subscription
// status -> tier mapping. Plain-JS so the SAME code runs in Deno (the Edge Function) AND Node
// (the test). This is the security boundary: a forged webhook must never flip a user's tier.
//
// Polar signs each webhook per the Standard Webhooks spec (webhooks.fyi):
//   headers:  webhook-id, webhook-timestamp, webhook-signature
//   secret:   "whsec_<base64>"  -> key bytes = base64decode(part after whsec_)
//   signed:   `${id}.${timestamp}.${rawBody}`
//   sig:      base64( HMAC-SHA256(signed, keyBytes) ), header may hold several space-separated
//             "v1,<sig>" entries — any match passes.

const enc = new TextEncoder();

function b64ToBytes(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(buf) {
  const b = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin);
}
function timingSafeEq(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// verify(rawBody, headers, secret) — headers is a plain object (lowercased keys).
export async function verify(raw, headers, secret) {
  if (!secret) return false;                                   // no secret -> refuse (fail closed)
  const id = headers["webhook-id"], ts = headers["webhook-timestamp"], hdr = headers["webhook-signature"];
  if (!id || !ts || !hdr) return false;

  const keyStr = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let keyBytes;
  try { keyBytes = b64ToBytes(keyStr); } catch { keyBytes = enc.encode(keyStr); }   // fallback: raw

  const signed = `${id}.${ts}.${raw}`;
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(signed));
  const expected = bytesToB64(mac);

  // header holds space-separated "v1,<sig>" entries — pass if any matches (constant-time).
  return hdr.split(" ").some(part => {
    const sig = part.includes(",") ? part.split(",")[1] : part;
    return timingSafeEq(sig, expected);
  });
}

// Polar subscription statuses (Stripe-like): incomplete | incomplete_expired | trialing | active
// | past_due | canceled | unpaid. Grant Pro while genuinely active/trialing; downgrade on the
// terminal ones; leave tier untouched while still incomplete.
export const ACTIVE = new Set(["active", "trialing"]);                                        // -> pro
export const INACTIVE = new Set(["canceled", "revoked", "unpaid", "past_due", "incomplete_expired"]); // -> free

export function tierFor(status) {
  return ACTIVE.has(status) ? "pro" : INACTIVE.has(status) ? "free" : null;
}

// Polar event names: subscription.created | .updated | .active | .canceled | .revoked | .uncanceled.
// 'revoked' = access has actually ended -> free, regardless of the entity's lingering status.
export function statusFromEvent(evt) {
  const ev = evt?.type || "";
  if (ev === "subscription.revoked") return "revoked";
  if (ev === "subscription.active") return "active";
  return evt?.data?.status || null;
}
