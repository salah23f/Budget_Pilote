# V7A_SCOPE — Périmètre V7a

V7a est la refondation minimale issue de l'audit V7.6 (voir `docs/audit/`).  
Principe : **prouver la base avant d'empiler la sophistication**.

## ⚠ PIVOT A (2026-04-24) — moteur de décision = baseline composée

Le ML LGBM quantile sur target `future_gain` a été testé sur dilwong (3.25M
rows, 11 750 trips test) avec hypothèse H1 (règle de stopping avec coussin
conformal atténué sur TTD long). Résultat final :

| | V7a ML + H1 | baseline `ensemble_ttd_switch` |
|---|---|---|
| Global capture_median | 0.8880 | **0.9115** |
| 0-7  | 0.9396 | **0.9496** |
| 8-21 | 0.8796 | **0.8989** |
| 22-60 | 0.9079 | **0.9127** |

**Verdict NO-GO strict**. V7a ML pur ne bat la baseline sur aucun segment. La
décision V7a repose désormais sur la baseline composée `ensemble_ttd_switch` :

```
BUY_NOW si TTD ≤ 7  → price ≤ rolling_min_30(price_history)
BUY_NOW si TTD > 7  → price ≤ Q10(train_route)
sinon WAIT
```

Le ML (quantiles, conformal, drop_proba) est conservé comme **couche de
confiance auxiliaire** exposée dans `ml_layer` (non décisionnelle).
Voir `docs/V7A_PIVOT_A_REPORT.md` pour le journal complet.

---

## 1. Composants GARDÉS pour V7a (après pivot A)

| Composant | Emplacement | Rôle V7a |
|---|---|---|
| Split temporel strict | `scripts/train/v7a/split.py` | Base train/val/cal/test |
| Features causales | `scripts/train/v7a/features.py` | Rolling shift(1), TTD, calendrier |
| Audit leakage renforcé | `scripts/train/v7a/audit_leakage.py` | Empêche les régressions silencieuses |
| Baselines + `ensemble_ttd_switch` | `scripts/train/v7a/baselines.py` | **Moteur de décision primaire** après pivot A |
| Export baseline assets | `scripts/train/v7a/export_baseline_assets.py` | Produit `baseline_assets.json` pour serving |
| LightGBM quantile (auxiliaire) | `scripts/train/v7a/lgbm_quantile.py` | q10/q50/q90, conservé comme couche confiance |
| Isotonic + Conformal (auxiliaire) | `scripts/train/v7a/calibrate.py` | Intervalles pour UI ; **plus décisionnel** |
| Policy multi-niveaux (gelée) | `scripts/train/v7a/policy.py` | Archivée comme historique des expérimentations ; non utilisée en serving |
| Backtest segmenté | `scripts/train/v7a/backtest.py` | Validation des hypothèses ; bench V7a vs baselines |
| **Endpoint Modal V7a** | `scripts/cloud/v7a/serve.py` | **Sert `ensemble_ttd_switch` en primaire + ML en couche confiance** |
| Adaptateur client | `lib/agent/v7a/*.ts` | Map V7a action → V1 action pour compat propose route |
| Shadow logging | `app/api/agent/shadow-log/route.ts` | Décisions journalisées |
| Watcher existant | `lib/agent/watcher.ts`, `app/api/agent/sweep/route.ts`, `app/api/missions/[id]/propose/route.ts` | Orchestration produit inchangée |
| Predictor V1 | `lib/agent/predictor.ts` | Fallback quand endpoint Modal indisponible |

## 2. Composants SUPPRIMÉS / DÉSACTIVÉS

| Composant | Raison | Action prise |
|---|---|---|
| `scripts/train/01b-expand-temporal.py` | Synthèse i.i.d. N(µ_q, σ_q) → signal temporel = bruit gaussien | Corps remplacé par `sys.exit(2)` avec bannière explicative |
| `scripts/ingest/expedia-icdm.ts` | Données hôtels 2013 injectées avec `origin='EXP'` dans la table vol | Fonction exporte un throw explicite |
| `scripts/ingest/bts-t100.ts` | Prix reconstruit par régression `50 + dist·0.12` | `SOURCE = 'bts-t100-synthetic-regression'` pour filtrage explicite downstream |
| `scripts/ingest/kaggle.ts` `fetched_at = new Date()` | Écrasement du vrai timestamp d'observation | Préservation de `searchDate` + `quality=100/50` |
| `scripts/cloud/v76_ultra/stacking/xgb_meta.py` | Split 80/20 non-temporel sur merge pandas + `groupby(route).median()` | Pas réutilisé en V7a. À supprimer uniquement après V7a déployé. |
| `scripts/cloud/v76_ultra/stacking/bma_aggregator.py` | Fit et score sur les mêmes lignes + agrégation par route | idem |
| `scripts/cloud/v76_ultra/stacking/copula_ensemble.py` | Copule jamais fittée, nom trompeur | idem |
| `scripts/cloud/v76_ultra/policy/iqn_policy.py` | CVaR sur bruit i.i.d. | idem |
| `scripts/cloud/v76_ultra/policy/bocpd_evt.py` | µ/σ figés, GPD sur bruit gaussien | idem |
| `scripts/cloud/v76_ultra/policy/thompson_sampling.py` | Contribution mesurable ≈ 0 | idem |
| `scripts/cloud/v76_ultra/models/{patchtst,mlcaformer,mamba,garch_nn,kan,timegrad}_*.py` | Dégénèrent en régresseur moyenne-route sur données actuelles | Pas réutilisés en V7a |
| `scripts/cloud/v76_ultra/models/ts2vec_pretrain.py` | Apprend embedding route (utile), mais pas comme TS | Gardé sur disque, non invoqué par V7a |
| `scripts/train/{03..11}-*.py` | Experts V7 (GP, HMM, LSTM, TFT, DeepAR, VAE, MAML, CQL) sur données synthétiques | Pas réutilisés en V7a |
| `scripts/cloud/v76_ultra/policy/v76_backtest.py` | Score composite rule-based, pas d'optimal stopping | Remplacé par `scripts/train/v7a/backtest.py` |
| `lib/agent/v7/*.ts` | Réimplémentation TS non entraînée de 9 modèles, bug `rKey` dans `watcher.ts:186` | Gardé en l'état — non appelé par V7a. Un TODO de suppression complète après 4 semaines de V7a stable. |

## 3. Composants DIFFÉRÉS (V7b / V7c)

| Composant | Conditions pour réintroduction |
|---|---|
| 1 foundation model zero-shot (Chronos *ou* TiRex) | V7a valide, complémentarité mesurée (bootstrap_win_ratio ≥ 0.55 sur CVaR) |
| Bandit contextuel | Buffer d'actions/rewards réels loggés depuis ≥ 4 semaines de shadow mode |
| HMM régime | Données temporelles denses réelles ≥ 2 ans |
| BOCPD online | Idem + utilité démontrée en gate "abstain si rupture récente" |
| Offline RL (CQL) | ≥ 10k missions loggées avec regret mesuré |
| Embedding TS2Vec route | Comme feature statique LGBM si gain mesuré ≥ 1 pp capture segmenté |

## 4. Règles d'or V7a

1. **Pas de réintroduction** d'un composant supprimé sans preuve expérimentale (bootstrap win ratio, gain stat sig).
2. **Pas de retour à V7.6** : l'audit est la source de vérité ; les artefacts V7.6 existants ne sont pas consommés par V7a.
3. **Le hold-out `test` est gelé** : aucun script sauf `backtest.py` ne le lit.
4. **Pas d'auto-buy** tant que shadow mode n'a pas validé la policy (≥ 2 semaines).
5. **Pas de Modal** tant que Phase 0 locale (baselines + LGBM + conformal + backtest) n'a pas atteint les critères Go.
6. **Timing d'alerte** est traité comme objectif de premier ordre, pas sous-produit.

## 5. Arborescence V7a

```
scripts/train/v7a/           # pipeline commun local + Modal
  __init__.py
  _env.py                    # lit V7A_TAG, V7A_DATA_ROOT, V7A_REPORTS_ROOT
  build_dataset.py           # Phase 2 (Supabase ou parquet)
  fetch_dilwong.py           # Phase 2 (Kaggle direct) + sampling reproductible
  split.py                   # Phase 3
  features.py                # Phase 4
  audit_leakage.py           # Phase 5
  baselines.py               # Phase 6
  lgbm_quantile.py           # Phase 7
  calibrate.py               # Phase 8 (isotonic + conformal Mondrian)
  backtest.py                # Phase 9 (seul lecteur du test hold-out)
  policy.py                  # Phase 10
  compare_local_vs_modal.py  # Comparateur dual-mode
  run_all_local.sh           # Orchestrateur 100 % local (smoke test)

scripts/cloud/v7a/            # full-data sur Modal
  __init__.py
  _common.py                 # app + volume + image + container_env
  serve.py                   # Endpoint @web_endpoint (prod)
  build_dataset_modal.py     # fetch Kaggle + clean full 82M lignes
  run_v7a_modal.py           # Orchestrateur pipeline full-data

lib/agent/v7a/
  index.ts                   # predictV7a() + fallback
  client.ts                  # HTTP client Modal

app/api/agent/shadow-log/
  route.ts                   # Phase 12

.github/workflows/flyeas-watcher.yml  # Phase 11b (patch + doc)

docs/
  V7A_*.md                   # 14 docs (dont V7A_LOCAL_VS_MODAL.md)

reports/
  v7a_<basename>_local.json  # produits par scripts V7a (V7A_TAG=local)
  v7a_<basename>_modal.json  # produits par Modal pipeline (V7A_TAG=modal)
  v7a_compare_local_vs_modal.json

data/
  ml_cache/v7a_clean_local.parquet
  ml_cache/v7a_clean_modal.parquet  (copie download depuis Volume Modal, optionnel)
  splits_v7a_local/*.parquet
  splits_v7a_modal/*.parquet (sur Volume Modal, pas en local)
  features_v7a_local/*.parquet
  models_v7a_local/*.pkl, *.parquet
  audit/leakage_report.json
```

## 6. Dual-mode (local + Modal)

Voir `docs/V7A_LOCAL_VS_MODAL.md`. Résumé :
- `V7A_TAG=local` (défaut) : smoke test sur MacBook 8 GB, sampling 1/25.
- `V7A_TAG=modal` : full 82M lignes sur container 32 GB, via `run_v7a_modal.py`.
- Comparaison systématique via `compare_local_vs_modal.py` → verdict
  `modal_worth_it` (gain ≥ 1 pp capture_median + CI95 disjoints).
