"""
08-train-deepar-fast.py — Fixed DeepAR training.

Same fix as 07-train-tft-fast.py:
    * SEQ_LEN=20 (down from 30)
    * Chronological sampling (keeps last POINTS_PER_ROUTE per route in order)
    * Gradient clipping for Student-t stability
    * OOF predictions saved for ensemble stacking

Input : data/features/train_features.parquet
Output: models/deepar.onnx + models/deepar_oof_predictions.parquet
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
    print("torch not installed.")
    sys.exit(1)

# ---- Device selection ----
# MPS disabled: PyTorch 2.x LSTM on Metal produces NaN/Inf intermittently.
if torch.cuda.is_available():
    DEVICE = torch.device("cuda")
    print(f"[device] Using CUDA")
else:
    DEVICE = torch.device("cpu")
    try:
        n_threads = max(1, os.cpu_count() or 1)
        torch.set_num_threads(n_threads)
        torch.set_num_interop_threads(max(1, n_threads // 2))
        print(f"[device] Using CPU ({n_threads} threads)")
    except Exception:
        print(f"[device] Using CPU")

OUTPUT_DIR = "models"
INPUT_DIR = "data/features"
SEQ_LEN = 20
EPOCHS = 15        # DeepAR NLL converges faster
BATCH_SIZE = 256   # better CPU throughput
LR = 0.001  # back to default — CPU is stable at this rate
HIDDEN = 128
N_LAYERS = 2
POINTS_PER_ROUTE = 80   # CPU-optimized
MIN_POINTS_PER_ROUTE = SEQ_LEN + 5


class DeepAR(nn.Module):
    def __init__(self, input_dim, hidden=128, n_layers=2):
        super().__init__()
        self.lstm = nn.LSTM(input_dim + 1, hidden, n_layers, batch_first=True, dropout=0.15)
        self.mu_head = nn.Linear(hidden, 1)
        self.sigma_head = nn.Sequential(nn.Linear(hidden, 1), nn.Softplus())
        self.nu_head = nn.Sequential(nn.Linear(hidden, 1), nn.Softplus())

    def forward(self, x, y_prev):
        inp = torch.cat([x, y_prev.unsqueeze(-1)], dim=-1)
        h, _ = self.lstm(inp)
        last = h[:, -1, :]
        mu = self.mu_head(last).squeeze(-1)
        sigma = self.sigma_head(last).squeeze(-1) + 1e-4
        nu = self.nu_head(last).squeeze(-1) + 2.01
        return mu, sigma, nu


def student_t_nll(y, mu, sigma, nu, sample_weights=None):
    """Student-t negative log-likelihood with optional per-sample weighting."""
    z = (y - mu) / sigma
    nll = (
        torch.lgamma((nu + 1) / 2) - torch.lgamma(nu / 2)
        - 0.5 * torch.log(nu * np.pi)
        - torch.log(sigma)
        - ((nu + 1) / 2) * torch.log(1 + z ** 2 / nu)
    )
    per_row = -nll
    if sample_weights is not None:
        return (sample_weights * per_row).mean()
    return per_row.mean()


def chronological_sample(df: pd.DataFrame, points_per_route: int) -> pd.DataFrame:
    df = df.sort_values(["origin", "destination", "fetched_at"]).reset_index(drop=True)
    df["__route__"] = df["origin"].astype(str) + "-" + df["destination"].astype(str)
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

    route_col = df["origin"].astype(str) + "-" + df["destination"].astype(str)
    route_counts = route_col.value_counts()
    valid_routes = set(route_counts[route_counts >= MIN_POINTS_PER_ROUTE].index)
    df = df[route_col.isin(valid_routes)].copy()
    print(f"After route filter (>= {MIN_POINTS_PER_ROUTE} points): {len(df):,} rows, {len(valid_routes):,} routes")

    feature_cols = [c for c in df.columns
                    if df[c].dtype in [np.float64, np.float32, np.int64]
                    and c != "price_usd" and "id" not in c.lower()
                    and not c.startswith("Unnamed")]
    if len(feature_cols) < 2:
        print("Insufficient features.")
        return
    print(f"Using {len(feature_cols)} features")

    df["route"] = df["origin"].astype(str) + "-" + df["destination"].astype(str)

    # --- Per-feature standardization — CRITICAL for LSTM/Transformer stability on MPS ---
    print("Computing feature normalization stats...")
    feat_mat = df[feature_cols].fillna(0).values.astype(np.float32)
    feat_mat = np.nan_to_num(feat_mat, nan=0.0, posinf=0.0, neginf=0.0)
    feat_mean = feat_mat.mean(axis=0).astype(np.float32)
    feat_std = feat_mat.std(axis=0).astype(np.float32)
    feat_std = np.maximum(feat_std, 1e-6)
    print(f"  Feature scales: min_std={feat_std.min():.4f}, max_std={feat_std.max():.2f}")

    # Pre-count total sequences to avoid a giant python-list accumulator (OOM-killer fodder)
    print("Counting sequences (pass 1/2)...")
    total_seqs = 0
    for _, group in df.groupby("route", sort=False):
        n = len(group)
        if n >= SEQ_LEN + 2:
            total_seqs += n - (SEQ_LEN + 1)
    if total_seqs < BATCH_SIZE:
        print(f"Only {total_seqs} sequences. Skipping DeepAR.")
        return
    print(f"Pre-allocating arrays for {total_seqs:,} sequences...")

    X_np = np.empty((total_seqs, SEQ_LEN, len(feature_cols)), dtype=np.float32)
    y_np = np.empty((total_seqs,), dtype=np.float32)
    y_prev_np = np.empty((total_seqs, SEQ_LEN), dtype=np.float32)
    route_labels = [None] * total_seqs
    k = 0
    for route, group in df.groupby("route", sort=False):
        group = group.sort_values("fetched_at")
        features = group[feature_cols].fillna(0).values.astype(np.float32)
        features = np.nan_to_num(features, nan=0.0, posinf=0.0, neginf=0.0)
        features = (features - feat_mean) / feat_std
        features = np.clip(features, -5.0, 5.0)
        prices = group["price_usd"].values.astype(np.float32)
        prices = np.nan_to_num(prices, nan=0.0, posinf=0.0, neginf=0.0)
        n = len(features)
        if n < SEQ_LEN + 2:
            continue
        for i in range(SEQ_LEN + 1, n):
            X_np[k] = features[i - SEQ_LEN:i]
            y_np[k] = prices[i]
            y_prev_np[k] = prices[i - SEQ_LEN:i]
            route_labels[k] = route
            k += 1
    X_np = X_np[:k]
    y_np = y_np[:k]
    y_prev_np = y_prev_np[:k]
    route_labels = route_labels[:k]

    X = torch.from_numpy(X_np)
    y = torch.from_numpy(y_np)
    y_prev = torch.from_numpy(y_prev_np)
    print(f"Built {len(X):,} training sequences across {len(set(route_labels)):,} routes")

    y_mean = float(y.mean())
    y_std = float(y.std()) + 1e-8
    y_norm = (y - y_mean) / y_std
    y_prev_norm = (y_prev - y_mean) / y_std

    # --- Tail-aware sample weights (rare-regime upweighting) ---
    y_abs_z = torch.clamp(torch.abs((y - y_mean) / y_std), 0, 5)
    sample_w = 1.0 + 3.0 * (y_abs_z / 5.0)   # 1x baseline, up to 4x at 5 sigma
    print(f"Sample weights: mean={sample_w.mean():.2f}, p90={torch.quantile(sample_w, 0.9):.2f}, max={sample_w.max():.2f}")

    split = int(len(X) * 0.85)
    model = DeepAR(len(feature_cols), HIDDEN, N_LAYERS).to(DEVICE)
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)

    print(f"Training DeepAR: {split} train, {len(X) - split} val")
    for epoch in range(EPOCHS):
        model.train()
        perm = torch.randperm(split)
        total_loss = 0.0
        n_batches = 0

        nan_skipped = 0
        for i in range(0, split - BATCH_SIZE, BATCH_SIZE):
            idx = perm[i:i + BATCH_SIZE]
            xb = X[idx].to(DEVICE, non_blocking=True)
            yb = y_norm[idx].to(DEVICE, non_blocking=True)
            ypb = y_prev_norm[idx].to(DEVICE, non_blocking=True)
            wb = sample_w[idx].to(DEVICE, non_blocking=True)

            optimizer.zero_grad()
            mu, sigma, nu = model(xb, ypb)
            loss = student_t_nll(yb, mu, sigma, nu, sample_weights=wb)

            # --- NaN / Inf guard ---
            if not torch.isfinite(loss):
                nan_skipped += 1
                optimizer.zero_grad()
                continue

            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 0.5)
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
            print(f"  Epoch {epoch + 1}/{EPOCHS} — NLL: {total_loss / max(1, n_batches):.4f}")

    model.eval()
    VAL_CHUNK = 4096
    with torch.no_grad():
        X_val_cpu = X[split:]
        y_val = y[split:]
        yp_val_cpu = y_prev_norm[split:]
        mus = []
        for i in range(0, len(X_val_cpu), VAL_CHUNK):
            xb = X_val_cpu[i:i + VAL_CHUNK].to(DEVICE, non_blocking=True)
            ypb = yp_val_cpu[i:i + VAL_CHUNK].to(DEVICE, non_blocking=True)
            mu_chunk, _, _ = model(xb, ypb)
            mus.append(mu_chunk.cpu())
        mu_cat = torch.cat(mus, dim=0)
        pred = mu_cat.numpy() * y_std + y_mean
        actual = y_val.numpy()
        mae = float(np.abs(pred - actual).mean())
        print(f"  Validation MAE: ${mae:.2f}")

        oof_df = pd.DataFrame({
            "route": route_labels[split:],
            "prediction": pred,
            "actual": actual,
        })
        oof_df.to_parquet(f"{OUTPUT_DIR}/deepar_oof_predictions.parquet", index=False)

    # Export ONNX — move back to CPU to avoid MPS tracer quirks
    model = model.to("cpu")
    dummy_x = torch.randn(1, SEQ_LEN, len(feature_cols))
    dummy_yp = torch.randn(1, SEQ_LEN)
    onnx_path = f"{OUTPUT_DIR}/deepar.onnx"
    try:
        torch.onnx.export(model, (dummy_x, dummy_yp), onnx_path,
                          input_names=["features", "y_prev"],
                          output_names=["mu", "sigma", "nu"],
                          dynamic_axes={"features": {0: "batch"}, "y_prev": {0: "batch"}},
                          opset_version=13)
        print(f"Exported ONNX to {onnx_path}")
    except Exception as e:
        print(f"ONNX export failed ({e}), saving .pt")
        torch.save(model.state_dict(), f"{OUTPUT_DIR}/deepar.pt")

    with open(f"{OUTPUT_DIR}/deepar_metrics.json", "w") as f:
        json.dump({
            "val_mae": mae,
            "y_mean": y_mean,
            "y_std": y_std,
            "train_samples": split,
            "val_samples": len(X) - split,
            "seq_len": SEQ_LEN,
            "points_per_route": POINTS_PER_ROUTE,
        }, f, indent=2)
    print("Done.")


if __name__ == "__main__":
    main()
