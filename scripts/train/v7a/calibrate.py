"""
v7a/calibrate.py — isotonic + conformal Mondrian sur la target décisionnelle.

Deux pipelines de calibration :
  A. Conformal Mondrian sur TARGET_FUTURE_GAIN :
       résidus = actual_gain - q50_gain
       c_α(bucket) = Quantile_{1-α}(|résidus| | bucket)
       intervalle autour de q50 : [q50 - c_α, q50 + c_α]
       règle de stopping : BUY ssi q50 + c_α ≥ 0  (attente n'apporte rien)

  B. Isotonic calibration sur DROP_PROBA :
       p_cal = IsotonicRegression(proba_raw, actual_drop)
       → probabilité de drop calibrée, utilisable en seuil d'alerte honnête.

Input  : data/models_v7a_<tag>/lgbm_{val,cal}.parquet
         data/features_v7a_<tag>/cal.parquet
Output : data/models_v7a_<tag>/conformal_mondrian.json
         data/models_v7a_<tag>/isotonic_drop.pkl
         reports/v7a_conformal_metrics_<tag>.json

Run :
  python3 scripts/train/v7a/calibrate.py
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

ALPHAS = (0.05, 0.10, 0.20)
BUCKET_MIN_N = 100


def _ttd_bucket(ttd: np.ndarray) -> np.ndarray:
    return np.where(ttd <= 7, 0, np.where(ttd <= 21, 1, np.where(ttd <= 60, 2, 3))).astype(np.int8)


def _freq_class(pop: np.ndarray) -> np.ndarray:
    return np.where(pop < 50, 0, np.where(pop < 500, 1, 2)).astype(np.int8)


def _vol_class(std_ratio: np.ndarray) -> np.ndarray:
    return np.where(std_ratio < 0.10, 0, np.where(std_ratio < 0.30, 1, 2)).astype(np.int8)


def main() -> None:
    try:
        from sklearn.isotonic import IsotonicRegression  # type: ignore
    except Exception as e:
        raise SystemExit(f"scikit-learn manquant : {e}. `pip3 install scikit-learn==1.5.0`.")

    ensure_dirs()
    cal_pred = pd.read_parquet(V7A_MODELS_DIR / "lgbm_cal.parquet")
    cal_feats = pd.read_parquet(V7A_FEATURES_DIR / "cal.parquet")
    cal_feats = cal_feats[cal_feats["target_future_gain"].notna()].reset_index(drop=True)

    # V7a fix : JOIN POSITIONAL. Un merge par (route, fetched_at) fait une
    # explosion combinatoire massive sur dilwong (plusieurs lignes au même
    # (route, fetched_at) pour différents depart_dates / cabines). Les deux
    # tables sont écrites dans le MÊME ordre (sort par route, depart_date,
    # fetched_at dans build_target, puis filter target non-NaN dans lgbm et
    # ici). On fait donc un concat positional après assertion de longueur.
    assert len(cal_pred) == len(cal_feats), (
        f"len mismatch cal_pred={len(cal_pred)} vs cal_feats={len(cal_feats)} — "
        "re-run lgbm_quantile.py et calibrate.py sur les mêmes features/cal."
    )

    # Spot-check cohérence (route identique sur plusieurs indices)
    for i in (0, len(cal_pred) // 2, len(cal_pred) - 1):
        r_pred = str(cal_pred.iloc[i]["route"])
        r_feat = str(cal_feats.iloc[i]["route"])
        if r_pred != r_feat:
            raise RuntimeError(
                f"Positional join misalignment at row {i}: {r_pred} vs {r_feat}. "
                "Les parquets cal ne sont pas dans le même ordre."
            )

    cal_pred = cal_pred.copy()
    cal_pred["ttd_days"] = cal_feats["ttd_days"].to_numpy()
    cal_pred["feat_route_popularity"] = cal_feats["feat_route_popularity"].to_numpy()
    cal_pred["feat_route_mean_train"] = cal_feats["feat_route_mean_train"].to_numpy()
    cal_pred["feat_route_std_train"] = cal_feats["feat_route_std_train"].to_numpy()
    log("cal aligned via positional join", rows=len(cal_pred))

    # =========================================================================
    # Target A — conformal Mondrian sur |actual_gain - q50_gain|
    # =========================================================================
    residuals = (cal_pred["actual_gain"].values - cal_pred["q50_gain"].values).astype(np.float64)
    abs_res = np.abs(residuals)

    ttd = cal_pred["ttd_days"].to_numpy(dtype=np.float64)
    pop = cal_pred["feat_route_popularity"].to_numpy(dtype=np.float64)
    mean_train = cal_pred["feat_route_mean_train"].to_numpy(dtype=np.float64)
    std_train = cal_pred["feat_route_std_train"].to_numpy(dtype=np.float64)
    std_ratio = np.where(mean_train > 0, std_train / mean_train, 0.0)

    bk_ttd = _ttd_bucket(ttd)
    bk_freq = _freq_class(pop)
    bk_vol = _vol_class(std_ratio)

    mondrian = {"alpha": {}, "global": {}, "target": "future_gain"}
    for a in ALPHAS:
        tag = f"alpha_{int(a*100):02d}"
        mondrian["alpha"][tag] = {}
        mondrian["global"][tag] = float(np.quantile(abs_res, 1.0 - a))

        df_b = pd.DataFrame({"ttd": bk_ttd, "freq": bk_freq, "vol": bk_vol, "r": abs_res})
        agg = df_b.groupby(["ttd", "freq", "vol"])["r"].agg(
            n="size", c=lambda s: float(np.quantile(s, 1.0 - a))
        ).reset_index()
        for _, row in agg.iterrows():
            key = f"{int(row['ttd'])}-{int(row['freq'])}-{int(row['vol'])}"
            mondrian["alpha"][tag][key] = {
                "n": int(row["n"]),
                "c": float(row["c"]) if row["n"] >= BUCKET_MIN_N else mondrian["global"][tag],
                "used_global_fallback": bool(row["n"] < BUCKET_MIN_N),
            }

    (V7A_MODELS_DIR / "conformal_mondrian.json").write_text(
        json.dumps(mondrian, indent=2), encoding="utf-8"
    )

    # =========================================================================
    # Target B — isotonic calibration sur drop_proba (sur cal)
    # =========================================================================
    iso_drop = IsotonicRegression(out_of_bounds="clip")
    iso_drop.fit(cal_pred["drop_proba"].values, cal_pred["actual_drop"].values)
    with open(V7A_MODELS_DIR / "isotonic_drop.pkl", "wb") as f:
        pickle.dump(iso_drop, f)

    cal_pred["drop_proba_calibrated"] = iso_drop.predict(cal_pred["drop_proba"].values)

    # =========================================================================
    # Metrics
    # =========================================================================
    metrics: dict = {
        "target_A_future_gain": {"alpha": {}},
        "target_B_drop_proba": {},
    }
    for a in ALPHAS:
        tag = f"alpha_{int(a*100):02d}"
        buckets = [f"{bk_ttd[i]}-{bk_freq[i]}-{bk_vol[i]}" for i in range(len(bk_ttd))]
        c = np.array(
            [mondrian["alpha"][tag].get(b, {"c": mondrian["global"][tag]})["c"] for b in buckets]
        )
        q50 = cal_pred["q50_gain"].values
        L = q50 - c
        U = q50 + c
        actual = cal_pred["actual_gain"].values
        cov = float(np.mean((actual >= L) & (actual <= U)))
        width = float(np.mean(U - L))
        price = cal_pred["price_usd"].values
        wr = float(np.mean((U - L) / np.clip(price, 1.0, None)))
        # % rows où q50 + c_alpha >= 0 (trigger BUY_NOW)
        trigger_rate = float(np.mean(q50 + c >= 0))

        per_bucket = {}
        df_cov = pd.DataFrame(
            {
                "b": buckets,
                "cov": (actual >= L) & (actual <= U),
                "w": U - L,
                "buy_trig": q50 + c >= 0,
            }
        )
        agg = df_cov.groupby("b").agg(
            n=("b", "count"),
            coverage=("cov", "mean"),
            width_mean=("w", "mean"),
            buy_trigger_rate=("buy_trig", "mean"),
        )
        for b, row in agg.iterrows():
            per_bucket[b] = {
                "n": int(row["n"]),
                "coverage": float(row["coverage"]),
                "width_mean": float(row["width_mean"]),
                "buy_trigger_rate": float(row["buy_trigger_rate"]),
            }
        metrics["target_A_future_gain"]["alpha"][tag] = {
            "coverage_marginal": cov,
            "width_mean": width,
            "width_over_price_mean": wr,
            "buy_trigger_rate": trigger_rate,
            "per_bucket": per_bucket,
        }

    # Target B : reliability diagram simple (binning par proba)
    actual_drop = cal_pred["actual_drop"].values.astype(np.float64)
    proba_raw = cal_pred["drop_proba"].values.astype(np.float64)
    proba_cal = cal_pred["drop_proba_calibrated"].values.astype(np.float64)

    def _reliability(actual, proba, n_bins=10):
        bins = np.linspace(0, 1, n_bins + 1)
        out = {}
        for i in range(n_bins):
            lo, hi = bins[i], bins[i + 1]
            mask = (proba >= lo) & (proba < hi) if i < n_bins - 1 else (proba >= lo) & (proba <= hi)
            if mask.any():
                out[f"{lo:.1f}-{hi:.1f}"] = {
                    "n": int(mask.sum()),
                    "mean_proba": float(proba[mask].mean()),
                    "mean_actual": float(actual[mask].mean()),
                }
        return out

    def _ece(actual, proba, n_bins=10):
        bins = np.linspace(0, 1, n_bins + 1)
        n = len(actual)
        err = 0.0
        for i in range(n_bins):
            lo, hi = bins[i], bins[i + 1]
            mask = (proba >= lo) & (proba < hi) if i < n_bins - 1 else (proba >= lo) & (proba <= hi)
            if mask.sum() == 0:
                continue
            err += (mask.sum() / n) * abs(proba[mask].mean() - actual[mask].mean())
        return float(err)

    metrics["target_B_drop_proba"] = {
        "base_rate_cal": float(actual_drop.mean()),
        "ece_raw": _ece(actual_drop, proba_raw),
        "ece_calibrated": _ece(actual_drop, proba_cal),
        "reliability_raw": _reliability(actual_drop, proba_raw),
        "reliability_calibrated": _reliability(actual_drop, proba_cal),
    }

    tagged_report("conformal_metrics").write_text(
        json.dumps(metrics, indent=2, default=float), encoding="utf-8"
    )
    log(
        "conformal + isotonic done",
        coverage_a10=metrics["target_A_future_gain"]["alpha"]["alpha_10"]["coverage_marginal"],
        trigger_a10=metrics["target_A_future_gain"]["alpha"]["alpha_10"]["buy_trigger_rate"],
        ece_drop_raw=metrics["target_B_drop_proba"]["ece_raw"],
        ece_drop_cal=metrics["target_B_drop_proba"]["ece_calibrated"],
    )


if __name__ == "__main__":
    main()
