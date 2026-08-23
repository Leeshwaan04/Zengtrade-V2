-- Shared engine_state table (worker heartbeat + public catalog snapshots).
-- The worker writes _worker_heartbeat; admin/studio can read strategy metrics rows.

create table if not exists engine_state (
  key         text primary key,
  value       jsonb not null default '{}',
  updated_at  timestamptz not null default now()
);

alter table engine_state enable row level security;

-- Public read for non-sensitive catalog rows (studio landing snapshots).
create policy engine_state_public_read on engine_state
  for select using (left(key, 1) <> '_');

-- Service role (worker) writes all rows; users never write here directly.
revoke all on engine_state from anon, authenticated;
grant select on engine_state to anon, authenticated;
