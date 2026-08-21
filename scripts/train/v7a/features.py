"""
v7a/features.py — features causales V7a (shift(1) strict).

Règles dures :
  - AUCUNE feature ne peut inclure la valeur courante dans son agrégat.
  - Les rolling stats sont calculés per-route via `shift(1).rolling(W).fn()`.
  - `route_popularity` et `route_competition` sont calculés sur TRAIN seul
    et mappés sur val/cal/test.
  - `route_mean_usd_quarter` (optionnel, si BTS DB1B présent) est une feature
    STATIQUE. Elle est calculée UNIQUEMENT sur train.

Output : data/features_v7a/{train,val,cal,test}.parquet

Run :
  python3 scripts/train/v7a/features.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _env import (  # noqa: E402
    V7A_FEATURES_DIR,
    V7A_SPLITS_DIR,
    ensure_dirs,
    log,
    write_manifest,
)

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

US_HOLIDAYS = [
    (1, 1), (1, 15), (2, 19), (5, 27), (7, 4), (9, 2),
    (10, 14), (11, 11), (11, 28), (12, 25),
]
PRIMARY_HUBS = {
    "JFK", "LAX", "ORD", "ATL", "DFW", "SFO", "MIA", "EWR",
    "LHR", "CDG", "FRA", "AMS", "DXB", "SIN", "HND", "NRT",
    "ICN", "PEK", "PVG", "HKG", "BKK", "IST", "DOH",
}
COORDS = {
    "CDG": (49.01, 2.55), "LHR": (51.47, -0.46), "JFK": (40.64, -73.78),
    "LAX": (33.94, -118.41), "FRA": (50.03, 8.57), "AMS": (52.31, 4.76),
    "NRT": (35.76, 140.39), "HND": (35.55, 139.78), "SIN": (1.36, 103.99),
    "DXB": (25.25, 55.36), "ICN": (37.46, 126.44), "BKK": (13.69, 100.75),
    "ORD": (41.97, -87.91), "SFO": (37.62, -122.38), "MIA": (25.80, -80.29),
    "BOS": (42.36, -71.01), "ATL": (33.64, -84.43), "IAD": (38.95, -77.46),
    "DFW": (32.90, -97.04), "YYZ": (43.68, -79.63), "EWR": (40.69, -74.17),
    "CUN": (21.04, -86.87), "HNL": (21.32, -157.92),
    "SYD": (-33.95, 151.18), "GRU": (-23.43, -46.47),
    "MAD": (40.47, -3.57), "BCN": (41.30, 2.08),
}


def _days_to_holiday(dt_series: pd.Series) -> pd.Series:
    # causale : c'est une fonction de la date d'observation, pas du futur.
    out = np.empty(len(dt_series), dtype=np.int16)
    dt = pd.to_datetime(dt_series, utc=True).dt.tz_localize(None)
    for i, d in enumerate(dt):
        if pd.isna(d):
            out[i] = 180
            continue
        yr = d.year
        best = 365
        for m, day in US_HOLIDAYS:
            try:
                h = pd.Timestamp(year=yr, month=m, day=day)
                diff = abs((d - h).days)
                if diff < best:
                    best = diff
            except Exception:
                pass
        out[i] = min(best, 365)
    return pd.Series(out, index=dt_series.index, dtype=np.int16)


def _haversine_km(o: str, d: str) -> float:
    if o not in COORDS or d not in COORDS:
        return 0.0
    lat1, lon1 = np.radians(COORDS[o])
    lat2, lon2 = np.radians(COORDS[d])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2) ** 2
    return float(6371.0 * 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a)))


def add_calendar(df: pd.DataFrame) -> pd.DataFrame:
    dt = pd.to_datetime(df["fetched_at"], utc=True)
    df["feat_dow"] = dt.dt.dayofweek.astype(np.int8)
    df["feat_month"] = dt.dt.month.astype(np.int8)
    df["feat_is_weekend"] = (df["feat_dow"] >= 5).astype(np.int8)
    df["feat_doy"] = dt.dt.dayofyear.astype(np.int16)
    df["feat_days_to_holiday"] = _days_to_holiday(df["fetched_at"])
    return df


def add_ttd(df: pd.DataFrame) -> pd.DataFrame:
    ttd = df["ttd_days"].astype(np.float32)
    df["feat_ttd_log"] = np.log1p(ttd).astype(np.float32)
    df["feat_ttd_sqrt"] = np.sqrt(ttd).astype(np.float32)
    df["feat_ttd_bucket"] = np.where(
        ttd <= 7, 0, np.where(ttd <= 21, 1, np.where(ttd <= 60, 2, 3))
    ).astype(np.int8)
    return df


def add_route_static(df: pd.DataFrame) -> pd.DataFrame:
    df["feat_origin_is_hub"] = df["origin"].isin(PRIMARY_HUBS).astype(np.int8)
    df["feat_dest_is_hub"] = df["destination"].isin(PRIMARY_HUBS).astype(np.int8)
    df["feat_route_distance_km"] = df.apply(
        lambda r: _haversine_km(r["origin"], r["destination"]), axis=1
    ).astype(np.float32)
    df["feat_is_international"] = (df["feat_route_distance_km"] > 500).astype(np.int8)
    return df


def add_rolling_causal(df: pd.DataFrame, windows=(7, 14, 30)) -> pd.DataFrame:
    # V7a : shift(1) AVANT rolling — aucun `price_t` n'entre dans le calcul
    # des features à l'instant t.
    df = df.sort_values(["route", "fetched_at"]).reset_index(drop=True)
    grp = df.groupby("route", sort=False)["price_usd"]
    for w in windows:
        df[f"feat_roll_mean_{w}"] = grp.transform(
            lambda s, w=w: s.shift(1).rolling(w, min_periods=1).mean()
        ).astype(np.float32)
        df[f"feat_roll_std_{w}"] = grp.transform(
            lambda s, w=w: s.shift(1).rolling(w, min_periods=2).std()
        ).astype(np.float32)
        df[f"feat_roll_min_{w}"] = grp.transform(
            lambda s, w=w: s.shift(1).rolling(w, min_periods=1).min()
        ).astype(np.float32)
        df[f"feat_roll_max_{w}"] = grp.transform(
            lambda s, w=w: s.shift(1).rolling(w, min_periods=1).max()
        ).astype(np.float32)

    eps = 1.0
    df["feat_price_vs_min_14"] = (
        (df["price_usd"] - df["feat_roll_min_14"]) / df["feat_roll_min_14"].clip(lower=eps)
    ).astype(np.float32)
    df["feat_price_vs_mean_14"] = (
        (df["price_usd"] - df["feat_roll_mean_14"]) / df["feat_roll_mean_14"].clip(lower=eps)
    ).astype(np.float32)
    df["feat_z_14"] = (
        (df["price_usd"] - df["feat_roll_mean_14"]) / df["feat_roll_std_14"].clip(lower=eps)
    ).astype(np.float32)
    return df


def add_log_return(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values(["route", "fetched_at"]).reset_index(drop=True)
    log_price = np.log(df["price_usd"].clip(lower=1))
    df["feat_log_return"] = (
        df.assign(_lp=log_price).groupby("route", sort=False)["_lp"].diff().astype(np.float32)
    )
    df["feat_realized_vol_30"] = df.groupby("route", sort=False)["feat_log_return"].transform(
        lambda s: s.shift(1).rolling(30, min_periods=5).std()
    ).astype(np.float32)
    return df


def compute_train_only_maps(train: pd.DataFrame) -> dict:
    pop = train.groupby("route").size().rename("feat_route_popularity").astype(np.int32)
    comp = (
        train.groupby(["origin", "destination"])["airline"]
        .nunique()
        .rename("feat_route_competition")
        .astype(np.int16)
    )
    route_mean = train.groupby("route")["price_usd"].mean().rename("feat_route_mean_train")
    route_std = train.groupby("route")["price_usd"].std().rename("feat_route_std_train")
    return {
        "pop": pop.to_dict(),
        "comp": comp.to_dict(),
        "route_mean": route_mean.to_dict(),
        "route_std": route_std.to_dict(),
    }


def apply_train_only_maps(df: pd.DataFrame, maps: dict) -> pd.DataFrame:
    df["feat_route_popularity"] = df["route"].map(maps["pop"]).fillna(0).astype(np.int32)
    comp_key = list(zip(df["origin"], df["destination"]))
    df["feat_route_competition"] = (
        pd.Series(comp_key).map(maps["comp"]).fillna(1).astype(np.int16).values
    )
    df["feat_route_mean_train"] = df["route"].map(maps["route_mean"]).astype(np.float32)
    df["feat_route_std_train"] = df["route"].map(maps["route_std"]).astype(np.float32)
    df["feat_route_known"] = df["feat_route_popularity"].gt(0).astype(np.int8)
    return df


def build_features_for(df: pd.DataFrame, maps: dict) -> pd.DataFrame:
    df = df.copy()
    df = add_calendar(df)
    df = add_ttd(df)
    df = add_route_static(df)
    df = add_rolling_causal(df)
    df = add_log_return(df)
    df = apply_train_only_maps(df, maps)
    # fillna conservateur — pas de 0 sur les features qui ont une notion "null"
    for c in df.columns:
        if c.startswith("feat_") and df[c].dtype.kind in "fc":
            df[c] = df[c].fillna(0.0)
    return df


def main() -> None:
    ensure_dirs()
    splits = {}
    for name in ("train", "val", "cal", "test"):
        p = V7A_SPLITS_DIR / f"{name}.parquet"
        if not p.exists():
            raise SystemExit(f"{p} missing — run split.py first")
        splits[name] = pd.read_parquet(p)

    maps = compute_train_only_maps(splits["train"])
    log("train-only maps ready", routes=len(maps["pop"]))

    for name, df in splits.items():
        feats = build_features_for(df, maps)
        out = V7A_FEATURES_DIR / f"{name}.parquet"
        feats.to_parquet(out, index=False)
        log(f"features/{name}", rows=len(feats), cols=len(feats.columns), path=str(out))

    write_manifest(
        V7A_FEATURES_DIR / "features_meta.json",
        {
            "step": "features",
            "feature_list": sorted(
                [c for c in build_features_for(splits["train"].head(1000), maps).columns if c.startswith("feat_")]
            ),
            "train_rows": int(len(splits["train"])),
            "val_rows": int(len(splits["val"])),
            "cal_rows": int(len(splits["cal"])),
            "test_rows": int(len(splits["test"])),
        },
    )


if __name__ == "__main__":
    main()
