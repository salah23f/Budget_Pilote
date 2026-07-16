"""
v7a/lgbm_quantile.py — modèle central V7a avec target DÉCISIONNELLE.

Deux modèles :
  A. Régression quantile sur `target_future_gain` :
       y_A = min(p_{t+1..t+k(ttd)}) - p_t
     LGBM quantile q10/q50/q90, loss pinball.
     Règle de stopping : BUY ssi q50(y_A) + c_α ≥ 0.

  B. Classif binaire sur `target_future_drop` :
       y_B = 1[ drop ≥ 10% dans la fenêtre ]
     LGBM binary classifier, loss log-loss, sortie calibrée pour alerting.

Les deux modèles partagent les mêmes features `feat_*`.
Le TimeSeriesSplit OOF est fait sur train.
Le fit final utilise train + early stopping sur val.
Aucune lecture de cal/test.

Output :
  data/models_v7a_<tag>/lgbm_q{10,50,90}.pkl
  data/models_v7a_<tag>/lgbm_drop.pkl
  data/models_v7a_<tag>/lgbm_{oof_train,val,cal}.parquet
  reports/v7a_lgbm_metrics_<tag>.json

Run :
  python3 scripts/train/v7a/lgbm_quantile.py
"""

from __future__ import annotations

import json
import pickle
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _env import V7A_FEATURES_DIR, V7A_MODELS_DIR, ensure_dirs, log, tagged_report  # noqa: E402

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

QUANTILES = (0.10, 0.50, 0.90)
SEED = 42
N_ESTIMATORS = 800
EARLY_STOP = 50
N_SPLITS_OOF = 5


def _select_features(df: pd.DataFrame) -> list[str]:
    return sorted([c for c in df.columns if c.startswith("feat_")])


def _pinball(y: np.ndarray, q: np.ndarray, tau: float) -> float:
    e = y - q
    return float(np.mean(np.maximum(tau * e, (tau - 1) * e)))


def _load_split_with_target(split_name: str) -> pd.DataFrame:
    p = V7A_FEATURES_DIR / f"{split_name}.parquet"
    df = pd.read_parquet(p)
    needed = {"target_future_gain", "target_future_drop", "price_usd"}
    missing = needed - set(df.columns)
    if missing:
        raise SystemExit(
            f"{p} lacks columns {missing}. Run scripts/train/v7a/build_target.py first."
        )
    return df


def main() -> None:
    try:
        import lightgbm as lgb  # type: ignore
    except Exception as e:
        raise SystemExit(f"lightgbm manquant : {e}. `pip3 install lightgbm==4.3.0`.")
    from sklearn.model_selection import TimeSeriesSplit  # type: ignore

    ensure_dirs()
    train = _load_split_with_target("train")
    val = _load_split_with_target("val")
    cal = _load_split_with_target("cal")

    # Filtrer rows sans target (fenêtre incomplète)
    train = train[train["target_future_gain"].notna()].reset_index(drop=True)
    val = val[val["target_future_gain"].notna()].reset_index(drop=True)
    cal = cal[cal["target_future_gain"].notna()].reset_index(drop=True)

    feats = _select_features(train)
    log("features", n=len(feats))
    log(
        "split sizes after target filter",
        train=len(train), val=len(val), cal=len(cal),
    )

    X_tr = train[feats].astype(np.float32).to_numpy()
    y_tr_gain = train["target_future_gain"].astype(np.float32).to_numpy()
    y_tr_drop = train["target_future_drop"].astype(np.int8).to_numpy()

    X_va = val[feats].astype(np.float32).to_numpy()
    y_va_gain = val["target_future_gain"].astype(np.float32).to_numpy()
    y_va_drop = val["target_future_drop"].astype(np.int8).to_numpy()

    X_ca = cal[feats].astype(np.float32).to_numpy()
    y_ca_gain = cal["target_future_gain"].astype(np.float32).to_numpy()
    y_ca_drop = cal["target_future_drop"].astype(np.int8).to_numpy()

    # =========================================================================
    # Target A — quantile regression sur gain futur
    # =========================================================================

    # --- OOF k-fold temporel sur TRAIN ---
    oof = {q: np.zeros(len(X_tr), dtype=np.float32) for q in QUANTILES}
    tscv = TimeSeriesSplit(n_splits=N_SPLITS_OOF)
    for fold, (tr_idx, va_idx) in enumerate(tscv.split(X_tr)):
        for q in QUANTILES:
            model = lgb.LGBMRegressor(
                objective="quantile",
                alpha=q,
                n_estimators=N_ESTIMATORS,
                learning_rate=0.05,
                num_leaves=63,
                subsample=0.8,
                colsample_bytree=0.8,
                random_state=SEED,
                verbose=-1,
            )
            model.fit(
                X_tr[tr_idx],
                y_tr_gain[tr_idx],
                eval_set=[(X_tr[va_idx], y_tr_gain[va_idx])],
                callbacks=[lgb.early_stopping(EARLY_STOP, verbose=False)],
            )
            oof[q][va_idx] = model.predict(X_tr[va_idx])
        log(f"oof fold {fold+1}/{N_SPLITS_OOF}")

    pd.DataFrame(
        {
            "route": train["route"].values,
            "fetched_at": train["fetched_at"].values,
            "actual_gain": y_tr_gain,
            "price_usd": train["price_usd"].values,
            "q10_gain": oof[0.10],
            "q50_gain": oof[0.50],
            "q90_gain": oof[0.90],
        }
    ).to_parquet(V7A_MODELS_DIR / "lgbm_oof_train.parquet", index=False)

    # --- Fit final quantiles ---
    val_pred = {}
    cal_pred = {}
    for q in QUANTILES:
        model = lgb.LGBMRegressor(
            objective="quantile",
            alpha=q,
            n_estimators=N_ESTIMATORS,
            learning_rate=0.05,
            num_leaves=63,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=SEED,
            verbose=-1,
        )
        model.fit(
            X_tr,
            y_tr_gain,
            eval_set=[(X_va, y_va_gain)],
            callbacks=[lgb.early_stopping(EARLY_STOP, verbose=False)],
        )
        val_pred[q] = model.predict(X_va)
        cal_pred[q] = model.predict(X_ca)
        with open(V7A_MODELS_DIR / f"lgbm_q{int(q*100):02d}.pkl", "wb") as f:
            pickle.dump(model, f)

    # =========================================================================
    # Target B — binary classifier (drop probability)
    # =========================================================================
    drop_clf = lgb.LGBMClassifier(
        objective="binary",
        n_estimators=N_ESTIMATORS,
        learning_rate=0.05,
        num_leaves=63,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=SEED,
        verbose=-1,
    )
    drop_clf.fit(
        X_tr,
        y_tr_drop,
        eval_set=[(X_va, y_va_drop)],
        callbacks=[lgb.early_stopping(EARLY_STOP, verbose=False)],
    )
    val_drop_proba = drop_clf.predict_proba(X_va)[:, 1]
    cal_drop_proba = drop_clf.predict_proba(X_ca)[:, 1]
    with open(V7A_MODELS_DIR / "lgbm_drop.pkl", "wb") as f:
        pickle.dump(drop_clf, f)

    # =========================================================================
    # Écritures prédictions
    # =========================================================================
    pd.DataFrame(
        {
            "route": val["route"].values,
            "fetched_at": val["fetched_at"].values,
            "price_usd": val["price_usd"].values,
            "actual_gain": y_va_gain,
            "actual_drop": y_va_drop,
            "q10_gain": val_pred[0.10],
            "q50_gain": val_pred[0.50],
            "q90_gain": val_pred[0.90],
            "drop_proba": val_drop_proba,
        }
    ).to_parquet(V7A_MODELS_DIR / "lgbm_val.parquet", index=False)

    pd.DataFrame(
        {
            "route": cal["route"].values,
            "fetched_at": cal["fetched_at"].values,
            "price_usd": cal["price_usd"].values,
            "actual_gain": y_ca_gain,
            "actual_drop": y_ca_drop,
            "q10_gain": cal_pred[0.10],
            "q50_gain": cal_pred[0.50],
            "q90_gain": cal_pred[0.90],
            "drop_proba": cal_drop_proba,
        }
    ).to_parquet(V7A_MODELS_DIR / "lgbm_cal.parquet", index=False)

    # =========================================================================
    # Metrics
    # =========================================================================
    # Pour Target A, coverage attendu sur [q10, q90] du gain
    val_in_band = (y_va_gain >= val_pred[0.10]) & (y_va_gain <= val_pred[0.90])
    cal_in_band = (y_ca_gain >= cal_pred[0.10]) & (y_ca_gain <= cal_pred[0.90])

    # Règle de stopping naïve (sans conformal) : BUY ssi q50_gain ≥ 0
    # Utile juste pour voir à quel point le modèle déclenche.
    trigger_rate_val = float(np.mean(val_pred[0.50] >= 0))
    trigger_rate_cal = float(np.mean(cal_pred[0.50] >= 0))

    # Brier + log-loss pour target B
    def _brier(y_true, proba):
        return float(np.mean((proba - y_true) ** 2))

    def _logloss(y_true, proba, eps=1e-12):
        proba = np.clip(proba, eps, 1 - eps)
        return float(-np.mean(y_true * np.log(proba) + (1 - y_true) * np.log(1 - proba)))

    metrics = {
        "target_A_future_gain": {
            "train_oof": {
                "pinball_10": _pinball(y_tr_gain, oof[0.10], 0.10),
                "pinball_50": _pinball(y_tr_gain, oof[0.50], 0.50),
                "pinball_90": _pinball(y_tr_gain, oof[0.90], 0.90),
                "mae_q50": float(np.mean(np.abs(y_tr_gain - oof[0.50]))),
            },
            "val": {
                "pinball_10": _pinball(y_va_gain, val_pred[0.10], 0.10),
                "pinball_50": _pinball(y_va_gain, val_pred[0.50], 0.50),
                "pinball_90": _pinball(y_va_gain, val_pred[0.90], 0.90),
                "mae_q50": float(np.mean(np.abs(y_va_gain - val_pred[0.50]))),
                "coverage_10_90": float(np.mean(val_in_band)),
                "mean_gain_q50": float(np.mean(val_pred[0.50])),
                "trigger_rate_q50_ge_0": trigger_rate_val,
            },
            "cal": {
                "mae_q50": float(np.mean(np.abs(y_ca_gain - cal_pred[0.50]))),
                "coverage_10_90": float(np.mean(cal_in_band)),
                "trigger_rate_q50_ge_0": trigger_rate_cal,
            },
        },
        "target_B_drop_proba": {
            "val": {
                "brier": _brier(y_va_drop, val_drop_proba),
                "logloss": _logloss(y_va_drop, val_drop_proba),
                "base_rate": float(np.mean(y_va_drop)),
                "proba_mean": float(np.mean(val_drop_proba)),
            },
            "cal": {
                "brier": _brier(y_ca_drop, cal_drop_proba),
                "logloss": _logloss(y_ca_drop, cal_drop_proba),
                "base_rate": float(np.mean(y_ca_drop)),
                "proba_mean": float(np.mean(cal_drop_proba)),
            },
        },
        "n_features": len(feats),
        "n_train": int(len(X_tr)),
        "n_val": int(len(X_va)),
        "n_cal": int(len(X_ca)),
    }
    tagged_report("lgbm_metrics").write_text(
        json.dumps(metrics, indent=2, default=float), encoding="utf-8"
    )
    log(
        "lgbm done",
        mae_q50_val=metrics["target_A_future_gain"]["val"]["mae_q50"],
        coverage_val=metrics["target_A_future_gain"]["val"]["coverage_10_90"],
        trigger_val=trigger_rate_val,
        brier_val=metrics["target_B_drop_proba"]["val"]["brier"],
    )


if __name__ == "__main__":
    main()
