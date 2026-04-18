# Flyeas V7 — Setup & Activation Guide

## Prerequisites

- Node 20.x
- pnpm
- Supabase project (URL + service role key in `.env.local`)
- RapidAPI key with 6 APIs subscribed
- GitHub repo for Actions cron

## Step 1 — Verify .env.local

```bash
# Required variables (all should be present):
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
RAPIDAPI_KEY=your_key
RAPIDAPI_HOST=sky-scrapper.p.rapidapi.com
SCRAPER_SECRET=your_64char_hex
FLYEAS_ALGO_VERSION=shadow    # v1 | v7 | shadow
```

## Step 2 — Apply Supabase migrations

Option A — Supabase CLI:
```bash
supabase db push
```

Option B — SQL Editor:
Copy-paste `supabase/migrations/20260417_v7_scraper_tables.sql` into the
Supabase SQL editor and run.

Tables created:
- `real_price_samples` — scraped flight prices
- `real_aggregated_fares` — historical fare data (BTS, Kaggle)
- `ingestion_runs` — data pipeline log
- `real_features` — pre-computed ML features
- `model_runs` — model registry
- `scraper_runs` — scraper execution log
- `drift_alerts` — distribution shift monitoring

## Step 3 — Test scraper locally

```bash
curl -X POST http://localhost:3000/api/scraper/run \
  -H "x-scraper-secret: $(grep SCRAPER_SECRET .env.local | cut -d= -f2)"
```

Expected: JSON with `routesAttempted`, `routesSucceeded`, `totalFlights`.

## Step 4 — Deploy scraper to production

```bash
pnpm build && vercel --prod
```

Test in production:
```bash
curl -X POST https://faregenie.vercel.app/api/scraper/run \
  -H "x-scraper-secret: YOUR_SECRET"
```

## Step 5 — Setup GitHub Actions cron

1. Go to your repo Settings → Secrets and variables → Actions
2. Add these secrets:
   - `SCRAPER_URL` = `https://faregenie.vercel.app`
   - `SCRAPER_SECRET` = same as .env.local
3. Push `.github/workflows/scraper.yml` to main
4. The scraper will run every 4 hours automatically

Verify: Actions tab → "Flight Price Scraper" → should show runs.

## Step 6 — Monitor scraper health

Check Supabase table `scraper_runs`:
```sql
SELECT * FROM scraper_runs ORDER BY started_at DESC LIMIT 10;
```

Check data accumulation:
```sql
SELECT source, COUNT(*), MIN(fetched_at), MAX(fetched_at)
FROM real_price_samples
GROUP BY source;
```

## Step 7 — Shadow mode (current)

With `FLYEAS_ALGO_VERSION=shadow`, both V1 and V7 run on every mission check.
V1's decision is shown to users. V7's decision is logged.

Check shadow logs in Vercel → Logs:
```
[v7-shadow] route=CDG-NRT v1=MONITOR v7=BUY_NOW agree=false
```

## Step 8 — Switch to V7 live

When you're confident in V7's decisions:

```bash
vercel env rm FLYEAS_ALGO_VERSION production
vercel env add FLYEAS_ALGO_VERSION production
# Enter value: v7
vercel --prod
```

## Step 9 — Rollback to V1

If anything goes wrong:

```bash
vercel env rm FLYEAS_ALGO_VERSION production
vercel --prod
```

Without the variable, V1 is the default.

## Step 10 — Data accumulation timeline

| Time | Data | V7 benefit |
|---|---|---|
| Day 1 | ~250 price samples (25 routes × 10 flights) | Kalman + HMM start learning |
| Week 1 | ~10,000 samples (42 scraper runs) | Baselines become reliable |
| Month 1 | ~40,000 samples | Bayesian stopping thresholds calibrate |
| Month 3 | ~120,000 samples | EVT tail estimates stabilize |

## V7 Models active

| Model | Purpose | Data needed |
|---|---|---|
| Kalman Filter | Fair price estimation | ≥ 3 samples |
| HMM 6-State | Regime detection | ≥ 5 samples |
| Bayesian Stopping | Buy/wait threshold | ≥ 5 samples |
| BOCPD | Change point detection | ≥ 5 samples |
| EVT / Pareto | Mistake fare detection | ≥ 10 samples |
| Survival Analysis | Time-to-better-price | ≥ 8 samples |
| Conformal Prediction | Calibrated intervals | ≥ 20 samples |
| Ensemble Stacking | Combined decision | All above running |

## File map

```
lib/agent/v7/
  types.ts          — shared types
  kalman.ts         — Kalman filter
  hmm-regime.ts     — HMM 6-state regime
  bayesian-stopping.ts — optimal stopping
  bocpd.ts          — change point detection
  evt.ts            — extreme value theory
  survival.ts       — survival analysis
  conformal.ts      — conformal prediction
  simulator.ts      — trajectory generator
  ensemble.ts       — stacking ensemble
  index.ts          — orchestrator (predictV7)

scripts/scraper/
  api-rotator.ts    — 6-API rotation + circuit breaker
  routes.ts         — 100 global routes
  core.ts           — scrape orchestrator

app/api/scraper/run/route.ts  — secured endpoint

.github/workflows/scraper.yml — 4h cron
```
