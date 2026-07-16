# AUDIT V1 vs V7.6 ULTRA — ARCHITECTURE & INTÉGRATION RÉELLE

## 1. Cartographie V1

### Composants

| Fichier | Rôle | Lignes clés |
|---|---|---|
| `lib/agent/predictor.ts` | Logique de scoring V1 — z-score + percentile + trend + TTD | l.79-94 (seuils), l.99-268 (predict), l.273-313 (cold start) |
| `lib/agent/baselines.ts` | Stats pures (mean, stdev, percentile, trend R²) | — |
| `lib/agent/price-history.ts` | Time-series append-only (`.data/price-history.json` en dev, Supabase en prod) | — |
| `lib/agent/watcher.ts` | Orchestrateur unique : search → record → predict → return | l.226 (sélection algo), l.318-326 (V1 par défaut), l.287-293 (V1 fallback) |

### Algorithme V1 (4 signaux pondérés)

```
composite = 0.40·zScoreScore + 0.25·percentileScore + 0.20·trendScore + 0.15·ttdScore
action    = BUY_NOW si composite ≥ 0.40
            WAIT    si composite ≤ -0.30
            MONITOR sinon
```

Seuils clés :
- `Z_BUY_THRESHOLD = -0.8`, `Z_WAIT_THRESHOLD = 0.6`
- `PCT_BUY_THRESHOLD = 20`, `PCT_WAIT_THRESHOLD = 70`
- `MIN_USABLE_SAMPLES = 5`, `MIN_CONFIDENT_SAMPLES = 30`

Cold-start : `n < 5` → `BUY_NOW si TTD < 14 sinon MONITOR`, confidence ≤ 0.35.

### Endpoints qui consomment V1

| Endpoint | Cron | Utilise V1 ? |
|---|---|---|
| `app/api/agent/sweep/route.ts` | GitHub Actions `*/15 * * *` | **Oui** (via `watchMission`) |
| `app/api/cron/monitor/route.ts` | Vercel `0 8 * * *` | **Oui** |
| `app/api/cron/demo-shadow-sweep/route.ts` | Vercel `0 14 * * *` | **Oui** (V1 en shadow log) |
| `app/api/missions/[id]/propose/route.ts` | onDemand | **Oui** |
| `app/api/missions/[id]/prediction/route.ts` | onDemand (read-only) | **Oui** |

### Variables d'environnement V1

| Var | Effet |
|---|---|
| `FLYEAS_ALGO_VERSION` (défaut `v1`) | `v1` → V1 pur \| `shadow` → V1 décide + V7a logué \| `v7a` → V7a décide, V1 fallback \| `v7` → V7 TS legacy |
| `FLYEAS_AUTOBUY_ENABLED` | Toggle auto-buy |
| `CRON_SECRET` | Auth crons |

---

## 2. Cartographie V7.6 ultra

### Composants Python (Modal)

| Couche | Fichiers | Rôle |
|---|---|---|
| L0 — Foundation zero-shot (4) | `chronos2_inference_v2.py`, `tirex_inference_v2.py`, `moirai2_inference_v2.py`, `timesfm_inference_v2.py` | Quantiles q10/q50/q90 sur prix |
| L0 — Custom entraînés (7) | PatchTST, MLCAFormer, Mamba, GARCH-NN, TS2Vec, KAN, TimeGrad | Modèles deep + probabilistes sur `/vol/features/*` |
| L1 — Stacking (3) | `xgb_meta.py`, `bma_aggregator.py`, `copula_ensemble.py` | Agrégation des OOF L0 |
| L2 — Policy (5) | `conformal_os.py`, `bocpd_evt.py`, `iqn_policy.py`, `thompson_sampling.py`, `v76_backtest.py` | Couche décision + backtest |
| Data | `scripts/ingest/{kaggle,bts-db1b,bts-t100,expedia-icdm,huggingface}.ts` | Ingestion vers Supabase |
| Pipeline train | `scripts/train/00..12-*.py` | Split, features, fit experts, ensemble |
| Pipeline expansion | `scripts/train/01b-expand-temporal.py` | **GELÉ** (`sys.exit(2)`) — synthétisait 50 obs/quarter en bruit gaussien |

### Algorithme V7.6 ultra (composite buy signal)

`scripts/cloud/v76_ultra/policy/v76_backtest.py:212-235` :

```
signals  = 3 si p ≤ fair_price - c_α
         + 1 si (p - fair_price)/std < -1.0
         + 2 si is_extreme (GPD)
         + 2 si TTD < 7
         + 2 si anchor_discount ≥ 0.10
         + 1 si anchor_discount ≥ 0.20
         + 1 si IQN_CVaR > 0
         + winrate·2 si Thompson best expert vote
buy = (signals ≥ 3) & (idx ≥ 3)
```

### Endpoints qui consomment V7.6 ultra

**Aucun.** Recherche `grep -r "v76\|v7.6\|bma_weights\|xgb_meta_oof" lib/ app/` → 0 référence en code applicatif TypeScript.

### Artefacts produits (orphelins)

| Artefact | Localisation | Lu par ? |
|---|---|---|
| `xgb_meta.json`, `xgb_meta_weights.json`, `xgb_meta_oof_predictions.parquet` | `/vol/models_v76/` (Modal) | Modal `v76_backtest.py` uniquement |
| `bma_weights.json`, `copula_weights.json` | repo root (présents en `git status`) | Personne |
| `conformal_calibration.json`, `route_evt_params.parquet`, `iqn_oof_predictions.parquet`, `thompson_weights.json` | `/vol/models_v76/` | Modal `v76_backtest.py` uniquement |
| `report_v76_cloud/v76_summary.json` | aurait dû exister | **N'existe pas en local** (`find -name "v76_summary*"` → 0 résultat) |

### Pipeline d'entraînement V7.6 (état réel)

```
scripts/train/00-export-to-local.py     [Supabase → parquet local]
scripts/train/01-split.py               [split temporel ✓ correct]
scripts/train/01b-expand-temporal.py    [GELÉ — sys.exit(2)]
scripts/train/02-features.py            [rolling features, leakage suspect]
scripts/train/03..11-*.py               [GP, HMM, QRF, LSTM, TFT, DeepAR, MAML, etc.]
scripts/train/12-fit-ensemble.py        [NNLS ensemble]
scripts/cloud/v76_ultra/run_all_v3.py   [orchestrateur Modal — non lancé récemment]
```

Le script clé `01b-expand-temporal.py` étant gelé, **le pipeline V7.6 ne peut plus être ré-exécuté de bout en bout sur un dataset propre sans modification**. Les artefacts `/vol/models_v76/*` qui pourraient subsister sur Modal datent d'une exécution antérieure au gel.

---

## 3. Intégration prod réelle (vérité opérationnelle)

### Flux watcher (prod)

```
GitHub Actions (cron */15)
  └─→ POST $BASE_URL/api/agent/sweep      [Bearer CRON_SECRET, 280s timeout]
        └─→ listMissions(active)
              └─→ for each mission:
                    └─→ watchMission(mission)                  [lib/agent/watcher.ts]
                          ├─→ searchFlights(...)                [Amadeus / Sky-Scrapper / Kiwi]
                          ├─→ recordSample(...)                 [price_history append]
                          └─→ branche selon FLYEAS_ALGO_VERSION:
                                ├─ 'v1'      → predict(...)                          [V1]
                                ├─ 'shadow'  → predictV7aFirst() + log V7a, action=V1 [V1 décide]
                                ├─ 'v7a'     → predictV7aFirst() (V1 si Modal fail)  [V7a décide]
                                └─ 'v7'      → predictV7() (V7 TS legacy non entraîné)
        └─→ if action='BUY_NOW' → POST /api/missions/[id]/propose
                                   └─→ Stripe hold + escrow on-chain
```

### Vercel cron (`vercel.json`)

```json
"crons": [
  { "path": "/api/cron/monitor",            "schedule": "0 8 * * *" },
  { "path": "/api/cron/demo-shadow-sweep",  "schedule": "0 14 * * *" }
]
```

`/api/cron/monitor` : 300s timeout. `/api/cron/demo-shadow-sweep` : 60s, 2 routes/run, parallélisme 2 (cf commits récents qui réduisent la charge sur le plan Hobby).

### Mode shadow (état actuel par défaut)

`.env.example` : `FLYEAS_ALGO_VERSION=shadow`. Mode opératoire :

1. V1 calcule sa décision normalement.
2. V7a (Modal endpoint `MODAL_V7A_URL`) calcule la sienne en parallèle.
3. **L'action enregistrée dans `agent_decisions.action` est l'action V1**, pas l'opinion V7a (corrigé par commit 4fcf82e).
4. L'opinion V7a est conservée dans la colonne JSONB `agent_decisions.v7a` pour analyse a posteriori.
5. Si V7a Modal échoue ou timeout (8s), V1 sert silencieusement.

### Réponse aux questions binaires

| Question | Réponse |
|---|---|
| V1 est-il réellement utilisé ? | **Oui.** Décide en mode `v1` et `shadow` (défaut). Fallback en mode `v7a`. |
| V7.6 ultra est-il réellement utilisé ? | **Non.** Aucun appel TS. Aucun endpoint Modal V7.6 n'est référencé dans `lib/agent/v7a/client.ts` (seul l'endpoint V7a `ensemble_ttd_switch` l'est). |
| Si on supprime V1 du repo, la prod casse ? | **Oui.** `predict` est importé dans `watcher.ts:32` et appelé en défaut + fallback. |
| Si on supprime V7.6 ultra du repo, la prod casse ? | **Non.** Aucune importation par `lib/`, `app/`, `vercel.json`. Suppression silencieuse possible. |
| V7a est-il branché ? | **Oui, en shadow.** Mais V7a ≠ V7.6 ultra (cf §4). |

---

## 4. Distinction critique : V7.6 ultra ≠ V7a

| Aspect | V7.6 ultra | V7a |
|---|---|---|
| Localisation | `scripts/cloud/v76_ultra/`, `scripts/train/{00..12}-*.py` | `scripts/train/v7a/`, `scripts/cloud/v7a/`, `lib/agent/v7a/` |
| Statut | Audité "non fiable" 2026-04-23, `01b-expand-temporal.py` gelé | Pivot A acté 2026-04-24, baseline composée en serving |
| Décision en prod | Aucune | Shadow log (FLYEAS_ALGO_VERSION=shadow) |
| Logique de décision | Composite signal `signals ≥ 3` (8 termes) | `ensemble_ttd_switch` : `BUY si TTD≤7 ∧ p≤rolling_min_30 ; sinon BUY si TTD>7 ∧ p≤Q10_train_route` |
| Stack ML | 11 L0 + 3 L1 + 5 L2 (Python/Modal) | LGBM quantile + isotonic + conformal (Python/Modal), désormais auxiliaire |
| Données | Synthétiques (`01b-expand-temporal.py` gelé) + ingestions douteuses | dilwong réel uniquement |
| Métriques rapportées | `capture_median=62.74%` (sur synthétique) | `capture_median=0.911` baseline / 0.888 ML pur (sur réel) |

**L'audit V1 vs V7.6 ultra demandé ne doit pas confondre les deux.** V7a est un produit dérivé du pivot ; V7.6 ultra est l'ancêtre archivé.

---

## 5. Schéma global

```
                    ┌────────────────────────────────────────────┐
                    │           PRODUIT (Next.js / Vercel)         │
                    │                                              │
   ┌────GH Actions──┤  /api/agent/sweep  ←  cron */15             │
   │                │       │                                      │
   │                │       ▼                                      │
   │                │  watcher.ts → predict() ← V1 ✅ BRANCHÉ      │
   │                │       │                                      │
   │                │       ├─ shadow → predictV7aFirst() ← V7a    │
   │                │       │                  Modal (ensemble_ttd_switch) │
   │                │       │                                      │
   │                │       └─ propose → Stripe + escrow on-chain  │
   │                │                                              │
   │  Vercel cron───┤  /api/cron/monitor          (0 8 * * *)      │
   │                │  /api/cron/demo-shadow-sweep (0 14 * * *)    │
   └────────────────┤                                              │
                    └────────────────────────────────────────────┘

                    ┌────────────────────────────────────────────┐
                    │      V7.6 ULTRA (Modal — Python)            │
                    │                                              │
                    │  scripts/train/01b-expand-temporal.py  ❌ gelé│
                    │             │                                │
                    │             ▼                                │
                    │  scripts/train/{02..12}-*.py        (orphelin)│
                    │  scripts/cloud/v76_ultra/models/*.py (orphelin)│
                    │  scripts/cloud/v76_ultra/stacking/*.py (orphelin)│
                    │  scripts/cloud/v76_ultra/policy/v76_backtest.py│
                    │             │                                │
                    │             ▼                                │
                    │  /vol/models_v76/*.parquet, *.json  (Modal)   │
                    │             │                                │
                    │             ✗ — non lus par lib/agent/         │
                    └────────────────────────────────────────────┘
```

V7.6 ultra est isolé. Le pont vers la prod n'existe pas, et ne peut pas être construit honnêtement tant que `01b-expand-temporal.py` reste la source des features.
