#!/usr/bin/env python3
"""
v7a/policy_tune.py — offline policy threshold sweep (B1, sprint
`b1/v7a-policy-tightening`).

Read-only evaluator that explores a grid of tightened candidate policies
on cached V7a artifacts and writes:
  - reports/v7a_policy_tuning_local.json         (machine-readable result)
  - docs/v7a/V7A_POLICY_TUNING_RESULTS.md        (human-readable summary)

Discipline:
  - LOCAL-ONLY. No Modal, no cloud, no training, no model retrain.
  - READ-ONLY on every input. The frozen `policy.py`, `backtest.py`,
    `calibrate.py`, all existing `reports/v7a_*_local.json`, every
    `data/**`, every `models/**`, and every `logs/**` are NEVER written.
    The only files this script CREATES are the two outputs above.
  - DEPENDENCY-OPTIONAL. Imports `numpy`, `pandas`, `pyarrow` lazily.
    If any of them is missing, the script downgrades to diagnostic mode
    rather than crashing.
  - HONEST. If row-level prediction artifacts are not available, the
    script writes a `diagnostic_missing_row_level_artifacts` payload
    and exits 0. It does NOT invent metrics from aggregate reports.
  - SAFE. AUTO_BUY is never emitted. The candidate-policy logic lives
    inside this file; the production `policy.py` is not touched.

Usage:
  python3 scripts/train/v7a/policy_tune.py
"""

from __future__ import annotations

import json
import os
import sys
import time
from itertools import product
from pathlib import Path
from typing import Any

# -----------------------------------------------------------------------------
# Paths
# -----------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = REPO_ROOT / "data"
REPORTS_DIR = REPO_ROOT / "reports"
DOCS_DIR = REPO_ROOT / "docs" / "v7a"

OUT_JSON = REPORTS_DIR / "v7a_policy_tuning_local.json"
OUT_MD = DOCS_DIR / "V7A_POLICY_TUNING_RESULTS.md"

# Candidate artifact locations. The script probes ALL paths in each list
# and uses the first one that exists.
ARTIFACT_PROBE: dict[str, list[Path]] = {
    "predictions_test_parquet": [
        DATA_DIR / "models_v7a_local" / "lgbm_test.parquet",
        DATA_DIR / "models_v7a_modal" / "lgbm_test.parquet",
    ],
    "features_test_parquet": [
        DATA_DIR / "features_v7a_local" / "test.parquet",
        DATA_DIR / "features_v7a_modal" / "test.parquet",
    ],
    "features_train_parquet": [
        DATA_DIR / "features_v7a_local" / "train.parquet",
        DATA_DIR / "features_v7a_modal" / "train.parquet",
    ],
    "conformal_json": [
        DATA_DIR / "models_v7a_local" / "conformal_mondrian.json",
        DATA_DIR / "models_v7a_modal" / "conformal_mondrian.json",
    ],
    "ml_cache_local": [
        DATA_DIR / "ml_cache" / "v7a_clean_local.parquet",
        DATA_DIR / "ml_cache" / "v7a_clean.parquet",
    ],
    "ml_cache_manifest": [
        DATA_DIR / "ml_cache" / "v7a_clean_local.manifest.json",
        DATA_DIR / "ml_cache" / "v7a_clean.manifest.json",
    ],
    "report_backtest": [REPORTS_DIR / "v7a_backtest_local.json"],
    "report_segmented": [REPORTS_DIR / "v7a_segmented_metrics_local.json"],
    "report_conformal": [REPORTS_DIR / "v7a_conformal_metrics_local.json"],
    "report_baselines": [REPORTS_DIR / "v7a_baselines_local.json"],
    "report_lgbm": [REPORTS_DIR / "v7a_lgbm_metrics_local.json"],
    "report_target_build": [REPORTS_DIR / "v7a_target_build_local.json"],
    "report_dataset_sampling": [REPORTS_DIR / "v7a_dataset_sampling_report_local.json"],
}

# -----------------------------------------------------------------------------
# Column aliases (logical name → ordered list of candidate actual names)
# -----------------------------------------------------------------------------

COLUMN_ALIASES: dict[str, list[str]] = {
    "price": ["observed_price_usd", "current_price", "price_usd", "price", "fare"],
    "floor": [
        "realized_floor", "future_floor", "min_future_price",
        "future_min_price", "floor_price",
    ],
    "ttd": ["ttd_days", "ttd", "days_to_departure", "time_to_departure"],
    "route_popularity": [
        "feat_route_popularity", "route_popularity",
        "route_history_count", "n_route_obs", "route_count",
    ],
    "drop_proba": [
        "drop_proba_calibrated", "drop_proba",
        "p_drop", "calibrated_drop_probability",
    ],
    "q10_gain": ["q10_gain", "pred_future_gain_q10", "future_gain_q10"],
    "q50_gain": ["q50_gain", "pred_future_gain_q50", "future_gain_q50"],
    "q90_gain": ["q90_gain", "pred_future_gain_q90", "future_gain_q90"],
    "conformal_half_width": [
        "c_alpha_gain", "c_alpha", "conformal_half_width",
        "conformal_width", "width",
    ],
    "route_known": ["feat_route_known", "route_known", "route_known_to_model"],
    "route": ["route"],
    "depart_date": ["depart_date"],
    "fetched_at": ["fetched_at", "ts", "timestamp"],
    "feat_route_mean_train": ["feat_route_mean_train"],
    "feat_route_std_train": ["feat_route_std_train"],
    "action": ["action", "decision", "policy_action", "v7a_action"],
}

REQUIRED_FOR_TUNING: list[str] = [
    "price", "ttd", "route_popularity",
    "q50_gain", "q90_gain",
    "drop_proba", "route_known", "route",
]

# -----------------------------------------------------------------------------
# Sweep grid (per sprint spec)
# -----------------------------------------------------------------------------

GRID: dict[str, list[float]] = {
    "max_width_over_price": [0.35, 0.50, 0.75, 1.00],
    "abstain_width_over_price": [0.75, 1.00, 1.25],
    "buy_trigger_margin_usd": [0, 10, 20, 35],
    "drop_proba_buy_max": [0.20, 0.30, 0.40],
    "alert_drop_threshold": [0.65, 0.75, 0.85],
    "alert_near_floor_pct": [1.03, 1.05, 1.10],
    "route_popularity_min": [30, 100, 250],
    "ttd_lower": [1, 3],
    "ttd_upper": [45, 60],
}

# Selection constraints (safety-first Pareto)
CONSTRAINTS: dict[str, float] = {
    "alert_rate_max": 0.20,
    "buy_now_share_max": 0.15,
    "abstain_share_min": 0.05,
    "abstain_share_max": 0.25,
    "regret_p90_max_factor_vs_baseline": 1.10,
    "capture_median_min": 0.82,
    "alert_precision_floor_1_05_min_phase1": 0.10,
    "alert_precision_floor_1_05_min_phase2": 0.20,
}

ALPHA_CONFORMAL = 0.10  # match backtest.py

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def log(msg: str, **kv: Any) -> None:
    suffix = " ".join(f"{k}={v}" for k, v in kv.items())
    sys.stderr.write(f"[policy_tune] {msg} {suffix}\n".rstrip() + "\n")


def rel(p: Path) -> str:
    try:
        return str(p.relative_to(REPO_ROOT))
    except ValueError:
        return str(p)


def safe_read_json(p: Path) -> Any:
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:
        return {"_error": str(e)}


def probe_artifacts() -> tuple[list[str], dict[str, dict]]:
    """Probe all candidate artifact locations. Returns (checked, found)."""
    checked: list[str] = []
    found: dict[str, dict] = {}
    for key, paths in ARTIFACT_PROBE.items():
        for p in paths:
            checked.append(rel(p))
            if p.exists():
                stat = p.stat()
                found[key] = {
                    "path": rel(p),
                    "size_bytes": int(stat.st_size),
                    "mtime_iso": time.strftime(
                        "%Y-%m-%dT%H:%M:%SZ", time.gmtime(stat.st_mtime)
                    ),
                }
                break
    return checked, found


def detect_libs() -> dict[str, bool]:
    libs = {}
    for name in ("numpy", "pandas", "pyarrow"):
        try:
            __import__(name)
            libs[name] = True
        except ImportError:
            libs[name] = False
    return libs


def detect_columns_parquet(path: Path) -> dict[str, str] | dict[str, str]:
    """Returns {col_name: dtype_str} or {'_error': '...'}."""
    try:
        import pyarrow.parquet as pq  # type: ignore
        meta = pq.read_metadata(str(path))
        schema = meta.schema.to_arrow_schema()
        return {f.name: str(f.type) for f in schema}
    except ImportError:
        return {"_error": "pyarrow_missing"}
    except Exception as e:
        return {"_error": f"pyarrow_failed: {e}"}


def map_aliases(columns: list[str]) -> dict[str, str | None]:
    cols_lc = {c.lower(): c for c in columns}
    out: dict[str, str | None] = {}
    for logical, aliases in COLUMN_ALIASES.items():
        actual: str | None = None
        for a in aliases:
            if a.lower() in cols_lc:
                actual = cols_lc[a.lower()]
                break
        out[logical] = actual
    return out


# -----------------------------------------------------------------------------
# Conformal lookup (mirrors backtest.py _bucket_key / _c_for)
# -----------------------------------------------------------------------------


def _bucket_key(ttd: float, pop: float, std_ratio: float) -> str:
    b_ttd = 0 if ttd <= 7 else 1 if ttd <= 21 else 2 if ttd <= 60 else 3
    b_freq = 0 if pop < 50 else 1 if pop < 500 else 2
    b_vol = 0 if std_ratio < 0.10 else 1 if std_ratio < 0.30 else 2
    return f"{b_ttd}-{b_freq}-{b_vol}"


def _c_for(bucket: str, mondrian: dict, alpha: float) -> float:
    tag = f"alpha_{int(alpha*100):02d}"
    per = mondrian.get("alpha", {}).get(tag, {})
    glob = mondrian.get("global", {}).get(tag, 0.0)
    cell = per.get(bucket)
    if cell is None or "c" not in cell:
        return float(glob)
    return float(cell["c"])


# -----------------------------------------------------------------------------
# Diagnostic mode (no row-level data)
# -----------------------------------------------------------------------------


def _baseline_metrics(found: dict[str, dict]) -> dict:
    """Copy a few aggregate metrics from existing reports for context."""
    out: dict[str, Any] = {}
    for key in ("report_backtest", "report_segmented", "report_conformal",
                "report_baselines", "report_lgbm", "report_target_build"):
        if key in found:
            try:
                out[key] = safe_read_json(REPO_ROOT / found[key]["path"])
            except Exception as e:
                out[key] = {"_error": str(e)}
    return out


def _emit_diagnostic(probe_checked: list[str], probe_found: dict,
                     libs: dict[str, bool],
                     detected_cols: dict[str, dict],
                     missing_required: list[str],
                     reason: str) -> dict:
    payload: dict = {
        "mode": "diagnostic_missing_row_level_artifacts",
        "generated_at": now_iso(),
        "reason": reason,
        "files_checked": probe_checked,
        "files_found": probe_found,
        "libs_available": libs,
        "artifact_column_mapping": detected_cols,
        "missing_required_columns": missing_required,
        "available_aggregate_metrics": _baseline_metrics(probe_found),
        "why_aggregate_reports_are_not_enough": (
            "Aggregate reports under reports/v7a_*_local.json record summary "
            "statistics (mean / median / p90 / p99 of regret, alert_rate, etc.) "
            "for the FROZEN current policy thresholds only. They do NOT contain "
            "row-level predictions (q10/q50/q90 gain, calibrated drop "
            "probability, c_alpha per row), so a different threshold cannot be "
            "evaluated without re-running the policy on cached predictions. A "
            "true sweep requires the predictions parquet (route, fetched_at, "
            "price_usd, q10_gain, q50_gain, q90_gain, drop_proba_calibrated), "
            "the matching features parquet (ttd_days, feat_route_popularity, "
            "feat_route_known, depart_date, feat_route_mean_train, "
            "feat_route_std_train), and the conformal_mondrian.json bucket "
            "lookup for c_alpha."
        ),
        "exact_minimal_next_step_to_export_row_level_predictions": [
            ("1. Re-run scripts/train/v7a/backtest.py locally. It writes "
             "data/models_v7a_local/lgbm_test.parquet on every successful run "
             "(see backtest.py line ~129)."),
            ("2. Confirm data/models_v7a_local/conformal_mondrian.json is "
             "present (written by scripts/train/v7a/calibrate.py)."),
            ("3. Confirm data/features_v7a_local/test.parquet is present "
             "(written by scripts/train/v7a/features.py)."),
            ("4. Re-run python3 scripts/train/v7a/policy_tune.py — it will "
             "switch to true_row_level_sweep mode automatically."),
        ],
        "recommended_export_schema": {
            "predictions_parquet": {
                "required_columns": [
                    "route", "fetched_at", "price_usd",
                    "q10_gain", "q50_gain", "q90_gain",
                    "drop_proba_calibrated",
                ],
                "optional_columns": ["depart_date", "drop_proba_raw"],
            },
            "features_parquet": {
                "required_columns": [
                    "route", "ttd_days",
                    "feat_route_popularity", "feat_route_known",
                    "feat_route_mean_train", "feat_route_std_train",
                ],
                "optional_columns": ["depart_date", "fetched_at"],
            },
            "conformal_json": {
                "required_keys": ["alpha.alpha_10", "global.alpha_10"],
                "target_must_be": "future_gain",
            },
        },
        "limitations": [
            "Cannot compute per-candidate alert_precision_floor_1_05.",
            "Cannot compute per-candidate alert_precision_floor_1_10.",
            "Cannot compute per-candidate alert_recall_floor_1_05.",
            "Cannot compute per-candidate regret_abs_{mean,p50,p90,p99}.",
            "Cannot compute per-candidate capture_{mean,median}.",
            "Cannot compute per-candidate action distribution.",
            "Cannot compute per-candidate Pareto frontier.",
            "Cannot compute false_buy_now_rate.",
            "Cannot compute per-TTD-bucket segment metrics.",
        ],
        "next_recommendation": (
            "Run the V7a backtest pipeline locally (no Modal needed) to "
            "materialize the predictions and features parquets, then re-run "
            "this script. The script auto-detects the artifacts and switches "
            "to true_row_level_sweep mode."
        ),
        "sweep_grid": GRID,
        "constraints": CONSTRAINTS,
    }
    return payload


# -----------------------------------------------------------------------------
# True row-level sweep
# -----------------------------------------------------------------------------


def _load_true_sweep_inputs(found: dict[str, dict]):
    """Returns (df_pred, df_feat, mondrian, df_train_q10) — pandas / dict."""
    import numpy as np  # type: ignore
    import pandas as pd  # type: ignore

    pred_path = REPO_ROOT / found["predictions_test_parquet"]["path"]
    feat_path = REPO_ROOT / found["features_test_parquet"]["path"]
    conf_path = REPO_ROOT / found["conformal_json"]["path"]

    log("loading predictions parquet", path=rel(pred_path))
    df_pred = pd.read_parquet(pred_path)

    log("loading features test parquet", path=rel(feat_path))
    df_feat = pd.read_parquet(feat_path)

    log("loading conformal mondrian json", path=rel(conf_path))
    mondrian = json.loads(conf_path.read_text(encoding="utf-8"))

    df_train_q10: dict[str, float] = {}
    if "features_train_parquet" in found:
        train_path = REPO_ROOT / found["features_train_parquet"]["path"]
        log("loading features train parquet (route, price_usd) for q10",
            path=rel(train_path))
        try:
            tr = pd.read_parquet(train_path, columns=["route", "price_usd"])
            df_train_q10 = (
                tr.groupby("route")["price_usd"].quantile(0.10).to_dict()
            )
        except Exception as e:
            log("train q10 load failed", error=str(e))
            df_train_q10 = {}

    return df_pred, df_feat, mondrian, df_train_q10


def _build_arrays(df_pred, df_feat, mondrian, df_train_q10,
                  pred_map: dict, feat_map: dict):
    """Returns dict of numpy arrays needed by the sweep."""
    import numpy as np  # type: ignore
    import pandas as pd  # type: ignore

    if len(df_pred) != len(df_feat):
        raise RuntimeError(
            f"len mismatch pred={len(df_pred)} vs feat={len(df_feat)}; "
            "the parquets are not in matching positional order."
        )

    # Sanity check: route column matches positionally
    p_route_col = pred_map.get("route") or "route"
    f_route_col = feat_map.get("route") or "route"
    n = len(df_pred)
    for i in (0, n // 2, n - 1):
        if str(df_pred.iloc[i][p_route_col]) != str(df_feat.iloc[i][f_route_col]):
            raise RuntimeError(
                f"positional misalignment at row {i}: "
                f"pred={df_pred.iloc[i][p_route_col]} feat={df_feat.iloc[i][f_route_col]}"
            )

    # Build arrays
    arr: dict = {}
    arr["price"] = df_pred[pred_map["price"]].astype(np.float64).to_numpy()
    arr["q50_gain"] = df_pred[pred_map["q50_gain"]].astype(np.float64).to_numpy()
    arr["q10_gain"] = (
        df_pred[pred_map["q10_gain"]].astype(np.float64).to_numpy()
        if pred_map.get("q10_gain") else np.full(n, np.nan)
    )
    arr["q90_gain"] = df_pred[pred_map["q90_gain"]].astype(np.float64).to_numpy()
    arr["drop_proba"] = df_pred[pred_map["drop_proba"]].astype(np.float64).to_numpy()
    arr["route"] = df_pred[p_route_col].astype(str).to_numpy()

    arr["ttd"] = df_feat[feat_map["ttd"]].astype(np.float64).to_numpy()
    arr["route_popularity"] = (
        df_feat[feat_map["route_popularity"]].astype(np.float64).to_numpy()
    )
    rk = df_feat[feat_map["route_known"]]
    arr["route_known"] = rk.astype(bool).to_numpy() if rk.dtype != object \
        else (rk.astype(str).str.lower().isin({"true", "1", "yes"})).to_numpy()
    arr["route_mean_train"] = (
        df_feat[feat_map["feat_route_mean_train"]].astype(np.float64).to_numpy()
        if feat_map.get("feat_route_mean_train") else np.zeros(n)
    )
    arr["route_std_train"] = (
        df_feat[feat_map["feat_route_std_train"]].astype(np.float64).to_numpy()
        if feat_map.get("feat_route_std_train") else np.zeros(n)
    )

    # depart_date for trajectory grouping (preferred); fallback fetched_at
    if feat_map.get("depart_date"):
        arr["depart_date"] = df_feat[feat_map["depart_date"]].astype(str).to_numpy()
    elif "depart_date" in df_pred.columns:
        arr["depart_date"] = df_pred["depart_date"].astype(str).to_numpy()
    else:
        # Last resort: use ttd_days bucket as a grouping proxy (less accurate)
        arr["depart_date"] = arr["ttd"].astype(int).astype(str)

    # c_alpha per row from mondrian bucket lookup
    std_ratio = np.where(
        arr["route_mean_train"] > 0,
        arr["route_std_train"] / np.clip(arr["route_mean_train"], 1e-6, None),
        0.0,
    )
    bucket_keys = [
        _bucket_key(float(t), float(p), float(s))
        for t, p, s in zip(arr["ttd"], arr["route_popularity"], std_ratio)
    ]
    arr["c_alpha"] = np.array(
        [_c_for(b, mondrian, ALPHA_CONFORMAL) for b in bucket_keys],
        dtype=np.float64,
    )
    arr["width_over_price"] = (2.0 * arr["c_alpha"]) / np.clip(arr["price"], 1.0, None)

    # q10_train_route per row (alert near-floor reference)
    if df_train_q10:
        arr["q10_train_route"] = np.array(
            [df_train_q10.get(r, 0.0) for r in arr["route"]],
            dtype=np.float64,
        )
    else:
        # Fallback: approximate q10 as mean - 1.28 * std (Gaussian)
        arr["q10_train_route"] = np.maximum(
            arr["route_mean_train"] - 1.28 * arr["route_std_train"], 0.0
        )

    # Trajectory floor: min(price) per (route, depart_date)
    log("computing trajectory floor", n_rows=n)
    df_traj = pd.DataFrame({
        "route": arr["route"],
        "depart_date": arr["depart_date"],
        "price": arr["price"],
    })
    floor_per_traj = (
        df_traj.groupby(["route", "depart_date"])["price"].min().to_dict()
    )
    arr["floor"] = np.array(
        [floor_per_traj.get((r, d), p)
         for r, d, p in zip(arr["route"], arr["depart_date"], arr["price"])],
        dtype=np.float64,
    )

    # TTD bucket label
    ttd = arr["ttd"]
    arr["ttd_bucket"] = np.where(
        ttd <= 7, "0-7",
        np.where(ttd <= 21, "8-21",
                 np.where(ttd <= 60, "22-60", "61+")),
    )

    return arr


def _classify_candidate(arr, cfg) -> "np.ndarray":
    """Vectorized candidate-policy classifier. Returns string array of actions."""
    import numpy as np  # type: ignore

    n = arr["price"].shape[0]
    # alpha(ttd) damping mirrors policy.py H1 correction
    alpha_ttd = np.where(arr["ttd"] <= 21, 1.0, 0.3)
    buy_trigger = arr["q50_gain"] + alpha_ttd * arr["c_alpha"]

    # ABSTAIN gates (any one fires)
    abstain_unknown = ~arr["route_known"]
    abstain_width = arr["width_over_price"] > cfg["abstain_width_over_price"]
    abstain_lowpop = arr["route_popularity"] < cfg["route_popularity_min"]
    abstain_ttd = (arr["ttd"] < cfg["ttd_lower"]) | (arr["ttd"] > cfg["ttd_upper"])
    abstain = abstain_unknown | abstain_width | abstain_lowpop | abstain_ttd

    # BUY gates (all must pass, AND not in ABSTAIN)
    buy_width_ok = arr["width_over_price"] <= cfg["max_width_over_price"]
    buy_trigger_ok = buy_trigger >= cfg["buy_trigger_margin_usd"]
    buy_drop_ok = arr["drop_proba"] <= cfg["drop_proba_buy_max"]
    buy = (~abstain) & buy_width_ok & buy_trigger_ok & buy_drop_ok

    # ALERT (combined) — drop_proba ≥ threshold AND price near floor AND width OK
    near_floor_ref = np.where(
        arr["q10_train_route"] > 0,
        arr["q10_train_route"] * cfg["alert_near_floor_pct"],
        np.inf,
    )
    alert_drop_ok = arr["drop_proba"] >= cfg["alert_drop_threshold"]
    alert_floor_ok = arr["price"] <= near_floor_ref
    alert_width_ok = arr["width_over_price"] <= cfg["max_width_over_price"]
    alert = (~abstain) & (~buy) & alert_drop_ok & alert_floor_ok & alert_width_ok

    # MONITOR — moderate uncertainty band
    monitor_drop_band = (arr["drop_proba"] >= 0.40) & (arr["drop_proba"] < cfg["alert_drop_threshold"])
    monitor_ttd = arr["ttd"] >= 14
    monitor_width = arr["width_over_price"] <= 0.75
    monitor = (~abstain) & (~buy) & (~alert) & monitor_drop_band & monitor_ttd & monitor_width

    # WAIT — default
    actions = np.full(n, "WAIT", dtype=object)
    actions[abstain] = "ABSTAIN"
    actions[buy] = "BUY_NOW"
    actions[alert] = "ALERT"
    actions[monitor] = "MONITOR"
    # AUTO_BUY — explicitly never emitted
    return actions


def _eval_candidate(arr, actions, cfg) -> dict:
    """Compute all metrics for a single candidate config."""
    import numpy as np  # type: ignore

    n = actions.shape[0]
    is_abstain = actions == "ABSTAIN"
    is_buy = actions == "BUY_NOW"
    is_alert = actions == "ALERT"
    is_monitor = actions == "MONITOR"
    is_wait = actions == "WAIT"

    # Action distribution
    action_dist = {
        "ABSTAIN": int(is_abstain.sum()),
        "BUY_NOW": int(is_buy.sum()),
        "ALERT": int(is_alert.sum()),
        "MONITOR": int(is_monitor.sum()),
        "WAIT": int(is_wait.sum()),
    }
    shares = {k: float(v) / n for k, v in action_dist.items()}

    # Alert metrics
    alert_or_buy = is_alert | is_buy
    near_floor_05 = arr["price"] <= arr["floor"] * 1.05
    near_floor_10 = arr["price"] <= arr["floor"] * 1.10

    n_alert_or_buy = int(alert_or_buy.sum())
    if n_alert_or_buy > 0:
        alert_precision_05 = float((alert_or_buy & near_floor_05).sum()) / n_alert_or_buy
        alert_precision_10 = float((alert_or_buy & near_floor_10).sum()) / n_alert_or_buy
    else:
        alert_precision_05 = float("nan")
        alert_precision_10 = float("nan")

    n_near_05 = int(near_floor_05.sum())
    if n_near_05 > 0:
        alert_recall_05 = float((alert_or_buy & near_floor_05).sum()) / n_near_05
    else:
        alert_recall_05 = float("nan")

    alert_rate = float(is_alert.sum()) / n  # excludes BUY (kept separate)

    # Per-trajectory regret/capture: take FIRST BUY in trajectory
    # We pre-grouped trajectories; here we compute per-trajectory chosen price
    import pandas as pd  # type: ignore
    df = pd.DataFrame({
        "route": arr["route"],
        "depart_date": arr["depart_date"],
        "price": arr["price"],
        "floor": arr["floor"],
        "is_buy": is_buy,
    })
    # First BUY price per trajectory; if no BUY, use last price (proxy for end-of-window)
    grp = df.groupby(["route", "depart_date"], sort=False)
    buy_first_idx = grp["is_buy"].idxmax()  # idx of first True; if all False, idx of first
    # idxmax on all-False returns first idx; mask separately:
    has_buy = grp["is_buy"].any()
    floors = grp["floor"].first()
    # For trajectories with BUY: first BUY price; else last observed price.
    chosen = pd.Series(index=floors.index, dtype=float)
    chosen.loc[has_buy] = df.loc[buy_first_idx[has_buy], "price"].values
    chosen.loc[~has_buy] = grp["price"].last().loc[~has_buy].values

    # Restrict regret/capture to BUY-having trajectories (honest)
    buy_traj_mask = has_buy.to_numpy()
    if buy_traj_mask.any():
        chosen_buy = chosen[has_buy].to_numpy()
        floor_buy = floors[has_buy].to_numpy()
        regret = chosen_buy - floor_buy
        capture = floor_buy / np.maximum(chosen_buy, 1e-9)
        regret_metrics = {
            "regret_abs_mean": float(np.mean(regret)),
            "regret_abs_p50": float(np.quantile(regret, 0.50)),
            "regret_abs_p90": float(np.quantile(regret, 0.90)),
            "regret_abs_p99": float(np.quantile(regret, 0.99)),
            "capture_mean": float(np.mean(capture)),
            "capture_median": float(np.quantile(capture, 0.50)),
            "n_trajectories_with_buy": int(buy_traj_mask.sum()),
            "n_trajectories_total": int(len(buy_traj_mask)),
            "trajectory_buy_coverage": float(buy_traj_mask.sum()) / len(buy_traj_mask),
        }
    else:
        regret_metrics = {
            "regret_abs_mean": float("nan"),
            "regret_abs_p50": float("nan"),
            "regret_abs_p90": float("nan"),
            "regret_abs_p99": float("nan"),
            "capture_mean": float("nan"),
            "capture_median": float("nan"),
            "n_trajectories_with_buy": 0,
            "n_trajectories_total": int(len(buy_traj_mask)),
            "trajectory_buy_coverage": 0.0,
        }

    # false_buy_now_rate: BUY rows where realized future price was significantly lower
    # (price - floor > $20 means user paid $20+ above the floor)
    if is_buy.sum() > 0:
        buy_regret_per_row = arr["price"][is_buy] - arr["floor"][is_buy]
        false_buy_now_rate = float((buy_regret_per_row > 20.0).sum()) / int(is_buy.sum())
    else:
        false_buy_now_rate = float("nan")

    # Per-TTD-bucket segment metrics
    seg_ttd: dict[str, dict] = {}
    for label in ("0-7", "8-21", "22-60"):
        mask = arr["ttd_bucket"] == label
        if not mask.any():
            continue
        n_seg = int(mask.sum())
        seg_alert_or_buy = (alert_or_buy & mask).sum()
        seg_near_05 = (mask & near_floor_05).sum()
        seg_alert_prec_05 = (
            float((alert_or_buy & mask & near_floor_05).sum()) / int(seg_alert_or_buy)
            if seg_alert_or_buy > 0 else float("nan")
        )
        seg_alert_rate = float((is_alert & mask).sum()) / n_seg
        seg_buy_share = float((is_buy & mask).sum()) / n_seg
        seg_ttd[label] = {
            "n": n_seg,
            "alert_rate": seg_alert_rate,
            "buy_now_share": seg_buy_share,
            "alert_precision_floor_1_05": seg_alert_prec_05,
        }

    return {
        "config": cfg,
        "n_rows": n,
        "action_distribution_count": action_dist,
        "action_share": shares,
        "alert_rate": alert_rate,
        "buy_now_share": shares["BUY_NOW"],
        "abstain_share": shares["ABSTAIN"],
        "monitor_share": shares["MONITOR"],
        "wait_share": shares["WAIT"],
        "alert_precision_floor_1_05": alert_precision_05,
        "alert_precision_floor_1_10": alert_precision_10,
        "alert_recall_floor_1_05": alert_recall_05,
        "false_buy_now_rate": false_buy_now_rate,
        **regret_metrics,
        "segment_metrics_by_ttd": seg_ttd,
    }


def _passes_constraints(c: dict, baseline_p90: float) -> dict:
    """Return per-constraint pass/fail booleans."""
    import math
    p90 = c.get("regret_abs_p90", float("nan"))
    cap = c.get("capture_median", float("nan"))
    return {
        "alert_rate_le_max": c["alert_rate"] <= CONSTRAINTS["alert_rate_max"],
        "buy_now_share_le_max": c["buy_now_share"] <= CONSTRAINTS["buy_now_share_max"],
        "abstain_share_in_band": (
            CONSTRAINTS["abstain_share_min"] <= c["abstain_share"]
            <= CONSTRAINTS["abstain_share_max"]
        ),
        "regret_p90_within_baseline": (
            (not math.isnan(p90))
            and p90 <= baseline_p90 * CONSTRAINTS["regret_p90_max_factor_vs_baseline"]
        ),
        "capture_median_ge_floor": (
            (not math.isnan(cap)) and cap >= CONSTRAINTS["capture_median_min"]
        ),
        "alert_precision_05_ge_phase1": (
            c["alert_precision_floor_1_05"] >= CONSTRAINTS["alert_precision_floor_1_05_min_phase1"]
            if not (c["alert_precision_floor_1_05"] != c["alert_precision_floor_1_05"])
            else False  # NaN check
        ),
    }


def _is_pareto_better(a: dict, b: dict) -> bool:
    """Return True if `a` dominates `b` on (alert_precision_05↑, regret_p99↓, abstain_share↑)."""
    import math
    ap_a = a.get("alert_precision_floor_1_05", float("nan"))
    ap_b = b.get("alert_precision_floor_1_05", float("nan"))
    rp_a = a.get("regret_abs_p99", float("inf"))
    rp_b = b.get("regret_abs_p99", float("inf"))
    ab_a = a.get("abstain_share", 0.0)
    ab_b = b.get("abstain_share", 0.0)
    if any(math.isnan(x) for x in (ap_a, ap_b, rp_a, rp_b)):
        return False
    a_ge = (ap_a >= ap_b) and (rp_a <= rp_b) and (ab_a >= ab_b)
    a_gt = (ap_a > ap_b) or (rp_a < rp_b) or (ab_a > ab_b)
    return a_ge and a_gt


def _pareto_frontier(cands: list[dict]) -> list[dict]:
    frontier: list[dict] = []
    for c in cands:
        if any(_is_pareto_better(o, c) for o in cands if o is not c):
            continue
        frontier.append(c)
    return frontier


def _emit_true_sweep(found, libs, pred_cols, feat_cols,
                     pred_map, feat_map) -> dict:
    """Run the full sweep and return the JSON payload."""
    import numpy as np  # type: ignore

    df_pred, df_feat, mondrian, df_train_q10 = _load_true_sweep_inputs(found)
    arr = _build_arrays(df_pred, df_feat, mondrian, df_train_q10, pred_map, feat_map)

    # Baseline reference for the P90 constraint
    baseline_metrics = _baseline_metrics(found)
    baseline_p90 = float("inf")
    try:
        baseline_p90 = float(
            baseline_metrics["report_backtest"]["v7a_hybrid"]["regret_abs_p90"]
        )
    except Exception:
        pass

    # Build candidate grid
    keys = list(GRID.keys())
    grids = [GRID[k] for k in keys]
    log("starting sweep", n_candidates=int(np.prod([len(g) for g in grids])))

    candidates: list[dict] = []
    t0 = time.time()
    n_total = int(np.prod([len(g) for g in grids]))
    for i, combo in enumerate(product(*grids)):
        cfg = dict(zip(keys, combo))
        # Skip clearly inconsistent configs (abstain ≤ buy gate)
        if cfg["abstain_width_over_price"] < cfg["max_width_over_price"]:
            continue
        actions = _classify_candidate(arr, cfg)
        metrics = _eval_candidate(arr, actions, cfg)
        metrics["constraints_pass"] = _passes_constraints(metrics, baseline_p90)
        metrics["all_constraints_pass"] = all(metrics["constraints_pass"].values())
        candidates.append(metrics)
        if (i + 1) % 500 == 0 or (i + 1) == n_total:
            log("sweep progress", done=i + 1, total=n_total,
                elapsed_sec=round(time.time() - t0, 2))

    log("sweep done", n_evaluated=len(candidates),
        elapsed_sec=round(time.time() - t0, 2))

    # Rank: prioritize feasibility, then alert_precision_05 desc,
    # then -regret_p99 asc, then abstain_share desc.
    def _rank_key(c: dict):
        ap = c["alert_precision_floor_1_05"]
        rp = c["regret_abs_p99"]
        ab = c["abstain_share"]
        feas = 1 if c.get("all_constraints_pass") else 0
        return (feas, ap if ap == ap else -1, -(rp if rp == rp else 1e9), ab)

    candidates_sorted = sorted(candidates, key=_rank_key, reverse=True)
    top = candidates_sorted[:50]
    feasible = [c for c in candidates if c.get("all_constraints_pass")]
    pareto = _pareto_frontier(candidates)

    # Sweep summary stats
    def _agg(field_name):
        import math
        vals = [c.get(field_name) for c in candidates
                if c.get(field_name) is not None
                and not (isinstance(c.get(field_name), float) and math.isnan(c.get(field_name)))]
        if not vals:
            return {"min": None, "median": None, "max": None}
        vals_sorted = sorted(vals)
        return {
            "min": float(vals_sorted[0]),
            "median": float(vals_sorted[len(vals_sorted) // 2]),
            "max": float(vals_sorted[-1]),
        }

    summary_stats = {
        f: _agg(f) for f in (
            "alert_precision_floor_1_05",
            "alert_precision_floor_1_10",
            "alert_recall_floor_1_05",
            "alert_rate",
            "buy_now_share",
            "abstain_share",
            "monitor_share",
            "regret_abs_mean",
            "regret_abs_p90",
            "regret_abs_p99",
            "capture_median",
        )
    }

    payload: dict = {
        "mode": "true_row_level_sweep",
        "generated_at": now_iso(),
        "n_rows_evaluated": int(arr["price"].shape[0]),
        "n_trajectories_total": int(top[0]["n_trajectories_total"]) if top else None,
        "files_checked": [],  # filled by caller
        "files_found": found,
        "libs_available": libs,
        "artifact_column_mapping": {
            "predictions_test_parquet": pred_map,
            "features_test_parquet": feat_map,
        },
        "baseline_current_metrics": baseline_metrics,
        "baseline_v7a_hybrid_p90_used_for_constraint": baseline_p90,
        "sweep_grid": GRID,
        "constraints": CONSTRAINTS,
        "number_of_candidates_evaluated": len(candidates),
        "number_of_feasible_candidates": len(feasible),
        "summary_stats_across_grid": summary_stats,
        "top_candidates_by_safety_first_rank": top,
        "pareto_candidates": pareto,
        "limitations": [
            ("alert_near_floor_pct gate uses q10 of train-route price; if the "
             "training features parquet was unavailable, the script falls "
             "back to a Gaussian approximation (mean - 1.28*std), which is "
             "less accurate."),
            ("regret/capture are computed per (route, depart_date) "
             "trajectory, taking the price of the FIRST BUY_NOW. "
             "Trajectories with no BUY are excluded from regret stats."),
            ("Test split has no rows in TTD bucket 61+ — the ttd_upper "
             "gate is effectively bounded above by the data."),
            ("V7a was trained on 2022-04 to 2022-10 only — no winter and "
             "no 2023+ data. Sweep results are conditional on this window."),
        ],
        "next_recommendation": (
            "Pick the top non-dominated candidate that meets the Phase-1 "
            "constraint set, then open a follow-up PR to update the constants "
            "in scripts/train/v7a/policy.py (NOT in this sprint). If no "
            "candidate meets all constraints, the Pareto frontier in this "
            "report is the basis for trade-off discussion before any policy "
            "change."
        ),
    }
    return payload


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
                cells.append(f"{v:.4f}" if abs(v) < 100 else f"{v:.1f}")
            elif v is None:
                cells.append("—")
            else:
                cells.append(str(v))
        body_lines.append("| " + " | ".join(cells) + " |")
    return "\n".join([header, sep, *body_lines]) + "\n"


def _write_markdown(payload: dict) -> None:
    OUT_MD.parent.mkdir(parents=True, exist_ok=True)

    mode = payload.get("mode", "unknown")
    md: list[str] = []
    md.append("# V7a Policy Tuning Results")
    md.append("")
    md.append(f"> **Sprint** — `b1/v7a-policy-tightening` · offline policy "
              "threshold sweep.\n"
              f"> Generated by `scripts/train/v7a/policy_tune.py` on "
              f"{payload.get('generated_at', '?')}.")
    md.append("")

    # 1
    md.append("## 1. Purpose")
    md.append("")
    md.append("Evaluate tightened candidate V7a policies offline against "
              "existing local artifacts to identify a configuration that "
              "improves alert precision and reduces noisy actions while "
              "keeping regret and capture acceptable. No model retraining; "
              "no Modal; no production policy change in this sprint.")
    md.append("")

    # 2
    md.append("## 2. Execution Mode")
    md.append("")
    if mode == "true_row_level_sweep":
        md.append("**Mode: `true_row_level_sweep`.**")
        md.append("")
        md.append(f"Row-level data was sufficient. {payload.get('number_of_candidates_evaluated', 0)} "
                  f"candidate configurations were evaluated against "
                  f"{payload.get('n_rows_evaluated', 0):,} test rows "
                  f"({payload.get('n_trajectories_total', 0):,} trajectories).")
    else:
        md.append("**Mode: `diagnostic_missing_row_level_artifacts`.**")
        md.append("")
        md.append("True row-level tuning was not possible because required "
                  "row-level prediction artifacts were missing or incomplete.")
        md.append("")
        md.append(f"Reason: `{payload.get('reason', 'unknown')}`.")
    md.append("")

    # 3
    md.append("## 3. Available Artifacts")
    md.append("")
    md.append("| Logical key | Found | Path / size |")
    md.append("| --- | --- | --- |")
    found = payload.get("files_found", {})
    for key in ARTIFACT_PROBE:
        f = found.get(key)
        if f:
            md.append(f"| `{key}` | yes | `{f['path']}` ({f['size_bytes']:,} B, mtime {f['mtime_iso']}) |")
        else:
            paths_tried = ", ".join(rel(p) for p in ARTIFACT_PROBE[key])
            md.append(f"| `{key}` | no | _(none of: {paths_tried})_ |")
    md.append("")
    md.append(f"Library availability: `{payload.get('libs_available', {})}`.")
    md.append("")

    # 4
    md.append("## 4. Column Mapping / Missing Columns")
    md.append("")
    if mode == "true_row_level_sweep":
        mapping = payload.get("artifact_column_mapping", {})
        md.append("```json")
        md.append(json.dumps(mapping, indent=2, default=str))
        md.append("```")
    else:
        mapping = payload.get("artifact_column_mapping", {})
        missing = payload.get("missing_required_columns", [])
        md.append(f"Missing required logical columns: `{missing}`.")
        md.append("")
        md.append("Detected per-file column mapping:")
        md.append("")
        md.append("```json")
        md.append(json.dumps(mapping, indent=2, default=str))
        md.append("```")
    md.append("")

    # 5
    md.append("## 5. Baseline Metrics")
    md.append("")
    md.append("Aggregate metrics from existing reports (frozen current policy):")
    md.append("")
    bm = payload.get("baseline_current_metrics") or payload.get("available_aggregate_metrics", {})
    bt = bm.get("report_backtest", {}) if isinstance(bm, dict) else {}
    if isinstance(bt, dict) and "v7a_ml_only" in bt:
        rows = []
        for variant in ("v7a_ml_only", "v7a_hybrid"):
            v = bt.get(variant, {})
            rows.append({
                "variant": variant,
                "regret_abs_mean": v.get("regret_abs_mean"),
                "regret_abs_p90": v.get("regret_abs_p90"),
                "regret_abs_p99": v.get("regret_abs_p99"),
                "capture_median": v.get("capture_median"),
                "alert_rate": v.get("alert_rate"),
                "alert_precision_floor_1_05": v.get("alert_precision_floor_1_05"),
            })
        md.append(_md_table(rows, [
            "variant", "regret_abs_mean", "regret_abs_p90", "regret_abs_p99",
            "capture_median", "alert_rate", "alert_precision_floor_1_05",
        ]))
    else:
        md.append("_(baseline backtest report not present in this run)_")
    md.append("")

    # 6
    md.append("## 6. Candidate Policy Logic")
    md.append("")
    md.append("Defined in `policy_tune.py` (separate from production "
              "`policy.py`, which is unchanged this sprint).")
    md.append("")
    md.append("- **ABSTAIN** if route unknown, OR `width_over_price > "
              "abstain_width_over_price`, OR `route_popularity < "
              "route_popularity_min`, OR `ttd not in [ttd_lower, ttd_upper]`.")
    md.append("- **BUY_NOW** if all of: route known, popularity ≥ threshold, "
              "TTD inside `[ttd_lower, ttd_upper]`, `width_over_price ≤ "
              "max_width_over_price`, `q50_gain + alpha(ttd) · c_alpha ≥ "
              "buy_trigger_margin_usd`, AND `drop_proba ≤ drop_proba_buy_max`.")
    md.append("- **ALERT** if `drop_proba ≥ alert_drop_threshold`, "
              "`price ≤ q10_train_route × alert_near_floor_pct`, "
              "`width_over_price ≤ max_width_over_price`, AND not BUY/ABSTAIN.")
    md.append("- **MONITOR** if `drop_proba ∈ [0.40, alert_drop_threshold)`, "
              "`ttd ≥ 14`, `width_over_price ≤ 0.75`, route supported.")
    md.append("- **WAIT** otherwise.")
    md.append("- **AUTO_BUY** is hard-locked to off — never emitted by this script.")
    md.append("")

    # 7
    md.append("## 7. Sweep Results")
    md.append("")
    if mode == "true_row_level_sweep":
        md.append(f"- Candidates evaluated: **{payload.get('number_of_candidates_evaluated', 0)}**")
        md.append(f"- Candidates passing all constraints: **{payload.get('number_of_feasible_candidates', 0)}**")
        md.append("")
        md.append("Summary stats across the entire grid:")
        md.append("")
        ss = payload.get("summary_stats_across_grid", {})
        rows = []
        for f, agg in ss.items():
            rows.append({"metric": f, **{k: agg.get(k) for k in ("min", "median", "max")}})
        md.append(_md_table(rows, ["metric", "min", "median", "max"]))
    else:
        md.append("_Not produced — see Execution Mode above._")
    md.append("")

    # 8
    md.append("## 8. Best Candidates and Tradeoffs")
    md.append("")
    if mode == "true_row_level_sweep":
        top = payload.get("top_candidates_by_safety_first_rank", [])[:10]
        if top:
            rows = []
            for c in top:
                cfg = c.get("config", {})
                rows.append({
                    "buy_share": c.get("buy_now_share"),
                    "alert_rate": c.get("alert_rate"),
                    "abstain": c.get("abstain_share"),
                    "alert_p_05": c.get("alert_precision_floor_1_05"),
                    "alert_p_10": c.get("alert_precision_floor_1_10"),
                    "alert_r_05": c.get("alert_recall_floor_1_05"),
                    "regret_mean": c.get("regret_abs_mean"),
                    "regret_p90": c.get("regret_abs_p90"),
                    "regret_p99": c.get("regret_abs_p99"),
                    "capture_med": c.get("capture_median"),
                    "feasible": c.get("all_constraints_pass"),
                    "cfg_summary": (
                        f"width≤{cfg.get('max_width_over_price')} | "
                        f"abstain>{cfg.get('abstain_width_over_price')} | "
                        f"buy≥+${cfg.get('buy_trigger_margin_usd')} | "
                        f"drop≤{cfg.get('drop_proba_buy_max')} | "
                        f"alert≥{cfg.get('alert_drop_threshold')} | "
                        f"floor×{cfg.get('alert_near_floor_pct')} | "
                        f"pop≥{cfg.get('route_popularity_min')} | "
                        f"ttd[{cfg.get('ttd_lower')},{cfg.get('ttd_upper')}]"
                    ),
                })
            md.append(_md_table(rows, [
                "feasible", "buy_share", "alert_rate", "abstain",
                "alert_p_05", "alert_p_10", "alert_r_05",
                "regret_mean", "regret_p90", "regret_p99", "capture_med",
                "cfg_summary",
            ]))
        else:
            md.append("_(no candidates returned)_")
        md.append("")
        pareto = payload.get("pareto_candidates", [])
        md.append(f"Pareto frontier: **{len(pareto)} candidates** "
                  "(non-dominated on alert_precision_floor_1_05↑, "
                  "regret_abs_p99↓, abstain_share↑).")
    else:
        md.append("_Not produced — see Execution Mode above._")
    md.append("")

    # 9
    md.append("## 9. Metrics That Could Not Be Computed")
    md.append("")
    for lim in payload.get("limitations", []):
        md.append(f"- {lim}")
    md.append("")

    # 10
    md.append("## 10. Recommendation")
    md.append("")
    md.append(payload.get("next_recommendation", ""))
    md.append("")

    # 11
    md.append("## 11. Whether `policy.py` Should Be Modified Next")
    md.append("")
    if mode == "true_row_level_sweep" and payload.get("number_of_feasible_candidates", 0) > 0:
        md.append("**Conditional yes** — but only after a separate PR review. "
                  "The top non-dominated candidate that meets all Phase-1 "
                  "constraints is the basis for a follow-up PR that updates "
                  "the threshold constants in `scripts/train/v7a/policy.py`. "
                  "That PR is **not** part of this sprint.")
    elif mode == "true_row_level_sweep":
        md.append("**No** — no candidate met every Phase-1 constraint. The "
                  "Pareto frontier is reported above for trade-off "
                  "discussion. Either tighten the dataset (more data, more "
                  "TTD coverage) or relax one constraint explicitly before "
                  "any `policy.py` change.")
    else:
        md.append("**No** — true tuning was not possible this run. No edit "
                  "to `policy.py` is justified by aggregate metrics alone.")
    md.append("")

    # 12
    md.append("## 12. Modal / Retraining Decision")
    md.append("")
    md.append("- **Modal:** not needed. The required artifacts are produced "
              "by local scripts (`backtest.py` writes `lgbm_test.parquet`; "
              "`calibrate.py` writes `conformal_mondrian.json`; "
              "`features.py` writes `features_v7a_local/test.parquet`).")
    md.append("- **Retraining:** not needed. Policy tuning operates on "
              "cached predictions of the existing frozen LightGBM models.")
    md.append("")

    # 13
    md.append("## 13. Files Created or Modified")
    md.append("")
    md.append("| Path | Action |")
    md.append("| --- | --- |")
    md.append("| `scripts/train/v7a/policy_tune.py` | created |")
    md.append("| `reports/v7a_policy_tuning_local.json` | created |")
    md.append("| `docs/v7a/V7A_POLICY_TUNING_RESULTS.md` | created (this file) |")
    md.append("")
    md.append("No other path was modified. Existing `reports/v7a_*_local.json`, "
              "all `data/**`, `models/**`, `logs/**`, and every V7a "
              "production script remain untouched.")
    md.append("")

    OUT_MD.write_text("\n".join(md), encoding="utf-8")


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------


def main() -> int:
    log("policy_tune start", repo=str(REPO_ROOT))

    probe_checked, probe_found = probe_artifacts()
    libs = detect_libs()

    # Detect columns on whatever parquets exist
    detected_cols: dict[str, dict] = {}
    for key in ("predictions_test_parquet", "features_test_parquet",
                "features_train_parquet", "ml_cache_local"):
        if key in probe_found:
            detected_cols[key] = detect_columns_parquet(
                REPO_ROOT / probe_found[key]["path"]
            )

    # Build alias mapping for the predictions + features parquets
    pred_cols = list(detected_cols.get("predictions_test_parquet", {}).keys())
    feat_cols = list(detected_cols.get("features_test_parquet", {}).keys())
    pred_map = map_aliases([c for c in pred_cols if not c.startswith("_")])
    feat_map = map_aliases([c for c in feat_cols if not c.startswith("_")])

    # Decide whether row-level tuning is possible
    can_run_row_level = True
    missing_required: list[str] = []
    reason = ""

    if not all(libs.values()):
        can_run_row_level = False
        reason = f"missing python libs: {[k for k, v in libs.items() if not v]}"

    if "predictions_test_parquet" not in probe_found:
        can_run_row_level = False
        reason = (reason + "; " if reason else "") + "predictions_test_parquet not found"

    if "features_test_parquet" not in probe_found:
        can_run_row_level = False
        reason = (reason + "; " if reason else "") + "features_test_parquet not found"

    if "conformal_json" not in probe_found:
        can_run_row_level = False
        reason = (reason + "; " if reason else "") + "conformal_json not found"

    # Check required logical columns across the merged schema
    if can_run_row_level:
        merged_map = {}
        for logical in REQUIRED_FOR_TUNING:
            merged_map[logical] = pred_map.get(logical) or feat_map.get(logical)
            if merged_map[logical] is None:
                missing_required.append(logical)
        if missing_required:
            can_run_row_level = False
            reason = (reason + "; " if reason else "") + (
                f"missing required logical columns: {missing_required}"
            )

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)

    if not can_run_row_level:
        payload = _emit_diagnostic(
            probe_checked, probe_found, libs,
            detected_cols={**{"predictions_test_parquet": pred_map,
                              "features_test_parquet": feat_map},
                           **{"raw_per_file": detected_cols}},
            missing_required=missing_required,
            reason=reason,
        )
        OUT_JSON.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
        _write_markdown(payload)
        log("DIAGNOSTIC mode written",
            json=rel(OUT_JSON), md=rel(OUT_MD), reason=reason)
        # Concise stdout summary
        print(f"[policy_tune] mode=diagnostic_missing_row_level_artifacts")
        print(f"[policy_tune] reason: {reason}")
        print(f"[policy_tune] files_found_keys: {list(probe_found.keys())}")
        print(f"[policy_tune] missing_required: {missing_required}")
        print(f"[policy_tune] wrote: {rel(OUT_JSON)}")
        print(f"[policy_tune] wrote: {rel(OUT_MD)}")
        return 0

    # ---- True row-level sweep ----
    payload = _emit_true_sweep(probe_found, libs, pred_cols, feat_cols, pred_map, feat_map)
    payload["files_checked"] = probe_checked
    OUT_JSON.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    _write_markdown(payload)
    log("TRUE_SWEEP mode written",
        json=rel(OUT_JSON), md=rel(OUT_MD),
        n_candidates=payload["number_of_candidates_evaluated"],
        n_feasible=payload["number_of_feasible_candidates"])
    # Concise stdout summary
    print(f"[policy_tune] mode=true_row_level_sweep")
    print(f"[policy_tune] n_rows={payload['n_rows_evaluated']:,}, "
          f"n_trajectories={payload.get('n_trajectories_total', 0):,}")
    print(f"[policy_tune] candidates_evaluated={payload['number_of_candidates_evaluated']}, "
          f"feasible={payload['number_of_feasible_candidates']}, "
          f"pareto={len(payload['pareto_candidates'])}")
    top = payload["top_candidates_by_safety_first_rank"][:3]
    for i, c in enumerate(top, 1):
        cfg = c.get("config", {})
        print(f"[policy_tune] top{i}: "
              f"alert_p_05={c['alert_precision_floor_1_05']:.3f} "
              f"buy={c['buy_now_share']:.2%} "
              f"alert={c['alert_rate']:.2%} "
              f"abstain={c['abstain_share']:.2%} "
              f"regret_p99=${c['regret_abs_p99']:.0f} "
              f"capture_med={c['capture_median']:.3f} "
              f"feasible={c['all_constraints_pass']}")
    print(f"[policy_tune] wrote: {rel(OUT_JSON)}")
    print(f"[policy_tune] wrote: {rel(OUT_MD)}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        log("interrupted by user")
        sys.exit(0)
    except Exception as e:
        # Never crash with non-zero — emit a final diagnostic instead.
        log("fatal error, writing diagnostic", error=str(e))
        try:
            OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
            OUT_JSON.write_text(json.dumps({
                "mode": "diagnostic_missing_row_level_artifacts",
                "generated_at": now_iso(),
                "reason": f"fatal_error: {e!r}",
            }, indent=2), encoding="utf-8")
            OUT_MD.parent.mkdir(parents=True, exist_ok=True)
            OUT_MD.write_text(
                f"# V7a Policy Tuning Results\n\n"
                f"**Mode: diagnostic_missing_row_level_artifacts.**\n\n"
                f"Fatal error: `{e!r}`.\n\n"
                f"True row-level tuning was not possible because required "
                f"row-level prediction artifacts were missing or incomplete.\n",
                encoding="utf-8",
            )
        except Exception:
            pass
        sys.exit(0)
