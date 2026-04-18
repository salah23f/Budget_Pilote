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
        df = add_haversine_distance(df)
        df = add_ttd_features(df)
        df = add_route_classification(df)

        # Fill NaN
        df = df.fillna(0)

        out_path = f"{OUTPUT_DIR}/{split}_features.parquet"
        df.to_parquet(out_path, index=False)
        print(f"  Saved {len(df)} rows to {out_path}")
        print(f"  Features ({len(df.columns)}): {list(df.columns)[:15]}...")


def add_haversine_distance(df: pd.DataFrame) -> pd.DataFrame:
    """Add approximate route distance in km via haversine."""
    COORDS = {
        'CDG': (49.01, 2.55), 'LHR': (51.47, -0.46), 'JFK': (40.64, -73.78),
        'LAX': (33.94, -118.41), 'FRA': (50.03, 8.57), 'AMS': (52.31, 4.76),
        'NRT': (35.76, 140.39), 'HND': (35.55, 139.78), 'SIN': (1.36, 103.99),
        'DXB': (25.25, 55.36), 'ICN': (37.46, 126.44), 'BKK': (13.69, 100.75),
        'SYD': (-33.95, 151.18), 'GRU': (-23.43, -46.47), 'EZE': (-34.82, -58.54),
        'MEX': (19.44, -99.07), 'IST': (41.26, 28.74), 'BCN': (41.30, 2.08),
        'FCO': (41.80, 12.25), 'MAD': (40.47, -3.57), 'MUC': (48.35, 11.79),
        'ATH': (37.94, 23.94), 'LIS': (38.77, -9.13), 'DUB': (53.42, -6.27),
        'ORD': (41.97, -87.91), 'SFO': (37.62, -122.38), 'MIA': (25.80, -80.29),
        'BOS': (42.36, -71.01), 'ATL': (33.64, -84.43), 'IAD': (38.95, -77.46),
        'DFW': (32.90, -97.04), 'YYZ': (43.68, -79.63), 'YUL': (45.47, -73.74),
        'CUN': (21.04, -86.87), 'HNL': (21.32, -157.92), 'PEK': (40.08, 116.58),
        'PVG': (31.14, 121.81), 'HKG': (22.31, 113.91), 'DEL': (28.57, 77.10),
        'BOM': (19.09, 72.87), 'CPT': (-33.96, 18.60), 'NBO': (-1.32, 36.93),
        'CMN': (33.37, -7.59), 'RAK': (31.61, -8.04), 'DOH': (25.26, 51.57),
        'TLV': (32.01, 34.89), 'KUL': (2.75, 101.71),
    }

    def haversine(o, d):
        if o not in COORDS or d not in COORDS:
            return 0
        lat1, lon1 = np.radians(COORDS[o])
        lat2, lon2 = np.radians(COORDS[d])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = np.sin(dlat/2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon/2)**2
        return 6371 * 2 * np.arctan2(np.sqrt(a), np.sqrt(1-a))

    if 'origin' in df.columns and 'destination' in df.columns:
        df['route_distance_km'] = df.apply(lambda r: haversine(r['origin'], r['destination']), axis=1)
        df['is_international'] = (df['route_distance_km'] > 500).astype(int)
        df['is_transcontinental'] = (df['route_distance_km'] > 5000).astype(int)
    return df


def add_ttd_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add TTD-derived features if depart_date exists."""
    if 'depart_date' not in df.columns or 'fetched_at' not in df.columns:
        return df

    try:
        dep = pd.to_datetime(df['depart_date'], errors='coerce')
        obs = pd.to_datetime(df['fetched_at'], errors='coerce')
        ttd = (dep - obs).dt.days
        ttd = ttd.clip(lower=0, upper=365)

        df['ttd_days'] = ttd.fillna(30)
        df['ttd_log'] = np.log1p(df['ttd_days'])
        df['ttd_sqrt'] = np.sqrt(df['ttd_days'])

        # TTD buckets
        bins = [0, 7, 14, 30, 60, 90, 150, 365]
        labels = [0, 1, 2, 3, 4, 5, 6]
        df['ttd_bucket'] = pd.cut(df['ttd_days'], bins=bins, labels=labels, include_lowest=True).astype(float).fillna(3)
    except Exception:
        pass

    return df


def add_route_classification(df: pd.DataFrame) -> pd.DataFrame:
    """Add route type classification."""
    INTRA_EUROPE = {'CDG', 'LHR', 'FRA', 'AMS', 'BCN', 'FCO', 'MAD', 'MUC', 'ATH',
                    'LIS', 'DUB', 'BER', 'MXP', 'PRG', 'VIE', 'CPH', 'BUD', 'PMI', 'AGP'}

    if 'origin' in df.columns and 'destination' in df.columns:
        df['is_intra_europe'] = (
            df['origin'].isin(INTRA_EUROPE) & df['destination'].isin(INTRA_EUROPE)
        ).astype(int)

        # Route competition estimate (carrier diversity per route)
        if 'airline' in df.columns:
            route_carriers = df.groupby(['origin', 'destination'])['airline'].nunique().reset_index(name='route_competition')
            df = df.merge(route_carriers, on=['origin', 'destination'], how='left')
            df['route_competition'] = df['route_competition'].fillna(1)

    return df


if __name__ == "__main__":
    main()
