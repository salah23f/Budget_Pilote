"""p04_conformal.py — Conformal Optimal Stopping offset calibration (standalone)."""
import modal

app = modal.App("flyeas-v76-conformal")
volume = modal.Volume.from_name("flyeas-v75", create_if_missing=True)

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "numpy==1.26.4", "pandas==2.2.2", "pyarrow==16.1.0",
)


@app.function(image=image, cpu=2, volumes={"/vol": volume}, timeout=10 * 60)
def run(alphas=(0.05, 0.10, 0.20)):
    import os
    import json
    import numpy as np
    import pandas as pd

    os.makedirs("/vol/models_v76", exist_ok=True)
    candidates = ["xgb_meta", "bma", "copula", "qrf", "chronos2", "tirex", "patchtst"]
    chosen = None
    for name in candidates:
        for path in (f"/vol/models_v76/{name}_oof_predictions.parquet",
                     f"/vol/models/{name}_oof_predictions.parquet"):
            if os.path.exists(path):
                chosen = (name, path); break
        if chosen:
            break

    if chosen is None:
        return {"status": "aborted", "reason": "no_source"}

    name, path = chosen
    print(f"[conformal] source: {name} ({path})")
    df = pd.read_parquet(path)
    y = df["actual"].values
    p = df["prediction"].values
    residuals = y - p

    calib = {"source_model": name, "offsets": {}}
    for alpha in alphas:
        c = float(np.quantile(residuals, 1 - alpha))
        calib["offsets"][f"alpha_{int(alpha*100)}"] = c
        print(f"  alpha={alpha} c_alpha={c:.2f}")

    calib["residuals_summary"] = {
        "mean": float(np.mean(residuals)),
        "std": float(np.std(residuals)),
        "p05": float(np.quantile(residuals, 0.05)),
        "p95": float(np.quantile(residuals, 0.95)),
    }
    with open("/vol/models_v76/conformal_calibration.json", "w") as f:
        json.dump(calib, f, indent=2)
    volume.commit()
    return {"status": "ok", "calibration": calib}


@app.local_entrypoint()
def main():
    print(run.remote())
