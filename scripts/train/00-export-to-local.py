"""
00-export-to-local.py — Export Supabase training data to local Parquet files.

Goal: Make training data fully LOCAL so Supabase can be truncated to free disk.

Produces:
  - data/ml_cache/real_aggregated_fares.parquet  (rebuilt from .tmp-bts-db1b/ CSVs)
  - data/ml_cache/real_price_samples.parquet     (exported from Supabase)
  - data/ml_cache/export_summary.json            (row counts for verification)

After this script succeeds, 01-split.py will read from these files instead of Supabase.

Usage: python scripts/train/00-export-to-local.py
"""

import os
import sys
import json
import glob
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _env import load_env, assert_supabase
load_env()

import pandas as pd

CACHE_DIR = Path("data/ml_cache")
BTS_TMP_DIR = Path(".tmp-bts-db1b")
BTS_SOURCE = "bts-db1b"


# ---------------------------------------------------------------------------
# PART 1: Rebuild real_aggregated_fares from local BTS CSVs.
#
# This reproduces EXACTLY the transformation done by scripts/ingest/bts-db1b.ts
# (same filters: origin/dest are 3 chars, fare > 0 and <= 20000, fare rounded
# to 2 decimals, sample_count = passengers or 1).
# ---------------------------------------------------------------------------
def rebuild_bts_from_csvs() -> pd.DataFrame:
    print("\n=== PART 1: Rebuilding real_aggregated_fares from local BTS CSVs ===")

    csv_files = sorted(glob.glob(str(BTS_TMP_DIR / "db1b_*" / "*.csv")))
    if not csv_files:
        print(f"FATAL: No BTS CSVs found in {BTS_TMP_DIR}/")
        print("Expected 8 files: db1b_2023_1..4 and db1b_2024_1..4")
        sys.exit(1)

    print(f"Found {len(csv_files)} CSV files.")

    all_rows = []
    total_skipped = 0

    for csv_path in csv_files:
        name = Path(csv_path).parent.name  # db1b_2023_1
        parts = name.split("_")
        year = int(parts[1])
        quarter = int(parts[2])

        print(f"  [{name}] reading ...", flush=True)

        # Stream in chunks to avoid loading 600MB CSV into RAM at once
        chunks = []
        for chunk in pd.read_csv(
            csv_path,
            usecols=["Origin", "Dest", "MktFare", "Passengers"],
            dtype={"Origin": "string", "Dest": "string"},
            chunksize=500_000,
            low_memory=False,
        ):
            chunk["Origin"] = chunk["Origin"].str.strip().str.upper()
            chunk["Dest"] = chunk["Dest"].str.strip().str.upper()

            valid = (
                chunk["Origin"].str.len().eq(3)
                & chunk["Dest"].str.len().eq(3)
                & chunk["MktFare"].gt(0)
                & chunk["MktFare"].le(20000)
            )
            skipped = len(chunk) - int(valid.sum())
            total_skipped += skipped

            kept = chunk.loc[valid].copy()
            kept["year"] = year
            kept["quarter"] = quarter
            kept["avg_fare_usd"] = kept["MktFare"].round(2)
            kept["sample_count"] = kept["Passengers"].fillna(1).astype(int).clip(lower=1)
            kept["source"] = BTS_SOURCE
            kept = kept.rename(columns={"Origin": "origin", "Dest": "destination"})
            chunks.append(kept[["origin", "destination", "year", "quarter", "avg_fare_usd", "sample_count", "source"]])

        df = pd.concat(chunks, ignore_index=True) if chunks else pd.DataFrame()
        print(f"  [{name}] kept {len(df):,} rows")
        all_rows.append(df)

    final = pd.concat(all_rows, ignore_index=True) if all_rows else pd.DataFrame()
    print(f"\nBTS rebuild: {len(final):,} rows total, {total_skipped:,} skipped")
    return final


# ---------------------------------------------------------------------------
# PART 2: Export real_price_samples from Supabase.
#
# This table CANNOT be rebuilt locally — it contains scraper/API data.
# We export via the REST API with 10K-page pagination.
# ---------------------------------------------------------------------------
def export_price_samples_from_supabase() -> pd.DataFrame:
    print("\n=== PART 2: Exporting real_price_samples from Supabase ===")

    url, key = assert_supabase()
    from supabase import create_client
    client = create_client(url, key)

    rows = []
    offset = 0
    page_size = 10_000

    while True:
        resp = (
            client.table("real_price_samples")
            .select("*")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = resp.data or []
        if not batch:
            break
        rows.extend(batch)
        print(f"  fetched {len(rows):,} rows ...", flush=True)
        if len(batch) < page_size:
            break
        offset += page_size

    df = pd.DataFrame(rows)
    print(f"real_price_samples export: {len(df):,} rows")
    return df


# ---------------------------------------------------------------------------
# PART 3: Verify row counts match Supabase (so we KNOW nothing is lost).
# ---------------------------------------------------------------------------
def verify_counts(bts_local_rows: int, price_samples_local_rows: int) -> dict:
    print("\n=== PART 3: Verifying row counts against Supabase ===")

    url, key = assert_supabase()
    from supabase import create_client
    client = create_client(url, key)

    # Count real_aggregated_fares on Supabase
    try:
        resp = (
            client.table("real_aggregated_fares")
            .select("*", count="exact", head=True)
            .execute()
        )
        supabase_bts = resp.count or 0
    except Exception as e:
        print(f"  WARN: could not count real_aggregated_fares: {e}")
        supabase_bts = -1

    # Count real_price_samples on Supabase
    try:
        resp = (
            client.table("real_price_samples")
            .select("*", count="exact", head=True)
            .execute()
        )
        supabase_samples = resp.count or 0
    except Exception as e:
        print(f"  WARN: could not count real_price_samples: {e}")
        supabase_samples = -1

    print(f"\n  real_aggregated_fares:")
    print(f"    Supabase: {supabase_bts:,}")
    print(f"    Local   : {bts_local_rows:,}")
    bts_ok = supabase_bts == bts_local_rows
    print(f"    Match   : {'YES ✓' if bts_ok else 'NO ✗ (see notes below)'}")

    print(f"\n  real_price_samples:")
    print(f"    Supabase: {supabase_samples:,}")
    print(f"    Local   : {price_samples_local_rows:,}")
    samples_ok = supabase_samples == price_samples_local_rows
    print(f"    Match   : {'YES ✓' if samples_ok else 'NO ✗'}")

    return {
        "real_aggregated_fares": {
            "supabase": supabase_bts,
            "local": bts_local_rows,
            "match": bts_ok,
        },
        "real_price_samples": {
            "supabase": supabase_samples,
            "local": price_samples_local_rows,
            "match": samples_ok,
        },
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    # Part 1: BTS (from local CSVs)
    bts_df = rebuild_bts_from_csvs()
    bts_path = CACHE_DIR / "real_aggregated_fares.parquet"
    bts_df.to_parquet(bts_path, index=False, compression="snappy")
    print(f"WROTE {bts_path} ({bts_path.stat().st_size / 1e6:.1f} MB)")

    # Part 2: price samples (from Supabase)
    samples_df = export_price_samples_from_supabase()
    samples_path = CACHE_DIR / "real_price_samples.parquet"
    samples_df.to_parquet(samples_path, index=False, compression="snappy")
    print(f"WROTE {samples_path} ({samples_path.stat().st_size / 1e6:.1f} MB)")

    # Part 3: verify
    counts = verify_counts(len(bts_df), len(samples_df))

    # Summary
    summary = {
        "bts_parquet": str(bts_path),
        "price_samples_parquet": str(samples_path),
        "counts": counts,
    }
    summary_path = CACHE_DIR / "export_summary.json"
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)

    print(f"\n=== DONE ===")
    print(f"Summary written to {summary_path}")

    all_match = counts["real_aggregated_fares"]["match"] and counts["real_price_samples"]["match"]
    if all_match:
        print("\n✓ All row counts match. SAFE to proceed with 01-split.py and later TRUNCATE.")
    else:
        print("\n⚠ Row counts DO NOT match. DO NOT truncate yet.")
        print("  Notes:")
        print("  - real_aggregated_fares mismatch is usually OK if within 1%% (dedup/filter diffs)")
        print("  - real_price_samples MUST match exactly (no reprocessing possible)")


if __name__ == "__main__":
    main()
