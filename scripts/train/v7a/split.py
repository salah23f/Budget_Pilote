"""
v7a/split.py — split temporel 4-blocs (train / val / cal / test).

Règles (voir docs/V7A_SPLIT.md) :
  - train  : 70 %  — sert aux experts + OOF k-fold
  - val    : 15 %  — sert aux early-stop, isotonic, tuning
  - cal    : 10 %  — EXCLUSIVEMENT à la calibration conformelle
  - test   :  5 %  — FROZEN, lu SEULEMENT par backtest.py

Segmentation stricte par ordre chronologique (fetched_at).
Les frontières exactes sont écrites dans `split_meta.json` pour traçabilité.

Input  : data/ml_cache/v7a_clean.parquet
Output : data/splits_v7a/{train,val,cal,test}.parquet + split_meta.json

Un garde-fou (`_guard_test.txt`) documente que test ne doit être lu que par
backtest.py. Le helper `_env.assert_test_split_not_read(__file__)` s'en charge
côté code.

Run :
  python3 scripts/train/v7a/split.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _env import V7A_DATASET_PATH, V7A_SPLITS_DIR, ensure_dirs, log, write_manifest  # noqa: E402

import pandas as pd  # noqa: E402

FRACTIONS = {"train": 0.70, "val": 0.15, "cal": 0.10, "test": 0.05}


def main() -> None:
    ensure_dirs()
    if not V7A_DATASET_PATH.exists():
        raise SystemExit(f"{V7A_DATASET_PATH} missing — run build_dataset.py first")

    df = pd.read_parquet(V7A_DATASET_PATH)
    if "fetched_at" not in df.columns:
        raise SystemExit("dataset missing fetched_at (see V7A_DATASET.md)")

    df = df.sort_values("fetched_at").reset_index(drop=True)
    n = len(df)

    # V7a fix : groupement par DATE UNIQUE (fetched_at.date). Une date ne
    # peut pas être partagée entre splits — sinon des observations d'une
    # même journée tombent des 2 côtés de la frontière et l'audit leakage
    # le signale comme TEMPORAL LEAK.
    dates = pd.to_datetime(df["fetched_at"], utc=True).dt.date
    unique_dates = sorted(dates.unique())
    cum = 0
    counts_per_date: dict = {}
    # build cumulative row count per date (sorted)
    for d in unique_dates:
        counts_per_date[d] = int((dates == d).sum())
    cumulative: list[tuple] = []
    for d in unique_dates:
        cum += counts_per_date[d]
        cumulative.append((d, cum))

    target_train = int(n * FRACTIONS["train"])
    target_val = target_train + int(n * FRACTIONS["val"])
    target_cal = target_val + int(n * FRACTIONS["cal"])

    def _date_at(cumulative_target: int):
        for d, c in cumulative:
            if c >= cumulative_target:
                return d
        return cumulative[-1][0]

    d_train_end = _date_at(target_train)
    d_val_end = _date_at(target_val)
    d_cal_end = _date_at(target_cal)

    blocks = {
        "train": df[dates <= d_train_end],
        "val": df[(dates > d_train_end) & (dates <= d_val_end)],
        "cal": df[(dates > d_val_end) & (dates <= d_cal_end)],
        "test": df[dates > d_cal_end],
    }

    cutoffs = {
        "train_end_date": str(d_train_end),
        "val_end_date": str(d_val_end),
        "cal_end_date": str(d_cal_end),
        "test_end_date": str(unique_dates[-1]),
    }

    for name, block in blocks.items():
        out = V7A_SPLITS_DIR / f"{name}.parquet"
        block.to_parquet(out, index=False)
        log(f"wrote {name}", rows=len(block), path=str(out))

    meta = {
        "step": "split",
        "fractions": FRACTIONS,
        "cutoffs_utc": cutoffs,
        "sizes": {k: int(len(v)) for k, v in blocks.items()},
        "n_total": n,
    }
    write_manifest(V7A_SPLITS_DIR / "split_meta.json", meta)

    (V7A_SPLITS_DIR / "_guard_test.txt").write_text(
        "V7a test split — FROZEN.\n"
        "Ne pas lire ce fichier hors de scripts/train/v7a/backtest.py.\n"
        "Le helper _env.assert_test_split_not_read vérifie ça au runtime.\n",
        encoding="utf-8",
    )
    log("split done", **meta["sizes"])


if __name__ == "__main__":
    main()
