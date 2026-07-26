-- zengtrade — billing hardening.
-- (A) grant_paid(): ONE atomic transaction for the IPN grant, fixing three audit findings at once:
--     * reliability  — webhook_event dedup + profile + subscription all commit together or roll back
--       together, so a mid-way failure can't leave a paid user un-upgraded (a retry re-processes).
--     * idempotency  — keyed on payment_id ALONE (not payment_id:status), so 'confirmed' then
--       'finished' for the same payment grant exactly once.
--     * early renewal — the new period extends from GREATEST(existing end, now), so renewing early
--       no longer wipes the remaining paid days.
-- (B) enforce_deploy_limit(): SERVER-SIDE free-tier cap (was client-only), so a free user can't
--     insert unlimited deployment rows straight through the API.

-- ---- (A) atomic paid-grant, service-role only ----
create or replace function grant_paid(p_user uuid, p_tier text, p_cycle text, p_payment text)
returns text language plpgsql security definer set search_path = public as $$
declare cur timestamptz; new_end timestamptz;
begin
  -- idempotency guard: one row per payment. A duplicate raises unique_violation → caught → 'dup'.
  insert into webhook_event(id, provider) values ('nowpayments:' || p_payment, 'nowpayments');

  select current_period_end into cur from subscription where user_id = p_user;
  new_end := greatest(coalesce(cur, now()), now())
             + (case when p_cycle = 'year' then interval '1 year' else interval '1 month' end);

  update profile set tier = p_tier where id = p_user;
  insert into subscription(user_id, plan, status, current_period_end, provider_ref)
       values (p_user, p_tier, 'active', new_end, p_payment)
  on conflict (user_id) do update
       set plan = excluded.plan, status = 'active',
           current_period_end = excluded.current_period_end, provider_ref = excluded.provider_ref;

  return new_end::text;
exception when unique_violation then
  return 'dup';                                   -- already processed this payment
end $$;

-- lock it down: ONLY the service role (the IPN webhook) may call it — never a logged-in user,
-- or this would become a new self-upgrade path.
revoke all on function grant_paid(uuid, text, text, text) from public, anon, authenticated;
grant execute on function grant_paid(uuid, text, text, text) to service_role;

-- ---- (B) server-side free-tier deploy limit (FREE = 1 distinct strategy) ----
create or replace function enforce_deploy_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare usr_tier text; other_count int;
begin
  select tier into usr_tier from profile where id = new.user_id;
  if coalesce(usr_tier, 'free') in ('pro', 'elite') then
    return new;                                   -- paid = unlimited
  end if;
  -- count DISTINCT other strategies (so re-deploying the same one via upsert isn't blocked)
  select count(*) into other_count
    from deployment where user_id = new.user_id and strategy_key <> new.strategy_key;
  if other_count >= 1 then                        -- FREE_DEPLOY_LIMIT = 1
    raise exception 'FREE_LIMIT: upgrade to Pro to run more than one strategy'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists deploy_limit on deployment;
create trigger deploy_limit before insert on deployment
  for each row execute function enforce_deploy_limit();
