"""
_env.py — helpers partagés par les scripts V7a.

Supporte deux modes d'exécution via variables d'env :

  V7A_TAG         = 'local' (défaut) | 'modal' | toute autre étiquette.
                    Les splits / features / modèles / rapports sont écrits
                    dans des dossiers tagués (`splits_v7a_local/`,
                    `splits_v7a_modal/`, etc.) pour qu'un run local n'écrase
                    jamais un run Modal et réciproquement.

  V7A_DATA_ROOT   = /chemin/vers/data (défaut : REPO_ROOT/data). Côté Modal
                    on passe `/vol` pour que tout aille sur le Volume partagé.

  V7A_REPORTS_ROOT = /chemin/vers/reports (défaut : REPO_ROOT/reports).

  V7A_SAMPLE_EVERY = int. Seulement utilisé par fetch_dilwong.py pour la
                     version Modal qui peut demander `1` (full-data) ou un
                     sous-sampling moins agressif (ex. `5`).
"""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[3]

V7A_TAG = os.environ.get("V7A_TAG", "local").strip() or "local"
V7A_DATA_ROOT = Path(os.environ.get("V7A_DATA_ROOT", str(REPO_ROOT / "data")))
V7A_REPORTS_ROOT = Path(os.environ.get("V7A_REPORTS_ROOT", str(REPO_ROOT / "reports")))

DATA_DIR = V7A_DATA_ROOT
ML_CACHE = DATA_DIR / "ml_cache"
V7A_DATASET_PATH = ML_CACHE / f"v7a_clean_{V7A_TAG}.parquet"
V7A_SPLITS_DIR = DATA_DIR / f"splits_v7a_{V7A_TAG}"
V7A_FEATURES_DIR = DATA_DIR / f"features_v7a_{V7A_TAG}"
V7A_MODELS_DIR = DATA_DIR / f"models_v7a_{V7A_TAG}"
V7A_REPORTS_DIR = V7A_REPORTS_ROOT
V7A_AUDIT_DIR = DATA_DIR / "audit"


def tagged_report(basename: str, ext: str = "json") -> Path:
    """Retourne `reports/v7a_<basename>_<tag>.<ext>`."""
    V7A_REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    return V7A_REPORTS_DIR / f"v7a_{basename}_{V7A_TAG}.{ext}"


def ensure_dirs() -> None:
    for d in (
        ML_CACHE,
        V7A_SPLITS_DIR,
        V7A_FEATURES_DIR,
        V7A_MODELS_DIR,
        V7A_REPORTS_DIR,
        V7A_AUDIT_DIR,
    ):
        d.mkdir(parents=True, exist_ok=True)


def load_env() -> None:
    """Charge .env.local puis .env si présents — zero-dep."""
    for name in (".env.local", ".env"):
        p = REPO_ROOT / name
        if not p.exists():
            continue
        for line in p.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            os.environ.setdefault(k, v)


def log(msg: str, **kv: Any) -> None:
    prefix = f"[v7a:{V7A_TAG}]"
    suffix = " ".join(f"{k}={v}" for k, v in kv.items()) if kv else ""
    sys.stderr.write(f"{prefix} {msg} {suffix}\n".rstrip() + "\n")


def git_sha() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=str(REPO_ROOT),
            stderr=subprocess.DEVNULL,
        ).decode().strip()
    except Exception:
        return "nogit"


def hash_file(path: Path, algo: str = "sha256", chunk: int = 1_000_000) -> str:
    h = hashlib.new(algo)
    with path.open("rb") as f:
        for block in iter(lambda: f.read(chunk), b""):
            h.update(block)
    return h.hexdigest()


def write_manifest(path: Path, extra: dict[str, Any]) -> None:
    manifest = {
        "v7a_version": "0.1.0",
        "v7a_tag": V7A_TAG,
        "git_sha": git_sha(),
        "ts_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "python_version": sys.version.split()[0],
    }
    manifest.update(extra)
    path.write_text(json.dumps(manifest, indent=2, default=str), encoding="utf-8")


def assert_test_split_not_read(called_from: str) -> None:
    """Garde-fou : crash si le hold-out test est lu hors du backtest."""
    allowed = {"backtest.py", "backtest_modal.py", "v7a_full_backtest.py"}
    if Path(called_from).name not in allowed:
        raise RuntimeError(
            f"[v7a] tentative de lecture du split `test` depuis {called_from}. "
            f"Seuls {allowed} sont autorisés (voir docs/V7A_SPLIT.md)."
        )
