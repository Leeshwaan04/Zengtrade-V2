// zengtrade — AES-256-GCM helpers for encrypting a user's own exchange API key/secret at rest.
// Plain JS (no type annotations) so the SAME code runs in Deno (the Edge Functions) AND in Node
// (saas/tests/exchange_key_crypto.mjs), same convention as nowpayments-ipn/verify.mjs. Both
// expose Web Crypto (`crypto.subtle`) + TextEncoder/TextDecoder.
//
// Stored blob layout, one bytea column per secret: [1 byte key version][12 byte IV][ciphertext+tag].
// The IV MUST be fresh random bytes on every single encryption call - reusing an IV under the same
// key is the one genuinely fatal AES-GCM mistake (it breaks both confidentiality and integrity).
// The version byte costs nothing now and means a future master-key rotation can decrypt old blobs
// under the old key while writing new ones under the new key, no hard cutover required.

const enc = new TextEncoder();
const dec = new TextDecoder();
const KEY_VERSION = 1;
const IV_LEN = 12; // bytes, the standard/recommended AES-GCM nonce size

function importMasterKey(masterKeyB64) {
  const raw = Uint8Array.from(atob(masterKeyB64), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error("master key must decode to exactly 32 bytes (AES-256)");
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

// plaintext string -> Uint8Array blob ready to hex-encode and store in a bytea column.
export async function encryptSecret(plaintext, masterKeyB64) {
  const key = await importMasterKey(masterKeyB64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext)));
  const out = new Uint8Array(1 + IV_LEN + ct.length);
  out[0] = KEY_VERSION;
  out.set(iv, 1);
  out.set(ct, 1 + IV_LEN);
  return out;
}

// the stored blob (Uint8Array) -> the original plaintext string.
export async function decryptSecret(blob, masterKeyB64) {
  if (!(blob instanceof Uint8Array) || blob.length < 1 + IV_LEN + 16) throw new Error("malformed encrypted blob");
  const version = blob[0];
  if (version !== KEY_VERSION) throw new Error(`unsupported key version ${version}`);
  const iv = blob.slice(1, 1 + IV_LEN);
  const ct = blob.slice(1 + IV_LEN);
  const key = await importMasterKey(masterKeyB64);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return dec.decode(pt);
}

// PostgREST represents `bytea` in JSON as a hex string prefixed "\x" - NOT base64, NOT raw bytes.
export function toPgBytea(u8) {
  return "\\x" + [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function fromPgBytea(hexWithPrefix) {
  const hex = String(hexWithPrefix).replace(/^\\x/, "");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}
