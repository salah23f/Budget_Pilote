# V7a Shadow Logging Runtime Adapter — Staging

> **Sprint:** `b1/v7a-shadow-logging-runtime-adapter-staging`
> **Date:** 2026-05-18
> **Status:** Staging adapter created. Not wired to app routes. Not production-ready.

## 1. Purpose

Provide a staging-only runtime adapter that gates V7a shadow decision logging behind explicit feature flags. Proves that app-side code can safely write advisory decisions to Flyeas STAGING Supabase without touching production and without enabling auto-buy.

## 2. Environment Flags

| Flag | Required Value | Purpose |
| --- | --- | --- |
| `V7A_SHADOW_LOG_ENABLED` | `"true"` | Master switch — disabled by default |
| `V7A_SHADOW_LOG_ENVIRONMENT` | `"staging"` | Must be staging; production refused |
| `STAGING_SUPABASE_URL` | set | Staging Supabase URL (smoke test only) |
| `STAGING_SUPABASE_SERVICE_ROLE_KEY` | set | Staging service role key (smoke test only) |

The adapter never reads `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_URL`.

## 3. Staging-Only Safety

The adapter enforces:
- Skips if `V7A_SHADOW_LOG_ENABLED` is not `"true"`.
- Skips if `V7A_SHADOW_LOG_ENVIRONMENT` is not `"staging"`.
- Returns error if environment is `"production"`.
- Rejects `AUTO_BUY` action.
- Forces `can_autobuy = false` regardless of input.
- Forces `score_autobuy = 0` regardless of input.
- No payment, checkout, escrow, or booking logic.

## 4. Smoke Test Commands

### Dry run (no Supabase call)

```bash
npx tsx scripts/v7a/staging-shadow-log-smoke.ts --dry-run
```

### Real staging write (requires all env vars)

```bash
V7A_SHADOW_LOG_ENABLED=true \
V7A_SHADOW_LOG_ENVIRONMENT=staging \
STAGING_SUPABASE_URL=<url> \
STAGING_SUPABASE_SERVICE_ROLE_KEY=<key> \
npx tsx scripts/v7a/staging-shadow-log-smoke.ts --confirm-staging-write
```

### Keep the test row (do not auto-delete)

```bash
... --confirm-staging-write --keep-row
```

## 5. No Production Usage

- The adapter refuses `V7A_SHADOW_LOG_ENVIRONMENT=production`.
- The smoke script refuses to read `SUPABASE_SERVICE_ROLE_KEY`.
- The smoke script refuses to read `NEXT_PUBLIC_SUPABASE_URL`.
- No production database is touched.
- No migration is applied by this sprint.

## 6. No Auto-Buy

- `AUTO_BUY` action is rejected before reaching Supabase.
- `can_autobuy` is forced to `false`.
- `score_autobuy` is forced to `0`.
- The Supabase CHECK constraint also blocks AUTO_BUY at the DB level.
- No payment, checkout, escrow, or booking code exists in this module.

## 7. Cleanup Behavior

The smoke script automatically deletes its test row by `trace_id` after verification, unless `--keep-row` is passed. Trace IDs follow the pattern:

```
v7a-staging-runtime-smoke-<timestamp>
```

Manual cleanup:
```sql
delete from v7a_shadow_decision_logs where trace_id like 'v7a-staging-runtime-smoke-%';
```

## 8. Unit Tests

Run:
```bash
npx tsx lib/v7a/shadow-logging-runtime-adapter.test.ts
```

11 tests covering:
- Feature flag gates (enabled missing, false, wrong environment)
- Production refusal
- AUTO_BUY rejection
- can_autobuy/score_autobuy forcing
- Valid WAIT and MONITOR payloads
- Logger failure handling
- No forbidden imports

## 9. Next Step After This Sprint

**`b1/v7a-shadow-logging-watcher-integration`**

Purpose: Wire `logV7aShadowDecisionIfEnabled` into the existing watcher/cron path (the code that evaluates flights and calls `classify()`). The watcher already has access to a Supabase client for missions — it will additionally call the shadow logger after each policy evaluation.

Requirements:
- Feature-flagged: only logs when `V7A_SHADOW_LOG_ENABLED=true` and environment is staging.
- Uses the staging Supabase client, not the production one.
- Remains advisory/shadow — no purchases triggered.
- No AUTO_BUY.
