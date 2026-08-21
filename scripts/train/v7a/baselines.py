"""
v7a/baselines.py — baselines de référence avant tout modèle.

Baselines calculées sur test hold-out :
  - buy_now            : paie le premier prix observé dans la fenêtre mission
  - fixed_horizon_14   : paie à TTD=14 (closest observation)
  - rolling_min_30     : buy si p_t ≤ min(p_{t-30..t-1}) (shift-causal)
  - simple_quantile_10 : buy si p_t ≤ Q10(prix_train_route)
  - v1_heuristique     : reprise approximative de lib/agent/predictor.ts
                         (z-score + percentile + TTD)

Métriques :
  - regret_$_mean/p50/p90/p99
  - regret_%_mean/p50/p90
  - capture_mean/median
  - economic_gain_vs_buy_now_mean

Output : reports/v7a_baselines.json

Run :
  python3 scripts/train/v7a/baselines.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _env import V7A_FEATURES_DIR, ensure_dirs, log, tagged_report  # noqa: E402

# Buckets TTD alignés avec scripts/train/v7a/backtest.py::_segment_metrics.
# Segmentation par OBSERVATION (row), pas par trip : un trip dont la fenêtre
# traverse plusieurs buckets peut apparaître dans plusieurs segments, chaque
# apparition se limitant à ses obs dans ce bucket précis.
TTD_BUCKETS: list[tuple[str, int, int]] = [
    ("0-7", 0, 7),
    ("8-21", 8, 21),
    ("22-60", 22, 60),
    ("61+", 61, 9999),
]

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402


def _regret_series(price_paid: np.ndarray, floor: np.ndarray) -> dict:
    reg = price_paid - floor
    reg = np.clip(reg, 0.0, None)
    reg_pct = reg / np.clip(floor, 1.0, None)
    cap = np.clip(floor / np.clip(price_paid, 1.0, None), 0.0, 1.0)
    return {
        "regret_abs_mean": float(np.mean(reg)),
        "regret_abs_p50": float(np.quantile(reg, 0.50)),
        "regret_abs_p90": float(np.quantile(reg, 0.90)),
        "regret_abs_p99": float(np.quantile(reg, 0.99)),
        "regret_rel_mean": float(np.mean(reg_pct)),
        "regret_rel_p50": float(np.quantile(reg_pct, 0.50)),
        "regret_rel_p90": float(np.quantile(reg_pct, 0.90)),
        "capture_mean": float(np.mean(cap)),
        "capture_median": float(np.median(cap)),
        "n": int(len(price_paid)),
    }


def _apply_per_trip(
    df: pd.DataFrame, policy_fn, train_stats: dict[str, dict] | None = None
) -> dict:
    """
    Évaluation par TRAJECTOIRE (route, depart_date) — un trip = un voyage
    utilisateur spécifique avec sa propre série de prix dans le temps.

    policy_fn(prices, ttds, route, train_stats) -> index d'achat.
    """
    group_cols = ["route", "depart_date"] if "depart_date" in df.columns else ["route"]
    df = df.sort_values(group_cols + ["fetched_at"]).reset_index(drop=True)
    price_paid = []
    floor = []
    for key, g in df.groupby(group_cols, sort=False):
        p = g["price_usd"].to_numpy(dtype=np.float64)
        t = g["ttd_days"].to_numpy(dtype=np.float64)
        if len(p) < 3:
            continue
        # `route` passé à policy_fn reste la route (première composante
        # du tuple si groupby multi-col)
        route = key[0] if isinstance(key, tuple) else key
        idx = policy_fn(p, t, route, train_stats)
        idx = int(max(0, min(len(p) - 1, idx)))
        price_paid.append(float(p[idx]))
        floor.append(float(p.min()))
    return _regret_series(np.asarray(price_paid), np.asarray(floor))


# ---------- policies ----------

def policy_buy_now(p, t, route, s):
    return 0


def policy_fixed_14(p, t, route, s):
    # achète à l'observation la plus proche de TTD=14
    k = int(np.argmin(np.abs(t - 14)))
    return k


def policy_rolling_min_30(p, t, route, s):
    # buy si p_i ≤ min(p_{i-30..i-1})
    for i in range(1, len(p)):
        window = p[max(0, i - 30) : i]
        if window.size == 0:
            continue
        if p[i] <= window.min():
            return i
    return len(p) - 1


def policy_simple_quantile(p, t, route, s):
    q10 = (s.get("q10_per_route", {}) if s else {}).get(route)
    if q10 is None:
        return 0
    for i in range(len(p)):
        if p[i] <= q10:
            return i
    return len(p) - 1


def policy_v1(p, t, route, s):
    # mini heuristique alignée sur lib/agent/predictor.ts
    for i in range(len(p)):
        if i < 5:
            if t[i] < 14:
                return i
            continue
        window = p[:i]
        mu, sd = window.mean(), window.std()
        if sd <= 0:
            sd = 1.0
        z = (p[i] - mu) / sd
        pct = np.mean(window <= p[i]) * 100
        score = (
            (0.4 if z <= -0.8 else (0.4 * (-z / 0.8) if z < 0 else -0.4 * (z / 0.6) if z < 0.6 else -0.4))
            + (0.25 if pct <= 20 else (-0.25 if pct >= 70 else 0))
            + (0.15 if t[i] < 7 else (0.1 if t[i] < 14 else (-0.05 if t[i] > 60 else 0)))
        )
        if score >= 0.4:
            return i
    return len(p) - 1


def policy_ensemble_ttd_switch(p, t, route, s):
    """
    Baseline composée (zero-ML) :
      - TTD ≤ 7  → règle rolling_min_30 (buy si p[i] ≤ min des 30 obs précédentes)
      - TTD > 7  → règle simple_quantile_10 (buy si p[i] ≤ Q10(train_route))

    Motivation : sur l'eval par trajectoire, rolling_min_30 domine sur
    TTD 0-7 (0.9496) et simple_quantile_10 domine sur TTD 22-60 (0.9127).
    On combine les deux par bucket TTD pour obtenir la vraie barre baseline
    à battre avant d'affirmer qu'un modèle ML apporte de la valeur.
    """
    q10 = (s.get("q10_per_route", {}) if s else {}).get(route)
    for i in range(len(p)):
        ttd_i = float(t[i])
        if ttd_i <= 7:
            # rolling_min_30 rule
            if i >= 1:
                window = p[max(0, i - 30) : i]
                if window.size > 0 and p[i] <= window.min():
                    return i
        else:
            # simple_quantile_10 rule
            if q10 is not None and p[i] <= q10:
                return i
    return len(p) - 1


def main() -> None:
    ensure_dirs()
    train = pd.read_parquet(V7A_FEATURES_DIR / "train.parquet")
    test = pd.read_parquet(V7A_FEATURES_DIR / "test.parquet")

    q10_map = train.groupby("route")["price_usd"].quantile(0.10).to_dict()
    stats = {"q10_per_route": q10_map}

    policies = [
        ("buy_now", policy_buy_now),
        ("fixed_horizon_14", policy_fixed_14),
        ("rolling_min_30", policy_rolling_min_30),
        ("simple_quantile_10", policy_simple_quantile),
        ("v1_heuristic", policy_v1),
        ("ensemble_ttd_switch", policy_ensemble_ttd_switch),
    ]

    results: dict = {}
    for name, fn in policies:
        m_global = _apply_per_trip(test, fn, stats)
        by_ttd: dict = {}
        for label, lo, hi in TTD_BUCKETS:
            seg = test[(test["ttd_days"] >= lo) & (test["ttd_days"] <= hi)]
            if len(seg) == 0:
                by_ttd[label] = {"n_trips": 0, "note": "empty segment"}
                continue
            m_seg = _apply_per_trip(seg, fn, stats)
            by_ttd[label] = m_seg
        results[name] = {"global": m_global, "by_ttd": by_ttd}
        log(
            f"baseline {name}",
            capture_median=round(m_global.get("capture_median", 0.0), 4),
            **{
                f"cap_{lbl}": round(by_ttd[lbl].get("capture_median", 0.0), 4)
                if "capture_median" in by_ttd[lbl] else "empty"
                for lbl, _, _ in TTD_BUCKETS
            },
        )

    # gain économique vs buy_now (global)
    bn = results["buy_now"]["global"]["regret_abs_mean"]
    for name, block in results.items():
        block["global"]["economic_gain_vs_buy_now_mean"] = round(
            bn - block["global"]["regret_abs_mean"], 4
        )

    out = tagged_report("baselines")
    out.write_text(json.dumps(results, indent=2), encoding="utf-8")
    log("baselines report", path=str(out))


if __name__ == "__main__":
    main()
