"""
07-train-tft-fast.py — Fixed TFT training.

Differences vs 07-train-tft.py:
    * SEQ_LEN reduced from 30 to 20 (works for routes with as few as ~40 obs).
    * Chronological sampling: keeps the last POINTS_PER_ROUTE points per route
      in time order, so sequences are consecutive and usable.
    * Route filter: only process routes that have at least SEQ_LEN + max(HORIZONS) + 5
      points. The previous version would skip TFT entirely if ANY sequence
      was missing; now we skip weak routes but keep the rest.
    * OOF predictions saved for ensemble stacking.

Input : data/features/train_features.parquet
Output: models/tft-quantile.onnx + models/tft_oof_predictions.parquet
"""

import os
import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _env import load_env
load_env()

import numpy as np
import pandas as pd

try:
    import torch
    import torch.nn as nn
except ImportError:
    print("torch not installed. Run: pip3 install torch")
    sys.exit(1)

# ---- Device selection ----
# MPS is intentionally DISABLED for TFT: PyTorch 2.x has known gradient/NaN
# issues with LSTM + TransformerEncoder on Metal. CUDA is used if present,
# otherwise CPU (slower but numerically stable).
if torch.cuda.is_available():
    DEVICE = torch.device("cuda")
    print(f"[device] Using CUDA")
else:
    DEVICE = torch.device("cpu")
    # Enable multi-core CPU throughput
    try:
        n_threads = max(1, os.cpu_count() or 1)
        torch.set_num_threads(n_threads)
        torch.set_num_interop_threads(max(1, n_threads // 2))
        print(f"[device] Using CPU ({n_threads} threads)")
    except Exception:
        print(f"[device] Using CPU")

OUTPUT_DIR = "models"
INPUT_DIR = "data/features"
HORIZONS = [1, 7, 30]
QUANTILES = [0.1, 0.5, 0.9]
D_MODEL = 32
N_HEADS = 4
N_LAYERS = 2
SEQ_LEN = 20
EPOCHS = 20        # reduced from 30 — loss converges well before 20 on quantile loss
BATCH_SIZE = 256   # bigger batches = better CPU throughput
LR = 0.0005  # back to default — CPU is stable at this rate
POINTS_PER_ROUTE = 80        # CPU-optimized: enough history for 55-min training per model
MIN_POINTS_PER_ROUTE = SEQ_LEN + max(HORIZONS) + 5


class SimpleTFT(nn.Module):
    def __init__(self, input_dim, d_model=32, n_heads=4, n_layers=2, n_quantiles=3, n_horizons=3):
        super().__init__()
        self.input_proj = nn.Linear(input_dim, d_model)
        self.lstm = nn.LSTM(d_model, d_model, n_layers, batch_first=True, dropout=0.1)
        encoder_layer = nn.TransformerEncoderLayer(d_model, n_heads, dim_feedforward=d_model * 2, dropout=0.1, batch_first=True)
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=1)
        self.heads = nn.ModuleList([nn.Linear(d_model, n_quantiles) for _ in range(n_horizons)])

    def forward(self, x):
        h = self.input_proj(x)
        h, _ = self.lstm(h)
        h = self.transformer(h)
        last = h[:, -1, :]
        return [head(last) for head in self.heads]


def pinball_loss(pred, target, quantiles, sample_weights=None):
    """Quantile loss with optional per-sample weighting for tail-aware training.

    sample_weights: 1-D tensor [batch] giving relative importance of each row.
    Typical use: w = 1 + 3*(|z_score|/5) so 5-sigma rows count 4x more.
    """
    total = torch.tensor(0.0, device=pred.device)
    for i, tau in enumerate(quantiles):
        err = target - pred[:, i]
        per_row = torch.max(tau * err, (tau - 1) * err)
        if sample_weights is not None:
            total = total + (sample_weights * per_row).mean()
        else:
            total = total + per_row.mean()
    return total / len(quantiles)


def chronological_sample(df: pd.DataFrame, points_per_route: int) -> pd.DataFrame:
    """Keep the LAST points_per_route rows per route, in chronological order.

    Unlike random sampling this preserves contiguity so LSTM/TFT can build
    valid sequences.
    """
    df = df.sort_values(["origin", "destination", "fetched_at"]).reset_index(drop=True)
    df["__route__"] = df["origin"].astype(str) + "-" + df["destination"].astype(str)

    # compute per-route position from the END of each route
    grp = df.groupby("__route__", sort=False)
    df["__rev_idx__"] = grp.cumcount(ascending=False)
    df = df[df["__rev_idx__"] < points_per_route].drop(columns=["__rev_idx__"])
    df = df.drop(columns=["__route__"]).reset_index(drop=True)
    return df


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    path = f"{INPUT_DIR}/train_features.parquet"
    if not os.path.exists(path):
        print(f"Training features not found at {path}")
        sys.exit(1)

    print(f"Loading {path}...")
    df = pd.read_parquet(path)
    print(f"Loaded {len(df):,} rows")

    if "origin" not in df.columns or "destination" not in df.columns:
        print("Missing origin/destination columns")
        sys.exit(1)

    df = chronological_sample(df, POINTS_PER_ROUTE)
    print(f"After chronological sample: {len(df):,} rows")

    # Filter routes that are too short for TFT
    route_col = df["origin"].astype(str) + "-" + df["destination"].astype(str)
    route_counts = route_col.value_counts()
    valid_routes = set(route_counts[route_counts >= MIN_POINTS_PER_ROUTE].index)
    df = df[route_col.isin(valid_routes)].copy()
    print(f"After route filter (>= {MIN_POINTS_PER_ROUTE} points): {len(df):,} rows, {len(valid_routes):,} routes")

    feature_cols = [c for c in df.columns
                    if df[c].dtype in [np.float64, np.float32, np.int64]
                    and c != "price_usd"
                    and "id" not in c.lower()
                    and not c.startswith("Unnamed")]
    if len(feature_cols) < 2:
        print("Insufficient features for TFT. Skipping.")
        return
    print(f"Using {len(feature_cols)} features")

    df["route"] = df["origin"].astype(str) + "-" + df["destination"].astype(str)

    # --- Per-feature standardization (z-score) — CRITICAL for LSTM/Transformer stability on MPS ---
    print("Computing feature normalization stats...")
    feat_mat = df[feature_cols].fillna(0).values.astype(np.float32)
    feat_mat = np.nan_to_num(feat_mat, nan=0.0, posinf=0.0, neginf=0.0)
    feat_mean = feat_mat.mean(axis=0).astype(np.float32)
    feat_std = feat_mat.std(axis=0).astype(np.float32)
    feat_std = np.maximum(feat_std, 1e-6)  # avoid div-by-zero on constant columns
    print(f"  Feature scales: min_std={feat_std.min():.4f}, max_std={feat_std.max():.2f}")

    max_h = max(HORIZONS)
    # Pre-count total sequences to avoid a giant python-list accumulator (OOM-killer fodder)
    print("Counting sequences (pass 1/2)...")
    total_seqs = 0
    for _, group in df.groupby("route", sort=False):
        n = len(group)
        if n >= SEQ_LEN + max_h + 1:
            total_seqs += max(0, n - max_h - SEQ_LEN)
    if total_seqs < BATCH_SIZE:
        print(f"Only {total_seqs} sequences (need >= {BATCH_SIZE}). Skipping TFT.")
        return
    print(f"Pre-allocating arrays for {total_seqs:,} sequences...")

    X = np.empty((total_seqs, SEQ_LEN, len(feature_cols)), dtype=np.float32)
    y = np.empty((total_seqs, len(HORIZONS)), dtype=np.float32)
    route_labels = [None] * total_seqs
    k = 0
    for route, group in df.groupby("route", sort=False):
        group = group.sort_values("fetched_at")
        features = group[feature_cols].fillna(0).values.astype(np.float32)
        features = np.nan_to_num(features, nan=0.0, posinf=0.0, neginf=0.0)
        # Z-score normalization using global stats
        features = (features - feat_mean) / feat_std
        # Clip to avoid extreme outliers destabilizing training
        features = np.clip(features, -5.0, 5.0)
        prices = group["price_usd"].values.astype(np.float32)
        prices = np.nan_to_num(prices, nan=0.0, posinf=0.0, neginf=0.0)
        n = len(features)
        if n < SEQ_LEN + max_h + 1:
            continue
        for i in range(SEQ_LEN, n - max_h):
            X[k] = features[i - SEQ_LEN:i]
            for j, h in enumerate(HORIZONS):
                y[k, j] = prices[min(i + h, n - 1)]
            route_labels[k] = route
            k += 1
    X = X[:k]
    y = y[:k]
    route_labels = route_labels[:k]
    print(f"Built {len(X):,} training sequences across {len(set(route_labels)):,} routes")

    y_mean = float(y.mean())
    y_std = float(y.std() + 1e-8)
    y_norm = (y - y_mean) / y_std

    # --- Tail-aware sample weights: rows with extreme z-score count more ---
    # z_score = (y - per-sample mean) / per-sample std — proxy via cohort stats
    y_abs_z = np.abs((y[:, 0] - y_mean) / (y_std + 1e-8)).clip(0, 5)
    sample_w_all = 1.0 + 3.0 * (y_abs_z / 5.0)   # 1x normal, up to 4x at 5 sigma
    sample_w_all = sample_w_all.astype(np.float32)
    print(f"Sample weights: mean={sample_w_all.mean():.2f}, p90={np.quantile(sample_w_all,0.9):.2f}, max={sample_w_all.max():.2f}")

    split = int(len(X) * 0.85)
    # Keep train tensors on CPU (memory!) and move batches to DEVICE on the fly
    X_train = torch.from_numpy(X[:split])
    y_train = torch.from_numpy(y_norm[:split])
    X_val = torch.from_numpy(X[split:])
    y_val = torch.from_numpy(y_norm[split:])
    w_train = torch.from_numpy(sample_w_all[:split])

    model = SimpleTFT(len(feature_cols), D_MODEL, N_HEADS, N_LAYERS, len(QUANTILES), len(HORIZONS)).to(DEVICE)
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)

    print(f"Training TFT: {len(X_train)} sequences, {len(HORIZONS)} horizons, {len(QUANTILES)} quantiles")
    for epoch in range(EPOCHS):
        model.train()
        perm = torch.randperm(len(X_train))
        total_loss = 0.0
        n_batches = 0

        nan_skipped = 0
        for i in range(0, len(X_train) - BATCH_SIZE, BATCH_SIZE):
            idx = perm[i:i + BATCH_SIZE]
            xb = X_train[idx].to(DEVICE, non_blocking=True)
            yb = y_train[idx].to(DEVICE, non_blocking=True)
            wb = w_train[idx].to(DEVICE, non_blocking=True)

            optimizer.zero_grad()
            preds = model(xb)
            loss = sum(pinball_loss(preds[h], yb[:, h], QUANTILES, sample_weights=wb) for h in range(len(HORIZONS)))

            # --- NaN / Inf guard — common MPS LSTM issue ---
            if not torch.isfinite(loss):
                nan_skipped += 1
                optimizer.zero_grad()
                continue

            loss.backward()
            # Stronger grad clipping for MPS stability
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=0.5)
            # Drop the step if any grad is NaN
            bad_grad = any(
                (p.grad is not None and not torch.isfinite(p.grad).all())
                for p in model.parameters()
            )
            if bad_grad:
                nan_skipped += 1
                optimizer.zero_grad()
                continue
            optimizer.step()
            total_loss += loss.item()
            n_batches += 1
        if nan_skipped:
            print(f"    (skipped {nan_skipped} NaN/Inf batches this epoch)")

        if (epoch + 1) % 5 == 0:
            avg = total_loss / max(1, n_batches)
            print(f"  Epoch {epoch + 1}/{EPOCHS} — loss: {avg:.4f}")

    # Validation — chunked to avoid a 525k-batch forward on GPU
    model.eval()
    val_mae = []
    VAL_CHUNK = 4096
    with torch.no_grad():
        val_pred_horizons = [[] for _ in range(len(HORIZONS))]
        for i in range(0, len(X_val), VAL_CHUNK):
            xb = X_val[i:i + VAL_CHUNK].to(DEVICE, non_blocking=True)
            chunk_preds = model(xb)
            for h in range(len(HORIZONS)):
                val_pred_horizons[h].append(chunk_preds[h].cpu())
        val_preds = [torch.cat(pp, dim=0) for pp in val_pred_horizons]

        for h in range(len(HORIZONS)):
            median = val_preds[h][:, 1].numpy() * y_std + y_mean
            actual = y_val[:, h].numpy() * y_std + y_mean
            mae = float(np.abs(median - actual).mean())
            val_mae.append(mae)
            print(f"  Horizon J+{HORIZONS[h]}: MAE=${mae:.2f}")

        # OOF predictions for ensemble stacking (median quantile of horizon 1)
        oof_median_h1 = val_preds[0][:, 1].numpy() * y_std + y_mean
        oof_df = pd.DataFrame({
            "route": route_labels[split:],
            "prediction": oof_median_h1,
            "actual": y_val[:, 0].numpy() * y_std + y_mean,
        })
        oof_df.to_parquet(f"{OUTPUT_DIR}/tft_oof_predictions.parquet", index=False)

    # Export ONNX (move back to CPU — ONNX export on MPS is flaky)
    model = model.to("cpu")
    dummy = torch.randn(1, SEQ_LEN, len(feature_cols))
    onnx_path = f"{OUTPUT_DIR}/tft-quantile.onnx"
    try:
        torch.onnx.export(model, dummy, onnx_path,
                          input_names=["input"],
                          output_names=[f"horizon_{h}" for h in HORIZONS],
                          dynamic_axes={"input": {0: "batch"}},
                          opset_version=13)
        print(f"Exported ONNX to {onnx_path}")
    except Exception as e:
        print(f"ONNX export failed ({e}), saving .pt instead")
        torch.save(model.state_dict(), f"{OUTPUT_DIR}/tft-quantile.pt")

    metrics = {
        "val_mae": {f"J+{h}": m for h, m in zip(HORIZONS, val_mae)},
        "train_samples": len(X_train),
        "val_samples": len(X_val),
        "features": len(feature_cols),
        "y_mean": y_mean,
        "y_std": y_std,
        "seq_len": SEQ_LEN,
        "points_per_route": POINTS_PER_ROUTE,
    }
    with open(f"{OUTPUT_DIR}/tft_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    print("Done.")


if __name__ == "__main__":
    main()
