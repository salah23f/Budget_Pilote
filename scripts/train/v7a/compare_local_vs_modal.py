"""
compare_local_vs_modal.py — compare métriques V7a local vs Modal.

Lit les paires `reports/v7a_<basename>_local.json` et
`reports/v7a_<basename>_modal.json`, extrait les métriques clés, et produit :

  reports/v7a_compare_local_vs_modal.json

Résultats clés :
  - Dataset : n_rows, n_routes, date range (before/after match si les deux
    sont sur le même SAMPLE_EVERY attendu).
  - Baselines : delta regret / capture par baseline.
  - LGBM : delta MAE q50, pinball, coverage 10/90.
  - Conformal : delta coverage_marginal, width/price.
  - Backtest : delta capture_median, regret_p90, alert_precision.

Verdict global : est-ce que le full-data apporte un gain stat sig ≥ 1 pp
sur capture_median ? Cf. docs/V7A_LOCAL_VS_MODAL.md.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent))
from _env import REPO_ROOT, V7A_REPORTS_DIR, log  # noqa: E402


REPORTS_DIR = REPO_ROOT / "reports"


def _load(basename: str, tag: str) -> dict | None:
    p = REPORTS_DIR / f"v7a_{basename}_{tag}.json"
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def _diff(a: float | None, b: float | None) -> float | None:
    if a is None or b is None:
        return None
    return round(b - a, 6)


def compare() -> dict[str, Any]:
    out: dict[str, Any] = {"pairs": {}}

    # ---- dataset / sampling ----
    ds_local = _load("dataset_sampling_report", "local")
    ds_modal = _load("dataset_sampling_report", "modal")
    if ds_local and ds_modal:
        out["pairs"]["dataset"] = {
            "local_n_rows": ds_local["after"]["n_rows"],
            "modal_n_rows": ds_modal["after"]["n_rows"],
            "ratio_modal_over_local": round(
                ds_modal["after"]["n_rows"] / max(1, ds_local["after"]["n_rows"]),
                3,
            ),
            "local_sampling_verdict": ds_local["comparison"]["verdict"],
            "modal_sampling_verdict": ds_modal["comparison"]["verdict"],
        }

    # ---- baselines ----
    bl_local = _load("baselines", "local")
    bl_modal = _load("baselines", "modal")
    if bl_local and bl_modal:
        baseline_cmp = {}
        for name in set(bl_local) | set(bl_modal):
            L = bl_local.get(name, {})
            M = bl_modal.get(name, {})
            baseline_cmp[name] = {
                "capture_median_local": L.get("capture_median"),
                "capture_median_modal": M.get("capture_median"),
                "delta_capture_median": _diff(L.get("capture_median"), M.get("capture_median")),
                "regret_rel_p90_local": L.get("regret_rel_p90"),
                "regret_rel_p90_modal": M.get("regret_rel_p90"),
                "delta_regret_rel_p90": _diff(L.get("regret_rel_p90"), M.get("regret_rel_p90")),
            }
        out["pairs"]["baselines"] = baseline_cmp

    # ---- lgbm ----
    lg_local = _load("lgbm_metrics", "local")
    lg_modal = _load("lgbm_metrics", "modal")
    if lg_local and lg_modal:
        out["pairs"]["lgbm"] = {
            "val_mae_q50_local": lg_local["val"]["mae_q50"],
            "val_mae_q50_modal": lg_modal["val"]["mae_q50"],
            "delta_val_mae_q50": _diff(lg_local["val"]["mae_q50"], lg_modal["val"]["mae_q50"]),
            "val_coverage_10_90_local": lg_local["val"]["coverage_10_90"],
            "val_coverage_10_90_modal": lg_modal["val"]["coverage_10_90"],
            "n_train_local": lg_local["n_train"],
            "n_train_modal": lg_modal["n_train"],
        }

    # ---- conformal ----
    cf_local = _load("conformal_metrics", "local")
    cf_modal = _load("conformal_metrics", "modal")
    if cf_local and cf_modal:
        alpha_tag = "alpha_10"
        if alpha_tag in cf_local.get("alpha", {}) and alpha_tag in cf_modal.get("alpha", {}):
            out["pairs"]["conformal_alpha_10"] = {
                "coverage_marginal_local": cf_local["alpha"][alpha_tag]["coverage_marginal"],
                "coverage_marginal_modal": cf_modal["alpha"][alpha_tag]["coverage_marginal"],
                "width_over_price_local": cf_local["alpha"][alpha_tag]["width_over_price_mean"],
                "width_over_price_modal": cf_modal["alpha"][alpha_tag]["width_over_price_mean"],
            }

    # ---- backtest ----
    bt_local = _load("backtest", "local")
    bt_modal = _load("backtest", "modal")
    if bt_local and bt_modal:
        bL = bt_local.get("v7a_buy", {})
        bM = bt_modal.get("v7a_buy", {})
        aL = bt_local.get("v7a_alert", {})
        aM = bt_modal.get("v7a_alert", {})
        out["pairs"]["backtest"] = {
            "buy": {
                "capture_median_local": bL.get("capture_median"),
                "capture_median_modal": bM.get("capture_median"),
                "delta_capture_median": _diff(bL.get("capture_median"), bM.get("capture_median")),
                "regret_rel_p90_local": bL.get("regret_rel_p90"),
                "regret_rel_p90_modal": bM.get("regret_rel_p90"),
                "delta_regret_rel_p90": _diff(bL.get("regret_rel_p90"), bM.get("regret_rel_p90")),
                "capture_median_ci95_local": bL.get("capture_median_ci95"),
                "capture_median_ci95_modal": bM.get("capture_median_ci95"),
            },
            "alert": {
                "alert_precision_local": aL.get("alert_precision"),
                "alert_precision_modal": aM.get("alert_precision"),
                "delta_alert_precision": _diff(aL.get("alert_precision"), aM.get("alert_precision")),
                "alert_useless_rate_local": aL.get("alert_useless_rate"),
                "alert_useless_rate_modal": aM.get("alert_useless_rate"),
            },
        }

    # ---- verdict ----
    bt = out["pairs"].get("backtest", {}).get("buy", {})
    delta_capture = bt.get("delta_capture_median")
    ci_local = bt.get("capture_median_ci95_local")
    ci_modal = bt.get("capture_median_ci95_modal")
    disjoint = None
    if ci_local and ci_modal and len(ci_local) == 2 and len(ci_modal) == 2:
        # CI95 disjoints = gain significatif à 5 %
        disjoint = (ci_modal[0] > ci_local[1]) or (ci_local[0] > ci_modal[1])
    verdict = {
        "modal_worth_it": (delta_capture is not None and delta_capture >= 0.01),
        "statistically_disjoint_ci95": disjoint,
        "delta_capture_median": delta_capture,
        "notes": [
            "modal_worth_it = True if Modal full-data gains ≥ 1 pp capture_median on test hold-out.",
            "statistically_disjoint_ci95 = True if bootstrap CI95 of the two capture_medians do not overlap.",
        ],
    }
    out["verdict"] = verdict

    return out


def main() -> None:
    V7A_REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    result = compare()
    out_path = V7A_REPORTS_DIR / "v7a_compare_local_vs_modal.json"
    out_path.write_text(json.dumps(result, indent=2, default=str), encoding="utf-8")
    log("comparison written", path=str(out_path))
    # Résumé console
    v = result.get("verdict", {})
    log(
        "verdict",
        modal_worth_it=v.get("modal_worth_it"),
        delta_capture_median=v.get("delta_capture_median"),
        ci95_disjoint=v.get("statistically_disjoint_ci95"),
    )


if __name__ == "__main__":
    main()
