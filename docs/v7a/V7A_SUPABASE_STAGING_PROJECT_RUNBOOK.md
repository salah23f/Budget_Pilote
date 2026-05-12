# V7a Supabase Staging Project Setup Runbook

> **Sprint:** `b1/v7a-create-supabase-staging-project-runbook`
> **Date:** 2026-05-12
> **Status:** Documentation / runbook only. No migration applied. No Supabase commands run. No staging project created by this sprint.

## 1. Purpose

Provide a step-by-step runbook for the human operator to create a separate Supabase staging project, verify its state, and prepare it for the V7a shadow decision logging migration — without touching the production database.

## 2. Current Production Supabase State

As observed in the previous audit (`docs/v7a/V7A_EXISTING_SUPABASE_TELEMETRY_AUDIT.md`):

| Item | Status |
| --- | --- |
| Supabase dashboard | Marked **PRODUCTION** |
| `public.agent_decisions` | Present (~23 rows, general telemetry) |
| `public.v7a_shadow_decision_logs` | **NOT present** (`to_regclass` returned NULL) |
| `public.missions` | Present |
| `public.mission_proposals` | Present |

**No migration should be applied to this production instance first.** The V7a shadow table must be created and validated in staging before any production change.

`agent_decisions` remains general/legacy telemetry and should not be modified by V7a work.

## 3. Why a Separate Staging Project Is Required

1. **Production safety:** The V7a migration creates a new table with CHECK constraints, RLS, and 8 indexes. Applying untested schema changes to production risks breaking existing agent_decisions telemetry or missions functionality.
2. **Isolation:** A staging project allows test INSERTs, schema verification, and rollback without affecting real user data.
3. **Credential separation:** Staging and production must use different service role keys to prevent accidental writes to the wrong database.
4. **Audit trail:** The integration readiness audit requires confirmed staging validation before production migration.

## 4. Staging Project Creation Checklist

Run these steps manually. Do NOT automate or script against production.

### 4.1 Verify Supabase CLI

```bash
supabase --version
# Expected: supabase CLI 1.x or 2.x
```

### 4.2 List existing projects

```bash
supabase projects list
# Identify the existing production project ref.
# Note its ref ID (e.g., "abcdefghijklmnop").
# Confirm it is the PRODUCTION project.
```

### 4.3 Create a new staging project

Via Supabase dashboard (https://supabase.com/dashboard):
1. Click "New Project".
2. Name: `budgetpilot-staging` (or similar).
3. Region: same region as production for latency consistency.
4. Database password: generate a strong password, store it securely.
5. Plan: Free tier is sufficient for staging validation.

**Record the new staging project ref** (e.g., `stgxyzabcdefghij`).

### 4.4 Link the staging project locally (optional)

```bash
# Only if you want to use supabase CLI against staging.
# Do NOT overwrite your production link.
supabase link --project-ref <STAGING_REF>
```

**Warning:** `supabase link` changes the local project ref. If you need to switch back to production later, re-link with the production ref. Consider using separate directories or env files.

### 4.5 Verify staging project is empty

```bash
supabase status
# Should show the staging project ref, not production.
```

Or via SQL editor in the Supabase dashboard for the staging project:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
-- Expected: empty or only default Supabase tables.
```

## 5. Environment Variable Separation

**Critical:** Production and staging must use separate credentials. Never use the production service role key for staging experiments.

### Required env vars for staging

```
STAGING_SUPABASE_URL=https://<STAGING_REF>.supabase.co
STAGING_SUPABASE_ANON_KEY=<staging anon key>
STAGING_SUPABASE_SERVICE_ROLE_KEY=<staging service role key>
```

### Production env vars (existing, do NOT modify)

```
NEXT_PUBLIC_SUPABASE_URL=https://<PROD_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<production anon key>
SUPABASE_SERVICE_ROLE_KEY=<production service role key>
```

### Rules

- **Never** set `SUPABASE_SERVICE_ROLE_KEY` to the production key in local V7a experiments.
- **Never** set `NEXT_PUBLIC_SUPABASE_URL` to staging in a deployed environment.
- Use a separate `.env.staging.local` file (gitignored) for staging credentials if needed.
- Do NOT commit staging keys to the repository.

## 6. Read-Only Verification Before Migration

Before applying any migration to staging, run these read-only checks in the staging Supabase SQL editor:

```sql
-- Check 1: V7a shadow table should NOT exist yet
select to_regclass('public.v7a_shadow_decision_logs') as v7a_shadow_table;
-- Expected: NULL

-- Check 2: List all public tables
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
-- Expected: empty or minimal

-- Check 3: Confirm this is NOT production
-- (production has agent_decisions, missions, mission_proposals)
select to_regclass('public.agent_decisions') as agent_decisions;
-- Expected: NULL (staging should not have production tables)

select to_regclass('public.missions') as missions;
-- Expected: NULL
```

**If any of these checks return a production table name, STOP. You are connected to production, not staging.**

## 7. Migration Application Plan for Staging

> **DO NOT RUN YET.** This section documents the commands for the next sprint (`b1/v7a-supabase-migration-staging`). They are included here for planning only.

### Option A: Via Supabase CLI

```bash
# Ensure you are linked to STAGING, not production
supabase status
# Confirm project ref is the staging ref

supabase db push
# This applies all pending migrations including
# 20260511000001_v7a_shadow_decision_logs.sql
```

### Option B: Via SQL editor (manual)

Copy the contents of `supabase/migrations/20260511000001_v7a_shadow_decision_logs.sql` into the staging project's SQL editor and execute.

### Post-migration verification

```sql
-- Confirm table exists
select to_regclass('public.v7a_shadow_decision_logs') as v7a_shadow_table;
-- Expected: 'public.v7a_shadow_decision_logs'

-- Confirm column count and types
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'v7a_shadow_decision_logs'
order by ordinal_position;
-- Expected: 35 columns matching the migration

-- Confirm CHECK constraints
select constraint_name, check_clause
from information_schema.check_constraints
where constraint_schema = 'public';
-- Expected: action enum, environment enum, numeric range checks

-- Confirm indexes
select indexname
from pg_indexes
where tablename = 'v7a_shadow_decision_logs';
-- Expected: 8 indexes (v7a_sdl_*)

-- Confirm RLS is enabled
select relrowsecurity
from pg_class
where relname = 'v7a_shadow_decision_logs';
-- Expected: true
```

## 8. Safe Test Insert Plan

> **DO NOT RUN YET.** For the staging migration sprint only.

After the migration is applied to staging, run a single safe test INSERT with action=WAIT:

```sql
insert into public.v7a_shadow_decision_logs (
  environment,
  shadow_run_id,
  trace_id,
  route,
  action,
  policy_version,
  can_autobuy,
  score_autobuy,
  thresholds,
  decision_reasons
) values (
  'test',
  'staging-runbook-test',
  'trace-runbook-001',
  'TEST-TEST',
  'WAIT',
  'v7a-balanced-v2',
  false,
  0,
  '{"test": true}'::jsonb,
  '["runbook_test_insert"]'::jsonb
)
returning id, created_at, action, can_autobuy, score_autobuy;
```

**Verify the returned row:**
- `action` = 'WAIT'
- `can_autobuy` = false
- `score_autobuy` = 0

**Then verify AUTO_BUY is blocked:**

```sql
-- This MUST fail with a CHECK constraint violation
insert into public.v7a_shadow_decision_logs (
  environment, route, action, policy_version,
  can_autobuy, score_autobuy, thresholds, decision_reasons
) values (
  'test', 'TEST-TEST', 'AUTO_BUY', 'v7a-balanced-v2',
  false, 0, '{}'::jsonb, '[]'::jsonb
);
-- Expected: ERROR — violates check constraint on action
```

## 9. Cleanup and Rollback Plan

### Cleanup test rows by trace_id

```sql
delete from public.v7a_shadow_decision_logs
where trace_id = 'trace-runbook-001';
-- Expected: 1 row deleted
```

### Full rollback (drop table)

Only if the staging migration needs to be reverted entirely:

```sql
drop table if exists public.v7a_shadow_decision_logs cascade;
```

**Never run this against production.**

### Rollback safety check

Before any rollback command, verify the project ref:

```sql
select current_database();
-- Must match the STAGING database name, NOT production
```

## 10. Go / No-Go Criteria and Next Sprint

### Go criteria for staging migration

All must be true:

- [ ] Staging Supabase project exists with a separate ref.
- [ ] Staging credentials are stored securely, not in `.env` or committed files.
- [ ] Production credentials are NOT used in local V7a experiments.
- [ ] Read-only checks confirm staging is empty (no production tables).
- [ ] Human operator has confirmed they are NOT connected to production.

### No-Go conditions

- Staging project does not exist → create it first.
- Cannot distinguish staging from production → resolve credentials.
- Production service role key is the only available key → do NOT proceed.

### Recommended next sprint if staging is created

**`b1/v7a-supabase-migration-staging`**

Scope:
1. Apply migration to staging.
2. Run post-migration verification queries.
3. Run safe test INSERT (WAIT action).
4. Verify AUTO_BUY CHECK constraint blocks.
5. Clean up test rows.
6. Document staging verification result.
7. Do NOT apply to production.

### Recommended next sprint if staging cannot be created

**`b1/v7a-shadow-logging-runtime-adapter-dry-run`**

Scope:
1. Wire the shadow logger into the watcher cron behind `V7A_SHADOW_LOG_ENABLED` feature flag.
2. Default to disabled (`false`).
3. In dry-run mode, validate and log payloads to stderr without calling Supabase.
4. No real INSERT, no Supabase client instantiation, no migration dependency.
5. Allows testing the runtime integration path without a database.

### Safety reminders

- No AUTO_BUY.
- No payment, checkout, escrow, or booking.
- No app route wiring in this sprint.
- No production migration.
- Not production-ready.
- No Supabase commands were run by this sprint.
- No staging project was created by this sprint.
