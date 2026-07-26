// zengtrade — NOWPayments IPN signature tests. Exercises the SAME verify.mjs the Edge Function
// imports, so the security boundary (a forged IPN must never grant a paid tier) is actually tested.
// Run:  node saas/tests/nowpayments_signature.mjs
import { createHmac } from "node:crypto";
import { verify, canonical, parseOrder, grants, tierFor, periodEnd } from
  "../supabase/functions/nowpayments-ipn/verify.mjs";

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log("  ✓", m)) : (fail++, console.error("  ✗", m)));

// how NOWPayments signs: HMAC-SHA512 over the sorted-key JSON, hex. We reproduce it with node crypto
// to prove verify() accepts a genuine signature and rejects everything else.
const IPN = "test_ipn_secret_do_not_use";
const sign = (obj, secret = IPN) =>
  createHmac("sha512", secret).update(canonical(obj)).digest("hex");

const body = {
  payment_id: 5524759814,
  payment_status: "finished",
  pay_address: "0xabc",
  price_amount: 29,
  price_currency: "usd",
  order_id: "11111111-2222-3333-4444-555555555555:pro:month:1700000000000",
  order_description: "zengtrade pro plan (month)",
  actually_paid: 29,
};
const rawInOrder = JSON.stringify(body);            // NOTE: keys NOT sorted → must still verify

// --- signature acceptance / rejection ---
ok(await verify(rawInOrder, sign(body), IPN), "accepts a valid signature (unsorted raw body)");
ok(!(await verify(rawInOrder, sign(body) + "00", IPN)), "rejects a tampered signature");
ok(!(await verify(JSON.stringify({ ...body, price_amount: 1 }), sign(body), IPN)),
   "rejects a mutated body (amount changed) with the original signature");
ok(!(await verify(rawInOrder, sign(body, "wrong_secret"), IPN)), "rejects a signature made with the wrong secret");
ok(!(await verify(rawInOrder, sign(body), "")), "fails closed when no IPN secret is configured");
ok(!(await verify(rawInOrder, "", IPN)), "fails closed when no signature header is present");
// key order must not matter (NOWPayments sorts keys before signing)
const reordered = JSON.stringify({ order_id: body.order_id, payment_status: "finished", payment_id: body.payment_id, price_amount: 29, price_currency: "usd", pay_address: "0xabc", order_description: body.order_description, actually_paid: 29 });
ok(await verify(reordered, sign(body), IPN), "verification is independent of JSON key order");

// --- billing helpers ---
const p = parseOrder(body.order_id);
ok(p.userId === "11111111-2222-3333-4444-555555555555" && p.plan === "pro" && p.cycle === "month",
   "parseOrder splits userId:plan:cycle");
ok(grants("finished") && grants("confirmed"), "grants() true for finished/confirmed");
ok(!grants("waiting") && !grants("partially_paid") && !grants("expired"), "grants() false for non-final statuses");
ok(tierFor("pro") === "pro" && tierFor("elite") === "elite" && tierFor("hacker") === null,
   "tierFor() only allows known plans");
const base = Date.UTC(2026, 0, 1);
ok(periodEnd("month", base) === new Date(Date.UTC(2026, 1, 1)).toISOString(), "periodEnd month = +1 month");
ok(periodEnd("year", base) === new Date(Date.UTC(2027, 0, 1)).toISOString(), "periodEnd year = +1 year");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
