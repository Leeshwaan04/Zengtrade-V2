// zengtrade — Lemon Squeezy webhook: signature verification + tier mapping.
// Plain-JS module (no type annotations) so the SAME code runs in Deno (the Edge Function) AND
// in Node (the test) — both expose Web Crypto (`crypto.subtle`) and `TextEncoder` as globals.
// This is the real security boundary: a forged webhook must never flip a user's paid tier.

const enc = new TextEncoder();

// timing-safe HMAC-SHA256 verification of the raw body against X-Signature (lowercase hex).
export async function verify(raw, sig, secret) {
  if (!secret) return false;                        // no secret configured → refuse (fail closed)
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(raw));
  const hex = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== (sig || "").length) return false;
  let diff = 0;                                     // constant-time compare
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

export const ACTIVE = new Set(["active", "on_trial", "paid"]);           // -> pro
export const INACTIVE = new Set(["cancelled", "expired", "unpaid", "past_due"]); // -> free

// map a Lemon Squeezy subscription status to our tier (null = leave tier unchanged).
export function tierFor(status) {
  return ACTIVE.has(status) ? "pro" : INACTIVE.has(status) ? "free" : null;
}
