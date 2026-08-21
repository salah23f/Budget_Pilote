#!/bin/bash
# run_all_fast.sh — runs the 4 optimized scripts in order.
#
# Order:
#   1. 04-fit-hmm-fast       (~5-10 min, uses hmmlearn)
#   2. 07-train-tft-fast     (~15-30 min)
#   3. 08-train-deepar-fast  (~15-30 min)
#   4. 13-validate-fast      (~5-10 min)
#
# Each step is independent: if one fails, the next still runs.

set -u
cd ~/Desktop/BudgetPilot_Live

LOG_DIR="logs"
mkdir -p "$LOG_DIR"

TS=$(date +%Y%m%d_%H%M)
SUMMARY="$LOG_DIR/all_fast_summary_$TS.log"

run_step () {
    local name="$1"
    local script="$2"
    local start_epoch
    start_epoch=$(date +%s)
    echo ""
    echo "===== $(date '+%H:%M:%S') — Running $name ====="
    if python3 "scripts/train/$script"; then
        local end_epoch
        end_epoch=$(date +%s)
        local dur=$((end_epoch - start_epoch))
        echo "===== $(date '+%H:%M:%S') — $name OK (${dur}s) ====="
        echo "OK  $name  ${dur}s" >> "$SUMMARY"
    else
        local end_epoch
        end_epoch=$(date +%s)
        local dur=$((end_epoch - start_epoch))
        echo "===== $(date '+%H:%M:%S') — $name FAILED (${dur}s) ====="
        echo "FAIL $name  ${dur}s" >> "$SUMMARY"
    fi
}

run_step "04-fit-hmm-fast"      "04-fit-hmm-fast.py"
run_step "07-train-tft-fast"    "07-train-tft-fast.py"
run_step "08-train-deepar-fast" "08-train-deepar-fast.py"
run_step "13-validate-fast"     "13-validate-fast.py"

echo ""
echo "===== ALL DONE $(date '+%H:%M:%S') ====="
echo "Summary:"
cat "$SUMMARY"
