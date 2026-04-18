"""
07-train-tft.py — Temporal Fusion Transformer (lightweight).

2 encoder + 2 decoder attention blocks.
Multi-horizon: J+1, J+7, J+30.
Variable selection networks for static (route) and dynamic (price, ttd) features.

Input: data/features/train_features.parquet
Output: models/tft-quantile.onnx
"""

import os
import sys
import json
import numpy as np
import pandas as pd

try:
    import torch
    import torch.nn as nn
except ImportError:
    print("torch not installed. Run: pip install torch")
    sys.exit(1)

OUTPUT_DIR = "models"
INPUT_DIR = "data/features"
HORIZONS = [1, 7, 30]
QUANTILES = [0.1, 0.5, 0.9]
D_MODEL = 32
N_HEADS = 4
N_LAYERS = 2
SEQ_LEN = 30
EPOCHS = 30
BATCH_SIZE = 128
LR = 0.0005


class SimpleTFT(nn.Module):
    """Simplified TFT: LSTM encoder + multi-head attention + quantile heads."""
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


def pinball_loss(pred, target, quantiles):
    total = torch.tensor(0.0)
    for i, tau in enumerate(quantiles):
        err = target - pred[:, i]
        total = total + torch.mean(torch.max(tau * err, (tau - 1) * err))
    return total / len(quantiles)


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    path = f"{INPUT_DIR}/train_features.parquet"
    if not os.path.exists(path):
        print("No training features found.")
        return

    df = pd.read_parquet(path)
    print(f"Loaded {len(df)} rows")

    feature_cols = [c for c in df.columns
                    if df[c].dtype in [np.float64, np.float32, np.int64]
                    and c != 'price_usd' and 'id' not in c.lower()
                    and not c.startswith('Unnamed')]

    if len(feature_cols) < 2:
        print("Insufficient features for TFT. Skipping.")
        return

    print(f"Using {len(feature_cols)} features")

    # Build sequences per route
    if 'origin' in df.columns and 'destination' in df.columns:
        df['route'] = df['origin'] + '-' + df['destination']
    else:
        df['route'] = 'default'

    X_all, y_all = [], []
    for _, group in df.groupby('route'):
        group = group.sort_values('fetched_at')
        features = group[feature_cols].fillna(0).values.astype(np.float32)
        prices = group['price_usd'].values.astype(np.float32) if 'price_usd' in group.columns else features[:, 0]

        for i in range(SEQ_LEN, len(features) - max(HORIZONS)):
            X_all.append(features[i - SEQ_LEN:i])
            targets = [prices[min(i + h, len(prices) - 1)] for h in HORIZONS]
            y_all.append(targets)

    if len(X_all) < BATCH_SIZE:
        print(f"Only {len(X_all)} sequences (need >= {BATCH_SIZE}). Skipping TFT.")
        return

    X = np.array(X_all)
    y = np.array(y_all)  # (N, n_horizons)

    # Normalize
    y_mean = y.mean()
    y_std = y.std() + 1e-8
    y_norm = (y - y_mean) / y_std

    split = int(len(X) * 0.85)
    X_train, y_train = torch.from_numpy(X[:split]), torch.from_numpy(y_norm[:split])
    X_val, y_val = torch.from_numpy(X[split:]), torch.from_numpy(y_norm[split:])

    model = SimpleTFT(len(feature_cols), D_MODEL, N_HEADS, N_LAYERS, len(QUANTILES), len(HORIZONS))
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)

    print(f"Training TFT: {len(X_train)} sequences, {len(HORIZONS)} horizons, {len(QUANTILES)} quantiles")

    for epoch in range(EPOCHS):
        model.train()
        perm = torch.randperm(len(X_train))
        total_loss = 0
        n_batches = 0

        for i in range(0, len(X_train) - BATCH_SIZE, BATCH_SIZE):
            idx = perm[i:i + BATCH_SIZE]
            xb = X_train[idx]
            yb = y_train[idx]

            optimizer.zero_grad()
            preds = model(xb)
            loss = sum(pinball_loss(preds[h], yb[:, h], QUANTILES) for h in range(len(HORIZONS)))
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
            n_batches += 1

        if (epoch + 1) % 5 == 0:
            avg_loss = total_loss / max(1, n_batches)
            print(f"  Epoch {epoch + 1}/{EPOCHS} — loss: {avg_loss:.4f}")

    # Validate
    model.eval()
    with torch.no_grad():
        val_preds = model(X_val)
        val_mae = []
        for h in range(len(HORIZONS)):
            median = val_preds[h][:, 1].numpy() * y_std + y_mean
            actual = y_val[:, h].numpy() * y_std + y_mean
            mae = np.abs(median - actual).mean()
            val_mae.append(mae)
            print(f"  Horizon J+{HORIZONS[h]}: MAE=${mae:.2f}")

    # Export ONNX
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
        print(f"ONNX export failed: {e}")
        torch.save(model.state_dict(), f"{OUTPUT_DIR}/tft-quantile.pt")

    metrics = {
        'val_mae': {f'J+{h}': float(m) for h, m in zip(HORIZONS, val_mae)},
        'train_samples': len(X_train),
        'val_samples': len(X_val),
        'features': len(feature_cols),
        'y_mean': float(y_mean),
        'y_std': float(y_std),
    }
    with open(f"{OUTPUT_DIR}/tft_metrics.json", 'w') as f:
        json.dump(metrics, f, indent=2)

    print("Done.")


if __name__ == "__main__":
    main()
