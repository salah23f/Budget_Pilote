"""s02_bma.py — Bayesian Model Averaging (standalone)."""
import modal

app = modal.App("flyeas-v76-bma")
volume = modal.Volume.from_name("flyeas-v75", create_if_missing=True)

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "numpy==1.26.4", "pandas==2.2.2", "pyarrow==16.1.0",
)

MODEL_NAMES = ["chronos2", "tirex", "moirai2", "timesfm",
               "patchtst", "mamba", "kan", "garch_nn", "mlcaformer",
               "timegrad", "ts2vec", "qrf"]


@app.function(image=image, cpu=4, volumes={"/vol": volume},
              timeout=15 * 60, memory=8 * 1024)
def run():
    import os
    import json
    import math
    import numpy as np
    import pandas as pd

    os.makedirs("/vol/models_v76", exist_ok=True)
    oof = {}
    for name in MODEL_NAMES:
        for path in (f"/vol/models_v76/{name}_oof_predictions.parquet",
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
        return {"status": "aborted"}

    merged = None
    for name, df in oof.items():
        df2 = df.rename(columns={"prediction": name})
        merged = df2 if merged is None else merged.merge(df2.drop(columns=["actual"]),
                                                          on="route", how="inner")
    y = merged["actual"].values.astype(np.float64)
    cols = [c for c in merged.columns if c not in ("route", "actual")]
    P = merged[cols].values.astype(np.float64)

    residuals = y[:, None] - P
    sigma = residuals.std(axis=0).clip(min=1e-3)
    n = len(y)
    logL = (-0.5 * n * np.log(2 * math.pi * sigma ** 2)
             - np.sum(residuals ** 2, axis=0) / (2 * sigma ** 2))
    logL_s = logL - logL.max()
    w = np.exp(logL_s); w = w / w.sum()
    weights = {k: float(v) for k, v in zip(cols, w)}

    pred = P @ w
    mae = float(np.abs(pred - y).mean())
    print(f"[bma] val MAE={mae:.2f}")
    for k, v in sorted(weights.items(), key=lambda kv: -kv[1]):
        print(f"  {k:<12} {v:.4f}")

    with open("/vol/models_v76/bma_weights.json", "w") as f:
        json.dump({"weights": weights, "val_mae": mae,
                    "sigma_per_model": dict(zip(cols, sigma.tolist())),
                    "n_samples": int(n)}, f, indent=2)
    pd.DataFrame({"route": merged["route"].values,
                   "actual": y, "prediction": pred}).to_parquet(
        "/vol/models_v76/bma_oof_predictions.parquet", index=False)
    volume.commit()
    return {"status": "ok", "mae": mae, "weights": weights}


@app.local_entrypoint()
def main():
    print(run.remote())
