"""
run_v7a_modal.py — orchestrateur pipeline V7a full-data sur Modal.

Enchaîne phases 3 à 9 (split, features, audit, baselines, lgbm, calibrate,
backtest) en appelant les MÊMES scripts locaux `scripts/train/v7a/*.py`
mais dans un container Modal où `V7A_TAG=modal` et `V7A_DATA_ROOT=/vol/data`.

Tous les artefacts vivent dans le Volume Modal `flyeas-v7a`. Les reports
sont téléchargeables en local via :
    modal volume get flyeas-v7a reports/v7a_backtest_modal.json - \
      > reports/v7a_backtest_modal.json

Pré-requis :
  - build_dataset_modal.py a tourné (v7a_clean_modal.parquet présent).

Usage :
  modal run scripts/cloud/v7a/run_v7a_modal.py          # pipeline complet
  modal run scripts/cloud/v7a/run_v7a_modal.py::backtest_only  # juste backtest
  modal run scripts/cloud/v7a/run_v7a_modal.py::lgbm_only       # juste LGBM

Coût estimé (full-data ~80M lignes) :
  - features : 10-20 min CPU 16 GB → ~0.10 $
  - lgbm    : 30-60 min CPU 32 GB → ~0.20-0.40 $
  - reste   : 5-10 min chacun → négligeable
  Total    : ≈ 1-2 $ par run complet. Largement dans les 30 $ restants.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _common import app, base_image, volume, container_env  # noqa: E402


def _run(script_name: str, env_extra: dict | None = None, cwd: str = "/root/v7a") -> None:
    import os
    import subprocess
    env = os.environ.copy()
    env.update(container_env(env_extra or {}))
    print(f"[v7a:modal] run {script_name}")
    res = subprocess.run(["python3", f"/root/v7a/{script_name}"], cwd=cwd, env=env, check=False)
    if res.returncode != 0:
        raise RuntimeError(f"{script_name} failed (exit={res.returncode})")


@app.function(image=base_image, volumes={"/vol": volume}, cpu=4, memory=16 * 1024, timeout=60 * 60)
def step_split() -> None:
    _run("split.py")
    volume.commit()


@app.function(image=base_image, volumes={"/vol": volume}, cpu=8, memory=32 * 1024, timeout=90 * 60)
def step_features() -> None:
    _run("features.py")
    volume.commit()


@app.function(image=base_image, volumes={"/vol": volume}, cpu=8, memory=32 * 1024, timeout=90 * 60)
def step_build_target() -> None:
    """Construit target_future_gain / target_future_drop après features."""
    _run("build_target.py")
    volume.commit()


@app.function(image=base_image, volumes={"/vol": volume}, cpu=4, memory=16 * 1024, timeout=30 * 60)
def step_audit_leakage() -> None:
    _run("audit_leakage.py")
    volume.commit()


@app.function(image=base_image, volumes={"/vol": volume}, cpu=8, memory=32 * 1024, timeout=90 * 60)
def step_baselines() -> None:
    _run("baselines.py")
    volume.commit()


@app.function(image=base_image, volumes={"/vol": volume}, cpu=8, memory=32 * 1024, timeout=120 * 60)
def step_lgbm() -> None:
    _run("lgbm_quantile.py")
    volume.commit()


@app.function(image=base_image, volumes={"/vol": volume}, cpu=4, memory=16 * 1024, timeout=60 * 60)
def step_calibrate() -> None:
    _run("calibrate.py")
    volume.commit()


@app.function(image=base_image, volumes={"/vol": volume}, cpu=8, memory=32 * 1024, timeout=120 * 60)
def step_backtest() -> None:
    _run("backtest.py")
    volume.commit()


# ----- Orchestrators ---------------------------------------------------------


@app.local_entrypoint()
def main() -> None:
    """Full pipeline (phases 3-9), séquentiel."""
    print("[v7a:modal] starting full pipeline")
    step_split.remote()
    step_features.remote()
    step_build_target.remote()
    step_audit_leakage.remote()
    step_baselines.remote()
    step_lgbm.remote()
    step_calibrate.remote()
    step_backtest.remote()
    print(
        "[v7a:modal] DONE. Download reports with:\n"
        "  modal volume get flyeas-v7a /reports ./reports_modal\n"
        "or one file :\n"
        "  modal volume get flyeas-v7a /reports/v7a_backtest_modal.json -"
    )


@app.local_entrypoint()
def lgbm_only() -> None:
    step_lgbm.remote()
    step_calibrate.remote()


@app.local_entrypoint()
def backtest_only() -> None:
    step_backtest.remote()


@app.local_entrypoint()
def baselines_only() -> None:
    step_baselines.remote()
