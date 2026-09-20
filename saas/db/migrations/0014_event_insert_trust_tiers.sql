-- Tighten funnel event forgery: anon (fully unauthenticated, using only the public anon key)
-- could freely POST deploy_click/deploy_success/checkout_click straight to /rest/v1/event with
-- no rate limit and no correlation to a real deployment or checkout, polluting the funnel
-- metrics that drive real product/growth decisions. Those three event names only ever fire from
-- an authenticated surface in practice (deploy_click/deploy_success: deploy/landing/studio.js,
-- injected only on the signed-in /dashboard terminal; checkout_click: saas/web/js/billing.js,
-- only loaded from /app#pricing, which requireAuth() gates). pageview/signup_view/
-- signup_complete/plan_intent legitimately need anon access, they fire before a session exists
-- (a first-time visitor browsing the marketing site, or mid-signup before confirmation). This
-- doesn't fully eliminate forgery, a real free account could still script event spam, but it
-- removes the zero-cost, fully-anonymous path, which is the bulk of the exposure.
-- Safe to re-run: drop + recreate.

drop policy if exists event_insert on event;

create policy event_insert_public on event for insert to anon, authenticated
  with check (
    name in ('pageview', 'signup_view', 'signup_complete', 'plan_intent')
    and length(coalesce(path, '')) < 300
    and length(coalesce(ref, '')) < 300
  );

drop policy if exists event_insert_authenticated on event;
create policy event_insert_authenticated on event for insert to authenticated
  with check (
    name in ('deploy_click', 'deploy_success', 'checkout_click')
    and length(coalesce(path, '')) < 300
    and length(coalesce(ref, '')) < 300
  );
