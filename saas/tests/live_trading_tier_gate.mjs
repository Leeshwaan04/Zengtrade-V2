// zengtrade — tier-gate tests for live trading. Exercises the SAME requirePaidTier() that
// exchange-connect and place-order both import, so the boundary (a free-tier user must never
// reach a real exchange connect/order call) is actually tested, not just asserted in a comment.
// Run:  node saas/tests/live_trading_tier_gate.mjs
import { requirePaidTier } from "../supabase/functions/_shared/tier.mjs";

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log("  ✓", m)) : (fail++, console.error("  ✗", m)));

// minimal stand-in for the Supabase client's .from(...).select(...).eq(...).maybeSingle() chain,
// returning whatever this test wires up - enough to exercise requirePaidTier() in isolation
// without a live database.
function dbReturning(result) {
  return { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => result }) }) }) };
}

const free = await requirePaidTier(dbReturning({ data: { tier: "free" }, error: null }), "u1");
ok(free.ok === false && free.status === 403, "free tier is rejected with 403");
ok(/Pro\/Elite/.test(free.error), "free tier's error names the Pro/Elite requirement");

const pro = await requirePaidTier(dbReturning({ data: { tier: "pro" }, error: null }), "u2");
ok(pro.ok === true, "pro tier is allowed");

const elite = await requirePaidTier(dbReturning({ data: { tier: "elite" }, error: null }), "u3");
ok(elite.ok === true, "elite tier is allowed");

const missing = await requirePaidTier(dbReturning({ data: null, error: null }), "u4");
ok(missing.ok === false && missing.status === 403, "a missing profile row fails closed (403), not open");

const dbError = await requirePaidTier(dbReturning({ data: null, error: { message: "connection lost" } }), "u5");
ok(dbError.ok === false && dbError.status === 500, "a DB error fails closed (500), never silently allows through");

const unknownTier = await requirePaidTier(dbReturning({ data: { tier: "trial" }, error: null }), "u6");
ok(unknownTier.ok === false && unknownTier.status === 403, "an unrecognized tier value is rejected, not allowed by default");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
