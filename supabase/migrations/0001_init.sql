-- Investment Guru initial schema
-- Mirrors SPEC.md "Data model" section. Run with:
--   supabase db reset  (local)
--   supabase db push   (remote, after `supabase link`)

set search_path = public;

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- profiles: 1:1 with auth.users, holds app-specific fields
-- ----------------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  tier        text not null default 'free' check (tier in ('free','paid')),
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name) values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ----------------------------------------------------------------------------
-- invite_codes
-- ----------------------------------------------------------------------------
create table invite_codes (
  code        text primary key,
  created_by  uuid references profiles(id),
  redeemed_by uuid references profiles(id),
  redeemed_at timestamptz,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- portfolios
-- ----------------------------------------------------------------------------
create table portfolios (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index portfolios_owner_idx on portfolios (owner_id);

-- ----------------------------------------------------------------------------
-- holdings
-- ----------------------------------------------------------------------------
create table holdings (
  id          uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references portfolios(id) on delete cascade,
  ticker      text not null,
  shares      numeric(20,8) not null check (shares >= 0),
  cost_basis  numeric(20,4),
  acquired_at date,
  notes       text,
  created_at  timestamptz not null default now()
);
create index holdings_portfolio_idx on holdings (portfolio_id);

-- ----------------------------------------------------------------------------
-- target_allocations: weights JSON, must sum to ~1.0 (validated app-side)
-- ----------------------------------------------------------------------------
create table target_allocations (
  portfolio_id uuid primary key references portfolios(id) on delete cascade,
  weights     jsonb not null,
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- rebalance_rules
-- ----------------------------------------------------------------------------
create table rebalance_rules (
  portfolio_id   uuid primary key references portfolios(id) on delete cascade,
  trigger_type   text not null check (trigger_type in ('threshold','calendar','both')),
  drift_pct      numeric(5,2),
  calendar       text check (calendar in ('monthly','quarterly','semiannual','annual')),
  use_cash_flow  boolean not null default true,
  updated_at     timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- tickers + prices (shared reference data, not user-owned)
-- ----------------------------------------------------------------------------
create table tickers (
  symbol         text primary key,
  name           text,
  asset_class    text,
  exchange       text,
  active         boolean not null default true,
  last_synced_at timestamptz
);

create table prices_daily (
  ticker     text not null references tickers(symbol),
  trade_date date not null,
  open       numeric(20,4),
  high       numeric(20,4),
  low        numeric(20,4),
  close      numeric(20,4) not null,
  adj_close  numeric(20,4) not null,
  volume     bigint,
  primary key (ticker, trade_date)
);
create index prices_daily_date_idx on prices_daily (trade_date);

-- ----------------------------------------------------------------------------
-- backtests
-- ----------------------------------------------------------------------------
create table backtests (
  id           uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references portfolios(id) on delete cascade,
  config       jsonb not null,
  result       jsonb,
  status       text not null default 'pending' check (status in ('pending','running','done','failed')),
  error        text,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);
create index backtests_portfolio_idx on backtests (portfolio_id);

-- ----------------------------------------------------------------------------
-- Fama-French 5 factor returns (shared reference data)
-- ----------------------------------------------------------------------------
create table ff5_factors_daily (
  trade_date date primary key,
  mkt_rf     numeric(10,6) not null,
  smb        numeric(10,6) not null,
  hml        numeric(10,6) not null,
  rmw        numeric(10,6) not null,
  cma        numeric(10,6) not null,
  rf         numeric(10,6) not null
);

-- ----------------------------------------------------------------------------
-- Row-Level Security
-- ----------------------------------------------------------------------------
alter table profiles            enable row level security;
alter table invite_codes        enable row level security;
alter table portfolios          enable row level security;
alter table holdings            enable row level security;
alter table target_allocations  enable row level security;
alter table rebalance_rules     enable row level security;
alter table backtests           enable row level security;

-- shared reference tables: read by anyone authenticated, write by service role only
alter table tickers           enable row level security;
alter table prices_daily      enable row level security;
alter table ff5_factors_daily enable row level security;

-- profiles: a user can read/update only their own profile
create policy profiles_self_read on profiles for select using (auth.uid() = id);
create policy profiles_self_update on profiles for update using (auth.uid() = id);

-- invite_codes: anyone authenticated may read (to redeem), but only admins can create
create policy invite_codes_read on invite_codes for select to authenticated using (true);

-- portfolios: owner only
create policy portfolios_owner_all on portfolios for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- holdings, allocations, rules, backtests: must own the parent portfolio
create policy holdings_owner_all on holdings for all
  using (exists (select 1 from portfolios p where p.id = holdings.portfolio_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from portfolios p where p.id = holdings.portfolio_id and p.owner_id = auth.uid()));

create policy target_allocations_owner_all on target_allocations for all
  using (exists (select 1 from portfolios p where p.id = target_allocations.portfolio_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from portfolios p where p.id = target_allocations.portfolio_id and p.owner_id = auth.uid()));

create policy rebalance_rules_owner_all on rebalance_rules for all
  using (exists (select 1 from portfolios p where p.id = rebalance_rules.portfolio_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from portfolios p where p.id = rebalance_rules.portfolio_id and p.owner_id = auth.uid()));

create policy backtests_owner_all on backtests for all
  using (exists (select 1 from portfolios p where p.id = backtests.portfolio_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from portfolios p where p.id = backtests.portfolio_id and p.owner_id = auth.uid()));

-- reference data: authenticated users read; writes go through service role bypass
create policy tickers_read           on tickers           for select to authenticated using (true);
create policy prices_daily_read      on prices_daily      for select to authenticated using (true);
create policy ff5_factors_daily_read on ff5_factors_daily for select to authenticated using (true);
