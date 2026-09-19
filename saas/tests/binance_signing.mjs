// zengtrade — Binance HMAC-SHA256 request-signing tests. Exercises the SAME binance.mjs the Edge
// Functions import, verified against Binance's own published worked example (developers.binance.com,
// "Request Security"), not just internal self-consistency.
// Run:  node saas/tests/binance_signing.mjs
import { hmacSha256Hex, roundToStep } from "../supabase/functions/_shared/binance.mjs";

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log("  ✓", m)) : (fail++, console.error("  ✗", m)));

// Binance's own published worked example:
//   echo -n "symbol=BTCUSDT&side=BUY&type=LIMIT&quantity=1&price=9000&timeInForce=GTC&recvWindow=5000&timestamp=1591702613943"
//     | openssl dgst -sha256 -hmac "2b5eb11e18796d12d88f13dc27dbbd02c2cc51ff7059765ed9821957d82bb4d9"
// Independently reproduced locally with both openssl and node:crypto before trusting it here.
const QS = "symbol=BTCUSDT&side=BUY&type=LIMIT&quantity=1&price=9000&timeInForce=GTC&recvWindow=5000&timestamp=1591702613943";
const SECRET = "2b5eb11e18796d12d88f13dc27dbbd02c2cc51ff7059765ed9821957d82bb4d9";
const EXPECTED = "3c661234138461fcc7a7d8746c6558c9842d4e10870d2ecbedf7777cad694af9";

const got = await hmacSha256Hex(SECRET, QS);
ok(got.length === 64, "signature is 64 hex chars (32-byte SHA-256 digest)");
ok(got === EXPECTED, "matches Binance's own published worked example exactly");
ok(got !== await hmacSha256Hex(SECRET, QS + "x"), "a different query string produces a different signature");
ok(got !== await hmacSha256Hex(SECRET + "x", QS), "a different secret produces a different signature");

// --- roundToStep ---
ok(roundToStep(0.123456, 0.00001) === 0.12345, "rounds down to LOT_SIZE step (0.00001)");
ok(roundToStep(1.999, 0.01) === 1.99, "rounds down, never up, so an order never exceeds intended notional");
ok(roundToStep(5, 0) === 5, "a zero/unset step size is a no-op, not a divide-by-zero");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
