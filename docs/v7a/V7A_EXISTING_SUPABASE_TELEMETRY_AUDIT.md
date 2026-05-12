# V7a Existing Supabase Telemetry Audit

> **Sprint:** `b1/v7a-supabase-existing-telemetry-audit`
> **Date:** 2026-05-12
> **Status:** Documentation / audit only. No migration applied. No write Supabase calls were made by this sprint. The audit uses prior read-only SQL observations supplied by the human operator.

## 1. Purpose

Audit the existing production Supabase telemetry table `agent_decisions` and compare it with the proposed `v7a_shadow_decision_logs` table to determine the correct table strategy before applying any migration.

## 2. Observed Supabase State

Findings from read-only dashboard checks against the production Supabase instance:

| Check | Result |
| --- | --- |
| `select to_regclass('public.v7a_shadow_decision_logs')` | **NULL** — table does not exist |
| `public.agent_decisions` exists | **yes** |
| `agent_decisions` row count | ~23 |
| Distinct routes | ~18 |
| Distinct days | ~11 |
| Distinct V7a actions in JSONB | 2 |
| Distinct V7a sources in JSONB | 2 |
| Rows with `v7a` JSONB payload | 23 |
| Provider: sky-scraper | 19 |
| Provider: kiwi | 4 |
| Provider: google-flights | 0 |
| Rows with gate=unknown | 18 |

The existing data appears demo-like / low volume (~23 rows over ~11 days).

## 3. Existing `agent_decisions` Table

**Schema (observed):**

| Column | Type | Nullable |
| --- | --- | --- |
| `id` | bigint | not null |
| `logged_at` | timestamptz | not null |
| `mission_id` | text | nullable |
| `route` | text | nullable |
| `price` | numeric | nullable |
| `ttd_days` | integer | nullable |
| `engine` | text | nullable |
| `action` | text | nullable |
| `confidence` | numeric | nullable |
| `v7a` | jsonb | nullable |
| `note` | text | nullable |
| `provider` | text | nullable |

**Key characteristics:**
- General-purpose telemetry: captures any agent decision, not V7a-specific.
- `action` is unconstrained text — no CHECK, no enum, no AUTO_BUY exclusion.
- `v7a` JSONB is a freeform blob — no schema enforcement on its contents.
- No `policy_version`, `thresholds`, `decision_reasons`, `feature_snapshot`, `artifact_versions` columns.
- No `can_autobuy`, `score_autobuy`, `autobuy_enabled_input` safety columns.
- No `environment`, `shadow_run_id`, `trace_id` columns.
- No `width_over_price`, `drop_proba`, `c_alpha_gain`, or quantile gain columns.
- `route` is nullable (V7a requires non-null).
- `mission_id` is text (V7a uses uuid).
- RLS status not verified enabled (as far as observed).
- No CHECK constraints on numeric ranges.

## 4. Proposed `v7a_shadow_decision_logs` Table

**Migration:** `supabase/migrations/20260511000001_v7a_shadow_decision_logs.sql`

| Property | Detail |
| --- | --- |
| Columns | 35 typed columns |
| `action` | CHECK: only ABSTAIN, BUY_NOW, ALERT, MONITOR, WAIT |
| `can_autobuy` | boolean NOT NULL DEFAULT false |
| `score_autobuy` | numeric NOT NULL DEFAULT 0 |
| `drop_proba` | CHECK between 0 and 1 |
| `price_usd` | CHECK >= 0 |
| `confidence` | CHECK between 0 and 1 |
| `thresholds` | jsonb NOT NULL |
| `decision_reasons` | jsonb NOT NULL |
| `feature_snapshot` | jsonb NOT NULL |
| `artifact_versions` | jsonb NOT NULL |
| `policy_version` | text NOT NULL |
| `environment` | CHECK: local, staging, production, test |
| `shadow_run_id` | text |
| `trace_id` | text |
| Indexes | 8 (created_at, mission_id, user_id, route+depart, action, policy_version, shadow_run_id, GIN thresholds) |
| RLS | Enabled, no policies |
| Table comment | Describes shadow/advisory purpose; AUTO_BUY impossible |

## 5. Schema Gap Analysis

| Capability | `agent_decisions` | `v7a_shadow_decision_logs` |
| --- | --- | --- |
| Action constraint (no AUTO_BUY) | **no** — freeform text | **yes** — CHECK enum |
| can_autobuy safety column | **no** | **yes** — always false |
| score_autobuy safety column | **no** | **yes** — always 0 |
| Policy version tracking | **no** | **yes** |
| Threshold snapshot | **no** | **yes** — jsonb |
| Decision reasons | **no** | **yes** — jsonb array |
| Feature snapshot | **no** | **yes** — jsonb |
| Artifact versions | **no** | **yes** — jsonb |
| Model quantile outputs (q10/q50/q90) | embedded in `v7a` jsonb | **yes** — typed columns |
| Conformal width columns | **no** | **yes** — c_alpha_gain, width_over_price |
| Drop probability column | embedded in `v7a` jsonb | **yes** — CHECK [0,1] |
| Environment tracking | **no** | **yes** — CHECK enum |
| Shadow run / trace IDs | **no** | **yes** |
| Numeric range CHECKs | **no** | **yes** — price, drop_proba, confidence, width, latency |
| Route NOT NULL | **no** — nullable | **yes** |
| RLS enabled | not observed | **yes** |
| Indexes for analytics | not observed | **yes** — 8 indexes |

**Gap summary:** `agent_decisions` lacks 15+ structural guarantees that the V7a shadow logging contract requires. Adapting `agent_decisions` to match would require an ALTER migration adding ~20 columns, 6+ CHECK constraints, and restructuring the JSONB approach — effectively a rewrite.

## 6. Duplication Risk

| Risk | Assessment |
| --- | --- |
| Two tables storing flight decisions | Low — different purposes and schemas |
| Confusion about which table is authoritative for V7a | Low if documented — this audit establishes the separation |
| `agent_decisions.v7a` JSONB becoming stale | Medium — if `agent_decisions` continues to write V7a payloads after the shadow logger is wired, the JSONB and the typed table may drift |
| Storage cost of a second table | Negligible — shadow logging is advisory volume, not transactional |

**Mitigation:** Once the shadow logger is wired to `v7a_shadow_decision_logs`, the `agent_decisions.v7a` JSONB should either stop being written or be documented as a legacy summary, not the source of truth.

## 7. Recommended Table Strategy

**Keep both tables with clear separation of responsibilities.**

| Table | Role | Audience |
| --- | --- | --- |
| `agent_decisions` | General agent telemetry, legacy, multi-provider | Product / ops |
| `v7a_shadow_decision_logs` | ML-grade V7a shadow audit with strict constraints | ML pipeline / policy audit |

**Rationale:**
1. `agent_decisions` is already in production with existing consumers. Altering it risks breaking current telemetry.
2. `v7a_shadow_decision_logs` has 15+ structural guarantees (action enum, AUTO_BUY exclusion, CHECK constraints, typed columns) that cannot be retrofitted into `agent_decisions` without a disruptive ALTER migration.
3. The V7a shadow logger (`lib/v7a/shadow-decision-logger.ts`) already targets `v7a_shadow_decision_logs` and validates against the strict contract.
4. Storage cost is negligible for advisory-volume logging.
5. A future consolidation sprint can unify if needed, but premature merging creates risk now.

**Do NOT adapt the V7a logger to write into `agent_decisions`** unless a later migration explicitly adds the required constraints. The `agent_decisions` schema is too loose for ML-grade audit.

## 8. Migration / Runtime Implications

| Step | Action | Environment |
| --- | --- | --- |
| 1 | Apply `20260511000001_v7a_shadow_decision_logs.sql` | **Staging first** |
| 2 | Verify table exists with correct schema | Staging |
| 3 | Run test INSERT + DELETE | Staging |
| 4 | Wire runtime logger behind feature flag | Staging |
| 5 | Validate shadow logs accumulate correctly | Staging |
| 6 | Apply migration to production | After staging validation |
| 7 | Enable runtime logger in production | After production migration |

**The migration must NOT be applied to production before staging validation.**

The runtime logger (`lib/v7a/shadow-decision-logger.ts`) writes to `v7a_shadow_decision_logs`, not `agent_decisions`. This is correct and should not be changed.

## 9. Safety Constraints

- No migration was applied in this sprint.
- No real Supabase call was made in this sprint.
- No app/lib/scripts code was modified.
- No AUTO_BUY is enabled or permitted.
- No payment, checkout, escrow, or booking code was touched.
- The system is NOT production-ready.
- The V7a shadow logging table does not exist in the observed production database.
- The `agent_decisions` table was read-only inspected; no writes were made.

## 10. Recommended Next Sprint

**`b1/v7a-supabase-migration-staging`**

Scope:
1. Apply `20260511000001_v7a_shadow_decision_logs.sql` to the staging Supabase instance.
2. Verify table creation: `select to_regclass('public.v7a_shadow_decision_logs')`.
3. Verify schema: columns, CHECK constraints, indexes, RLS.
4. Run a test INSERT with a valid payload, then DELETE it.
5. Document the staging verification result.
6. Do NOT apply to production.
7. Do NOT wire the runtime logger.
8. Do NOT modify `agent_decisions`.

After staging is verified, the subsequent sprint (`b1/v7a-shadow-logging-runtime-adapter`) can wire the logger into the watcher cron behind `V7A_SHADOW_LOG_ENABLED=true`.
