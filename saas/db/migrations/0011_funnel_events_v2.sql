-- Extend funnel events for signup→deploy→checkout attribution (CPO/CBO autopilot).
-- Safe to re-run: CREATE OR REPLACE + policy replace.

drop policy if exists event_insert on event;
create policy event_insert on event for insert to anon, authenticated
  with check (
    name in (
      'pageview', 'signup_view', 'signup_complete', 'plan_intent',
      'deploy_click', 'deploy_success', 'checkout_click'
    )
    and length(coalesce(path, '')) < 300
    and length(coalesce(ref, '')) < 300
  );

create or replace function public.admin_overview()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  hb_ts timestamptz;
  alive boolean;
begin
  if not public.is_admin() then
    return null;
  end if;

  select updated_at into hb_ts
    from engine_state where key = '_worker_heartbeat';
  alive := hb_ts is not null and hb_ts > now() - interval '12 minutes';

  return json_build_object(
    'mrr_usd', (
      select coalesce(sum(case p.tier when 'pro' then 19 when 'elite' then 79 else 0 end), 0)
      from profile p where p.tier in ('pro', 'elite')
    ),
    'paying', (select count(*)::int from profile where tier in ('pro', 'elite')),
    'users_pro', (select count(*)::int from profile where tier = 'pro'),
    'users_elite', (select count(*)::int from profile where tier = 'elite'),
    'users_total', (select count(*)::int from profile),
    'users_confirmed', (
      select count(*)::int from auth.users u
      where u.email_confirmed_at is not null
    ),
    'payment_events', (select count(*)::int from webhook_event),
    'deployers', (select count(distinct user_id)::int from deployment),
    'deployments_running', (
      select count(*)::int from deployment where status = 'running'
    ),
    'custom_strategies', (
      select count(*)::int from deployment where strategy_key like 'custom\_%'
    ),
    'trades_total', (select count(*)::int from trade where closed_at is not null),
    'pageviews_7d', (
      select count(*)::int from event
      where name = 'pageview' and ts > now() - interval '7 days'
    ),
    'signup_views_7d', (
      select count(*)::int from event
      where name = 'signup_view' and ts > now() - interval '7 days'
    ),
    'signup_complete_7d', (
      select count(*)::int from event
      where name = 'signup_complete' and ts > now() - interval '7 days'
    ),
    'plan_intents_7d', (
      select count(*)::int from event
      where name = 'plan_intent' and ts > now() - interval '7 days'
    ),
    'deploy_clicks_7d', (
      select count(*)::int from event
      where name = 'deploy_click' and ts > now() - interval '7 days'
    ),
    'deploy_success_7d', (
      select count(*)::int from event
      where name = 'deploy_success' and ts > now() - interval '7 days'
    ),
    'checkout_clicks_7d', (
      select count(*)::int from event
      where name = 'checkout_click' and ts > now() - interval '7 days'
    ),
    'worker_alive', alive,
    'worker_last_cycle', hb_ts
  );
end;
$$;

revoke all on function public.admin_overview() from public;
grant execute on function public.admin_overview() to authenticated;
