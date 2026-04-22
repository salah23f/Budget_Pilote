"""
chronos2_standalone.py — Chronos-Bolt zero-shot inference.

Self-contained version (no imports from _common) — works inside Modal
containers without needing extra mounts.

Run:
    python3 -m modal run --detach scripts/cloud/v76_ultra/chronos2_standalone.py
"""

from __future__ import annotations

import time
import modal

APP_NAME = "flyeas-v76-chronos2"
VOLUME_NAME = "flyeas-v75"

app = modal.App(APP_NAME)
volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "numpy==1.26.4",
        "pandas==2.2.2",
        "pyarrow==16.1.0",
        "torch==2.3.1",
        "chronos-forecasting>=1.5.1",
        "huggingface_hub>=0.24",
    )
)


@app.function(
    image=image,
    gpu="A10G",
    volumes={"/vol": volume},
    timeout=60 * 60,
)
def run_chronos2(context_len: int = 64, horizon: int = 1, chunk: int = 256):
    import os
    import numpy as np
    import pandas as pd
    import torch
    from chronos import BaseChronosPipeline

    os.makedirs("/vol/models_v76", exist_ok=True)

    print("[chronos2] loading amazon/chronos-bolt-base ...")
    t0 = time.time()
    pipeline = BaseChronosPipeline.from_pretrained(
        "amazon/chronos-bolt-base",
        device_map="cuda",
        torch_dtype=torch.bfloat16,
    )
    print(f"  ready in {time.time() - t0:.1f}s")

    print("[chronos2] loading val features...")
    df = pd.read_parquet("/vol/features/val_features.parquet")
    df = df.sort_values(["origin", "destination", "fetched_at"]).reset_index(drop=True)
    df["route"] = (df["origin"].astype(str) + "-" + df["destination"].astype(str))

    routes = df["route"].unique()
    print(f"[chronos2] inferring {len(routes):,} routes in chunks of {chunk} ...")

    pairs = []
    for r in routes:
        sub = df[df["route"] == r]
        if len(sub) < context_len + 1:
            continue
        prices = sub["price_usd"].values[-context_len - horizon:]
        pairs.append((r, prices[:-horizon], float(prices[-1])))

    rows = []
    for i in range(0, len(pairs), chunk):
        batch = pairs[i:i + chunk]
        ctx = [torch.tensor(p[1]).float() for p in batch]
        try:
            quantiles, mean = pipeline.predict_quantiles(
                context=ctx,
                prediction_length=horizon,
                quantile_levels=[0.1, 0.5, 0.9],
            )
            q_arr = quantiles.cpu().numpy()
            for j, (r, _, actual) in enumerate(batch):
                rows.append({
                    "route": r,
                    "actual": actual,
                    "prediction": float(q_arr[j, 0, 1]),
                    "q10": float(q_arr[j, 0, 0]),
                    "q90": float(q_arr[j, 0, 2]),
                })
        except Exception as e:
            print(f"  batch {i} failed: {e}")
            continue
        if (i // chunk + 1) % 20 == 0:
            print(f"  {i + len(batch):,}/{len(pairs):,}")

    if not rows:
        return {"status": "empty"}

    out = pd.DataFrame(rows)
    out.to_parquet("/vol/models_v76/chronos2_oof_predictions.parquet", index=False)
    volume.commit()
    mae = float((out["prediction"] - out["actual"]).abs().mean())
    print(f"[chronos2] done MAE={mae:.2f} n={len(out):,}")
    return {"status": "ok", "mae": mae, "n_rows": int(len(out))}


@app.local_entrypoint()
def main():
    print(run_chronos2.remote())
