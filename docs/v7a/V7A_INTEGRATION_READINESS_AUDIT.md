# V7a Integration Readiness Audit

> **Sprint:** `b1/v7a-integration-readiness-audit`
> **Date:** 2026-05-11
> **Status:** Audit / documentation only. NOT production-ready.

## 1. Executive Summary

The V7a pipeline has reached a validated, shadow-logging-ready state through 7 merged sprints:

| Sprint | Outcome |
| --- | --- |
| `b1/v7a-policy-apply-candidate` | Profile A applied + regression check |
| `b1/v7a-policy-sweep-v2` | 50k-candidate sweep for balanced policy |
| `b1/v7a-policy-apply-balanced-v2` | Balanced V2 strict applied + regression check |
| `b1/v7a-backtest-taxonomy-alignment` | Backtest aligned to ALERT/MONITOR taxonomy |
| `b1/v7a-shadow-logging-schema` | Supabase table schema + JSON contract |
| `b1/v7a-shadow-logging-supabase` | Server-side logger module + tests |
| `b1/v7a-integration-readiness-audit` | This audit |

**Verdict:** The policy is validated offline. The logger exists but is not wired. The Supabase migration exists in the repo, but this audit did not run Supabase commands and found no repo evidence that it has been applied. No app UI consumes V7a. AUTO_BUY is disabled. The system is NOT production-ready.

**Recommended next sprint:** `b1/v7a-supabase-migration-staging` — verify staging Supabase access, then apply the shadow logging migration in a controlled staging environment.

## 2. Current V7a Policy State

**Applied policy:** Balanced V2 strict
**Source:** `scripts/train/v7a/policy.py`
**Selection:** `reports/v7a_policy_sweep_v2_local.json` → `PROMOTE_BALANCED_V2_STRICT_CANDIDATE`

| Threshold | Value |
| --- | --- |
| `MAX_WIDTH_OVER_PRICE` | 1.50 |
| `ABSTAIN_WIDTH_OVER_PRICE` | 2.00 |
| `BUY_TRIGGER_MARGIN_USD` | 20.0 |
| `DROP_PROBA_BUY_MAX` | 0.25 |
| `ALERT_DROP_THRESHOLD` | 0.95 |
| `ALERT_NEAR_FLOOR_PCT` | 1.01 |
| `ROUTE_POPULARITY_MIN` | 30 |
| `TTD_LOWER` | 5 |
| `TTD_UPPER` | 90 |
| `MONITOR_DROP_PROBA_MIN` | 0.30 |
| `MONITOR_TTD_MIN` | 7 |
| `MONITOR_WIDTH_OVER_PRICE_MAX` | 0.50 |

Action taxonomy: ABSTAIN → BUY_NOW → ALERT → MONITOR → WAIT.
AUTO_BUY is excluded from the action CHECK constraint.

## 3. Validated Metrics and Their Sources

### Regression check (source: `reports/v7a_policy_balanced_v2_regression_local.json`)

| Metric | Value | Tolerance | Passed |
| --- | --- | --- | --- |
| `action_match_rate` | **1.000000** | >= 0.995 | yes |
| `n_mismatch` | **0** | — | yes |
| `alert_precision_floor_1_05` | **0.4525** | ±0.005 | yes |
| `alert_precision_floor_1_10` | **0.5020** | ±0.005 | yes |
| `alert_recall_floor_1_05` | **0.0277** | ±0.005 | yes |
| `buy_now_share` | **0.0068** | ±0.005 | yes |
| `alert_rate` | **0.0016** | ±0.005 | yes |
| `abstain_share` | **0.1747** | ±0.005 | yes |
| `regret_abs_mean` | **24.75** | ±1.0 | yes |
| `regret_abs_p90` | **73.99** | ±1.85 | yes |
| `regret_abs_p99` | **157.95** | ±3.95 | yes |
| `capture_median` | **0.9941** | ±0.005 | yes |
| `AUTO_BUY emitted` | **0** | must be 0 | yes |

All 10 metric checks passed with 0 diff. The regression is exact (match_rate = 1.0).

### Test dataset size

- n_rows: 149,937
- n_trajectories: 12,130
- n_trajectories_with_buy: 819 (6.75%)

### Action distribution

| Action | Count | Share |
| --- | --- | --- |
| ABSTAIN | 26,195 | 17.47% |
| BUY_NOW | 1,014 | 0.68% |
| ALERT | 239 | 0.16% |
| MONITOR | 9,176 | 6.12% |
| WAIT | 113,313 | 75.57% |

## 4. Sweep vs Regression vs Backtest Semantics

**These three systems compute overlapping but non-identical metrics.** This is intentional, not a bug.

### alert_precision_floor_1_05

| System | Definition | Value |
| --- | --- | --- |
| Sweep / Regression | % of (ALERT \| BUY_NOW) rows with price <= floor × 1.05 | **0.4525** |
| Backtest | % of ALERT-only rows with price <= floor × 1.05 | **0.0209** |

The difference (0.4525 vs 0.0209) is because:
- Sweep/regression treats ALERT and BUY_NOW together as "actionable" for precision.
- Backtest reports pure ALERT precision separately (ALERT-only rows, no BUY_NOW).
- BUY_NOW rows have higher floor-proximity than ALERT rows in this candidate.

### alert_recall_floor_1_05

| System | Definition | Value |
| --- | --- | --- |
| Sweep / Regression | % near-floor rows with action ∈ {ALERT, BUY_NOW} | **0.0277** |
| Backtest | % near-floor rows with action ∈ {ALERT, BUY_NOW} | **0.0277** |

Recall is consistent across all systems.

### regret / capture

| System | Regret definition | capture_median |
| --- | --- | --- |
| Regression | First BUY per trajectory; no-BUY trajectories excluded | **0.9941** |
| Backtest | First BUY per trajectory; no-BUY → last observed price | **0.5601** |

The difference (0.9941 vs 0.5601) is because:
- Regression only measures trajectories where BUY_NOW was triggered (819 / 12,130 = 6.75%). These trajectories have near-optimal timing.
- Backtest includes all 11,750 trajectories (different methodology), using last price for non-BUY trajectories, which drags capture down.

**Both numbers are honest.** The regression capture (0.9941) describes buy quality when the policy does buy. The backtest capture (0.5601) describes overall portfolio performance including missed opportunities.

## 5. Current Safety Guarantees

| Property | Status | Evidence |
| --- | --- | --- |
| AUTO_BUY never emitted | **Verified** | regression: emitted_count=0; backtest: auto_buy_emitted=false (both variants) |
| AUTO_BUY action CHECK in DB | **Defined** | migration excludes AUTO_BUY from action enum |
| can_autobuy always false | **Enforced** | logger validates can_autobuy===false; JSON schema const=false |
| score_autobuy always 0 | **Enforced** | logger hardcodes 0; JSON schema const=0 |
| No payment/checkout/escrow | **Verified** | logger has no payment imports; test verifies no payment fields |
| Policy never returns AUTO_BUY | **Verified** | classify() has no AUTO_BUY code path |

## 6. Shadow Logging Readiness

| Component | Exists | Tested | Wired to Runtime |
| --- | --- | --- | --- |
| Supabase migration SQL | yes | syntax only | **application not verified** |
| JSON schema contract | yes | — | — |
| Logger module (`lib/v7a/shadow-decision-logger.ts`) | yes | 10 tests pass | **NOT wired** |
| App route / cron integration | **no** | — | **no** |

**The logger is importable but is NOT imported by any file in `app/` or `lib/` outside of `lib/v7a/`.** Shadow logging is not active.

## 7. Supabase Readiness

| Item | Status |
| --- | --- |
| Migration file exists | yes: `supabase/migrations/20260511000001_v7a_shadow_decision_logs.sql` |
| Migration applied to staging | **Unknown / NOT confirmed** |
| Migration applied to production | **NOT applied** |
| RLS enabled in SQL | yes |
| RLS policies created | **no** (service role bypasses RLS) |
| Table referenced by app code | **no** |

**Migration application is not verified.** The file exists in the repo, but this audit did not run `supabase db push` or equivalent, and found no repo evidence that the migration has been applied.

## 8. Product Integration Readiness

| Item | Ready | Notes |
| --- | --- | --- |
| V7a policy module | yes | Balanced V2 applied, regression-validated |
| Offline backtest | yes | Taxonomy aligned |
| Shadow logger code | yes | Tested, injectable |
| Supabase table | **not verified** | Migration file exists; table existence was not checked against a live database |
| Watcher/cron integration | **no** | Logger not wired |
| App UI (alerts, monitors) | **no** | No V7a UI exists |
| User-facing notifications | **no** | Not implemented |
| AUTO_BUY execution | **no** | Disabled, not ready |
| Production deployment | **no** | Not attempted |

## 9. Blockers and Risks

### Blockers (must resolve before shadow logging can start)

1. **Supabase migration application not verified.** The `v7a_shadow_decision_logs` migration exists in the repo, but table existence must be checked in staging before runtime logging is enabled.
2. **Logger not wired.** `logV7aShadowDecision` is not called from any runtime path. A runtime adapter sprint is needed.

### Risks (documented, not blocking)

3. **Low alert_rate (0.16%).** The 0.95 drop threshold + 1.01 floor pct is very selective. Only 239 of 149,937 rows trigger ALERT. This may be too low for product value.
4. **Low trajectory_buy_coverage (6.75%).** The policy triggers BUY_NOW in only 6.75% of trajectories. The remaining 93.25% see no buy recommendation.
5. **false_buy_now_rate (36.4%).** Among BUY_NOW rows, 36.4% had a future price > $20 lower — the user would have been better off waiting.
6. **Backtest capture_median (0.5601) is low.** This reflects the fact that most trajectories don't get a BUY_NOW, so the "do nothing" fallback price is used.
7. **Regression report has a stale limitation note** referencing "backtest.py still uses legacy ALERT_SOFT/ALERT_STRONG" — this was fixed in the taxonomy alignment sprint but the regression report was not regenerated.

### Non-risks (already mitigated)

8. AUTO_BUY is comprehensively blocked at 5 layers: policy code, regression check, backtest safety diagnostic, logger validation, and Supabase CHECK constraint.
9. No payment code is reachable from V7a modules.

## 10. Recommended Next Sprint

**`b1/v7a-supabase-migration-staging`**

Rationale:
- The logger code exists and is tested.
- The migration SQL exists and is reviewed.
- The next physical step is to apply the migration in staging so the logger has a table to write to.
- Only after staging table existence is verified should we wire the runtime adapter to perform inserts.

Sprint scope:
1. Apply `20260511000001_v7a_shadow_decision_logs.sql` to staging.
2. Verify the table exists with correct schema.
3. Run a single test INSERT and DELETE to confirm connectivity.
4. Document the staging state.
5. Do NOT apply to production.
6. Do NOT wire the runtime adapter yet.

Alternative if staging Supabase is not available:
**`b1/v7a-shadow-logging-runtime-adapter`** — prepare the runtime adapter behind a feature flag, but keep real inserts disabled until staging table existence is verified.
