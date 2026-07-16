"""s03_copula.py — Archimedean copula ensemble (standalone)."""
import modal

app = modal.App("flyeas-v76-copula")
volume = modal.Volume.from_name("flyeas-v75", create_if_missing=True)

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "numpy==1.26.4", "pandas==2.2.2", "pyarrow==16.1.0", "scipy==1.13.1",
)

MODEL_NAMES = ["chronos2", "tirex", "moirai2", "timesfm",
               "patchtst", "mamba", "kan", "garch_nn", "mlcaformer",
               "timegrad", "ts2vec", "qrf"]


@app.function(image=image, cpu=4, volumes={"/vol": volume},
              timeout=15 * 60, memory=8 * 1024)
def run():
    import os
    import json
    import numpy as np
    import pandas as pd
    from scipy.stats import rankdata

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

    U = np.zeros_like(P)
    for j in range(P.shape[1]):
        U[:, j] = rankdata(P[:, j]) / (len(P) + 1)
    y_rank = rankdata(y) / (len(y) + 1)

    tau_vals = []
    for j in range(U.shape[1]):
        rho = np.corrcoef(U[:, j], y_rank)[0, 1]
        tau_vals.append((2.0 / np.pi) * np.arcsin(rho))
    tau_vals = np.array(tau_vals)
    theta = np.maximum(2 * tau_vals / (1 - tau_vals.clip(max=0.99)), 0.05)

    weights = tau_vals.clip(min=0.01)
    weights = weights / weights.sum()

    pred = P @ weights
    mae = float(np.abs(pred - y).mean())
    wd = {k: float(v) for k, v in zip(cols, weights)}

    print(f"[copula] val MAE={mae:.2f}")
    for k, v in sorted(wd.items(), key=lambda kv: -kv[1]):
        print(f"  {k:<12} w={v:.4f} tau={tau_vals[cols.index(k)]:.3f}")

    with open("/vol/models_v76/copula_weights.json", "w") as f:
        json.dump({"weights": wd,
                    "tau": dict(zip(cols, tau_vals.tolist())),
                    "theta": dict(zip(cols, theta.tolist())),
                    "val_mae": mae}, f, indent=2)
    pd.DataFrame({"route": merged["route"].values,
                   "actual": y, "prediction": pred}).to_parquet(
        "/vol/models_v76/copula_oof_predictions.parquet", index=False)
    volume.commit()
    return {"status": "ok", "mae": mae, "weights": wd}


@app.local_entrypoint()
def main():
    print(run.remote())
