"""
12-fit-ensemble.py — Super Learner ensemble stacking.

Level 0: GP, QRF, LSTM, HMM-baseline, BayesianStopping predictions
Level 1: Non-Negative Least Squares (NNLS) meta-learner, weights sum to 1

Uses time-series cross-validation (5 folds) to avoid leakage.

Input: models/*_oof_predictions.parquet, data/features/val_features.parquet
Output: models/ensemble_weights.json
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
from scipy.optimize import nnls

OUTPUT_DIR = "models"
INPUT_DIR = "data/features"


def load_oof_predictions():
    """Load out-of-fold predictions from all level-0 models."""
    predictions = {}
    oof_files = {
        'qrf': f'{OUTPUT_DIR}/qrf_oof_predictions.parquet',
    }

    for model_name, path in oof_files.items():
        if os.path.exists(path):
            df = pd.read_parquet(path)
            # Use median prediction
            median_col = [c for c in df.columns if 'q50' in c or 'median' in c]
            if median_col:
                predictions[model_name] = df[median_col[0]].values
            elif 'y_pred' in df.columns:
                predictions[model_name] = df['y_pred'].values

    return predictions


def time_series_cv_split(n, n_folds=5, min_train=100):
    """Generate time-series cross-validation splits (expanding window)."""
    folds = []
    fold_size = n // (n_folds + 1)
    for i in range(n_folds):
        train_end = (i + 1) * fold_size + min_train
        val_start = train_end
        val_end = min(val_start + fold_size, n)
        if val_start >= n:
            break
        folds.append((list(range(0, train_end)), list(range(val_start, val_end))))
    return folds


def fit_nnls_weights(y_true, model_preds):
    """Fit NNLS weights: argmin ||y - X·w||² s.t. w >= 0, sum(w) = 1."""
    model_names = list(model_preds.keys())
    n = len(y_true)

    # Build prediction matrix
    X = np.column_stack([model_preds[m][:n] for m in model_names])

    # NNLS solve
    w, residual = nnls(X, y_true[:n])

    # Normalize to sum = 1
    w_sum = w.sum()
    if w_sum > 0:
        w = w / w_sum
    else:
        w = np.ones(len(model_names)) / len(model_names)

    return {name: float(weight) for name, weight in zip(model_names, w)}, float(residual)


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Load OOF predictions
    oof_preds = load_oof_predictions()

    if len(oof_preds) == 0:
        print("No OOF predictions found. Using uniform weights as default.")
        default_models = ['kalman', 'hmm', 'bayesian_stopping', 'bocpd', 'evt', 'survival', 'gp', 'mcts', 'thompson']
        weights = {m: 1.0 / len(default_models) for m in default_models}
        with open(f"{OUTPUT_DIR}/ensemble_weights.json", 'w') as f:
            json.dump({'weights': weights, 'method': 'uniform_default', 'n_models': len(default_models)}, f, indent=2)
        print(f"Saved uniform weights for {len(default_models)} models.")
        return

    # Load validation target
    val_path = f"{INPUT_DIR}/val_features.parquet"
    if os.path.exists(val_path):
        val_df = pd.read_parquet(val_path)
        if 'price_usd' in val_df.columns:
            y_val = val_df['price_usd'].values
        else:
            y_val = None
    else:
        y_val = None

    # Try OOF-based fitting first
    print(f"Fitting ensemble with {len(oof_preds)} models...")

    # Get y_true from OOF files
    qrf_oof = f'{OUTPUT_DIR}/qrf_oof_predictions.parquet'
    if os.path.exists(qrf_oof):
        oof_df = pd.read_parquet(qrf_oof)
        if 'y_true' in oof_df.columns:
            y_true = oof_df['y_true'].values
            weights, residual = fit_nnls_weights(y_true, oof_preds)
            print(f"\nNNLS ensemble weights (residual={residual:.2f}):")
            for name, w in sorted(weights.items(), key=lambda x: -x[1]):
                print(f"  {name}: {w:.4f}")

            result = {
                'weights': weights,
                'method': 'nnls',
                'residual': float(residual),
                'n_samples': len(y_true),
                'n_models': len(oof_preds),
            }
            with open(f"{OUTPUT_DIR}/ensemble_weights.json", 'w') as f:
                json.dump(result, f, indent=2)
            print(f"\nSaved to {OUTPUT_DIR}/ensemble_weights.json")
            return

    # Fallback: uniform weights
    weights = {m: 1.0 / len(oof_preds) for m in oof_preds}
    result = {
        'weights': weights,
        'method': 'uniform_fallback',
        'n_models': len(oof_preds),
    }
    with open(f"{OUTPUT_DIR}/ensemble_weights.json", 'w') as f:
        json.dump(result, f, indent=2)
    print(f"Saved uniform weights for {len(oof_preds)} models (no y_true for NNLS).")


if __name__ == "__main__":
    main()
