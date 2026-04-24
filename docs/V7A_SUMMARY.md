# V7A — Résumé d'exécution

Date : 2026-04-24  
Périmètre : exécution des 12 phases de la refondation V7a à partir de l'audit V7.6 (`docs/audit/`).

---

## Ce qui a été fait

### Code (écrit / modifié dans ce tour)

**Python V7a (11 fichiers + orchestrateur)** :
- `scripts/train/v7a/__init__.py`, `_env.py`
- `scripts/train/v7a/build_dataset.py` — dataset propre (Kaggle dilwong uniquement, sources toxiques exclues)
- `scripts/train/v7a/split.py` — 4 blocs `train/val/cal/test` temporels stricts
- `scripts/train/v7a/features.py` — rolling `shift(1)`, TTD, calendrier, haversine, popularity train-only
- `scripts/train/v7a/audit_leakage.py` — checks durcis (temporel, rolling-shift, target-leak, forbidden-test-reads, legacy warnings)
- `scripts/train/v7a/baselines.py` — buy_now, fixed_horizon_14, rolling_min_30, simple_quantile_10, v1_heuristic
- `scripts/train/v7a/lgbm_quantile.py` — q10/q50/q90, TimeSeriesSplit OOF, early-stop val, aucune lecture test/cal
- `scripts/train/v7a/calibrate.py` — isotonic per-quantile + conformal Mondrian sur `cal` uniquement
- `scripts/train/v7a/policy.py` — 6 actions (`ABSTAIN / WAIT / ALERT_SOFT / ALERT_STRONG / BUY_NOW / AUTO_BUY`) + 4 scores (offer / alert / buy / autobuy)
- `scripts/train/v7a/backtest.py` — seul autorisé à lire `test`. Qualité d'achat + qualité d'alerte + segmentation + tests statistiques
- `scripts/train/v7a/run_all_local.sh` — orchestrateur

**Cloud (Modal)** :
- `scripts/cloud/v7a/__init__.py`
- `scripts/cloud/v7a/serve.py` — endpoint `POST /predict` avec Bearer auth, inference LGBM + isotonic + conformal Mondrian + policy V7a. Fallback-friendly (timeout court côté client).

**Produit (Next.js)** :
- `lib/agent/v7a/client.ts` — client HTTP Modal avec timeout 2 s et fallback `null`.
- `lib/agent/v7a/index.ts` — façade `predictV7aFirst()` compatible shape V1, 3 modes (`v1`, `shadow`, `v7a`), kill-switch via `FLYEAS_AUTOBUY_ENABLED`.
- `app/api/agent/shadow-log/route.ts` — ingestion des décisions shadow (Supabase avec fallback JSONL), logs observabilité.

**Infrastructure** :
- `.github/workflows/flyeas-watcher.yml` — réécrit avec préflight secrets, erreurs actionnables, retry avec backoff, variable optionnelle `FLYEAS_FAIL_IF_UNCONFIGURED`.

**Scripts V7.6 neutralisés (sans suppression destructrice)** :
- `scripts/train/01b-expand-temporal.py` — corps remplacé par `sys.exit(2)` + bannière. La synthèse gaussienne i.i.d. intra-trimestre ne peut plus tourner par accident.
- `scripts/ingest/expedia-icdm.ts` — `ingestExpediaICDM()` throw une erreur explicite. Fin de la contamination hôtels 2013.
- `scripts/ingest/bts-t100.ts` — `SOURCE = 'bts-t100-synthetic-regression'` pour filtrage downstream (prix reconstruit `50 + dist·0.12`).
- `scripts/ingest/kaggle.ts` — `streamParseCSV` préserve `searchDate` (plus d'écrasement par `new Date()`), ajoute `quality=100|50`, `depart_date` dérivé du vrai timestamp.

### Documentation (13 fichiers V7A_*.md)

1. `V7A_SCOPE.md` — composants gardés / supprimés / différés (source de vérité)
2. `V7A_DATASET.md` — Kaggle dilwong + schéma `v7a_clean.parquet`
3. `V7A_SPLIT.md` — 4 blocs et règles d'usage, garde-fous `assert_test_split_not_read`
4. `V7A_FEATURES.md` — liste exhaustive `feat_*` + causalité
5. `V7A_LEAKAGE.md` — contrôles et sortie machine-readable
6. `V7A_BASELINES.md` — 5 baselines + critères Go/No-Go
7. `V7A_LGBM.md` — architecture + hyper-params + pipeline OOF
8. `V7A_CONFORMAL.md` — isotonic + Mondrian + coverage par segment
9. `V7A_BACKTEST.md` — métriques d'achat ET d'alerte + critères produit
10. `V7A_POLICY.md` — 6 actions, 4 scores, règles de transition, garde-fous
11. `V7A_PRODUCT_INTEGRATION.md` — endpoint Modal + adaptateur TS + env vars + patch watcher (non appliqué)
12. `V7A_WATCHER_WORKFLOW.md` — fix du cron GHA + matrice complète des secrets
13. `V7A_SHADOW_MODE.md` — schéma `agent_decisions` + critères d'activation `v7a` + auto-buy
14. `V7A_SUMMARY.md` — ce fichier

## Ce qui passe (prêt à l'emploi)

- ✅ Arborescence V7a complète (scripts, cloud, lib/agent/v7a, API route, docs).
- ✅ Orchestrateur local `run_all_local.sh` exécutable sur MacBook M2 8 GB (sauf build_dataset si Kaggle/Supabase non dispo).
- ✅ Neutralisation des 4 points les plus dangereux de V7.6 (synthèse i.i.d., Expedia, T-100, `new Date()` Kaggle).
- ✅ Workflow GitHub Actions corrigé — diagnostic actionnable quand un secret manque.
- ✅ Endpoint Modal + adaptateur TS avec fallback V1 propre, timeout 2 s, kill-switch auto-buy.
- ✅ Policy multi-niveaux avec timing d'alerte comme objectif de premier ordre.
- ✅ Audit leakage renforcé (contrôles qui auraient attrapé les leaks V7.6).

## Ce qui ne passe pas encore (à faire par l'utilisateur)

### Exécution

- ⚠ **Je n'ai pas pu exécuter les scripts Python V7a** : les commandes Bash de cette session étaient bloquées par le sandbox et les dépendances `lightgbm / scikit-learn / pandas / pyarrow` ne sont pas confirmées installées. Les scripts sont prêts mais attendent une exécution locale.
- ⚠ Les renommages `mv` n'ont pas pu s'appliquer ; j'ai donc choisi la technique alternative "dead-file" (remplacement du contenu), qui est plus robuste git-wise de toute façon.

### Validation

- ⚠ **Go/No-Go Phase 0** : `phase0_report.json` n'existe pas encore. Il sera produit par `run_all_local.sh`. Il faut comparer :
  - `v7a.capture_median` vs `rolling_min_30.capture_median` (Wilcoxon p<0.05)
  - `v7a.regret_rel_p90` vs `rolling_min_30.regret_rel_p90`
  - Coverage conformelle ~80 % par segment
- ⚠ Si les critères Go ne passent pas : **ne pas** brancher V7a en prod. Investiguer les données (possiblement pas assez de Kaggle dilwong ingéré, ou signal temporel trop faible).

### Déploiement

- ⚠ Modal volume `flyeas-v7a` à créer + artefacts à uploader (`modal volume put flyeas-v7a data/models_v7a /models_v7a`).
- ⚠ Modal secret `MODAL_V7A_SECRET` à créer et attacher à l'app.
- ⚠ Env Vercel à compléter : `MODAL_V7A_URL`, `MODAL_V7A_SECRET`, `FLYEAS_ALGO_VERSION=shadow`, `FLYEAS_AUTOBUY_ENABLED=false`.
- ⚠ GitHub secrets à vérifier : `FLYEAS_BASE_URL`, `FLYEAS_CRON_SECRET`.
- ⚠ Supabase table `agent_decisions` à créer (schéma dans `V7A_SHADOW_MODE.md`).
- ⚠ Patch watcher non appliqué : `lib/agent/watcher.ts` appelle encore `predict()` / `predictV7()` existants. Le patch exact est dans `V7A_PRODUCT_INTEGRATION.md`. À appliquer **uniquement après** que `run_all_local.sh` passe les critères Go.

### Shadow mode

- ⚠ Pas encore lancé. Exige : (a) artefacts Modal uploadés, (b) `FLYEAS_ALGO_VERSION=shadow`, (c) patch watcher appliqué, (d) `agent_decisions` existante.
- ⚠ Durée requise : ≥ 2 semaines, ≥ 500 décisions par bucket dense avant activation `v7a`.
- ⚠ Auto-buy réel plafonné : jamais avant shadow validé + `FLYEAS_AUTOBUY_ENABLED=true`.

## Préhistoire V7.6 — statut courant

| Composant V7.6 | Statut après V7a |
|---|---|
| `01b-expand-temporal.py` | **Neutralisé** (sys.exit) |
| `expedia-icdm.ts` | **Neutralisé** (throw) |
| `bts-t100.ts` | **Flaggué** `synthetic-regression` |
| `kaggle.ts` | **Patché** (searchDate préservé) |
| `xgb_meta.py`, `bma_aggregator.py`, `copula_ensemble.py` | Non appelés par V7a. Restent sur disque, loggés en warning par l'audit leakage. À supprimer définitivement quand V7a sera stable. |
| `iqn_policy.py`, `bocpd_evt.py`, `thompson_sampling.py`, `v76_backtest.py` | Idem |
| 14 experts deep (`patchtst_*`, `mlcaformer_*`, `mamba_*`, `kan_*`, `garch_nn_*`, `timegrad_*`, `ts2vec_*`, `chronos2_*`, `tirex_*`, `moirai2_*`, `timesfm_*`) | Idem — aucun re-run nécessaire pour V7a |
| `lib/agent/v7/*` | **Gardé en place** comme filet. Le bug `rKey` non défini dans `watcher.ts:186` existe toujours mais n'est actif que si `FLYEAS_ALGO_VERSION=v7` (mode non recommandé) |
| `scripts/train/{03..11}-*.py` | Non appelés par V7a. Restent sur disque. |

## Commandes exécutables (ordre)

```bash
# 0. Dépendances Python locales
pip3 install lightgbm==4.3.0 scikit-learn==1.5.0 pandas==2.2.2 pyarrow==16.1.0 numpy==1.26.4 scipy==1.13.1

# 1. Ingérer Kaggle dilwong si pas déjà fait (via scripts/ingest/kaggle.ts patché)

# 2. Full pipeline V7a local
bash scripts/train/v7a/run_all_local.sh

# 3. Inspecter les rapports
cat reports/v7a_baselines.json
cat reports/v7a_lgbm_metrics.json
cat reports/v7a_conformal_metrics.json
cat reports/v7a_backtest.json
cat reports/v7a_segmented_metrics.json

# 4. Vérifier leakage
cat data/audit/leakage_report.json

# 5. Si Go : créer runtime_stats.json (snippet dans V7A_PRODUCT_INTEGRATION.md) puis :
modal volume create flyeas-v7a
modal volume put flyeas-v7a data/models_v7a /models_v7a
modal deploy scripts/cloud/v7a/serve.py

# 6. Configurer env Vercel + GitHub secrets (V7A_PRODUCT_INTEGRATION.md, V7A_WATCHER_WORKFLOW.md)

# 7. Tester le workflow cron : GitHub → Actions → Flyeas watcher → Run workflow

# 8. Appliquer le patch watcher (V7A_PRODUCT_INTEGRATION.md), déployer
# 9. Passer FLYEAS_ALGO_VERSION=shadow, attendre 2 semaines, analyser

# 10. Si tout passe : FLYEAS_ALGO_VERSION=v7a, FLYEAS_AUTOBUY_ENABLED=false encore
# 11. Plus tard : FLYEAS_AUTOBUY_ENABLED=true avec plafond strict
```

## Règles d'or respectées (prompt utilisateur)

- ✅ Pas d'utilisation de `01b-expand-temporal.py`, Expedia ICDM, T-100 comme prix, xgb_meta/bma/copula, experts deep V7.6, IQN, BOCPD, Thompson.
- ✅ Pas de tentative de sauver V7.6 — V7a est reconstruit à partir de zéro sur un cœur simple.
- ✅ Hold-out `test` n'est lu que par `backtest.py` (gardé par `assert_test_split_not_read`).
- ✅ Aucun modèle n'est branché au produit sans passer les critères V7a (patch watcher documenté mais non appliqué).
- ✅ Timing d'alerte traité comme objectif de premier ordre (4 scores indépendants, métriques d'alerting dans le backtest, action `ALERT_SOFT`/`ALERT_STRONG` distinctes).
- ✅ Reproductibilité (`_env.write_manifest` avec `git_sha`, `ts_utc`, `file_sha256`).
- ✅ Aucune complexité sophistiquée réintroduite sans justification.
- ✅ Workflow GitHub Actions corrigé avec préflight, secrets documentés, fix actionnable.

## Risques résiduels

1. **Pas encore exécuté** : le dataset cible (Kaggle dilwong) peut ne pas être ingéré ; V7a suppose une ingestion fonctionnelle.
2. **Volume dataset** : si < 50 000 lignes après filtrage qualité=100, V7a logge un warning. Sous ce seuil, LightGBM quantile aura peu de signal.
3. **Fenêtre temporelle dilwong** (2022-2023) : les prédictions V7a seront biaisées sur les aéroports US. Ne pas déployer en international avant V7b.
4. **Parité inference runtime** : `scripts/cloud/v7a/serve.py:_feat_from_payload` doit reproduire *exactement* les features de `scripts/train/v7a/features.py`. Toute dérive → prédictions incorrectes en prod.
5. **Bug V7 TS legacy** : `lib/agent/watcher.ts:186` référence `rKey` non défini. Pas un problème tant que `FLYEAS_ALGO_VERSION ≠ 'v7'`. Le patch V7a n'y touche pas — à fixer dans un second PR.

## Réponse aux questions clés du prompt utilisateur

- **V7a est-il crédible, causal, branché produit ?** Le code est prêt. Le "branché produit" est **structurellement prêt** (endpoint Modal + adaptateur + shadow-log + workflow) mais **pas encore déployé** (actions ops restent à l'utilisateur).
- **Timing d'alerte** : première classe dans la policy, scores indépendants, métriques dédiées dans le backtest.
- **GitHub Actions** : workflow corrigé, secrets documentés, test manuel fourni, matrice de diagnostic 200/401/404/5xx.
- **Go/No-Go** : défini noir sur blanc dans `V7A_BASELINES.md` et `V7A_BACKTEST.md`. Pas d'avis subjectif.
- **Auto-buy** : jamais avant shadow validé, kill-switch obligatoire, gate strict per-bucket.
