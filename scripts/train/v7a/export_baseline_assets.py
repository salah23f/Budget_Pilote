"""
v7a/export_baseline_assets.py — export des artefacts statiques nécessaires
au serving de la baseline composée `ensemble_ttd_switch` (moteur primaire V7a
après pivot A).

Produit un fichier JSON compact que l'endpoint Modal (serve.py) charge au
démarrage. Ne dépend d'aucun modèle ML.

Artefacts exportés :
  - q10_train_route : dict { "ORIG-DEST" : float } — Q10 des prix train
    par route (utilisé quand TTD > 7)
  - route_popularity : dict { "ORIG-DEST" : int } — nb obs train/route
    (utilisé pour gate `route_known`)
  - train_meta : metadata (rows, routes, date range, build sha)

Le rolling_min_30 (utilisé pour TTD ≤ 7) est calculé AU RUNTIME depuis
l'historique de prix envoyé par le client dans la requête predict.

Input  : data/features_v7a_<tag>/train.parquet
Output : data/models_v7a_<tag>/baseline_assets.json

Run :
  python3 scripts/train/v7a/export_baseline_assets.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _env import V7A_FEATURES_DIR, V7A_MODELS_DIR, V7A_TAG, ensure_dirs, git_sha, log  # noqa: E402

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402


def main() -> None:
    ensure_dirs()
    train_path = V7A_FEATURES_DIR / "train.parquet"
    if not train_path.exists():
        raise SystemExit(f"{train_path} missing — run features.py first")

    df = pd.read_parquet(train_path, columns=["route", "price_usd", "fetched_at"])
    log("train loaded", rows=len(df), routes=df["route"].nunique())

    q10_by_route = df.groupby("route")["price_usd"].quantile(0.10).to_dict()
    pop_by_route = df.groupby("route").size().to_dict()

    min_date = str(pd.to_datetime(df["fetched_at"], utc=True).min())
    max_date = str(pd.to_datetime(df["fetched_at"], utc=True).max())

    assets = {
        "schema_version": 1,
        "v7a_tag": V7A_TAG,
        "git_sha": git_sha(),
        "train_meta": {
            "rows": int(len(df)),
            "routes": int(df["route"].nunique()),
            "min_date": min_date,
            "max_date": max_date,
        },
        "q10_train_route": {r: float(v) for r, v in q10_by_route.items()},
        "route_popularity": {r: int(v) for r, v in pop_by_route.items()},
        "rolling_min_window_days": 30,
        "ttd_switch_threshold": 7,
    }

    out = V7A_MODELS_DIR / "baseline_assets.json"
    out.write_text(json.dumps(assets, indent=2), encoding="utf-8")
    log(
        "baseline assets written",
        path=str(out),
        routes=len(q10_by_route),
        size_kb=out.stat().st_size // 1024,
    )


if __name__ == "__main__":
    main()
