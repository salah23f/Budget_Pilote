#!/usr/bin/env bash
# ===========================================================================
# Flyeas V7.6 Ultra — MAX POWER Full Pipeline
# Run: bash scripts/cloud/v76_ultra/run_max_power.sh
# Budget: max $10 Modal credits
# Wall time: ~4-6h
# ===========================================================================
set -euo pipefail

cd ~/Desktop/BudgetPilot_Live
LOGDIR="logs/v76_max_power"
mkdir -p "$LOGDIR"
LOGFILE="$LOGDIR/run_$(date +%Y%m%d_%H%M%S).log"
exec > >(tee -a "$LOGFILE") 2>&1

echo "===== V7.6 MAX POWER — $(date) ====="

# ---------------------------------------------------------------------------
# PHASE 0 — Cleanup crash-looping apps
# ---------------------------------------------------------------------------
echo ""
echo "=== PHASE 0: Cleanup ==="
python3 -m modal app list 2>&1 | tee /tmp/v76_apps.txt
# Stop any running flyeas-v76 ephemeral apps
for app_id in $(grep -i "flyeas-v76" /tmp/v76_apps.txt | grep -iE "running|ephemeral" | awk '{print $1}' || true); do
    echo "Stopping crash-looping app: $app_id"
    python3 -m modal app stop "$app_id" || true
done
echo "Phase 0 done."

# ---------------------------------------------------------------------------
# PHASE 1 — Commit Phase 1 + Phase 2 code optimizations
# ---------------------------------------------------------------------------
echo ""
echo "=== PHASE 1: Commit optimizations ==="
git add scripts/cloud/v76_ultra/
git status --short scripts/cloud/v76_ultra/
git commit -m "feat(v76): MAX POWER optim — bf16, early stop, per-route conformal, A100, larger models

- PatchTST/MLCAFormer: epochs 30, d_model 96, bf16, early stop patience=4
- Mamba: epochs 25, d_model 96, n_layers 5, bf16, early stop
- TimeGrad: epochs 25, n_samples_eval 80, bf16
- TS2Vec: pretrain 15 epochs, head 20 epochs, bf16
- IQN: epochs 20, CVaR tau [0, 0.15]
- BOCPD: O(n²)->O(n) sliding window max_rl=200, u_quantile 0.93
- Conformal: per-route offsets when n>=30
- Backtest: uses per-route conformal c_alpha
- XGBoost meta: n_estimators 1000, max_depth 8, early_stopping_rounds=50
- Foundation: chronos2/moirai2/timesfm -> A100, larger timeouts

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>" || echo "Nothing to commit (already committed)"
git push || echo "Push failed or nothing to push"
echo "Phase 1 done."

# ---------------------------------------------------------------------------
# PHASE 2 — Inventory volume
# ---------------------------------------------------------------------------
echo ""
echo "=== PHASE 2: Volume inventory ==="
echo "--- Features ---"
python3 -m modal volume ls flyeas-v75 /features/ 2>&1 || echo "No /features/ dir"
echo "--- Models v76 ---"
python3 -m modal volume ls flyeas-v75 /models_v76/ 2>&1 | tee /tmp/v76_inventory.txt || echo "No /models_v76/ dir yet"

# Helper: check if a model parquet exists
has_model() {
    grep -q "${1}_oof_predictions" /tmp/v76_inventory.txt 2>/dev/null
}

# ---------------------------------------------------------------------------
# PHASE 3 — Foundation models (launch missing, ~25 min)
# ---------------------------------------------------------------------------
echo ""
echo "=== PHASE 3: Foundation models ==="
FOUND_COUNT=0

if ! has_model "chronos2"; then
    echo "Launching chronos2..."
    python3 -m modal run --detach scripts/cloud/v76_ultra/models/chronos2_inference_v2.py::run_chronos2_v2
else
    echo "chronos2 already present"; ((FOUND_COUNT++)) || true
fi

if ! has_model "tirex"; then
    echo "Launching tirex..."
    python3 -m modal run --detach scripts/cloud/v76_ultra/models/tirex_inference_v2.py::run_tirex_v2
else
    echo "tirex already present"; ((FOUND_COUNT++)) || true
fi

if ! has_model "moirai2"; then
    echo "Launching moirai2..."
    python3 -m modal run --detach scripts/cloud/v76_ultra/models/moirai2_inference_v2.py::run_moirai2_v2
else
    echo "moirai2 already present"; ((FOUND_COUNT++)) || true
fi

if ! has_model "timesfm"; then
    echo "Launching timesfm..."
    python3 -m modal run --detach scripts/cloud/v76_ultra/models/timesfm_inference_v2.py::run_timesfm_v2
else
    echo "timesfm already present"; ((FOUND_COUNT++)) || true
fi

if [ "$FOUND_COUNT" -lt 4 ]; then
    echo "Waiting for foundation models... (polling every 5 min)"
    for attempt in 1 2 3 4 5 6; do
        sleep 300
        echo "--- Poll $attempt ($(date)) ---"
        python3 -m modal app list 2>&1 | grep -iE "flyeas|v76" || true
        python3 -m modal volume ls flyeas-v75 /models_v76/ 2>&1 | tee /tmp/v76_inventory.txt || true
        FCOUNT=0
        has_model "chronos2" && ((FCOUNT++)) || true
        has_model "tirex" && ((FCOUNT++)) || true
        has_model "moirai2" && ((FCOUNT++)) || true
        has_model "timesfm" && ((FCOUNT++)) || true
        echo "Foundation models present: $FCOUNT/4"
        if [ "$FCOUNT" -ge 3 ]; then
            echo "Gate passed: >=3/4 foundation models"
            break
        fi
    done
fi
echo "Phase 3 done."

# ---------------------------------------------------------------------------
# PHASE 4 — Custom trained wave A (~1h30)
# ---------------------------------------------------------------------------
echo ""
echo "=== PHASE 4: Custom wave A ==="
# patchtst SKIPPED — OOM bug (tries to load 75 GiB on GPU), will fix separately
echo "SKIPPING patchtst (known OOM bug, will be fixed and relaunched separately)"
if ! has_model "mamba"; then
    python3 -m modal run --detach scripts/cloud/v76_ultra/models/mamba_timemachine.py::train_mamba || echo "  mamba launch failed, continuing"
fi
if ! has_model "kan"; then
    python3 -m modal run --detach scripts/cloud/v76_ultra/models/kan_train.py::train_kan || echo "  kan launch failed, continuing"
fi
if ! has_model "garch_nn"; then
    python3 -m modal run --detach scripts/cloud/v76_ultra/models/garch_nn_train.py::train_garch_nn || echo "  garch_nn launch failed, continuing"
fi

echo "Wave A launched. Polling every 10 min..."
for attempt in 1 2 3 4 5 6 7 8 9 10; do
    sleep 600
    echo "--- Wave A poll $attempt ($(date)) ---"
    python3 -m modal app list 2>&1 | grep -iE "flyeas|v76" || true
    python3 -m modal volume ls flyeas-v75 /models_v76/ 2>&1 | tee /tmp/v76_inventory.txt || true
    ACOUNT=0
    has_model "patchtst" && ((ACOUNT++)) || true
    has_model "mamba" && ((ACOUNT++)) || true
    has_model "kan" && ((ACOUNT++)) || true
    has_model "garch_nn" && ((ACOUNT++)) || true
    echo "Wave A models: $ACOUNT/4"
    # Check if all wave A apps are stopped
    RUNNING=$(python3 -m modal app list 2>&1 | grep -iE "flyeas-v76" | grep -icE "running|starting" || true)
    if [ "$RUNNING" = "0" ] || [ "$ACOUNT" -ge 3 ]; then
        echo "Wave A gate passed ($ACOUNT/4 present, $RUNNING running)"
        break
    fi
done
echo "Phase 4 done."

# ---------------------------------------------------------------------------
# PHASE 5 — Custom trained wave B (~1h30)
# ---------------------------------------------------------------------------
echo ""
echo "=== PHASE 5: Custom wave B ==="
if ! has_model "mlcaformer"; then
    python3 -m modal run --detach scripts/cloud/v76_ultra/models/mlcaformer_train.py::train_mlcaformer || echo "  mlcaformer launch failed, continuing"
fi
if ! has_model "timegrad"; then
    python3 -m modal run --detach scripts/cloud/v76_ultra/models/timegrad_diffusion.py::train_timegrad || echo "  timegrad launch failed, continuing"
fi
if ! has_model "ts2vec"; then
    python3 -m modal run --detach scripts/cloud/v76_ultra/models/ts2vec_pretrain.py::train_ts2vec || echo "  ts2vec launch failed, continuing"
fi

echo "Wave B launched. Polling every 10 min..."
for attempt in 1 2 3 4 5 6 7 8 9 10; do
    sleep 600
    echo "--- Wave B poll $attempt ($(date)) ---"
    python3 -m modal app list 2>&1 | grep -iE "flyeas|v76" || true
    python3 -m modal volume ls flyeas-v75 /models_v76/ 2>&1 | tee /tmp/v76_inventory.txt || true
    # Count total level-0 models
    TOTAL=0
    for m in chronos2 tirex moirai2 timesfm patchtst mamba kan garch_nn mlcaformer timegrad ts2vec; do
        has_model "$m" && ((TOTAL++)) || true
    done
    echo "Total level-0 models: $TOTAL/11"
    RUNNING=$(python3 -m modal app list 2>&1 | grep -iE "flyeas-v76" | grep -icE "running|starting" || true)
    if [ "$RUNNING" = "0" ] || [ "$TOTAL" -ge 7 ]; then
        echo "Wave B gate passed ($TOTAL/11 total, $RUNNING running)"
        break
    fi
done

if [ "$TOTAL" -lt 7 ]; then
    echo "WARNING: Only $TOTAL/11 level-0 models. Proceeding with partial ensemble."
fi
echo "Phase 5 done."

# ---------------------------------------------------------------------------
# PHASE 6 — Stacking (sequential)
# ---------------------------------------------------------------------------
echo ""
echo "=== PHASE 6: Stacking ==="

echo "Launching xgb_meta..."
python3 -m modal run --detach scripts/cloud/v76_ultra/stacking/xgb_meta.py::fit_xgb_meta || echo "  xgb_meta launch failed, continuing"
for i in 1 2 3 4 5 6; do
    sleep 300
    RUNNING=$(python3 -m modal app list 2>&1 | grep -iE "xgb\|meta" | grep -icE "running|starting" || echo "0")
    [ "$RUNNING" = "0" ] && break
    echo "  xgb_meta still running (poll $i)..."
done

echo "Launching bma..."
python3 -m modal run --detach scripts/cloud/v76_ultra/stacking/bma_aggregator.py::fit_bma || echo "  bma launch failed, continuing"
for i in 1 2 3 4; do
    sleep 300
    RUNNING=$(python3 -m modal app list 2>&1 | grep -iE "bma" | grep -icE "running|starting" || echo "0")
    [ "$RUNNING" = "0" ] && break
    echo "  bma still running (poll $i)..."
done

echo "Launching copula..."
python3 -m modal run --detach scripts/cloud/v76_ultra/stacking/copula_ensemble.py::fit_copula || echo "  copula launch failed, continuing"
for i in 1 2 3 4; do
    sleep 300
    RUNNING=$(python3 -m modal app list 2>&1 | grep -iE "copula" | grep -icE "running|starting" || echo "0")
    [ "$RUNNING" = "0" ] && break
    echo "  copula still running (poll $i)..."
done

python3 -m modal volume ls flyeas-v75 /models_v76/ 2>&1 | tee /tmp/v76_inventory.txt || true
ENS_COUNT=0
has_model "xgb_meta" && ((ENS_COUNT++)) || true
has_model "bma" && ((ENS_COUNT++)) || true
has_model "copula" && ((ENS_COUNT++)) || true
echo "Ensemble models: $ENS_COUNT/3"
if [ "$ENS_COUNT" -lt 1 ]; then
    echo "FATAL: No ensemble produced. Backtest cannot proceed."
    echo "Generating partial report..."
fi
echo "Phase 6 done."

# ---------------------------------------------------------------------------
# PHASE 7 — Policy (parallel)
# ---------------------------------------------------------------------------
echo ""
echo "=== PHASE 7: Policy ==="
python3 -m modal run --detach scripts/cloud/v76_ultra/policy/bocpd_evt.py::compute_bocpd_and_evt || echo "  bocpd_evt launch failed, continuing"
python3 -m modal run --detach scripts/cloud/v76_ultra/policy/iqn_policy.py::train_iqn || echo "  iqn launch failed, continuing"
python3 -m modal run --detach scripts/cloud/v76_ultra/policy/thompson_sampling.py::fit_thompson || echo "  thompson launch failed, continuing"
python3 -m modal run --detach scripts/cloud/v76_ultra/policy/conformal_os.py::calibrate_conformal || echo "  conformal launch failed, continuing"

echo "Policy jobs launched. Polling..."
for attempt in 1 2 3 4 5 6 7 8; do
    sleep 300
    echo "--- Policy poll $attempt ($(date)) ---"
    python3 -m modal app list 2>&1 | grep -iE "flyeas|v76" || true
    RUNNING=$(python3 -m modal app list 2>&1 | grep -iE "flyeas-v76" | grep -icE "running|starting" || echo "0")
    echo "Running apps: $RUNNING"
    [ "$RUNNING" = "0" ] && break
done

python3 -m modal volume ls flyeas-v75 /models_v76/ 2>&1 | tee /tmp/v76_inventory.txt
if ! grep -q "conformal_calibration" /tmp/v76_inventory.txt 2>/dev/null; then
    echo "WARNING: conformal_calibration.json missing. Backtest will use c_alpha=0."
fi
echo "Phase 7 done."

# ---------------------------------------------------------------------------
# PHASE 8 — Backtest final
# ---------------------------------------------------------------------------
echo ""
echo "=== PHASE 8: Backtest ==="
if [ "$ENS_COUNT" -ge 1 ]; then
    python3 -m modal run --detach scripts/cloud/v76_ultra/policy/v76_backtest.py::run_backtest || echo "  backtest launch failed, continuing"
    for attempt in 1 2 3 4; do
        sleep 300
        echo "--- Backtest poll $attempt ($(date)) ---"
        python3 -m modal volume ls flyeas-v75 /report_v76/ 2>&1 || true
        if python3 -m modal volume ls flyeas-v75 /report_v76/ 2>&1 | grep -q "v76_summary"; then
            echo "Backtest complete!"
            break
        fi
        RUNNING=$(python3 -m modal app list 2>&1 | grep -iE "flyeas-v76" | grep -icE "running|starting" || echo "0")
        [ "$RUNNING" = "0" ] && break
    done

    # Retry once if needed
    if ! python3 -m modal volume ls flyeas-v75 /report_v76/ 2>&1 | grep -q "v76_summary"; then
        echo "Retrying backtest..."
        python3 -m modal run --detach scripts/cloud/v76_ultra/policy/v76_backtest.py::run_backtest || echo "  backtest retry failed"
        sleep 600
    fi
else
    echo "SKIP: No ensemble available for backtest."
fi
echo "Phase 8 done."

# ---------------------------------------------------------------------------
# PHASE 9 — Download artifacts
# ---------------------------------------------------------------------------
echo ""
echo "=== PHASE 9: Download artifacts ==="
mkdir -p models_v76_cloud report_v76_cloud
python3 -m modal volume get flyeas-v75 models_v76/ ./models_v76_cloud/ 2>&1 || echo "Download models failed"
python3 -m modal volume get flyeas-v75 report_v76/ ./report_v76_cloud/ 2>&1 || echo "Download report failed"

echo "--- Downloaded files ---"
ls -la models_v76_cloud/ 2>/dev/null || echo "No models downloaded"
ls -la report_v76_cloud/ 2>/dev/null || echo "No report downloaded"

if [ -f report_v76_cloud/v76_summary.json ]; then
    echo ""
    echo "=== V7.6 SUMMARY ==="
    cat report_v76_cloud/v76_summary.json
fi

echo ""
echo "===== V7.6 MAX POWER COMPLETE — $(date) ====="
echo "Log saved to: $LOGFILE"
echo ""
echo "NEXT: Run Claude Code again to generate the final report and commit."
echo "  Claude will read models_v76_cloud/ and report_v76_cloud/ to produce"
echo "  docs/flyeas-v76-training-report.md"
