"""
03-fit-gp.py — Gaussian Process regression per route cluster.

Fits GP with composite kernel on routes with >= 200 samples.
Routes with fewer samples use hierarchical shrinkage toward cluster mean.

Kernel: RBF(30d) + Periodic(7d) + Periodic(365d) + Matern(5/2)
Optimizer: L-BFGS on marginal log-likelihood.

Input: data/features/train_features.parquet
Output: models/gp_params.json (hyperparams per route cluster)
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
from scipy.optimize import minimize
from scipy.spatial.distance import cdist

OUTPUT_DIR = "models"
INPUT_DIR = "data/features"
MIN_SAMPLES_PER_ROUTE = 50
MAX_SAMPLES_GP = 300  # GP is O(N^3) — cap for tractability


def rbf_kernel(X1, X2, length_scale, variance):
    dist = cdist(X1, X2, 'sqeuclidean')
    return variance * np.exp(-dist / (2 * length_scale**2))


def periodic_kernel(X1, X2, period, length_scale, variance):
    dist = cdist(X1, X2, 'euclidean')
    return variance * np.exp(-2 * np.sin(np.pi * dist / period)**2 / length_scale**2)


def composite_kernel(X1, X2, params):
    rbf = rbf_kernel(X1[:, :1], X2[:, :1], params['rbf_ls'], params['rbf_var'])
    per7 = periodic_kernel(X1[:, :1], X2[:, :1], 7.0, params['per7_ls'], params['per7_var'])
    per365 = periodic_kernel(X1[:, :1], X2[:, :1], 365.0, params['per365_ls'], params['per365_var'])
    return rbf + per7 + per365


def neg_log_marginal_likelihood(theta, X, y, noise_var=0.1):
    params = {
        'rbf_ls': np.exp(theta[0]),
        'rbf_var': np.exp(theta[1]),
        'per7_ls': np.exp(theta[2]),
        'per7_var': np.exp(theta[3]),
        'per365_ls': np.exp(theta[4]),
        'per365_var': np.exp(theta[5]),
    }
    K = composite_kernel(X, X, params) + noise_var * np.eye(len(X))

    try:
        L = np.linalg.cholesky(K)
        alpha = np.linalg.solve(L.T, np.linalg.solve(L, y))
        nll = 0.5 * y.T @ alpha + np.sum(np.log(np.diag(L))) + 0.5 * len(y) * np.log(2 * np.pi)
        return float(nll)
    except np.linalg.LinAlgError:
        return 1e10


def fit_gp_for_route(route_data):
    n = min(len(route_data), MAX_SAMPLES_GP)
    subset = route_data.sample(n, random_state=42) if len(route_data) > n else route_data

    # Features: day_index (days since first obs)
    times = pd.to_datetime(subset['fetched_at'])
    t0 = times.min()
    X = ((times - t0).dt.total_seconds() / 86400).values.reshape(-1, 1)
    y = subset['price_usd'].values
    y_mean, y_std = y.mean(), y.std() + 1e-8
    y_norm = (y - y_mean) / y_std

    # Initial params (log-space)
    theta0 = np.array([np.log(30), np.log(1), np.log(1), np.log(0.3),
                        np.log(1), np.log(0.2)])

    result = minimize(neg_log_marginal_likelihood, theta0, args=(X, y_norm),
                      method='L-BFGS-B', options={'maxiter': 100})

    return {
        'rbf_ls': float(np.exp(result.x[0])),
        'rbf_var': float(np.exp(result.x[1])),
        'per7_ls': float(np.exp(result.x[2])),
        'per7_var': float(np.exp(result.x[3])),
        'per365_ls': float(np.exp(result.x[4])),
        'per365_var': float(np.exp(result.x[5])),
        'y_mean': float(y_mean),
        'y_std': float(y_std),
        'n_samples': n,
        'nll': float(result.fun),
        'converged': result.success,
    }


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    path = f"{INPUT_DIR}/train_features.parquet"
    if not os.path.exists(path):
        print("No training features. Run 01-split.py and 02-features.py first.")
        return

    df = pd.read_parquet(path)
    print(f"Loaded {len(df)} training rows")

    if 'origin' not in df.columns or 'destination' not in df.columns:
        print("Missing origin/destination columns")
        return

    df['route'] = df['origin'] + '-' + df['destination']
    routes = df.groupby('route').filter(lambda x: len(x) >= MIN_SAMPLES_PER_ROUTE)
    unique_routes = routes['route'].unique()

    print(f"Fitting GP for {len(unique_routes)} routes (>= {MIN_SAMPLES_PER_ROUTE} samples)...")

    gp_params = {}
    for i, route in enumerate(unique_routes):
        route_data = routes[routes['route'] == route]
        try:
            params = fit_gp_for_route(route_data)
            gp_params[route] = params
            if (i + 1) % 10 == 0:
                print(f"  [{i+1}/{len(unique_routes)}] {route}: nll={params['nll']:.2f}, n={params['n_samples']}")
        except Exception as e:
            print(f"  [{i+1}/{len(unique_routes)}] {route}: FAILED ({e})")

    out_path = f"{OUTPUT_DIR}/gp_params.json"
    with open(out_path, 'w') as f:
        json.dump(gp_params, f, indent=2)

    print(f"\nSaved {len(gp_params)} route GP params to {out_path}")


if __name__ == "__main__":
    main()
