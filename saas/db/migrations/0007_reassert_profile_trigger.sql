-- 2026-08-01 VAPT finding (HIGH): production DB was missing BOTH the handle_new_user()
-- function AND the on_auth_user_created trigger (migration 0002 never fully applied), so
-- new signups got no profile row. Because grant_paid() does `update profile ... where id`
-- (update-only), a paying user would have stayed on 'free'. Re-asserted live + backfilled.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profile (id, tier) values (new.id, 'free') on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
insert into public.profile (id, tier)
  select u.id, 'free' from auth.users u left join public.profile p on p.id=u.id where p.id is null;
