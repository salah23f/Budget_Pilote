"""
06-train-lstm.py — LSTM-Quantile model for multi-horizon price forecasting.

Architecture: 2-layer LSTM (64 hidden) → 3 quantile heads (0.1, 0.5, 0.9)
Loss: Pinball loss (asymmetric)
Export: ONNX for Node.js inference

Input: data/features/train_features.parquet
Output: models/lstm-quantile.onnx
"""

import os
import sys
import numpy as np
import pandas as pd

try:
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, TensorDataset
except ImportError:
    print("ERROR: torch not installed. Run: pip install -r scripts/train/requirements.txt")
    sys.exit(1)

FEATURES_DIR = "data/features"
MODEL_DIR = "models"
SEQUENCE_LENGTH = 30
QUANTILES = [0.1, 0.5, 0.9]
HIDDEN_SIZE = 64
NUM_LAYERS = 2
EPOCHS = 50
BATCH_SIZE = 64
LR = 0.001


class QuantileLSTM(nn.Module):
    def __init__(self, input_size: int, hidden_size: int, num_layers: int, num_quantiles: int):
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True, dropout=0.1)
        self.heads = nn.ModuleList([nn.Linear(hidden_size, 1) for _ in range(num_quantiles)])

    def forward(self, x):
        out, _ = self.lstm(x)
        last = out[:, -1, :]  # Last timestep
        return [head(last).squeeze(-1) for head in self.heads]


def pinball_loss(pred, target, tau):
    err = target - pred
    return torch.mean(torch.max(tau * err, (tau - 1) * err))


def prepare_sequences(df: pd.DataFrame, feature_cols: list, target_col: str = "price_usd"):
    """Create (sequence, target) pairs for LSTM training."""
    routes = df.groupby(["origin", "destination"])
    X_all, y_all = [], []

    for _, group in routes:
        group = group.sort_values("fetched_at")
        features = group[feature_cols].values.astype(np.float32)
        targets = group[target_col].values.astype(np.float32)

        for i in range(SEQUENCE_LENGTH, len(features)):
            X_all.append(features[i - SEQUENCE_LENGTH:i])
            y_all.append(targets[i])

    if len(X_all) == 0:
        return None, None

    return np.array(X_all), np.array(y_all)


def main():
    os.makedirs(MODEL_DIR, exist_ok=True)

    train_path = f"{FEATURES_DIR}/train_features.parquet"
    if not os.path.exists(train_path):
        print("No training features found. Run 01-split.py and 02-features.py first.")
        return

    df = pd.read_parquet(train_path)
    print(f"Loaded {len(df)} training rows")

    # Select numeric features
    feature_cols = [c for c in df.columns if df[c].dtype in [np.float64, np.int64, np.float32]
                    and c != "price_usd" and "id" not in c.lower()]

    if len(feature_cols) == 0:
        print("No numeric features found. Using price_usd as self-prediction (smoke test).")
        feature_cols = ["price_usd"]

    print(f"Using {len(feature_cols)} features: {feature_cols[:10]}...")

    X, y = prepare_sequences(df, feature_cols)
    if X is None or len(X) < BATCH_SIZE:
        print(f"Insufficient sequences ({len(X) if X is not None else 0}). Need ≥ {BATCH_SIZE}.")
        print("Generating synthetic smoke test...")
        X = np.random.randn(200, SEQUENCE_LENGTH, len(feature_cols)).astype(np.float32)
        y = np.random.randn(200).astype(np.float32) * 100 + 500

    # Normalize
    y_mean, y_std = y.mean(), y.std() + 1e-8
    y_norm = (y - y_mean) / y_std

    # Train/val split (last 20%)
    split = int(len(X) * 0.8)
    X_train, X_val = X[:split], X[split:]
    y_train, y_val = y_norm[:split], y_norm[split:]

    train_ds = TensorDataset(torch.from_numpy(X_train), torch.from_numpy(y_train))
    train_dl = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True)

    model = QuantileLSTM(len(feature_cols), HIDDEN_SIZE, NUM_LAYERS, len(QUANTILES))
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)

    print(f"Training LSTM-Quantile ({len(X_train)} train, {len(X_val)} val)...")

    for epoch in range(EPOCHS):
        model.train()
        total_loss = 0
        for xb, yb in train_dl:
            optimizer.zero_grad()
            preds = model(xb)
            loss = sum(pinball_loss(preds[i], yb, QUANTILES[i]) for i in range(len(QUANTILES)))
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        if (epoch + 1) % 10 == 0:
            print(f"  Epoch {epoch+1}/{EPOCHS} — loss: {total_loss / len(train_dl):.4f}")

    # Eval
    model.eval()
    with torch.no_grad():
        val_preds = model(torch.from_numpy(X_val))
        val_median = val_preds[1].numpy() * y_std + y_mean
        val_actual = y_val * y_std + y_mean
        mae = np.abs(val_median - val_actual).mean()
        print(f"Validation MAE: ${mae:.2f}")

    # Export ONNX
    dummy = torch.randn(1, SEQUENCE_LENGTH, len(feature_cols))
    onnx_path = f"{MODEL_DIR}/lstm-quantile.onnx"

    try:
        torch.onnx.export(
            model, dummy, onnx_path,
            input_names=["input"],
            output_names=[f"quantile_{q}" for q in QUANTILES],
            dynamic_axes={"input": {0: "batch"}},
            opset_version=13,
        )
        print(f"Exported ONNX model to {onnx_path}")
    except Exception as e:
        print(f"ONNX export failed: {e}")
        # Save PyTorch weights as fallback
        torch.save(model.state_dict(), f"{MODEL_DIR}/lstm-quantile.pt")
        print(f"Saved PyTorch weights to {MODEL_DIR}/lstm-quantile.pt")

    # Save metadata
    metadata = {
        "features": feature_cols,
        "sequence_length": SEQUENCE_LENGTH,
        "quantiles": QUANTILES,
        "y_mean": float(y_mean),
        "y_std": float(y_std),
        "val_mae": float(mae),
        "train_samples": len(X_train),
        "val_samples": len(X_val),
    }
    import json
    with open(f"{MODEL_DIR}/lstm-quantile-meta.json", "w") as f:
        json.dump(metadata, f, indent=2)
    print("Done.")


if __name__ == "__main__":
    main()
