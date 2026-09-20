// zengtrade — gate live-money features behind a paid tier, server-side.
// MONETIZATION FIX (2026-09-20): the pricing page sells live execution as a Pro/Elite feature
// ("unlocks per strategy only after it clears the go-live bar" / connect your exchange), but until
// now nothing server-side actually checked profile.tier before connecting a real exchange key or
// placing a real order - any free-tier user could do both. Shared so exchange-connect and
// place-order can't drift from each other on what counts as "paid".
//
// Reads via the CALLER'S OWN JWT (RLS "own_profile" policy, saas/db/migrations/0004), not the
// service role - a user has always been allowed to read their own tier, this only adds a check on
// what that read is used to gate.
export async function requirePaidTier(db, userId) {
  const { data: prof, error } = await db.from("profile").select("tier").eq("id", userId).maybeSingle();
  if (error) return { ok: false, status: 500, error: "server error" };
  if (!prof || (prof.tier !== "pro" && prof.tier !== "elite")) {
    return { ok: false, status: 403, error: "Live trading is a Pro/Elite feature. Upgrade to connect a real exchange account and place live orders." };
  }
  return { ok: true };
}
