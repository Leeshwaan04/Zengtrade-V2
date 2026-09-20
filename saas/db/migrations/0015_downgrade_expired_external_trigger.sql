-- zengtrade: harden downgrade_expired()'s scheduling story.
-- MONETIZATION AUDIT (2026-09-20): downgrade_expired() (0003) is correct, but its ONLY trigger is
-- a migration-time conditional pg_cron schedule - "enable the extension first in the Supabase
-- dashboard" is a manual, undocumented-in-repo step with zero code-level guarantee it ever ran, and
-- no monitoring if it silently stops. If pg_cron was never enabled (or is later disabled), a paying
-- customer who lets their subscription lapse keeps full paid access forever, invisibly.
--
-- Two independent fixes, same migration since they're both about this one function's reachability:

-- (1) Tighten who can call it. 0003 never granted/revoked anything, so this security-definer
-- function has been callable by anon/authenticated via PostgREST RPC since it was created - callers
-- can't do anything harmful with it (it only enforces a business rule that should hold anyway), but
-- there's no reason an unauthenticated visitor should be able to invoke an internal admin operation.
-- Same pattern as grant_paid() (0005): service_role only.
revoke all on function downgrade_expired() from public, anon, authenticated;
grant execute on function downgrade_expired() to service_role;

-- (2) A redundant, code-visible trigger path: health-watch.yml (already scheduled every 6h) now
-- also calls this RPC directly with the service-role key, same defensive skip-if-secret-missing
-- pattern the workflow already uses for DATABASE_URL/RAILWAY_API_TOKEN. This runs whether or not
-- pg_cron is enabled - belt-and-suspenders, not a replacement for enabling pg_cron if you can.
