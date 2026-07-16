#!/usr/bin/env bash
# run_all_local.sh — orchestrateur V7a 100 % local.
#
# Pré-requis :
#   - python3 (3.11+ recommandé)
#   - pip3 install lightgbm==4.3.0 scikit-learn==1.5.0 pyarrow pandas numpy scipy
#   - dataset Kaggle dilwong ingéré dans real_price_samples (avec searchDate)
#     OU data/ml_cache/real_price_samples.parquet exporté.
#
# Usage :
#   bash scripts/train/v7a/run_all_local.sh [supabase|parquet|kaggle-raw CSV]
#
# Le script s'arrête à la première erreur. Il NE TOUCHE PAS au test split
# avant la phase backtest.
set -euo pipefail

cd "$(dirname "$0")/../../.."

MODE="${1:-parquet}"
KAGGLE_CSV="${2:-}"

echo "[v7a] === Phase 2 : build_dataset ==="
if [ "$MODE" = "kaggle-raw" ]; then
  python3 scripts/train/v7a/build_dataset.py --mode kaggle-raw --kaggle-csv "$KAGGLE_CSV"
else
  python3 scripts/train/v7a/build_dataset.py --mode "$MODE"
fi

echo "[v7a] === Phase 3 : split ==="
python3 scripts/train/v7a/split.py

echo "[v7a] === Phase 4 : features (causales) ==="
python3 scripts/train/v7a/features.py

echo "[v7a] === Phase 4b : build target (gain futur + drop bool) ==="
python3 scripts/train/v7a/build_target.py

echo "[v7a] === Phase 5 : audit leakage ==="
python3 scripts/train/v7a/audit_leakage.py

echo "[v7a] === Phase 6 : baselines ==="
python3 scripts/train/v7a/baselines.py

echo "[v7a] === Phase 7 : LightGBM quantile ==="
python3 scripts/train/v7a/lgbm_quantile.py

echo "[v7a] === Phase 8 : isotonic + conformal Mondrian ==="
python3 scripts/train/v7a/calibrate.py

echo "[v7a] === Phase 9 : backtest (lit le hold-out TEST) ==="
python3 scripts/train/v7a/backtest.py

echo "[v7a] === Résumé ==="
test -f reports/v7a_baselines.json && cat reports/v7a_baselines.json | head -c 2000; echo
test -f reports/v7a_lgbm_metrics.json && cat reports/v7a_lgbm_metrics.json
echo
test -f reports/v7a_conformal_metrics.json && head -c 2000 reports/v7a_conformal_metrics.json
echo
test -f reports/v7a_backtest.json && cat reports/v7a_backtest.json
echo "[v7a] DONE"
