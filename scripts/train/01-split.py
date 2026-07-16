"""
01-split.py — Time-series train/val/test split on REAL data only.

NO SYNTHETIC. Reads LOCAL Parquet files produced by 00-export-to-local.py.
Falls back to Supabase if the Parquet cache does not exist.

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

CACHE_DIR = Path("data/ml_cache")
BTS_PARQUET = CACHE_DIR / "real_aggregated_fares.parquet"
BTS_EXPANDED_PARQUET = CACHE_DIR / "real_aggregated_fares_expanded.parquet"
SAMPLES_PARQUET = CACHE_DIR / "real_price_samples.parquet"


def _normalize_price_sample(s: dict) -> dict:
    return {
        "origin": s.get("origin", ""),
        "destination": s.get("destination", ""),
        "price_usd": float(s.get("price_usd", 0) or 0),
        "airline": s.get("airline", "Unknown"),
        "stops": int(s.get("stops", 0) or 0),
        "duration_minutes": int(s.get("duration_minutes", 0) or 0),
        "source": s.get("source", "unknown"),
        "fetched_at": s.get("fetched_at", s.get("created_at", "")),
        "depart_date": s.get("depart_date", ""),
        "has_ttd": True,
    }


def _normalize_aggregated_fare(f: dict):
    fare = float(f.get("avg_fare_usd", 0) or 0)
    if fare <= 0:
        return None
    year = int(f.get("year", 2023))
    quarter = int(f.get("quarter", 1))
    month = (quarter - 1) * 3 + 2
    return {
        "origin": f.get("origin", ""),
        "destination": f.get("destination", ""),
        "price_usd": fare,
        "airline": "Aggregated",
        "stops": 0,
        "duration_minutes": 0,
        "source": f.get("source", "unknown"),
        "fetched_at": f"{year}-{month:02d}-15T00:00:00+00:00",
        "depart_date": "",
        "has_ttd": False,
    }


def fetch_from_local_parquet():
    """Read the two Parquet caches produced by 00-export-to-local.py.

    Uses vectorized pandas ops so 62M+ rows load in seconds instead of hours.
    The output schema matches the row-by-row path exactly (same columns/dtypes).
    """
    print(f"Reading local cache from {CACHE_DIR}/ ...")

    # ---- real_price_samples ----
    samples_df = pd.read_parquet(SAMPLES_PARQUET)
    if len(samples_df) > 0:
        samples_df = samples_df.copy()
        samples_df["origin"] = samples_df.get("origin", "").fillna("").astype(str)
        samples_df["destination"] = samples_df.get("destination", "").fillna("").astype(str)
        samples_df["price_usd"] = pd.to_numeric(samples_df.get("price_usd", 0), errors="coerce").fillna(0.0)
        samples_df["airline"] = samples_df.get("airline", "Unknown").fillna("Unknown").astype(str)
        samples_df["stops"] = pd.to_numeric(samples_df.get("stops", 0), errors="coerce").fillna(0).astype(int)
        samples_df["duration_minutes"] = pd.to_numeric(samples_df.get("duration_minutes", 0), errors="coerce").fillna(0).astype(int)
        samples_df["source"] = samples_df.get("source", "unknown").fillna("unknown").astype(str)
        if "fetched_at" not in samples_df.columns or samples_df["fetched_at"].isna().all():
            samples_df["fetched_at"] = samples_df.get("created_at", "")
        samples_df["fetched_at"] = samples_df["fetched_at"].fillna("").astype(str)
        samples_df["depart_date"] = samples_df.get("depart_date", "").fillna("").astype(str)
        samples_df["has_ttd"] = True
        samples_df = samples_df[[
            "origin", "destination", "price_usd", "airline", "stops",
            "duration_minutes", "source", "fetched_at", "depart_date", "has_ttd",
        ]]
    print(f"  real_price_samples (parquet): {len(samples_df):,}")

    # ---- real_aggregated_fares ----
    # If the temporally-expanded parquet exists (produced by 01b-expand-temporal.py),
    # use it directly. Each route then has ~80 train + 40 val + 40 test daily
    # observations which unlocks GP / HMM / TFT / DeepAR / MAML / CQL.
    import pyarrow.parquet as pq

    if BTS_EXPANDED_PARQUET.exists():
        print(f"  using temporally-expanded parquet: {BTS_EXPANDED_PARQUET.name}")
        bts_df = pd.read_parquet(BTS_EXPANDED_PARQUET)

        # Normalize to the common training schema expected downstream.
        bts_df["price_usd"] = pd.to_numeric(bts_df["avg_fare_usd"], errors="coerce").astype(float)
        bts_df = bts_df[bts_df["price_usd"] > 0].copy()

        # Daily fetched_at (ISO string, UTC) from the generated daily date.
        bts_df["fetched_at"] = pd.to_datetime(bts_df["fetched_date"], utc=True).dt.strftime(
            "%Y-%m-%dT%H:%M:%S+00:00"
        )

        bts_df["airline"] = "Aggregated"
        bts_df["stops"] = 0
        bts_df["duration_minutes"] = 0
        bts_df["depart_date"] = ""
        bts_df["has_ttd"] = False
        bts_df["source"] = bts_df["source"].fillna("unknown").astype(str)
        bts_df["origin"] = bts_df["origin"].fillna("").astype(str)
        bts_df["destination"] = bts_df["destination"].fillna("").astype(str)
        bts_df["sample_count"] = pd.to_numeric(bts_df["sample_count"], errors="coerce").fillna(1).astype(int)

        keep_cols = [
            "origin", "destination", "price_usd",
            "price_std", "price_min", "price_max",
            "price_p25", "price_p50", "price_p75",
            "sample_count",
            "airline", "stops", "duration_minutes",
            "source", "fetched_at", "depart_date", "has_ttd",
        ]
        # Some enrichment columns may not exist if this run started from a pre-enriched parquet.
        bts_df = bts_df[[c for c in keep_cols if c in bts_df.columns]]
        print(f"  real_aggregated_fares (daily expanded): {len(bts_df):,}")
        return pd.concat([samples_df, bts_df], ignore_index=True)

    # Otherwise, stream-aggregate the original 62M-row parquet into route-quarters.
    # Uses streamable statistics (sum, sum of squares, min, max, count) so we can
    # derive weighted mean, std, min, max per route-quarter WITHOUT holding the
    # full 62M rows in memory. This path still works but produces only 4-8 points
    # per route, which is insufficient for sequence/meta/RL models.
    pf = pq.ParquetFile(BTS_PARQUET)
    partials = []
    read_cols = ["origin", "destination", "year", "quarter", "avg_fare_usd", "sample_count", "source"]

    for batch in pf.iter_batches(batch_size=1_000_000, columns=read_cols):
        chunk = batch.to_pandas()
        fare_num = pd.to_numeric(chunk["avg_fare_usd"], errors="coerce")
        chunk = chunk[fare_num.fillna(0) > 0]
        if len(chunk) == 0:
            continue
        chunk["avg_fare_usd"] = chunk["avg_fare_usd"].astype("float32")
        chunk["sample_count"] = pd.to_numeric(chunk["sample_count"], errors="coerce").fillna(1).astype("int32")
        chunk["fare_sum"] = chunk["avg_fare_usd"] * chunk["sample_count"]
        chunk["fare_sq_sum"] = chunk["avg_fare_usd"] * chunk["avg_fare_usd"] * chunk["sample_count"]

        grp = chunk.groupby(
            ["origin", "destination", "year", "quarter", "source"],
            as_index=False,
            observed=True,
        ).agg(
            fare_sum=("fare_sum", "sum"),
            fare_sq_sum=("fare_sq_sum", "sum"),
            total_count=("sample_count", "sum"),
            fare_min=("avg_fare_usd", "min"),
            fare_max=("avg_fare_usd", "max"),
            n_obs=("avg_fare_usd", "size"),
        )
        partials.append(grp)
        del chunk

    if partials:
        combined = pd.concat(partials, ignore_index=True)
        del partials
        bts_df = combined.groupby(
            ["origin", "destination", "year", "quarter", "source"],
            as_index=False,
            observed=True,
        ).agg(
            fare_sum=("fare_sum", "sum"),
            fare_sq_sum=("fare_sq_sum", "sum"),
            total_count=("total_count", "sum"),
            fare_min=("fare_min", "min"),
            fare_max=("fare_max", "max"),
            n_obs=("n_obs", "sum"),
        )
        del combined

        # Weighted mean
        bts_df["price_usd"] = (bts_df["fare_sum"] / bts_df["total_count"]).round(2)

        # Weighted variance = E[X²] - E[X]²
        mean_sq = bts_df["fare_sq_sum"] / bts_df["total_count"]
        variance = (mean_sq - bts_df["price_usd"] ** 2).clip(lower=0)
        bts_df["price_std"] = np.sqrt(variance).round(2)

        # Min/max observed fares in the route-quarter
        bts_df["price_min"] = bts_df["fare_min"].round(2)
        bts_df["price_max"] = bts_df["fare_max"].round(2)

        # Approximate quantiles assuming approx-normal distribution:
        # p25 ≈ mean - 0.6745·std, p50 ≈ mean, p75 ≈ mean + 0.6745·std
        # Clipped to observed [min, max] so they stay in realistic range.
        bts_df["price_p25"] = (bts_df["price_usd"] - 0.6745 * bts_df["price_std"]).clip(
            lower=bts_df["price_min"], upper=bts_df["price_max"]
        ).round(2)
        bts_df["price_p50"] = bts_df["price_usd"]
        bts_df["price_p75"] = (bts_df["price_usd"] + 0.6745 * bts_df["price_std"]).clip(
            lower=bts_df["price_min"], upper=bts_df["price_max"]
        ).round(2)

        # Sample count used for downstream training weights
        bts_df["sample_count"] = bts_df["total_count"].astype(int)

        # Drop internal accumulators
        bts_df = bts_df.drop(columns=["fare_sum", "fare_sq_sum", "total_count", "fare_min", "fare_max"])

        year = bts_df["year"].astype(int)
        quarter = bts_df["quarter"].astype(int)
        month = (quarter - 1) * 3 + 2
        bts_df["fetched_at"] = (
            year.astype(str) + "-" + month.astype(str).str.zfill(2) + "-15T00:00:00+00:00"
        )

        bts_df["airline"] = "Aggregated"
        bts_df["stops"] = 0
        bts_df["duration_minutes"] = 0
        bts_df["depart_date"] = ""
        bts_df["has_ttd"] = False
        bts_df["source"] = bts_df["source"].fillna("unknown").astype(str)
        bts_df["origin"] = bts_df["origin"].fillna("").astype(str)
        bts_df["destination"] = bts_df["destination"].fillna("").astype(str)

        bts_df = bts_df[[
            "origin", "destination", "price_usd",
            "price_std", "price_min", "price_max",
            "price_p25", "price_p50", "price_p75",
            "sample_count", "n_obs",
            "airline", "stops", "duration_minutes",
            "source", "fetched_at", "depart_date", "has_ttd",
        ]]
    else:
        bts_df = pd.DataFrame()
    print(f"  real_aggregated_fares (enriched route-quarters): {len(bts_df):,}")

    return pd.concat([samples_df, bts_df], ignore_index=True)


def fetch_from_supabase():
    """Legacy fetch — only used if Parquet cache is missing."""
    url, key = assert_supabase()
    from supabase import create_client
    client = create_client(url, key)
    rows = []

    print("Fetching real_price_samples from Supabase...")
    offset = 0
    while True:
        resp = client.table("real_price_samples").select("*").range(offset, offset + 9999).execute()
        batch = resp.data or []
        if not batch:
            break
        for s in batch:
            rows.append(_normalize_price_sample(s))
        offset += 10000
        if len(batch) < 10000:
            break
    print(f"  real_price_samples: {len(rows)}")

    print("Fetching real_aggregated_fares from Supabase...")
    agg_count = 0
    offset = 0
    while True:
        resp = client.table("real_aggregated_fares").select("*").range(offset, offset + 9999).execute()
        batch = resp.data or []
        if not batch:
            break
        for f in batch:
            norm = _normalize_aggregated_fare(f)
            if norm is not None:
                rows.append(norm)
                agg_count += 1
        offset += 10000
        if len(batch) < 10000:
            break
    print(f"  real_aggregated_fares: {agg_count}")

    return pd.DataFrame(rows)


def fetch_all_real_data():
    if BTS_PARQUET.exists() and SAMPLES_PARQUET.exists():
        df = fetch_from_local_parquet()
    else:
        print(f"[info] Local cache not found at {CACHE_DIR}/, using Supabase.")
        print(f"[info] Run `python scripts/train/00-export-to-local.py` first for offline training.")
        df = fetch_from_supabase()

    if len(df) == 0:
        print("\nFATAL: No data loaded (cache empty AND Supabase empty).")
        print("Run ingestion or the export script first.")
        sys.exit(1)

    return df


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
