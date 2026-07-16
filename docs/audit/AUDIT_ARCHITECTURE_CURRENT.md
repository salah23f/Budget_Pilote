# AUDIT — Architecture actuelle de Flyeas

## 1. Vue d'ensemble : deux systèmes parallèles non branchés

```
┌──────────────────────────────┐          ┌──────────────────────────────┐
│  STACK ML PYTHON (Modal)     │          │  STACK PRODUIT (Next.js)     │
│  scripts/cloud/v76_ultra/    │  X  ❌   │  app/, lib/, contracts/      │
│  scripts/cloud/v76_prod/     │          │                              │
│  scripts/train/              │          │  lib/agent/predictor.ts      │
│                              │          │  lib/agent/v7/*              │
│  → bma_weights.json          │          │  lib/agent/watcher.ts        │
│  → xgb_meta_weights.json     │          │  app/api/agent/sweep         │
│  → copula_weights.json       │          │  app/api/missions/*          │
│  → *_oof_predictions.parquet │          │  contracts/MissionEscrow.sol │
│  → v76_summary.json          │          │  contracts/BudgetPilotReceipt│
└──────────────────────────────┘          └──────────────────────────────┘
     Consommateur : personne                 Consommateur : cron sweep
```

**Aucun fichier TS/JS ne lit les artefacts Python** (confirmé par grep sur `parquet|modal\.com|ml_predict|v76`). Les deux stacks ne communiquent pas.

---

## 2. Flux de données — pipeline ML Python

### 2.1 Ingestion (`scripts/ingest/`)

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌────────────┐   ┌────────────┐
│ Kaggle   │   │ HF       │   │ BTS DB1B │   │ BTS T-100  │   │ Expedia    │
│ (6 DS)   │   │ (<1k)    │   │ (62M Q)  │   │ (~fake$)   │   │ ICDM hôtel │
└────┬─────┘   └────┬─────┘   └────┬─────┘   └─────┬──────┘   └─────┬──────┘
     │              │              │               │                 │
     v              v              v               v                 v
┌──────────────────────────────────────────────────────────────────────────┐
│ quality-gate.ts → real_price_samples / real_aggregated_fares (Supabase)  │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 v
              ┌───────────────────────────────────┐
              │ 00-export-to-local.py             │
              │ → data/ml_cache/*.parquet         │
              │ (real_price_samples.parquet,      │
              │  real_aggregated_fares.parquet)   │
              └────────────┬──────────────────────┘
                           │
                           v
        ┌──────────────────────────────────────────────┐
        │ 01b-expand-temporal.py                       │
        │ ⚠ PROBLÈME MAJEUR ⚠                          │
        │ Pour chaque route-quarter :                  │
        │   - lit (mean, std, min, max, p25, p50, p75) │
        │   - tire 50 obs i.i.d. N(mean_q, std_q)      │
        │     clippées à [min, max]                    │
        │   - assigne date uniforme dans le quarter    │
        │ → data/ml_cache/real_aggregated_fares_       │
        │   expanded.parquet (~80 train/route)         │
        └──────────────────┬───────────────────────────┘
                           │
                           v
              ┌─────────────────────────┐
              │ 01-split.py             │
              │ train < 2024-01-01      │  ✅ temporel strict
              │ val   < 2024-07-01      │
              │ test  ≥ 2024-07-01      │
              │ → data/splits/*.parquet │
              └────────────┬────────────┘
                           │
                           v
              ┌─────────────────────────┐
              │ 02-features.py          │
              │ +30 features (rolling,  │  ⚠ rolling inclut valeur courante
              │  calendar, TTD, route,  │    → feat_z_14 corrélé à price_t
              │  haversine, log-return) │
              │ → data/features/*.parq. │
              └────────────┬────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              v                         v
    scripts/cloud/upload_          data/features/* utilisé
    features.py → Modal            localement si dispo
    volume `flyeas-v75`
    /vol/features/*
```

### 2.2 Training L0 (experts) — `scripts/cloud/v76_ultra/models/`

```
                    /vol/features/*
                          │
         ┌────────────────┼────────────────┐
         │                │                │
         v                v                v
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │ Foundation   │ │ Custom deep  │ │ Baselines    │
  │ (zero-shot)  │ │ (trained)    │ │ V7.5         │
  │              │ │              │ │              │
  │ Chronos-Bolt │ │ PatchTST     │ │ QRF (LGBM)   │
  │ TiRex        │ │ MLCaformer   │ │ GP (03)      │
  │ Moirai-2     │ │ Mamba TM     │ │ HMM (04)     │
  │ TimesFM      │ │ GARCH-NN     │ │ LSTM (06)    │
  │              │ │ TS2Vec       │ │ TFT (07)     │
  │              │ │ KAN (MLP)    │ │ DeepAR (08)  │
  │              │ │ TimeGrad     │ │ VAE (09)     │
  │              │ │              │ │ MAML (10)    │
  │              │ │              │ │ CQL (11)     │
  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
         │                │                │
         └────────────────┴────────────────┘
                          │
                          v
            /vol/models_v76/*_oof_predictions.parquet
            (schéma : route, actual, prediction, [q10, q50, q90])
            ⚠ Chaque parquet est un HOLD-OUT sur val, pas un vrai OOF k-fold
```

### 2.3 Stacking L1 — `scripts/cloud/v76_ultra/stacking/`

```
      12+ *_oof_predictions.parquet (val split)
                          │
              ┌───────────┼───────────┐
              │           │           │
              v           v           v
    ┌──────────────┐ ┌────────┐ ┌────────────┐
    │ xgb_meta.py  │ │bma.py  │ │ copula.py  │
    │              │ │        │ │            │
    │ groupby(route│ │ idem   │ │ idem       │
    │ ).median()   │ │        │ │            │
    │              │ │ ⚠ fit  │ │ ⚠ pas de   │
    │ ⚠ split 80/20│ │ et     │ │ copule,    │
    │ sur merge    │ │ score  │ │ weighted   │
    │ non-temporel │ │ sur    │ │ avg        │
    │              │ │ mêmes  │ │ déguisé    │
    │ ⚠ 0.2 val    │ │ rows   │ │            │
    │ = OOF publié │ │        │ │            │
    └──────┬───────┘ └───┬────┘ └─────┬──────┘
           │             │            │
           v             v            v
    xgb_meta_oof    bma_oof      copula_oof
    (n_routes)     (n_routes)   (n_routes)
           │             │            │
           └─────────────┴────────────┘
                          │
                          v  (sélection : xgb_meta en priorité)
                    anchor route-level
```

### 2.4 Policy — `scripts/cloud/v76_ultra/policy/`

```
        xgb_meta_oof_predictions.parquet    /vol/features/val
                  │                               │
       ┌──────────┼──────────┐                    │
       │          │          │                    │
       v          v          v                    v
  ┌─────────┐┌─────────┐┌───────────┐     ┌─────────────┐
  │conformal││bocpd_evt││iqn_policy │     │thompson_samp│
  │_os.py   ││.py      ││.py        │     │ling.py      │
  │         ││         ││           │     │             │
  │c_α =    ││BOCPD    ││IQN        │     │Beta-Bernoul │
  │quantile ││(µ,σ     ││pinball    │     │(4 experts   │
  │résidus  ││fixes)   ││loss, CVaR │     │heuristiques)│
  │per-route││+ GPD    ││moyenne    │     │             │
  │si n≥30  ││(lower   ││par route  │     │Reward = 1   │
  │         ││tail)    ││           │     │si p≤1.05·min│
  │⚠ val    ││         ││⚠ état =   │     │             │
  │(double- ││⚠ sur    ││séquence   │     │⚠ val        │
  │usage)   ││bruit    ││mais data  │     │             │
  │         ││i.i.d.   ││i.i.d.     │     │             │
  └────┬────┘└────┬────┘└─────┬─────┘     └──────┬──────┘
       │          │           │                  │
       v          v           v                  v
  conformal  route_evt   iqn_oof_pred     thompson_weights
  _calibr.   _params      iqn_meta         (α, β, winrate)
  .json      .parquet
```

### 2.5 Backtest — `scripts/cloud/v76_ultra/policy/v76_backtest.py`

```
                  test split (/vol/features/test)
                               │
   ┌───────────────────────────┼───────────────────────────┐
   │                           │                           │
   v                           v                           v
per-route             per-row signals               score threshold
anchor (ensemble)     +3 si p ≤ conformal                  │
= median OOF          +1 si (p-anchor)/std < -1           │
                      +2 si p < EVT threshold              │
                      +2 si ttd < 7                        │
                      +2 si (anchor-p)/anchor ≥ 0.10       │
                      +1 si idem ≥ 0.20                    │
                      +1 si IQN cvar10 > 0                 │
                      +wr·2 Thompson (0.59)                │
                                                           │
                               v                           v
                        v76_buy = (signals≥3) & (idx≥3)    │
                        v76_force = (ttd<14) & (idx<3)     │
                                                           │
                               v                           │
                   buy_idx = argmax(v76_buy | v76_force)   │
                   v76_price = p[buy_idx]                  │
                   floor = min(p_all)          ← oracle    │
                                                           │
                               v                           │
             v76_summary.json : {                          │
               n_routes, capture_median,                   │
               beats_v1_pct, cvar10_capture,               │
               delta_median, c_alpha }                     │
             v76_per_route.parquet                         │
                                                           │
   Aucune API/worker ne consomme ces artefacts ───────────┘
```

---

## 3. Flux côté produit (Next.js) — système indépendant

```
               Client web (mission creation)
                         │
                         v
          ┌──────────────────────────────┐
          │ POST /api/missions/create    │
          │ → Stripe hold / escrow chain │
          │ → .data/missions.json        │
          │   (cache mémoire + fichier)  │
          └───────────────┬──────────────┘
                          │
              GitHub Actions cron (15 min)
                          │
                          v
          ┌──────────────────────────────┐
          │ POST /api/agent/sweep        │
          │ (concurrency = 5)            │
          └───────────────┬──────────────┘
                          │
                          v
          ┌──────────────────────────────┐
          │ lib/agent/watcher.ts         │
          │ pour chaque mission active : │
          │   1. fetch offres (mock API) │
          │   2. predictV7(offer, hist)  │
          │      → lib/agent/v7/index.ts │
          │        (réimpl TS naïve de   │
          │         Kalman + HMM + BOCPD │
          │         + EVT + Survival     │
          │         + GP + MCTS +        │
          │         Thompson + Bayes.    │
          │         Stopping)            │
          │      ⚠ non entraîné          │
          │      ⚠ pas de V7.6 Python    │
          │   3. action/confidence       │
          └───────────────┬──────────────┘
                          │
                          v
          ┌──────────────────────────────┐
          │ POST /api/missions/[id]/     │
          │       propose                │
          │ gates :                      │
          │   meetsThresholdGate (prix)  │
          │   meetsPredictorGate         │
          │     (action=BUY_NOW &&       │
          │      confidence≥0.6)         │
          │ si les 2 OK :                │
          │   → Stripe capture           │
          │   → agentReleaseOnChain      │
          │   → receipt event            │
          │     (BudgetPilotReceipt.sol) │
          └──────────────────────────────┘
```

Le contrat `BudgetPilotReceipt.sol` (41 lignes) ne fait qu'émettre un event : ce n'est pas un escrow. L'escrow réel est `MissionEscrow.sol`. La réception on-chain est donc une *preuve* de transaction, pas une sécurité.

---

## 4. Inventaire fichiers (V7.6 ultra)

### models/ (experts L0)
- `chronos2_inference_v2.py` — foundation Amazon (zero-shot)
- `tirex_inference_v2.py` — xLSTM NX-AI (zero-shot)
- `moirai2_inference_v2.py` — Salesforce (zero-shot)
- `timesfm_inference_v2.py` — Google (zero-shot)
- `patchtst_train.py` — transformer patch
- `mlcaformer_train.py` — attention multi-échelles
- `mamba_timemachine.py` — SSM long-range
- `garch_nn_train.py` — GARCH hybride
- `ts2vec_pretrain.py` — contrastive repr learning
- `kan_train.py` — KAN (fallback MLP en pratique)
- `timegrad_diffusion.py` — DDPM quantile

### stacking/
- `xgb_meta.py` — XGBoost stacker (groupby-median)
- `bma_aggregator.py` — BMA gaussien (groupby-median)
- `copula_ensemble.py` — weighted rank (mal nommé)

### policy/
- `conformal_os.py` — conformal empirique
- `bocpd_evt.py` — BOCPD + GPD lower-tail
- `iqn_policy.py` — Implicit Quantile Network + CVaR
- `thompson_sampling.py` — Beta-Bernoulli sur heuristiques
- `v76_backtest.py` — backtest final (score threshold)

### scripts/train/ (V7 origine, reproduit sur Modal)
- `00-export-to-local.py` — Supabase → parquet
- `01-split.py` — split temporel
- `01b-expand-temporal.py` — ⚠ **synthèse i.i.d.**
- `02-features.py` — +30 features
- `03-fit-gp.py` à `11-train-cql.py` — experts L0 locaux
- `12-fit-ensemble.py` — NNLS + isotonic + Pareto + bootstrap
- `13-validate.py` / `13-validate-fast.py` — validation V1-style
- `audit-leakage.py` — ⚠ checks faibles

### scripts/cloud/v76_prod/
- Duplication plus propre (m01..m11, s01..s03, p01..p05, p05_backtest) — utilise mêmes données, mêmes hypothèses compromises.

---

## 5. Conclusion architecturale

1. **Une pile ML sophistiquée** produite sur Modal, isolée du produit.
2. **Un produit fonctionnel** qui consomme un prédicteur heuristique TS local.
3. **Les deux piles partagent seulement le nom « V7 »** ; aucune intégration.
4. **La pile ML souffre de données synthétiques en amont** et d'un stacking dégénéré qui pulvérise toute structure temporelle.
5. **Le produit pourrait être branché** à un prédicteur simple LightGBM quantile + conformal sans les 30 scripts Modal.

Voir `AUDIT_TARGET_ARCHITECTURE.md` pour la refonte proposée.
