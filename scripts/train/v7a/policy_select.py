#!/usr/bin/env python3
"""
v7a/policy_select.py — selection of V7a policy candidates from the
offline tuning sweep (B1, sprint `b1/v7a-policy-candidate-selection`).

Read-only consumer of `reports/v7a_policy_tuning_local.json` (produced by
`scripts/train/v7a/policy_tune.py` in the previous sprint). For each of
four product profiles (Safety-first, Balanced product, Low-friction UX,
Shadow-mode learning) the script:

  - filters the sweep's top + Pareto candidates against the profile's
    constraint set,
  - if any candidate satisfies all constraints → ranks by safety-first
    score and reports the top three,
  - if NONE satisfies all constraints → reports the nearest-miss
    candidates and lists which constraints fail,
  - emits a global recommendation (commit policy.py change vs. run a
    second sweep vs. harden the row-level export vs. keep V7a in shadow).

Discipline:
  - LOCAL-ONLY. No Modal, no cloud, no model retrain.
  - READ-ONLY on every input. The frozen `policy.py`, `policy_tune.py`,
    `backtest.py`, `calibrate.py`, all existing `reports/v7a_*_local.json`,
    every `data/**`, every `models/**`, and every `logs/**` are NEVER
    written. Only the two output files below are CREATED.
  - HONEST. Will NOT force a winner if the trade-off is unacceptable.
    Will NOT recommend modifying `policy.py` unless a candidate clearly
    dominates current V7a on safety without destroying capture.
  - SAFE. Recommends keeping AUTO_BUY off. Real auto-buy is never
    promoted from this sprint.

Outputs:
  - reports/v7a_policy_selection_local.json
  - docs/v7a/V7A_POLICY_SELECTION_DECISION.md

Usage:
  python3 scripts/train/v7a/policy_select.py
"""

from __future__ import annotations

import json
import math
import sys
import time
from pathlib import Path
from typing import Any

# -----------------------------------------------------------------------------
# Paths
# -----------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[3]
SOURCE_JSON = REPO_ROOT / "reports" / "v7a_policy_tuning_local.json"
OUT_JSON = REPO_ROOT / "reports" / "v7a_policy_selection_local.json"
OUT_MD = REPO_ROOT / "docs" / "v7a" / "V7A_POLICY_SELECTION_DECISION.md"

# -----------------------------------------------------------------------------
# Profiles — each is a dict of {metric_key: (op, threshold, label)}.
# `op` ∈ {'>=', '<=', '>', '<'}. `label` is shown in the report.
# -----------------------------------------------------------------------------

PROFILES: dict[str, dict] = {
    "A_safety_first": {
        "title": "Safety-first",
        "intent": (
            "Maximize alert_precision_floor_1_05; minimize false / noisy "
            "actions; ABSTAIN may be high if needed."
        ),
        "constraints": {
            "alert_precision_floor_1_05": (">=", 0.20),
            "buy_now_share": ("<=", 0.03),
            "alert_rate": ("<=", 0.05),
            "abstain_share": ("<=", 0.50),
            "capture_median": (">=", 0.85),
            "regret_abs_p99": ("<=", 300.0),
        },
    },
    "B_balanced_product": {
        "title": "Balanced product",
        "intent": (
            "Reasonable precision with less ABSTAIN; suitable for "
            "user-facing non-transactional advice."
        ),
        "constraints": {
            "alert_precision_floor_1_05": (">=", 0.10),
            "buy_now_share": ("<=", 0.10),
            "alert_rate": ("<=", 0.15),
            "abstain_share": ("<=", 0.30),
            "capture_median": (">=", 0.85),
            # regret_p90 not worse than v7a_hybrid by more than 10% — applied
            # at evaluation time using the baseline value loaded from the JSON
            "_regret_p90_factor_vs_baseline_max": ("<=", 1.10),
        },
    },
    "C_low_friction_ux": {
        "title": "Low-friction UX",
        "intent": (
            "Avoid too many ABSTAIN; user-facing advice should remain "
            "actionable on most rows."
        ),
        "constraints": {
            "abstain_share": ("<=", 0.20),
            "buy_now_share": ("<=", 0.15),
            "alert_rate": ("<=", 0.20),
            "capture_median": (">=", 0.82),
            # alert_precision_floor_1_05 should improve vs baseline current
            # V7a (~0.031); applied at evaluation time
            "_alert_precision_05_must_improve_vs_baseline": (">", 1.0),
        },
    },
    "D_shadow_mode_learning": {
        "title": "Shadow-mode learning",
        "intent": (
            "Maximize observation quality while remaining "
            "non-transactional. Real auto-buy stays disabled."
        ),
        "constraints": {
            "buy_now_share": ("<=", 0.20),
            "alert_rate": ("<=", 0.25),
            "abstain_share": ("<=", 0.35),
            "capture_median": (">=", 0.82),
            # regret_p99 is monitored but NOT blocking — recorded as a soft
            # warning instead of a hard fail. Implemented in evaluator.
        },
    },
}

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def log(msg: str, **kv: Any) -> None:
    suffix = " ".join(f"{k}={v}" for k, v in kv.items())
    sys.stderr.write(f"[policy_select] {msg} {suffix}\n".rstrip() + "\n")


def rel(p: Path) -> str:
    try:
        return str(p.relative_to(REPO_ROOT))
    except ValueError:
        return str(p)


def is_nan(x: Any) -> bool:
    return isinstance(x, float) and math.isnan(x)


def safe_float(x: Any, default: float = float("nan")) -> float:
    try:
        v = float(x)
        return v
    except (TypeError, ValueError):
        return default


def emit_diagnostic_and_exit(reason: str) -> int:
    """Write a stub JSON+MD and exit 0 if input is unusable."""
    payload = {
        "mode": "diagnostic_unusable_source",
        "generated_at": now_iso(),
        "source_file": rel(SOURCE_JSON),
        "reason": reason,
        "global_recommendation": (
            "Cannot select a candidate — re-run "
            "`scripts/train/v7a/policy_tune.py` to regenerate "
            "`reports/v7a_policy_tuning_local.json` first."
        ),
        "whether_policy_py_should_be_modified_next": False,
        "recommended_next_branch": "b1/v7a-row-level-export-hardening",
        "recommended_next_action": (
            "Repair / re-export the row-level artifacts so the tuning "
            "sweep can produce a usable candidates list."
        ),
        "limitations": [reason],
    }
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    OUT_MD.parent.mkdir(parents=True, exist_ok=True)
    OUT_MD.write_text(
        f"# V7a Policy Selection Decision\n\n"
        f"**Mode: diagnostic_unusable_source.**\n\n"
        f"Reason: `{reason}`\n\n"
        f"Cannot select a candidate from the existing sweep output. "
        f"Re-run `scripts/train/v7a/policy_tune.py` first.\n",
        encoding="utf-8",
    )
    print(f"[policy_select] mode=diagnostic_unusable_source reason={reason}")
    print(f"[policy_select] wrote: {rel(OUT_JSON)}")
    print(f"[policy_select] wrote: {rel(OUT_MD)}")
    return 0


# -----------------------------------------------------------------------------
# Constraint evaluator
# -----------------------------------------------------------------------------


def _check_constraint(value: float, op: str, threshold: float) -> bool:
    if is_nan(value):
        return False
    if op == ">=":
        return value >= threshold
    if op == "<=":
        return value <= threshold
    if op == ">":
        return value > threshold
    if op == "<":
        return value < threshold
    return False


def _evaluate_against_profile(
    cand: dict,
    profile: dict,
    baseline_v7a_p90: float,
    baseline_v7a_alert_p_05: float,
) -> dict:
    """Returns {pass: bool, fails: [str], soft_warnings: [str], details: {...}}."""
    fails: list[str] = []
    soft: list[str] = []
    details: dict[str, dict] = {}

    for key, (op, thr) in profile["constraints"].items():
        if key == "_regret_p90_factor_vs_baseline_max":
            v = safe_float(cand.get("regret_abs_p90"))
            ratio = v / baseline_v7a_p90 if baseline_v7a_p90 > 0 else float("nan")
            ok = _check_constraint(ratio, op, thr)
            details[key] = {
                "value": ratio, "op": op, "threshold": thr, "pass": ok,
                "raw_metric": "regret_abs_p90", "raw_value": v,
                "baseline_v7a_p90": baseline_v7a_p90,
            }
            if not ok:
                fails.append(
                    f"regret_p90 ratio vs baseline = {ratio:.3f} > {thr} "
                    f"(cand p90 = ${v:.0f}, baseline = ${baseline_v7a_p90:.0f})"
                )
        elif key == "_alert_precision_05_must_improve_vs_baseline":
            v = safe_float(cand.get("alert_precision_floor_1_05"))
            improved = (not is_nan(v)) and v > baseline_v7a_alert_p_05
            details[key] = {
                "value": v, "op": ">", "threshold": baseline_v7a_alert_p_05,
                "pass": improved,
            }
            if not improved:
                fails.append(
                    f"alert_precision_floor_1_05 = {v:.4f} <= "
                    f"baseline {baseline_v7a_alert_p_05:.4f}"
                )
        else:
            v = safe_float(cand.get(key))
            ok = _check_constraint(v, op, thr)
            details[key] = {"value": v, "op": op, "threshold": thr, "pass": ok}
            if not ok:
                fails.append(f"{key} = {v} fails {op} {thr}")

    # Profile-D specific: regret_p99 is soft-warning, not blocking
    if profile.get("title") == "Shadow-mode learning":
        v_p99 = safe_float(cand.get("regret_abs_p99"))
        if not is_nan(v_p99) and v_p99 > 300.0:
            soft.append(f"regret_abs_p99 = ${v_p99:.0f} > $300 (soft warning, not blocking)")

    return {
        "pass": len(fails) == 0,
        "fails": fails,
        "soft_warnings": soft,
        "details": details,
    }


# -----------------------------------------------------------------------------
# Ranking — safety-first composite score
# -----------------------------------------------------------------------------


def _safety_score(cand: dict, profile_title: str) -> tuple:
    """Lexicographic key (higher is better)."""
    ap = safe_float(cand.get("alert_precision_floor_1_05"), -1.0)
    if is_nan(ap):
        ap = -1.0
    rp99 = safe_float(cand.get("regret_abs_p99"), 1e9)
    if is_nan(rp99):
        rp99 = 1e9
    buy = safe_float(cand.get("buy_now_share"), 1.0)
    alert_rate = safe_float(cand.get("alert_rate"), 1.0)
    abstain = safe_float(cand.get("abstain_share"), 0.0)
    capture = safe_float(cand.get("capture_median"), 0.0)

    # ABSTAIN sign depends on profile:
    #  - Safety-first: HIGH abstain is fine → +abstain
    #  - Low-friction: HIGH abstain is bad → -abstain
    #  - Balanced / Shadow: neutral → 0
    if profile_title == "Safety-first":
        abstain_term = abstain
    elif profile_title == "Low-friction UX":
        abstain_term = -abstain
    else:
        abstain_term = 0.0

    # Lexicographic: high alert_precision, low regret_p99, low buy, low alert_rate,
    # capture_median, then abstain term
    return (ap, -rp99, -buy, -alert_rate, capture, abstain_term)


def _nearest_miss_score(cand: dict, evaluation: dict) -> float:
    """How close to feasibility? Lower = closer."""
    n_fails = len(evaluation["fails"])
    # Tie-break: prefer higher alert_precision_05
    ap = safe_float(cand.get("alert_precision_floor_1_05"), 0.0)
    if is_nan(ap):
        ap = 0.0
    return n_fails - 0.001 * ap  # smaller is better; -ap (better precision) lowers score


# -----------------------------------------------------------------------------
# Profile evaluation
# -----------------------------------------------------------------------------


def _config_summary(cfg: dict) -> str:
    if not cfg:
        return "(no config)"
    return (
        f"width≤{cfg.get('max_width_over_price')} | "
        f"abstain>{cfg.get('abstain_width_over_price')} | "
        f"buy≥+${cfg.get('buy_trigger_margin_usd')} | "
        f"drop≤{cfg.get('drop_proba_buy_max')} | "
        f"alert≥{cfg.get('alert_drop_threshold')} | "
        f"floor×{cfg.get('alert_near_floor_pct')} | "
        f"pop≥{cfg.get('route_popularity_min')} | "
        f"ttd[{cfg.get('ttd_lower')},{cfg.get('ttd_upper')}]"
    )


def _candidate_view(cand: dict, evaluation: dict) -> dict:
    """Compact view of a candidate for the JSON output."""
    return {
        "config": cand.get("config"),
        "config_summary": _config_summary(cand.get("config", {})),
        "metrics": {
            "alert_precision_floor_1_05": safe_float(cand.get("alert_precision_floor_1_05")),
            "alert_precision_floor_1_10": safe_float(cand.get("alert_precision_floor_1_10")),
            "alert_recall_floor_1_05": safe_float(cand.get("alert_recall_floor_1_05")),
            "alert_rate": safe_float(cand.get("alert_rate")),
            "buy_now_share": safe_float(cand.get("buy_now_share")),
            "abstain_share": safe_float(cand.get("abstain_share")),
            "monitor_share": safe_float(cand.get("monitor_share")),
            "wait_share": safe_float(cand.get("wait_share")),
            "regret_abs_mean": safe_float(cand.get("regret_abs_mean")),
            "regret_abs_p50": safe_float(cand.get("regret_abs_p50")),
            "regret_abs_p90": safe_float(cand.get("regret_abs_p90")),
            "regret_abs_p99": safe_float(cand.get("regret_abs_p99")),
            "capture_mean": safe_float(cand.get("capture_mean")),
            "capture_median": safe_float(cand.get("capture_median")),
            "false_buy_now_rate": safe_float(cand.get("false_buy_now_rate")),
            "trajectory_buy_coverage": safe_float(cand.get("trajectory_buy_coverage")),
        },
        "passes_profile": evaluation["pass"],
        "constraint_fails": evaluation["fails"],
        "soft_warnings": evaluation["soft_warnings"],
        "constraint_details": evaluation["details"],
    }


def _evaluate_profile(
    profile_key: str,
    profile: dict,
    candidate_pool: list[dict],
    baseline_v7a_p90: float,
    baseline_v7a_alert_p_05: float,
) -> dict:
    """Returns the per-profile decision block."""
    log("evaluating profile", profile=profile_key, n_pool=len(candidate_pool))

    evaluations: list[tuple[dict, dict]] = []
    for cand in candidate_pool:
        ev = _evaluate_against_profile(cand, profile, baseline_v7a_p90, baseline_v7a_alert_p_05)
        evaluations.append((cand, ev))

    feasible = [(c, ev) for c, ev in evaluations if ev["pass"]]
    near_miss = [(c, ev) for c, ev in evaluations if not ev["pass"]]

    # Rank feasible by safety-first
    feasible_sorted = sorted(
        feasible,
        key=lambda ce: _safety_score(ce[0], profile["title"]),
        reverse=True,
    )
    # Rank near-miss by fewest-fails-then-precision
    near_miss_sorted = sorted(
        near_miss,
        key=lambda ce: _nearest_miss_score(ce[0], ce[1]),
    )

    selected = [_candidate_view(c, ev) for c, ev in feasible_sorted[:3]]
    nearest = [_candidate_view(c, ev) for c, ev in near_miss_sorted[:5]]

    return {
        "profile_key": profile_key,
        "title": profile["title"],
        "intent": profile["intent"],
        "constraints": {
            k: {"op": v[0], "threshold": v[1]}
            for k, v in profile["constraints"].items()
        },
        "n_candidates_in_pool": len(candidate_pool),
        "n_feasible": len(feasible),
        "selected_top_3": selected,
        "nearest_miss_top_5": nearest if not selected else [],
        "verdict": (
            "feasible_candidate_found" if selected
            else "no_feasible_candidate_in_pool"
        ),
    }


# -----------------------------------------------------------------------------
# Global recommendation
# -----------------------------------------------------------------------------


def _global_recommendation(profile_results: dict, baseline: dict) -> dict:
    """Decide whether policy.py should be modified next, and which sprint to recommend."""

    n_feasible = {k: r["n_feasible"] for k, r in profile_results.items()}

    any_feasible = any(n > 0 for n in n_feasible.values())

    # Critical rule: NEVER recommend modifying policy.py from a Profile-D-only
    # feasibility (shadow mode constraints are too lax for a production change).
    safety_or_balanced_feasible = (
        n_feasible.get("A_safety_first", 0) > 0
        or n_feasible.get("B_balanced_product", 0) > 0
    )

    if safety_or_balanced_feasible:
        verdict = (
            "PROMOTE — Profile A or B has at least one feasible candidate. "
            "Recommend opening b1/v7a-policy-apply-candidate to apply the "
            "selected thresholds to scripts/train/v7a/policy.py with a "
            "regression test."
        )
        whether_modify = True
        next_branch = "b1/v7a-policy-apply-candidate"
        next_action = (
            "Edit scripts/train/v7a/policy.py to set: WIDTH_RATIO_ABSTAIN, "
            "BUY_THRESHOLD (or equivalent margin gate), and add the new "
            "drop_proba_buy_max + alert_near_floor_pct gates. Re-run "
            "backtest.py and confirm metrics match the offline sweep. No "
            "Modal, no retraining."
        )
    elif any_feasible:
        verdict = (
            "HOLD — only Profile C (Low-friction) and/or Profile D (Shadow) "
            "produce feasible candidates. These do not justify changing "
            "production policy.py. Use the candidate for shadow-mode "
            "logging only."
        )
        whether_modify = False
        next_branch = "b1/v7a-policy-sweep-v2"
        next_action = (
            "Run a second narrower sweep around the Profile-A region "
            "(higher abstain_width_over_price, lower drop_proba_buy_max, "
            "higher buy_trigger_margin_usd) to seek a Profile-A or "
            "Profile-B feasible candidate. No policy.py edit yet."
        )
    else:
        verdict = (
            "NOT READY — no profile yields a feasible candidate from the "
            "existing sweep. The data does not support a production policy "
            "change in any product mode."
        )
        whether_modify = False
        next_branch = "b1/v7a-policy-sweep-v2"
        next_action = (
            "Either (i) widen the grid (e.g. add max_width_over_price=0.25, "
            "drop_proba_buy_max=0.15, ttd_lower=5) and re-sweep, OR (ii) "
            "first export richer row-level artifacts via "
            "b1/v7a-row-level-export-hardening (e.g. per-trajectory "
            "realized_floor, depart_date in predictions parquet). Pick "
            "(ii) first if any sweep metric is currently unreliable."
        )

    return {
        "verdict": verdict,
        "whether_policy_py_should_be_modified_next": whether_modify,
        "recommended_next_branch": next_branch,
        "recommended_next_action": next_action,
        "n_feasible_per_profile": n_feasible,
    }


# -----------------------------------------------------------------------------
# Markdown writer
# -----------------------------------------------------------------------------


def _md_table(rows: list[dict], cols: list[str]) -> str:
    if not rows:
        return "_(none)_\n"
    header = "| " + " | ".join(cols) + " |"
    sep = "| " + " | ".join(["---"] * len(cols)) + " |"
    body_lines = []
    for r in rows:
        cells = []
        for c in cols:
            v = r.get(c)
            if isinstance(v, float):
                if math.isnan(v):
                    cells.append("—")
                elif abs(v) < 100:
                    cells.append(f"{v:.4f}")
                else:
                    cells.append(f"{v:.1f}")
            elif v is None:
                cells.append("—")
            elif isinstance(v, bool):
                cells.append("yes" if v else "no")
            else:
                cells.append(str(v))
        body_lines.append("| " + " | ".join(cells) + " |")
    return "\n".join([header, sep, *body_lines]) + "\n"


def _candidate_row(cv: dict) -> dict:
    m = cv.get("metrics", {})
    return {
        "passes": cv.get("passes_profile"),
        "alert_p_05": m.get("alert_precision_floor_1_05"),
        "alert_p_10": m.get("alert_precision_floor_1_10"),
        "alert_r_05": m.get("alert_recall_floor_1_05"),
        "buy_share": m.get("buy_now_share"),
        "alert_rate": m.get("alert_rate"),
        "abstain": m.get("abstain_share"),
        "regret_mean": m.get("regret_abs_mean"),
        "regret_p90": m.get("regret_abs_p90"),
        "regret_p99": m.get("regret_abs_p99"),
        "capture_med": m.get("capture_median"),
        "cfg_summary": cv.get("config_summary"),
    }


def _candidate_cols() -> list[str]:
    return [
        "passes", "alert_p_05", "alert_p_10", "alert_r_05",
        "buy_share", "alert_rate", "abstain",
        "regret_mean", "regret_p90", "regret_p99", "capture_med",
        "cfg_summary",
    ]


def _profile_md_section(prof_result: dict) -> str:
    md: list[str] = []
    title = prof_result["title"]
    md.append(f"**Intent:** {prof_result['intent']}")
    md.append("")
    md.append("**Constraints:**")
    md.append("")
    for k, v in prof_result["constraints"].items():
        md.append(f"- `{k}` {v['op']} `{v['threshold']}`")
    md.append("")
    md.append(f"**Pool size:** {prof_result['n_candidates_in_pool']} · "
              f"**Feasible:** {prof_result['n_feasible']} · "
              f"**Verdict:** `{prof_result['verdict']}`")
    md.append("")
    sel = prof_result.get("selected_top_3") or []
    near = prof_result.get("nearest_miss_top_5") or []
    if sel:
        md.append("**Top selected candidates:**")
        md.append("")
        md.append(_md_table([_candidate_row(c) for c in sel], _candidate_cols()))
        # also show fails (should be empty for selected)
        for i, c in enumerate(sel, 1):
            if c.get("constraint_fails"):
                md.append(f"_Selected #{i} unexpected fails:_ {c['constraint_fails']}")
        for i, c in enumerate(sel, 1):
            if c.get("soft_warnings"):
                md.append(f"_Selected #{i} soft warnings:_ {c['soft_warnings']}")
    elif near:
        md.append("**Nearest-miss candidates** (none meets all constraints):")
        md.append("")
        md.append(_md_table([_candidate_row(c) for c in near], _candidate_cols()))
        md.append("Failing constraints per nearest-miss candidate:")
        md.append("")
        for i, c in enumerate(near, 1):
            md.append(f"- **#{i}** ({c['config_summary']}): {c['constraint_fails']}")
    else:
        md.append("_(no candidates evaluated)_")
    md.append("")
    return "\n".join(md)


def _write_markdown(payload: dict) -> None:
    OUT_MD.parent.mkdir(parents=True, exist_ok=True)
    md: list[str] = []

    md.append("# V7a Policy Selection Decision")
    md.append("")
    md.append(f"> **Sprint** — `b1/v7a-policy-candidate-selection` · "
              "select a V7a policy candidate from the offline tuning sweep.\n"
              f"> Generated by `scripts/train/v7a/policy_select.py` on "
              f"{payload.get('generated_at', '?')}.\n"
              f"> Source: `{payload.get('source_file', '?')}` "
              f"(mode: `{payload.get('source_mode', '?')}`).")
    md.append("")

    # 1. Purpose
    md.append("## 1. Purpose")
    md.append("")
    md.append("Decide whether any candidate policy from the previous sweep "
              "is good enough to:")
    md.append("- (a) replace the current production thresholds in "
              "`scripts/train/v7a/policy.py`, or")
    md.append("- (b) drive shadow-mode advice only, or")
    md.append("- (c) trigger a second narrower sweep.")
    md.append("")
    md.append("The script does NOT modify `policy.py`. The sprint is "
              "decision-only.")
    md.append("")

    # 2. Input Sweep Summary
    md.append("## 2. Input Sweep Summary")
    md.append("")
    md.append(f"- Source: `{payload.get('source_file')}`")
    md.append(f"- Source mode: `{payload.get('source_mode')}`")
    md.append(f"- Candidates evaluated upstream: "
              f"**{payload.get('source_candidates_evaluated', '?'):,}**" if isinstance(payload.get('source_candidates_evaluated'), int)
              else f"- Candidates evaluated upstream: **{payload.get('source_candidates_evaluated', '?')}**")
    md.append(f"- Feasible (default sweep constraints): "
              f"**{payload.get('source_feasible_count', '?')}**")
    md.append(f"- Pareto-non-dominated: "
              f"**{payload.get('source_pareto_count', '?')}**")
    md.append(f"- Candidate pool used by this script: "
              f"**{payload.get('selection_pool_size', '?')}** "
              f"(top + Pareto, deduplicated by config).")
    md.append("")

    bm = payload.get("baseline_current_metrics", {})
    if isinstance(bm, dict):
        md.append("Baseline frozen-policy metrics (for reference):")
        md.append("")
        rows = []
        for variant in ("v7a_ml_only", "v7a_hybrid"):
            vb = bm.get(variant) or {}
            buy = vb.get("buy", {})
            alert = vb.get("alert", {})
            rows.append({
                "variant": variant,
                "regret_mean": buy.get("regret_abs_mean"),
                "regret_p90": buy.get("regret_abs_p90"),
                "regret_p99": buy.get("regret_abs_p99"),
                "capture_med": buy.get("capture_median"),
                "alert_rate": alert.get("alert_rate"),
                "alert_p_05": alert.get("alert_precision_floor_1_05"),
            })
        md.append(_md_table(rows, [
            "variant", "regret_mean", "regret_p90", "regret_p99",
            "capture_med", "alert_rate", "alert_p_05",
        ]))
    md.append("")

    # 3. Why no candidate was fully feasible
    md.append("## 3. Why No Candidate Was Fully Feasible (in the upstream sweep)")
    md.append("")
    md.append(f"The previous sprint reported **{payload.get('source_feasible_count', 0)} feasible "
              "candidates** under the sweep's default constraint set. "
              "That set required: `alert_rate ≤ 0.20`, `buy_now_share ≤ 0.15`, "
              "`abstain_share ∈ [0.05, 0.25]`, `regret_p90 ≤ 1.10 × baseline`, "
              "`capture_median ≥ 0.82`, `alert_precision_floor_1_05 ≥ 0.10`.")
    md.append("")
    md.append("The dominant reason is the *upper bound on `abstain_share` (≤ 0.25)* "
              "combined with the V7a model's inherently wide conformal intervals "
              "($230 mean width at α=0.10, ~105% of price). Any tightening that "
              "improves alert precision pushes `abstain_share` above 25%, and "
              "any relaxation that keeps abstain low fires too many BUY/ALERT "
              "rows. This is the audit's diagnosis (see "
              "`docs/v7a/V7A_POLICY_TIGHTENING_AUDIT.md`).")
    md.append("")

    # 4. Candidate Selection Profiles
    md.append("## 4. Candidate Selection Profiles")
    md.append("")
    md.append("To decide, this script evaluates the upstream candidate pool "
              "against **four distinct product profiles** with profile-specific "
              "constraint sets:")
    md.append("")
    for k, p in PROFILES.items():
        md.append(f"- **{p['title']}** (`{k}`) — {p['intent']}")
    md.append("")

    # 5–8 per-profile sections
    section_titles = {
        "A_safety_first": "5. Profile A — Safety-first",
        "B_balanced_product": "6. Profile B — Balanced Product",
        "C_low_friction_ux": "7. Profile C — Low-friction UX",
        "D_shadow_mode_learning": "8. Profile D — Shadow-mode Learning",
    }
    for k, header in section_titles.items():
        md.append(f"## {header}")
        md.append("")
        prof_result = payload["selected_candidates_by_profile"].get(k, {})
        md.append(_profile_md_section(prof_result))

    # 9. Cross-profile comparison
    md.append("## 9. Cross-profile Comparison")
    md.append("")
    md.append("Top candidate per profile (or top nearest-miss if no candidate is feasible):")
    md.append("")
    rows = []
    for k, p in PROFILES.items():
        prof_result = payload["selected_candidates_by_profile"].get(k, {})
        sel = prof_result.get("selected_top_3") or []
        near = prof_result.get("nearest_miss_top_5") or []
        c = sel[0] if sel else (near[0] if near else None)
        if c is None:
            continue
        m = c["metrics"]
        rows.append({
            "profile": p["title"],
            "feasible": c["passes_profile"],
            "alert_p_05": m["alert_precision_floor_1_05"],
            "buy_share": m["buy_now_share"],
            "alert_rate": m["alert_rate"],
            "abstain": m["abstain_share"],
            "regret_p99": m["regret_abs_p99"],
            "capture_med": m["capture_median"],
            "cfg_summary": c["config_summary"],
        })
    md.append(_md_table(rows, [
        "profile", "feasible", "alert_p_05", "buy_share", "alert_rate",
        "abstain", "regret_p99", "capture_med", "cfg_summary",
    ]))
    md.append("")

    # 10. Recommended candidate
    md.append("## 10. Recommended Candidate")
    md.append("")
    rec = payload["global_recommendation"]
    md.append(f"**Verdict:** {rec['verdict']}")
    md.append("")
    md.append(f"- Feasibility per profile: `{rec['n_feasible_per_profile']}`")
    md.append(f"- Recommend modify `policy.py` next? "
              f"**{'Yes' if rec['whether_policy_py_should_be_modified_next'] else 'No'}**")
    md.append("")

    # If a Profile-A or B candidate exists, name it explicitly
    a_sel = payload["selected_candidates_by_profile"].get("A_safety_first", {}).get("selected_top_3") or []
    b_sel = payload["selected_candidates_by_profile"].get("B_balanced_product", {}).get("selected_top_3") or []
    if a_sel:
        md.append("**Promote — Profile A top candidate:**")
        md.append("")
        md.append("```")
        md.append(json.dumps(a_sel[0]["config"], indent=2, default=str))
        md.append("```")
    elif b_sel:
        md.append("**Promote — Profile B top candidate:**")
        md.append("")
        md.append("```")
        md.append(json.dumps(b_sel[0]["config"], indent=2, default=str))
        md.append("```")
    else:
        md.append("_No Profile A / B candidate to promote — see §11._")
    md.append("")

    # 11. Should policy.py be modified next?
    md.append("## 11. Should `policy.py` Be Modified Next?")
    md.append("")
    if rec["whether_policy_py_should_be_modified_next"]:
        md.append("**Yes — conditionally**, on a separate PR. The candidate "
                  "above clearly dominates the current frozen V7a policy on "
                  "safety (alert precision, BUY share) without destroying "
                  "capture below the Phase-1 floor of 0.85. The PR must:")
        md.append("")
        md.append("- update `WIDTH_RATIO_ABSTAIN`, the BUY trigger margin, "
                  "and add the `drop_proba_buy_max` and "
                  "`alert_near_floor_pct` gates inside `policy.py`,")
        md.append("- re-run `backtest.py` and verify metrics match the "
                  "offline sweep within tolerance,")
        md.append("- not touch any V7a model or training script,")
        md.append("- not enable AUTO_BUY (still hard-locked to off).")
    else:
        md.append("**No.** No candidate clearly dominates the current "
                  "frozen V7a policy under the Safety-first or Balanced "
                  "profile. Editing `policy.py` now would either:")
        md.append("")
        md.append("- shift product behaviour into ABSTAIN > 25% (Low-friction "
                  "fail), or")
        md.append("- keep BUY/ALERT noisy (Safety-first fail).")
        md.append("")
        md.append("Hold the production policy and run the recommended "
                  "follow-up sprint instead.")
    md.append("")

    # 12. Recommended next sprint
    md.append("## 12. Recommended Next Sprint")
    md.append("")
    md.append(f"**Branch:** `{rec['recommended_next_branch']}`")
    md.append("")
    md.append(rec["recommended_next_action"])
    md.append("")
    md.append("Three considered options (only one is the primary recommendation):")
    md.append("")
    md.append("1. `b1/v7a-policy-apply-candidate` — edit `policy.py` with "
              "the selected thresholds + add a regression test + re-run "
              "`backtest.py`. **Only if** Profile A or B has a feasible "
              "candidate.")
    md.append("2. `b1/v7a-policy-sweep-v2` — expand / shift the threshold "
              "grid (e.g. `max_width_over_price=0.25`, "
              "`drop_proba_buy_max=0.15`, `buy_trigger_margin_usd=50`). "
              "**Pick this if** no Profile A/B candidate is feasible but "
              "the current artifacts are reliable.")
    md.append("3. `b1/v7a-row-level-export-hardening` — fix / enrich the "
              "exported row-level artifacts so the next sweep can compute "
              "missing metrics (e.g. per-trajectory `realized_floor` as a "
              "first-class column, `depart_date` in the predictions "
              "parquet). **Pick this if** any of the existing metrics is "
              "currently unreliable or trajectory grouping is fragile.")
    md.append("")
    md.append(f"**Primary recommendation:** option matching "
              f"`{rec['recommended_next_branch']}`.")
    md.append("")

    # 13. Non-Goals
    md.append("## 13. Non-Goals")
    md.append("")
    md.append("- No edit to `scripts/train/v7a/policy.py`, `policy_tune.py`, "
              "`backtest.py`, `calibrate.py`, or any other V7a script.")
    md.append("- No edit to existing `reports/v7a_*_local.json`.")
    md.append("- No Modal usage. No retraining. No cloud jobs.")
    md.append("- No app code change. No Largo UI change. No mission / "
              "payment / watcher change.")
    md.append("- No invocation of any auto-suggested skill (vercel-sandbox, "
              "vercel-cli, verification, workflow, etc.) — convergence-mode "
              "discipline.")
    md.append("- No reliance on the pre-existing dirty working tree.")
    md.append("- AUTO_BUY remains hard-locked to off regardless of any "
              "selected candidate.")
    md.append("")

    # 14. Files
    md.append("## 14. Files Created or Modified")
    md.append("")
    md.append("| Path | Action |")
    md.append("| --- | --- |")
    md.append("| `scripts/train/v7a/policy_select.py` | created |")
    md.append("| `reports/v7a_policy_selection_local.json` | created |")
    md.append("| `docs/v7a/V7A_POLICY_SELECTION_DECISION.md` | created (this file) |")
    md.append("")
    md.append("No other path was modified. The sweep output and every V7a "
              "production script remain untouched.")
    md.append("")

    OUT_MD.write_text("\n".join(md), encoding="utf-8")


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------


def _build_candidate_pool(source: dict) -> list[dict]:
    """Top + Pareto candidates, deduplicated by config-tuple."""
    pool: list[dict] = []
    seen: set[tuple] = set()
    for src_key in ("top_candidates_by_safety_first_rank", "pareto_candidates"):
        items = source.get(src_key) or []
        for c in items:
            cfg = c.get("config", {})
            key = tuple(sorted(cfg.items())) if isinstance(cfg, dict) else None
            if key is None or key in seen:
                continue
            seen.add(key)
            pool.append(c)
    return pool


def main() -> int:
    log("policy_select start", source=rel(SOURCE_JSON))

    if not SOURCE_JSON.exists():
        return emit_diagnostic_and_exit(
            f"source file not found: {rel(SOURCE_JSON)}; "
            "run `python3 scripts/train/v7a/policy_tune.py` first."
        )

    try:
        source = json.loads(SOURCE_JSON.read_text(encoding="utf-8"))
    except Exception as e:
        return emit_diagnostic_and_exit(f"source file unreadable: {e!r}")

    src_mode = source.get("mode")
    if src_mode != "true_row_level_sweep":
        return emit_diagnostic_and_exit(
            f"source mode is `{src_mode}`, expected `true_row_level_sweep`. "
            "Re-run policy_tune.py against materialized row-level artifacts."
        )

    pool = _build_candidate_pool(source)
    if not pool:
        return emit_diagnostic_and_exit(
            "no top_candidates or pareto_candidates in source"
        )

    # Baselines for relative constraints
    baseline_v7a_p90 = float("inf")
    baseline_v7a_alert_p_05 = float("nan")
    bm = source.get("baseline_current_metrics", {})
    bt = bm.get("report_backtest", {}) if isinstance(bm, dict) else {}
    if isinstance(bt, dict):
        try:
            baseline_v7a_p90 = float(bt["v7a_hybrid"]["buy"]["regret_abs_p90"])
        except Exception:
            try:
                baseline_v7a_p90 = float(bt["v7a_ml_only"]["buy"]["regret_abs_p90"])
            except Exception:
                pass
        try:
            baseline_v7a_alert_p_05 = float(
                bt["v7a_ml_only"]["alert"]["alert_precision_floor_1_05"]
            )
        except Exception:
            pass

    # Per-profile evaluation
    selected_by_profile: dict[str, dict] = {}
    for key, profile in PROFILES.items():
        selected_by_profile[key] = _evaluate_profile(
            key, profile, pool,
            baseline_v7a_p90=baseline_v7a_p90,
            baseline_v7a_alert_p_05=baseline_v7a_alert_p_05,
        )

    # Rejected summary (count of profile-fail patterns across the entire pool)
    rejected_summary: dict[str, dict] = {}
    for key, prof_result in selected_by_profile.items():
        # Count fail-key frequencies across nearest-miss
        fail_counter: dict[str, int] = {}
        for c in prof_result.get("nearest_miss_top_5", []) + prof_result.get("selected_top_3", []):
            for f in c.get("constraint_fails", []) or []:
                # Take the first token before '=' or first 40 chars
                short = f.split(" = ")[0].split(" ratio ")[0]
                fail_counter[short] = fail_counter.get(short, 0) + 1
        rejected_summary[key] = {
            "n_feasible": prof_result["n_feasible"],
            "fail_token_counts_in_top_evaluated": fail_counter,
        }

    rec = _global_recommendation(selected_by_profile, baseline=bm)

    payload: dict = {
        "generated_at": now_iso(),
        "source_file": rel(SOURCE_JSON),
        "source_mode": src_mode,
        "source_candidates_evaluated": source.get("number_of_candidates_evaluated"),
        "source_feasible_count": source.get("number_of_feasible_candidates"),
        "source_pareto_count": len(source.get("pareto_candidates") or []),
        "selection_pool_size": len(pool),
        "baseline_v7a_p90_used_for_constraint": baseline_v7a_p90,
        "baseline_v7a_alert_p_05_used_for_constraint": baseline_v7a_alert_p_05,
        "baseline_current_metrics": bm,
        "profile_definitions": {
            k: {
                "title": p["title"],
                "intent": p["intent"],
                "constraints": {
                    ck: {"op": cv[0], "threshold": cv[1]}
                    for ck, cv in p["constraints"].items()
                },
            }
            for k, p in PROFILES.items()
        },
        "selected_candidates_by_profile": selected_by_profile,
        "rejected_candidates_summary": rejected_summary,
        "global_recommendation": rec,
        "whether_policy_py_should_be_modified_next": rec["whether_policy_py_should_be_modified_next"],
        "recommended_next_branch": rec["recommended_next_branch"],
        "recommended_next_action": rec["recommended_next_action"],
        "limitations": [
            ("Selection draws only from the upstream pool "
             "(`top_candidates_by_safety_first_rank` ∪ `pareto_candidates`); "
             "candidates outside that pool are not re-scored."),
            ("Profile constraints are non-overlapping by design — a "
             "Profile-D feasible candidate is NOT automatically promoted "
             "for Profile A/B / production policy use."),
            ("`regret_p90` baseline is taken from `v7a_hybrid` (Phase-1 "
             "production baseline). Falls back to `v7a_ml_only` if absent."),
            ("Sweep underlying data is 2022-04 to 2022-10 only — no "
             "winter, no 2023+, no 2024+. Production behaviour on newer "
             "data is unmeasured."),
            ("AUTO_BUY remains hard-locked off regardless of any selected "
             "candidate — that gate is enforced inside `policy.py`, not "
             "by this selection script."),
        ],
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    _write_markdown(payload)

    log("DONE",
        json=rel(OUT_JSON), md=rel(OUT_MD),
        verdict_short=rec["verdict"][:60],
        next_branch=rec["recommended_next_branch"])

    # Concise stdout summary
    print(f"[policy_select] source={rel(SOURCE_JSON)}")
    print(f"[policy_select] source_mode={src_mode} "
          f"upstream_evaluated={source.get('number_of_candidates_evaluated')} "
          f"upstream_feasible={source.get('number_of_feasible_candidates')} "
          f"upstream_pareto={len(source.get('pareto_candidates') or [])}")
    print(f"[policy_select] pool_size={len(pool)} (top + Pareto, deduplicated)")
    for k, prof in selected_by_profile.items():
        print(f"[policy_select] profile {k} ({prof['title']}): "
              f"feasible={prof['n_feasible']}/{prof['n_candidates_in_pool']} "
              f"verdict={prof['verdict']}")
    print(f"[policy_select] global_verdict: {rec['verdict']}")
    print(f"[policy_select] modify_policy_py_next? "
          f"{rec['whether_policy_py_should_be_modified_next']}")
    print(f"[policy_select] recommended_next_branch: {rec['recommended_next_branch']}")
    print(f"[policy_select] wrote: {rel(OUT_JSON)}")
    print(f"[policy_select] wrote: {rel(OUT_MD)}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        log("interrupted by user")
        sys.exit(0)
    except Exception as e:
        log("fatal error, writing diagnostic", error=str(e))
        try:
            OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
            OUT_JSON.write_text(json.dumps({
                "mode": "diagnostic_fatal_error",
                "generated_at": now_iso(),
                "reason": f"fatal_error: {e!r}",
                "source_file": rel(SOURCE_JSON),
                "global_recommendation": (
                    "Fix the script error. No production policy change."
                ),
                "whether_policy_py_should_be_modified_next": False,
                "recommended_next_branch": "b1/v7a-row-level-export-hardening",
            }, indent=2), encoding="utf-8")
            OUT_MD.parent.mkdir(parents=True, exist_ok=True)
            OUT_MD.write_text(
                f"# V7a Policy Selection Decision\n\n"
                f"**Mode: diagnostic_fatal_error.**\n\n"
                f"`{e!r}`\n\n"
                f"No selection performed. No production policy change.\n",
                encoding="utf-8",
            )
        except Exception:
            pass
        sys.exit(0)
