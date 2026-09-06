-- Ensure every new auth user gets a profile row (tier 'free') server-side, so the billing
-- webhook's `update profile set tier='pro'` always has a row to hit, even if the client-side
-- ensureProfile() never ran. Idempotent: safe to run more than once.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profile (id, tier)
  values (new.id, 'free')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- backfill any existing users that lack a profile row
insert into public.profile (id, tier)
select u.id, 'free' from auth.users u
left join public.profile p on p.id = u.id
where p.id is null;
