#!/usr/bin/env python3
"""
v7a/policy_regression_check.py — regression check for Balanced V2 policy.

Verifies that policy.py classify() reproduces the vectorized sweep logic
from policy_sweep_v2._classify_v2() on the same test dataset.

Usage:
  python3 scripts/train/v7a/policy_regression_check.py

Writes: reports/v7a_policy_balanced_v2_regression_local.json
Exit 0 on success, non-zero on failure.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).parent))

from policy import PolicyContext, classify, decision_to_dict  # noqa: E402
from policy_tune import (  # noqa: E402
    _build_arrays,
    _eval_candidate,
    _load_true_sweep_inputs,
    map_aliases,
    probe_artifacts,
)
from policy_sweep_v2 import _classify_v2  # noqa: E402

# =============================================================================
# Config — Balanced V2 strict (from sweep v2 recommendation)
# =============================================================================

SWEEP_V2_REPORT = REPO_ROOT / "reports" / "v7a_policy_sweep_v2_local.json"

BALANCED_V2_CFG = {
    "max_width_over_price": 1.5,
    "abstain_width_over_price": 2.0,
    "buy_trigger_margin_usd": 20,
    "drop_proba_buy_max": 0.25,
    "alert_drop_threshold": 0.95,
    "alert_near_floor_pct": 1.01,
    "route_popularity_min": 30,
    "ttd_lower": 5,
    "ttd_upper": 90,
    "monitor_drop_proba_min": 0.30,
    "monitor_ttd_min": 7,
    "monitor_width_over_price_max": 0.50,
}

EXPECTED_METRICS = {
    "alert_precision_floor_1_05": 0.45251396648044695,
    "alert_precision_floor_1_10": 0.5019952114924182,
    "alert_recall_floor_1_05": 0.027719384013688585,
    "buy_now_share": 0.006762840392965045,
    "alert_rate": 0.00159400281451543,
    "abstain_share": 0.174706710151597,
    "regret_abs_mean": 24.753138690058854,
    "regret_abs_p90": 73.9919921875,
    "regret_abs_p99": 157.94800537109373,
    "capture_median": 0.9941211054431625,
}

MATCH_RATE_MIN = 0.995

OUT_JSON = REPO_ROOT / "reports" / "v7a_policy_balanced_v2_regression_local.json"


# =============================================================================
# Helpers
# =============================================================================

def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def fail(report: dict) -> None:
    report["status"] = "failed"
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    print(f"FAILED — see {OUT_JSON}", file=sys.stderr)
    sys.exit(1)


# =============================================================================
# Main
# =============================================================================

def main() -> None:
    import numpy as np  # type: ignore

    report: dict = {
        "status": "running",
        "generated_at": now_iso(),
        "branch_expected": "b1/v7a-policy-apply-balanced-v2",
        "selected_profile": "balanced_v2_strict",
        "source_report": "reports/v7a_policy_sweep_v2_local.json",
        "config": BALANCED_V2_CFG,
    }

    # --- Validate sweep v2 report exists and matches ---
    if SWEEP_V2_REPORT.exists():
        sweep_data = json.loads(SWEEP_V2_REPORT.read_text(encoding="utf-8"))
        rec = sweep_data.get("recommendation", {})
        if rec.get("verdict") != "PROMOTE_BALANCED_V2_STRICT_CANDIDATE":
            report["warning"] = (
                f"sweep v2 verdict is '{rec.get('verdict')}', "
                "expected PROMOTE_BALANCED_V2_STRICT_CANDIDATE"
            )
    else:
        report["warning"] = "sweep v2 report not found; using hardcoded config"

    # --- Load artifacts via policy_tune infrastructure ---
    _checked, found = probe_artifacts()
    required_keys = [
        "predictions_test_parquet",
        "features_test_parquet",
        "conformal_json",
    ]
    for k in required_keys:
        if k not in found:
            report["error"] = f"missing artifact: {k}"
            fail(report)

    df_pred, df_feat, mondrian, df_train_q10 = _load_true_sweep_inputs(found)

    if len(df_pred) != len(df_feat):
        report["error"] = f"row count mismatch pred={len(df_pred)} feat={len(df_feat)}"
        fail(report)

    n = len(df_pred)
    report["n_rows"] = n

    # Map columns
    pred_cols = list(df_pred.columns)
    feat_cols = list(df_feat.columns)
    pred_map = map_aliases(pred_cols)
    feat_map = map_aliases(feat_cols)

    # Build arrays (same as policy_tune)
    arr = _build_arrays(df_pred, df_feat, mondrian, df_train_q10, pred_map, feat_map)

    # --- Expected actions via vectorized logic (sweep v2 classifier) ---
    expected_actions = _classify_v2(arr, BALANCED_V2_CFG)

    # --- Actual actions via policy.classify() ---
    actual_actions_list: list[str] = []
    actual_reasons_list: list[list[str]] = []

    for i in range(n):
        ctx = PolicyContext(
            price=float(arr["price"][i]),
            q10_gain=float(arr["q10_gain"][i]) if not np.isnan(arr["q10_gain"][i]) else 0.0,
            q50_gain=float(arr["q50_gain"][i]),
            q90_gain=float(arr["q90_gain"][i]),
            c_alpha_gain=float(arr["c_alpha"][i]),
            drop_proba=float(arr["drop_proba"][i]),
            ttd_days=float(arr["ttd"][i]),
            route_known=bool(arr["route_known"][i]),
            route_popularity=int(arr["route_popularity"][i]),
            budget_max=1e6,
            budget_autobuy=1e6,
            autobuy_enabled=False,
            q10_train_route=float(arr["q10_train_route"][i]),
            hybrid_mode=False,
        )
        dec = classify(ctx)
        actual_actions_list.append(dec.action)
        actual_reasons_list.append(dec.reason)

    actual_actions = np.array(actual_actions_list, dtype=object)

    # --- Action comparison ---
    mismatches_mask = actual_actions != expected_actions
    n_mismatch = int(mismatches_mask.sum())
    match_rate = 1.0 - n_mismatch / n

    first_10: list[dict] = []
    mismatch_indices = np.where(mismatches_mask)[0][:10]
    for idx in mismatch_indices:
        first_10.append({
            "row_index": int(idx),
            "route": str(arr["route"][idx]),
            "fetched_at": str(df_pred.iloc[idx].get("fetched_at", "N/A")) if "fetched_at" in df_pred.columns else "N/A",
            "depart_date": str(arr["depart_date"][idx]),
            "price": float(arr["price"][idx]),
            "ttd": float(arr["ttd"][idx]),
            "route_popularity": int(arr["route_popularity"][idx]),
            "route_known": bool(arr["route_known"][idx]),
            "q50_gain": float(arr["q50_gain"][idx]),
            "c_alpha": float(arr["c_alpha"][idx]),
            "width_over_price": float(arr["width_over_price"][idx]),
            "drop_proba": float(arr["drop_proba"][idx]),
            "q10_train_route": float(arr["q10_train_route"][idx]),
            "expected_action": str(expected_actions[idx]),
            "actual_action": str(actual_actions[idx]),
            "actual_reason": actual_reasons_list[idx],
        })

    report["action_match"] = {
        "match_rate": match_rate,
        "n_mismatch": n_mismatch,
        "first_10_mismatches": first_10,
    }

    # Action distributions
    def _dist(actions):
        unique, counts = np.unique(actions, return_counts=True)
        return {str(u): int(c) for u, c in zip(unique, counts)}

    report["actual_action_distribution"] = _dist(actual_actions)
    report["expected_action_distribution"] = _dist(expected_actions)

    if match_rate < MATCH_RATE_MIN:
        report["error"] = f"match_rate={match_rate:.6f} < {MATCH_RATE_MIN}"
        fail(report)

    # Check no AUTO_BUY emitted
    if "AUTO_BUY" in report["actual_action_distribution"]:
        report["error"] = "AUTO_BUY emitted by policy.classify()"
        fail(report)

    # --- Metrics comparison ---
    actual_metrics = _eval_candidate(arr, actual_actions, BALANCED_V2_CFG)
    report["actual_metrics"] = actual_metrics
    report["expected_reference_metrics"] = EXPECTED_METRICS

    metric_checks: dict[str, dict] = {}
    any_metric_fail = False

    for key, expected_val in EXPECTED_METRICS.items():
        actual_val = actual_metrics.get(key)
        if actual_val is None:
            metric_checks[key] = {"status": "missing", "expected": expected_val}
            any_metric_fail = True
            continue

        # Determine tolerance
        if key in ("regret_abs_mean", "regret_abs_p90", "regret_abs_p99"):
            # Relative tolerance for dollar metrics
            tol_abs = max(abs(expected_val) * 0.025, 1.0)
        else:
            # Absolute tolerance for proportions
            tol_abs = 0.005

        diff = abs(float(actual_val) - expected_val)
        passed = diff <= tol_abs
        metric_checks[key] = {
            "expected": expected_val,
            "actual": float(actual_val),
            "diff": diff,
            "tolerance": tol_abs,
            "passed": passed,
        }
        if not passed:
            any_metric_fail = True

    report["metric_checks"] = metric_checks

    if any_metric_fail:
        report["error"] = "one or more aggregate metrics outside tolerance"
        fail(report)

    # --- Success ---
    report["status"] = "ok"
    report["limitations"] = [
        "budget_max forced to 1e6 to neutralize budget gate (sweep has no budget gate).",
        "backtest.py still uses legacy ALERT_SOFT/ALERT_STRONG counters — not edited.",
        "preference_match defaulted to 1.0 for all rows.",
        "MONITOR params are now parameterized (differs from policy_tune hardcoded defaults).",
    ]
    report["auto_buy"] = {
        "enabled_in_regression_context": False,
        "emitted_count": 0,
        "note": "AUTO_BUY remains disabled in Phase 1.",
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    print(f"OK — match_rate={match_rate:.6f}, all metrics pass. Report: {OUT_JSON}", file=sys.stderr)
    sys.exit(0)


if __name__ == "__main__":
    main()
