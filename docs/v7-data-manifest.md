# V7 Data Manifest — Real Data Sources

## Status: Pipeline Ready, Awaiting Data Accumulation

### Currently Available (in Supabase)

| Source | Table | Rows | Has TTD | Quality |
|---|---|---|---|---|
| Scraper (Sky-Scrapper) | real_price_samples | 0* | YES | 90 |
| Diagnostic inserts | scraper_runs | 3 | N/A | N/A |

*Sky-Scrapper API is temporarily returning errors. Will auto-recover via GitHub Actions cron.

### Sources Ready to Ingest (scripts exist)

| Source | Script | Est. Rows | Has TTD | Quality | Time to ingest |
|---|---|---|---|---|---|
| BTS DB1B Market | `ingest:bts-db1b` | ~15M | No (imputed) | 85 | 2-4h |
| BTS T-100 | `ingest:bts-t100` | ~3M | No | 70 | 1h |
| Expedia ICDM 2013 | `ingest:expedia` | ~10M | YES (exact) | 95 | 2h |
| Kaggle datasets | `ingest:kaggle` | ~2M | Varies | 80 | 1h |
| HuggingFace auto | `ingest:huggingface` | ~500k | Varies | 75 | 30min |

### Ingestion Prerequisites

1. **BTS DB1B/T-100**: Download CSV files manually from https://transtats.bts.gov
2. **Expedia ICDM**: Download from Kaggle (`kaggle competitions download -c expedia-personalized-sort`)
3. **Kaggle datasets**: Requires `~/.kaggle/kaggle.json` configured
4. **HuggingFace**: No prerequisites (public API)

### How to Start Ingesting

```bash
# Easiest first — no download needed
npm run ingest:huggingface

# Then quality gate
npm run ingest:quality
```

### Data Accumulation Timeline

| Week | Scraper (live) | Manual ingestion | Total |
|---|---|---|---|
| 0 (now) | 0 | 0 | 0 |
| 1 | ~10k | HuggingFace ~500k | ~510k |
| 2 | ~20k | Kaggle ~2M | ~2.5M |
| 4 | ~40k | BTS DB1B ~15M | ~17.5M |
| 8 | ~80k | Expedia ~10M | ~27.5M |

### V7 Model Data Requirements

| Model | Min samples to work | Min for good performance |
|---|---|---|
| Kalman Filter | 3 per route | 30 per route |
| HMM Regime | 5 per route | 50 per route |
| Bayesian Stopping | 5 per route | 100 per route |
| BOCPD | 5 per route | 30 per route |
| EVT (Pareto) | 10 per route | 100 per route |
| Survival Analysis | 8 per route | 50 per route |
| Gaussian Process | 20 per route | 200 per route |
| MCTS | 5 per route | 50 per route |
| Thompson Sampling | 0 (online) | 100 outcomes |
| Ensemble | All above running | 500 per route |

### Current V7 State

All 13 models are **deployed and running in shadow mode** on production.
They currently operate on the built-in simulator data + any live scraper data.
As real data accumulates, model accuracy will improve automatically because:
- Kalman/HMM/BOCPD update online per observation
- GP/QRF/Ensemble re-fit periodically
- Thompson Sampling learns from mission outcomes

**No manual retraining is needed for the online models (Kalman, HMM, BOCPD, Thompson).**
Batch models (GP, QRF, LSTM, Ensemble) benefit from periodic retraining once data > 10k samples.
