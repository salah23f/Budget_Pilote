"""m04_timesfm.py — Google TimesFM 2.5 zero-shot (standalone)."""
import time
import modal

app = modal.App("flyeas-v76-timesfm")
volume = modal.Volume.from_name("flyeas-v75", create_if_missing=True)

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "numpy==1.26.4", "pandas==2.2.2", "pyarrow==16.1.0",
    "torch==2.3.1", "timesfm>=1.3.0", "huggingface_hub>=0.24",
)


@app.function(image=image, gpu="A10G", volumes={"/vol": volume}, timeout=60 * 60)
def run(context_len: int = 128, horizon: int = 1, chunk: int = 64):
    import os
    import numpy as np
    import pandas as pd
    import torch
    try:
        import timesfm
    except ImportError as e:
        print(f"[timesfm] import failed: {e}")
        return {"status": "skipped", "reason": str(e)}

    os.makedirs("/vol/models_v76", exist_ok=True)
    torch.set_float32_matmul_precision("high")
    print("[timesfm] loading google/timesfm-2.5-200m-pytorch ...")
    t0 = time.time()
    try:
        model = timesfm.TimesFM_2p5_200M_torch.from_pretrained(
            "google/timesfm-2.5-200m-pytorch")
        model.compile(timesfm.ForecastConfig(
            max_context=context_len, max_horizon=horizon,
            normalize_inputs=True, use_continuous_quantile_head=True,
            force_flip_invariance=True, infer_is_positive=True,
            fix_quantile_crossing=True,
        ))
    except Exception as e:
        print(f"[timesfm] load failed: {e}")
        return {"status": "skipped", "reason": f"load:{e}"}
    print(f"  ready in {time.time() - t0:.1f}s")

    df = pd.read_parquet("/vol/features/val_features.parquet")
    df = df.sort_values(["origin", "destination", "fetched_at"]).reset_index(drop=True)
    df["route"] = df["origin"].astype(str) + "-" + df["destination"].astype(str)

    pairs = []
    for r in df["route"].unique():
        sub = df[df["route"] == r]
        if len(sub) < context_len + 1:
            continue
        p = sub["price_usd"].values[-context_len - horizon:].astype(np.float32)
        pairs.append((r, p[:-horizon], float(p[-1])))

    rows = []
    for i in range(0, len(pairs), chunk):
        batch = pairs[i:i + chunk]
        inputs = [x[1] for x in batch]
        try:
            point, quant = model.forecast(horizon=horizon, inputs=inputs)
            q = np.array(quant)
            for j, (r, _, actual) in enumerate(batch):
                try:
                    q10 = float(q[j, 0, 0])
                    q50 = float(point[j, 0])
                    q90 = float(q[j, 0, -1])
                except Exception:
                    q10 = q50 = q90 = float(point[j, 0])
                rows.append({"route": r, "actual": actual,
                             "prediction": q50, "q10": q10, "q90": q90})
        except Exception as e:
            print(f"  chunk {i} failed: {e}")
        if (i // chunk + 1) % 20 == 0:
            print(f"  {i + len(batch):,}/{len(pairs):,}")

    if not rows:
        return {"status": "empty"}
    out = pd.DataFrame(rows)
    out.to_parquet("/vol/models_v76/timesfm_oof_predictions.parquet", index=False)
    volume.commit()
    mae = float((out["prediction"] - out["actual"]).abs().mean())
    print(f"[timesfm] done MAE={mae:.2f} n={len(out):,}")
    return {"status": "ok", "mae": mae, "n": int(len(out))}


@app.local_entrypoint()
def main():
    print(run.remote())
