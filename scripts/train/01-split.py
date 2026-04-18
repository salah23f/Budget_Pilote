"""
01-split.py — Time-series train/val/test split (no leakage).

Strategy (real data):
  - Train: 2015-01-01 → 2023-12-31 (9 years)
  - Val:   2024-01-01 → 2024-06-30 (6 months)
  - Test:  2024-07-01 → 2024-12-31 (6 months, NEVER touched during training)

Split by observed_at date (NOT by route). All routes appear in all splits.

If Supabase has < 100 real samples, generates synthetic data for smoke test.

Usage: python scripts/train/01-split.py
"""

import os
import json
import sys
from datetime import datetime

import pandas as pd
import numpy as np

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
OUTPUT_DIR = "data/splits"

TRAIN_END = "2024-01-01"
VAL_END = "2024-07-01"


def fetch_from_supabase():
    """Fetch all real price samples from Supabase."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("WARNING: Supabase not configured. Using synthetic data.")
        return None

    try:
        from supabase import create_client
        client = create_client(SUPABASE_URL, SUPABASE_KEY)

        # Fetch real_price_samples (with TTD)
        print("Fetching real_price_samples...")
        response = client.table("real_price_samples").select("*").limit(500000).execute()
        samples = response.data or []
        print(f"  Got {len(samples)} real_price_samples")

        # Fetch real_aggregated_fares (without exact TTD)
        print("Fetching real_aggregated_fares...")
        response2 = client.table("real_aggregated_fares").select("*").limit(500000).execute()
        fares = response2.data or []
        print(f"  Got {len(fares)} real_aggregated_fares")

        # Combine: normalize to a common schema
        rows = []
        for s in samples:
            rows.append({
                "origin": s.get("origin", ""),
                "destination": s.get("destination", ""),
                "price_usd": float(s.get("price_usd", 0)),
                "airline": s.get("airline", "Unknown"),
                "stops": int(s.get("stops", 0)),
                "duration_minutes": int(s.get("duration_minutes", 0) or 0),
                "source": s.get("source", "unknown"),
                "fetched_at": s.get("fetched_at", s.get("created_at", "")),
                "depart_date": s.get("depart_date", ""),
                "has_ttd": True,
            })

        for f in fares:
            if f.get("avg_fare_usd") and float(f.get("avg_fare_usd", 0)) > 0:
                # Create a synthetic observation date from year+quarter
                year = int(f.get("year", 2023))
                quarter = int(f.get("quarter", 1))
                month = (quarter - 1) * 3 + 2  # mid-quarter
                obs_date = f"{year}-{month:02d}-15T00:00:00Z"

                rows.append({
                    "origin": f.get("origin", ""),
                    "destination": f.get("destination", ""),
                    "price_usd": float(f.get("avg_fare_usd", 0)),
                    "airline": "Aggregated",
                    "stops": 0,
                    "duration_minutes": 0,
                    "source": f.get("source", "unknown"),
                    "fetched_at": obs_date,
                    "depart_date": "",
                    "has_ttd": False,
                })

        if len(rows) > 0:
            return pd.DataFrame(rows)

    except Exception as e:
        print(f"WARNING: Supabase fetch failed: {e}")

    return None


def generate_synthetic(n_routes=50, days_per_route=365):
    """Generate synthetic flight price data for smoke test."""
    print(f"Generating synthetic data: {n_routes} routes x {days_per_route} days...")
    np.random.seed(42)

    routes = [
        ("CDG", "JFK"), ("LHR", "LAX"), ("FRA", "NRT"), ("AMS", "SIN"),
        ("CDG", "NRT"), ("LHR", "JFK"), ("CDG", "BCN"), ("LHR", "DXB"),
        ("JFK", "LAX"), ("ORD", "LHR"), ("SFO", "HND"), ("BOS", "LIS"),
        ("CDG", "IST"), ("AMS", "BCN"), ("FRA", "BKK"), ("LHR", "BOM"),
        ("JFK", "CUN"), ("LAX", "HNL"), ("CDG", "ATH"), ("MIA", "BOG"),
        ("CDG", "RAK"), ("LHR", "CPT"), ("CDG", "CMN"), ("JFK", "SJU"),
        ("SFO", "ICN"), ("LAX", "SYD"), ("ORD", "FCO"), ("CDG", "DXB"),
        ("LHR", "SIN"), ("AMS", "NRT"), ("FRA", "JFK"), ("MAD", "EZE"),
        ("BCN", "TLV"), ("CDG", "MEX"), ("LHR", "YYZ"), ("CDG", "GRU"),
        ("JFK", "BCN"), ("LAX", "NRT"), ("IAD", "CDG"), ("DUB", "JFK"),
        ("CDG", "PEK"), ("LHR", "KUL"), ("AMS", "IST"), ("FRA", "ORD"),
        ("CDG", "TUN"), ("LHR", "NBO"), ("AMS", "BKK"), ("JFK", "DUB"),
        ("CDG", "ALG"), ("LHR", "DEL"),
    ][:n_routes]

    rows = []
    base_date = datetime(2022, 1, 1)

    for origin, dest in routes:
        base_price = np.random.uniform(150, 900)
        kappa = np.random.uniform(0.02, 0.06)
        sigma = base_price * np.random.uniform(0.01, 0.03)

        log_price = np.log(base_price)
        log_mu = np.log(base_price)

        for d in range(days_per_route):
            dt = base_date + pd.Timedelta(days=d)

            # OU process
            log_price += kappa * (log_mu - log_price) + sigma / base_price * np.random.normal()

            # Seasonal
            month_mult = [0.92, 0.90, 0.95, 0.98, 1.0, 1.08, 1.15, 1.12, 1.02, 0.95, 0.93, 1.05]
            log_price += np.log(month_mult[dt.month - 1]) * 0.03

            # Jump (mistake fare)
            if np.random.random() < 0.005:
                log_price -= np.random.uniform(0.2, 0.5)

            price = max(base_price * 0.3, np.exp(log_price))

            rows.append({
                "origin": origin,
                "destination": dest,
                "price_usd": round(price, 2),
                "airline": np.random.choice(["Air France", "Delta", "United", "Lufthansa", "BA", "Emirates"]),
                "stops": np.random.choice([0, 0, 0, 1, 1, 2], p=[0.4, 0.2, 0.1, 0.15, 0.1, 0.05]),
                "duration_minutes": int(np.random.uniform(120, 900)),
                "source": "synthetic",
                "fetched_at": dt.isoformat(),
                "depart_date": (dt + pd.Timedelta(days=30 + d % 90)).strftime("%Y-%m-%d"),
                "has_ttd": True,
            })

    return pd.DataFrame(rows)


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Try Supabase first
    df = fetch_from_supabase()

    if df is None or len(df) < 100:
        print(f"Real data insufficient ({len(df) if df is not None else 0} rows). Generating synthetic...")
        df = generate_synthetic()

    print(f"\nTotal data: {len(df)} rows")
    print(f"Sources: {df['source'].value_counts().to_dict()}")

    # Parse dates
    df["fetched_at"] = pd.to_datetime(df["fetched_at"], errors="coerce", utc=True)
    df = df.dropna(subset=["fetched_at", "price_usd"])
    df = df[df["price_usd"] > 0]

    print(f"After cleaning: {len(df)} rows")
    print(f"Date range: {df['fetched_at'].min()} to {df['fetched_at'].max()}")

    # Split by date
    train_cutoff = pd.Timestamp(TRAIN_END, tz="UTC")
    val_cutoff = pd.Timestamp(VAL_END, tz="UTC")

    train = df[df["fetched_at"] < train_cutoff]
    val = df[(df["fetched_at"] >= train_cutoff) & (df["fetched_at"] < val_cutoff)]
    test = df[df["fetched_at"] >= val_cutoff]

    # Fallback: percentage split if date-based split is too uneven
    if len(train) < 50 or len(val) < 10:
        print("Date-based split too uneven. Using 70/15/15 percentage split.")
        df = df.sort_values("fetched_at")
        n = len(df)
        train = df.iloc[:int(n * 0.7)]
        val = df.iloc[int(n * 0.7):int(n * 0.85)]
        test = df.iloc[int(n * 0.85):]

    # Save
    train.to_parquet(f"{OUTPUT_DIR}/train.parquet", index=False)
    val.to_parquet(f"{OUTPUT_DIR}/val.parquet", index=False)
    test.to_parquet(f"{OUTPUT_DIR}/test.parquet", index=False)

    summary = {
        "train_rows": len(train),
        "val_rows": len(val),
        "test_rows": len(test),
        "total_rows": len(df),
        "date_range": f"{df['fetched_at'].min()} to {df['fetched_at'].max()}",
        "sources": df["source"].value_counts().to_dict(),
        "routes": int(df.apply(lambda r: f"{r['origin']}-{r['destination']}", axis=1).nunique()),
        "has_real_data": "synthetic" not in df["source"].values,
        "split_method": "date" if len(train) >= 50 else "percentage",
    }

    with open(f"{OUTPUT_DIR}/split_summary.json", "w") as f:
        json.dump(summary, f, indent=2, default=str)

    print(f"\n{'='*50}")
    print(f"Train: {len(train):,} rows")
    print(f"Val:   {len(val):,} rows")
    print(f"Test:  {len(test):,} rows")
    print(f"Routes: {summary['routes']}")
    print(f"Real data: {summary['has_real_data']}")
    print(f"Saved to {OUTPUT_DIR}/")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
