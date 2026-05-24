# Investment Guru

A planning tool for passive investors: define target allocations, generate
rebalance trade lists, and backtest strategies with institutional-grade metrics
(equity curve, drawdown, Sharpe/Sortino, named historical regimes, Fama-French
factor exposures).

**Status:** v1 in active development. See [`SPEC.md`](./SPEC.md) for the full
product spec.

> Investment Guru is for educational and informational purposes only. Nothing
> here is financial advice. Backtested results are hypothetical and do not
> reflect actual trading.

## Repo layout

```
.
├── SPEC.md            # Product spec — read this first
├── web/               # Next.js 16 (App Router) frontend + thin API
├── worker/            # Python FastAPI worker (backtest, rebalance, factors)
└── supabase/          # Postgres migrations + setup notes
```

## Architecture (short version)

- **Next.js + TypeScript** on Vercel (free Hobby tier) for the UI and CRUD.
- **Supabase** for Postgres + Auth + Storage (free tier).
- **Python (FastAPI + pandas + statsmodels)** on Fly.io, scale-to-zero, for the
  math-heavy endpoints.
- **Tiingo** free tier for end-of-day market data; **Kenneth French** library
  for FF5 factor returns.

Estimated v1 hosting cost: ~$0-3/mo.

## Quick start (local dev)

You need: Node 22+, Python 3.11+, the [Supabase CLI](https://supabase.com/docs/guides/cli),
and Docker (for local Supabase).

```bash
# 1. Frontend
cd web
npm install
cp .env.example .env.local   # fill in after step 3
npm run dev                  # http://localhost:3000

# 2. Worker
cd ../worker
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8080

# 3. Database
cd ../supabase
supabase start               # boots local Postgres in Docker
supabase db reset            # applies migrations/0001_init.sql
# Copy the printed anon key + URL into web/.env.local
```

## Deployment (Sprint 6)

- **Web:** `vercel --prod` from the `web/` directory.
- **Worker:** `fly deploy` from the `worker/` directory.
- **Database:** `supabase db push` after `supabase link --project-ref <ref>`.

See each subdirectory's README for details.

## Roadmap

See [`SPEC.md`](./SPEC.md) — "Sprint breakdown" section.
