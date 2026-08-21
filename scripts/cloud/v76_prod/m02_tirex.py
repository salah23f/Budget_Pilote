"""m02_tirex.py — NX-AI TiRex zero-shot (standalone)."""
import time
import modal

app = modal.App("flyeas-v76-tirex")
volume = modal.Volume.from_name("flyeas-v75", create_if_missing=True)

image = (modal.Image.debian_slim(python_version="3.11")
         .apt_install("git")
         .pip_install(
             "numpy==1.26.4", "pandas==2.2.2", "pyarrow==16.1.0",
             "torch==2.3.1",
             "tirex @ git+https://github.com/NX-AI/tirex.git",
             "huggingface_hub>=0.24",
         ))


@app.function(image=image, gpu="A100", volumes={"/vol": volume}, timeout=60 * 60)
def run(context_len: int = 128, horizon: int = 1, chunk: int = 128):
    import os
    import numpy as np
    import pandas as pd
    import torch
    try:
        from tirex import load_model, ForecastModel
    except ImportError as e:
        print(f"[tirex] import failed: {e}")
        return {"status": "skipped", "reason": str(e)}

    os.makedirs("/vol/models_v76", exist_ok=True)
    print("[tirex] loading NX-AI/TiRex ...")
    t0 = time.time()
    try:
        model: ForecastModel = load_model("NX-AI/TiRex")
    except Exception as e:
        print(f"[tirex] load failed: {e}")
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
        ctx = torch.stack([torch.from_numpy(x[1]) for x in batch]).to("cuda")
        try:
            q, _ = model.forecast(context=ctx, prediction_length=horizon)
            q = q.cpu().numpy()
            for j, (r, _, actual) in enumerate(batch):
                rows.append({"route": r, "actual": actual,
                             "prediction": float(q[j, 4, 0]),
                             "q10": float(q[j, 0, 0]), "q90": float(q[j, 8, 0])})
        except Exception as e:
            print(f"  batch {i} failed: {e}")
        if (i // chunk + 1) % 20 == 0:
            print(f"  {i + len(batch):,}/{len(pairs):,}")

    if not rows:
        return {"status": "empty"}
    out = pd.DataFrame(rows)
    out.to_parquet("/vol/models_v76/tirex_oof_predictions.parquet", index=False)
    volume.commit()
    mae = float((out["prediction"] - out["actual"]).abs().mean())
    print(f"[tirex] done MAE={mae:.2f} n={len(out):,}")
    return {"status": "ok", "mae": mae, "n": int(len(out))}


@app.local_entrypoint()
def main():
    print(run.remote())
