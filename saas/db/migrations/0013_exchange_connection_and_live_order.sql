-- Real, non-custodial Binance order execution (GYOK: user connects their own key, zengtrade
-- never holds funds). Two tables:
--   exchange_connection: already defined in schema.sql (line ~29) but with no tracked migration -
--     it was very likely bootstrapped once directly from schema.sql against the live project, not
--     through the numbered migration trail (saas/tests/rls_isolation.py already references it as
--     if it exists live). `create table if not exists` makes this migration safe to run either
--     way: a no-op if the table is already there, a real create if it somehow isn't.
--   live_order: new. Deliberately NOT the existing `trade` table - trade is shaped for the algo
--     worker's entry+exit+pnl round-trip model and paper Trading orders don't write to it at all
--     today; a single manual BUY/SELL has no paired exit yet, so reusing trade's semantics here
--     would be a real modeling mistake.

create table if not exists exchange_connection (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  exchange       text not null default 'binance',
  api_key_enc    bytea not null,
  api_secret_enc bytea not null,
  scope          text not null default 'trade',          -- trade only; withdrawal NEVER requested
  connected_at   timestamptz not null default now(),
  unique (user_id, exchange)
);

create table if not exists live_order (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  exchange         text not null default 'binance',
  symbol           text not null,
  side             text not null,                        -- BUY | SELL
  qty              numeric not null,
  avg_price        numeric,
  notional_usd     numeric not null,
  binance_order_id text,
  status           text not null,                         -- FILLED | rejected | ...
  raw_response     jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists live_order_user_created_idx on live_order (user_id, created_at desc);

alter table exchange_connection enable row level security;
alter table live_order          enable row level security;

drop policy if exists own_exchange    on exchange_connection;
drop policy if exists own_live_order  on live_order;
create policy own_exchange   on exchange_connection using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_live_order on live_order          using (user_id = auth.uid()) with check (user_id = auth.uid());

-- users read/write only their own rows (via RLS above); the Edge Functions always act on the
-- CALLER'S OWN JWT for both tables, never the service-role key, so no broader grant is needed.
