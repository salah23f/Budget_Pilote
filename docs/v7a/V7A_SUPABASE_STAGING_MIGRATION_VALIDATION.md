# V7a Supabase Staging Migration Validation

> **Sprint:** `b1/v7a-supabase-staging-validation`
> **Date:** 2026-05-18
> **Status:** Validation report only. No code modified. No production touched.

## 1. Staging Project

| Property | Value |
| --- | --- |
| Project name | Flyeas STAGING |
| Environment | staging |
| Production touched | **No** |

The staging project is a separate Supabase instance from production. All validation was performed against staging only.

## 2. Migration Status

**Table `public.v7a_shadow_decision_logs` exists in Flyeas STAGING.**

Note: The earlier singular table name `public.v7a_shadow_decision_log` was incorrect; the correct table name is plural: `public.v7a_shadow_decision_logs` (matching the migration file `20260511000001_v7a_shadow_decision_logs.sql`).

### Column Introspection

Column introspection confirmed all expected columns are present:

| Column | Present |
| --- | --- |
| `id` | yes |
| `created_at` | yes |
| `environment` | yes |
| `shadow_run_id` | yes |
| `trace_id` | yes |
| `mission_id` | yes |
| `user_id` | yes |
| `route` | yes |
| `origin` | yes |
| `destination` | yes |
| `depart_date` | yes |
| `fetched_at` | yes |
| `ttd_days` | yes |
| `price_usd` | yes |
| `q10_gain` | yes |
| `q50_gain` | yes |
| `q90_gain` | yes |
| `c_alpha_gain` | yes |
| `width_over_price` | yes |
| `drop_proba` | yes |
| `q10_train_route` | yes |
| `route_known` | yes |
| `route_popularity` | yes |
| `action` | yes |
| `confidence` | yes |
| `score_alert` | yes |
| `score_buy` | yes |
| `score_autobuy` | yes |
| `can_autobuy` | yes |
| `autobuy_enabled_input` | yes |
| `policy_version` | yes |
| `policy_source` | yes |
| `model_version` | yes |
| `thresholds` | yes |
| `decision_reasons` | yes |
| `feature_snapshot` | yes |
| `artifact_versions` | yes |
| `decision_latency_ms` | yes |
| `error_code` | yes |
| `error_message` | yes |

Total: 40 columns confirmed.

## 3. Safety Validation

| Check | Result |
| --- | --- |
| Initial row count | **0** |
| Rows with `can_autobuy = true` | **0** |
| Rows with `score_autobuy <> 0` | **0** |
| Safe WAIT insert | **Succeeded** |
| Returned row: `action` | `WAIT` |
| Returned row: `can_autobuy` | `false` |
| Returned row: `score_autobuy` | `0` |
| AUTO_BUY insert attempt | **Failed** (CHECK constraint violation, as expected) |
| Test WAIT row deleted | **Yes** |
| Final remaining test rows | **0** |

The table correctly enforces:
- `action` must be one of: ABSTAIN, BUY_NOW, ALERT, MONITOR, WAIT.
- AUTO_BUY is rejected by the CHECK constraint.
- `can_autobuy` defaults to false.
- `score_autobuy` defaults to 0.

## 4. Scope and Non-Goals

| Item | Status |
| --- | --- |
| App runtime wiring | **Not done** |
| Production migration | **Not done** |
| Payment / checkout / escrow | **Not touched** |
| Modal run | **Not done** |
| Model retraining | **Not done** |
| AUTO_BUY | **Disabled, rejected by CHECK** |
| Production-ready | **No** |

This validation confirms the schema is correctly deployed in staging. It does not make the system production-ready or enable any transactional behavior.

## 5. Validation Summary

The staging Supabase migration for `v7a_shadow_decision_logs` is **fully validated**:
- Table exists with correct schema (40 columns).
- CHECK constraints enforce action enum and AUTO_BUY exclusion.
- Safe insert/delete cycle completed cleanly.
- Table is empty and ready for runtime shadow logging.

## 6. Recommended Next Sprint

**`b1/v7a-shadow-logging-runtime-adapter-staging`**

Purpose: Wire the existing V7a shadow logger (`lib/v7a/shadow-decision-logger.ts`) to a staging-only runtime path behind a feature flag.

Requirements:
- Inserts only when `V7A_SHADOW_LOG_ENABLED=true`.
- Supabase target must be staging (not production).
- Must remain advisory/shadow only.
- Must NOT trigger purchases, payments, or auto-buy.
- Must NOT wire to production Supabase.
- Logger already validates: `can_autobuy=false`, `score_autobuy=0`, action enum excludes AUTO_BUY.

The runtime adapter sprint will complete the shadow logging loop: policy evaluation → validated payload → staging INSERT.
