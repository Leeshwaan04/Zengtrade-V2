// zengtrade — NOWPayments IPN: signature verification + billing helpers.
// Plain-JS (no type annotations) so the SAME code runs in Deno (the Edge Function) AND in Node
// (saas/tests/nowpayments_signature.mjs). Both expose Web Crypto (`crypto.subtle`) + TextEncoder.
// This is the real security boundary: a forged IPN must NEVER grant a paid tier.
//
// NOWPayments signs the IPN as HMAC-SHA512 over the JSON body with keys sorted alphabetically
// (recursively), hex-encoded, delivered in the `x-nowpayments-sig` header.

const enc = new TextEncoder();

// recursively sort object keys (arrays keep order) — matches NOWPayments' canonicalisation.
function sortDeep(v) {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === "object") {
    return Object.keys(v).sort().reduce((o, k) => { o[k] = sortDeep(v[k]); return o; }, {});
  }
  return v;
}

// the exact string NOWPayments HMACs: JSON of the payload with sorted keys.
export function canonical(rawOrObj) {
  const obj = typeof rawOrObj === "string" ? JSON.parse(rawOrObj) : rawOrObj;
  return JSON.stringify(sortDeep(obj));
}

// constant-time HMAC-SHA512 verification of the (canonicalised) body against x-nowpayments-sig.
export async function verify(raw, sig, secret) {
  if (!secret || !sig) return false;                 // no secret / no sig → refuse (fail closed)
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(canonical(raw)));
  const hex = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, "0")).join("");
  const got = String(sig).toLowerCase();
  if (hex.length !== got.length) return false;
  let diff = 0;                                       // constant-time compare
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

// order_id we set at invoice time: "<userId>:<plan>:<cycle>:<ts>"
export function parseOrder(orderId) {
  const [userId, plan, cycle] = String(orderId || "").split(":");
  return { userId: userId || null, plan: plan || null, cycle: cycle || null };
}

// NOWPayments payment_status values that mean "paid in full" → grant access.
export const PAID = new Set(["finished", "confirmed"]);
export const grants = (status) => PAID.has(status);

// only known plans map to a tier (guards against a junk/forged order_id).
export const PLAN_TIERS = new Set(["pro", "elite"]);
export const tierFor = (plan) => (PLAN_TIERS.has(plan) ? plan : null);

// period end from the billing cycle, computed from a base epoch-ms.
export function periodEnd(cycle, fromMs) {
  const d = new Date(fromMs);
  if (cycle === "year") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);           // default: month
  return d.toISOString();
}
