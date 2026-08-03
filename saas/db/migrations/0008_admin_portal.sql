-- Admin portal: allowlist + first-party funnel events + admin-only aggregate RPCs.
-- Security model: app_admin has RLS enabled with NO policies (invisible to REST). RPCs are
-- security-definer and each checks is_admin() first, so only allowlisted users read aggregates;
-- service_role is never exposed to the browser. event allows scoped anon INSERT (pageview only).
create table if not exists app_admin (user_id uuid primary key references auth.users(id) on delete cascade, added_at timestamptz not null default now());
alter table app_admin enable row level security;
create table if not exists event (id bigint generated always as identity primary key, name text not null, path text, ref text, ts timestamptz not null default now());
alter table event enable row level security;
drop policy if exists event_insert on event;
create policy event_insert on event for insert to anon, authenticated with check (name in ('pageview','signup_view','deploy_click') and length(coalesce(path,''))<300 and length(coalesce(ref,''))<300);
-- is_admin() + admin_overview()/admin_signups()/admin_users() created live; see session notes.
