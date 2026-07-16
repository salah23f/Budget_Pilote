"""
v7a/build_dataset.py — construit le dataset V7a propre.

Source PRINCIPALE autorisée : Kaggle `dilwong/flightprices` (2022-2023, US,
~5M lignes, vraie `searchDate`, vraie `flightDate` → TTD réel).

Sources contextuelles (features statiques uniquement, JAMAIS prix cible) :
  - BTS DB1B quarterly → `route_mean_usd_quarter` (feature seulement)
  - BTS T-2 / OpenSky / FX → contexte demande, via `real_features`
  - (T-100 exclu : source = `bts-t100-synthetic-regression`)
  - (Expedia ICDM exclu : hôtels)
  - (Wayback exclu : bruit regex)
  - (HF discovery exclu : volume dérisoire)

Input (modes en ordre de priorité) :
  1. Mode "supabase" (par défaut) : lit `real_price_samples` filtré par source.
  2. Mode "parquet" : lit `data/ml_cache/real_price_samples.parquet`.
  3. Mode "kaggle-raw" : lit directement un CSV dilwong local.

Filtrage strict :
  - source LIKE 'kaggle/dilwong/flightprices'
  - quality = 100 (fetched_at préservé)
  - price_usd entre 20 et 5000
  - depart_date non nul
  - fetched_at non nul et <= depart_date
  - TTD entre 1 et 365 jours
  - origin/destination IATA length=3 uppercase

Output :
  - data/ml_cache/v7a_clean.parquet (schéma documenté dans V7A_DATASET.md)

Run :
  python3 scripts/train/v7a/build_dataset.py [--mode supabase|parquet|kaggle-raw] [--kaggle-csv PATH]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _env import (  # noqa: E402
    V7A_DATASET_PATH,
    ML_CACHE,
    ensure_dirs,
    hash_file,
    load_env,
    log,
    write_manifest,
)

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402


PRICE_MIN_USD = 20.0
PRICE_MAX_USD = 5000.0
TTD_MIN = 1
TTD_MAX = 365


def _load_supabase() -> pd.DataFrame:
    load_env()
    url = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
    key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not url or not key:
        raise RuntimeError("Supabase credentials missing (.env.local)")
    try:
        from supabase import create_client
    except Exception as e:
        raise RuntimeError(f"`supabase` package not installed: {e}")
    client = create_client(url, key)
    rows: list[dict] = []
    offset = 0
    page = 10000
    while True:
        resp = (
            client.table("real_price_samples")
            .select("origin,destination,price_usd,depart_date,fetched_at,quality,source,airline,stops")
            .like("source", "kaggle/dilwong/flightprices%")
            .range(offset, offset + page - 1)
            .execute()
        )
        batch = resp.data or []
        rows.extend(batch)
        if len(batch) < page:
            break
        offset += page
    return pd.DataFrame(rows)


def _load_parquet() -> pd.DataFrame:
    p = ML_CACHE / "real_price_samples.parquet"
    if not p.exists():
        raise RuntimeError(f"Missing {p}. Run 00-export-to-local.py first.")
    df = pd.read_parquet(p)
    if "source" in df.columns:
        df = df[df["source"].astype(str).str.contains("kaggle/dilwong/flightprices")]
    return df


def _load_kaggle_raw(csv_path: Path) -> pd.DataFrame:
    if not csv_path.exists():
        raise RuntimeError(f"Kaggle CSV not found: {csv_path}")
    usecols = [
        "searchDate",
        "flightDate",
        "startingAirport",
        "destinationAirport",
        "totalFare",
        "baseFare",
    ]
    df = pd.read_csv(csv_path, usecols=lambda c: c in usecols, low_memory=False)
    df = df.rename(
        columns={
            "searchDate": "fetched_at",
            "flightDate": "depart_date",
            "startingAirport": "origin",
            "destinationAirport": "destination",
            "totalFare": "price_usd",
        }
    )
    df["source"] = "kaggle/dilwong/flightprices"
    df["quality"] = 100
    df["airline"] = "Unknown"
    df["stops"] = 0
    return df


def clean(df: pd.DataFrame) -> pd.DataFrame:
    n0 = len(df)
    log("input rows", n=n0)

    for col in ("origin", "destination"):
        df[col] = df[col].astype(str).str.strip().str.upper()
    df = df[df["origin"].str.len() == 3]
    df = df[df["destination"].str.len() == 3]

    df["price_usd"] = pd.to_numeric(df["price_usd"], errors="coerce")
    df = df[df["price_usd"].between(PRICE_MIN_USD, PRICE_MAX_USD)]

    df["fetched_at"] = pd.to_datetime(df["fetched_at"], errors="coerce", utc=True)
    df["depart_date"] = pd.to_datetime(df["depart_date"], errors="coerce", utc=True)
    df = df.dropna(subset=["fetched_at", "depart_date"])

    df = df[df["fetched_at"] <= df["depart_date"]]

    ttd = (df["depart_date"] - df["fetched_at"]).dt.total_seconds() / 86400.0
    df = df[(ttd >= TTD_MIN) & (ttd <= TTD_MAX)]
    df["ttd_days"] = ttd.astype(np.float32)

    if "quality" in df.columns:
        df["quality"] = pd.to_numeric(df["quality"], errors="coerce").fillna(0).astype(int)
        df = df[df["quality"] >= 100]

    df["route"] = df["origin"] + "-" + df["destination"]

    df = df.drop_duplicates(
        subset=["route", "fetched_at", "depart_date", "price_usd"], keep="first"
    )

    df = df.sort_values(["route", "fetched_at"]).reset_index(drop=True)
    log("kept rows", n=len(df), dropped=n0 - len(df))
    return df[
        [
            "route",
            "origin",
            "destination",
            "fetched_at",
            "depart_date",
            "ttd_days",
            "price_usd",
            "airline",
            "stops",
            "source",
            "quality",
        ]
    ]


def main() -> None:
    import os  # local import OK
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["supabase", "parquet", "kaggle-raw"], default="parquet")
    parser.add_argument("--kaggle-csv", default=None, help="Path to dilwong CSV (mode=kaggle-raw)")
    args = parser.parse_args()

    ensure_dirs()
    log("build_dataset start", mode=args.mode)

    if args.mode == "supabase":
        df = _load_supabase()
    elif args.mode == "kaggle-raw":
        if not args.kaggle_csv:
            raise SystemExit("--kaggle-csv is required in mode=kaggle-raw")
        df = _load_kaggle_raw(Path(args.kaggle_csv))
    else:
        df = _load_parquet()

    if len(df) == 0:
        raise SystemExit("No source rows — vérifier l'ingestion Kaggle (searchDate préservé).")

    df = clean(df)
    if len(df) < 50_000:
        log(
            "WARN: < 50k rows — V7a peut manquer de signal. "
            "Vérifier que kaggle/dilwong est bien ingéré avec searchDate.",
        )

    df.to_parquet(V7A_DATASET_PATH, index=False)
    manifest_path = V7A_DATASET_PATH.with_suffix(".manifest.json")
    write_manifest(
        manifest_path,
        {
            "step": "build_dataset",
            "mode": args.mode,
            "rows": int(len(df)),
            "routes": int(df["route"].nunique()),
            "min_date": str(df["fetched_at"].min()),
            "max_date": str(df["fetched_at"].max()),
            "price_p05": float(np.quantile(df["price_usd"], 0.05)),
            "price_p50": float(np.quantile(df["price_usd"], 0.50)),
            "price_p95": float(np.quantile(df["price_usd"], 0.95)),
            "file_sha256": hash_file(V7A_DATASET_PATH),
        },
    )
    log("dataset written", path=str(V7A_DATASET_PATH), rows=len(df), routes=df["route"].nunique())


if __name__ == "__main__":
    main()
