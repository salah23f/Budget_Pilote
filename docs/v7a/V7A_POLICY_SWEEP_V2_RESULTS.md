# V7a Policy Sweep V2 Results

> Generated: 2026-05-10T15:31:01Z
> Sprint: `b1/v7a-policy-sweep-v2`
> Candidates evaluated: **50000**

## 1. Purpose

Run an offline policy sweep v2 to search for a balanced V7a policy
candidate that reduces abstain_share (~40%) while maintaining alert
precision and capture. No retraining, no Modal, no app code changes.

## 2. Source Artifacts

- `predictions_test_parquet`: data/models_v7a_local/lgbm_test.parquet
- `features_test_parquet`: data/features_v7a_local/test.parquet
- `features_train_parquet`: data/features_v7a_local/train.parquet
- `conformal_json`: data/models_v7a_local/conformal_mondrian.json

## 3. Current Applied Policy Baseline (Profile A)

| Metric | Value |
| --- | --- |
| `alert_precision_floor_1_05` | 0.2072 |
| `alert_precision_floor_1_10` | 0.2333 |
| `buy_now_share` | 0.0115 |
| `alert_rate` | 0.0115 |
| `abstain_share` | 0.4043 |
| `regret_abs_mean` | 64.7684 |
| `regret_abs_p90` | 172.0300 |
| `regret_abs_p99` | 278.5844 |
| `capture_median` | 0.8716 |

## 4. Sweep V2 Search Space

- Total grid dimensions: 12
- Candidates generated: 50000
- Candidates evaluated: 50000
- Max candidates cap: 50000

## 5. Evaluation Metrics

Same semantics as `policy_tune.py`:
- alert precision = (ALERT|BUY_NOW) ∩ near_floor / (ALERT|BUY_NOW)
- alert_rate excludes BUY_NOW
- regret/capture computed per first-BUY trajectory
- AUTO_BUY never emitted

## 6. Profile Results

### balanced_v2_strict

- Feasible: **2336**

**Top feasible candidates:**

| alert_p_05 | buy_share | alert_rate | abstain | regret_p99 | capture_med | cfg_summary |
| --- | --- | --- | --- | --- | --- | --- |
| 0.4525 | 0.0068 | 0.0016 | 0.1747 | 157.9 | 0.9941 | w≤1.5 | abs>2.0 | buy≥+$20 | drop≤0.25 | alert≥0.95 | floor×1.01 | pop≥30 | ttd[5,90] |
| 0.4521 | 0.0068 | 0.0016 | 0.1747 | 157.9 | 0.9941 | w≤1.5 | abs>2.0 | buy≥+$0 | drop≤0.25 | alert≥0.95 | floor×1.01 | pop≥30 | ttd[5,75] |
| 0.4536 | 0.0082 | 0.0016 | 0.1308 | 187.0 | 0.9891 | w≤1.5 | abs>2.0 | buy≥+$20 | drop≤0.25 | alert≥0.95 | floor×1.01 | pop≥250 | ttd[3,75] |
| 0.4423 | 0.0068 | 0.0018 | 0.1747 | 157.9 | 0.9941 | w≤1.5 | abs>2.0 | buy≥+$10 | drop≤0.25 | alert≥0.95 | floor×1.03 | pop≥50 | ttd[5,75] |
| 0.4423 | 0.0068 | 0.0018 | 0.1747 | 157.9 | 0.9941 | w≤1.5 | abs>2.0 | buy≥+$10 | drop≤0.25 | alert≥0.95 | floor×1.03 | pop≥150 | ttd[5,60] |

### balanced_v2_relaxed

- Feasible: **4350**

**Top feasible candidates:**

| alert_p_05 | buy_share | alert_rate | abstain | regret_p99 | capture_med | cfg_summary |
| --- | --- | --- | --- | --- | --- | --- |
| 0.4525 | 0.0068 | 0.0016 | 0.1747 | 157.9 | 0.9941 | w≤1.5 | abs>2.0 | buy≥+$20 | drop≤0.25 | alert≥0.95 | floor×1.01 | pop≥30 | ttd[5,90] |
| 0.4521 | 0.0068 | 0.0016 | 0.1747 | 157.9 | 0.9941 | w≤1.5 | abs>2.0 | buy≥+$0 | drop≤0.25 | alert≥0.95 | floor×1.01 | pop≥30 | ttd[5,75] |
| 0.4536 | 0.0082 | 0.0016 | 0.1308 | 187.0 | 0.9891 | w≤1.5 | abs>2.0 | buy≥+$20 | drop≤0.25 | alert≥0.95 | floor×1.01 | pop≥250 | ttd[3,75] |
| 0.4423 | 0.0068 | 0.0018 | 0.1747 | 157.9 | 0.9941 | w≤1.5 | abs>2.0 | buy≥+$10 | drop≤0.25 | alert≥0.95 | floor×1.03 | pop≥50 | ttd[5,75] |
| 0.4423 | 0.0068 | 0.0018 | 0.1747 | 157.9 | 0.9941 | w≤1.5 | abs>2.0 | buy≥+$10 | drop≤0.25 | alert≥0.95 | floor×1.03 | pop≥150 | ttd[5,60] |

### safety_plus

- Feasible: **3767**

**Top feasible candidates:**

| alert_p_05 | buy_share | alert_rate | abstain | regret_p99 | capture_med | cfg_summary |
| --- | --- | --- | --- | --- | --- | --- |
| 0.4525 | 0.0068 | 0.0016 | 0.1747 | 157.9 | 0.9941 | w≤1.5 | abs>2.0 | buy≥+$20 | drop≤0.25 | alert≥0.95 | floor×1.01 | pop≥30 | ttd[5,90] |
| 0.4521 | 0.0068 | 0.0016 | 0.1747 | 157.9 | 0.9941 | w≤1.5 | abs>2.0 | buy≥+$0 | drop≤0.25 | alert≥0.95 | floor×1.01 | pop≥30 | ttd[5,75] |
| 0.4423 | 0.0068 | 0.0018 | 0.1747 | 157.9 | 0.9941 | w≤1.5 | abs>2.0 | buy≥+$10 | drop≤0.25 | alert≥0.95 | floor×1.03 | pop≥50 | ttd[5,75] |
| 0.4423 | 0.0068 | 0.0018 | 0.1747 | 157.9 | 0.9941 | w≤1.5 | abs>2.0 | buy≥+$10 | drop≤0.25 | alert≥0.95 | floor×1.03 | pop≥150 | ttd[5,60] |
| 0.4361 | 0.0054 | 0.0018 | 0.2158 | 145.9 | 1.0000 | w≤1.5 | abs>2.0 | buy≥+$20 | drop≤0.25 | alert≥0.95 | floor×1.03 | pop≥100 | ttd[7,60] |

### product_low_abstain_experimental

- Feasible: **4396**

**Top feasible candidates:**

| alert_p_05 | buy_share | alert_rate | abstain | regret_p99 | capture_med | cfg_summary |
| --- | --- | --- | --- | --- | --- | --- |
| 0.4525 | 0.0068 | 0.0016 | 0.1747 | 157.9 | 0.9941 | w≤1.5 | abs>2.0 | buy≥+$20 | drop≤0.25 | alert≥0.95 | floor×1.01 | pop≥30 | ttd[5,90] |
| 0.4521 | 0.0068 | 0.0016 | 0.1747 | 157.9 | 0.9941 | w≤1.5 | abs>2.0 | buy≥+$0 | drop≤0.25 | alert≥0.95 | floor×1.01 | pop≥30 | ttd[5,75] |
| 0.4536 | 0.0082 | 0.0016 | 0.1308 | 187.0 | 0.9891 | w≤1.5 | abs>2.0 | buy≥+$20 | drop≤0.25 | alert≥0.95 | floor×1.01 | pop≥250 | ttd[3,75] |
| 0.4423 | 0.0068 | 0.0018 | 0.1747 | 157.9 | 0.9941 | w≤1.5 | abs>2.0 | buy≥+$10 | drop≤0.25 | alert≥0.95 | floor×1.03 | pop≥50 | ttd[5,75] |
| 0.4423 | 0.0068 | 0.0018 | 0.1747 | 157.9 | 0.9941 | w≤1.5 | abs>2.0 | buy≥+$10 | drop≤0.25 | alert≥0.95 | floor×1.03 | pop≥150 | ttd[5,60] |

## 7. Pareto Frontier Summary

- Non-dominated candidates: 50

**Top 5 Pareto:**

| alert_p_05 | abstain | capture_med | regret_p99 | buy_share | cfg_summary |
| --- | --- | --- | --- | --- | --- |
| 0.4341 | 0.0860 | 0.9629 | 214.1 | 0.0250 | w≤1.5 | abs>2.0 | buy≥+$20 | drop≤0.3 | alert≥0.95 | floor×1.07 | pop≥30 | ttd[1,90] |
| 0.3979 | 0.3047 | 0.9882 | 201.9 | 0.0053 | w≤1.5 | abs>1.25 | buy≥+$10 | drop≤0.2 | alert≥0.95 | floor×1.03 | pop≥150 | ttd[1,45] |
| 0.3563 | 0.1308 | 0.9095 | 228.0 | 0.0078 | w≤1.25 | abs>2.0 | buy≥+$10 | drop≤0.35 | alert≥0.95 | floor×1.05 | pop≥50 | ttd[3,90] |
| 0.3272 | 0.2476 | 0.9437 | 168.0 | 0.0048 | w≤1.5 | abs>2.0 | buy≥+$50 | drop≤0.3 | alert≥0.95 | floor×1.05 | pop≥250 | ttd[7,45] |
| 0.2823 | 0.2158 | 0.9971 | 160.3 | 0.0021 | w≤1.5 | abs>2.0 | buy≥+$35 | drop≤0.2 | alert≥0.95 | floor×1.05 | pop≥250 | ttd[7,90] |

## 8. Recommendation

**Verdict:** PROMOTE_BALANCED_V2_STRICT_CANDIDATE

- Recommended next branch: `b1/v7a-policy-apply-balanced-v2`
- Recommended next action: Apply top balanced_v2_strict candidate to policy.py with regression check.
- Rationale: Found 2336 feasible candidates under strict balanced constraints. Top candidate reduces abstain while maintaining precision >= 0.20 and capture >= 0.85.


## 8.1 Selected Candidate for Next Sprint

This is the candidate copied into `recommendation.selected_candidate_or_null` for the next apply sprint.

**Selected config:**

```json
{
  "abstain_width_over_price": 2.0,
  "alert_drop_threshold": 0.95,
  "alert_near_floor_pct": 1.01,
  "buy_trigger_margin_usd": 20,
  "drop_proba_buy_max": 0.25,
  "max_width_over_price": 1.5,
  "monitor_drop_proba_min": 0.3,
  "monitor_ttd_min": 7,
  "monitor_width_over_price_max": 0.5,
  "route_popularity_min": 30,
  "ttd_lower": 5,
  "ttd_upper": 90
}
```

**Selected metrics:**

| Metric | Value |
| --- | --- |
| `alert_precision_floor_1_05` | 0.45251396648044695 |
| `alert_precision_floor_1_10` | 0.5019952114924182 |
| `alert_recall_floor_1_05` | 0.027719384013688585 |
| `buy_now_share` | 0.006762840392965045 |
| `alert_rate` | 0.00159400281451543 |
| `abstain_share` | 0.174706710151597 |
| `monitor_share` | 0.061199036928843445 |
| `wait_share` | 0.755737409712079 |
| `regret_abs_mean` | 24.753138690058854 |
| `regret_abs_p90` | 73.9919921875 |
| `regret_abs_p99` | 157.94800537109373 |
| `capture_median` | 0.9941211054431625 |
| `trajectory_buy_coverage` | 0.06751854905193734 |
| `false_buy_now_rate` | 0.363905325443787 |

## 9. Limitations and Non-Goals

- No retraining was done.
- No Modal run was done.
- No app/payment/cloud/Largo code was touched.
- AUTO_BUY remains disabled — never emitted.
- MONITOR parameters are now parameterized (v1 used hardcoded 0.40/14/0.75).
- Pareto computed on top-2000 candidates (not full set) for runtime.
- This does not make the system production-ready.
- Any candidate must be applied in a separate PR with a regression check.

- No policy.py modification in this sprint.
- No production deployment.
- No auto-buy enablement.
- No cloud/Modal execution.
- No model retraining or fine-tuning.
- No app UI changes.
