"""m03_moirai2.py — Salesforce Moirai 2.0 zero-shot (standalone)."""
import time
import modal

app = modal.App("flyeas-v76-moirai2")
volume = modal.Volume.from_name("flyeas-v75", create_if_missing=True)

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "numpy==1.26.4", "pandas==2.2.2", "pyarrow==16.1.0",
    "torch==2.3.1", "uni2ts>=1.3.0", "gluonts>=0.15", "huggingface_hub>=0.24",
)


@app.function(image=image, gpu="A10G", volumes={"/vol": volume},
              timeout=60 * 60, memory=16 * 1024)
def run(context_len: int = 128, horizon: int = 1, batch_size: int = 64, variant: str = "small"):
    import os
    import numpy as np
    import pandas as pd
    import torch
    try:
        from uni2ts.model.moirai2 import Moirai2Forecast, Moirai2Module
        from gluonts.dataset.common import ListDataset
    except ImportError as e:
        print(f"[moirai2] import failed: {e}")
        return {"status": "skipped", "reason": str(e)}

    os.makedirs("/vol/models_v76", exist_ok=True)
    print(f"[moirai2] loading Salesforce/moirai-2.0-R-{variant} ...")
    t0 = time.time()
    try:
        module = Moirai2Module.from_pretrained(f"Salesforce/moirai-2.0-R-{variant}")
        model = Moirai2Forecast(module=module, prediction_length=horizon,
                                 context_length=context_len, target_dim=1,
                                 feat_dynamic_real_dim=0, past_feat_dynamic_real_dim=0)
        predictor = model.create_predictor(batch_size=batch_size)
    except Exception as e:
        print(f"[moirai2] load/predictor failed: {e}")
        return {"status": "skipped", "reason": f"load:{e}"}
    print(f"  ready in {time.time() - t0:.1f}s")

    df = pd.read_parquet("/vol/features/val_features.parquet")
    df = df.sort_values(["origin", "destination", "fetched_at"]).reset_index(drop=True)
    df["route"] = df["origin"].astype(str) + "-" + df["destination"].astype(str)

    entries, ref = [], []
    for r in df["route"].unique():
        sub = df[df["route"] == r]
        if len(sub) < context_len + 1:
            continue
        p = sub["price_usd"].values[-context_len - horizon:].astype(np.float32)
        entries.append({"start": pd.Period("2000-01-01", freq="D"), "target": p[:-horizon]})
        ref.append((r, float(p[-1])))

    if not entries:
        return {"status": "empty"}

    ds = ListDataset(entries, freq="D")
    print(f"[moirai2] predicting {len(entries):,} series ...")
    rows = []
    try:
        for i, fc in enumerate(predictor.predict(ds)):
            r, actual = ref[i]
            try:
                q10 = float(fc.quantile(0.1)[0])
                q50 = float(fc.quantile(0.5)[0])
                q90 = float(fc.quantile(0.9)[0])
            except Exception:
                s = fc.samples
                q10, q50, q90 = (float(np.quantile(s[:, 0], q)) for q in (0.1, 0.5, 0.9))
            rows.append({"route": r, "actual": actual,
                         "prediction": q50, "q10": q10, "q90": q90})
            if (i + 1) % 5000 == 0:
                print(f"  {i + 1}/{len(entries)}")
    except Exception as e:
        print(f"[moirai2] predict loop failed: {e}")
        if not rows:
            return {"status": "skipped", "reason": f"predict:{e}"}

    out = pd.DataFrame(rows)
    out.to_parquet("/vol/models_v76/moirai2_oof_predictions.parquet", index=False)
    volume.commit()
    mae = float((out["prediction"] - out["actual"]).abs().mean())
    print(f"[moirai2] done MAE={mae:.2f} n={len(out):,}")
    return {"status": "ok", "mae": mae, "n": int(len(out))}


@app.local_entrypoint()
def main():
    print(run.remote())
