# V7 Real Data Training Plan

## Phase 1 — Audit (DONE)

### Existing ingesters:
- `bts-db1b.ts` — BTS DB1B Market (needs period extension 2015-2024)
- `bts-t100.ts` — BTS T-100 (needs period extension)
- `kaggle.ts` — Extended to 7 datasets (was 2, now includes dilwong/flightprices with TTD)
- `expedia-icdm.ts` — Expedia ICDM 2013 (10M rows with exact TTD)
- `huggingface.ts` — Auto-discovery airfare datasets
- `quality-gate.ts` — Dedup + Tukey outlier detection
- `fx-rates.ts` — NEW: Frankfurter API FX rates 2010-2024

### Existing training scripts:
- `01-split.py` — UPGRADED: Supabase fetch + 2015-2024 date split + synthetic fallback
- `02-features.py` — 25+ features (rolling, temporal, route, log-returns)
- `03-fit-gp.py` — NEW: GP per route, L-BFGS on marginal likelihood
- `04-fit-hmm.py` — NEW: HMM 6-state Baum-Welch per route
- `05-fit-qrf.py` — NEW: Quantile Regression Forest, 200 trees, 7 quantiles
- `06-train-lstm.py` — LSTM-Quantile, 3-layer, ONNX export
- `09-train-vae.py` — NEW: Beta-VAE anomaly detection, ONNX export
- `12-fit-ensemble.py` — NEW: Super Learner NNLS stacking
- `13-validate.py` — NEW: Walk-forward backtest V1 vs V7, generates report
- `audit-leakage.py` — NEW: Automated temporal leakage detection

## Phase 2 — Ingestion Pipeline

### Orchestrator commands:
```bash
npm run ingest:all          # HuggingFace + Kaggle (7 datasets) + quality gate
npm run ingest:bts-db1b     # BTS DB1B Market (requires manual CSV download)
npm run ingest:bts-t100     # BTS T-100 (requires manual CSV download)
npm run ingest:expedia      # Expedia ICDM (requires Kaggle download)
npm run ingest:fx-rates     # FX rates from Frankfurter API
npm run ingest:quality      # Dedup + outlier detection
```

### Data flow:
1. HuggingFace (automatic, no download needed) → ~500k rows
2. Kaggle 7 datasets (requires `~/.kaggle/kaggle.json`) → ~10M rows
3. BTS DB1B/T-100 (requires manual CSV download from transtats.bts.gov) → ~20M rows
4. Expedia ICDM (requires Kaggle competition download) → ~10M rows
5. Quality gate: dedup + Tukey outlier marking

## Phase 3 — Feature Engineering

```bash
npm run train:features      # 02-features.py on all splits
```

Features (25+):
- Rolling stats (7d, 14d, 30d): mean, std, min, max
- Z-score vs 30d rolling mean
- Temporal: dow, month, is_weekend, holiday proximity
- Route-level: hub tier, LCC flag, route popularity
- Log-returns, realized volatility

## Phase 4 — Training Pipeline

```bash
npm run train:all           # Full pipeline (8-24h CPU)
npm run train:smoke         # Quick test (split + features + QRF + validate)
```

### Execution order:
1. `01-split.py` — Time-series split (train/val/test)
2. `02-features.py` — Feature engineering
3. `audit-leakage.py` — Verify no temporal leakage
4. `03-fit-gp.py` — GP per route (parallel-ready)
5. `04-fit-hmm.py` — HMM 6-state per route
6. `05-fit-qrf.py` — QRF 200 trees
7. `06-train-lstm.py` — LSTM-Quantile (requires torch)
8. `09-train-vae.py` — Beta-VAE anomaly (requires torch)
9. `12-fit-ensemble.py` — Super Learner NNLS
10. `13-validate.py` — Walk-forward backtest → report

## Phase 5 — Validation & Report

Output: `docs/flyeas-v7-real-training-report.md`

### Metrics tracked:
- Capture Efficiency (median, P25, P75)
- Avg vs Floor (%)
- % in optimal window
- V7 beats V1 rate
- Top 10 best/worst routes

## Phase 6 — Deploy

```bash
# Shadow mode (safe)
vercel env add FLYEAS_ALGO_VERSION production  # value: shadow

# Live V7
vercel env rm FLYEAS_ALGO_VERSION production
vercel env add FLYEAS_ALGO_VERSION production  # value: v7
vercel deploy --prod
```
