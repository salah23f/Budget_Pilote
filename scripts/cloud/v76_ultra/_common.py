"""
_common.py — shared Modal app + image + volume for the V7.6 Ultra pipeline.

Every training/inference script under v76_ultra/ imports `app`, `volume` and
`base_image` from here so they land in a single Modal app with a single
persistent volume. That way:
  - Results produced by early scripts (Chronos, TiRex) are visible to later
    scripts (stacking, policy) via the same volume.
  - A failure in one function does NOT kill the others (each has its own
    try/except at the Modal function level and the orchestrator ignores
    failed slots at stacking time).
"""

from __future__ import annotations

import os
from pathlib import Path
import modal

APP_NAME = "flyeas-v76-ultra"
VOLUME_NAME = "flyeas-v75"     # reuse the volume already populated by V7.5
FEATURES_DIR = "/vol/features"
MODELS_DIR = "/vol/models_v76"
REPORT_DIR = "/vol/report_v76"

# Shared Modal objects -----------------------------------------------------
app = modal.App(APP_NAME)
volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)

# Bake this file into every container so `from _common import ...` works on Modal.
_COMMON_PATH = str(Path(__file__).resolve())

# Base image: CPU libs everyone needs. GPU-heavy libs are layered per-script.
base_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "numpy==1.26.4",
        "pandas==2.2.2",
        "pyarrow==16.1.0",
        "scipy==1.13.1",
        "scikit-learn==1.5.0",
        "lightgbm==4.3.0",
    )
    .add_local_file(_COMMON_PATH, "/root/_common.py", copy=True)
)

# GPU image: adds PyTorch on top of the base.
gpu_image = base_image.pip_install(
    "torch==2.3.1",
    "einops==0.8.0",
)


# ---------------------------------------------------------------------------
# Small helpers used by most per-model scripts
# ---------------------------------------------------------------------------


def ensure_dirs():
    """Create MODELS_DIR and REPORT_DIR inside the mounted volume."""
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(REPORT_DIR, exist_ok=True)


def load_split(split: str):
    """Load train/val/test features parquet. Returns a pandas DataFrame."""
    import pandas as pd
    path = f"{FEATURES_DIR}/{split}_features.parquet"
    df = pd.read_parquet(path)
    return df


def route_key(df):
    """Build route identifier column once for alignment between models."""
    return (df["origin"].astype(str) + "-" + df["destination"].astype(str)).values


def feature_cols(df):
    """Pick numeric, non-target, non-id columns used by every model."""
    import numpy as np
    cols = [
        c for c in df.columns
        if df[c].dtype in (np.float64, np.float32, np.int64, np.int32)
        and c != "price_usd"
        and "id" not in c.lower()
        and not c.startswith("Unnamed")
    ]
    return cols


def save_oof(df_oof, name: str):
    """Save an OOF parquet under MODELS_DIR with a canonical schema.

    Expected columns: route, actual, prediction (+ optional q10/q50/q90).
    `name` becomes `{MODELS_DIR}/{name}_oof_predictions.parquet`.
    """
    ensure_dirs()
    path = f"{MODELS_DIR}/{name}_oof_predictions.parquet"
    df_oof.to_parquet(path, index=False)
    print(f"  saved {len(df_oof):,} rows → {path}")
    return path


def seed_everything(seed: int = 42):
    """Seed numpy + torch + python-random for reproducibility across runs."""
    import random
    import numpy as np
    random.seed(seed)
    np.random.seed(seed)
    try:
        import torch
        torch.manual_seed(seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(seed)
    except ImportError:
        pass
