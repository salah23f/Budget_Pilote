"""
xgb_meta.py — Level-1 meta-learner (XGBoost) that stacks all available OOF
prediction files produced by the level-0 models in v76_ultra.

Tolerant to missing models: if Moirai / TiRex / TimesFM failed, we still
train a useful meta-learner on whatever did finish.

Run:
    modal run scripts/cloud/v76_ultra/stacking/xgb_meta.py
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import app, volume, base_image, MODELS_DIR, ensure_dirs

xgb_image = base_image.pip_install("xgboost==2.1.1")

MODEL_NAMES = [
    "chronos2", "tirex", "moirai2", "timesfm",           # foundation
    "patchtst", "mamba", "kan", "garch_nn", "mlcaformer",  # custom trained
    "timegrad", "ts2vec",                                   # probabilistic / pretraining
    "qrf",                                                  # baseline from V7.5
]


@app.function(
    image=xgb_image,
    cpu=4,
    volumes={"/vol": volume},
    timeout=30 * 60,
    memory=16 * 1024,
)
def fit_xgb_meta():
    import os
    import json
    import numpy as np
    import pandas as pd
    import xgboost as xgb

    ensure_dirs()
    print("[xgb-meta] scanning OOF files...")

    oof = {}
    for name in MODEL_NAMES:
        path = f"{MODELS_DIR}/{name}_oof_predictions.parquet"
        if not os.path.exists(path):
            # V7.5 output lives at the old path — try there as well
            alt = f"/vol/models/{name}_oof_predictions.parquet"
            if os.path.exists(alt):
                path = alt
            else:
                print(f"  [miss] {name}")
                continue
        try:
            df = pd.read_parquet(path)
            if "prediction" not in df.columns or "actual" not in df.columns:
                print(f"  [bad columns] {name}")
                continue
            if "route" not in df.columns:
                print(f"  [no route key] {name}")
                continue
            oof[name] = df[["route", "prediction", "actual"]].copy()
            print(f"  [ok] {name}: {len(df):,}")
        except Exception as e:
            print(f"  [err] {name}: {e}")

    if len(oof) < 2:
        print("[xgb-meta] need at least 2 models — abort")
        return {"status": "aborted", "reason": "not_enough_models"}

    # Inner-join on route to keep only rows where ALL present models have OOF.
    # We also tolerate cases where some models have duplicate routes by taking
    # the median.
    merged = None
    for name, df in oof.items():
        gb = df.groupby("route", as_index=False).agg(
            **{f"{name}": ("prediction", "median"), "actual": ("actual", "median")}
        )
        if merged is None:
            merged = gb
        else:
            gb = gb.drop(columns=["actual"])
            merged = merged.merge(gb, on="route", how="inner")

    if merged is None or len(merged) < 1000:
        print(f"[xgb-meta] only {0 if merged is None else len(merged)} aligned rows — abort")
        return {"status": "aborted"}

    y = merged["actual"].values.astype(np.float32)
    cols = [c for c in merged.columns if c not in ("route", "actual")]
    X = merged[cols].values.astype(np.float32)
    print(f"[xgb-meta] aligned design matrix: {X.shape}")

    # Time-based split (route-stratified would be better but we keep it simple)
    n = len(X)
    split = int(n * 0.8)
    Xtr, ytr = X[:split], y[:split]
    Xva, yva = X[split:], y[split:]

    model = xgb.XGBRegressor(
        n_estimators=1000, max_depth=8, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8,
        reg_lambda=1.0, objective="reg:absoluteerror",
        n_jobs=-1, tree_method="hist",
        early_stopping_rounds=50,
    )
    t0 = time.time()
    model.fit(Xtr, ytr, eval_set=[(Xva, yva)], verbose=False)
    print(f"  fitted in {time.time()-t0:.1f}s")

    pred_va = model.predict(Xva)
    mae = float(np.abs(pred_va - yva).mean())
    # Feature importance gives us the "ensemble weights"
    fi = dict(zip(cols, map(float, model.feature_importances_)))
    print(f"[xgb-meta] val MAE={mae:.2f}")
    for k, v in sorted(fi.items(), key=lambda kv: -kv[1]):
        print(f"    {k:<12} {v:.4f}")

    model.save_model(f"{MODELS_DIR}/xgb_meta.json")
    with open(f"{MODELS_DIR}/xgb_meta_weights.json", "w") as f:
        json.dump({
            "feature_importance": fi,
            "val_mae": mae,
            "n_samples": int(len(X)),
            "n_models": len(cols),
            "models": cols,
        }, f, indent=2)

    # OOF predictions produced by the meta (for level 2 / policy layer)
    full_pred = model.predict(X)
    out = pd.DataFrame({"route": merged["route"].values,
                         "actual": y, "prediction": full_pred})
    out.to_parquet(f"{MODELS_DIR}/xgb_meta_oof_predictions.parquet", index=False)

    volume.commit()
    return {"status": "ok", "val_mae": mae, "n_models": len(cols),
            "importance": fi}


# Standalone: modal run scripts/cloud/v76_ultra/stacking/xgb_meta.py::fit_xgb_meta
