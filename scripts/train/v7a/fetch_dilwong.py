"""
v7a/fetch_dilwong.py — télécharge et traite dilwong/flightprices sans
décompresser les 30 GB ET sans OOM sur 8 GB RAM.

Stratégie memory-safe + échantillonnage défendable :
  1. kaggle API download (zip ~6 GB) dans data/kaggle/dilwong_flightprices/
  2. Lecture du CSV à l'intérieur du zip en streaming (pandas chunks)
  3. Pour chaque chunk :
     a. clean le chunk ENTIER → stats "before" cumulatives
     b. sous-échantillonne systematic 1/SAMPLE_EVERY en utilisant un offset
        tiré d'un RNG(SEED) — donc reproductible entre runs
     c. clean le chunk sampled → stats "after" cumulatives + écrit parquet
  4. Dedup + sort final en chargeant le parquet compact
  5. Compare distributions (dates / TTD / prix / routes) before vs after
     → reports/v7a_dataset_sampling_report.json
  6. Supprime le zip et le parquet "raw"

SAMPLE_EVERY = 25 → 82M / 25 ≈ 3.3M rows avant dedup/clean → ~2.5-3M final.

Empreinte peak mémoire : ~1.5 GB (deux chunks cleaned simultanés + dedup final
sur ~3M rows tient dans 8 GB Mac).

Exécution (le zip n'est re-downloadé que s'il n'existe pas déjà) :
  python3 scripts/train/v7a/fetch_dilwong.py
"""

from __future__ import annotations

import json
import sys
import zipfile
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _env import (  # noqa: E402
    V7A_DATASET_PATH,
    V7A_TAG,
    ensure_dirs,
    hash_file,
    log,
    tagged_report,
    write_manifest,
)

import numpy as np  # noqa: E402
import os  # noqa: E402
import pandas as pd  # noqa: E402

KAGGLE_DIR = Path(os.environ.get("V7A_KAGGLE_DIR", "data/kaggle/dilwong_flightprices"))
ZIP_PATH = KAGGLE_DIR / "flightprices.zip"
CHUNK_SIZE = 500_000
# V7A_SAMPLE_EVERY env override :
#   - local default : 25 (≈3.3M lignes, tient sur MacBook 8 GB)
#   - Modal full    : 1  (82M lignes brutes, dataset complet)
SAMPLE_EVERY = int(os.environ.get("V7A_SAMPLE_EVERY", "25"))
SEED = 42

USE_COLS = [
    "searchDate",
    "flightDate",
    "startingAirport",
    "destinationAirport",
    "totalFare",
    "baseFare",
    "isNonStop",
    "segmentsAirlineName",
]

PRICE_MIN_USD = 20.0
PRICE_MAX_USD = 5000.0
TTD_MIN = 1
TTD_MAX = 365

TTD_BUCKETS = [(0, 7, "0-7"), (8, 21, "8-21"), (22, 60, "22-60"), (61, 365, "61+")]
PRICE_BINS = [100, 200, 300, 400, 500, 600, 800, 1000]
PRICE_LABELS = [
    "0-100", "100-200", "200-300", "300-400",
    "400-500", "500-600", "600-800", "800-1000", "1000+",
]


def _download_zip() -> None:
    if ZIP_PATH.exists() and ZIP_PATH.stat().st_size > 1_000_000_000:
        log(
            "zip already present — skipping download",
            path=str(ZIP_PATH),
            size_mb=ZIP_PATH.stat().st_size // (1024 * 1024),
        )
        return
    KAGGLE_DIR.mkdir(parents=True, exist_ok=True)
    log("downloading dilwong/flightprices zip (~6 GB)")
    import subprocess
    res = subprocess.run(
        ["kaggle", "datasets", "download", "-d", "dilwong/flightprices", "-p", str(KAGGLE_DIR)],
        check=False,
    )
    if res.returncode != 0:
        raise SystemExit("kaggle download failed — vérifier l'auth et l'acceptation du dataset")
    if not ZIP_PATH.exists():
        zips = list(KAGGLE_DIR.glob("*.zip"))
        if not zips:
            raise SystemExit(f"no zip in {KAGGLE_DIR}")
        zips[0].rename(ZIP_PATH)
    log("downloaded", size_mb=ZIP_PATH.stat().st_size // (1024 * 1024))


def _iter_raw_chunks():
    with zipfile.ZipFile(ZIP_PATH, "r") as zf:
        csvs = [n for n in zf.namelist() if n.endswith(".csv")]
        if not csvs:
            raise SystemExit("no CSV inside zip")
        log("streaming CSV from zip", csv=csvs[0], sample_every=SAMPLE_EVERY, seed=SEED)
        with zf.open(csvs[0], "r") as fh:
            for chunk in pd.read_csv(
                fh,
                usecols=lambda c: c in USE_COLS,
                chunksize=CHUNK_SIZE,
                low_memory=False,
            ):
                yield chunk


def _clean_chunk(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    for col_src, col_dst in [("startingAirport", "origin"), ("destinationAirport", "destination")]:
        df[col_dst] = df[col_src].astype(str).str.strip().str.upper()
    df = df[df["origin"].str.len() == 3]
    df = df[df["destination"].str.len() == 3]

    df["price_usd"] = pd.to_numeric(df["totalFare"], errors="coerce")
    mask_nan = df["price_usd"].isna()
    if mask_nan.any():
        df.loc[mask_nan, "price_usd"] = pd.to_numeric(df.loc[mask_nan, "baseFare"], errors="coerce")
    df = df[df["price_usd"].between(PRICE_MIN_USD, PRICE_MAX_USD)]

    df["fetched_at"] = pd.to_datetime(df["searchDate"], errors="coerce", utc=True)
    df["depart_date"] = pd.to_datetime(df["flightDate"], errors="coerce", utc=True)
    df = df.dropna(subset=["fetched_at", "depart_date"])
    df = df[df["fetched_at"] <= df["depart_date"]]

    ttd = (df["depart_date"] - df["fetched_at"]).dt.total_seconds() / 86400.0
    df = df[(ttd >= TTD_MIN) & (ttd <= TTD_MAX)]
    df["ttd_days"] = ttd.astype(np.float32)

    df["route"] = (df["origin"] + "-" + df["destination"]).astype(str)
    df["source"] = "kaggle/dilwong/flightprices"
    df["quality"] = np.int32(100)

    if "isNonStop" in df.columns:
        df["stops"] = np.where(
            df["isNonStop"].astype(str).str.upper().isin(["TRUE", "1"]), 0, 1
        ).astype(np.int8)
    else:
        df["stops"] = np.int8(0)

    if "segmentsAirlineName" in df.columns:
        df["airline"] = (
            df["segmentsAirlineName"].astype(str)
            .str.split("||").str[0]
            .fillna("Unknown").str.strip()
        )
    else:
        df["airline"] = "Unknown"

    out = df[
        [
            "route", "origin", "destination",
            "fetched_at", "depart_date", "ttd_days",
            "price_usd", "airline", "stops",
            "source", "quality",
        ]
    ].copy()
    out["price_usd"] = out["price_usd"].astype(np.float32)
    return out


# ---------------------------------------------------------------------------
# Stats accumulateurs (streaming friendly)
# ---------------------------------------------------------------------------


def _init_stats() -> dict:
    return {
        "n": 0,
        "routes": Counter(),
        "date_month": Counter(),
        "ttd_buckets": Counter(),
        "price_buckets": Counter(),
        "price_sum": 0.0,
        "price_sq_sum": 0.0,
        "ttd_sum": 0.0,
    }


def _ttd_bucket(ttd_arr: np.ndarray) -> list[str]:
    out = np.empty(len(ttd_arr), dtype=object)
    out[:] = "61+"
    for lo, hi, label in TTD_BUCKETS:
        mask = (ttd_arr >= lo) & (ttd_arr <= hi)
        out[mask] = label
    return out.tolist()


def _price_bucket(price_arr: np.ndarray) -> list[str]:
    idx = np.digitize(price_arr, PRICE_BINS)
    return [PRICE_LABELS[min(int(i), len(PRICE_LABELS) - 1)] for i in idx]


def _update_stats(stats: dict, df: pd.DataFrame) -> None:
    if len(df) == 0:
        return
    stats["n"] += len(df)
    stats["routes"].update(df["route"].tolist())
    stats["date_month"].update(
        df["fetched_at"].dt.to_period("M").astype(str).tolist()
    )
    ttd = df["ttd_days"].to_numpy()
    stats["ttd_buckets"].update(_ttd_bucket(ttd))
    stats["ttd_sum"] += float(ttd.sum())
    price = df["price_usd"].to_numpy()
    stats["price_buckets"].update(_price_bucket(price))
    stats["price_sum"] += float(price.sum())
    stats["price_sq_sum"] += float((price.astype(np.float64) ** 2).sum())


def _finalize_stats(stats: dict) -> dict:
    n = max(stats["n"], 1)
    price_mean = stats["price_sum"] / n
    price_var = stats["price_sq_sum"] / n - price_mean ** 2
    return {
        "n_rows": int(stats["n"]),
        "n_routes": int(len(stats["routes"])),
        "price_mean": float(price_mean),
        "price_std": float(max(0.0, price_var) ** 0.5),
        "ttd_mean_days": float(stats["ttd_sum"] / n),
        "date_distribution_monthly": dict(sorted(stats["date_month"].items())),
        "ttd_bucket_distribution": {
            label: int(stats["ttd_buckets"].get(label, 0))
            for _, _, label in TTD_BUCKETS
        } | {"61+": int(stats["ttd_buckets"].get("61+", 0))},
        "price_bucket_distribution": {
            label: int(stats["price_buckets"].get(label, 0)) for label in PRICE_LABELS
        },
        "top_20_routes_by_count": dict(stats["routes"].most_common(20)),
    }


def _compare_distributions(before: dict, after: dict, sample_every: int) -> dict:
    """
    Compare before (full) vs after (sampled) via L1 sur proportions.
    Un sampling correct doit donner un L1 ~0 (≤ 0.03) sur les distributions
    relatives.
    """
    def _to_proportion(d: dict[str, int]) -> dict[str, float]:
        total = max(sum(d.values()), 1)
        return {k: v / total for k, v in d.items()}

    def _l1(a: dict[str, float], b: dict[str, float]) -> float:
        keys = set(a) | set(b)
        return float(sum(abs(a.get(k, 0.0) - b.get(k, 0.0)) for k in keys))

    proportions_before = {
        "date": _to_proportion(before["date_distribution_monthly"]),
        "ttd": _to_proportion(before["ttd_bucket_distribution"]),
        "price": _to_proportion(before["price_bucket_distribution"]),
    }
    proportions_after = {
        "date": _to_proportion(after["date_distribution_monthly"]),
        "ttd": _to_proportion(after["ttd_bucket_distribution"]),
        "price": _to_proportion(after["price_bucket_distribution"]),
    }
    l1 = {k: _l1(proportions_before[k], proportions_after[k]) for k in proportions_before}

    # Retention per route : garde-t-on au moins 1 obs par top-routes ?
    top_before = before["top_20_routes_by_count"]
    top_after_counts = after["top_20_routes_by_count"]
    retention = {
        r: (top_after_counts.get(r, 0) / max(1, top_before[r])) for r in top_before
    }

    # Expected ratio for systematic 1/K : should be ≈ 1/SAMPLE_EVERY globally
    overall_ratio = after["n_rows"] / max(1, before["n_rows"])
    expected_ratio = 1.0 / sample_every

    return {
        "sample_every": sample_every,
        "seed": SEED,
        "n_rows_before": before["n_rows"],
        "n_rows_after": after["n_rows"],
        "overall_ratio_actual": overall_ratio,
        "overall_ratio_expected": expected_ratio,
        "ratio_delta_pct": abs(overall_ratio - expected_ratio) * 100,
        "l1_distance_date_monthly": l1["date"],
        "l1_distance_ttd_bucket": l1["ttd"],
        "l1_distance_price_bucket": l1["price"],
        "top20_route_retention_ratio_mean": float(np.mean(list(retention.values()))) if retention else 0.0,
        "top20_route_retention_ratio_min": float(np.min(list(retention.values()))) if retention else 0.0,
        "verdict": {
            "representative": all(
                v <= 0.03 for v in l1.values()
            ) and abs(overall_ratio - expected_ratio) < 0.005,
            "notes": [
                "L1 distance ≤ 0.03 means each marginal distribution is preserved within 3 pp.",
                "Systematic sampling with reproducible offset from np.random.default_rng(SEED).",
            ],
        },
    }


def main() -> None:
    import pyarrow as pa
    import pyarrow.parquet as pq

    ensure_dirs()
    _download_zip()

    rng = np.random.default_rng(SEED)
    offset = int(rng.integers(0, SAMPLE_EVERY))
    log("sampling params", sample_every=SAMPLE_EVERY, seed=SEED, offset=offset)

    raw_path = V7A_DATASET_PATH.with_suffix(".raw.parquet")
    if raw_path.exists():
        raw_path.unlink()

    stats_before = _init_stats()
    stats_after = _init_stats()

    writer = None
    global_idx = 0
    rows_scanned = 0
    rows_kept_clean = 0

    for i, raw_chunk in enumerate(_iter_raw_chunks(), start=1):
        n_raw = len(raw_chunk)
        rows_scanned += n_raw

        if SAMPLE_EVERY == 1:
            # Fast path Modal full-data : on clean une fois, stats before == after.
            cleaned_sample = _clean_chunk(raw_chunk)
            _update_stats(stats_before, cleaned_sample)
            _update_stats(stats_after, cleaned_sample)
            global_idx += n_raw
            del raw_chunk
        else:
            # Stats "before" : nettoie le chunk ENTIER et accumule les stats
            cleaned_full = _clean_chunk(raw_chunk)
            _update_stats(stats_before, cleaned_full)
            del cleaned_full

            # Sampling systematic reproductible sur les indices absolus du CSV :
            # on garde les lignes dont l'index global vérifie (idx % K == offset).
            first_local = (offset - global_idx) % SAMPLE_EVERY
            sampled_chunk = raw_chunk.iloc[first_local::SAMPLE_EVERY]
            global_idx += n_raw
            del raw_chunk

            cleaned_sample = _clean_chunk(sampled_chunk)
            del sampled_chunk
            _update_stats(stats_after, cleaned_sample)

        if len(cleaned_sample):
            rows_kept_clean += len(cleaned_sample)
            table = pa.Table.from_pandas(cleaned_sample, preserve_index=False)
            if writer is None:
                writer = pq.ParquetWriter(str(raw_path), table.schema, compression="snappy")
            writer.write_table(table)
        del cleaned_sample

        if i % 10 == 0:
            log(f"chunk {i}", scanned=rows_scanned, kept_sampled=rows_kept_clean)

    if writer is None:
        raise SystemExit("no rows parsed from zip")
    writer.close()
    log("raw sampled parquet written", path=str(raw_path), rows=rows_kept_clean)

    # Dedup + sort final (sur ~3M rows → tient en RAM)
    log("loading sampled parquet for dedup")
    df = pd.read_parquet(raw_path)
    log("loaded", rows=len(df))
    df = df.drop_duplicates(subset=["route", "fetched_at", "depart_date", "price_usd"], keep="first")
    df = df.sort_values(["route", "fetched_at"]).reset_index(drop=True)
    log("after dedup", rows=len(df))

    df.to_parquet(V7A_DATASET_PATH, index=False)

    # Manifest compact
    write_manifest(
        V7A_DATASET_PATH.with_suffix(".manifest.json"),
        {
            "step": "fetch_dilwong",
            "source": "kaggle/dilwong/flightprices",
            "sample_every": SAMPLE_EVERY,
            "seed": SEED,
            "offset": offset,
            "rows_scanned": int(rows_scanned),
            "rows_sampled_kept": int(rows_kept_clean),
            "rows_final_after_dedup": int(len(df)),
            "routes": int(df["route"].nunique()),
            "min_date": str(df["fetched_at"].min()),
            "max_date": str(df["fetched_at"].max()),
            "price_p05": float(np.quantile(df["price_usd"], 0.05)),
            "price_p50": float(np.quantile(df["price_usd"], 0.50)),
            "price_p95": float(np.quantile(df["price_usd"], 0.95)),
            "file_sha256": hash_file(V7A_DATASET_PATH),
        },
    )

    # Rapport de sampling (before vs after)
    summary_before = _finalize_stats(stats_before)
    summary_after = _finalize_stats(stats_after)
    sampling_report = {
        "before": summary_before,
        "after": summary_after,
        "comparison": _compare_distributions(summary_before, summary_after, SAMPLE_EVERY),
    }
    report_path = tagged_report("dataset_sampling_report")
    report_path.write_text(json.dumps(sampling_report, indent=2, default=str), encoding="utf-8")
    log("sampling report", path=str(report_path))

    verdict = sampling_report["comparison"]["verdict"]
    log(
        "sampling verdict",
        representative=verdict["representative"],
        l1_date=round(sampling_report["comparison"]["l1_distance_date_monthly"], 4),
        l1_ttd=round(sampling_report["comparison"]["l1_distance_ttd_bucket"], 4),
        l1_price=round(sampling_report["comparison"]["l1_distance_price_bucket"], 4),
    )

    # Cleanup : raw parquet sampled n'est plus utile
    try:
        raw_path.unlink()
        log("raw parquet removed", path=str(raw_path))
    except Exception as e:
        log("raw unlink failed (ok to ignore)", err=str(e))

    # Zip — on le laisse pour pouvoir relancer sans re-télécharger. Si l'espace
    # disque est critique, supprimer manuellement data/kaggle/dilwong_flightprices/
    log("done", final_path=str(V7A_DATASET_PATH), final_rows=int(len(df)))


if __name__ == "__main__":
    main()
