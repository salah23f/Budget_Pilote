# V7a Policy Applied — Profile A (Safety-first)

> **Sprint:** `b1/v7a-policy-apply-candidate`
> **Date:** 2026-05-10
> **Status:** Advisory / shadow-compatible only. NOT production-ready.

## 1. Purpose

Apply the selected V7a policy candidate (Profile A / Safety-first) to `scripts/train/v7a/policy.py` and verify it reproduces the offline sweep metrics within tolerance.

## 2. Source Decision

- Decision document: `docs/v7a/V7A_POLICY_SELECTION_DECISION.md`
- Selection report: `reports/v7a_policy_selection_local.json`
- Sweep source: `reports/v7a_policy_tuning_local.json` (mode: `true_row_level_sweep`)

## 3. Applied Candidate

**Profile A — Safety-first** (top candidate from 36 feasible in pool of 170).

Intent: Maximize alert_precision_floor_1_05; minimize false/noisy actions; ABSTAIN may be high if needed.

## 4. Thresholds Applied

| Parameter | Value |
| --- | --- |
| `MAX_WIDTH_OVER_PRICE` | 1.00 |
| `ABSTAIN_WIDTH_OVER_PRICE` | 1.00 |
| `BUY_TRIGGER_MARGIN_USD` | 0.0 |
| `DROP_PROBA_BUY_MAX` | 0.40 |
| `ALERT_DROP_THRESHOLD` | 0.85 |
| `ALERT_NEAR_FLOOR_PCT` | 1.03 |
| `ROUTE_POPULARITY_MIN` | 30 |
| `TTD_LOWER` | 1 |
| `TTD_UPPER` | 60 |

MONITOR band: `drop_proba ∈ [0.40, 0.85)`, `ttd >= 14`, `width_over_price <= 0.75`.

## 5. Policy Semantics

Action order (mirrors `policy_tune._classify_candidate`):

1. **ABSTAIN** — route unknown, width too wide, low popularity, TTD out of range.
2. **BUY_NOW** — buy trigger passes, drop probability low, width OK, within budget.
3. **ALERT** — high drop probability, price near floor, width OK.
4. **MONITOR** — moderate drop probability band, sufficient TTD, tight width.
5. **WAIT** — default.

Alpha(ttd) damping: `α = 1.0` if ttd ≤ 21, else `0.3`.

## 6. AUTO_BUY Phase-1 Lock

- `classify()` **never** returns `AUTO_BUY`.
- `autobuy_enabled` and `budget_autobuy` fields are preserved in `PolicyContext` for back-compat but have no effect.
- `score_autobuy` is always `0.0`.
- This does **not** enable real auto-buy. Phase 1 remains advisory-only.

## 7. Regression Check

Run:
```bash
python3 scripts/train/v7a/policy_regression_check.py
```

Report written to: `reports/v7a_policy_regression_local.json`

The check verifies:
- Row-by-row action match rate ≥ 0.995 vs vectorized `_classify_candidate`.
- No `AUTO_BUY` emitted.
- Aggregate metrics within tolerance of expected Profile-A values.
- Budget gate neutralized (`budget_max=1e6`) for fair comparison.

## 8. Expected Metrics

| Metric | Expected |
| --- | --- |
| `alert_precision_floor_1_05` | 0.2072 |
| `alert_precision_floor_1_10` | 0.2333 |
| `alert_recall_floor_1_05` | 0.0349 |
| `buy_now_share` | 0.0115 |
| `alert_rate` | 0.0115 |
| `abstain_share` | 0.4043 |
| `regret_abs_mean` | 64.77 |
| `regret_abs_p90` | 172.0 |
| `regret_abs_p99` | 278.6 |
| `capture_median` | 0.8716 |

## 9. Remaining Limitations

- `backtest.py` still uses legacy `ALERT_SOFT` / `ALERT_STRONG` alert counters. It was not edited in this sprint (parallel finding only).
- `abstain_share` is ~40% — inherent to V7a's wide conformal intervals at α=0.10.
- This policy is shadow/advisory only. It does not make the system production-ready.
- `preference_match` is not used in decision logic (retained for interface compat).
- `hybrid_mode` is retained for back-compat but has no effect on the new logic.

## 10. Allowed Next Steps

- Run the regression check and confirm `status: "ok"`.
- Open PR for review on `b1/v7a-policy-apply-candidate`.
- Future sprint: align `backtest.py` actions with the new ALERT/MONITOR taxonomy.
- Future sprint: evaluate Profile D (shadow-mode learning) for lower abstain rate.
- AUTO_BUY enablement requires a separate, gated sprint with explicit approval.
