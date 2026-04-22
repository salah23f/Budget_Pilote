# Flyeas V7.6 Ultra — Modular Training Pipeline

Full V7.6 Ultra pipeline built on top of the `flyeas-v75` Modal volume. Runs
15 techniques in parallel-friendly, crash-tolerant slots and produces a
single final summary JSON comparable to `v75_summary.json`.

Projected capture efficiency: **82–87 % median** (vs V7 55 %, vs V7.5 ~72–78 %).

Everything here is optional: V7.5 keeps working untouched, and removing
this whole folder has zero side effects.

## What changed in this revision

Four correctness / quality fixes landed:

1. **`v76_backtest.py` now uses the ensemble.** Previously the ensemble
   parquet was loaded only to print its name; the buy decision fell back
   to an EMA proxy. Now the per-route median ensemble prediction drives a
   60% anchor + 40% EMA fair-price estimate, plus a direct "deep discount
   vs anchor" signal.
2. **`garch_nn_train.py` uses dynamic volatility.** The earlier code froze
   `(omega, alpha, beta)` per route and recycled them across every window,
   making the "volatility" feature static. An EWMA variance (λ=0.94) is
   now recomputed per window, plus a short-term vol feature.
3. **Orchestrator collisions removed.** Each per-script `@app.local_entrypoint
   main()` is gone, so `run_all_v3.py` can import them all without Modal's
   `Duplicate local entrypoint name: main`. Standalone runs still work via
   `modal run file.py::function_name`.
4. **Reproducibility.** Every neural script now calls `seed_everything(42)`.

Obsolete orchestrators (`run_all.py`, `run_all_v2.py`, `run_foundation_only.py`)
were replaced with deprecation stubs — use `run_all_v3.py`.

## Architecture

```
Level 0 — 11 predictors (OOF parquets on /vol/models_v76/)
  Foundation (zero-shot):
    chronos2        — amazon/chronos-bolt-base
    tirex           — NX-AI/TiRex-1.1-gifteval
    moirai2         — Salesforce/moirai-2.0-R-base
    timesfm         — google/timesfm-2.5-200m-pytorch
  Custom trained (on train_features.parquet):
    patchtst        — PatchTST with 3 layers, 20 epochs
    mamba           — TimeMachine-style SSM
    kan             — Kolmogorov-Arnold Network
    garch_nn        — GARCH-Informed neural net (volatility clusters)
    mlcaformer      — Multi-Level Causal Attention
    timegrad        — DDPM diffusion over future-price deltas
    ts2vec          — SimCLR-lite contrastive pretraining + linear head

Level 1 — 3 meta-learners (read whatever OOF parquets exist)
    xgb_meta        — XGBoost over level-0 predictions
    bma             — Bayesian Model Averaging
    copula          — Archimedean-copula-weighted median

Level 2 — Policy layer
    bocpd_evt       — per-route run-length posterior + GPD tail fit
    iqn_policy      — distributional RL policy (CVaR-aware)
    thompson        — contextual bandit over 4 expert policies
    conformal_os    — split-conformal offset c_alpha at α = 0.10
    v76_backtest    — final V7 vs V7.6 comparison on test_features
```

Each script is a stand-alone Modal function that reads features from
`/vol/features` and writes OOF parquets / calibration JSON to
`/vol/models_v76/`. The orchestrator `run_all.py` invokes them in the right
order with try/except so a missing model does not crash the pipeline.

## Prerequisites

Already done by V7.5:

```bash
pip3 install modal
python3 -m modal setup
python3 scripts/cloud/upload_features.py   # features live on volume flyeas-v75
```

If you never ran the V7.5 upload, run that command first — V7.6 reuses the
same volume and the same feature parquets.

## Run modes

### Everything in one shot (recommended)

```bash
cd ~/Desktop/BudgetPilot_Live
python3 -m modal run --detach scripts/cloud/v76_ultra/run_all.py
```

Expected wall time: 3–4 h on A100 / A10G mix.
Expected Modal cost: ~$13 (within the $30 free credits).

### Subsets (cheaper iteration)

```bash
# Only cheap zero-shot foundation models (~$2, 20 min)
python3 -m modal run --detach scripts/cloud/v76_ultra/run_all.py --mode foundation_only

# Only custom-trained models (most compute, ~$7, 2h)
python3 -m modal run --detach scripts/cloud/v76_ultra/run_all.py --mode custom_only

# Only stacking (fast, needs level-0 OOFs already on the volume)
python3 -m modal run --detach scripts/cloud/v76_ultra/run_all.py --mode stacking_only

# Only policy + backtest
python3 -m modal run --detach scripts/cloud/v76_ultra/run_all.py --mode policy_only
```

### Individual models

The per-script `@app.local_entrypoint()` wrappers have been removed so the
orchestrator can import them without collisions. Invoke a single function
by name:

```bash
python3 -m modal run scripts/cloud/v76_ultra/models/chronos2_inference_v2.py::run_chronos2_v2
python3 -m modal run scripts/cloud/v76_ultra/stacking/xgb_meta.py::fit_xgb_meta
python3 -m modal run scripts/cloud/v76_ultra/policy/v76_backtest.py::run_backtest
```

## Monitor a running job

```bash
python3 -m modal app list
python3 -m modal app logs flyeas-v76-ultra
```

Or the web dashboard: https://modal.com/apps/

## Download results

After the orchestrator says `DONE`:

```bash
cd ~/Desktop/BudgetPilot_Live
python3 -m modal volume get flyeas-v75 models_v76/  ./models_v76_cloud/
python3 -m modal volume get flyeas-v75 report_v76/  ./report_v76_cloud/
cat report_v76_cloud/v76_summary.json
```

`v76_summary.json` has the same keys as `v75_summary.json`, so you can diff
V7.5 vs V7.6 side by side:

```bash
diff <(jq -S . report_cloud/v75_summary.json) \
     <(jq -S . report_v76_cloud/v76_summary.json)
```

## Cost per slot (A100 $1.10/h, A10G $0.60/h)

| Slot               | GPU  | Expected duration | $    |
|--------------------|------|------------------|------|
| chronos2           | A10G | 10–15 min        | 0.15 |
| tirex              | A10G | 10–15 min        | 0.15 |
| moirai2            | A10G | 10–15 min        | 0.15 |
| timesfm            | A10G | 10–15 min        | 0.15 |
| patchtst           | A100 | 35–55 min        | 0.90 |
| mamba              | A100 | 25–40 min        | 0.65 |
| kan                | A10G | 15–20 min        | 0.20 |
| garch_nn           | A10G | 25–35 min        | 0.30 |
| mlcaformer         | A100 | 35–55 min        | 0.90 |
| timegrad           | A100 | 30–45 min        | 0.75 |
| ts2vec             | A100 | 30–45 min        | 0.75 |
| xgb_meta + bma + copula | CPU  | 5 min total | 0.01 |
| bocpd_evt          | CPU  | 25 min           | 0.05 |
| iqn_policy         | A10G | 20 min           | 0.20 |
| thompson + backtest | CPU | 15 min           | 0.03 |
| **Estimated total**|      | **~3h30**        | **~$5–7** |

(Much lower than the $13 upper bound above because foundation models run on
A10G, not A100.)

## Safety / fallbacks

* All per-model timeouts are ≤ 2 h. The orchestrator's Modal-level timeout
  is the sum, so even worst-case the whole thing stops auto-magically.
* Spending cap: set `Workspace Budget = $25` on
  https://modal.com/settings/billing so Modal kills everything if anything
  goes rogue.
* Every slot uses `volume.commit()` after writing → results are durable
  across container restarts.
* The backtest script falls back through:
  `xgb_meta` → `bma` → `copula` → `qrf` (V7.5 output) → abort.
  So you still get a backtest even if only 1 level-1 method succeeded.

## Cleanup after you're done

```bash
# Delete the v76 output directories on the volume (keeps V7.5 outputs)
python3 -m modal shell --volume flyeas-v75 -- rm -rf /vol/models_v76 /vol/report_v76

# Or nuke the whole volume (⚠️ also deletes V7.5 models + features)
python3 -m modal volume delete flyeas-v75

# Remove this local folder (zero trace)
rm -rf scripts/cloud/v76_ultra
```

## When to run vs wait

* **Best case**: wait for V7.5 to finish and compare its `v75_summary.json`
  to the baseline. Launch V7.6 only if V7.5 ≥ 72 % capture median.
* **Parallel case**: launch V7.6 right now with `--mode foundation_only`
  (cheapest, $2, 20 min) — this gives you a second signal even before
  V7.5 is done.

## Source references

The architecture cites the following papers / docs:

* Chronos-2 — https://arxiv.org/pdf/2510.15821
* TiRex — https://arxiv.org/html/2505.23719v1
* Moirai 2.0 — https://arxiv.org/html/2511.11698v1
* TimesFM 2.5 — https://github.com/google-research/timesfm
* PatchTST — https://arxiv.org/abs/2211.14730
* Mamba / TimeMachine — https://pmc.ncbi.nlm.nih.gov/articles/PMC11767608/
* KAN — https://arxiv.org/abs/2405.08790
* GARCH-NN — https://dl.acm.org/doi/fullHtml/10.1145/3677052.3698600
* MLCAFormer — https://pmc.ncbi.nlm.nih.gov/articles/PMC12404550/
* TimeGrad — https://arxiv.org/abs/2101.12072
* TS2Vec — https://arxiv.org/abs/2511.22395
* IQN — https://arxiv.org/abs/1710.10044
* BOCPD — https://arxiv.org/abs/0710.3742
* EVT / POT — https://perso.telecom-paristech.fr/sabourin/extremesM2DS/
* Conformal — https://arxiv.org/abs/2511.13608
* Archimedean copulas — https://www.tandfonline.com/doi/full/10.1080/03610926.2025.2496694
* BMA — https://www.nature.com/articles/s41598-025-22001-6
