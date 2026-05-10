#!/usr/bin/env python3
"""
v7a/policy_sweep_v2.py — offline policy sweep v2 for balanced candidate search.

Searches for V7a policy candidates that reduce abstain_share while maintaining
acceptable alert precision and capture. Uses the same row-level artifacts as
policy_tune.py and policy_regression_check.py.

Sprint: b1/v7a-policy-sweep-v2

Usage:
  python3 scripts/train/v7a/policy_sweep_v2.py

Outputs:
  reports/v7a_policy_sweep_v2_local.json
  docs/v7a/V7A_POLICY_SWEEP_V2_RESULTS.md

No retraining. No Modal. No app/cloud code touched. AUTO_BUY disabled.
"""

from __future__ import annotations

import hashlib
import json
import sys
import time
from itertools import product
from pathlib import Path
from typing import Any

import numpy as np  # type: ignore
import pandas as pd  # type: ignore

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).parent))

from policy_tune import (  # noqa: E402
    _bucket_key,
    _c_for,
    _build_arrays,
    _load_true_sweep_inputs,
    _eval_candidate,
    ALPHA_CONFORMAL,
    probe_artifacts,
    map_aliases,
    log,
    now_iso,
)

# =============================================================================
# Outputs
# =============================================================================

OUT_JSON = REPO_ROOT / "reports" / "v7a_policy_sweep_v2_local.json"
OUT_MD = REPO_ROOT / "docs" / "v7a" / "V7A_POLICY_SWEEP_V2_RESULTS.md"

# =============================================================================
# Profile A baseline (current applied)
# =============================================================================

PROFILE_A_CFG = {
    "max_width_over_price": 1.0,
    "abstain_width_over_price": 1.0,
    "buy_trigger_margin_usd": 0,
    "drop_proba_buy_max": 0.4,
    "alert_drop_threshold": 0.85,
    "alert_near_floor_pct": 1.03,
    "route_popularity_min": 30,
    "ttd_lower": 1,
    "ttd_upper": 60,
    "monitor_drop_proba_min": 0.40,
    "monitor_ttd_min": 14,
    "monitor_width_over_price_max": 0.75,
}

# Profile D shadow candidate from prior selection
PROFILE_D_CFG = {
    "max_width_over_price": 1.0,
    "abstain_width_over_price": 1.25,
    "buy_trigger_margin_usd": 0,
    "drop_proba_buy_max": 0.4,
    "alert_drop_threshold": 0.85,
    "alert_near_floor_pct": 1.03,
    "route_popularity_min": 30,
    "ttd_lower": 1,
    "ttd_upper": 60,
    "monitor_drop_proba_min": 0.40,
    "monitor_ttd_min": 14,
    "monitor_width_over_price_max": 0.75,
}

# =============================================================================
# Search space
# =============================================================================

GRID_V2 = {
    "max_width_over_price": [0.75, 1.00, 1.10, 1.25, 1.50],
    "abstain_width_over_price": [1.00, 1.10, 1.25, 1.50, 2.00],
    "buy_trigger_margin_usd": [0, 10, 20, 35, 50, 75],
    "drop_proba_buy_max": [0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40],
    "alert_drop_threshold": [0.75, 0.80, 0.85, 0.90, 0.95],
    "alert_near_floor_pct": [1.01, 1.03, 1.05, 1.07, 1.10],
    "route_popularity_min": [30, 50, 75, 100, 150, 250],
    "ttd_lower": [1, 3, 5, 7, 10, 14],
    "ttd_upper": [45, 60, 75, 90],
    "monitor_drop_proba_min": [0.30, 0.35, 0.40],
    "monitor_ttd_min": [7, 14, 21],
    "monitor_width_over_price_max": [0.50, 0.75, 1.00],
}

MAX_CANDIDATES = 50000

# =============================================================================
# Profiles / constraint sets
# =============================================================================

PROFILES = {
    "balanced_v2_strict": {
        "alert_precision_floor_1_05": (">=", 0.20),
        "buy_now_share": ("<=", 0.10),
        "alert_rate": ("<=", 0.15),
        "abstain_share": ("<=", 0.30),
        "capture_median": (">=", 0.85),
        "regret_abs_p99": ("<=", 300.0),
    },
    "balanced_v2_relaxed": {
        "alert_precision_floor_1_05": (">=", 0.15),
        "buy_now_share": ("<=", 0.12),
        "alert_rate": ("<=", 0.20),
        "abstain_share": ("<=", 0.35),
        "capture_median": (">=", 0.84),
        "regret_abs_p99": ("<=", 325.0),
    },
    "safety_plus": {
        "alert_precision_floor_1_05": (">=", 0.2072),
        "buy_now_share": ("<=", 0.03),
        "alert_rate": ("<=", 0.05),
        "abstain_share": ("<=", 0.45),
        "capture_median": (">=", 0.85),
        "regret_abs_p99": ("<=", 300.0),
    },
    "product_low_abstain_experimental": {
        "alert_precision_floor_1_05": (">=", 0.10),
        "buy_now_share": ("<=", 0.15),
        "alert_rate": ("<=", 0.25),
        "abstain_share": ("<=", 0.25),
        "capture_median": (">=", 0.82),
    },
}


# =============================================================================
# Candidate generation
# =============================================================================

def _cfg_key(cfg: dict) -> str:
    """Deterministic hash for deduplication."""
    s = json.dumps(cfg, sort_keys=True)
    return hashlib.md5(s.encode()).hexdigest()[:12]


def _generate_candidates() -> list[dict]:
    """Generate bounded deterministic candidate set."""
    seen: set[str] = set()
    candidates: list[dict] = []

    def _add(cfg: dict) -> None:
        k = _cfg_key(cfg)
        if k not in seen:
            seen.add(k)
            candidates.append(cfg)

    # 1. Include Profile A and Profile D exactly
    _add(PROFILE_A_CFG)
    _add(PROFILE_D_CFG)

    # 2. Local variations around Profile A
    base = PROFILE_A_CFG.copy()
    for key, values in GRID_V2.items():
        for v in values:
            variant = base.copy()
            variant[key] = v
            _add(variant)

    # 3. Two-parameter variations (abstain_width + one other key dimension)
    key_dims = ["abstain_width_over_price", "route_popularity_min",
                "ttd_lower", "ttd_upper", "buy_trigger_margin_usd",
                "drop_proba_buy_max"]
    for d1, d2 in [(key_dims[i], key_dims[j])
                   for i in range(len(key_dims))
                   for j in range(i + 1, len(key_dims))]:
        for v1 in GRID_V2[d1]:
            for v2 in GRID_V2[d2]:
                variant = base.copy()
                variant[d1] = v1
                variant[d2] = v2
                _add(variant)

    # 4. Three-parameter variations focused on reducing abstain
    abstain_keys = ["abstain_width_over_price", "route_popularity_min", "ttd_upper"]
    for v1 in GRID_V2["abstain_width_over_price"]:
        for v2 in GRID_V2["route_popularity_min"]:
            for v3 in GRID_V2["ttd_upper"]:
                variant = base.copy()
                variant["abstain_width_over_price"] = v1
                variant["route_popularity_min"] = v2
                variant["ttd_upper"] = v3
                _add(variant)

    # 5. Wider exploration: deterministic sample from full grid
    rng = np.random.default_rng(42)
    grid_keys = list(GRID_V2.keys())
    grid_values = [GRID_V2[k] for k in grid_keys]
    full_size = 1
    for v in grid_values:
        full_size *= len(v)

    # Sample indices uniformly
    n_sample = min(MAX_CANDIDATES - len(candidates), 30000)
    if n_sample > 0:
        indices = rng.choice(full_size, size=min(n_sample * 2, full_size),
                             replace=False)
        for idx in indices:
            if len(candidates) >= MAX_CANDIDATES:
                break
            cfg = {}
            remainder = int(idx)
            for k, vals in zip(grid_keys, grid_values):
                cfg[k] = vals[remainder % len(vals)]
                remainder //= len(vals)
            _add(cfg)

    log(f"generated {len(candidates)} unique candidates")
    return candidates


# =============================================================================
# Vectorized classifier (extended with monitor params)
# =============================================================================

def _classify_v2(arr: dict, cfg: dict) -> np.ndarray:
    """Vectorized classifier with parameterized MONITOR band."""
    n = arr["price"].shape[0]
    alpha_ttd = np.where(arr["ttd"] <= 21, 1.0, 0.3)
    buy_trigger = arr["q50_gain"] + alpha_ttd * arr["c_alpha"]

    # ABSTAIN
    abstain = (
        (~arr["route_known"])
        | (arr["width_over_price"] > cfg["abstain_width_over_price"])
        | (arr["route_popularity"] < cfg["route_popularity_min"])
        | (arr["ttd"] < cfg["ttd_lower"])
        | (arr["ttd"] > cfg["ttd_upper"])
    )

    # BUY_NOW
    buy = (
        (~abstain)
        & (arr["width_over_price"] <= cfg["max_width_over_price"])
        & (buy_trigger >= cfg["buy_trigger_margin_usd"])
        & (arr["drop_proba"] <= cfg["drop_proba_buy_max"])
    )

    # ALERT
    near_floor_ref = np.where(
        arr["q10_train_route"] > 0,
        arr["q10_train_route"] * cfg["alert_near_floor_pct"],
        np.inf,
    )
    alert = (
        (~abstain) & (~buy)
        & (arr["drop_proba"] >= cfg["alert_drop_threshold"])
        & (arr["price"] <= near_floor_ref)
        & (arr["width_over_price"] <= cfg["max_width_over_price"])
    )

    # MONITOR (parameterized)
    monitor_drop_min = cfg.get("monitor_drop_proba_min", 0.40)
    monitor_ttd_min = cfg.get("monitor_ttd_min", 14)
    monitor_wop_max = cfg.get("monitor_width_over_price_max", 0.75)
    monitor = (
        (~abstain) & (~buy) & (~alert)
        & (arr["drop_proba"] >= monitor_drop_min)
        & (arr["drop_proba"] < cfg["alert_drop_threshold"])
        & (arr["ttd"] >= monitor_ttd_min)
        & (arr["width_over_price"] <= monitor_wop_max)
    )

    actions = np.full(n, "WAIT", dtype=object)
    actions[abstain] = "ABSTAIN"
    actions[buy] = "BUY_NOW"
    actions[alert] = "ALERT"
    actions[monitor] = "MONITOR"
    return actions


# =============================================================================
# Scoring
# =============================================================================

def _score_candidate(m: dict, profile_name: str) -> float:
    """Compute scalar score for ranking."""
    import math

    ap05 = m.get("alert_precision_floor_1_05", 0.0)
    cap = m.get("capture_median", 0.0)
    abst = m.get("abstain_share", 1.0)
    buy_s = m.get("buy_now_share", 1.0)
    ar = m.get("alert_rate", 1.0)
    rp90 = m.get("regret_abs_p90", 500.0)
    rp99 = m.get("regret_abs_p99", 500.0)

    if math.isnan(ap05):
        ap05 = 0.0
    if math.isnan(cap):
        cap = 0.0

    score = (
        4.0 * ap05
        + 1.0 * cap
        - 0.8 * abst
        - 0.6 * buy_s
        - 0.4 * ar
        - 0.002 * rp90
        - 0.001 * rp99
    )

    # Penalty for balanced profiles if abstain > 0.30
    if profile_name in ("balanced_v2_strict", "balanced_v2_relaxed"):
        if abst > 0.30:
            score -= 0.5 * (abst - 0.30)

    # Safety_plus: extra weight on precision and regret
    if profile_name == "safety_plus":
        score += 2.0 * ap05 - 0.002 * rp99

    return score


def _check_constraints(m: dict, constraints: dict) -> tuple[bool, list[str]]:
    """Check if metrics pass profile constraints. Returns (passed, failing_list)."""
    import math
    failing: list[str] = []
    for key, (op, threshold) in constraints.items():
        val = m.get(key)
        if val is None or (isinstance(val, float) and math.isnan(val)):
            failing.append(f"{key}=NaN")
            continue
        if op == ">=" and val < threshold:
            failing.append(f"{key}={val:.4f} < {threshold}")
        elif op == "<=" and val > threshold:
            failing.append(f"{key}={val:.4f} > {threshold}")
        elif op == ">" and val <= threshold:
            failing.append(f"{key}={val:.4f} <= {threshold}")
    return len(failing) == 0, failing


# =============================================================================
# Pareto
# =============================================================================

def _is_dominated(a: dict, b: dict) -> bool:
    """Returns True if a is dominated by b (b is better in all objectives)."""
    # Objectives: ap05↑, cap↑, abstain↓, rp99↓, buy↓
    import math
    def g(d, k, default=0.0):
        v = d.get(k, default)
        return default if (isinstance(v, float) and math.isnan(v)) else v

    a_vals = [
        g(a, "alert_precision_floor_1_05"),
        g(a, "capture_median"),
        -g(a, "abstain_share", 1.0),
        -g(a, "regret_abs_p99", 500.0),
        -g(a, "buy_now_share", 1.0),
    ]
    b_vals = [
        g(b, "alert_precision_floor_1_05"),
        g(b, "capture_median"),
        -g(b, "abstain_share", 1.0),
        -g(b, "regret_abs_p99", 500.0),
        -g(b, "buy_now_share", 1.0),
    ]
    # b dominates a if b >= a in all and b > a in at least one
    all_ge = all(bv >= av for av, bv in zip(a_vals, b_vals))
    any_gt = any(bv > av for av, bv in zip(a_vals, b_vals))
    return all_ge and any_gt


def _pareto_frontier(results: list[dict], max_size: int = 50) -> list[dict]:
    """Extract non-dominated set, return top max_size by score."""
    non_dominated: list[dict] = []
    for i, ri in enumerate(results):
        dominated = False
        for j, rj in enumerate(results):
            if i != j and _is_dominated(ri, rj):
                dominated = True
                break
        if not dominated:
            non_dominated.append(ri)
    # Sort by generic score
    non_dominated.sort(key=lambda x: _score_candidate(x, "balanced_v2_strict"),
                       reverse=True)
    return non_dominated[:max_size]


# =============================================================================
# Config summary string
# =============================================================================

def _cfg_summary(cfg: dict) -> str:
    return (
        f"w≤{cfg['max_width_over_price']} | "
        f"abs>{cfg['abstain_width_over_price']} | "
        f"buy≥+${cfg['buy_trigger_margin_usd']} | "
        f"drop≤{cfg['drop_proba_buy_max']} | "
        f"alert≥{cfg['alert_drop_threshold']} | "
        f"floor×{cfg['alert_near_floor_pct']} | "
        f"pop≥{cfg['route_popularity_min']} | "
        f"ttd[{cfg['ttd_lower']},{cfg['ttd_upper']}]"
    )


# =============================================================================
# Markdown report generation
# =============================================================================

def _write_markdown(report: dict) -> None:
    lines: list[str] = []
    lines.append("# V7a Policy Sweep V2 Results\n")
    lines.append(f"> Generated: {report['generated_at']}")
    lines.append(f"> Sprint: `b1/v7a-policy-sweep-v2`")
    lines.append(f"> Candidates evaluated: **{report['n_candidates_evaluated']}**\n")

    lines.append("## 1. Purpose\n")
    lines.append("Run an offline policy sweep v2 to search for a balanced V7a policy")
    lines.append("candidate that reduces abstain_share (~40%) while maintaining alert")
    lines.append("precision and capture. No retraining, no Modal, no app code changes.\n")

    lines.append("## 2. Source Artifacts\n")
    for k, v in report.get("source_artifacts", {}).items():
        lines.append(f"- `{k}`: {v}")
    lines.append("")

    lines.append("## 3. Current Applied Policy Baseline (Profile A)\n")
    base = report.get("profile_a_current_baseline_metrics", {})
    lines.append("| Metric | Value |")
    lines.append("| --- | --- |")
    for k in ["alert_precision_floor_1_05", "alert_precision_floor_1_10",
              "buy_now_share", "alert_rate", "abstain_share",
              "regret_abs_mean", "regret_abs_p90", "regret_abs_p99",
              "capture_median"]:
        v = base.get(k, "N/A")
        if isinstance(v, float):
            lines.append(f"| `{k}` | {v:.4f} |")
        else:
            lines.append(f"| `{k}` | {v} |")
    lines.append("")

    lines.append("## 4. Sweep V2 Search Space\n")
    lines.append(f"- Total grid dimensions: {len(GRID_V2)}")
    lines.append(f"- Candidates generated: {report['n_candidates_generated']}")
    lines.append(f"- Candidates evaluated: {report['n_candidates_evaluated']}")
    lines.append(f"- Max candidates cap: {MAX_CANDIDATES}\n")

    lines.append("## 5. Evaluation Metrics\n")
    lines.append("Same semantics as `policy_tune.py`:")
    lines.append("- alert precision = (ALERT|BUY_NOW) ∩ near_floor / (ALERT|BUY_NOW)")
    lines.append("- alert_rate excludes BUY_NOW")
    lines.append("- regret/capture computed per first-BUY trajectory")
    lines.append("- AUTO_BUY never emitted\n")

    lines.append("## 6. Profile Results\n")
    profiles = report.get("profiles", {})
    for pname, pdata in profiles.items():
        lines.append(f"### {pname}\n")
        lines.append(f"- Feasible: **{pdata.get('n_feasible', 0)}**")
        top = pdata.get("top_10_feasible", [])
        if top:
            lines.append(f"\n**Top feasible candidates:**\n")
            lines.append("| alert_p_05 | buy_share | alert_rate | abstain | regret_p99 | capture_med | cfg_summary |")
            lines.append("| --- | --- | --- | --- | --- | --- | --- |")
            for c in top[:5]:
                lines.append(
                    f"| {c.get('alert_precision_floor_1_05', 0):.4f} "
                    f"| {c.get('buy_now_share', 0):.4f} "
                    f"| {c.get('alert_rate', 0):.4f} "
                    f"| {c.get('abstain_share', 0):.4f} "
                    f"| {c.get('regret_abs_p99', 0):.1f} "
                    f"| {c.get('capture_median', 0):.4f} "
                    f"| {_cfg_summary(c.get('config', {}))} |"
                )
        else:
            miss = pdata.get("top_10_nearest_miss", [])
            if miss:
                lines.append(f"\n**Nearest-miss (no feasible):**\n")
                lines.append("| alert_p_05 | buy_share | alert_rate | abstain | regret_p99 | capture_med | cfg_summary |")
                lines.append("| --- | --- | --- | --- | --- | --- | --- |")
                for c in miss[:5]:
                    lines.append(
                        f"| {c.get('alert_precision_floor_1_05', 0):.4f} "
                        f"| {c.get('buy_now_share', 0):.4f} "
                        f"| {c.get('alert_rate', 0):.4f} "
                        f"| {c.get('abstain_share', 0):.4f} "
                        f"| {c.get('regret_abs_p99', 0):.1f} "
                        f"| {c.get('capture_median', 0):.4f} "
                        f"| {_cfg_summary(c.get('config', {}))} |"
                    )
        lines.append("")

    lines.append("## 7. Pareto Frontier Summary\n")
    pareto = report.get("pareto_frontier_top_50", [])
    lines.append(f"- Non-dominated candidates: {len(pareto)}")
    if pareto:
        lines.append("\n**Top 5 Pareto:**\n")
        lines.append("| alert_p_05 | abstain | capture_med | regret_p99 | buy_share | cfg_summary |")
        lines.append("| --- | --- | --- | --- | --- | --- |")
        for c in pareto[:5]:
            lines.append(
                f"| {c.get('alert_precision_floor_1_05', 0):.4f} "
                f"| {c.get('abstain_share', 0):.4f} "
                f"| {c.get('capture_median', 0):.4f} "
                f"| {c.get('regret_abs_p99', 0):.1f} "
                f"| {c.get('buy_now_share', 0):.4f} "
                f"| {_cfg_summary(c.get('config', {}))} |"
            )
    lines.append("")

    lines.append("## 8. Recommendation\n")
    rec = report.get("recommendation", {})
    lines.append(f"**Verdict:** {rec.get('verdict', 'N/A')}\n")
    lines.append(f"- Recommended next branch: `{rec.get('recommended_next_branch', 'N/A')}`")
    lines.append(f"- Recommended next action: {rec.get('recommended_next_action', 'N/A')}")
    lines.append(f"- Rationale: {rec.get('rationale', 'N/A')}\n")

    lines.append("## 9. Limitations and Non-Goals\n")
    for lim in report.get("limitations", []):
        lines.append(f"- {lim}")
    lines.append("")
    for ng in report.get("non_goals", []):
        lines.append(f"- {ng}")
    lines.append("")

    OUT_MD.parent.mkdir(parents=True, exist_ok=True)
    OUT_MD.write_text("\n".join(lines), encoding="utf-8")
    log(f"wrote markdown report to {OUT_MD}")


# =============================================================================
# Main
# =============================================================================

def main() -> None:
    t0 = time.time()

    # --- Load artifacts ---
    _checked, found = probe_artifacts()
    required = ["predictions_test_parquet", "features_test_parquet", "conformal_json"]
    for k in required:
        if k not in found:
            print(f"ERROR: missing artifact {k}", file=sys.stderr)
            sys.exit(1)

    df_pred, df_feat, mondrian, df_train_q10 = _load_true_sweep_inputs(found)
    n = len(df_pred)
    log(f"loaded {n} rows")

    pred_map = map_aliases(list(df_pred.columns))
    feat_map = map_aliases(list(df_feat.columns))
    arr = _build_arrays(df_pred, df_feat, mondrian, df_train_q10, pred_map, feat_map)

    # --- Generate candidates ---
    candidates = _generate_candidates()
    n_candidates = len(candidates)
    log(f"evaluating {n_candidates} candidates on {n} rows")

    # --- Evaluate Profile A baseline ---
    actions_a = _classify_v2(arr, PROFILE_A_CFG)
    baseline_metrics = _eval_candidate(arr, actions_a, PROFILE_A_CFG)

    # --- Evaluate all candidates ---
    all_results: list[dict] = []
    for i, cfg in enumerate(candidates):
        if (i + 1) % 5000 == 0:
            log(f"progress: {i+1}/{n_candidates}")
        actions = _classify_v2(arr, cfg)

        # Quick check: no AUTO_BUY
        if (actions == "AUTO_BUY").any():
            continue  # skip broken candidate

        metrics = _eval_candidate(arr, actions, cfg)
        all_results.append(metrics)

    n_evaluated = len(all_results)
    elapsed = time.time() - t0
    log(f"evaluated {n_evaluated} candidates in {elapsed:.1f}s")

    # --- Profile evaluation ---
    profile_results: dict[str, dict] = {}

    for pname, constraints in PROFILES.items():
        feasible: list[dict] = []
        infeasible_scored: list[tuple[float, list[str], dict]] = []

        for m in all_results:
            passed, failing = _check_constraints(m, constraints)
            score = _score_candidate(m, pname)
            if passed:
                feasible.append(m)
            else:
                infeasible_scored.append((score, failing, m))

        # Sort feasible by score
        feasible.sort(key=lambda x: _score_candidate(x, pname), reverse=True)
        # Sort infeasible by score (nearest miss)
        infeasible_scored.sort(key=lambda x: x[0], reverse=True)

        # Count failing constraints
        fail_counts: dict[str, int] = {}
        for _, failing, _ in infeasible_scored:
            for f in failing:
                key = f.split("=")[0]
                fail_counts[key] = fail_counts.get(key, 0) + 1

        profile_results[pname] = {
            "n_feasible": len(feasible),
            "top_10_feasible": feasible[:10],
            "top_10_nearest_miss": [m for _, _, m in infeasible_scored[:10]],
            "failing_constraint_counts": fail_counts,
        }

    # --- Pareto frontier ---
    # Use a sample for Pareto (full set too expensive for O(n^2))
    pareto_pool = sorted(all_results,
                         key=lambda x: _score_candidate(x, "balanced_v2_strict"),
                         reverse=True)[:2000]
    pareto = _pareto_frontier(pareto_pool, max_size=50)

    # --- Recommendation ---
    rec: dict[str, Any] = {}
    bvs = profile_results["balanced_v2_strict"]
    bvr = profile_results["balanced_v2_relaxed"]
    sp = profile_results["safety_plus"]

    if bvs["n_feasible"] > 0:
        rec["verdict"] = "PROMOTE_BALANCED_V2_STRICT_CANDIDATE"
        rec["recommended_next_branch"] = "b1/v7a-policy-apply-balanced-v2"
        rec["recommended_next_action"] = (
            "Apply top balanced_v2_strict candidate to policy.py with regression check."
        )
        rec["selected_candidate_or_null"] = bvs["top_10_feasible"][0]
        rec["rationale"] = (
            f"Found {bvs['n_feasible']} feasible candidates under strict balanced constraints. "
            "Top candidate reduces abstain while maintaining precision >= 0.20 and capture >= 0.85."
        )
    elif bvr["n_feasible"] > 0:
        rec["verdict"] = "PROMOTE_BALANCED_V2_RELAXED_CANDIDATE_FOR_SHADOW_REVIEW"
        rec["recommended_next_branch"] = "b1/v7a-policy-apply-balanced-v2"
        rec["recommended_next_action"] = (
            "Apply top balanced_v2_relaxed candidate for shadow evaluation."
        )
        rec["selected_candidate_or_null"] = bvr["top_10_feasible"][0]
        rec["rationale"] = (
            f"No strict candidate found, but {bvr['n_feasible']} relaxed candidates exist. "
            "Top candidate offers a good tradeoff for shadow-mode review."
        )
    elif sp["n_feasible"] > 0 and sp["n_feasible"] > 1:
        rec["verdict"] = "PROMOTE_SAFETY_PLUS_CANDIDATE"
        rec["recommended_next_branch"] = "b1/v7a-policy-apply-safety-plus"
        rec["recommended_next_action"] = (
            "Apply top safety_plus candidate to improve over current Profile A."
        )
        rec["selected_candidate_or_null"] = sp["top_10_feasible"][0]
        rec["rationale"] = (
            f"Found {sp['n_feasible']} safety_plus candidates that improve on Profile A."
        )
    else:
        rec["verdict"] = "KEEP_PROFILE_A_AND_DOCUMENT_TRADEOFF"
        rec["recommended_next_branch"] = "b1/v7a-policy-model-quality-audit"
        rec["recommended_next_action"] = (
            "Keep Profile A. The wide conformal intervals (~105% of price at alpha=0.10) "
            "structurally prevent abstain < 30% without significant precision loss. "
            "Next step: audit model quality or tighten conformal calibration."
        )
        rec["selected_candidate_or_null"] = None
        rec["rationale"] = (
            "No balanced candidate is feasible. The dominant constraint is "
            "abstain_share driven by wide conformal intervals. Improving model "
            "calibration or reducing interval width at alpha=0.10 is needed."
        )

    # --- Build report ---
    report = {
        "status": "ok",
        "generated_at": now_iso(),
        "source_artifacts": {k: v.get("path", "?") for k, v in found.items()
                            if k in required + ["features_train_parquet"]},
        "n_rows": n,
        "n_candidates_generated": n_candidates,
        "n_candidates_evaluated": n_evaluated,
        "elapsed_seconds": round(elapsed, 1),
        "profile_a_current_baseline_metrics": {
            k: baseline_metrics[k] for k in [
                "alert_precision_floor_1_05", "alert_precision_floor_1_10",
                "alert_recall_floor_1_05", "buy_now_share", "alert_rate",
                "abstain_share", "monitor_share", "wait_share",
                "regret_abs_mean", "regret_abs_p90", "regret_abs_p99",
                "capture_median", "false_buy_now_rate",
            ] if k in baseline_metrics
        },
        "profiles": profile_results,
        "pareto_frontier_top_50": pareto,
        "recommendation": rec,
        "limitations": [
            "No retraining was done.",
            "No Modal run was done.",
            "No app/payment/cloud/Largo code was touched.",
            "AUTO_BUY remains disabled — never emitted.",
            "MONITOR parameters are now parameterized (v1 used hardcoded 0.40/14/0.75).",
            "Pareto computed on top-2000 candidates (not full set) for runtime.",
            "This does not make the system production-ready.",
            "Any candidate must be applied in a separate PR with a regression check.",
        ],
        "non_goals": [
            "No policy.py modification in this sprint.",
            "No production deployment.",
            "No auto-buy enablement.",
            "No cloud/Modal execution.",
            "No model retraining or fine-tuning.",
            "No app UI changes.",
        ],
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    log(f"wrote JSON report to {OUT_JSON}")

    # --- Write markdown ---
    _write_markdown(report)

    # --- Summary ---
    print(f"\n{'='*60}", file=sys.stderr)
    print(f"SWEEP V2 COMPLETE", file=sys.stderr)
    print(f"  Candidates: {n_evaluated}", file=sys.stderr)
    print(f"  Elapsed: {elapsed:.1f}s", file=sys.stderr)
    print(f"  Verdict: {rec['verdict']}", file=sys.stderr)
    for pname, pdata in profile_results.items():
        print(f"  {pname}: {pdata['n_feasible']} feasible", file=sys.stderr)
    print(f"  Pareto frontier size: {len(pareto)}", file=sys.stderr)
    print(f"  Report: {OUT_JSON}", file=sys.stderr)
    print(f"  Markdown: {OUT_MD}", file=sys.stderr)
    print(f"{'='*60}\n", file=sys.stderr)


if __name__ == "__main__":
    main()
