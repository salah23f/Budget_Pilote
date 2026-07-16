"""
04-fit-hmm-fast.py — Gaussian HMM per route using hmmlearn (C++ optimized).

Drop-in replacement for 04-fit-hmm.py. Instead of a hand-rolled Python EM
loop (which gets stuck on degenerate routes), this uses hmmlearn which is
vectorized with NumPy + fallback C routines and is numerically stable.

Same 6 regimes as the original:
    PLATEAU_HIGH, DESCENT, OPTIMAL_FLOOR, ASCENT, PANIC_LATE, MISTAKE_FARE

Input : data/features/train_features.parquet
Output: models/hmm_params.json
"""

import os
import sys
import json
import warnings
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _env import load_env
load_env()

import numpy as np
import pandas as pd

try:
    from hmmlearn.hmm import GaussianHMM
except ImportError:
    print("ERROR: hmmlearn not installed. Run: pip3 install hmmlearn")
    sys.exit(1)

warnings.filterwarnings("ignore")  # hmmlearn is noisy on edge cases

OUTPUT_DIR = "models"
INPUT_DIR = "data/features"
N_STATES = 6
N_ITER = 30
MIN_SAMPLES = 20
MAX_SAMPLES_PER_ROUTE = 500  # cap to keep per-route fit fast and well conditioned

STATE_NAMES = ["PLATEAU_HIGH", "DESCENT", "OPTIMAL_FLOOR", "ASCENT", "PANIC_LATE", "MISTAKE_FARE"]


def fit_hmm_for_route(obs: np.ndarray):
    """Fit a GaussianHMM on one route's observation matrix.

    Returns a dict ready to be serialized to JSON, or None on failure.
    """
    n = len(obs)
    if n < MIN_SAMPLES:
        return None

    if n > MAX_SAMPLES_PER_ROUTE:
        idx = np.linspace(0, n - 1, MAX_SAMPLES_PER_ROUTE).astype(int)
        obs = obs[idx]
        n = len(obs)

    # Clip to finite values and constant-variance safety margin
    obs = np.nan_to_num(obs, nan=0.0, posinf=1e6, neginf=-1e6)
    if obs.std(axis=0).min() < 1e-6:
        # degenerate route (all identical values), skip
        return None

    try:
        model = GaussianHMM(
            n_components=N_STATES,
            covariance_type="diag",
            n_iter=N_ITER,
            tol=1e-3,
            random_state=42,
            init_params="mcs",
            params="mcst",
        )
        model.fit(obs)

        # Renormalize transmat_ / startprob_ to guard against rows summing to 0
        # (hmmlearn can leave unreachable states with degenerate rows; that
        # triggers a ValueError inside .score()).
        row_sums = model.transmat_.sum(axis=1, keepdims=True)
        row_sums = np.where(row_sums == 0, 1.0, row_sums)
        model.transmat_ = model.transmat_ / row_sums
        sp_sum = float(model.startprob_.sum())
        if sp_sum <= 0:
            model.startprob_ = np.full(N_STATES, 1.0 / N_STATES)
        else:
            model.startprob_ = model.startprob_ / sp_sum

        ll = float(model.score(obs))
    except Exception:
        return None

    # Sort states by mean of first feature to get stable ordering
    order = np.argsort(model.means_[:, 0])
    means_sorted = model.means_[order]
    covars_sorted = model.covars_[order] if model.covars_.ndim == 2 else np.array(
        [np.diag(c) for c in model.covars_[order]]
    )
    # rebuild transition matrix under the new state ordering
    trans_sorted = model.transmat_[order][:, order]
    init_sorted = model.startprob_[order]

    return {
        "means": means_sorted.tolist(),
        "covars": covars_sorted.tolist(),
        "transition": trans_sorted.tolist(),
        "initial": init_sorted.tolist(),
        "n_samples": int(n),
        "converged": bool(model.monitor_.converged),
        "log_likelihood": ll,
        "states": STATE_NAMES,
    }


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

    df["route"] = df["origin"].astype(str) + "-" + df["destination"].astype(str)

    # Feature selection: prefer log-price / log-return / z-score, fallback to price
    feature_cols = [c for c in ["log_price", "log_return", "z_score_30d"] if c in df.columns]
    if not feature_cols:
        if "price_usd" in df.columns:
            df["__p_norm"] = (df["price_usd"] - df["price_usd"].mean()) / (df["price_usd"].std() + 1)
            feature_cols = ["__p_norm"]
        else:
            print("No usable feature columns for HMM")
            sys.exit(1)

    print(f"HMM features: {feature_cols}")

    # Keep only routes with enough samples
    route_counts = df.groupby("route").size()
    eligible = route_counts[route_counts >= MIN_SAMPLES].index.tolist()
    print(f"Eligible routes: {len(eligible):,} / {len(route_counts):,} total")

    # Sort globally once and slice by route boundaries to avoid repeated groupby cost
    df = df.sort_values(["route", "fetched_at"]).reset_index(drop=True)
    routes_arr = df["route"].values
    features_arr = df[feature_cols].fillna(0).values.astype(np.float64)

    # Compute group boundaries by first-appearance order
    unique_routes, first_idx = np.unique(routes_arr, return_index=True)
    order = np.argsort(first_idx)
    unique_routes = unique_routes[order]
    first_idx = first_idx[order]
    boundaries = np.append(first_idx, len(df))
    eligible_set = set(eligible)

    hmm_params = {}
    progress_step = max(1, len(unique_routes) // 40)
    for i, route in enumerate(unique_routes):
        if route not in eligible_set:
            continue
        start = boundaries[i]
        end = boundaries[i + 1]
        obs = features_arr[start:end]
        result = fit_hmm_for_route(obs)
        if result is not None:
            hmm_params[route] = result
        if (i + 1) % progress_step == 0:
            print(f"  {i + 1:,}/{len(unique_routes):,} processed, {len(hmm_params):,} fitted so far")

    out_path = f"{OUTPUT_DIR}/hmm_params.json"
    with open(out_path, "w") as f:
        json.dump(hmm_params, f)
    print(f"\nSaved {len(hmm_params):,} route HMM params to {out_path}")
    print(f"Size: {os.path.getsize(out_path) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
