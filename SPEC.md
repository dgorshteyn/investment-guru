# Investment Guru — v1 Spec

> Working spec for v1. This is the contract between us. If something here is wrong, edit it before code follows it.

## Product summary

A web app that lets retail investors:
1. Define one or more **portfolios**, each with a target asset allocation.
2. Track current holdings (manually entered or imported via CSV) against those targets.
3. Generate a **rebalance trade list** to close the gap between current and target (threshold-based or calendar-based).
4. **Backtest** a strategy (target allocation + rebalance rule + contribution schedule) over historical data, with institutional-grade metrics.

Positioning: Boglehead-friendly. Passive/allocation-first. Not a day-trading tool. Not a robo-advisor (we never touch your money).

**Not in v1**: broker API integration, tax-lot tracking, options/crypto/international, mobile native, social features.

## Locked-in decisions

| Dimension | Decision |
|---|---|
| Audience | Public signup, **invite-only** for v1, "not financial advice" disclaimers throughout |
| Asset universe | US-listed ETFs + US individual stocks |
| Strategy primary | Portfolio allocation + rebalancing |
| Holdings input | Manual table editor + generic CSV import |
| Data model | User → many Portfolios → many Holdings + one TargetAllocation + one RebalanceRule |
| Backtest depth | Equity curve, CAGR, max DD, Sharpe, Sortino, rolling metrics, vs benchmark, **named regimes**, **factor exposures (Fama-French 5)** |
| Planning feature | Rebalance trade list (user picks threshold or calendar trigger) |
| Pricing | Freemium (free tier + paid tier, schema-ready, but billing implementation deferred to end of v1) |
| Domain | Defer; ship under `*.vercel.app` |
| Distribution | Invite codes shared with friends + r/Bogleheads |
| Timeline | 2-3 months, evenings/weekends, polished |
| Budget | Under $20/mo |

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│  Next.js 15 (App Router) on Vercel Hobby                       │
│  - TS, Tailwind, shadcn/ui, Recharts                           │
│  - Server Components for reads, Server Actions for writes      │
│  - Supabase JS client (auth + RLS-protected queries)           │
└────────────────────────────────────────────────────────────────┘
            │                              │
            │ Postgres + Auth              │ HTTPS (signed JWT)
            ▼                              ▼
┌────────────────────────────────┐  ┌──────────────────────────────┐
│  Supabase (free tier)          │  │  Python worker on Fly.io     │
│  - Postgres (RLS per user)     │  │  - FastAPI                   │
│  - Auth (email magic link)     │  │  - pandas, numpy, statsmodels│
│  - Storage (CSV uploads)       │  │  - Endpoints: /backtest,     │
│  - Cron (price refresh)        │  │    /rebalance, /factors      │
└────────────────────────────────┘  │  - Scale-to-zero machine     │
                                    └──────────────────────────────┘
                                              │
                                              │ HTTPS
                                              ▼
                                    ┌──────────────────────────────┐
                                    │  Tiingo (free tier)          │
                                    │  - EOD OHLCV                 │
                                    │  - 500 req/hr, ~30 yr history│
                                    └──────────────────────────────┘
                                              │
                                              ▼
                                    ┌──────────────────────────────┐
                                    │  Kenneth French Data Library │
                                    │  - Fama-French 5 factor      │
                                    │    daily/monthly returns     │
                                    │  - Free, refresh monthly     │
                                    └──────────────────────────────┘
```

**Why this shape:**
- Next.js handles UI + simple CRUD via Server Actions. No separate REST API to maintain.
- Python worker handles the math-heavy stuff (backtest engine, factor regression, rebalance solver). Pandas/numpy/statsmodels make this trivial; doing it in JS would be 10x the code.
- Supabase is the cheapest credible auth + Postgres + storage in one. RLS gives per-user isolation for free.
- Tiingo is the only free EOD data source with a real ToS that permits hosted multi-user apps (yfinance scrapes Yahoo and violates ToS; Alpha Vantage rate limits are too tight).

## Data model (Postgres)

```sql
-- Managed by Supabase Auth
-- auth.users (id, email, ...)

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  tier        text not null default 'free' check (tier in ('free','paid')),
  created_at  timestamptz not null default now()
);

create table invite_codes (
  code        text primary key,
  created_by  uuid references profiles(id),
  redeemed_by uuid references profiles(id),
  redeemed_at timestamptz,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

create table portfolios (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table holdings (
  id          uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references portfolios(id) on delete cascade,
  ticker      text not null,
  shares      numeric(20,8) not null check (shares >= 0),
  cost_basis  numeric(20,4),   -- total $, optional
  acquired_at date,
  notes       text,
  created_at  timestamptz not null default now()
);
create index on holdings (portfolio_id);

create table target_allocations (
  portfolio_id uuid primary key references portfolios(id) on delete cascade,
  -- {"VTI": 0.60, "BND": 0.30, "GLD": 0.10}; weights must sum to 1.0
  weights     jsonb not null,
  updated_at  timestamptz not null default now()
);

create table rebalance_rules (
  portfolio_id uuid primary key references portfolios(id) on delete cascade,
  -- 'threshold' | 'calendar' | 'both'
  trigger_type text not null check (trigger_type in ('threshold','calendar','both')),
  drift_pct    numeric(5,2),  -- e.g. 5.00 means rebalance if any position drifts > 5%
  calendar     text,          -- 'monthly' | 'quarterly' | 'semiannual' | 'annual'
  use_cash_flow boolean not null default true,  -- prefer contributions over selling
  updated_at  timestamptz not null default now()
);

create table tickers (
  symbol      text primary key,
  name        text,
  asset_class text,  -- 'equity' | 'etf' | 'bond_etf' | 'commodity_etf' | ...
  exchange    text,
  active      boolean not null default true,
  last_synced_at timestamptz
);

create table prices_daily (
  ticker      text not null references tickers(symbol),
  trade_date  date not null,
  open        numeric(20,4),
  high        numeric(20,4),
  low         numeric(20,4),
  close       numeric(20,4) not null,
  adj_close   numeric(20,4) not null,
  volume      bigint,
  primary key (ticker, trade_date)
);
create index on prices_daily (trade_date);

create table backtests (
  id          uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references portfolios(id) on delete cascade,
  config      jsonb not null,  -- snapshot of allocation + rule + dates + contributions
  result      jsonb,            -- equity curve, metrics, regime slices, factor betas
  status      text not null default 'pending' check (status in ('pending','running','done','failed')),
  error       text,
  created_at  timestamptz not null default now(),
  completed_at timestamptz
);

create table ff5_factors_daily (
  trade_date  date primary key,
  mkt_rf      numeric(10,6) not null,
  smb         numeric(10,6) not null,
  hml         numeric(10,6) not null,
  rmw         numeric(10,6) not null,
  cma         numeric(10,6) not null,
  rf          numeric(10,6) not null
);

-- RLS: every user-scoped table has a policy "owner_id = auth.uid()" (or via portfolio_id join)
```

## Pages / screens

| Path | Auth? | Purpose |
|---|---|---|
| `/` | public | Landing page. Hero, three-bullet pitch, sample backtest screenshot, "Request an invite" form. |
| `/login` | public | Email magic link sign-in. |
| `/redeem` | public | Enter invite code → if valid, redirects to signup. |
| `/app` | yes | Authenticated home. List of portfolios, "+ New portfolio" CTA. |
| `/app/portfolio/[id]` | yes | Portfolio detail. Three tabs: **Holdings**, **Strategy**, **Backtest**. |
| `/app/portfolio/[id]/rebalance` | yes | Trade-list view. "If you do these trades, you'll be at target." |
| `/app/portfolio/[id]/backtest/[runId]` | yes | Backtest result view: equity curve, metrics table, regime slices, factor exposures. |
| `/app/settings` | yes | Profile, tier display, danger zone (delete account). |
| `/admin/invites` | admin only | Mint invite codes (just for you, gated by hardcoded user IDs). |

## Backtest engine spec

**Input** (snapshot in `backtests.config`):
```json
{
  "tickers": ["VTI","VXUS","BND"],
  "weights": {"VTI":0.50,"VXUS":0.30,"BND":0.20},
  "start_date": "2010-01-01",
  "end_date": "2024-12-31",
  "initial_capital": 10000,
  "contributions": {"amount": 500, "frequency": "monthly"},
  "rebalance": {"type":"threshold","drift_pct":5.0},
  "benchmark": "SPY"
}
```

**Output** (in `backtests.result`):
```json
{
  "equity_curve": [{"date":"...","portfolio":12345.67,"benchmark":11890.20}, ...],
  "metrics": {
    "cagr": 0.087, "vol": 0.142, "sharpe": 0.51, "sortino": 0.78,
    "max_drawdown": -0.231, "max_drawdown_date": "2020-03-23",
    "total_return": 1.34, "final_value": 23400.00, "total_contributions": 13000.00
  },
  "rolling": {"sharpe_1y": [...], "drawdown": [...]},
  "regimes": {
    "gfc_2008":    {"return": -0.21, "max_dd": -0.34, "vol": 0.32},
    "covid_2020":  {"return": 0.18, "max_dd": -0.19, "vol": 0.41},
    "inflation_2022": {"return": -0.08, "max_dd": -0.18, "vol": 0.22}
  },
  "factors": {
    "alpha": 0.012, "alpha_t": 1.87,
    "mkt_rf": {"beta": 0.84, "t": 12.3},
    "smb":    {"beta": 0.05, "t": 0.6},
    "hml":    {"beta": 0.21, "t": 2.4},
    "rmw":    {"beta": -0.03, "t": -0.3},
    "cma":    {"beta": 0.11, "t": 1.1},
    "r_squared": 0.91
  }
}
```

**Rebalance algorithm** (within backtest loop):
- **Threshold trigger**: on each market day, compute current weights; if any `|current_weight - target_weight| > drift_pct/100`, rebalance.
- **Calendar trigger**: on first market day of period (M/Q/SA/A), rebalance.
- **Both**: rebalance if either condition fires.
- **Cash-flow rebalance** (when `use_cash_flow=true`): on contribution days, allocate new cash to underweight positions first.
- **Execution model**: trades execute at next day's close, no slippage modeling in v1, no transaction costs in v1 (call this out in the UI).

## Sprint breakdown (8-12 weeks, evenings/weekends)

**Sprint 0 (now): scaffold + spec**
- Repo scaffold (Next.js + Python worker + shared types)
- This spec doc
- Sign up for: Supabase, Vercel, Fly.io, Tiingo, GitHub OAuth, domain registrar (later)

**Sprint 1 (week 1-2): auth + portfolio CRUD**
- Supabase project + schema migration
- Email magic link auth
- Invite code flow
- "/app" home, portfolio create/list/edit/delete
- Holdings table editor (no CSV yet)

**Sprint 2 (week 3-4): allocation + current state view**
- Target allocation editor (weights must sum to 100%)
- Ticker autocomplete (seed `tickers` table from a CSV of US ETFs+stocks)
- "Current vs target" view with drift bars
- Daily price refresh (Supabase cron → Tiingo)
- Generic CSV import for holdings

**Sprint 3 (week 5-6): rebalance trade list**
- Python worker scaffolded on Fly.io
- `/rebalance` endpoint: takes current holdings + target + cash, returns trade list
- Both threshold and calendar trigger UI (just sets the rule on the portfolio for now)
- Trade list view: "Buy 12 VTI, sell 4 BND" with $ amounts

**Sprint 4 (week 7-8): backtest engine — basic tier**
- `/backtest` endpoint
- Equity curve, CAGR, vol, Sharpe, Sortino, max DD, vs benchmark
- Recurring contributions
- Backtest detail page with chart + metrics table

**Sprint 5 (week 9-10): backtest — regimes + factors**
- Load FF5 factor data, monthly refresh
- Factor regression endpoint
- Named regime slicing (GFC, COVID, 2022, dot-com)
- UI: regime cards + factor exposure bar chart with t-stat annotations

**Sprint 6 (week 11-12): polish + launch prep**
- Landing page with sample backtest screenshot
- "Not financial advice" disclaimers (footer, backtest page, trade list page)
- ToS + Privacy Policy (generator output, lawyer review optional)
- Error tracking (Sentry free tier)
- Email deliverability test (Resend free tier or Supabase default)
- Invite minting admin page
- Beta invite first 5 friends, fix bugs, then post to r/Bogleheads

**Deferred to v1.5+**: billing (Stripe), broker API (SnapTrade), tax-aware rebalancing, account hierarchy, custom benchmarks, mobile-optimized layouts.

## Third-party services + costs

| Service | Purpose | Cost v1 |
|---|---|---|
| Vercel Hobby | Next.js hosting, edge CDN | $0 |
| Supabase Free | Postgres, Auth, Storage, Cron | $0 (500MB DB, 50k MAU) |
| Fly.io | Python backtest worker (scale-to-zero) | ~$0-3/mo |
| Tiingo Free | EOD market data | $0 (500 req/hr) |
| Kenneth French Data | FF5 factor returns | $0 |
| Sentry Developer | Error tracking | $0 (5k events/mo) |
| Resend (or Supabase email) | Transactional email | $0 (3k emails/mo) |
| Domain | Friendly URL | $12/yr (later) |
| **Total (v1)** | | **$0-3/mo** |

Headroom: $17/mo unused. Goes to Polygon ($29) only if Tiingo rate limits become painful; goes to Supabase Pro ($25) only if free tier DB fills.

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Tiingo rate limits choke price refresh as users grow | Cache aggressively; refresh once/day per ticker; upgrade to Polygon if needed |
| Free tier DB fills (`prices_daily` grows fast) | Only store prices for tickers actually held; prune unused tickers nightly |
| User uploads junk CSV, breaks parser | Strict schema validation, show preview before commit |
| "Not financial advice" still attracts a lawyer letter | Disclaimers, no "buy"/"sell" copy outside trade list (use "suggested trades"), ToS prohibits redistribution |
| Factor regression overfits / misleads | Show R², t-stats, sample size; warn when n < 60 months |
| Fly.io machine cold-start makes backtests feel slow | First backtest queued, show progress UI; subsequent ones fast |
| You burn out at sprint 4 | Sprints 1-3 alone are a usable product. Ship if needed and skip 5. |

## Open questions

These are NOT blockers for sprint 0 but need answers before the relevant sprint:

1. **What does the freemium split look like?** (Sprint 6) — e.g., free = 1 portfolio + basic backtest; paid = unlimited + factors + CSV + regimes.
2. **Mobile**: responsive web is the default. Confirm we're not building a native app.
3. **Account deletion**: GDPR-correct delete (full data wipe) vs soft delete?
4. **Backtest result retention**: keep forever? prune after 30 days? cost vs convenience.
5. **Currency**: USD-only in v1 (since US-only assets). Confirm.
6. **Time-zone for "today"**: market close = US/Eastern. UI shows local time.
7. **Email provider**: Supabase default email is fine for v1 invite-only. Switch to Resend before public launch (better deliverability).
8. **Analytics**: PostHog free tier or Vercel Analytics? Adds 1-2 days of instrumentation.

## What we explicitly punted

- Broker API integration (SnapTrade) — Sprint v1.5
- Stripe billing — Sprint v1.5 (schema is ready via `profiles.tier`)
- Tax-lot tracking, wash-sale logic — v2
- Rules-based trading signals — v2
- DCA-only "projection calculator" — v2 (subsumed by backtest with contributions)
- Multi-account hierarchy (Roth/Taxable/401k modeling) — v2
- International equities, crypto, options — v2+
- Native mobile apps — never (responsive web is the contract)
- Real-money execution — never (we're not a broker-dealer)
