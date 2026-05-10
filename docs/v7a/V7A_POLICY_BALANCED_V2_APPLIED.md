# V7a Policy Applied — Balanced V2 (strict)

> **Sprint:** `b1/v7a-policy-apply-balanced-v2`
> **Date:** 2026-05-10
> **Status:** Advisory / shadow-compatible only. NOT production-ready.

## 1. Purpose

Apply the selected Balanced V2 strict policy candidate to `scripts/train/v7a/policy.py` and verify it reproduces the sweep V2 metrics within tolerance.

This candidate significantly reduces abstain_share while improving alert precision, regret, and capture versus the prior Profile A.

## 2. Source Decision

- Sweep V2 report: `reports/v7a_policy_sweep_v2_local.json`
- Sweep V2 results: `docs/v7a/V7A_POLICY_SWEEP_V2_RESULTS.md`
- Sweep V2 verdict: `PROMOTE_BALANCED_V2_STRICT_CANDIDATE`
- Prior profile: Profile A from `docs/v7a/V7A_POLICY_APPLIED.md`

## 3. Applied Balanced V2 Candidate

**Profile: balanced_v2_strict** — top candidate from the sweep V2 feasible set.

Goal: reduce abstain_share while maintaining alert precision >= 0.20 and capture >= 0.85.

## 4. Thresholds Applied

| Parameter | Balanced V2 | Previous (Profile A) |
| --- | --- | --- |
| `MAX_WIDTH_OVER_PRICE` | 1.50 | 1.00 |
| `ABSTAIN_WIDTH_OVER_PRICE` | 2.00 | 1.00 |
| `BUY_TRIGGER_MARGIN_USD` | 20.0 | 0.0 |
| `DROP_PROBA_BUY_MAX` | 0.25 | 0.40 |
| `ALERT_DROP_THRESHOLD` | 0.95 | 0.85 |
| `ALERT_NEAR_FLOOR_PCT` | 1.01 | 1.03 |
| `ROUTE_POPULARITY_MIN` | 30 | 30 |
| `TTD_LOWER` | 5 | 1 |
| `TTD_UPPER` | 90 | 60 |
| `MONITOR_DROP_PROBA_MIN` | 0.30 | 0.40 |
| `MONITOR_TTD_MIN` | 7 | 14 |
| `MONITOR_WIDTH_OVER_PRICE_MAX` | 0.50 | 0.75 |

Key changes:
- `ABSTAIN_WIDTH_OVER_PRICE` doubled from 1.0 → 2.0 (main abstain reducer)
- `BUY_TRIGGER_MARGIN_USD` raised to +$20 (reduces false buys)
- `DROP_PROBA_BUY_MAX` tightened from 0.40 → 0.25 (stricter buy gate)
- `ALERT_DROP_THRESHOLD` raised from 0.85 → 0.95 (fewer but higher precision alerts)
- `TTD_UPPER` extended to 90 days (accepts longer horizon observations)

## 5. Policy Semantics

Action order (same as prior):

1. **ABSTAIN** — route unknown, width > 2.0, low popularity, TTD outside [5, 90].
2. **BUY_NOW** — trigger >= +$20, drop_proba <= 0.25, width <= 1.5, within budget.
3. **ALERT** — drop_proba >= 0.95, price near floor (×1.01), width <= 1.5.
4. **MONITOR** — drop_proba ∈ [0.30, 0.95), TTD >= 7, width <= 0.50.
5. **WAIT** — default.

Alpha(ttd) damping: `α = 1.0` if ttd ≤ 21, else `0.3`.

## 6. Regression Check

Run:
```bash
python3 scripts/train/v7a/policy_regression_check.py
```

Report: `reports/v7a_policy_balanced_v2_regression_local.json`

Verifies:
- Row-by-row action match rate >= 0.995 vs vectorized `_classify_v2`.
- No `AUTO_BUY` emitted.
- Aggregate metrics within tolerance.
- Budget gate neutralized (`budget_max=1e6`).

## 7. Metrics Compared to Profile A

| Metric | Balanced V2 | Profile A | Change |
| --- | --- | --- | --- |
| `alert_precision_floor_1_05` | **0.4525** | 0.2072 | +118% |
| `alert_precision_floor_1_10` | **0.5020** | 0.2333 | +115% |
| `alert_recall_floor_1_05` | 0.0277 | 0.0349 | −21% |
| `buy_now_share` | **0.0068** | 0.0115 | −41% |
| `alert_rate` | 0.0016 | 0.0115 | −86% |
| `abstain_share` | **0.1747** | 0.4043 | −57% |
| `regret_abs_mean` | **24.75** | 64.77 | −62% |
| `regret_abs_p90` | **74.0** | 172.0 | −57% |
| `regret_abs_p99` | **157.9** | 278.6 | −43% |
| `capture_median` | **0.9941** | 0.8716 | +14% |
| `trajectory_buy_coverage` | 0.0675 | — | low |
| `false_buy_now_rate` | 0.3639 | — | non-zero |

Key improvements: precision doubled, abstain halved, regret halved, capture near-perfect.

Key tradeoffs: alert_rate very low (~0.16%), trajectory_buy_coverage only ~6.8%, false_buy_now_rate ~36%.

## 8. Safety and AUTO_BUY Lock

- `classify()` **never** returns `AUTO_BUY`.
- `autobuy_enabled` and `budget_autobuy` fields preserved for back-compat, no effect.
- `score_autobuy` is always `0.0`.
- This does **not** enable real auto-buy.
- This is **not** production-ready.
- No retraining was done.
- No Modal run was done.
- No app/payment/Largo/cloud code was touched.

## 9. Limitations

- **alert_rate is very low** (~0.16%): the 0.95 drop threshold + 1.01 floor pct combination is very selective.
- **trajectory_buy_coverage is low** (~6.8%): only 6.8% of trajectories have at least one BUY_NOW row.
- **false_buy_now_rate is non-zero** (~36.4%): among BUY rows, 36% had a future price > $20 below the buy price.
- `backtest.py` still uses legacy `ALERT_SOFT`/`ALERT_STRONG` counters (not edited).
- MONITOR parameters differ from the hardcoded values in `policy_tune._classify_candidate` (0.40/14/0.75 vs now 0.30/7/0.50).
- This policy is shadow/advisory only and requires further shadow-mode validation.

## 10. Next Steps

- Run regression check and confirm `status: "ok"`.
- Open PR for review on `b1/v7a-policy-apply-balanced-v2`.
- Shadow-mode validation: deploy advisory and monitor real alert/buy behavior.
- Future sprint: align `backtest.py` with new ALERT/MONITOR taxonomy.
- Future sprint: investigate reducing `false_buy_now_rate` via tighter buy gates or model improvement.
- Future sprint: evaluate intermediate candidates if alert_rate is too low for product needs.
- AUTO_BUY enablement requires a separate, gated sprint with explicit approval.
