# V7.6 Ultra — Launch Guide (revised, working commands)

Pipeline fixes landed in this revision:

1. **Orchestrator works now.** Each per-script file no longer registers an
   `@app.local_entrypoint()`, so `run_all_v3.py` can import them all under
   the shared `flyeas-v76-ultra` app without the `Duplicate local entrypoint
   name: main` error.
2. **`v76_backtest.py` now actually uses the ensemble.** The meta-learner
   predictions are loaded and used as a per-route "fair price" anchor
   (60% ensemble + 40% EMA), instead of being loaded then ignored.
3. **GARCH-NN uses dynamic volatility.** An EWMA (λ=0.94) variance is now
   recomputed per sliding window, plus a short-term vol feature, so the
   model sees real-time volatility changes instead of static per-route
   GARCH params.
4. **Reproducibility.** Every neural training script calls
   `seed_everything(42)` so re-runs produce identical OOF files.

## Pre-flight

```bash
cd ~/Desktop/BudgetPilot_Live
python3 -m modal app list           # nothing old left running
python3 -m modal volume ls flyeas-v75 /features/   # train/val/test parquets present
caffeinate -d -i -s -t 21600 &      # keep Mac awake 6h
```

## Option A — one-command full pipeline (recommended)

```bash
python3 -m modal run --detach scripts/cloud/v76_ultra/run_all_v3.py
```

Subsets (faster iteration on a chunk of the pipeline):

```bash
python3 -m modal run --detach scripts/cloud/v76_ultra/run_all_v3.py --mode foundation_only
python3 -m modal run --detach scripts/cloud/v76_ultra/run_all_v3.py --mode custom_only
python3 -m modal run --detach scripts/cloud/v76_ultra/run_all_v3.py --mode stacking_only
python3 -m modal run --detach scripts/cloud/v76_ultra/run_all_v3.py --mode policy_only
```

Wall time on A100/A10G mix: ~3–4 h. Expected cost: ~$8–10.

## Option B — per-script launches (debugging or partial reruns)

The `@app.local_entrypoint() main()` wrappers have been removed. Invoke the
Modal function directly with `file.py::function_name`:

### Foundation (4 jobs, parallel-safe)

```bash
python3 -m modal run --detach scripts/cloud/v76_ultra/models/chronos2_inference_v2.py::run_chronos2_v2
python3 -m modal run --detach scripts/cloud/v76_ultra/models/tirex_inference_v2.py::run_tirex_v2
python3 -m modal run --detach scripts/cloud/v76_ultra/models/moirai2_inference_v2.py::run_moirai2_v2
python3 -m modal run --detach scripts/cloud/v76_ultra/models/timesfm_inference_v2.py::run_timesfm_v2
```

### Custom-trained (7 jobs, parallel-safe)

```bash
python3 -m modal run --detach scripts/cloud/v76_ultra/models/patchtst_train.py::train_patchtst
python3 -m modal run --detach scripts/cloud/v76_ultra/models/mamba_timemachine.py::train_mamba
python3 -m modal run --detach scripts/cloud/v76_ultra/models/kan_train.py::train_kan
python3 -m modal run --detach scripts/cloud/v76_ultra/models/garch_nn_train.py::train_garch_nn
python3 -m modal run --detach scripts/cloud/v76_ultra/models/mlcaformer_train.py::train_mlcaformer
python3 -m modal run --detach scripts/cloud/v76_ultra/models/timegrad_diffusion.py::train_timegrad
python3 -m modal run --detach scripts/cloud/v76_ultra/models/ts2vec_pretrain.py::train_ts2vec
```

### Stacking (3 jobs, sequential; need ≥ 2 level-0 OOFs)

```bash
python3 -m modal run --detach scripts/cloud/v76_ultra/stacking/xgb_meta.py::fit_xgb_meta
python3 -m modal run --detach scripts/cloud/v76_ultra/stacking/bma_aggregator.py::fit_bma
python3 -m modal run --detach scripts/cloud/v76_ultra/stacking/copula_ensemble.py::fit_copula
```

### Policy (5 jobs, v76_backtest must be last)

```bash
python3 -m modal run --detach scripts/cloud/v76_ultra/policy/bocpd_evt.py::compute_bocpd_and_evt
python3 -m modal run --detach scripts/cloud/v76_ultra/policy/iqn_policy.py::train_iqn
python3 -m modal run --detach scripts/cloud/v76_ultra/policy/thompson_sampling.py::fit_thompson
python3 -m modal run --detach scripts/cloud/v76_ultra/policy/conformal_os.py::calibrate_conformal
python3 -m modal run --detach scripts/cloud/v76_ultra/policy/v76_backtest.py::run_backtest
```

## Monitor

```bash
python3 -m modal app list
python3 -m modal app logs flyeas-v76-ultra
python3 -m modal volume ls flyeas-v75 /models_v76/
```

Or https://modal.com/apps/

## Download results

```bash
cd ~/Desktop/BudgetPilot_Live
python3 -m modal volume get flyeas-v75 models_v76/ ./models_v76_cloud/
python3 -m modal volume get flyeas-v75 report_v76/ ./report_v76_cloud/
cat report_v76_cloud/v76_summary.json
```

Compare with V7.5:

```bash
diff <(jq -S . report_cloud/v75_summary.json) \
     <(jq -S . report_v76_cloud/v76_summary.json)
```

## If a slot fails

Each script is independent at Modal-function level. Re-run just that one:

```bash
python3 -m modal run --detach scripts/cloud/v76_ultra/models/tirex_inference_v2.py::run_tirex_v2
```

Stacking + policy blocks tolerate missing level-0 OOFs — they'll use
whichever parquets are actually on the volume.

## Safety

* Per-model Modal timeouts ≤ 2h; orchestrator caps total wall time.
* Set Modal workspace budget to $25 at https://modal.com/settings/billing.
* Every slot commits the volume after writing → durable across restarts.
* `v76_backtest` fallback chain: `xgb_meta → bma → copula → qrf → abort`.

## Cleanup

```bash
python3 -m modal shell --volume flyeas-v75 -- rm -rf /vol/models_v76 /vol/report_v76
# Or the full reset (⚠️ also deletes V7.5 + features):
# python3 -m modal volume delete flyeas-v75
```
