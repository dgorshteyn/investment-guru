-- Investment Guru initial schema — transactions-first
-- See SPEC.md "Data model" section. Run with:
--   supabase db reset  (local)
--   supabase db push   (remote, after `supabase link`)

set search_path = public;

create extension if not exists "pgcrypto";

-- ============================================================================
-- Profiles (1:1 with auth.users)
-- ============================================================================
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  tier         text not null default 'free' check (tier in ('free','paid')),
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

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

-- ============================================================================
-- Invite codes (used in Phase 2)
-- ============================================================================
create table invite_codes (
  code        text primary key,
  created_by  uuid references profiles(id),
  redeemed_by uuid references profiles(id),
  redeemed_at timestamptz,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- ============================================================================
-- Portfolios
-- ============================================================================
create table portfolios (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references profiles(id) on delete cascade,
  name         text not null,
  description  text,
  cloned_from  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index portfolios_owner_idx on portfolios (owner_id);

-- ============================================================================
-- Target allocations (versioned — append-only)
-- ============================================================================
create table target_allocations (
  id           uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references portfolios(id) on delete cascade,
  weights      jsonb not null,
  effective_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index target_allocations_portfolio_idx
  on target_allocations (portfolio_id, effective_at desc);

-- ============================================================================
-- Rebalance rules
-- ============================================================================
create table rebalance_rules (
  portfolio_id   uuid primary key references portfolios(id) on delete cascade,
  trigger_type   text not null check (trigger_type in ('threshold','calendar','both')),
  drift_pct      numeric(5,2),
  calendar       text check (calendar in ('monthly','quarterly','semiannual','annual')),
  use_cash_flow  boolean not null default true,
  updated_at     timestamptz not null default now()
);

-- ============================================================================
-- Transactions — source of truth for all portfolio state
-- ============================================================================
create table transactions (
  id           uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references portfolios(id) on delete cascade,
  kind         text not null check (kind in (
                 'opening_balance',
                 'buy', 'sell',
                 'dividend',
                 'reinvest_dividend',
                 'deposit', 'withdraw',
                 'split'
               )),
  ticker       text,                  -- null for deposit/withdraw
  shares       numeric(20,8),         -- positive for buy/dividend-reinvest/opening, negative for sell
  price        numeric(20,4),         -- per-share at trade date
  amount       numeric(20,4),         -- $ for deposit/withdraw/cash dividend
  fees         numeric(20,4) not null default 0,
  trade_date   date not null,
  notes        text,
  source       text check (source in ('manual','csv','rebalance_action')),
  created_at   timestamptz not null default now()
);
create index transactions_portfolio_date_idx on transactions (portfolio_id, trade_date);

-- ============================================================================
-- Derived caches: holdings + cash balance per portfolio
-- These are rebuilt by triggers whenever transactions change.
-- ============================================================================
create table holdings_cache (
  portfolio_id     uuid not null references portfolios(id) on delete cascade,
  ticker           text not null,
  shares           numeric(20,8) not null,
  cost_basis_total numeric(20,4) not null,
  primary key (portfolio_id, ticker)
);

create table cash_balances (
  portfolio_id uuid primary key references portfolios(id) on delete cascade,
  balance      numeric(20,4) not null default 0
);

-- Recompute (portfolio, ticker) row in holdings_cache from transactions.
-- Uses average cost basis (weighted by share count). Lot-level accounting deferred to v2.
create or replace function recompute_holding(p_portfolio uuid, p_ticker text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_shares     numeric(20,8);
  v_cost_basis numeric(20,4);
begin
  select
    coalesce(sum(case
      when kind = 'opening_balance' then shares
      when kind = 'buy'             then shares
      when kind = 'sell'            then -shares
      when kind = 'reinvest_dividend' then shares
      when kind = 'split'           then shares  -- delta from split
      else 0
    end), 0),
    coalesce(sum(case
      when kind in ('opening_balance','buy','reinvest_dividend')
        then (shares * coalesce(price, 0)) + coalesce(fees, 0)
      when kind = 'sell'
        then -((shares) * coalesce(price, 0))  -- reduce basis proportionally (simplified avg)
      else 0
    end), 0)
  into v_shares, v_cost_basis
  from transactions
  where portfolio_id = p_portfolio and ticker = p_ticker;

  if v_shares = 0 then
    delete from holdings_cache where portfolio_id = p_portfolio and ticker = p_ticker;
  else
    insert into holdings_cache (portfolio_id, ticker, shares, cost_basis_total)
    values (p_portfolio, p_ticker, v_shares, v_cost_basis)
    on conflict (portfolio_id, ticker)
    do update set shares = excluded.shares, cost_basis_total = excluded.cost_basis_total;
  end if;
end;
$$;

create or replace function recompute_cash(p_portfolio uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_balance numeric(20,4);
begin
  select coalesce(sum(case
    when kind = 'deposit'  then amount
    when kind = 'withdraw' then -amount
    when kind = 'dividend' then amount
    when kind = 'buy'      then -((shares * coalesce(price, 0)) + coalesce(fees, 0))
    when kind = 'sell'     then ((shares * coalesce(price, 0)) - coalesce(fees, 0))
    else 0
  end), 0)
  into v_balance
  from transactions where portfolio_id = p_portfolio;

  insert into cash_balances (portfolio_id, balance)
  values (p_portfolio, v_balance)
  on conflict (portfolio_id)
  do update set balance = excluded.balance;
end;
$$;

create or replace function transactions_recompute_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_portfolio uuid;
  v_ticker    text;
begin
  if tg_op = 'DELETE' then
    v_portfolio := old.portfolio_id;
    v_ticker    := old.ticker;
  else
    v_portfolio := new.portfolio_id;
    v_ticker    := new.ticker;
  end if;

  if v_ticker is not null then
    perform recompute_holding(v_portfolio, v_ticker);
    -- If the row was updated and ticker changed, also recompute the old ticker.
    if tg_op = 'UPDATE' and old.ticker is not null and old.ticker is distinct from new.ticker then
      perform recompute_holding(old.portfolio_id, old.ticker);
    end if;
  end if;

  perform recompute_cash(v_portfolio);
  return null;
end;
$$;

create trigger transactions_after_change
  after insert or update or delete on transactions
  for each row execute function transactions_recompute_trigger();

-- ============================================================================
-- Reference data: tickers, prices, FF5 factors, starter portfolios
-- ============================================================================
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

create table starter_portfolios (
  slug              text primary key,
  name              text not null,
  description       text not null,
  attribution       text,
  weights           jsonb not null,
  default_rebalance jsonb not null,
  created_at        timestamptz not null default now()
);

create table ff5_factors_daily (
  trade_date date primary key,
  mkt_rf     numeric(10,6) not null,
  smb        numeric(10,6) not null,
  hml        numeric(10,6) not null,
  rmw        numeric(10,6) not null,
  cma        numeric(10,6) not null,
  rf         numeric(10,6) not null
);

-- ============================================================================
-- Backtests
-- ============================================================================
create table backtests (
  id           uuid primary key default gen_random_uuid(),
  portfolio_id uuid references portfolios(id) on delete cascade,
  owner_id     uuid not null references profiles(id) on delete cascade,
  name         text,
  config       jsonb not null,
  result       jsonb,
  status       text not null default 'pending' check (status in ('pending','running','done','failed')),
  error        text,
  share_token  text unique,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);
create index backtests_owner_idx on backtests (owner_id);

-- ============================================================================
-- Row-Level Security
-- ============================================================================
alter table profiles            enable row level security;
alter table invite_codes        enable row level security;
alter table portfolios          enable row level security;
alter table target_allocations  enable row level security;
alter table rebalance_rules     enable row level security;
alter table transactions        enable row level security;
alter table holdings_cache      enable row level security;
alter table cash_balances       enable row level security;
alter table backtests           enable row level security;

alter table tickers             enable row level security;
alter table prices_daily        enable row level security;
alter table starter_portfolios  enable row level security;
alter table ff5_factors_daily   enable row level security;

-- Profiles: self read/update
create policy profiles_self_read   on profiles for select using (auth.uid() = id);
create policy profiles_self_update on profiles for update using (auth.uid() = id);

-- Invite codes: authenticated may read (to redeem); writes via service role only
create policy invite_codes_read on invite_codes for select to authenticated using (true);

-- Portfolios: owner-only
create policy portfolios_owner_all on portfolios for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Helper macro for "owns the parent portfolio" policies
create policy target_allocations_owner_all on target_allocations for all
  using (exists (select 1 from portfolios p where p.id = target_allocations.portfolio_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from portfolios p where p.id = target_allocations.portfolio_id and p.owner_id = auth.uid()));

create policy rebalance_rules_owner_all on rebalance_rules for all
  using (exists (select 1 from portfolios p where p.id = rebalance_rules.portfolio_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from portfolios p where p.id = rebalance_rules.portfolio_id and p.owner_id = auth.uid()));

create policy transactions_owner_all on transactions for all
  using (exists (select 1 from portfolios p where p.id = transactions.portfolio_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from portfolios p where p.id = transactions.portfolio_id and p.owner_id = auth.uid()));

create policy holdings_cache_owner_read on holdings_cache for select
  using (exists (select 1 from portfolios p where p.id = holdings_cache.portfolio_id and p.owner_id = auth.uid()));
-- holdings_cache writes only via triggers (security definer)

create policy cash_balances_owner_read on cash_balances for select
  using (exists (select 1 from portfolios p where p.id = cash_balances.portfolio_id and p.owner_id = auth.uid()));

-- Backtests: owner-only EXCEPT when share_token is set and matches (handled at app layer for /b/<token>)
create policy backtests_owner_all on backtests for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Reference data: authenticated reads
create policy tickers_read            on tickers            for select to authenticated using (true);
create policy prices_daily_read       on prices_daily       for select to authenticated using (true);
create policy starter_portfolios_read on starter_portfolios for select to authenticated using (true);
create policy ff5_factors_daily_read  on ff5_factors_daily  for select to authenticated using (true);
