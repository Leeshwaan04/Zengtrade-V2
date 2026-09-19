// zengtrade — AES-256-GCM encryption tests for stored exchange API keys/secrets. Exercises the
// SAME crypto.mjs the Edge Functions import, so the actual security boundary is tested, not a
// re-implementation of it.
// Run:  node saas/tests/exchange_key_crypto.mjs
import { encryptSecret, decryptSecret, toPgBytea, fromPgBytea } from
  "../supabase/functions/_shared/crypto.mjs";

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log("  ✓", m)) : (fail++, console.error("  ✗", m)));

const MASTER = "wZlT8+2m4kQpRj1sVXyN9cB6dF0hK3oQeT7aU5iP2xY="; // 32 raw bytes, base64 - test-only, never used for real
const plaintext = "binance-api-secret-EXAMPLE-abcdefgh12345678";

// --- round trip ---
const blob1 = await encryptSecret(plaintext, MASTER);
ok(await decryptSecret(blob1, MASTER) === plaintext, "round-trip: decrypt(encrypt(x)) === x");

// --- IV must never repeat: the one genuinely fatal AES-GCM mistake ---
const blob2 = await encryptSecret(plaintext, MASTER);
const iv1 = blob1.slice(1, 13), iv2 = blob2.slice(1, 13);
ok(!iv1.every((b, i) => b === iv2[i]), "two encryptions of the same plaintext use different IVs");
ok(!blob1.every((b, i) => b === blob2[i]), "two encryptions of the same plaintext produce different ciphertext");
ok(await decryptSecret(blob2, MASTER) === plaintext, "second encryption also round-trips correctly");

// --- tamper detection (GCM auth tag) ---
const tampered = blob1.slice();
tampered[tampered.length - 1] ^= 0xff; // flip a bit in the auth tag / ciphertext tail
let tamperThrew = false;
try { await decryptSecret(tampered, MASTER); } catch (e) { tamperThrew = true; }
ok(tamperThrew, "decrypting a tampered blob throws instead of returning corrupted plaintext");

// --- wrong key fails closed ---
const WRONG = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
let wrongKeyThrew = false;
try { await decryptSecret(blob1, WRONG); } catch (e) { wrongKeyThrew = true; }
ok(wrongKeyThrew, "decrypting with the wrong master key throws");

// --- version byte ---
ok(blob1[0] === 1, "stored blob starts with key-version byte 1");
const badVersion = blob1.slice(); badVersion[0] = 99;
let badVersionThrew = false;
try { await decryptSecret(badVersion, MASTER); } catch (e) { badVersionThrew = true; }
ok(badVersionThrew, "an unrecognised key-version byte is rejected, not silently misread");

// --- pg bytea hex round trip (this is exactly what gets sent to/from PostgREST) ---
const hex = toPgBytea(blob1);
ok(hex.startsWith("\\x"), 'toPgBytea prefixes with "\\x" (PostgREST bytea-over-JSON convention)');
ok(await decryptSecret(fromPgBytea(hex), MASTER) === plaintext, "toPgBytea -> fromPgBytea -> decrypt round-trips");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
