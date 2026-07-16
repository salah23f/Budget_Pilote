# Flyeas V7.5 — Modal Cloud Training

Runs the full V7.5 training on a single A100 GPU in ~60–90 minutes.

## One-time setup

```bash
pip3 install --upgrade modal
modal token new                  # opens browser, authorize CLI
```

## Run

From the project root (`~/Desktop/BudgetPilot_Live`):

```bash
# 1. Upload features to a Modal volume (one time, or whenever features change)
python3 scripts/cloud/upload_features.py

# 2. Launch training on A100
modal run scripts/cloud/train_v75_cloud.py
```

You can close the terminal — Modal keeps the job running.
Re-attach anytime with `modal app logs flyeas-v75-trainer`.

## Download results

```bash
modal volume get flyeas-v75 models/ ./models_cloud/
modal volume get flyeas-v75 report/ ./report_cloud/
```

The ensemble weights land in `models_cloud/ensemble_weights.json`.
The final capture/CVaR metrics land in `report_cloud/v75_summary.json`.

## What it does

1. Loads `train/val/test_features.parquet` from the Modal volume
2. Trains LightGBM Quantile (replaces sklearn QRF, faster and sharper)
3. Trains TFT (GPU, 40 epochs, batch 512) — real convergence
4. Trains DeepAR Student-t (GPU, 30 epochs) — stable NaN-free
5. Isotonic-calibrates each model, builds the guardrailed NNLS ensemble
6. Conformal-calibrates the future-min gap at α=0.1 (Conformal Optimal Stopping)
7. Fits a per-route GPD tail (POT) for extreme-low detection
8. Runs the full V7 backtest on test_features using the ensemble + conformal + GPD

## Cost

| GPU   | Rate (~) | Expected run | Cost    |
|-------|---------|---------------|---------|
| A100  | $1.10/h | 60–90 min    | ~$1–2   |
| A10G  | $0.60/h | 90–150 min   | ~$1–1.5 |

Modal grants $30 free credits on signup → several full runs free.

## Switching to a cheaper GPU

Edit `train_v75_cloud.py`:

```python
GPU_TYPE = "A10G"   # was "A100"
```
