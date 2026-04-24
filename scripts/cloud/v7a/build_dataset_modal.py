"""
build_dataset_modal.py — construit le dataset V7a sur Modal avec le
dataset complet (SAMPLE_EVERY=1 par défaut → 82M lignes brutes, ~80-100M
post-cleaning attendues). Résultat : /vol/data/ml_cache/v7a_clean_modal.parquet.

Pré-requis :
  1. Modal CLI authentifié (`modal token new`).
  2. kaggle.json uploadé sur le volume Modal :
       modal volume put flyeas-v7a ~/.kaggle/kaggle.json /kaggle/kaggle.json
     (ou passer les credentials via secret Modal `kaggle-creds`).
  3. Le zip n'a pas besoin d'être pré-uploadé — le container le téléchargera.

Utilisation :
  modal run scripts/cloud/v7a/build_dataset_modal.py::build
  # ou avec sampling explicite :
  modal run scripts/cloud/v7a/build_dataset_modal.py::build --sample-every 5

Coût estimé : CPU 32 GB, ~30-60 min → ~0.10-0.20 $.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _common import app, base_image, volume, VOL_DATA, VOL_KAGGLE, VOL_REPORTS, container_env  # noqa: E402

import modal  # noqa: E402


@app.function(
    image=base_image,
    volumes={"/vol": volume},
    cpu=4,
    memory=32 * 1024,  # 32 GB → full-data clean tient en RAM
    timeout=90 * 60,
    secrets=[modal.Secret.from_name("kaggle-creds", required_keys=["KAGGLE_USERNAME", "KAGGLE_KEY"])],
)
def build(sample_every: int = 1) -> dict:
    """Télécharge le zip Kaggle et produit v7a_clean_modal.parquet sur /vol.

    Args:
        sample_every: 1 = full-data (défaut). Permet d'appeler avec 5 ou 10
                      pour un sous-échantillon si le full-data est trop long
                      ou trop coûteux.
    """
    import json
    import os
    import subprocess

    env = container_env({"V7A_SAMPLE_EVERY": str(sample_every)})
    for k, v in env.items():
        os.environ[k] = v

    # kaggle CLI lit ~/.kaggle/kaggle.json OU les env KAGGLE_USERNAME/KAGGLE_KEY.
    # Le secret Modal injecte les envs ; on s'assure d'un ~/.kaggle aussi pour
    # compatibilité.
    kaggle_json = Path.home() / ".kaggle" / "kaggle.json"
    if not kaggle_json.exists():
        kaggle_json.parent.mkdir(parents=True, exist_ok=True)
        kaggle_json.write_text(
            json.dumps(
                {
                    "username": os.environ["KAGGLE_USERNAME"],
                    "key": os.environ["KAGGLE_KEY"],
                }
            ),
            encoding="utf-8",
        )
        os.chmod(kaggle_json, 0o600)

    # Le script fetch_dilwong.py est injecté dans /root/v7a par l'image Modal.
    cmd = ["python3", "/root/v7a/fetch_dilwong.py"]
    print(f"[v7a:modal] running {cmd} with SAMPLE_EVERY={sample_every}")
    res = subprocess.run(cmd, cwd="/root/v7a", env=os.environ, check=False)
    if res.returncode != 0:
        raise RuntimeError(f"fetch_dilwong.py failed (exit={res.returncode})")

    # Persist artefacts sur le Volume.
    volume.commit()

    dataset = Path(VOL_DATA) / "ml_cache" / "v7a_clean_modal.parquet"
    manifest = Path(VOL_DATA) / "ml_cache" / "v7a_clean_modal.manifest.json"
    report = Path(VOL_REPORTS) / "v7a_dataset_sampling_report_modal.json"
    out = {
        "dataset_exists": dataset.exists(),
        "dataset_bytes": dataset.stat().st_size if dataset.exists() else 0,
        "manifest": json.loads(manifest.read_text()) if manifest.exists() else None,
        "sampling_report": json.loads(report.read_text()) if report.exists() else None,
        "sample_every": sample_every,
    }
    print(f"[v7a:modal] done {json.dumps({k: v for k, v in out.items() if k != 'sampling_report'}, default=str)[:500]}")
    return out


@app.local_entrypoint()
def main(sample_every: int = 1) -> None:
    """Point d'entrée local : `modal run scripts/cloud/v7a/build_dataset_modal.py`."""
    import json
    result = build.remote(sample_every=sample_every)
    print(json.dumps(result, indent=2, default=str)[:5000])
