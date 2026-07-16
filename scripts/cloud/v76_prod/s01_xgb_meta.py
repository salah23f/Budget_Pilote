"""s01_xgb_meta.py — XGBoost meta-learner over all available OOF (standalone)."""
import time
import modal

app = modal.App("flyeas-v76-xgb-meta")
volume = modal.Volume.from_name("flyeas-v75", create_if_missing=True)

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "numpy==1.26.4", "pandas==2.2.2", "pyarrow==16.1.0", "xgboost==2.1.1",
)

MODEL_NAMES = ["chronos2", "tirex", "moirai2", "timesfm",
               "patchtst", "mamba", "kan", "garch_nn", "mlcaformer",
               "timegrad", "ts2vec", "qrf"]


@app.function(image=image, cpu=4, volumes={"/vol": volume},
              timeout=30 * 60, memory=16 * 1024)
def run():
    import os
    import json
    import numpy as np
    import pandas as pd
    import xgboost as xgb

    os.makedirs("/vol/models_v76", exist_ok=True)
    print("[xgb-meta] scanning OOFs...")

    oof = {}
    for name in MODEL_NAMES:
        for path in (f"/vol/models_v76/{name}_oof_predictions.parquet",
                     f"/vol/models/{name}_oof_predictions.parquet"):
            if os.path.exists(path):
                try:
                    df = pd.read_parquet(path)
                    if {"route", "prediction", "actual"}.issubset(df.columns):
                        oof[name] = df.groupby("route", as_index=False).agg(
                            prediction=("prediction", "median"),
                            actual=("actual", "median"))
                        print(f"  [ok] {name}: {len(oof[name]):,}  ← {path}")
                        break
                except Exception as e:
                    print(f"  [err] {name}: {e}")
        else:
            print(f"  [miss] {name}")

    if len(oof) < 2:
        return {"status": "aborted", "reason": "not_enough_models"}

    merged = None
    for name, df in oof.items():
        df2 = df.rename(columns={"prediction": name})
        merged = df2 if merged is None else merged.merge(df2.drop(columns=["actual"]),
                                                          on="route", how="inner")

    y = merged["actual"].values.astype(np.float32)
    cols = [c for c in merged.columns if c not in ("route", "actual")]
    X = merged[cols].values.astype(np.float32)
    print(f"[xgb-meta] design matrix: {X.shape}")

    n = len(X)
    split = int(n * 0.8)
    Xtr, ytr = X[:split], y[:split]
    Xva, yva = X[split:], y[split:]

    model = xgb.XGBRegressor(n_estimators=500, max_depth=6, learning_rate=0.05,
                              subsample=0.8, colsample_bytree=0.8, reg_lambda=1.0,
                              objective="reg:absoluteerror", n_jobs=-1, tree_method="hist")
    t0 = time.time()
    model.fit(Xtr, ytr, eval_set=[(Xva, yva)], verbose=False)
    print(f"  fitted in {time.time()-t0:.1f}s")

    pred_va = model.predict(Xva)
    mae = float(np.abs(pred_va - yva).mean())
    fi = dict(zip(cols, map(float, model.feature_importances_)))
    print(f"[xgb-meta] val MAE={mae:.2f}")
    for k, v in sorted(fi.items(), key=lambda kv: -kv[1]):
        print(f"  {k:<12} {v:.4f}")

    model.save_model("/vol/models_v76/xgb_meta.json")
    with open("/vol/models_v76/xgb_meta_weights.json", "w") as f:
        json.dump({"feature_importance": fi, "val_mae": mae,
                    "n_samples": int(len(X)), "n_models": len(cols),
                    "models": cols}, f, indent=2)

    full = model.predict(X)
    pd.DataFrame({"route": merged["route"].values, "actual": y,
                   "prediction": full}).to_parquet(
        "/vol/models_v76/xgb_meta_oof_predictions.parquet", index=False)
    volume.commit()
    return {"status": "ok", "val_mae": mae, "n_models": len(cols), "importance": fi}


@app.local_entrypoint()
def main():
    print(run.remote())
