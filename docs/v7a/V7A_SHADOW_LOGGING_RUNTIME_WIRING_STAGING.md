# V7a Shadow Logging Runtime Wiring — Staging

> **Sprint:** `b1/v7a-shadow-logging-runtime-wiring-staging`
> **Date:** 2026-05-18
> **Status:** Wired to watcher. Staging-only. Default OFF. Not production-ready.

## 1. Purpose

Wire the V7a structured shadow logger into the actual watcher runtime path, so that when `FLYEAS_ALGO_VERSION=shadow` or `v7a` and the V7a shadow feature flags are enabled for staging, each decision is logged to `public.v7a_shadow_decision_logs` in Flyeas STAGING Supabase.

## 2. Runtime Path Wired

```
lib/agent/watcher.ts
  → watchMission()
    → predictV7aFirst()
      → enriched.v7a (V7aPrediction from Modal)
    → logV7aShadow()                    [existing: → agent_decisions / JSONL]
    → logV7aShadowFromPrediction()      [NEW: → v7a_shadow_decision_logs staging]
```

The new call is:
- Non-blocking (`void ... .catch(() => {})`)
- After the existing `logV7aShadow` call
- Only active when feature flags are set
- Failure is swallowed — never impacts the watcher

## 3. Feature Flags

| Flag | Required Value | Default |
| --- | --- | --- |
| `V7A_SHADOW_LOG_ENABLED` | `"true"` | unset (disabled) |
| `V7A_SHADOW_LOG_ENVIRONMENT` | `"staging"` | unset (skipped) |
| `STAGING_SUPABASE_URL` | staging URL | unset (skipped) |
| `STAGING_SUPABASE_SERVICE_ROLE_KEY` | staging key | unset (skipped) |

**Default behavior: OFF.** Without these flags, the wiring call returns `{ ok: true, skipped: true }` immediately with no Supabase interaction.

## 4. Staging-Only Environment Variables

The wiring module:
- Never reads `SUPABASE_SERVICE_ROLE_KEY` (production)
- Never reads `NEXT_PUBLIC_SUPABASE_URL` (production)
- Only reads `STAGING_SUPABASE_URL` and `STAGING_SUPABASE_SERVICE_ROLE_KEY`
- Refuses to proceed if `V7A_SHADOW_LOG_ENVIRONMENT` is not `"staging"`

## 5. Default OFF Behavior

When deployed without the staging flags:
- The `logV7aShadowFromPrediction()` call returns immediately with `skipped: true`
- No Supabase client is created
- No network call is made
- No latency is added to the watcher

## 6. Failure Behavior

- If the staging Supabase is unreachable: returns `{ ok: false, error }`, swallowed by `.catch()`
- If validation fails (e.g., AUTO_BUY somehow arrives): returns `{ ok: false, error }`, swallowed
- The watcher continues normally regardless of shadow logging outcome
- Console errors are not logged to avoid noise; the result is fire-and-forget

## 7. No Production Behavior

- The adapter refuses `V7A_SHADOW_LOG_ENVIRONMENT=production`
- The adapter refuses `input.environment=production`
- Production Supabase keys are never read
- No production table is written
- The existing `agent_decisions` logging path is unchanged

## 8. No Auto-Buy

- `AUTO_BUY` action is rejected by the adapter before reaching Supabase
- `can_autobuy` is forced to `false` in the payload
- `score_autobuy` is forced to `0` in the payload
- The Supabase CHECK constraint also blocks AUTO_BUY at the DB level
- No payment, checkout, escrow, or booking behavior exists in this path

## 9. Manual Validation Commands

```bash
# Unit tests (no network)
npx tsx lib/v7a/shadow-logging-runtime-adapter.test.ts
npx tsx lib/v7a/shadow-logging-runtime-wiring.test.ts

# Smoke test dry-run (no network)
npx tsx scripts/v7a/staging-shadow-log-smoke.ts --dry-run

# Real staging write (requires staging credentials)
V7A_SHADOW_LOG_ENABLED=true \
V7A_SHADOW_LOG_ENVIRONMENT=staging \
STAGING_SUPABASE_URL=<url> \
STAGING_SUPABASE_SERVICE_ROLE_KEY=<key> \
npx tsx scripts/v7a/staging-shadow-log-smoke.ts --confirm-staging-write
```

## 10. Next Sprint Recommendation

**`b1/v7a-staging-shadow-log-e2e-verification`**

Purpose: Deploy to staging Vercel with the feature flags enabled, trigger a watcher run, and verify that rows appear in `v7a_shadow_decision_logs` with correct schema.

Alternatively: **`b1/v7a-production-migration-and-rollout`** — once staging e2e is verified, apply the migration to production and enable shadow logging there.
# shadow preview trigger

# redeploy
# algo version
