#!/bin/bash
set -e
cd ~/Desktop/BudgetPilot_Live
for s in 05-fit-qrf 06-train-lstm 07-train-tft 08-train-deepar 09-train-vae 10-train-maml 11-train-cql 12-fit-ensemble 13-validate; do
  echo ""
  echo "===== $(date '+%H:%M:%S') — $s ====="
  python3 scripts/train/$s.py
done
echo ""
echo "===== ALL DONE $(date '+%H:%M:%S') ====="
