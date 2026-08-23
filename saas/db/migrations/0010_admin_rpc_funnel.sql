-- Admin RPCs + funnel metrics (signup_view, deploy_click) for /admin dashboard.
-- Safe to re-run: CREATE OR REPLACE.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from app_admin where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

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
    'deploy_clicks_7d', (
      select count(*)::int from event
      where name = 'deploy_click' and ts > now() - interval '7 days'
    ),
    'worker_alive', alive,
    'worker_last_cycle', hb_ts
  );
end;
$$;

revoke all on function public.admin_overview() from public;
grant execute on function public.admin_overview() to authenticated;

create or replace function public.admin_signups(days int default 30)
returns table(d date, n bigint)
language sql
stable
security definer
set search_path = public
as $$
  select gs.d::date,
         coalesce(c.n, 0) as n
  from generate_series(
         (current_date - (days - 1)),
         current_date,
         interval '1 day'
       ) as gs(d)
  left join (
    select p.created_at::date as d, count(*)::bigint as n
    from profile p
    group by 1
  ) c on c.d = gs.d::date
  where public.is_admin()
  order by gs.d;
$$;

revoke all on function public.admin_signups(int) from public;
grant execute on function public.admin_signups(int) to authenticated;

create or replace function public.admin_users()
returns table(
  email text,
  provider text,
  created text,
  tier text,
  deploys int,
  trades int,
  realised numeric,
  confirmed boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.email::text,
    coalesce(u.raw_app_meta_data->>'provider', 'email') as provider,
    to_char(p.created_at, 'YYYY-MM-DD') as created,
    p.tier,
    (select count(*)::int from deployment d where d.user_id = p.id) as deploys,
    (select count(*)::int from trade t where t.user_id = p.id and t.closed_at is not null) as trades,
    coalesce((
      select sum(bs.realised) from book_state bs where bs.user_id = p.id
    ), 0) as realised,
    (u.email_confirmed_at is not null) as confirmed
  from profile p
  join auth.users u on u.id = p.id
  where public.is_admin()
  order by p.created_at desc
  limit 500;
$$;

revoke all on function public.admin_users() from public;
grant execute on function public.admin_users() to authenticated;
