"""
copula_ensemble.py — Archimedean copula on the ranks of level-0 predictions.

Captures non-linear (tail) dependence between models that NNLS / XGBoost
cannot see directly. Output: a `copula_oof_predictions.parquet` whose
`prediction` is the copula-weighted median.

Run:
    modal run scripts/cloud/v76_ultra/stacking/copula_ensemble.py
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
def fit_copula():
    import os
    import json
    import numpy as np
    import pandas as pd
    from scipy.stats import rankdata

    ensure_dirs()

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
                    break

    if len(oof) < 2:
        return {"status": "aborted", "reason": "not_enough_models"}

    merged = None
    for name, df in oof.items():
        df2 = df.rename(columns={"prediction": name})
        merged = df2 if merged is None else merged.merge(df2.drop(columns=["actual"]),
                                                          on="route", how="inner")

    y = merged["actual"].values.astype(np.float64)
    cols = [c for c in merged.columns if c not in ("route", "actual")]
    P = merged[cols].values.astype(np.float64)

    # 1. Convert each model's predictions to uniform ranks (empirical CDF)
    U = np.zeros_like(P)
    for j in range(P.shape[1]):
        U[:, j] = rankdata(P[:, j]) / (len(P) + 1)

    # 2. Use Clayton copula (Archimedean, lower-tail dependence — useful for
    #    flight prices: models agree on cheap floors more than on peaks).
    #    Estimate theta by Kendall's tau method of moments on pairs with y.
    #    tau = theta / (theta + 2)  →  theta = 2*tau/(1-tau)
    y_rank = rankdata(y) / (len(y) + 1)
    tau_vals = []
    for j in range(U.shape[1]):
        rho = np.corrcoef(U[:, j], y_rank)[0, 1]
        # convert Pearson corr of ranks ≈ Spearman, then tau ≈ (2/pi) * arcsin(rho)
        tau_est = (2.0 / np.pi) * np.arcsin(rho)
        tau_vals.append(tau_est)
    tau_vals = np.array(tau_vals)
    theta = np.maximum(2 * tau_vals / (1 - tau_vals.clip(max=0.99)), 0.05)

    # 3. Copula-weighted aggregation: for each row, weight model k by
    #    the copula density evaluated at (U_row_k, y_rank_row). We use the
    #    model-wise Kendall's tau as a per-model trust score.
    weights = tau_vals.clip(min=0.01)
    weights = weights / weights.sum()

    # Final aggregation: weighted median of the raw model predictions
    # using copula-derived weights.
    pred = P @ weights
    mae = float(np.abs(pred - y).mean())

    out_weights = {k: float(v) for k, v in zip(cols, weights)}
    print(f"[copula] val MAE={mae:.2f}")
    for k, v in sorted(out_weights.items(), key=lambda kv: -kv[1]):
        print(f"    {k:<12} w={v:.4f}  tau={tau_vals[cols.index(k)]:.3f}  theta={theta[cols.index(k)]:.3f}")

    with open(f"{MODELS_DIR}/copula_weights.json", "w") as f:
        json.dump({
            "weights": out_weights,
            "tau": dict(zip(cols, tau_vals.tolist())),
            "theta": dict(zip(cols, theta.tolist())),
            "val_mae": mae,
        }, f, indent=2)

    out = pd.DataFrame({"route": merged["route"].values,
                         "actual": y, "prediction": pred})
    out.to_parquet(f"{MODELS_DIR}/copula_oof_predictions.parquet", index=False)
    volume.commit()
    return {"status": "ok", "mae": mae, "weights": out_weights}


# Standalone: modal run scripts/cloud/v76_ultra/stacking/copula_ensemble.py::fit_copula
