# V7a Shadow Decision Logging Schema

> **Sprint:** `b1/v7a-shadow-logging-schema`
> **Date:** 2026-05-11
> **Status:** Schema / contract / documentation only. No migration applied.

## 1. Purpose

Define the Supabase table schema, JSON contract, and security model for logging V7a shadow/advisory policy decisions. This enables future analysis comparing recommended actions against observed price outcomes.

## 2. Why Shadow Logging Comes Next

The V7a pipeline is now:
- Balanced V2 policy applied and regression-validated.
- Backtest taxonomy aligned with ALERT / MONITOR / WAIT / BUY_NOW / ABSTAIN.
- AUTO_BUY hard-locked off.

The next step before any production integration is to log shadow decisions so we can validate the policy on live data without executing purchases. This sprint prepares the schema; runtime wiring happens in a separate sprint.

## 3. Table Design

**Table:** `public.v7a_shadow_decision_logs`

**Migration:** `supabase/migrations/20260511000001_v7a_shadow_decision_logs.sql`

Key design decisions:
- UUID primary key with `gen_random_uuid()`.
- `created_at` with descending index for time-series queries.
- Nullable `mission_id` and `user_id` for optional joins to existing tables.
- `environment` constrained to `local`, `staging`, `production`, `test`.
- `action` constrained to the 5 current actions — `AUTO_BUY` excluded.
- JSONB columns for `thresholds`, `decision_reasons`, `feature_snapshot`, `artifact_versions`.
- GIN index on `thresholds` for flexible JSON queries.
- RLS enabled, no broad policies (server-side service role only).

## 4. Logged Decision Fields

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | uuid | yes (auto) | Primary key |
| `created_at` | timestamptz | yes (auto) | Log timestamp |
| `environment` | text | yes | local/staging/production/test |
| `shadow_run_id` | text | no | Batch/run identifier |
| `trace_id` | text | no | Request trace ID |
| `mission_id` | uuid | no | FK to missions if applicable |
| `user_id` | uuid | no | User identifier |
| `route` | text | yes | e.g. JFK-LAX |
| `origin` | text | no | Origin airport |
| `destination` | text | no | Destination airport |
| `depart_date` | date | no | Flight departure date |
| `fetched_at` | timestamptz | no | Price observation time |
| `ttd_days` | numeric | no | Days to departure |
| `price_usd` | numeric | no | Observed price (>= 0) |
| `q10_gain` .. `q90_gain` | numeric | no | Model quantile outputs |
| `c_alpha_gain` | numeric | no | Conformal half-width |
| `width_over_price` | numeric | no | 2*c_alpha/price (>= 0) |
| `drop_proba` | numeric | no | Calibrated drop probability [0,1] |
| `q10_train_route` | numeric | no | Route Q10 train anchor |
| `route_known` | boolean | no | Route in training set |
| `route_popularity` | integer | no | Route observation count |
| `action` | text | yes | ABSTAIN/BUY_NOW/ALERT/MONITOR/WAIT |
| `confidence` | numeric | no | Bounded scalar [0,1] |
| `score_alert` | numeric | no | = drop_proba |
| `score_buy` | numeric | no | Raw buy trigger (USD) |
| `score_autobuy` | numeric | yes | Always 0 |
| `can_autobuy` | boolean | yes | Always false |
| `autobuy_enabled_input` | boolean | yes | Input audit field (no effect) |
| `policy_version` | text | yes | e.g. v7a-balanced-v2 |
| `policy_source` | text | yes | Source file path |
| `model_version` | text | no | Model artifact version |
| `thresholds` | jsonb | yes | Policy constants snapshot |
| `decision_reasons` | jsonb | yes | Reason strings from classify() |
| `feature_snapshot` | jsonb | yes | Optional feature dump |
| `artifact_versions` | jsonb | yes | Model/conformal versions |
| `decision_latency_ms` | integer | no | Processing time (>= 0) |
| `error_code` | text | no | Error code if decision failed |
| `error_message` | text | no | Error message if applicable |

## 5. AUTO_BUY Safety Constraints

- `action` CHECK excludes `AUTO_BUY` entirely — it cannot be inserted.
- `can_autobuy` defaults to `false` and should always be `false` in Phase 1.
- `score_autobuy` defaults to `0`.
- `autobuy_enabled_input` is stored for audit transparency but has no execution effect.
- The JSON schema enforces `can_autobuy: false` (const) and `score_autobuy: 0` (const).

## 6. RLS and Security Model

- Row Level Security is **enabled** on the table.
- No SELECT/INSERT/UPDATE/DELETE policies are created in this migration.
- This means only the Supabase service role (which bypasses RLS) can read/write.
- App-facing policies will be added in a future sprint when runtime logging is wired.
- No personal sensitive data beyond nullable `user_id` and `mission_id` is stored.
- No payment/card data is ever stored in this table.

## 7. JSON Contract

**File:** `contracts/v7a_shadow_decision_log.schema.json`

- JSON Schema draft 2020-12.
- Required fields: `route`, `action`, `policy_version`, `can_autobuy`, `score_autobuy`, `thresholds`, `decision_reasons`.
- `action` enum: `ABSTAIN`, `BUY_NOW`, `ALERT`, `MONITOR`, `WAIT`.
- `can_autobuy` const `false`.
- `score_autobuy` const `0`.
- `drop_proba` range [0, 1].
- `additionalProperties: false`.

## 8. Example Insert Payload

```sql
insert into public.v7a_shadow_decision_logs (
  environment, shadow_run_id, route, origin, destination,
  depart_date, fetched_at, ttd_days, price_usd,
  q50_gain, c_alpha_gain, width_over_price, drop_proba,
  route_known, route_popularity,
  action, confidence, score_alert, score_buy,
  policy_version, thresholds, decision_reasons
) values (
  'staging', 'run-2026-05-11-001', 'JFK-LAX', 'JFK', 'LAX',
  '2026-06-15', now(), 35, 320.00,
  -5.0, 15.0, 0.09375, 0.35,
  true, 800,
  'WAIT', 0.625, 0.35, 10.0,
  'v7a-balanced-v2',
  '{"MAX_WIDTH_OVER_PRICE":1.5,"ABSTAIN_WIDTH_OVER_PRICE":2.0,"BUY_TRIGGER_MARGIN_USD":20.0,"DROP_PROBA_BUY_MAX":0.25,"ALERT_DROP_THRESHOLD":0.95,"ALERT_NEAR_FLOOR_PCT":1.01,"ROUTE_POPULARITY_MIN":30,"TTD_LOWER":5,"TTD_UPPER":90}'::jsonb,
  '["no_trigger"]'::jsonb
);
```

## 9. Analysis Queries

**Action distribution by day:**
```sql
select
  date_trunc('day', created_at) as day,
  action,
  count(*) as n
from v7a_shadow_decision_logs
group by 1, 2
order by 1 desc, 3 desc;
```

**Monitor rate by route:**
```sql
select
  route,
  count(*) filter (where action = 'MONITOR') as n_monitor,
  count(*) as n_total,
  round(count(*) filter (where action = 'MONITOR')::numeric / nullif(count(*), 0), 4) as monitor_rate
from v7a_shadow_decision_logs
group by route
order by n_total desc
limit 50;
```

**Safety: count of can_autobuy=true (expected zero):**
```sql
select count(*) as autobuy_violations
from v7a_shadow_decision_logs
where can_autobuy = true;
-- Expected: 0
```

**Decisions by policy version:**
```sql
select
  policy_version,
  action,
  count(*) as n
from v7a_shadow_decision_logs
group by 1, 2
order by 1, 3 desc;
```

**Alert precision proxy (requires price outcome join, placeholder):**
```sql
-- Placeholder: true alert precision requires joining with future price observations.
-- This query counts ALERT rows and their price proximity to q10_train_route.
select
  count(*) as n_alerts,
  avg(case when price_usd <= q10_train_route * 1.05 then 1.0 else 0.0 end) as near_q10_train_rate
from v7a_shadow_decision_logs
where action = 'ALERT'
  and q10_train_route is not null
  and price_usd is not null;
```

## 10. Non-Goals and Next Steps

**This sprint did NOT:**
- Apply the migration (`supabase db push` was not run).
- Run any Supabase CLI command.
- Wire any app runtime code.
- Enable auto-buy.
- Retrain models.
- Run Modal.
- Touch app/components/lib/API routes.
- Make the system production-ready.

**Next steps:**
- Review and merge schema PR.
- Apply migration in staging environment.
- Wire runtime shadow logging in a future sprint (`b1/v7a-shadow-logging-runtime`).
- Add INSERT policy for the app's service role.
- Build dashboard queries on the logged decisions.
- Compare shadow decisions against observed price outcomes over time.
- AUTO_BUY enablement requires a separate, gated sprint with explicit approval.
