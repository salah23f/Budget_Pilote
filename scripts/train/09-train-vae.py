"""
09-train-vae.py — Beta-VAE for anomaly detection (mistake fares).

Trains on normal price sequences (outliers excluded).
At inference, high reconstruction error = anomaly (mistake fare / flash sale).

Architecture: Encoder(64→32→16 latent) + Decoder(16→32→64)
Loss: MSE reconstruction + β * KL divergence

Input: data/features/train_features.parquet
Output: models/vae-anomaly.onnx + models/vae_threshold.json
"""

import os
import json
import sys
import numpy as np
import pandas as pd

try:
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, TensorDataset
except ImportError:
    print("torch not installed. Run: pip install torch")
    sys.exit(1)

OUTPUT_DIR = "models"
INPUT_DIR = "data/features"
LATENT_DIM = 16
BETA = 0.5
EPOCHS = 30
BATCH_SIZE = 256
LR = 0.001
SEQ_LEN = 10


class BetaVAE(nn.Module):
    def __init__(self, input_dim, latent_dim=16):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 64), nn.ReLU(),
            nn.Linear(64, 32), nn.ReLU(),
        )
        self.fc_mu = nn.Linear(32, latent_dim)
        self.fc_var = nn.Linear(32, latent_dim)
        self.decoder = nn.Sequential(
            nn.Linear(latent_dim, 32), nn.ReLU(),
            nn.Linear(32, 64), nn.ReLU(),
            nn.Linear(64, input_dim),
        )

    def encode(self, x):
        h = self.encoder(x)
        return self.fc_mu(h), self.fc_var(h)

    def reparameterize(self, mu, logvar):
        std = torch.exp(0.5 * logvar)
        eps = torch.randn_like(std)
        return mu + eps * std

    def decode(self, z):
        return self.decoder(z)

    def forward(self, x):
        mu, logvar = self.encode(x)
        z = self.reparameterize(mu, logvar)
        recon = self.decode(z)
        return recon, mu, logvar


def vae_loss(recon, x, mu, logvar, beta=0.5):
    mse = nn.functional.mse_loss(recon, x, reduction='mean')
    kl = -0.5 * torch.mean(1 + logvar - mu.pow(2) - logvar.exp())
    return mse + beta * kl, mse, kl


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    path = f"{INPUT_DIR}/train_features.parquet"
    if not os.path.exists(path):
        print("No training features. Run previous scripts first.")
        return

    df = pd.read_parquet(path)
    print(f"Loaded {len(df)} rows")

    # Use price-related features
    feature_cols = [c for c in df.columns
                    if df[c].dtype in [np.float64, np.float32, np.int64]
                    and c != 'price_usd' and 'id' not in c.lower()
                    and not c.startswith('Unnamed')]

    if len(feature_cols) < 3:
        feature_cols = ['price_usd']

    print(f"Using {len(feature_cols)} features for VAE")

    # Remove outliers for training (VAE learns "normal" distribution)
    if 'price_usd' in df.columns:
        q1 = df['price_usd'].quantile(0.05)
        q3 = df['price_usd'].quantile(0.95)
        normal_mask = (df['price_usd'] >= q1) & (df['price_usd'] <= q3)
        df_normal = df[normal_mask]
        print(f"Normal samples (P5-P95): {len(df_normal)} / {len(df)}")
    else:
        df_normal = df

    X = df_normal[feature_cols].fillna(0).values.astype(np.float32)

    # Normalize
    x_mean = X.mean(axis=0)
    x_std = X.std(axis=0) + 1e-8
    X_norm = (X - x_mean) / x_std

    # Split
    split = int(len(X_norm) * 0.85)
    X_train, X_val = X_norm[:split], X_norm[split:]

    train_ds = TensorDataset(torch.from_numpy(X_train))
    train_dl = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True)

    input_dim = X_norm.shape[1]
    model = BetaVAE(input_dim, LATENT_DIM)
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)

    print(f"Training VAE: {len(X_train)} train, {len(X_val)} val, input_dim={input_dim}")

    for epoch in range(EPOCHS):
        model.train()
        total_loss = 0
        for (xb,) in train_dl:
            optimizer.zero_grad()
            recon, mu, logvar = model(xb)
            loss, mse, kl = vae_loss(recon, xb, mu, logvar, BETA)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        if (epoch + 1) % 5 == 0:
            print(f"  Epoch {epoch+1}/{EPOCHS} — loss: {total_loss / len(train_dl):.4f}")

    # Compute reconstruction errors on validation set
    model.eval()
    with torch.no_grad():
        X_val_t = torch.from_numpy(X_val)
        recon_val, _, _ = model(X_val_t)
        recon_errors = torch.mean((recon_val - X_val_t)**2, dim=1).numpy()

    # Threshold at p99 of validation errors → anything above = anomaly
    threshold = float(np.percentile(recon_errors, 99))
    mean_error = float(np.mean(recon_errors))
    std_error = float(np.std(recon_errors))

    print(f"\nReconstruction error stats:")
    print(f"  Mean: {mean_error:.6f}")
    print(f"  Std: {std_error:.6f}")
    print(f"  P99 threshold: {threshold:.6f}")
    print(f"  Anomaly rate on val: {(recon_errors > threshold).mean() * 100:.1f}%")

    # Export ONNX
    dummy = torch.randn(1, input_dim)
    onnx_path = f"{OUTPUT_DIR}/vae-anomaly.onnx"
    try:
        torch.onnx.export(model, dummy, onnx_path,
                          input_names=["input"], output_names=["recon", "mu", "logvar"],
                          dynamic_axes={"input": {0: "batch"}}, opset_version=13)
        print(f"Exported ONNX to {onnx_path}")
    except Exception as e:
        print(f"ONNX export failed: {e}")
        torch.save(model.state_dict(), f"{OUTPUT_DIR}/vae-anomaly.pt")

    # Save threshold + normalization params
    meta = {
        'threshold': threshold,
        'mean_error': mean_error,
        'std_error': std_error,
        'x_mean': x_mean.tolist(),
        'x_std': x_std.tolist(),
        'feature_cols': feature_cols,
        'input_dim': input_dim,
        'latent_dim': LATENT_DIM,
        'beta': BETA,
    }
    with open(f"{OUTPUT_DIR}/vae_threshold.json", 'w') as f:
        json.dump(meta, f, indent=2)

    print("Done.")


if __name__ == "__main__":
    main()
