"""
01-split.py — Time-series train/val/test split (no leakage).

Strategy:
  - Train: all data before 2024-Q3
  - Val: 2024-Q3
  - Test: 2024-Q4+

Usage: python scripts/train/01-split.py
"""

import os
import json
from datetime import datetime

import pandas as pd
from supabase import create_client

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

OUTPUT_DIR = "data/splits"


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        return

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    print("Fetching real_price_samples from Supabase...")
    response = client.table("real_price_samples").select("*").execute()
    rows = response.data or []

    if len(rows) < 100:
        print(f"Only {len(rows)} rows — generating synthetic data for smoke test.")
        # Generate minimal synthetic data for pipeline testing
        import numpy as np
        np.random.seed(42)
        synthetic = []
        for i in range(500):
            dt = datetime(2024, 1, 1) + pd.Timedelta(days=i % 365)
            synthetic.append({
                "origin": ["CDG", "LHR", "JFK"][i % 3],
                "destination": ["NRT", "LAX", "BCN"][i % 3],
                "depart_date": (dt + pd.Timedelta(days=30 + i % 90)).isoformat()[:10],
                "price_usd": float(400 + 200 * np.sin(i / 30) + np.random.normal(0, 30)),
                "airline": "TestAir",
                "stops": i % 3,
                "duration_minutes": 300 + i % 400,
                "source": "synthetic",
                "fetched_at": dt.isoformat(),
            })
        rows = synthetic

    df = pd.DataFrame(rows)
    df["fetched_at"] = pd.to_datetime(df["fetched_at"])

    # Time-based split
    train_cutoff = pd.Timestamp("2024-07-01")
    val_cutoff = pd.Timestamp("2024-10-01")

    train = df[df["fetched_at"] < train_cutoff]
    val = df[(df["fetched_at"] >= train_cutoff) & (df["fetched_at"] < val_cutoff)]
    test = df[df["fetched_at"] >= val_cutoff]

    # If data is too recent, use percentage split
    if len(train) < 10:
        n = len(df)
        train = df.iloc[:int(n * 0.7)]
        val = df.iloc[int(n * 0.7):int(n * 0.85)]
        test = df.iloc[int(n * 0.85):]

    train.to_parquet(f"{OUTPUT_DIR}/train.parquet", index=False)
    val.to_parquet(f"{OUTPUT_DIR}/val.parquet", index=False)
    test.to_parquet(f"{OUTPUT_DIR}/test.parquet", index=False)

    print(f"Train: {len(train)} rows, Val: {len(val)} rows, Test: {len(test)} rows")
    print(f"Saved to {OUTPUT_DIR}/")


if __name__ == "__main__":
    main()
