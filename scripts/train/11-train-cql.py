"""
11-train-cql.py — Conservative Q-Learning (offline RL) for buy/wait policy.

Learns a policy from historical data: given (state, action) pairs,
estimate Q-values conservatively (penalize OOD actions).

States: [price_z, ttd_bucket, volatility, regime_proba, trend]
Actions: BUY (0), WAIT_SHORT (1), WAIT_LONG (2)
Reward: -(bought_price - floor_price) / floor_price

CQL alpha=5.0 (strong conservatism to avoid extrapolation).

Input: data/features/train_features.parquet
Output: models/cql_policy.pt
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
ALPHA_CQL = 5.0
GAMMA = 0.99
LR = 0.0003
EPOCHS = 50
BATCH_SIZE = 256
N_ACTIONS = 3  # BUY, WAIT_SHORT, WAIT_LONG


class QNetwork(nn.Module):
    def __init__(self, state_dim, n_actions=3):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(state_dim, 128),
            nn.ReLU(),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, n_actions),
        )

    def forward(self, x):
        return self.net(x)


def build_replay_buffer(df, feature_cols):
    """Convert price observations into (s, a, r, s') transitions."""
    if 'origin' in df.columns and 'destination' in df.columns:
        df['route'] = df['origin'] + '-' + df['destination']
    else:
        df['route'] = 'default'

    states, actions, rewards, next_states, dones = [], [], [], [], []

    for _, group in df.groupby('route'):
        group = group.sort_values('fetched_at')
        if len(group) < 10:
            continue

        prices = group['price_usd'].values
        features = group[feature_cols].fillna(0).values.astype(np.float32)
        floor = np.min(prices)

        for i in range(len(prices) - 1):
            state = features[i]
            next_state = features[i + 1]

            # Determine action taken (heuristic from price movement)
            price_now = prices[i]
            price_next = prices[i + 1]

            if price_now <= floor * 1.05:
                action = 0  # Should have bought (BUY)
                reward = -(price_now - floor) / max(1, floor)  # Close to 0 if near floor
            elif price_now > price_next:
                action = 1  # Price dropping, short wait was right
                reward = (price_now - price_next) / max(1, price_now) * 0.5
            else:
                action = 2  # Price rising, long wait if TTD allows
                reward = -(price_next - price_now) / max(1, price_now) * 0.3

            done = (i == len(prices) - 2)

            states.append(state)
            actions.append(action)
            rewards.append(reward)
            next_states.append(next_state)
            dones.append(float(done))

    return (
        np.array(states),
        np.array(actions),
        np.array(rewards, dtype=np.float32),
        np.array(next_states),
        np.array(dones, dtype=np.float32),
    )


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
        print("Insufficient features for CQL.")
        return

    print("Building replay buffer...")
    states, actions, rewards, next_states, dones = build_replay_buffer(df, feature_cols)

    if len(states) < 1000:
        print(f"Only {len(states)} transitions. Skipping CQL.")
        return

    print(f"Replay buffer: {len(states)} transitions")
    print(f"  Action distribution: BUY={np.mean(actions == 0):.1%}, WAIT_SHORT={np.mean(actions == 1):.1%}, WAIT_LONG={np.mean(actions == 2):.1%}")
    print(f"  Reward: mean={rewards.mean():.4f}, std={rewards.std():.4f}")

    # Normalize states
    s_mean = states.mean(axis=0)
    s_std = states.std(axis=0) + 1e-8
    states_norm = (states - s_mean) / s_std
    next_states_norm = (next_states - s_mean) / s_std

    S = torch.from_numpy(states_norm.astype(np.float32))
    A = torch.from_numpy(actions.astype(np.int64))
    R = torch.from_numpy(rewards)
    S_next = torch.from_numpy(next_states_norm.astype(np.float32))
    D = torch.from_numpy(dones)

    q_net = QNetwork(len(feature_cols), N_ACTIONS)
    target_net = QNetwork(len(feature_cols), N_ACTIONS)
    target_net.load_state_dict(q_net.state_dict())
    optimizer = torch.optim.Adam(q_net.parameters(), lr=LR)

    print(f"Training CQL: alpha={ALPHA_CQL}, gamma={GAMMA}")

    for epoch in range(EPOCHS):
        perm = torch.randperm(len(S))
        total_loss = 0
        n_batches = 0

        for i in range(0, len(S) - BATCH_SIZE, BATCH_SIZE):
            idx = perm[i:i + BATCH_SIZE]
            s_b = S[idx]
            a_b = A[idx]
            r_b = R[idx]
            sn_b = S_next[idx]
            d_b = D[idx]

            # Standard DQN loss
            q_vals = q_net(s_b)
            q_a = q_vals.gather(1, a_b.unsqueeze(1)).squeeze(1)

            with torch.no_grad():
                q_next = target_net(sn_b).max(1)[0]
                td_target = r_b + GAMMA * (1 - d_b) * q_next

            td_loss = nn.functional.mse_loss(q_a, td_target)

            # CQL penalty: penalize high Q-values for non-data actions
            # logsumexp(Q(s,·)) - E_data[Q(s,a)]
            logsumexp = torch.logsumexp(q_vals, dim=1).mean()
            data_q = q_a.mean()
            cql_penalty = ALPHA_CQL * (logsumexp - data_q)

            loss = td_loss + cql_penalty
            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(q_net.parameters(), 1.0)
            optimizer.step()
            total_loss += loss.item()
            n_batches += 1

        # Soft update target network
        tau = 0.005
        with torch.no_grad():
            for p, tp in zip(q_net.parameters(), target_net.parameters()):
                tp.data.copy_(tau * p.data + (1 - tau) * tp.data)

        if (epoch + 1) % 10 == 0:
            avg_loss = total_loss / max(1, n_batches)
            print(f"  Epoch {epoch + 1}/{EPOCHS} — loss: {avg_loss:.4f}")

    # Save policy
    torch.save({
        'q_net': q_net.state_dict(),
        's_mean': s_mean.tolist(),
        's_std': s_std.tolist(),
        'feature_cols': feature_cols,
    }, f"{OUTPUT_DIR}/cql_policy.pt")

    # Evaluate: what action does the policy recommend?
    q_net.eval()
    with torch.no_grad():
        q_all = q_net(S[:1000])
        policy_actions = q_all.argmax(dim=1).numpy()
        print(f"\nPolicy action distribution (first 1000):")
        print(f"  BUY: {np.mean(policy_actions == 0):.1%}")
        print(f"  WAIT_SHORT: {np.mean(policy_actions == 1):.1%}")
        print(f"  WAIT_LONG: {np.mean(policy_actions == 2):.1%}")

    with open(f"{OUTPUT_DIR}/cql_metrics.json", 'w') as f:
        json.dump({
            'transitions': len(states),
            'epochs': EPOCHS,
            'alpha_cql': ALPHA_CQL,
            'policy_buy_rate': float(np.mean(policy_actions == 0)),
            'final_loss': float(total_loss / max(1, n_batches)),
        }, f, indent=2)

    print("Done.")


if __name__ == "__main__":
    main()
