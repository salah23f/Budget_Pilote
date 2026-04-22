"""
conformal_os.py — Conformal Optimal Stopping calibration.

Reads the chosen level-1 ensemble predictions (xgb_meta preferred, fallback
BMA, fallback copula, fallback qrf) and produces a `conformal_calibration.json`
with the distribution-free offset `c_alpha` needed by the V7 backtest to
guarantee P(min future price ≥ ensemble_prediction - c_alpha) ≥ 1 - alpha.

Run:
    modal run scripts/cloud/v76_ultra/policy/conformal_os.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import app, volume, base_image, MODELS_DIR, ensure_dirs


@app.function(
    image=base_image,
    cpu=2,
    volumes={"/vol": volume},
    timeout=10 * 60,
)
def calibrate_conformal(alphas=(0.05, 0.10, 0.20)):
    import os, json
    import numpy as np
    import pandas as pd

    ensure_dirs()

    candidates = [
        "xgb_meta", "bma", "copula", "qrf", "chronos2", "tirex", "patchtst",
    ]
    chosen = None
    for name in candidates:
        path = f"{MODELS_DIR}/{name}_oof_predictions.parquet"
        if os.path.exists(path):
            chosen = (name, path); break
        alt = f"/vol/models/{name}_oof_predictions.parquet"
        if os.path.exists(alt):
            chosen = (name, alt); break

    if chosen is None:
        return {"status": "aborted", "reason": "no_ensemble_found"}

    name, path = chosen
    df = pd.read_parquet(path)
    y = df["actual"].values
    p = df["prediction"].values

    # Residuals = y - pred (positive → model under-predicted, actual was higher)
    residuals = y - p

    calib = {"source_model": name, "offsets": {}}
    for alpha in alphas:
        c = float(np.quantile(residuals, 1 - alpha))
        calib["offsets"][f"alpha_{int(alpha*100)}"] = c
        print(f"  alpha={alpha}  c_alpha={c:.2f}")

    calib["residuals_summary"] = {
        "mean": float(np.mean(residuals)),
        "std": float(np.std(residuals)),
        "p05": float(np.quantile(residuals, 0.05)),
        "p95": float(np.quantile(residuals, 0.95)),
    }

    # Per-route conformal offsets (when n_obs >= 30 per route)
    if "route" in df.columns:
        per_route = {}
        for r, sub in df.groupby("route"):
            if len(sub) >= 30:
                r_resid = sub["actual"].values - sub["prediction"].values
                per_route[r] = {
                    f"alpha_{int(a*100)}": float(np.quantile(r_resid, 1 - a))
                    for a in alphas
                }
        calib["per_route_offsets"] = per_route
        print(f"  per-route offsets for {len(per_route)} routes")

    with open(f"{MODELS_DIR}/conformal_calibration.json", "w") as f:
        json.dump(calib, f, indent=2)
    volume.commit()
    return {"status": "ok", "calibration": calib}


# Standalone: modal run scripts/cloud/v76_ultra/policy/conformal_os.py::calibrate_conformal
