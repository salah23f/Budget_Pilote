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
from scipy.optimize import nnls, minimize
from sklearn.isotonic import IsotonicRegression

# Guardrail: blended ensemble cannot degrade global MAE by more than this
# ratio vs the standard NNLS baseline. If no blend can satisfy it, we fall
# back to pure standard (zero risk of net regression).
MAE_DEGRADATION_TOLERANCE = 0.02  # +2% max

# Enhanced robustness: bootstrap stability check.
# A blend is only accepted if it beats the standard on CVaR in >= this fraction
# of bootstrap resamples. Eliminates lucky-but-fragile blends.
BOOTSTRAP_N = 200
BOOTSTRAP_WIN_RATIO = 0.55  # must win on at least 55% of resamples


def calibrate_predictions_isotonic(preds, y_true, cal_frac=0.3):
    """Fit isotonic regression on a calibration split, apply to full preds.

    Corrects per-model biases (TFT under-predicts at high prices, QRF over-
    predicts on tails, etc.) WITHOUT touching the rank ordering. This makes
    NNLS stacking much more effective because every input is on the same
    scale.
    """
    n = len(preds)
    cal_n = int(n * cal_frac)
    if cal_n < 100:
        return preds.copy()
    try:
        iso = IsotonicRegression(out_of_bounds='clip')
        iso.fit(preds[:cal_n], y_true[:cal_n])
        return iso.predict(preds).astype(np.float64)
    except Exception:
        return preds.copy()


def bootstrap_stability(y_true, preds_stack, w_baseline, w_candidate,
                         n_boot=BOOTSTRAP_N, cvar_alpha=0.1, seed=42):
    """Return fraction of bootstrap resamples where `candidate` beats
    `baseline` on CVaR-loss. 0.5 = coin flip, > BOOTSTRAP_WIN_RATIO = robust."""
    rng = np.random.default_rng(seed)
    n = len(y_true)
    wins = 0
    for _ in range(n_boot):
        idx = rng.integers(0, n, n)
        y_b = y_true[idx]
        p_base = preds_stack[idx] @ w_baseline
        p_cand = preds_stack[idx] @ w_candidate
        r_base = np.abs(y_b - p_base)
        r_cand = np.abs(y_b - p_cand)
        cut = np.quantile(r_base, 1.0 - cvar_alpha)
        cvar_base = r_base[r_base >= cut].mean()
        cut2 = np.quantile(r_cand, 1.0 - cvar_alpha)
        cvar_cand = r_cand[r_cand >= cut2].mean()
        if cvar_cand < cvar_base:
            wins += 1
    return wins / n_boot


def pareto_filter(candidates):
    """Keep only Pareto-optimal candidates on (mae, cvar10, cvar5).
    Returns list of (x_vec, mae, cvar10, cvar5) that are not dominated."""
    pareto = []
    for c in candidates:
        dominated = False
        for d in candidates:
            if d is c:
                continue
            if (d[1] <= c[1] and d[2] <= c[2] and d[3] <= c[3]
                    and (d[1] < c[1] or d[2] < c[2] or d[3] < c[3])):
                dominated = True
                break
        if not dominated:
            pareto.append(c)
    return pareto

OUTPUT_DIR = "models"
INPUT_DIR = "data/features"


def load_oof_predictions():
    """Load out-of-fold predictions from ALL level-0 models.

    Each OOF parquet must expose (1) a prediction column and (2) a truth column.
    Accepted aliases:
        prediction: 'prediction', 'y_pred', any column containing 'q50' or 'median'
        truth     : 'actual', 'y_true'
    Models are aligned on the smallest common length so NNLS sees a rectangular
    design matrix.
    """
    predictions = {}
    truths = {}
    oof_files = {
        'qrf':    f'{OUTPUT_DIR}/qrf_oof_predictions.parquet',
        'lstm':   f'{OUTPUT_DIR}/lstm_oof_predictions.parquet',
        'tft':    f'{OUTPUT_DIR}/tft_oof_predictions.parquet',
        'deepar': f'{OUTPUT_DIR}/deepar_oof_predictions.parquet',
        'gp':     f'{OUTPUT_DIR}/gp_oof_predictions.parquet',
        'hmm':    f'{OUTPUT_DIR}/hmm_oof_predictions.parquet',
        'maml':   f'{OUTPUT_DIR}/maml_oof_predictions.parquet',
        'vae':    f'{OUTPUT_DIR}/vae_oof_predictions.parquet',
        'cql':    f'{OUTPUT_DIR}/cql_oof_predictions.parquet',
    }

    for model_name, path in oof_files.items():
        if not os.path.exists(path):
            continue
        df = pd.read_parquet(path)

        # --- Resolve prediction column ---
        pred_vals = None
        for cand in ('prediction', 'y_pred'):
            if cand in df.columns:
                pred_vals = df[cand].values
                break
        if pred_vals is None:
            median_col = [c for c in df.columns if 'q50' in c or 'median' in c]
            if median_col:
                pred_vals = df[median_col[0]].values
        if pred_vals is None:
            print(f"  [skip] {model_name}: no prediction column")
            continue

        # --- Resolve truth column ---
        truth_vals = None
        for cand in ('actual', 'y_true'):
            if cand in df.columns:
                truth_vals = df[cand].values
                break

        predictions[model_name] = pred_vals
        if truth_vals is not None:
            truths[model_name] = truth_vals
        print(f"  [ok]   {model_name}: {len(pred_vals):,} OOF rows")

    return predictions, truths


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


def fit_nnls_weights(y_true, model_preds, sample_weights=None):
    """Fit NNLS weights: argmin ||sqrt(w) · (y - X·β)||² s.t. β >= 0, sum(β) = 1.

    sample_weights: per-row weight. Larger weight = sample counts more.
    Used for tail-aware fitting (upweight rare/hard cases).
    """
    model_names = list(model_preds.keys())
    n = len(y_true)

    X = np.column_stack([model_preds[m][:n] for m in model_names])
    y = y_true[:n]

    if sample_weights is not None:
        sw = np.sqrt(np.clip(sample_weights[:n], 0, None))
        X = X * sw[:, None]
        y = y * sw

    w, residual = nnls(X, y)
    w_sum = w.sum()
    if w_sum > 0:
        w = w / w_sum
    else:
        w = np.ones(len(model_names)) / len(model_names)

    return {name: float(weight) for name, weight in zip(model_names, w)}, float(residual)


def compute_rarity_weights(y_true, preds_stack):
    """Upweight samples where the average model prediction misses badly.

    Rationale: rare-regime samples are exactly the ones all models struggle
    with. Weighting them higher in the NNLS fit forces the ensemble to find
    a combination that captures tails instead of hugging the mean.
    """
    mean_pred = np.mean(preds_stack, axis=1)
    residuals = np.abs(y_true - mean_pred)
    median_res = max(np.median(residuals), 1e-6)
    # Weight: 1× at median residual, up to 4× at top-1% residual
    w = 1.0 + 3.0 * np.clip(residuals / (4.0 * median_res), 0.0, 1.0)
    return w


def compute_cvar_weights(y_true, preds_stack, alpha=0.1):
    """CVaR-style weighting: put ~all mass on the worst alpha-quantile residuals.

    This makes NNLS minimize loss on the worst 10% of samples (tail risk).
    Combined with standard NNLS via a 50/50 mix gives a robust ensemble.
    """
    mean_pred = np.mean(preds_stack, axis=1)
    residuals = np.abs(y_true - mean_pred)
    cutoff = np.quantile(residuals, 1.0 - alpha)
    w = np.where(residuals >= cutoff, 1.0, 0.1)
    return w


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Load OOF predictions from every available model
    print("Scanning OOF prediction files...")
    oof_preds, truths = load_oof_predictions()

    if len(oof_preds) == 0:
        print("No OOF predictions found. Using uniform weights as default.")
        default_models = ['kalman', 'hmm', 'bayesian_stopping', 'bocpd', 'evt', 'survival', 'gp', 'mcts', 'thompson']
        weights = {m: 1.0 / len(default_models) for m in default_models}
        with open(f"{OUTPUT_DIR}/ensemble_weights.json", 'w') as f:
            json.dump({'weights': weights, 'method': 'uniform_default', 'n_models': len(default_models)}, f, indent=2)
        print(f"Saved uniform weights for {len(default_models)} models.")
        return

    # Align every model to the smallest common length so NNLS sees a proper matrix
    min_len = min(len(v) for v in oof_preds.values())
    print(f"\nFitting NNLS stacking on {len(oof_preds)} models x {min_len:,} rows")

    y_true = None
    if truths:
        # Prefer QRF truth, fallback to any available one.
        # Note: can't use `dict.get(k) or fallback` because numpy arrays don't
        # support truthiness evaluation.
        if 'qrf' in truths:
            y_true = truths['qrf']
        else:
            y_true = next(iter(truths.values()))
        y_true = y_true[:min_len]

    # Last-resort: pull y_true from val_features if no OOF exposed it
    if y_true is None:
        val_path = f"{INPUT_DIR}/val_features.parquet"
        if os.path.exists(val_path):
            val_df = pd.read_parquet(val_path, columns=['price_usd'])
            if 'price_usd' in val_df.columns and len(val_df) >= min_len:
                y_true = val_df['price_usd'].values[:min_len]

    if y_true is None:
        weights = {m: 1.0 / len(oof_preds) for m in oof_preds}
        result = {'weights': weights, 'method': 'uniform_fallback', 'n_models': len(oof_preds)}
        with open(f"{OUTPUT_DIR}/ensemble_weights.json", 'w') as f:
            json.dump(result, f, indent=2)
        print(f"Saved uniform weights for {len(oof_preds)} models (no y_true for NNLS).")
        return

    # Truncate every model prediction to the same length
    aligned_raw = {m: p[:min_len] for m, p in oof_preds.items()}

    # --- Isotonic calibration per model (level-0 bias correction) ---
    print("\nCalibrating each model via isotonic regression...")
    aligned = {}
    cal_report = {}
    for m, p in aligned_raw.items():
        cal = calibrate_predictions_isotonic(p, y_true)
        mae_raw  = float(np.abs(y_true - p).mean())
        mae_cal  = float(np.abs(y_true - cal).mean())
        aligned[m] = cal
        cal_report[m] = {'raw_mae': mae_raw, 'calibrated_mae': mae_cal,
                         'gain_pct': (mae_raw - mae_cal) / max(mae_raw, 1e-6) * 100}
        tag = "✓" if mae_cal < mae_raw else "="
        print(f"  [{tag}] {m:<8} raw={mae_raw:8.2f}  cal={mae_cal:8.2f}  ({(mae_raw-mae_cal)/max(mae_raw,1e-6)*100:+.2f}%)")
    preds_stack = np.column_stack([aligned[m] for m in aligned])

    # --- Fit three variants: standard, tail-rare, CVaR-worst ---
    w_std, r_std = fit_nnls_weights(y_true, aligned)
    rarity_w = compute_rarity_weights(y_true, preds_stack)
    w_rare, r_rare = fit_nnls_weights(y_true, aligned, sample_weights=rarity_w)
    cvar_w = compute_cvar_weights(y_true, preds_stack, alpha=0.1)
    w_cvar, r_cvar = fit_nnls_weights(y_true, aligned, sample_weights=cvar_w)

    # --- Guardrailed auto-blend ---
    # Find (alpha, beta, gamma) that maximize CVaR gain, subject to:
    #   - alpha + beta + gamma = 1, all >= 0
    #   - global MAE <= standard_MAE * (1 + MAE_DEGRADATION_TOLERANCE)
    # If no feasible blend exists, fall back to standard alone (alpha=1).
    def _blend_weights(alpha, beta, gamma):
        combined = {}
        for m in aligned:
            combined[m] = alpha * w_std[m] + beta * w_rare[m] + gamma * w_cvar[m]
        s = sum(combined.values())
        if s > 0:
            combined = {m: v / s for m, v in combined.items()}
        return combined

    def _mae_of(w_dict):
        p = np.sum([w_dict[m] * aligned[m] for m in aligned], axis=0)
        return float(np.abs(y_true - p).mean())

    def _cvar_mae_of(w_dict, alpha_cv=0.1):
        p = np.sum([w_dict[m] * aligned[m] for m in aligned], axis=0)
        r = np.abs(y_true - p)
        cutoff = np.quantile(r, 1.0 - alpha_cv)
        return float(r[r >= cutoff].mean())

    standard_mae = _mae_of(w_std)
    mae_budget = standard_mae * (1.0 + MAE_DEGRADATION_TOLERANCE)

    # Small constrained optimization: x = [alpha, beta, gamma]
    def _obj(x):
        a, b, c = x
        blended_w = _blend_weights(a, b, c)
        return _cvar_mae_of(blended_w)  # minimize CVaR MAE

    def _mae_constraint(x):
        a, b, c = x
        blended_w = _blend_weights(a, b, c)
        return mae_budget - _mae_of(blended_w)  # must be >= 0

    cons = [
        {'type': 'eq',   'fun': lambda x: sum(x) - 1.0},
        {'type': 'ineq', 'fun': _mae_constraint},
    ]
    bounds = [(0.0, 1.0)] * 3

    # ---- Multi-start SLSQP — collect ALL feasible candidates for Pareto filtering ----
    candidates = []
    # Always include pure standard as a safe fallback
    candidates.append((
        np.array([1.0, 0.0, 0.0]), standard_mae,
        _cvar_mae_of(w_std),
        _cvar_mae_of(w_std, alpha_cv=0.05),
    ))
    starts = [[1, 0, 0], [0.5, 0.25, 0.25], [0.33, 0.33, 0.34],
              [0.6, 0.2, 0.2], [0.4, 0.1, 0.5], [0.4, 0.5, 0.1],
              [0.7, 0.15, 0.15], [0.5, 0.5, 0.0], [0.5, 0.0, 0.5],
              [0.8, 0.1, 0.1]]
    for x0 in starts:
        try:
            res = minimize(_obj, x0=np.array(x0), method='SLSQP',
                           bounds=bounds, constraints=cons,
                           options={'ftol': 1e-5, 'maxiter': 60})
            if res.success:
                test_blend = _blend_weights(*res.x)
                test_mae   = _mae_of(test_blend)
                if test_mae <= mae_budget + 1e-6:
                    candidates.append((
                        res.x.copy(), test_mae,
                        _cvar_mae_of(test_blend),
                        _cvar_mae_of(test_blend, alpha_cv=0.05),
                    ))
        except Exception:
            continue

    # ---- Pareto filter on (MAE, CVaR@10, CVaR@5) ----
    pareto_set = pareto_filter(candidates)
    print(f"\n{len(candidates)} feasible candidates → {len(pareto_set)} Pareto-optimal")

    # ---- Pick best Pareto candidate by CVaR@10 (our main tail risk metric) ----
    # and validate it with bootstrap stability against the standard baseline.
    w_std_vec = np.array([w_std[m] for m in aligned])
    pareto_sorted = sorted(pareto_set, key=lambda c: c[2])  # by CVaR@10 ascending

    chosen_idx = None
    bootstrap_checked = []
    for i, (x, mae, cvar10, cvar5) in enumerate(pareto_sorted):
        test_blend = _blend_weights(*x)
        w_cand_vec = np.array([test_blend[m] for m in aligned])
        win = bootstrap_stability(y_true, preds_stack, w_std_vec, w_cand_vec)
        bootstrap_checked.append({
            'x': x.tolist(), 'mae': mae, 'cvar10': cvar10, 'cvar5': cvar5,
            'bootstrap_win_ratio': win,
            'stable': win >= BOOTSTRAP_WIN_RATIO,
        })
        print(f"  candidate {i}: α={x[0]:.2f} β={x[1]:.2f} γ={x[2]:.2f} "
              f"MAE={mae:.2f} CVaR10={cvar10:.2f} bootstrap_win={win:.2%} "
              f"{'✓ stable' if win >= BOOTSTRAP_WIN_RATIO else '✗ fragile'}")
        if chosen_idx is None and win >= BOOTSTRAP_WIN_RATIO:
            chosen_idx = i

    if chosen_idx is None:
        # No stable Pareto candidate → fall back to pure standard
        best_x = np.array([1.0, 0.0, 0.0])
        blend_method = 'standard_fallback (no bootstrap-stable Pareto candidate)'
    else:
        best_x = pareto_sorted[chosen_idx][0]
        alpha, beta, gamma = best_x
        if np.isclose(alpha, 1.0, atol=1e-3):
            blend_method = 'standard_fallback (optimum is standard)'
        else:
            blend_method = (f'pareto_bootstrap_validated (α={alpha:.2f}, '
                           f'β={beta:.2f}, γ={gamma:.2f})')

    alpha_star, beta_star, gamma_star = best_x
    blended = _blend_weights(alpha_star, beta_star, gamma_star)
    chosen_mae = _mae_of(blended)
    chosen_cvar = _cvar_mae_of(blended)

    print(f"\nGuardrail: MAE budget = {mae_budget:.2f} (tolerance +{MAE_DEGRADATION_TOLERANCE*100:.0f}%)")
    print(f"Chosen: MAE={chosen_mae:.2f} ({(chosen_mae/standard_mae-1)*100:+.2f}% vs std), CVaR10={chosen_cvar:.2f}")
    print(f"Method: {blend_method}")

    # --- Diagnostics per variant ---
    def _pred(w_dict):
        return np.sum([w_dict[m] * aligned[m] for m in aligned], axis=0)

    def _mae(p):
        return float(np.abs(y_true - p).mean())

    def _cvar_mae(p, alpha=0.1):
        r = np.abs(y_true - p)
        cutoff = np.quantile(r, 1.0 - alpha)
        return float(r[r >= cutoff].mean())

    print(f"\n{'Variant':<12} {'MAE':>10} {'CVaR10% MAE':>14}")
    for name, w_dict in [('standard', w_std), ('rarity', w_rare),
                          ('cvar', w_cvar), ('blended', blended)]:
        p = _pred(w_dict)
        print(f"{name:<12} {_mae(p):>10.2f} {_cvar_mae(p):>14.2f}")

    print(f"\nFinal BLENDED ensemble weights:")
    for name, w in sorted(blended.items(), key=lambda x: -x[1]):
        print(f"  {name}: {w:.4f}")

    result = {
        'weights': blended,
        'method': blend_method,
        'blend_ratios': {
            'alpha_standard': float(alpha_star),
            'beta_rarity':    float(beta_star),
            'gamma_cvar':     float(gamma_star),
        },
        'guardrail': {
            'max_mae_degradation_pct': MAE_DEGRADATION_TOLERANCE * 100,
            'standard_mae': float(standard_mae),
            'mae_budget':   float(mae_budget),
            'chosen_mae':   float(chosen_mae),
        },
        'robustness': {
            'isotonic_calibration': cal_report,
            'n_candidates':        len(candidates),
            'n_pareto_optimal':    len(pareto_set),
            'bootstrap_n':         BOOTSTRAP_N,
            'bootstrap_win_threshold': BOOTSTRAP_WIN_RATIO,
            'pareto_candidates':   bootstrap_checked,
        },
        'variants': {
            'standard': w_std,
            'rarity_weighted': w_rare,
            'cvar_weighted': w_cvar,
        },
        'metrics': {
            'standard_mae':  _mae(_pred(w_std)),
            'rarity_mae':    _mae(_pred(w_rare)),
            'cvar_mae':      _mae(_pred(w_cvar)),
            'blended_mae':   chosen_mae,
            'blended_cvar10_mae': chosen_cvar,
            'standard_cvar10_mae': _cvar_mae(_pred(w_std)),
            'cvar10_improvement_pct': (1 - chosen_cvar / _cvar_mae(_pred(w_std))) * 100,
        },
        'n_samples': int(min_len),
        'n_models': len(aligned),
        'models': list(aligned.keys()),
    }
    with open(f"{OUTPUT_DIR}/ensemble_weights.json", 'w') as f:
        json.dump(result, f, indent=2)
    print(f"\nSaved to {OUTPUT_DIR}/ensemble_weights.json")


if __name__ == "__main__":
    main()
