"""
01-split.py — Time-series train/val/test split on REAL data only.

NO SYNTHETIC. Crashes if Supabase is empty.

Usage: python scripts/train/01-split.py
"""

import os
import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _env import load_env, assert_supabase
load_env()

import pandas as pd
import numpy as np

OUTPUT_DIR = "data/splits"
TRAIN_END = "2024-01-01"
VAL_END = "2024-07-01"


def fetch_all_real_data():
    url, key = assert_supabase()
    from supabase import create_client
    client = create_client(url, key)
    rows = []

    print("Fetching real_price_samples...")
    offset = 0
    while True:
        resp = client.table("real_price_samples").select("*").range(offset, offset + 9999).execute()
        batch = resp.data or []
        if not batch:
            break
        for s in batch:
            rows.append({
                "origin": s.get("origin", ""), "destination": s.get("destination", ""),
                "price_usd": float(s.get("price_usd", 0)),
                "airline": s.get("airline", "Unknown"),
                "stops": int(s.get("stops", 0)),
                "duration_minutes": int(s.get("duration_minutes", 0) or 0),
                "source": s.get("source", "unknown"),
                "fetched_at": s.get("fetched_at", s.get("created_at", "")),
                "depart_date": s.get("depart_date", ""),
                "has_ttd": True,
            })
        offset += 10000
        if len(batch) < 10000:
            break
    print(f"  real_price_samples: {len(rows)}")

    print("Fetching real_aggregated_fares...")
    agg_count = 0
    offset = 0
    while True:
        resp = client.table("real_aggregated_fares").select("*").range(offset, offset + 9999).execute()
        batch = resp.data or []
        if not batch:
            break
        for f in batch:
            fare = float(f.get("avg_fare_usd", 0) or 0)
            if fare <= 0:
                continue
            year = int(f.get("year", 2023))
            quarter = int(f.get("quarter", 1))
            month = (quarter - 1) * 3 + 2
            rows.append({
                "origin": f.get("origin", ""), "destination": f.get("destination", ""),
                "price_usd": fare, "airline": "Aggregated", "stops": 0,
                "duration_minutes": 0, "source": f.get("source", "unknown"),
                "fetched_at": f"{year}-{month:02d}-15T00:00:00+00:00",
                "depart_date": "", "has_ttd": False,
            })
            agg_count += 1
        offset += 10000
        if len(batch) < 10000:
            break
    print(f"  real_aggregated_fares: {agg_count}")

    if len(rows) == 0:
        print("\nFATAL: Supabase tables are EMPTY.")
        print("Run ingestion first: npm run ingest:all")
        sys.exit(1)

    return pd.DataFrame(rows)


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    df = fetch_all_real_data()

    print(f"\nTotal: {len(df)} real rows")
    print(f"Sources: {df['source'].value_counts().to_dict()}")

    df["fetched_at"] = pd.to_datetime(df["fetched_at"], errors="coerce", utc=True)
    df = df.dropna(subset=["fetched_at", "price_usd"])
    df = df[df["price_usd"] > 0]

    if len(df) < 100:
        print(f"FATAL: Only {len(df)} rows. Need >= 100. Run ingestion first.")
        sys.exit(1)

    train_cutoff = pd.Timestamp(TRAIN_END, tz="UTC")
    val_cutoff = pd.Timestamp(VAL_END, tz="UTC")
    train = df[df["fetched_at"] < train_cutoff]
    val = df[(df["fetched_at"] >= train_cutoff) & (df["fetched_at"] < val_cutoff)]
    test = df[df["fetched_at"] >= val_cutoff]

    if len(train) < 50 or len(val) < 10:
        print("Date split uneven — using 70/15/15.")
        df = df.sort_values("fetched_at")
        n = len(df)
        train = df.iloc[:int(n * 0.7)]
        val = df.iloc[int(n * 0.7):int(n * 0.85)]
        test = df.iloc[int(n * 0.85):]

    for name, s in [("train", train), ("val", val), ("test", test)]:
        if (s["source"] == "synthetic").any():
            print(f"FATAL: {name} contains synthetic rows!")
            sys.exit(1)

    train.to_parquet(f"{OUTPUT_DIR}/train.parquet", index=False)
    val.to_parquet(f"{OUTPUT_DIR}/val.parquet", index=False)
    test.to_parquet(f"{OUTPUT_DIR}/test.parquet", index=False)

    summary = {
        "train_rows": len(train), "val_rows": len(val), "test_rows": len(test),
        "total_rows": len(df), "real_data_only": True, "synthetic_rows": 0,
        "sources": df["source"].value_counts().to_dict(),
    }
    with open(f"{OUTPUT_DIR}/split_summary.json", "w") as f:
        json.dump(summary, f, indent=2, default=str)

    print(f"\nTrain: {len(train):,} | Val: {len(val):,} | Test: {len(test):,}")
    print(f"real_data_only: True")


if __name__ == "__main__":
    main()
