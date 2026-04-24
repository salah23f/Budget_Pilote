# V7A_LOCAL_VS_MODAL — Pipeline dual-mode

V7a tourne en deux modes parallèles **pour les mêmes scripts**, gouvernés par
trois variables d'environnement :

| Variable | Local (défaut) | Modal |
|---|---|---|
| `V7A_TAG` | `local` | `modal` |
| `V7A_DATA_ROOT` | `<repo>/data` | `/vol/data` |
| `V7A_REPORTS_ROOT` | `<repo>/reports` | `/vol/reports` |
| `V7A_SAMPLE_EVERY` | `25` (pour `fetch_dilwong.py`) | `1` (full-data) |

Chaque run écrit ses artefacts dans des répertoires séparés : `splits_v7a_local/`
vs `splits_v7a_modal/`, `features_v7a_local/` vs `features_v7a_modal/`, etc.
Les rapports JSON portent tous un suffixe `_local` ou `_modal`.

## 1. Ce qui tourne où — justification

| Étape | Local | Modal | Pourquoi |
|---|---|---|---|
| Build dataset (fetch Kaggle + clean + parquet) | ✅ `fetch_dilwong.py` (sampling 1/25, ~3M rows) | ✅ `build_dataset_modal.py` (sampling 1/1, full 82M rows) | Local = smoke test rapide. Modal = full dataset pour mesurer le gain de volume. |
| Split 4-blocs | ✅ | ✅ | Léger. Redondance volontaire : chaque mode a son propre split disjoint. |
| Features causales (rolling shift(1), TTD, calendrier, haversine...) | ✅ (~300 MB RAM) | ✅ (~8 GB RAM pour 80M rows) | Modal justifié parce que transform groupby sur 80M lignes sature 8 GB Mac. |
| Audit leakage | ✅ | ✅ | Les deux modes doivent passer l'audit indépendamment. |
| Baselines (buy_now, fixed_horizon_14, rolling_min_30, simple_quantile, v1) | ✅ | ✅ | Forcément dans les deux pour avoir une comparaison équitable. |
| LightGBM quantile q10/q50/q90 + OOF TimeSeriesSplit | ✅ (~15 min) | ✅ (~45 min full-data) | Modal apporte plus de data → potentiellement meilleure calibration. |
| Isotonic + Conformal Mondrian | ✅ | ✅ | Nécessaire pour que chaque mode ait ses propres intervalles. |
| Backtest segmenté + alerting metrics | ✅ | ✅ | Seul `backtest.py` a le droit de lire le test hold-out. |
| Compare local vs Modal | ✅ `compare_local_vs_modal.py` | ⛔ | Tourne en local, lit les reports des deux côtés. |
| Endpoint produit | ⛔ | ✅ `serve.py` web endpoint | Modal est le bon endroit pour servir — déjà existant. |

## 2. Ce qui ne tourne PAS sur Modal

- **Smoke test itératif** : pendant le développement V7a, on valide d'abord
  en local avec 3M lignes. Modal n'est déclenché qu'une fois les critères
  locaux passés (voir `V7A_BASELINES.md`).
- **Exploration manuelle des rapports** : `cat reports/*.json`,
  reliability diagrams, etc. restent locaux.
- **`compare_local_vs_modal.py`** : par construction, il lit les deux jeux
  de rapports — donc local.

## 3. Ce qui ne vaut pas le coût Modal

Aucune des briques V7.6 supprimées ne doit revenir sur Modal :
- pas de re-training PatchTST / MLCAFormer / Mamba / TimeGrad / GARCH-NN /
  KAN / TS2Vec ;
- pas de foundation models zero-shot (Chronos, TiRex, Moirai-2, TimesFM)
  à ce stade ;
- pas de stacking XGB-meta / BMA / Copula en l'état.

Le test `V7a LGBM quantile` suffit à démontrer la valeur du volume de données.
Les foundation models sont un V7b conditionnel.

## 4. Workflow opérationnel

```
┌───────────────────────────────────────┐
│ 1. Local smoke test (≤ 30 min)        │
│    bash scripts/train/v7a/run_all_    │
│      local.sh                         │
│    → reports/v7a_*_local.json         │
└────────────────┬──────────────────────┘
                 │ si Go baselines (voir V7A_BASELINES.md)
                 v
┌───────────────────────────────────────┐
│ 2. Setup Modal (une seule fois)       │
│    modal token new                    │
│    modal volume create flyeas-v7a     │
│    modal secret create kaggle-creds \ │
│      KAGGLE_USERNAME=... \            │
│      KAGGLE_KEY=...                   │
└────────────────┬──────────────────────┘
                 │
                 v
┌───────────────────────────────────────┐
│ 3. Dataset full-data Modal            │
│    modal run scripts/cloud/v7a/       │
│      build_dataset_modal.py           │
│    → /vol/data/ml_cache/              │
│      v7a_clean_modal.parquet          │
│      (~80M lignes, ~3-5 GB)           │
│    Coût : ~0.20 $                     │
└────────────────┬──────────────────────┘
                 │
                 v
┌───────────────────────────────────────┐
│ 4. Pipeline V7a full sur Modal        │
│    modal run scripts/cloud/v7a/       │
│      run_v7a_modal.py                 │
│    → splits/features/baselines/lgbm/  │
│      conformal/backtest modal         │
│    Coût : ~1-2 $                      │
└────────────────┬──────────────────────┘
                 │
                 v
┌───────────────────────────────────────┐
│ 5. Download reports en local          │
│    modal volume get flyeas-v7a \      │
│      /reports ./reports               │
│    → reports/v7a_*_modal.json         │
└────────────────┬──────────────────────┘
                 │
                 v
┌───────────────────────────────────────┐
│ 6. Comparaison locale                 │
│    python3 scripts/train/v7a/         │
│      compare_local_vs_modal.py        │
│    → reports/v7a_compare_local_vs_    │
│      modal.json                       │
│    Lire le champ verdict.modal_worth_ │
│      it                                │
└───────────────────────────────────────┘
```

## 5. Critères de décision — « le full-data vaut-il le coût Modal ? »

Le verdict est codé dans `compare_local_vs_modal.py` :

| Critère | Si **oui** | Si **non** |
|---|---|---|
| `delta_capture_median ≥ 0.01` (gain ≥ 1 pp) | Modal worth it sur la médiane | Local suffit |
| `ci95_local` et `ci95_modal` **disjoints** sur `capture_median` | Gain stat sig à 5 % | Gain non-significatif |
| `delta_regret_rel_p90 ≤ 0` (Modal baisse ou égale la queue) | Modal robuste | Modal instable |
| `coverage_marginal` proche 1-α sur les deux | Calibration OK | Modal sous-couvre → danger auto-buy |
| `alert_precision` ≥ local (Modal ne dégrade pas l'alerting) | Modal valide pour alerting | Modal casse l'alerting |

**Règle** : on n'active `FLYEAS_ALGO_VERSION=v7a-modal` en prod que si **les 5
critères** passent. Sinon on reste sur V7a local.

## 6. Coût Modal attendu

| Phase | Container | Durée | Coût (CPU pricing) |
|---|---|---|---|
| Dataset full-data | 32 GB CPU | 30-60 min | ~0.20 $ |
| Split + features | 32 GB CPU | 20-30 min | ~0.10 $ |
| Baselines | 32 GB CPU | 15-30 min | ~0.10 $ |
| LGBM q10/q50/q90 + OOF | 32 GB CPU | 45-90 min | ~0.30-0.60 $ |
| Calibrate + backtest | 16 GB CPU | 10-20 min | ~0.05 $ |
| **Total** | | **≈ 2-3 h** | **~0.75-1.50 $/run** |

Budget `flyeas-v75` résiduel (~30 $) → ~15-20 itérations possibles avant
d'atteindre la limite. Large marge pour tester plusieurs `SAMPLE_EVERY` et
variantes LGBM.

## 7. Risques spécifiques à Modal

| Risque | Mitigation |
|---|---|
| Secret Kaggle non configuré → fetch échoue | `build_dataset_modal.py` exige le secret `kaggle-creds` ; documenté en commentaires. |
| Volume partagé avec `flyeas-v75` (legacy V7.6) | App name distincte `flyeas-v7a`, volume distinct `flyeas-v7a`. Aucun conflit. |
| Import des scripts V7a via `add_local_dir` | Si un script V7a local change, re-run `modal deploy`. Le run utilise la version snapshot. |
| Pas de GPU disponible quand on en veut un | Pas de GPU requis — LGBM est CPU-only. Neutre. |
| Dataset Modal écrase dataset local par accident | Impossible : paths taggés (`*_modal` vs `*_local`). |

## 8. Smoke test conseillé avant Modal

```bash
# Local d'abord — 15-30 min sur MacBook
V7A_TAG=local bash scripts/train/v7a/run_all_local.sh

# Vérifier les critères Go (baselines passent, coverage 80% ~ OK)
cat reports/v7a_baselines_local.json
cat reports/v7a_lgbm_metrics_local.json | python3 -m json.tool | head -40
cat reports/v7a_conformal_metrics_local.json | python3 -m json.tool | head -20
cat reports/v7a_backtest_local.json | python3 -m json.tool | head -40

# Si tout passe → Modal
modal token new                                 # une seule fois
modal secret create kaggle-creds KAGGLE_USERNAME=... KAGGLE_KEY=...
modal run scripts/cloud/v7a/build_dataset_modal.py
modal run scripts/cloud/v7a/run_v7a_modal.py
modal volume get flyeas-v7a /reports ./reports
python3 scripts/train/v7a/compare_local_vs_modal.py
cat reports/v7a_compare_local_vs_modal.json
```
