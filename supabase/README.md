# Supabase setup

This directory holds the schema migrations for Investment Guru's Postgres database.

## First-time setup

1. Create a project at https://supabase.com (free tier).
2. Install the Supabase CLI: `npm i -g supabase` or `brew install supabase/tap/supabase`.
3. Link this directory to your project:
   ```
   supabase link --project-ref <your-project-ref>
   ```
4. Apply migrations:
   ```
   supabase db push
   ```

## Local development

```
supabase start          # boots local Postgres + Studio in Docker
supabase db reset       # applies all migrations from scratch
```

## Adding a new migration

```
supabase migration new <name>
```

That creates `migrations/<timestamp>_<name>.sql`. Edit it, then `supabase db push`.

## Environment variables you'll need in the web app

After creating the project, grab from Supabase dashboard → Settings → API:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only — for admin tasks like minting invite codes, refreshing prices)

Add these to `web/.env.local`.
