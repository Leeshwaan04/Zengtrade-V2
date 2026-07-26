-- zengtrade — pay-per-period enforcement.
-- The NOWPayments IPN sets profile.tier + subscription.current_period_end on payment. Crypto has no
-- card-style auto-charge, so access must EXPIRE at period end. This function reverts any paid tier to
-- 'free' once its subscription period has lapsed. Run it on a schedule (pg_cron below, or an external
-- cron hitting `select downgrade_expired();`).

create or replace function downgrade_expired() returns integer
language plpgsql security definer as $$
declare n integer;
begin
  update profile p
     set tier = 'free'
    from subscription s
   where s.user_id = p.id
     and p.tier <> 'free'
     and s.current_period_end is not null
     and s.current_period_end < now();
  get diagnostics n = row_count;
  update subscription
     set status = 'expired'
   where status = 'active'
     and current_period_end is not null
     and current_period_end < now();
  return n;
end $$;

-- Optional: schedule hourly with pg_cron. Enable the extension first in the Supabase dashboard
-- (Database → Extensions → pg_cron), then this schedule runs server-side with no external service.
-- If pg_cron is unavailable, drop this block and call downgrade_expired() from any external scheduler.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('zengtrade-downgrade-expired', '7 * * * *', 'select downgrade_expired();');
  end if;
end $$;
