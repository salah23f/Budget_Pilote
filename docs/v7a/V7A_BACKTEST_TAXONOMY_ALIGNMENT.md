# V7a Backtest Taxonomy Alignment

> **Sprint:** `b1/v7a-backtest-taxonomy-alignment`
> **Date:** 2026-05-10
> **Status:** Measurement alignment only. NOT production-ready.

## 1. Purpose

Align `scripts/train/v7a/backtest.py` evaluation metrics with the current V7a policy action taxonomy. The policy now emits `ALERT` and `MONITOR` but backtest was still filtering on the legacy `ALERT_SOFT` / `ALERT_STRONG` actions.

## 2. Previous Issue

`backtest.py` line 247 filtered alerts as:
```python
df["v7a_action"].isin({"ALERT_SOFT", "ALERT_STRONG"})
```

Since `policy.py` now returns `ALERT` (unified) and `MONITOR` (new), the backtest was finding zero alerts and reporting empty metrics.

Similarly, recall computation included `AUTO_BUY` in the actionable set, which is no longer emitted.

## 3. Current Action Taxonomy

| Action | Description |
| --- | --- |
| `ABSTAIN` | Insufficient data quality / confidence |
| `BUY_NOW` | Buy trigger fired, low drop probability |
| `ALERT` | High drop probability, price near floor |
| `MONITOR` | Moderate drop probability, observe |
| `WAIT` | Default, no trigger |
| `AUTO_BUY` | **Never emitted** (Phase 1 hard-lock) |

## 4. Backtest Metric Semantics

- **alert_precision**: among rows where action == `ALERT`, % with price <= floor × margin.
- **alert_recall**: among rows near floor (price <= floor × 1.05), % where action ∈ {`ALERT`, `BUY_NOW`}. This matches `policy_tune.py` semantics where both ALERT and BUY_NOW count as actionable signals.
- **regret/capture**: per-trajectory, based on first `BUY_NOW` row if present; otherwise the existing backtest fallback uses the last observed price.
- **MONITOR**: tracked separately, not included in alert precision.

## 5. ALERT Metrics

| Metric | Definition |
| --- | --- |
| `n_alerts` | count of rows with action == `ALERT` |
| `alert_rate` | n_alerts / total_rows |
| `alert_precision_floor_1_05` | % ALERT rows with price <= floor × 1.05 |
| `alert_precision_floor_1_10` | % ALERT rows with price <= floor × 1.10 |
| `alert_recall_floor_1_05` | % near-floor rows with action ∈ {ALERT, BUY_NOW} |
| `regret_realized_after_alert_mean` | mean(price_alert − floor) for ALERT rows |

Legacy fields `n_strong`, `n_soft`, `alert_precision_floor_1_05_strong` are set to 0 for back-compat.

## 6. MONITOR Metrics

| Metric | Definition |
| --- | --- |
| `n_monitor` | count of rows with action == `MONITOR` |
| `monitor_rate` | n_monitor / total_rows |
| `monitor_share` | same as monitor_rate |
| `monitor_drop_proba_mean` | mean drop_proba for MONITOR rows |
| `monitor_near_floor_1_05_rate` | % MONITOR rows with price <= floor × 1.05 |

MONITOR is tracked separately and does NOT contribute to alert precision.

## 7. AUTO_BUY Safety Diagnostic

Each variant report now includes:
```json
"auto_buy_safety": {
  "auto_buy_emitted_count": 0,
  "auto_buy_emitted": false
}
```

If `AUTO_BUY` is ever emitted (which it should not be), a warning is logged:
```json
"warning": "AUTO_BUY emitted N times — this should NOT happen in Phase 1."
```

## 8. Validation Commands

```bash
python3 -m py_compile scripts/train/v7a/backtest.py
python3 scripts/train/v7a/backtest.py
python3 -m json.tool reports/v7a_backtest_local.json | head -160
python3 -m json.tool reports/v7a_segmented_metrics_local.json | head -160
```


## Metric Semantics Note

The taxonomy alignment changes which actions are counted, but it does not make every backtest metric numerically identical to the sweep/regression metrics.

- `policy_tune.py` and `policy_regression_check.py` compute `alert_precision_floor_1_05` on `ALERT | BUY_NOW` rows.
- `backtest.py` reports pure `ALERT` precision for alert-only rows, while recall counts `ALERT | BUY_NOW` as actionable near-floor signals.
- Therefore `reports/v7a_backtest_local.json` can show a much lower alert precision than `reports/v7a_policy_balanced_v2_regression_local.json` without implying an action mismatch.
- `backtest.py` also keeps its existing no-BUY trajectory fallback, while the sweep/regression metrics focus on first-BUY trajectories.

This sprint aligns the action taxonomy and safety diagnostics. It does not redefine every historical backtest metric.

## 9. Limitations

- No retraining was done.
- No Modal run was done.
- No app/payment/Largo/cloud/Supabase code was touched.
- AUTO_BUY remains disabled.
- This does not make the system production-ready.
- This only aligns measurement with the current policy taxonomy.
- Legacy fields (`n_strong`, `n_soft`) are kept at 0 for JSON schema compat.
- The `hybrid_mode` variant still passes `hybrid_mode=True` to `classify()`, but this field is a legacy no-op in the current policy.
- `_segment_metrics` calls `_eval_alert` per segment which now uses the updated taxonomy.

## 10. Next Steps

- Run backtest and verify non-zero alert metrics with the current Balanced V2 policy.
- Compare backtest metrics against regression check expectations.
- Future: remove legacy `n_strong`/`n_soft` fields once downstream consumers are updated.
- Future: evaluate whether `hybrid_mode` variant is still meaningful with the new policy.
