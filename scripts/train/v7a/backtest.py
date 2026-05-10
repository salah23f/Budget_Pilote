"""
v7a/backtest.py — seul script V7a autorisé à lire le hold-out TEST.

Évalue DEUX variantes de V7a :
  - v7a_ml_only : policy basée uniquement sur target A + target B (ML pur)
  - v7a_hybrid  : même policy + trigger Q10_train_route (fallback baseline)

Métriques :
  A. Qualité d'achat
     - regret_abs mean / p50 / p90 / p99
     - regret_rel mean / p50 / p90
     - capture mean / median + IC95 bootstrap
  B. Qualité de timing d'alerte — MÉTRIQUES HONNÊTES
     - alert_precision_floor_1_05 : % alertes avec price_alerte ≤ floor × 1.05
     - alert_precision_floor_1_10 : % alertes avec price_alerte ≤ floor × 1.10
     - alert_recall_floor_1_05    : % obs dans [floor, floor×1.05] alertées
     - regret_realized_after_alert_mean : regret au premier prix ≤ price_alerte post-alerte
     - alert_too_early / too_late
     - (alert_precision "legacy" = ancien conformal_lower hit, gardée pour comparaison)
  C. Coverage conformal par segment (ttd × freq × vol)
  D. Action distribution (count BUY_NOW / WAIT / etc)
  E. Buy trigger diagnostic

Sortie :
  - reports/v7a_backtest_<tag>.json
  - reports/v7a_segmented_metrics_<tag>.json
  - data/models_v7a_<tag>/lgbm_test.parquet

Run :
  python3 scripts/train/v7a/backtest.py
"""

from __future__ import annotations

import json
import pickle
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _env import (  # noqa: E402
    V7A_FEATURES_DIR,
    V7A_MODELS_DIR,
    V7A_REPORTS_DIR,
    V7A_TAG,
    assert_test_split_not_read,
    ensure_dirs,
    log,
    tagged_report,
)
from policy import PolicyContext, classify  # noqa: E402

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402


ALPHA = 0.10
FLOOR_MARGIN_TIGHT = 1.05
FLOOR_MARGIN_LOOSE = 1.10


def _wilcoxon(a: np.ndarray, b: np.ndarray) -> dict:
    try:
        from scipy.stats import wilcoxon  # type: ignore
        diff = a - b
        mask = diff != 0
        if mask.sum() < 5:
            return {"pvalue": None, "note": "too_few_nonzero_diffs"}
        stat, p = wilcoxon(a[mask], b[mask])
        return {"stat": float(stat), "pvalue": float(p)}
    except Exception:
        diff = a - b
        return {
            "sign_pos": int((diff > 0).sum()),
            "sign_neg": int((diff < 0).sum()),
            "note": "fallback_sign_test",
        }


def _bootstrap_ci(vals: np.ndarray, fn, n=1000, alpha=0.05) -> tuple[float, float]:
    rng = np.random.default_rng(42)
    out = np.empty(n)
    for i in range(n):
        idx = rng.integers(0, len(vals), len(vals))
        out[i] = fn(vals[idx])
    return float(np.quantile(out, alpha / 2)), float(np.quantile(out, 1 - alpha / 2))


def _load_conformal() -> dict:
    p = V7A_MODELS_DIR / "conformal_mondrian.json"
    return json.loads(p.read_text(encoding="utf-8"))


def _bucket_key(ttd: float, pop: float, std_ratio: float) -> str:
    b_ttd = 0 if ttd <= 7 else 1 if ttd <= 21 else 2 if ttd <= 60 else 3
    b_freq = 0 if pop < 50 else 1 if pop < 500 else 2
    b_vol = 0 if std_ratio < 0.10 else 1 if std_ratio < 0.30 else 2
    return f"{b_ttd}-{b_freq}-{b_vol}"


def _c_for(bucket: str, mondrian: dict, alpha: float) -> float:
    tag = f"alpha_{int(alpha*100):02d}"
    per = mondrian["alpha"].get(tag, {})
    glob = mondrian["global"].get(tag, 0.0)
    return float(per.get(bucket, {"c": glob})["c"])


def _predict_test(test_feats: pd.DataFrame) -> pd.DataFrame:
    feats = sorted([c for c in test_feats.columns if c.startswith("feat_")])
    X = test_feats[feats].astype(np.float32).to_numpy()
    out = {
        "route": test_feats["route"].values,
        "fetched_at": test_feats["fetched_at"].values,
        "price_usd": test_feats["price_usd"].astype(np.float32).to_numpy(),
    }
    # Target A : quantiles du gain
    for q in ("q10", "q50", "q90"):
        with open(V7A_MODELS_DIR / f"lgbm_{q}.pkl", "rb") as f:
            m = pickle.load(f)
        out[f"{q}_gain"] = m.predict(X)
    # Target B : drop proba calibrée
    with open(V7A_MODELS_DIR / "lgbm_drop.pkl", "rb") as f:
        drop_clf = pickle.load(f)
    with open(V7A_MODELS_DIR / "isotonic_drop.pkl", "rb") as f:
        iso_drop = pickle.load(f)
    out["drop_proba_raw"] = drop_clf.predict_proba(X)[:, 1]
    out["drop_proba_calibrated"] = iso_drop.predict(out["drop_proba_raw"])
    df = pd.DataFrame(out)
    df.to_parquet(V7A_MODELS_DIR / "lgbm_test.parquet", index=False)
    return df


def _simulate_decisions(
    test_feats: pd.DataFrame, preds: pd.DataFrame, mondrian: dict, hybrid: bool
) -> pd.DataFrame:
    # depart_date ajouté pour permettre l'évaluation par TRAJECTOIRE
    cols_keep = [
        "route", "fetched_at", "ttd_days", "price_usd",
        "feat_route_popularity", "feat_route_mean_train", "feat_route_std_train",
        "feat_route_known",
    ]
    if "depart_date" in test_feats.columns:
        cols_keep.insert(1, "depart_date")
    df = test_feats[cols_keep].copy()
    df["q10_gain"] = preds["q10_gain"].values
    df["q50_gain"] = preds["q50_gain"].values
    df["q90_gain"] = preds["q90_gain"].values
    df["drop_proba"] = preds["drop_proba_calibrated"].values
    std_ratio = np.where(
        df["feat_route_mean_train"] > 0,
        df["feat_route_std_train"] / np.clip(df["feat_route_mean_train"], 1e-6, None),
        0.0,
    )
    buckets = [
        _bucket_key(float(a), float(b), float(c))
        for a, b, c in zip(df["ttd_days"], df["feat_route_popularity"], std_ratio)
    ]
    c_alpha_gain = np.array([_c_for(b, mondrian, ALPHA) for b in buckets])
    df["c_alpha_gain"] = c_alpha_gain

    # Q10 train route ancre (utilisée seulement en mode hybride)
    train_feats = pd.read_parquet(V7A_FEATURES_DIR / "train.parquet", columns=["route", "price_usd"])
    q10_train_route = train_feats.groupby("route")["price_usd"].quantile(0.10).to_dict()
    df["q10_train_route"] = df["route"].map(q10_train_route).fillna(0.0).astype(float)

    actions = []
    scores_alert = []
    scores_buy = []
    for _, row in df.iterrows():
        ctx = PolicyContext(
            price=float(row["price_usd"]),
            q10_gain=float(row["q10_gain"]),
            q50_gain=float(row["q50_gain"]),
            q90_gain=float(row["q90_gain"]),
            c_alpha_gain=float(row["c_alpha_gain"]),
            drop_proba=float(row["drop_proba"]),
            ttd_days=float(row["ttd_days"]),
            route_known=bool(row["feat_route_known"]),
            route_popularity=int(row["feat_route_popularity"]),
            budget_max=1e6,
            budget_autobuy=1e6,
            autobuy_enabled=False,
            q10_train_route=float(row["q10_train_route"]),
            hybrid_mode=hybrid,
        )
        d = classify(ctx)
        actions.append(d.action)
        scores_alert.append(d.score_alert)
        scores_buy.append(d.score_buy)
    df["v7a_action"] = actions
    df["v7a_score_alert"] = scores_alert
    df["v7a_score_buy"] = scores_buy
    return df


def _eval_buy(df: pd.DataFrame) -> dict:
    """
    Évaluation par TRAJECTOIRE (route, depart_date) — c'est la vraie unité de
    mission utilisateur. Un "JFK-LAX du 2022-05-15" est un trip distinct du
    "JFK-LAX du 2022-05-16", avec son propre floor et ses propres obs dans le
    temps.
    """
    rows = []
    group_cols = ["route", "depart_date"] if "depart_date" in df.columns else ["route"]
    for key, g in df.groupby(group_cols, sort=False):
        g = g.sort_values("fetched_at").reset_index(drop=True)
        p = g["price_usd"].to_numpy()
        if len(p) < 3:
            continue
        buys = g["v7a_action"].isin({"BUY_NOW", "AUTO_BUY"}).to_numpy()
        idx = int(np.argmax(buys)) if buys.any() else len(p) - 1
        rows.append({
            "trip": str(key), "price_paid": float(p[idx]), "floor": float(p.min()),
            "n": int(len(p)),
        })
    rr = pd.DataFrame(rows)
    if rr.empty:
        return {"n": 0}
    reg = np.maximum(rr["price_paid"].values - rr["floor"].values, 0)
    rel = reg / np.clip(rr["floor"].values, 1.0, None)
    cap = np.clip(rr["floor"].values / np.clip(rr["price_paid"].values, 1.0, None), 0, 1)
    ci_lo, ci_hi = _bootstrap_ci(cap, np.median)
    return {
        "n_trips": int(len(rr)),
        "regret_abs_mean": float(np.mean(reg)),
        "regret_abs_p50": float(np.quantile(reg, 0.5)),
        "regret_abs_p90": float(np.quantile(reg, 0.9)),
        "regret_abs_p99": float(np.quantile(reg, 0.99)),
        "regret_rel_mean": float(np.mean(rel)),
        "regret_rel_p50": float(np.quantile(rel, 0.5)),
        "regret_rel_p90": float(np.quantile(rel, 0.9)),
        "capture_mean": float(np.mean(cap)),
        "capture_median": float(np.median(cap)),
        "capture_median_ci95": [ci_lo, ci_hi],
    }


def _eval_alert(df: pd.DataFrame) -> dict:
    """
    Métriques d'alerting HONNÊTES.

    Principe : une alerte est utile si elle est envoyée au client quand
    le prix observé est proche du floor réel de la route (± marge). On
    mesure aussi le REGRET réalisé après l'alerte — si le client achetait
    à ce moment-là, combien paierait-il au-dessus du floor ?

    Current taxonomy: ALERT (unified). ALERT_SOFT/ALERT_STRONG are legacy.
    """
    alerts = df[df["v7a_action"].isin({"ALERT"})].copy()
    total_rows = len(df)
    if alerts.empty:
        return {"n_alerts": 0, "total_rows": total_rows, "alert_rate": 0.0}

    stats = {
        "n_alerts": int(len(alerts)),
        "n_strong": 0,  # legacy, no longer emitted
        "n_soft": 0,    # legacy, no longer emitted
        "total_rows": total_rows,
        "alert_rate": float(len(alerts) / max(1, total_rows)),
    }

    # Floor PAR TRAJECTOIRE (route, depart_date) — pas route seule. Un trip
    # spécifique a son propre minimum de prix, indépendant des autres dates
    # de départ sur la même route.
    has_depart = "depart_date" in df.columns
    if has_depart:
        floor_df = df.groupby(["route", "depart_date"])["price_usd"].min().reset_index()
        floor_df = floor_df.rename(columns={"price_usd": "floor_trip"})
        alerts = alerts.merge(floor_df, on=["route", "depart_date"], how="left")
        alerts["floor"] = alerts["floor_trip"].astype(float)
    else:
        floor_by_route = df.groupby("route")["price_usd"].min().to_dict()
        alerts["floor"] = alerts["route"].map(floor_by_route).astype(float)

    alerts["is_near_floor_1_05"] = alerts["price_usd"] <= alerts["floor"] * FLOOR_MARGIN_TIGHT
    alerts["is_near_floor_1_10"] = alerts["price_usd"] <= alerts["floor"] * FLOOR_MARGIN_LOOSE

    stats["alert_precision_floor_1_05"] = float(alerts["is_near_floor_1_05"].mean())
    stats["alert_precision_floor_1_10"] = float(alerts["is_near_floor_1_10"].mean())
    stats["alert_precision_floor_1_05_strong"] = 0.0  # legacy, ALERT_STRONG no longer emitted

    # Recall par trajectoire
    df_near_floor = df.copy()
    if has_depart:
        df_near_floor = df_near_floor.merge(floor_df, on=["route", "depart_date"], how="left")
        df_near_floor["floor"] = df_near_floor["floor_trip"].astype(float)
    else:
        df_near_floor["floor"] = df_near_floor["route"].map(floor_by_route).astype(float)
    near_floor = df_near_floor[df_near_floor["price_usd"] <= df_near_floor["floor"] * FLOOR_MARGIN_TIGHT]
    if len(near_floor) > 0:
        near_floor_alerted = near_floor["v7a_action"].isin({"ALERT", "BUY_NOW"})
        stats["n_near_floor"] = int(len(near_floor))
        stats["alert_recall_floor_1_05"] = float(near_floor_alerted.mean())
    else:
        stats["n_near_floor"] = 0
        stats["alert_recall_floor_1_05"] = None

    # Regret réalisé après alerte : pour chaque alerte, price_usd_alerte - floor_route
    realized_regret = (alerts["price_usd"] - alerts["floor"]).to_numpy()
    stats["regret_realized_after_alert_mean"] = float(np.mean(realized_regret))
    stats["regret_realized_after_alert_p50"] = float(np.quantile(realized_regret, 0.5))
    stats["regret_realized_after_alert_p90"] = float(np.quantile(realized_regret, 0.9))

    # Legacy alert_precision = conformal_lower hit (gardé pour tracking)
    df_sorted = df.sort_values(["route", "fetched_at"]).reset_index(drop=True)
    idx_by_route = {r: g.index.values for r, g in df_sorted.groupby("route", sort=False)}
    hits_legacy = 0
    too_early = 0
    too_late = 0
    delays = []
    for _, a in alerts.iterrows():
        route = a["route"]
        idxs = idx_by_route.get(route, np.array([]))
        if len(idxs) == 0:
            continue
        pos = df_sorted.loc[idxs]
        t0 = pd.to_datetime(a["fetched_at"])
        future_mask = pd.to_datetime(pos["fetched_at"]) >= t0
        horizon = pos[future_mask].head(50)
        future_prices = horizon["price_usd"].values
        if (future_prices <= a["price_usd"]).any():
            first = int(np.argmax(future_prices <= a["price_usd"]))
            delays.append(
                (pd.to_datetime(horizon.iloc[first]["fetched_at"]) - t0).total_seconds() / 86400.0
            )
            hits_legacy += 1
        if a["ttd_days"] > 45:
            too_early += 1
        if a["ttd_days"] < 3:
            too_late += 1
    stats["alert_precision_legacy_future_lower"] = float(hits_legacy / max(1, stats["n_alerts"]))
    stats["alert_too_early_rate"] = float(too_early / max(1, stats["n_alerts"]))
    stats["alert_too_late_rate"] = float(too_late / max(1, stats["n_alerts"]))
    stats["alert_delay_days_mean"] = float(np.mean(delays)) if delays else None
    stats["alert_delay_days_p50"] = float(np.quantile(delays, 0.5)) if delays else None
    return stats


def _segment_metrics(df: pd.DataFrame) -> dict:
    out = {}
    df = df.copy()
    df["seg_ttd"] = np.where(df["ttd_days"] <= 7, "0-7",
                     np.where(df["ttd_days"] <= 21, "8-21",
                     np.where(df["ttd_days"] <= 60, "22-60", "61+")))
    df["seg_freq"] = np.where(df["feat_route_popularity"] < 50, "sparse",
                      np.where(df["feat_route_popularity"] < 500, "medium", "dense"))
    for col in ("seg_ttd", "seg_freq"):
        seg_out = {}
        for v, g in df.groupby(col, sort=False):
            seg_out[str(v)] = {
                "n": int(len(g)),
                "buy": _eval_buy(g),
                "alert": _eval_alert(g),
            }
        out[col] = seg_out
    return out


def _eval_monitor(df: pd.DataFrame) -> dict:
    """MONITOR metrics — tracked separately from ALERT."""
    monitors = df[df["v7a_action"] == "MONITOR"]
    total_rows = len(df)
    n_monitor = int(len(monitors))
    stats: dict = {
        "n_monitor": n_monitor,
        "monitor_rate": float(n_monitor / max(1, total_rows)),
        "monitor_share": float(n_monitor / max(1, total_rows)),
    }
    if n_monitor > 0 and "drop_proba" in monitors.columns:
        stats["monitor_drop_proba_mean"] = float(monitors["drop_proba"].mean())
    # Near-floor rate for MONITOR rows
    if n_monitor > 0:
        has_depart = "depart_date" in df.columns
        if has_depart:
            floor_df = df.groupby(["route", "depart_date"])["price_usd"].min().reset_index()
            floor_df = floor_df.rename(columns={"price_usd": "floor_trip"})
            mon = monitors.merge(floor_df, on=["route", "depart_date"], how="left")
            mon_floor = mon["floor_trip"].astype(float)
        else:
            floor_by_route = df.groupby("route")["price_usd"].min().to_dict()
            mon_floor = monitors["route"].map(floor_by_route).astype(float)
        near_floor_05 = monitors["price_usd"].values <= mon_floor.values * FLOOR_MARGIN_TIGHT
        stats["monitor_near_floor_1_05_rate"] = float(near_floor_05.mean())
    return stats


def _run_variant(df: pd.DataFrame, variant: str) -> dict:
    buy = _eval_buy(df)
    alert = _eval_alert(df)
    monitor = _eval_monitor(df)
    action_counts = df["v7a_action"].value_counts().to_dict()
    action_distribution = {
        k: {"n": int(v), "share": float(v) / max(1, len(df))}
        for k, v in action_counts.items()
    }
    # Ensure all expected actions present
    for a in ("ABSTAIN", "BUY_NOW", "ALERT", "MONITOR", "WAIT"):
        if a not in action_distribution:
            action_distribution[a] = {"n": 0, "share": 0.0}

    buy_rows = df[df["v7a_action"] == "BUY_NOW"]
    if len(buy_rows):
        triggers = {
            "n_buy": int(len(buy_rows)),
            "share_total": float(len(buy_rows) / max(1, len(df))),
            "q50_gain_plus_c_alpha_mean": float(
                (buy_rows["q50_gain"] + buy_rows["c_alpha_gain"]).mean()
            ),
        }
    else:
        triggers = {"n_buy": 0, "note": "aucun BUY_NOW déclenché"}

    # AUTO_BUY safety diagnostic
    auto_buy_count = int(action_counts.get("AUTO_BUY", 0))
    auto_buy_diagnostic = {
        "auto_buy_emitted_count": auto_buy_count,
        "auto_buy_emitted": auto_buy_count > 0,
    }
    if auto_buy_count > 0:
        auto_buy_diagnostic["warning"] = (
            f"AUTO_BUY emitted {auto_buy_count} times — this should NOT happen "
            "in Phase 1. Investigate policy.py."
        )

    return {
        "variant": variant,
        "buy": buy,
        "alert": alert,
        "monitor": monitor,
        "action_distribution": action_distribution,
        "buy_triggers_diagnostic": triggers,
        "auto_buy_safety": auto_buy_diagnostic,
    }


def main() -> None:
    assert_test_split_not_read(__file__)
    ensure_dirs()

    test_feats = pd.read_parquet(V7A_FEATURES_DIR / "test.parquet")
    # On garde aussi les rows sans target (pas de label disponible) pour
    # pouvoir simuler la policy sur toutes les obs ; mais on loggue le split.
    log("test rows loaded", total=len(test_feats),
        with_target=int(test_feats["target_future_gain"].notna().sum()) if "target_future_gain" in test_feats.columns else None)

    mondrian = _load_conformal()
    preds = _predict_test(test_feats)

    # Deux variantes
    df_ml = _simulate_decisions(test_feats, preds, mondrian, hybrid=False)
    df_hy = _simulate_decisions(test_feats, preds, mondrian, hybrid=True)

    ml_report = _run_variant(df_ml, "v7a_ml_only")
    hy_report = _run_variant(df_hy, "v7a_hybrid")

    baselines_path = tagged_report("baselines")
    baselines = json.loads(baselines_path.read_text(encoding="utf-8")) if baselines_path.exists() else {}

    report = {
        "v7a_ml_only": ml_report,
        "v7a_hybrid": hy_report,
        "baselines": baselines,
        "conformal_alpha": ALPHA,
        "notes": {
            "v7a_ml_only": "Policy basée uniquement sur target A (gain futur) + target B (drop proba).",
            "v7a_hybrid": "Policy + trigger Q10_train_route (fallback baseline) pour comparaison honnête.",
            "alert_precision_legacy_future_lower": "Ancienne métrique — probabilité qu'un prix futur passe sous le prix d'alerte. Surtout mesure la volatilité. Conservée pour comparaison.",
            "alert_precision_floor_1_05": "Vraie métrique — % alertes dans [floor, floor × 1.05].",
            "alert_recall_floor_1_05": "% obs dans [floor, floor × 1.05] qui ont reçu une alerte.",
            "regret_realized_after_alert_mean": "Regret moyen si le client achetait au moment de l'alerte.",
        },
    }
    tagged_report("backtest").write_text(
        json.dumps(report, indent=2, default=float), encoding="utf-8"
    )

    seg_ml = _segment_metrics(df_ml)
    seg_hy = _segment_metrics(df_hy)
    tagged_report("segmented_metrics").write_text(
        json.dumps({"v7a_ml_only": seg_ml, "v7a_hybrid": seg_hy}, indent=2, default=float),
        encoding="utf-8",
    )
    log(
        "backtest done",
        capture_ml=ml_report["buy"].get("capture_median"),
        capture_hy=hy_report["buy"].get("capture_median"),
        alert_prec_floor_ml=ml_report["alert"].get("alert_precision_floor_1_05"),
        alert_prec_floor_hy=hy_report["alert"].get("alert_precision_floor_1_05"),
    )


if __name__ == "__main__":
    main()
