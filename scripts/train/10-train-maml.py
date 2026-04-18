"""
10-train-maml.py — Reptile meta-learning for cold-start route adaptation.

Each route = one task. The model learns to adapt to new routes with K=32 samples.
Uses Reptile (simplified MAML): outer loop averages inner-loop-adapted weights.

Architecture: 2-layer MLP (64 hidden) for price prediction.
At inference: given K samples from a new route, run 5 gradient steps to adapt.

Input: data/features/train_features.parquet
Output: models/maml_init_weights.pt
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
    print("torch not installed.")
    sys.exit(1)

OUTPUT_DIR = "models"
INPUT_DIR = "data/features"
K_SHOT = 32         # samples per task for inner loop
INNER_LR = 0.01
INNER_STEPS = 5
OUTER_LR = 0.001
OUTER_STEPS = 500
MIN_ROUTE_SAMPLES = 50


class PricePredictor(nn.Module):
    def __init__(self, input_dim, hidden=64):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden),
            nn.ReLU(),
            nn.Linear(hidden, hidden),
            nn.ReLU(),
            nn.Linear(hidden, 1),
        )

    def forward(self, x):
        return self.net(x).squeeze(-1)


def reptile_step(model, task_data, feature_cols, inner_lr, inner_steps, k_shot):
    """Run inner loop on one task (route), return adapted weights."""
    # Clone model
    adapted = PricePredictor(len(feature_cols))
    adapted.load_state_dict(model.state_dict())

    X = torch.from_numpy(task_data[feature_cols].fillna(0).values[:k_shot].astype(np.float32))
    y = torch.from_numpy(task_data['price_usd'].values[:k_shot].astype(np.float32))

    # Normalize
    y_mean = y.mean()
    y_std = y.std() + 1e-8
    y_norm = (y - y_mean) / y_std

    optimizer = torch.optim.SGD(adapted.parameters(), lr=inner_lr)

    for _ in range(inner_steps):
        optimizer.zero_grad()
        pred = adapted(X)
        loss = nn.functional.mse_loss(pred, y_norm)
        loss.backward()
        optimizer.step()

    return adapted.state_dict(), float(loss.item())


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

    if len(feature_cols) < 2 or 'price_usd' not in df.columns:
        print("Insufficient features for MAML.")
        return

    if 'origin' in df.columns and 'destination' in df.columns:
        df['route'] = df['origin'] + '-' + df['destination']
    else:
        df['route'] = 'default'

    # Filter routes with enough samples
    route_counts = df['route'].value_counts()
    valid_routes = route_counts[route_counts >= MIN_ROUTE_SAMPLES].index.tolist()

    if len(valid_routes) < 5:
        print(f"Only {len(valid_routes)} routes with >= {MIN_ROUTE_SAMPLES} samples. Skipping MAML.")
        return

    print(f"Meta-learning across {len(valid_routes)} routes, K={K_SHOT}")

    model = PricePredictor(len(feature_cols))
    meta_optimizer = torch.optim.Adam(model.parameters(), lr=OUTER_LR)

    losses = []
    for step in range(OUTER_STEPS):
        # Sample a random task (route)
        route = np.random.choice(valid_routes)
        task_data = df[df['route'] == route].sample(min(K_SHOT * 2, len(df[df['route'] == route])), random_state=step)

        adapted_state, inner_loss = reptile_step(model, task_data, feature_cols, INNER_LR, INNER_STEPS, K_SHOT)

        # Reptile outer update: θ ← θ + ε(θ' - θ)
        epsilon = OUTER_LR * (1 - step / OUTER_STEPS)  # linear decay
        with torch.no_grad():
            for name, param in model.named_parameters():
                param.data += epsilon * (adapted_state[name] - param.data)

        losses.append(inner_loss)

        if (step + 1) % 50 == 0:
            avg_loss = np.mean(losses[-50:])
            print(f"  Step {step + 1}/{OUTER_STEPS} — avg inner loss: {avg_loss:.4f}")

    # Save initialization weights
    torch.save(model.state_dict(), f"{OUTPUT_DIR}/maml_init_weights.pt")

    # Evaluate: adapt to held-out routes and measure MAE
    eval_routes = valid_routes[-5:]
    eval_maes = []
    for route in eval_routes:
        route_data = df[df['route'] == route].sort_values('fetched_at')
        if len(route_data) < K_SHOT + 10:
            continue

        support = route_data.iloc[:K_SHOT]
        query = route_data.iloc[K_SHOT:K_SHOT + 50]

        adapted_state, _ = reptile_step(model, support, feature_cols, INNER_LR, 10, K_SHOT)
        adapted_model = PricePredictor(len(feature_cols))
        adapted_model.load_state_dict(adapted_state)
        adapted_model.eval()

        X_q = torch.from_numpy(query[feature_cols].fillna(0).values.astype(np.float32))
        y_q = query['price_usd'].values

        with torch.no_grad():
            y_mean = support['price_usd'].mean()
            y_std = support['price_usd'].std() + 1e-8
            pred = adapted_model(X_q).numpy() * y_std + y_mean
            mae = np.abs(pred - y_q).mean()
            eval_maes.append(mae)

    avg_mae = np.mean(eval_maes) if eval_maes else 0
    print(f"\nMAML eval MAE (5 held-out routes): ${avg_mae:.2f}")

    with open(f"{OUTPUT_DIR}/maml_metrics.json", 'w') as f:
        json.dump({
            'eval_mae': float(avg_mae),
            'n_routes': len(valid_routes),
            'k_shot': K_SHOT,
            'outer_steps': OUTER_STEPS,
            'inner_steps': INNER_STEPS,
            'final_inner_loss': float(np.mean(losses[-20:])),
        }, f, indent=2)

    print("Done.")


if __name__ == "__main__":
    main()
