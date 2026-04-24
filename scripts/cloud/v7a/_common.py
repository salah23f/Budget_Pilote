"""
_common.py — app Modal + volume + image partagés pour V7a cloud.

Toutes les functions Modal V7a (build_dataset, train, calibrate, backtest)
importent ces singletons pour vivre dans une seule app `flyeas-v7a` et un
seul Volume `flyeas-v7a`.

Le Volume contient :
  /vol/data/kaggle/dilwong_flightprices/flightprices.zip  (téléchargé 1×)
  /vol/data/ml_cache/v7a_clean_modal.parquet
  /vol/data/splits_v7a_modal/*.parquet
  /vol/data/features_v7a_modal/*.parquet
  /vol/data/models_v7a_modal/*.pkl, *.parquet, *.json
  /vol/data/audit/leakage_report.json
  /vol/reports/v7a_*_modal.json

Les scripts V7a locaux sont injectés dans l'image via `add_local_dir`, de
sorte que chaque container Modal peut exécuter :
    V7A_TAG=modal V7A_DATA_ROOT=/vol/data V7A_REPORTS_ROOT=/vol/reports \
      python3 /root/v7a/<script>.py

sans différence de logique avec le run local — seuls les chemins et le tag
changent.
"""

from __future__ import annotations

from pathlib import Path

import modal

APP_NAME = "flyeas-v7a"
VOLUME_NAME = "flyeas-v7a"

app = modal.App(APP_NAME)
volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)

REPO_ROOT = Path(__file__).resolve().parents[3]
V7A_LOCAL_DIR = REPO_ROOT / "scripts" / "train" / "v7a"

# Image Modal : deps Python + code V7a local monté dans /root/v7a.
# Kaggle CLI fait partie des deps car build_dataset_modal l'utilise.
base_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "numpy==1.26.4",
        "pandas==2.2.2",
        "pyarrow==16.1.0",
        "scipy==1.13.1",
        "scikit-learn==1.5.0",
        "lightgbm==4.3.0",
        "kaggle==1.6.17",
    )
    .add_local_dir(str(V7A_LOCAL_DIR), "/root/v7a", copy=True)
)


# Chemins canoniques côté container ------------------------------------------
VOL_ROOT = "/vol"
VOL_DATA = f"{VOL_ROOT}/data"
VOL_REPORTS = f"{VOL_ROOT}/reports"
VOL_KAGGLE = f"{VOL_DATA}/kaggle/dilwong_flightprices"


def container_env(extra: dict[str, str] | None = None) -> dict[str, str]:
    env = {
        "V7A_TAG": "modal",
        "V7A_DATA_ROOT": VOL_DATA,
        "V7A_REPORTS_ROOT": VOL_REPORTS,
        "V7A_KAGGLE_DIR": VOL_KAGGLE,
        "PYTHONUNBUFFERED": "1",
    }
    if extra:
        env.update(extra)
    return env
