"""
upload_features.py — Upload BudgetPilot features to a Modal persistent volume.

Run ONCE before train_v75_cloud.py. Reads local data/features/*.parquet and
pushes them into the `flyeas-v75` Modal volume so the training job can mount
it directly.

Usage (from project root):
    python3 scripts/cloud/upload_features.py
"""

import os
import sys
from pathlib import Path

try:
    import modal
except ImportError:
    print("ERROR: modal CLI not installed. Run: pip3 install modal")
    sys.exit(1)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
FEATURES_DIR = PROJECT_ROOT / "data" / "features"
VOLUME_NAME = "flyeas-v75"

REQUIRED = ["train_features.parquet", "val_features.parquet", "test_features.parquet"]


def main():
    # Sanity check: all three parquet files exist locally
    missing = [f for f in REQUIRED if not (FEATURES_DIR / f).exists()]
    if missing:
        print(f"ERROR: missing local parquet files: {missing}")
        print(f"Expected under: {FEATURES_DIR}")
        sys.exit(1)

    print(f"Local features dir: {FEATURES_DIR}")
    total_mb = sum((FEATURES_DIR / f).stat().st_size for f in REQUIRED) / 1e6
    print(f"Total to upload: {total_mb:.1f} MB")

    volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)

    with volume.batch_upload(force=True) as batch:
        for fname in REQUIRED:
            local = FEATURES_DIR / fname
            remote = f"/features/{fname}"
            size_mb = local.stat().st_size / 1e6
            print(f"  -> {fname} ({size_mb:.1f} MB) -> {remote}")
            batch.put_file(str(local), remote)

    print(f"\nDone. Files now available in Modal volume '{VOLUME_NAME}' under /features/")
    print(f"Next: modal run scripts/cloud/train_v75_cloud.py")


if __name__ == "__main__":
    main()
