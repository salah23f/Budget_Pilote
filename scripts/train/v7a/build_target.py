"""
v7a/build_target.py — construit les targets décisionnelles V7a.

Target A (régression quantile) — `target_future_gain`
    y = min(p_{t+1..t+k(ttd)}) - p_t   mais par TRAJECTOIRE (route × depart_date)
    - y < 0  : le prix va baisser → attendre
    - y ≥ 0  : aucun gain d'attente → acheter
    - LGBM apprend q10/q50/q90 de cette quantité

Target B (classif binaire) — `target_future_drop`
    y = 1[ ∃ p' ∈ fenêtre : p' ≤ p_t × (1 − 0.10) ]

Définition de la TRAJECTOIRE (important) :
  Une "trajectoire" V7a est le tuple (origin, destination, depart_date),
  i.e. UN vol spécifique recherché à différents searchDates. C'est la bonne
  granularité pour un problème de décision buy/wait : l'utilisateur décide
  pour UN voyage précis (dates fixées), pas pour une route générique qui
  contient plein de depart_dates hétérogènes.

Fenêtre adaptative `k(ttd)` :
  TTD ≤ 7      → k = min(TTD, 3)
  TTD 8-21     → k = 7
  TTD 22-60    → k = 14
  TTD > 60     → k = 30

Causalité : la fenêtre ne regarde que les obs FUTURES de la même
trajectoire DANS LE MÊME SPLIT. Aucun cross-split.

Input  : data/features_v7a_<tag>/{train,val,cal,test}.parquet
         (doit contenir `depart_date` — déjà le cas via build_dataset + features)
Output : ré-écrit ces parquets avec 4 colonnes ajoutées :
  - target_future_min    (float32, USD ; NaN si window vide)
  - target_future_gain   (float32, USD ; NaN si window vide)
  - target_future_drop   (float32 0/1 ; NaN si window vide)
  - target_window_k      (int16 ; taille effective demandée)

Rapport dans tagged_report("target_build").

Run :
  python3 scripts/train/v7a/build_target.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _env import V7A_FEATURES_DIR, ensure_dirs, log, tagged_report  # noqa: E402

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402


THETA_DROP = 0.10  # 10% drop threshold for target B


def _window_k(ttd: np.ndarray) -> np.ndarray:
    """Fenêtre de forecast adaptative selon TTD courant."""
    k = np.where(
        ttd <= 7, np.minimum(ttd, 3),
        np.where(ttd <= 21, 7, np.where(ttd <= 60, 14, 30)),
    )
    return k.astype(np.int16)


def _build_for_split(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """
    Construit future_min / future_gain / future_drop par trajectoire
    (route, depart_date) avec forward-window k(ttd).
    """
    if "depart_date" not in df.columns:
        raise SystemExit("features parquet missing `depart_date` — regenerate features")

    # Tri strict par trajectoire puis fetched_at
    df = df.sort_values(["route", "depart_date", "fetched_at"]).reset_index(drop=True)
    n = len(df)

    prices = df["price_usd"].to_numpy(dtype=np.float64)
    ttd = df["ttd_days"].to_numpy(dtype=np.float64)
    # Représentation canonique : **jours depuis epoch UTC** (int64). On évite
    # ainsi les ennuis de tz / timedelta unit mismatch avec numpy.
    dt_naive = pd.to_datetime(df["fetched_at"], utc=True).dt.tz_convert(None)
    fetched_days = (dt_naive.astype("int64") // 86_400_000_000_000).to_numpy()

    k_window = _window_k(ttd)

    future_min = np.full(n, np.nan, dtype=np.float64)
    future_drop = np.full(n, np.nan, dtype=np.float64)

    # Group by (route, depart_date) — chaque groupe = une trajectoire
    gb = df.groupby(["route", "depart_date"], sort=False)

    total_ok = 0
    incomplete = 0
    n_singleton_traj = 0

    for _key, grp_df in gb:
        idx = grp_df.index.to_numpy()
        n_grp = len(idx)
        if n_grp < 2:
            n_singleton_traj += 1
            incomplete += n_grp
            continue

        grp_times = fetched_days[idx]         # int64, déjà trié (sort asc)
        grp_prices = prices[idx]
        grp_k = k_window[idx].astype(np.int64)

        # j_lo[i] = premier j tel que grp_times[j] > grp_times[i] (skip ties)
        j_lo_vec = np.searchsorted(grp_times, grp_times, side="right")
        # j_hi[i] = premier j tel que grp_times[j] > grp_times[i] + k_i jours
        deadlines = grp_times + grp_k
        j_hi_vec = np.searchsorted(grp_times, deadlines, side="right")

        for local_i in range(n_grp):
            j_lo = int(j_lo_vec[local_i])
            j_hi = int(j_hi_vec[local_i])
            if j_hi <= j_lo:
                incomplete += 1
                continue
            window = grp_prices[j_lo:j_hi]
            if window.size == 0:
                incomplete += 1
                continue
            fmin = float(window.min())
            gi = idx[local_i]
            future_min[gi] = fmin
            future_drop[gi] = 1.0 if fmin <= prices[gi] * (1.0 - THETA_DROP) else 0.0
            total_ok += 1

    df["target_future_min"] = future_min.astype(np.float32)
    df["target_future_gain"] = (future_min - prices).astype(np.float32)
    df["target_future_drop"] = future_drop.astype(np.float32)
    df["target_window_k"] = k_window

    stats = {
        "rows": int(n),
        "rows_with_target": int(total_ok),
        "rows_incomplete": int(incomplete),
        "singleton_trajectories": int(n_singleton_traj),
        "coverage_pct": round(100.0 * total_ok / max(1, n), 2),
        "n_trajectories": int(len(gb)),
    }
    log("target built", **stats)
    return df, stats


def main() -> None:
    ensure_dirs()
    coverage_report: dict = {}
    for name in ("train", "val", "cal", "test"):
        p = V7A_FEATURES_DIR / f"{name}.parquet"
        if not p.exists():
            raise SystemExit(f"{p} missing — run features.py first")
        log(f"building target for {name}")
        df = pd.read_parquet(p)
        df, stats = _build_for_split(df)
        df.to_parquet(p, index=False)
        coverage_report[name] = stats

        mask = df["target_future_gain"].notna()
        if mask.any():
            gains = df.loc[mask, "target_future_gain"].to_numpy()
            drops = df.loc[mask, "target_future_drop"].to_numpy()
            coverage_report[name].update(
                {
                    "target_future_gain_mean": float(np.mean(gains)),
                    "target_future_gain_median": float(np.median(gains)),
                    "target_future_gain_p10": float(np.quantile(gains, 0.10)),
                    "target_future_gain_p90": float(np.quantile(gains, 0.90)),
                    "target_future_drop_rate": float(np.mean(drops)),
                }
            )

    tagged_report("target_build").write_text(
        json.dumps(coverage_report, indent=2, default=float), encoding="utf-8"
    )
    log("target build report", path=str(tagged_report("target_build")))


if __name__ == "__main__":
    main()
