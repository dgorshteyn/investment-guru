# Investment Guru — v1 Spec

> Working spec for v1. This is the contract between us. If something here is wrong, edit it before code follows it.

## Product summary

A web app that lets retail investors:
1. Define one or more **portfolios**, each with a target asset allocation.
2. Record buys/sells/dividends/deposits as **transactions**; current holdings are derived from the transaction ledger.
3. Generate a **rebalance trade list** to close the gap between current and target (threshold or calendar trigger), and optionally mark trades as executed (creating transactions).
4. **Backtest** a strategy (target allocation + rebalance rule + contribution schedule) over historical data, with institutional-grade metrics including FF5 factor exposures.
5. Track **portfolio performance over time** (time-weighted return) using actual transaction history.
6. Clone from a **library of canonical starter portfolios** (3-fund, 4-fund Boglehead, Permanent Portfolio, All Weather, Golden Butterfly, etc.).

Positioning: Boglehead-friendly. Passive/allocation-first. Not a day-trading tool. Not a robo-advisor (we never touch money).

## Phased rollout

| Phase | Duration | Users | Public-facing? |
|---|---|---|---|
| **Phase 1 — Internal alpha** | 10-12 weeks | You + 2-3 trusted friends as co-testers | Hosted but allowlisted. Landing page + ToS + shareable URLs all built (architectural cleanliness), but signups closed. **No freemium gating** — everyone gets full features. |
| **Phase 2 — Public beta** | 4-6 weeks | Invite-code holders | Open invite-code redemption, freemium gates ON, Sentry + Resend wired up, sample backtests on landing, Reddit / friends share invites. |

**Phase 2 quality bar (the trigger for going public):**
- I've used it personally for ≥4 weeks
- I've rebalanced my real portfolio with it ≥2 times
- I've run ≥10 backtests on real strategies
- No high-priority bugs open
- 2-3 co-testers have used it for ≥2 weeks without major complaints

## Locked-in decisions

| Dimension | Decision |
|---|---|
| Audience | Public signup eventually (Phase 2), invite-only |
| Asset universe | US-listed ETFs + US individual stocks |
| Strategy primary | Portfolio allocation + rebalancing |
| Holdings input | Manual entry (treated as opening-balance transactions) + generic CSV with smart column-mapping UI |
| Data model | Transactions ledger is source of truth; `holdings_cache` + `cash_balances` derived via triggers |
| Strategy versioning | Full target-allocation history preserved; UI shows timeline |
| Dividend handling | Per-transaction `kind` (`dividend` for cash, `reinvest_dividend` for DRIP) — user picks at entry, no global toggle |
| Backtest depth | Equity curve, CAGR, max DD, Sharpe, Sortino, rolling metrics, vs benchmark, **named regimes**, **Fama-French 5 factor exposures** |
| Backtest defaults | 15 years back, $10k initial, $500/month contributions, vs SPY benchmark |
| Planning feature | Rebalance trade list with both threshold + calendar trigger options |
| Trade-list precision | Whole shares only (accept small residual drift) |
| Trade-list execution | "Mark as executed" creates transactions; full ledger from day one |
| Performance display | Time-weighted return chart since first transaction + per-holding unrealized P&L |
| Starter content | Library of 10-15 canonical portfolios, clone-to-create |
| Onboarding | First-run shows the starter library; "Build from scratch" is a secondary option |
| Drift visualization | Three views with toggle: (a) table with mini-bars, (b) side-by-side donut charts, (c) horizontal drift gauges with threshold band |
| Educational angle | Hover tooltips on every metric + dedicated `/learn` glossary page |
| Mobile | Responsive web, optimized for desktop, usable on phone |
| Pricing | Freemium (free=1 portfolio basic, paid=unlimited + pro features). Schema-ready in Phase 1, **enforced in Phase 2** |
| Domain | Defer; ship under `*.vercel.app` for Phase 1, custom domain for Phase 2 |
| Distribution | Phase 1: word of mouth to 2-3 friends. Phase 2: Reddit (r/Bogleheads, r/investing) + friends share invites |
| Timeline | Phase 1: 10-12 weeks. Phase 2: 4-6 weeks. Total ~4-5 months |
| Budget | Under $20/mo |
| Backtest UX | Synchronous (spinner) + saved + named + comparison + **public shareable URLs** |
| Auth (Phase 1) | Supabase Auth + email allowlist (you + 2-3 friends) |
| Hosting (Phase 1) | Full deploy on Vercel + Supabase + Fly.io from day 1 |

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│  Next.js 16 (App Router) on Vercel Hobby                       │
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
│  - Cron (price refresh)        │  │    /rebalance, /factors,     │
└────────────────────────────────┘  │    /twr                      │
                                    │  - Scale-to-zero machine     │
                                    └──────────────────────────────┘
                                              │
                                              │ HTTPS
                                              ▼
                                    Tiingo (free) + Kenneth French
```

## Data model (Postgres)

The schema is **transactions-first**: the ledger is the source of truth, and the "current holdings" table is a denormalized cache that's recomputed when transactions change. This unlocks: TWR calc, per-lot cost basis, accurate P&L, future tax-aware features.

```sql
-- Managed by Supabase Auth: auth.users(id, email, ...)

create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  tier         text not null default 'free' check (tier in ('free','paid')),
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
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
  cloned_from text,   -- 'three_fund' | 'permanent' | null (custom)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Target allocation (versioned: changes are appended, not overwritten)
create table target_allocations (
  id          uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references portfolios(id) on delete cascade,
  weights     jsonb not null,         -- {"VTI": 0.60, "BND": 0.30, "GLD": 0.10}
  effective_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index target_allocations_portfolio_idx on target_allocations (portfolio_id, effective_at desc);

create table rebalance_rules (
  portfolio_id   uuid primary key references portfolios(id) on delete cascade,
  trigger_type   text not null check (trigger_type in ('threshold','calendar','both')),
  drift_pct      numeric(5,2),
  calendar       text check (calendar in ('monthly','quarterly','semiannual','annual')),
  use_cash_flow  boolean not null default true,
  updated_at     timestamptz not null default now()
);

-- SOURCE OF TRUTH: every event that changes the portfolio
create table transactions (
  id            uuid primary key default gen_random_uuid(),
  portfolio_id  uuid not null references portfolios(id) on delete cascade,
  kind          text not null check (kind in (
                  'opening_balance',   -- initial "I already own X" entry
                  'buy', 'sell',
                  'dividend',          -- cash dividend
                  'reinvest_dividend', -- DRIP
                  'deposit', 'withdraw', -- cash in/out
                  'split'              -- N-for-1 split, ticker constant
                )),
  ticker        text,                  -- null for deposit/withdraw
  shares        numeric(20,8),         -- positive for buy/dividend-reinvest/opening, negative for sell
  price         numeric(20,4),         -- per-share at trade date; null for splits/deposits
  amount        numeric(20,4),         -- $ for deposit/withdraw/cash dividend
  fees          numeric(20,4) not null default 0,
  trade_date    date not null,
  notes         text,
  source        text check (source in ('manual','csv','rebalance_action')),
  created_at    timestamptz not null default now()
);
create index transactions_portfolio_date_idx on transactions (portfolio_id, trade_date);

-- DERIVED CACHE: aggregated current state per (portfolio, ticker)
-- Recomputed from transactions whenever transactions change.
create table holdings_cache (
  portfolio_id     uuid not null references portfolios(id) on delete cascade,
  ticker           text not null,
  shares           numeric(20,8) not null,
  cost_basis_total numeric(20,4) not null,
  primary key (portfolio_id, ticker)
);

-- Cash balance per portfolio (also derived from transactions)
create table cash_balances (
  portfolio_id uuid primary key references portfolios(id) on delete cascade,
  balance      numeric(20,4) not null default 0
);

-- Reference data: shared, not user-owned
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

-- Starter portfolio templates (admin-curated, shared)
create table starter_portfolios (
  slug         text primary key,    -- 'three_fund', 'all_weather', etc.
  name         text not null,
  description  text not null,
  attribution  text,                 -- 'Popularized by John Bogle', etc.
  weights      jsonb not null,
  default_rebalance jsonb not null,  -- rebalance_rule shape
  created_at   timestamptz not null default now()
);

create table backtests (
  id              uuid primary key default gen_random_uuid(),
  portfolio_id    uuid references portfolios(id) on delete cascade,
  owner_id        uuid not null references profiles(id) on delete cascade,
  name            text,                          -- user-named, optional
  config          jsonb not null,
  result          jsonb,
  status          text not null default 'pending' check (status in ('pending','running','done','failed')),
  error           text,
  share_token     text unique,                   -- if set, accessible via /b/<token> publicly
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);
create index backtests_owner_idx on backtests (owner_id);

create table ff5_factors_daily (
  trade_date date primary key,
  mkt_rf     numeric(10,6) not null,
  smb        numeric(10,6) not null,
  hml        numeric(10,6) not null,
  rmw        numeric(10,6) not null,
  cma        numeric(10,6) not null,
  rf         numeric(10,6) not null
);
```

**RLS policies**: every user-scoped table requires `owner_id = auth.uid()` (directly or via `portfolio_id` join). Reference data (`tickers`, `prices_daily`, `ff5_factors_daily`, `starter_portfolios`) is readable by any authenticated user. Public backtest sharing uses a separate policy keyed on `share_token`.

**Holdings cache invalidation**: on insert/update/delete to `transactions`, a trigger recomputes the affected `(portfolio_id, ticker)` rows. This keeps reads fast without making transactions the only place truth lives.

## Pages / screens

| Path | Auth? | Phase | Purpose |
|---|---|---|---|
| `/` | public | both | Landing page. Phase 1: minimal "private beta" copy. Phase 2: hero + sample backtest + invite-code CTA. |
| `/login` | public | both | Email magic link. |
| `/redeem` | public | Phase 2 | Enter invite code. |
| `/b/[token]` | public | both | Public shareable backtest view (read-only). |
| `/app` | yes | both | Portfolio list + "+ New from template" CTA. |
| `/app/new` | yes | both | Starter portfolio library (clone from canonical) + "Build from scratch". |
| `/app/portfolio/[id]` | yes | both | Portfolio detail. Tabs: **Overview**, **Holdings**, **Transactions**, **Strategy**, **Backtest**. |
| `/app/portfolio/[id]/rebalance` | yes | both | Trade-list view + "Mark as executed" → creates transactions. |
| `/app/portfolio/[id]/backtest/[runId]` | yes | both | Backtest result: equity curve, metrics, regime slices, factor exposures, "share publicly" toggle. |
| `/app/performance` | yes | both | Cross-portfolio TWR chart since first transaction, vs benchmark. |
| `/app/settings` | yes | both | Profile, tier display, danger zone. |
| `/admin/invites` | admin only | Phase 2 | Mint invite codes. |

## Backtest engine spec

(See "Backtest engine spec" section from previous spec version — unchanged.)

**Key addition**: backtest result includes a `share_token` field. Setting it via the UI generates an unguessable URL (`/b/<token>`) that exposes a read-only view of the result. No user data is exposed — just the strategy config and metrics.

## Sprint breakdown

### Phase 1 — Internal alpha (10-12 weeks)

**Sprint 0 — Scaffold + spec ✅ (done)**
- Repo scaffold (Next.js + Python worker + supabase migrations)
- Initial schema (will be replaced by transactions-first schema in Sprint 1)
- This spec

**Sprint 1 — Auth + foundational schema + portfolio CRUD (2 weeks)**
- Refactor migration to transactions-first schema
- Supabase project setup + email allowlist auth
- shadcn/ui setup, layout shell, navigation
- Portfolio create/list/edit/delete (no holdings yet)
- `holdings_cache` recompute trigger + cash balance trigger

**Sprint 2 — Holdings + transactions + price refresh (2 weeks)**
- Manual transaction entry form ("opening balance" + "buy" + "sell" + "deposit" + "dividend")
- Transactions tab on portfolio detail
- Holdings tab (reads from `holdings_cache`)
- Ticker seed table + autocomplete (US ETFs + stocks from CSV)
- Daily price refresh (Supabase cron → Tiingo) for held tickers only
- Generic CSV import for transactions

**Sprint 3 — Starter portfolio library + allocations (2 weeks)**
- Seed `starter_portfolios` with 10-15 canonical strategies
- `/app/new` library UI with descriptions + sample allocation charts
- Clone-to-create flow (creates portfolio + initial target allocation + default rebalance rule)
- Versioned target allocation editor
- Current-vs-target drift visualization (bars + table)

**Sprint 4 — Rebalance trade list (1.5 weeks)**
- Python worker `/rebalance` endpoint
- Threshold and calendar trigger UI
- Cash-flow-first algorithm
- "Mark as executed" → creates buy/sell transactions in batch
- Persistent rebalance-action audit trail

**Sprint 5 — Backtest engine: basic tier (2 weeks)**
- `/backtest` endpoint: equity curve, CAGR, vol, Sharpe, Sortino, max DD, vs benchmark
- Recurring contributions modeled
- Saved + named backtests
- Comparison view (two backtests side-by-side)
- Backtest detail page

**Sprint 6 — Backtest: regimes + factors (1.5 weeks)**
- FF5 factor data loader + monthly cron refresh
- `/factors` endpoint (regression)
- Named regime slicing (Dot-com, GFC, COVID, 2022 inflation)
- Regime cards + factor exposure bar chart UI with t-stat annotations
- Public shareable backtest URLs (share_token + `/b/<token>` view)

**Sprint 7 — Portfolio performance (TWR) tracking (1.5 weeks)**
- Python worker `/twr` endpoint (modified Dietz or daily-valuation TWR)
- `/app/performance` page: cross-portfolio TWR chart vs benchmark
- Per-holding unrealized P&L on Holdings tab

**End of Phase 1: hit the quality bar. Start using it for real.**

### Phase 2 — Public beta prep (4-6 weeks)

**Sprint 8 — Freemium gates + invite flow (1.5 weeks)**
- Tier enforcement at the data + UI layer (free = 1 portfolio, basic backtest only)
- Invite-code minting (admin page) + redemption flow
- Stripe integration for paid tier (free first, paid optional)

**Sprint 9 — Marketing site + legal (1.5 weeks)**
- Landing page rebuild: hero, three-bullet pitch, sample backtest screenshots, FAQ
- ToS + Privacy Policy (generated, light review)
- Custom domain
- "Not financial advice" disclaimers throughout

**Sprint 10 — Production hardening (1 week)**
- Sentry error tracking
- Resend for transactional email
- Analytics (PostHog free tier)
- Rate limiting on backtest endpoint
- Cold-start mitigation for Fly.io worker

**Sprint 11 — Launch (1-2 weeks)**
- Beta invite first 5 friends
- Bug fixes
- Post to r/Bogleheads with invite codes
- Monitor + iterate

## Third-party services + costs

| Service | Purpose | Phase 1 | Phase 2 |
|---|---|---|---|
| Vercel Hobby | Next.js hosting | $0 | $0 |
| Supabase Free | Postgres, Auth, Storage, Cron | $0 | $0 |
| Fly.io | Python worker (scale-to-zero) | ~$0-3/mo | ~$0-5/mo |
| Tiingo Free | EOD market data | $0 | $0 |
| Kenneth French | FF5 factor returns | $0 | $0 |
| Sentry Dev | Error tracking | — | $0 |
| Resend | Transactional email | — | $0 |
| PostHog | Analytics | — | $0 |
| Domain | Friendly URL | — | $12/yr |
| Stripe | Billing | — | 2.9% + 30¢ per txn |
| **Total** | | **$0-3/mo** | **$0-5/mo + tiny domain** |

## Open questions (decide just-in-time during their sprint)

1. Currency: USD-only in v1. **Confirmed.**
2. Account deletion semantics (hard vs soft delete). — Phase 2.
3. Backtest result retention (keep forever? prune after 90d for free?). — Phase 2.
4. Backtest comparison count (2 side-by-side vs N up to limit). — Sprint 5.
5. Ticker autocomplete: symbol-only vs symbol+company name. — Sprint 2.
6. Analytics provider: PostHog vs Vercel Analytics. — Phase 2.
7. Multi-portfolio rebalance (treat all your portfolios as one). — v2.
8. Backtest handling when ticker has insufficient history. — Sprint 5.
9. Empty-state UI for portfolio with no transactions. — Sprint 2.
10. Hosting region. — Default US-East-1 unless objected.

## What we explicitly punted

- Broker API integration (SnapTrade/Plaid) — v1.5+
- Tax-aware rebalancing (account hierarchy, STCG avoidance, wash-sale) — v2
- Rules-based trading signals — v2
- Multi-account hierarchy (Roth/Taxable/401k modeling) — v2
- International equities, crypto, options, mutual funds — v2+
- Native mobile apps — never (responsive web is the contract)
- Real-money execution — never (we're not a broker-dealer)
- Intraday data / real-time prices — v2+ (EOD only for v1)
