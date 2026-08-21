# Flyeas / BudgetPilot

An autonomous flight-fare concierge. A user describes a trip in plain language; Flyeas
searches real flights, judges the budget against the route's own price history, then
watches prices 24/7 and — when a genuinely good fare appears — either proposes it or
auto-captures payment (a Stripe authorization hold or an on-chain USDC escrow release).

> **Status / honest scope**
> - The watch → propose → capture loop is live.
> - The auto-buy decision currently runs on a **statistical heuristic**
>   (`FLYEAS_ALGO_VERSION=v1`). The foundation-model ML ensemble runs in **shadow
>   mode** for evaluation and is **not yet decisional** — see [Algorithm versions](#algorithm-versions).
> - "Auto-buy" **captures payment and returns a partner booking deep-link** (Kiwi); it
>   does not issue the ticket itself.

## Stack
- **Next.js 14.2** (App Router) + React 18 — deployed on Vercel
- **Supabase** (Postgres) — missions, proposals, price history
- **Stripe** — manual-capture ("hold") payments
- **On-chain escrow** (viem / ethers) — optional USDC rail (`MissionEscrow`)
- **Resend** — email alerts
- **RapidAPI / Sky-Scrapper** (+ Kiwi, Google Flights, Amadeus fallbacks) — live fares
- **Anthropic Claude** — chat assistant
- **Python ML pipeline** (offline + Modal) — see [ML pipeline](#ml-pipeline)

## Architecture
Two largely independent layers:

1. **Live product** — `app/` (UI + API routes), `lib/agent/*` (watcher + predictor),
   `lib/payments/*` (Stripe + escrow), `lib/amadeus/*` (flight search with retries +
   multi-provider fallback). A GitHub Actions cron hits `/api/agent/sweep` every 15 min
   to monitor active missions.
2. **ML pipeline** — `scripts/ingest/*.ts` (data ingestion) → `scripts/train/*.py`
   (training). The current, leakage-free generation is `scripts/train/v7a/*` (LightGBM
   quantile + conformal calibration), served behind a Modal endpoint and consumed via
   `lib/agent/v7a/*`. The older `scripts/cloud/v76_ultra/*` lineage is archived — see
   `docs/audit/`.

## Environment
Copy `.env.example` to `.env.local` and fill in:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase (client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase (server-only — bypasses RLS) |
| `RAPIDAPI_KEY`, `RAPIDAPI_HOST` | Flight search |
| `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`, `AMADEUS_ENV` | Fallback provider |
| `SCRAPER_SECRET` | Auth for the scraper endpoint (`openssl rand -hex 32`) |
| `FLYEAS_ALGO_VERSION` | `v1` \| `v7` \| `shadow` (see below) |
| `ANTHROPIC_API_KEY` | Chat assistant |
| `RESEND_API_KEY`, `ALERT_FROM_EMAIL` | Email alerts |
| `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Payments |

The agent loop, ML serving, and escrow rails also require (not yet listed in
`.env.example`):
`CRON_SECRET` (auth for `/api/agent/sweep`, `/api/cron/monitor`, and
`/api/missions/[id]/propose`), `MODAL_V7A_URL` + `MODAL_V7A_SECRET` (ML endpoint),
`AGENT_PRIVATE_KEY` + `NEXT_PUBLIC_ESCROW_ADDRESS` (on-chain escrow), `NEXT_PUBLIC_APP_URL`.

## Install & run
```bash
pnpm install
pnpm dev
```

## Algorithm versions
`FLYEAS_ALGO_VERSION` selects the decision engine in `lib/agent/watcher.ts`:

- **`v1`** (default) — statistical heuristic (`lib/agent/predictor.ts`): z-score vs route
  baseline + percentile + trend + time-to-departure. **Makes the live buy/wait decision.**
- **`shadow`** — `v1` still decides; the V7a ML prediction is computed and logged
  (`agent_decisions`) for prospective evaluation only.
- **`v7` / `v7a`** — calls the Modal ML endpoint. By design the ML quantiles + conformal
  intervals are exposed for explainability; the action still comes from the composed
  baseline. The ML is **not** promoted to decision-maker until it beats the baselines
  in `reports/v7a_backtest_*.json`.

## ML pipeline
```bash
pnpm ingest:all     # ingest training data into Supabase
pnpm train:smoke    # quick split → features → qrf → validate
pnpm train:all      # full legacy pipeline (archived generation)
```
The current pipeline lives in `scripts/train/v7a/` (build_dataset → split → features →
build_target → lgbm_quantile → calibrate → backtest → policy). Honest, trajectory-level
backtests are written to `reports/v7a_backtest_*.json`.

## Deployment
- **Vercel** — the Next.js app.
- **GitHub Actions** — `.github/workflows/flyeas-watcher.yml` runs the 15-min monitoring
  sweep (needs `FLYEAS_BASE_URL` + `FLYEAS_CRON_SECRET` repo secrets).
- **Modal** — hosts the ML inference endpoint (`scripts/cloud/`).

## Security
Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `AGENT_PRIVATE_KEY`,
`CRON_SECRET`, …) must never be exposed to the client or committed. Internal endpoints
(`/api/agent/sweep`, `/api/cron/monitor`, `/api/missions/[id]/propose`,
`/api/scraper/run`) are gated by shared secrets. User-facing mission endpoints require
per-user authorization. See `docs/audit/` for the current security review and open items.
