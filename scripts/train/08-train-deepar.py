"""
08-train-deepar.py — DeepAR autoregressive RNN with distributional output.

LSTM autoregressive model that outputs Student-t distribution parameters
(mu, sigma, nu) for robustness to outliers (mistake fares).

Monte Carlo 200 samples at inference for quantile estimation.

Input: data/features/train_features.parquet
Output: models/deepar.onnx
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

OUTPUT_DIR = "models"
INPUT_DIR = "data/features"
SEQ_LEN = 30
EPOCHS = 25
BATCH_SIZE = 128
LR = 0.001
HIDDEN = 128
N_LAYERS = 2


class DeepAR(nn.Module):
    """DeepAR with Student-t output distribution."""
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
        nu = self.nu_head(last).squeeze(-1) + 2.01  # nu > 2 for finite variance
        return mu, sigma, nu


def student_t_nll(y, mu, sigma, nu):
    """Negative log-likelihood of Student-t distribution."""
    z = (y - mu) / sigma
    nll = (
        torch.lgamma((nu + 1) / 2) - torch.lgamma(nu / 2)
        - 0.5 * torch.log(nu * np.pi)
        - torch.log(sigma)
        - ((nu + 1) / 2) * torch.log(1 + z ** 2 / nu)
    )
    return -nll.mean()


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    path = f"{INPUT_DIR}/train_features.parquet"
    if not os.path.exists(path):
        print("No training features.")
        return

    df = pd.read_parquet(path)
    print(f"Loaded {len(df)} rows")

    feature_cols = [c for c in df.columns
                    if df[c].dtype in [np.float64, np.float32, np.int64]
                    and c != 'price_usd' and 'id' not in c.lower()
                    and not c.startswith('Unnamed')]

    if len(feature_cols) < 2:
        print("Insufficient features.")
        return

    if 'origin' in df.columns and 'destination' in df.columns:
        df['route'] = df['origin'] + '-' + df['destination']
    else:
        df['route'] = 'default'

    X_all, y_all, y_prev_all = [], [], []
    for _, group in df.groupby('route'):
        group = group.sort_values('fetched_at')
        features = group[feature_cols].fillna(0).values.astype(np.float32)
        prices = group['price_usd'].values.astype(np.float32) if 'price_usd' in group.columns else features[:, 0]

        for i in range(SEQ_LEN + 1, len(features)):
            X_all.append(features[i - SEQ_LEN:i])
            y_all.append(prices[i])
            y_prev_all.append(prices[i - SEQ_LEN:i])

    if len(X_all) < BATCH_SIZE:
        print(f"Only {len(X_all)} sequences. Skipping DeepAR.")
        return

    X = torch.from_numpy(np.array(X_all))
    y = torch.from_numpy(np.array(y_all))
    y_prev = torch.from_numpy(np.array(y_prev_all))

    # Normalize
    y_mean = float(y.mean())
    y_std = float(y.std()) + 1e-8
    y_norm = (y - y_mean) / y_std
    y_prev_norm = (y_prev - y_mean) / y_std

    split = int(len(X) * 0.85)
    model = DeepAR(len(feature_cols), HIDDEN, N_LAYERS)
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)

    print(f"Training DeepAR: {split} train, {len(X) - split} val")

    for epoch in range(EPOCHS):
        model.train()
        perm = torch.randperm(split)
        total_loss = 0
        n_batches = 0

        for i in range(0, split - BATCH_SIZE, BATCH_SIZE):
            idx = perm[i:i + BATCH_SIZE]
            xb = X[idx]
            yb = y_norm[idx]
            ypb = y_prev_norm[idx]

            optimizer.zero_grad()
            mu, sigma, nu = model(xb, ypb)
            loss = student_t_nll(yb, mu, sigma, nu)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            total_loss += loss.item()
            n_batches += 1

        if (epoch + 1) % 5 == 0:
            print(f"  Epoch {epoch + 1}/{EPOCHS} — NLL: {total_loss / max(1, n_batches):.4f}")

    # Validate
    model.eval()
    with torch.no_grad():
        X_val = X[split:]
        y_val = y[split:]
        yp_val = y_prev_norm[split:]
        mu, sigma, nu = model(X_val, yp_val)
        pred = mu.numpy() * y_std + y_mean
        actual = y_val.numpy()
        mae = np.abs(pred - actual).mean()
        print(f"  Validation MAE: ${mae:.2f}")

    # Export
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
        print(f"ONNX export failed: {e}")
        torch.save(model.state_dict(), f"{OUTPUT_DIR}/deepar.pt")

    with open(f"{OUTPUT_DIR}/deepar_metrics.json", 'w') as f:
        json.dump({'val_mae': float(mae), 'y_mean': y_mean, 'y_std': y_std,
                   'train_samples': split, 'val_samples': len(X) - split}, f, indent=2)
    print("Done.")


if __name__ == "__main__":
    main()
