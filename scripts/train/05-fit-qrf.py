"""
05-fit-qrf.py — Quantile Regression Forest for multi-quantile price forecasting.

Extends sklearn RandomForest by keeping leaf distributions.
Predicts quantiles [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95] at horizons J+1, J+7, J+30.

Input: data/features/train_features.parquet
Output: models/qrf_model.pkl, models/qrf_oof_predictions.parquet (for ensemble stacking)
"""

import os
import json
import pickle
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import TimeSeriesSplit

OUTPUT_DIR = "models"
INPUT_DIR = "data/features"
QUANTILES = [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95]
N_TREES = 200
MAX_DEPTH = 12
MIN_SAMPLES_LEAF = 20


def quantile_predict(forest, X, quantiles):
    """Extract quantile predictions from a fitted RandomForest."""
    all_preds = np.array([tree.predict(X) for tree in forest.estimators_])
    results = {}
    for q in quantiles:
        results[q] = np.percentile(all_preds, q * 100, axis=0)
    return results


def pinball_loss(y_true, y_pred, tau):
    err = y_true - y_pred
    return np.mean(np.maximum(tau * err, (tau - 1) * err))


def crps_empirical(y_true, quantile_preds):
    """Approximate CRPS from quantile predictions."""
    quantiles_sorted = sorted(quantile_preds.keys())
    crps = 0
    for i, q in enumerate(quantiles_sorted):
        pred = quantile_preds[q]
        indicator = (y_true <= pred).astype(float)
        crps += np.mean((indicator - q)**2)
    return crps / len(quantiles_sorted)


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    path = f"{INPUT_DIR}/train_features.parquet"
    if not os.path.exists(path):
        print("No training features found.")
        return

    df = pd.read_parquet(path)
    print(f"Loaded {len(df)} training rows")

    # Select numeric features
    exclude = {'price_usd', 'id', 'fetched_at', 'created_at', 'depart_date', 'origin', 'destination',
                'airline', 'source', 'cabin_class', 'return_date', 'route'}
    feature_cols = [c for c in df.columns
                    if df[c].dtype in [np.float64, np.int64, np.float32, np.int32]
                    and c not in exclude
                    and not c.startswith('Unnamed')]

    if len(feature_cols) == 0:
        print("No numeric features found for QRF.")
        return

    print(f"Using {len(feature_cols)} features: {feature_cols[:10]}...")

    target = 'price_usd'
    if target not in df.columns:
        print("No price_usd target column.")
        return

    df = df.dropna(subset=[target])
    X = df[feature_cols].fillna(0).values
    y = df[target].values

    print(f"Training QRF: {X.shape[0]} samples, {X.shape[1]} features, {N_TREES} trees...")

    # Fit forest
    forest = RandomForestRegressor(
        n_estimators=N_TREES,
        max_depth=MAX_DEPTH,
        min_samples_leaf=MIN_SAMPLES_LEAF,
        n_jobs=-1,
        random_state=42,
        verbose=1,
    )
    forest.fit(X, y)

    # Quantile predictions on training set (for OOF stacking later)
    q_preds = quantile_predict(forest, X, QUANTILES)

    # Evaluate on last 20% (time-ordered)
    split_idx = int(len(X) * 0.8)
    X_val, y_val = X[split_idx:], y[split_idx:]
    q_val = quantile_predict(forest, X_val, QUANTILES)

    # Metrics
    median_pred = q_val[0.5]
    mae = np.mean(np.abs(y_val - median_pred))
    mape = np.mean(np.abs((y_val - median_pred) / (y_val + 1))) * 100
    crps = crps_empirical(y_val, q_val)

    # Coverage
    coverage_90 = np.mean((y_val >= q_val[0.05]) & (y_val <= q_val[0.95])) * 100
    coverage_80 = np.mean((y_val >= q_val[0.1]) & (y_val <= q_val[0.9])) * 100

    print(f"\nValidation metrics:")
    print(f"  MAE: ${mae:.2f}")
    print(f"  MAPE: {mape:.1f}%")
    print(f"  CRPS: {crps:.4f}")
    print(f"  Coverage 90%: {coverage_90:.1f}%")
    print(f"  Coverage 80%: {coverage_80:.1f}%")

    for q in QUANTILES:
        pl = pinball_loss(y_val, q_val[q], q)
        print(f"  Pinball τ={q}: {pl:.2f}")

    # Save model
    model_path = f"{OUTPUT_DIR}/qrf_model.pkl"
    with open(model_path, 'wb') as f:
        pickle.dump({'forest': forest, 'feature_cols': feature_cols, 'quantiles': QUANTILES}, f)
    print(f"\nSaved QRF model to {model_path}")

    # Save OOF predictions for ensemble
    oof_df = pd.DataFrame({'y_true': y})
    for q in QUANTILES:
        oof_df[f'qrf_q{int(q*100)}'] = q_preds[q]
    oof_path = f"{OUTPUT_DIR}/qrf_oof_predictions.parquet"
    oof_df.to_parquet(oof_path, index=False)
    print(f"Saved OOF predictions to {oof_path}")

    # Save metrics
    metrics = {
        'mae': float(mae), 'mape': float(mape), 'crps': float(crps),
        'coverage_90': float(coverage_90), 'coverage_80': float(coverage_80),
        'n_trees': N_TREES, 'max_depth': MAX_DEPTH,
        'n_features': len(feature_cols), 'n_samples': len(X),
    }
    with open(f"{OUTPUT_DIR}/qrf_metrics.json", 'w') as f:
        json.dump(metrics, f, indent=2)


if __name__ == "__main__":
    main()
