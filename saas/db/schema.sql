-- zengtrade — multi-tenant schema (Postgres / Supabase-flavoured)
-- The isolation backbone: every business row carries user_id, and Row-Level Security (RLS)
-- makes it PHYSICALLY IMPOSSIBLE for one user's session to read another's rows — the DB
-- enforces it, not the app. This is what turns the single-tenant terminal into a safe product.
--
-- Auth itself (users, passwords, OAuth, sessions, email verification) is owned by the auth
-- provider (Supabase auth.users) — we never store or hash passwords ourselves.

-- ---------- profile: 1:1 with the auth user ----------
create table profile (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  tier          text not null default 'free',          -- free | pro
  risk_ack_at   timestamptz,                            -- when they accepted the risk disclaimer
  created_at    timestamptz not null default now()
);

-- ---------- subscription (billing mirror) ----------
create table subscription (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  plan               text not null default 'free',
  status             text not null default 'active',    -- active | past_due | canceled
  current_period_end timestamptz,
  provider_ref       text                                -- Stripe/Razorpay customer/sub id
);

-- ---------- the user's own exchange link (BYO-broker, non-custodial) ----------
-- Keys are stored ENCRYPTED (app-side envelope encryption); trade-only scope, never withdrawal.
create table exchange_connection (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  exchange      text not null default 'binance',
  api_key_enc   bytea not null,
  api_secret_enc bytea not null,
  scope         text not null default 'trade',          -- trade only; withdrawal NEVER requested
  connected_at  timestamptz not null default now(),
  unique (user_id, exchange)
);

-- ---------- which strategies this user has deployed ----------
create table deployment (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  strategy_key  text not null,                          -- e.g. 'vwap_pull', 'lowvol'
  mode          text not null default 'paper',          -- paper | live
  status        text not null default 'running',        -- running | stopped
  deployed_at   timestamptz not null default now(),
  unique (user_id, strategy_key)
);

-- ---------- per-user book state (survives restarts) ----------
create table book_state (
  user_id       uuid not null references auth.users(id) on delete cascade,
  strategy_key  text not null,
  realised      numeric not null default 0,
  positions     jsonb  not null default '[]',
  updated_at    timestamptz not null default now(),
  primary key (user_id, strategy_key)
);

-- ---------- per-user trade log (the system of record, per tenant) ----------
create table trade (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  strategy_key  text not null,
  symbol        text not null,
  side          text not null,                          -- BUY | SELL
  qty           numeric not null,
  entry         numeric,
  exit          numeric,
  pnl           numeric,
  cost          numeric,                                -- honest round-trip cost booked
  regime        text,
  is_live       boolean not null default false,         -- paper vs real
  opened_at     timestamptz,
  closed_at     timestamptz
);
create index on trade (user_id, strategy_key, closed_at);

-- ============================================================
-- ROW-LEVEL SECURITY — the guarantee. Enable on every tenant table,
-- then a single policy: you may only touch rows where user_id = your auth id.
-- ============================================================
alter table profile              enable row level security;
alter table subscription         enable row level security;
alter table exchange_connection  enable row level security;
alter table deployment           enable row level security;
alter table book_state           enable row level security;
alter table trade                enable row level security;

create policy own_profile      on profile             using (id = auth.uid())      with check (id = auth.uid());
create policy own_subscription on subscription        using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_exchange     on exchange_connection using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_deployment   on deployment          using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_book         on book_state          using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_trade        on trade               using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The strategy engine (server-side workers) uses the service role to write results,
-- always scoping every insert/update by user_id — RLS is the backstop if app code ever slips.

-- ---------- webhook idempotency (billing) ----------
create table webhook_event (
  id          text primary key,           -- provider event signature; dupes are skipped
  provider    text not null,
  received_at timestamptz not null default now()
);
-- only the service role writes here (Edge Function); users have no access
alter table webhook_event enable row level security;
