"""
bma_aggregator.py — Bayesian Model Averaging over the level-0 models.

Each model gets a posterior weight proportional to its marginal likelihood on
the validation set. Unlike XGBoost meta, this gives us calibrated uncertainty
over which model is "right" per row, which we feed into the policy layer.

Run:
    modal run scripts/cloud/v76_ultra/stacking/bma_aggregator.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import app, volume, base_image, MODELS_DIR, ensure_dirs

MODEL_NAMES = [
    "chronos2", "tirex", "moirai2", "timesfm",
    "patchtst", "mamba", "kan", "garch_nn", "mlcaformer",
    "timegrad", "ts2vec", "qrf",
]


@app.function(
    image=base_image,
    cpu=4,
    volumes={"/vol": volume},
    timeout=15 * 60,
    memory=8 * 1024,
)
def fit_bma():
    import os
    import json
    import math
    import numpy as np
    import pandas as pd

    ensure_dirs()
    print("[bma] scanning OOFs...")

    oof = {}
    for name in MODEL_NAMES:
        for path in (f"{MODELS_DIR}/{name}_oof_predictions.parquet",
                     f"/vol/models/{name}_oof_predictions.parquet"):
            if os.path.exists(path):
                df = pd.read_parquet(path)
                if {"route", "prediction", "actual"}.issubset(df.columns):
                    oof[name] = df.groupby("route", as_index=False).agg(
                        prediction=("prediction", "median"),
                        actual=("actual", "median"))
                    print(f"  [ok] {name}: {len(oof[name]):,}")
                break

    if len(oof) < 2:
        print("[bma] not enough models")
        return {"status": "aborted"}

    # Align on common routes
    merged = None
    for name, df in oof.items():
        df2 = df.rename(columns={"prediction": name})
        if merged is None:
            merged = df2
        else:
            merged = merged.merge(df2.drop(columns=["actual"]), on="route", how="inner")
    y = merged["actual"].values.astype(np.float64)
    cols = [c for c in merged.columns if c not in ("route", "actual")]
    P = merged[cols].values.astype(np.float64)  # shape (N, K)

    # Assume Gaussian errors: likelihood of each model is product of exp(-(y-p_k)^2 / (2 sigma_k^2))
    # Estimate sigma per model from residuals.
    residuals = y[:, None] - P
    sigma = residuals.std(axis=0).clip(min=1e-3)

    # Log marginal likelihood per model (iid normal) + uniform prior
    # logL_k = -n/2 log(2 pi sigma_k^2) - sum((y-p_k)^2)/(2 sigma_k^2)
    n = len(y)
    logL = (
        -0.5 * n * np.log(2 * math.pi * sigma ** 2)
        - np.sum(residuals ** 2, axis=0) / (2 * sigma ** 2)
    )

    # Normalize to get posterior weights
    logL_stable = logL - logL.max()
    w = np.exp(logL_stable)
    w = w / w.sum()
    weights = {k: float(v) for k, v in zip(cols, w)}

    pred = P @ w
    mae = float(np.abs(pred - y).mean())
    print(f"[bma] val MAE={mae:.2f}")
    for k, v in sorted(weights.items(), key=lambda kv: -kv[1]):
        print(f"    {k:<12} {v:.4f}")

    with open(f"{MODELS_DIR}/bma_weights.json", "w") as f:
        json.dump({
            "weights": weights,
            "val_mae": mae,
            "sigma_per_model": dict(zip(cols, sigma.tolist())),
            "n_samples": int(n),
        }, f, indent=2)

    out = pd.DataFrame({"route": merged["route"].values,
                         "actual": y, "prediction": pred})
    out.to_parquet(f"{MODELS_DIR}/bma_oof_predictions.parquet", index=False)
    volume.commit()
    return {"status": "ok", "mae": mae, "weights": weights}


# Standalone: modal run scripts/cloud/v76_ultra/stacking/bma_aggregator.py::fit_bma
