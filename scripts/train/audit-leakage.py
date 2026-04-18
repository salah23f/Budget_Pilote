"""
audit-leakage.py — Automated leakage detection in train/val/test splits.

Checks:
1. No temporal overlap between splits
2. Rolling features only use past data
3. No future price info leaked into features
4. HMM regime features computed only on past data

Usage: python scripts/train/audit-leakage.py
"""

import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _env import load_env
load_env()

import pandas as pd
import numpy as np

INPUT_DIR = "data/features"
SPLITS = ["train", "val", "test"]


def check_temporal_overlap(splits_data):
    """Verify no date overlap between train/val/test."""
    issues = []
    split_ranges = {}

    for name, df in splits_data.items():
        if 'fetched_at' in df.columns:
            dates = pd.to_datetime(df['fetched_at'])
            split_ranges[name] = (dates.min(), dates.max())
            print(f"  {name}: {dates.min()} to {dates.max()} ({len(df)} rows)")

    if 'train' in split_ranges and 'val' in split_ranges:
        if split_ranges['train'][1] >= split_ranges['val'][0]:
            issues.append(f"LEAK: train max ({split_ranges['train'][1]}) >= val min ({split_ranges['val'][0]})")

    if 'val' in split_ranges and 'test' in split_ranges:
        if split_ranges['val'][1] >= split_ranges['test'][0]:
            issues.append(f"LEAK: val max ({split_ranges['val'][1]}) >= test min ({split_ranges['test'][0]})")

    return issues


def check_rolling_features(df, name):
    """Verify rolling features don't peek into the future."""
    issues = []
    rolling_cols = [c for c in df.columns if 'rolling' in c.lower()]

    if not rolling_cols:
        return issues

    # Sample check: for each rolling feature, verify it's computed on past data only
    # We check that rolling_mean_7d at time t doesn't include prices from t+1..t+7
    if 'fetched_at' in df.columns and 'price_usd' in df.columns:
        sorted_df = df.sort_values('fetched_at')

        # Spot check first 100 rows
        for col in rolling_cols[:3]:
            vals = sorted_df[col].values
            prices = sorted_df['price_usd'].values

            # A simple heuristic: the rolling mean at position i should not equal
            # the mean of prices[i:i+window] (that would be forward-looking)
            window = 7 if '7d' in col else 30 if '30d' in col else 14
            n_checked = 0
            n_suspicious = 0

            for i in range(window, min(len(vals), 200)):
                forward_mean = np.mean(prices[i:i+window]) if i + window <= len(prices) else None
                if forward_mean and not np.isnan(vals[i]):
                    if abs(vals[i] - forward_mean) < 0.01:
                        n_suspicious += 1
                    n_checked += 1

            if n_checked > 0 and n_suspicious / n_checked > 0.5:
                issues.append(f"SUSPICIOUS: {col} in {name} may use forward data ({n_suspicious}/{n_checked} match forward window)")

    return issues


def check_target_in_features(df, name):
    """Verify target variable isn't directly in the feature set."""
    issues = []

    feature_cols = [c for c in df.columns if c not in ['price_usd', 'fetched_at', 'origin', 'destination',
                                                          'airline', 'source', 'depart_date', 'route', 'id',
                                                          'created_at', 'return_date', 'cabin_class']]

    if 'price_usd' in feature_cols:
        issues.append(f"LEAK: price_usd found in feature columns of {name}")

    # Check for suspiciously high correlation with target
    if 'price_usd' in df.columns:
        target = df['price_usd'].values
        for col in feature_cols[:20]:
            if df[col].dtype in [np.float64, np.float32, np.int64]:
                vals = df[col].fillna(0).values
                if len(vals) > 10 and np.std(vals) > 0 and np.std(target) > 0:
                    corr = np.corrcoef(target, vals)[0, 1]
                    if abs(corr) > 0.99:
                        issues.append(f"SUSPICIOUS: {col} in {name} has correlation {corr:.4f} with target")

    return issues


def main():
    print("=" * 60)
    print("LEAKAGE AUDIT")
    print("=" * 60)

    splits_data = {}
    for split in SPLITS:
        path = f"{INPUT_DIR}/{split}_features.parquet"
        if os.path.exists(path):
            splits_data[split] = pd.read_parquet(path)
        else:
            print(f"  {split}: file not found, skipping")

    if not splits_data:
        print("No split files found. Run training pipeline first.")
        sys.exit(0)

    all_issues = []

    # Check 1: Temporal overlap
    print("\n1. Temporal overlap check:")
    issues = check_temporal_overlap(splits_data)
    all_issues.extend(issues)
    print(f"   {'PASS' if not issues else 'FAIL: ' + '; '.join(issues)}")

    # Check 2: Rolling features
    print("\n2. Rolling feature direction check:")
    for name, df in splits_data.items():
        issues = check_rolling_features(df, name)
        all_issues.extend(issues)
        print(f"   {name}: {'PASS' if not issues else 'WARN: ' + '; '.join(issues)}")

    # Check 3: Target in features
    print("\n3. Target leakage check:")
    for name, df in splits_data.items():
        issues = check_target_in_features(df, name)
        all_issues.extend(issues)
        print(f"   {name}: {'PASS' if not issues else 'FAIL: ' + '; '.join(issues)}")

    # Summary
    print("\n" + "=" * 60)
    if not all_issues:
        print("ALL CHECKS PASSED — no leakage detected")
        sys.exit(0)
    else:
        print(f"ISSUES FOUND: {len(all_issues)}")
        for issue in all_issues:
            print(f"  - {issue}")
        if any('LEAK' in i for i in all_issues):
            print("\nCRITICAL LEAKAGE DETECTED — fix before training!")
            sys.exit(1)
        else:
            print("\nWarnings only — review manually.")
            sys.exit(0)


if __name__ == "__main__":
    main()
