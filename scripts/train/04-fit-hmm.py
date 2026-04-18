"""
04-fit-hmm.py — Hidden Markov Model 6-state regime detection.

Fits HMM with Gaussian emissions on (log_price, log_return, ttd_bucket)
using Baum-Welch (EM) per route cluster.

States: PLATEAU_HIGH, DESCENT, OPTIMAL_FLOOR, ASCENT, PANIC_LATE, MISTAKE_FARE

Input: data/features/train_features.parquet
Output: models/hmm_params.json (transition + emission params per cluster)
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

OUTPUT_DIR = "models"
INPUT_DIR = "data/features"
N_STATES = 6
N_ITER = 50
MIN_SAMPLES = 30

STATE_NAMES = ['PLATEAU_HIGH', 'DESCENT', 'OPTIMAL_FLOOR', 'ASCENT', 'PANIC_LATE', 'MISTAKE_FARE']


def fit_hmm_manual(observations, n_states=6, n_iter=50):
    """Simple Gaussian HMM via EM (no hmmlearn dependency)."""
    n = len(observations)
    if n < 10:
        return None

    d = observations.shape[1] if observations.ndim > 1 else 1
    if d == 1:
        observations = observations.reshape(-1, 1)

    # Initialize with K-means-like assignment
    sorted_idx = np.argsort(observations[:, 0])
    chunk = n // n_states
    means = np.zeros((n_states, d))
    covars = np.zeros((n_states, d))
    for k in range(n_states):
        start = k * chunk
        end = min((k + 1) * chunk, n)
        segment = observations[sorted_idx[start:end]]
        means[k] = segment.mean(axis=0)
        covars[k] = segment.var(axis=0) + 1e-4

    # Uniform initial/transition
    pi = np.ones(n_states) / n_states
    A = np.ones((n_states, n_states)) * 0.1 / (n_states - 1)
    np.fill_diagonal(A, 0.9)

    for iteration in range(n_iter):
        # E-step: Forward-Backward
        # Emission probabilities
        B = np.zeros((n, n_states))
        for k in range(n_states):
            diff = observations - means[k]
            exponent = -0.5 * np.sum(diff**2 / (covars[k] + 1e-8), axis=1)
            B[:, k] = np.exp(exponent) / np.sqrt((2 * np.pi)**d * np.prod(covars[k] + 1e-8))
        B = np.clip(B, 1e-300, None)

        # Forward
        alpha = np.zeros((n, n_states))
        alpha[0] = pi * B[0]
        alpha[0] /= alpha[0].sum() + 1e-300
        for t in range(1, n):
            alpha[t] = (alpha[t-1] @ A) * B[t]
            alpha[t] /= alpha[t].sum() + 1e-300

        # Backward
        beta = np.zeros((n, n_states))
        beta[-1] = 1.0
        for t in range(n-2, -1, -1):
            beta[t] = A @ (B[t+1] * beta[t+1])
            beta[t] /= beta[t].sum() + 1e-300

        # Posteriors
        gamma = alpha * beta
        gamma /= gamma.sum(axis=1, keepdims=True) + 1e-300

        # M-step
        for k in range(n_states):
            weights = gamma[:, k]
            total = weights.sum() + 1e-8
            means[k] = (weights[:, None] * observations).sum(axis=0) / total
            diff = observations - means[k]
            covars[k] = (weights[:, None] * diff**2).sum(axis=0) / total + 1e-4

        pi = gamma[0]

        for k in range(n_states):
            for j in range(n_states):
                num = np.sum(gamma[:-1, k] * gamma[1:, j])
                den = np.sum(gamma[:-1, k]) + 1e-8
                A[k, j] = num / den
            A[k] /= A[k].sum()

    return {
        'means': means.tolist(),
        'covars': covars.tolist(),
        'transition': A.tolist(),
        'initial': pi.tolist(),
        'n_samples': n,
    }


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    path = f"{INPUT_DIR}/train_features.parquet"
    if not os.path.exists(path):
        print("No training features found.")
        return

    df = pd.read_parquet(path)
    print(f"Loaded {len(df)} rows")

    if 'origin' not in df.columns:
        print("Missing origin column")
        return

    df['route'] = df['origin'] + '-' + df['destination']

    # Features for HMM: log_price, log_return, z_score
    feature_cols = []
    for c in ['log_price', 'log_return', 'z_score_30d']:
        if c in df.columns:
            feature_cols.append(c)

    if not feature_cols:
        feature_cols = ['price_usd']
        df['price_usd_norm'] = (df['price_usd'] - df['price_usd'].mean()) / (df['price_usd'].std() + 1)
        feature_cols = ['price_usd_norm']

    routes = df.groupby('route').filter(lambda x: len(x) >= MIN_SAMPLES)
    unique_routes = routes['route'].unique()

    print(f"Fitting HMM for {len(unique_routes)} routes...")

    hmm_params = {}
    for i, route in enumerate(unique_routes):
        route_data = routes[routes['route'] == route].sort_values('fetched_at')
        obs = route_data[feature_cols].fillna(0).values

        result = fit_hmm_manual(obs, N_STATES, N_ITER)
        if result:
            hmm_params[route] = result
            if (i + 1) % 20 == 0:
                print(f"  [{i+1}/{len(unique_routes)}] {route}: n={result['n_samples']}")

    out_path = f"{OUTPUT_DIR}/hmm_params.json"
    with open(out_path, 'w') as f:
        json.dump(hmm_params, f, indent=2)

    print(f"\nSaved {len(hmm_params)} route HMM params to {out_path}")


if __name__ == "__main__":
    main()
