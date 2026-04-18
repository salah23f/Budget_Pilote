"""
02-features.py — Feature engineering for V7 training.

Input: data/splits/train.parquet
Output: data/features/train_features.parquet

Features computed:
  - Rolling stats (7d, 14d, 30d): mean, std, min, max, z-score
  - Day-of-week, month, is_weekend
  - TTD buckets (7, 14, 30, 60, 90, 120+)
  - Holiday proximity (US federal holidays)
  - Carrier type (LCC, full-service, ultra-LCC)
  - Hub tier (primary, secondary, regional)
  - Log-returns, volatility
  - Route popularity (total observations)
"""

import os
import pandas as pd
import numpy as np
from datetime import datetime

INPUT_DIR = "data/splits"
OUTPUT_DIR = "data/features"

US_HOLIDAYS = [
    (1, 1), (1, 15), (2, 19), (5, 27), (7, 4), (9, 2),
    (10, 14), (11, 11), (11, 28), (12, 25),
]

PRIMARY_HUBS = {"JFK", "LAX", "ORD", "ATL", "DFW", "SFO", "MIA", "EWR",
                "LHR", "CDG", "FRA", "AMS", "DXB", "SIN", "HND", "NRT",
                "ICN", "PEK", "PVG", "HKG", "BKK", "IST", "DOH"}

LCC_CARRIERS = {"RYANAIR", "EASYJET", "SPIRIT", "FRONTIER", "WIZZ", "VUELING",
                "VOLARIS", "JETSTAR", "AIRASIA", "CEBU", "INDIGO", "SCOOT"}


def add_rolling_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add rolling statistics per route."""
    df = df.sort_values(["origin", "destination", "fetched_at"])

    for window in [7, 14, 30]:
        col = f"rolling_{window}d"
        df[f"{col}_mean"] = df.groupby(["origin", "destination"])["price_usd"].transform(
            lambda x: x.rolling(window, min_periods=1).mean()
        )
        df[f"{col}_std"] = df.groupby(["origin", "destination"])["price_usd"].transform(
            lambda x: x.rolling(window, min_periods=2).std()
        )
        df[f"{col}_min"] = df.groupby(["origin", "destination"])["price_usd"].transform(
            lambda x: x.rolling(window, min_periods=1).min()
        )
        df[f"{col}_max"] = df.groupby(["origin", "destination"])["price_usd"].transform(
            lambda x: x.rolling(window, min_periods=1).max()
        )

    # Z-score vs rolling 30d
    df["z_score_30d"] = (df["price_usd"] - df["rolling_30d_mean"]) / df["rolling_30d_std"].clip(lower=1)

    return df


def add_temporal_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add time-based features."""
    dt = pd.to_datetime(df["fetched_at"])
    df["dow"] = dt.dt.dayofweek
    df["month"] = dt.dt.month
    df["is_weekend"] = df["dow"].isin([5, 6]).astype(int)
    df["hour"] = dt.dt.hour

    # Holiday proximity (days to nearest US holiday)
    def days_to_holiday(date):
        year = date.year
        min_dist = 365
        for m, d in US_HOLIDAYS:
            try:
                hol = datetime(year, m, d)
                dist = abs((date - hol).days)
                min_dist = min(min_dist, dist)
            except ValueError:
                pass
        return min_dist

    df["days_to_holiday"] = dt.apply(days_to_holiday)

    return df


def add_route_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add route-level features."""
    # Hub tier
    df["origin_is_hub"] = df["origin"].isin(PRIMARY_HUBS).astype(int)
    df["dest_is_hub"] = df["destination"].isin(PRIMARY_HUBS).astype(int)

    # Carrier type
    carrier_upper = df["airline"].fillna("").str.upper()
    df["is_lcc"] = carrier_upper.apply(lambda x: int(any(lcc in x for lcc in LCC_CARRIERS)))

    # Route popularity
    route_counts = df.groupby(["origin", "destination"]).size().reset_index(name="route_popularity")
    df = df.merge(route_counts, on=["origin", "destination"], how="left")

    return df


def add_log_returns(df: pd.DataFrame) -> pd.DataFrame:
    """Add log-return features."""
    df = df.sort_values(["origin", "destination", "fetched_at"])
    df["log_price"] = np.log(df["price_usd"].clip(lower=1))
    df["log_return"] = df.groupby(["origin", "destination"])["log_price"].diff()
    df["abs_log_return"] = df["log_return"].abs()

    # Realized volatility (30d rolling)
    df["realized_vol_30d"] = df.groupby(["origin", "destination"])["log_return"].transform(
        lambda x: x.rolling(30, min_periods=5).std()
    )

    return df


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    for split in ["train", "val", "test"]:
        path = f"{INPUT_DIR}/{split}.parquet"
        if not os.path.exists(path):
            print(f"Skipping {split} — file not found")
            continue

        print(f"Processing {split}...")
        df = pd.read_parquet(path)

        if "price_usd" not in df.columns:
            print(f"  No price_usd column, skipping")
            continue

        df = add_rolling_features(df)
        df = add_temporal_features(df)
        df = add_route_features(df)
        df = add_log_returns(df)

        # Fill NaN
        df = df.fillna(0)

        out_path = f"{OUTPUT_DIR}/{split}_features.parquet"
        df.to_parquet(out_path, index=False)
        print(f"  Saved {len(df)} rows to {out_path}")
        print(f"  Features: {list(df.columns)}")


if __name__ == "__main__":
    main()
