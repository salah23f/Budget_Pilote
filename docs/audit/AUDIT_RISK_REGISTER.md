# AUDIT — Registre de risques

Échelle gravité / probabilité : **Bloquante / Haute / Moyenne / Basse**.

---

## 1. Risques scientifiques / ML

| # | Risque | Gravité | Probabilité | Impact | Signal de détection | Mitigation |
|---|---|---|---|---|---|---|
| R1 | **Données intra-trimestre synthétiques i.i.d.** rendent tout signal temporel illusoire. | Bloquante | Certaine | Toute métrique séquentielle invalide ; auto-buy impossible | `01b-expand-temporal.py:146-152` ; autocorrélation empirique log-returns intra-quarter ≈ 0 | Geler ce script ; reconstruire dataset sur Kaggle dilwong réel. |
| R2 | **Stacking par `groupby(route).median()`** supprime toute dimension temporelle. | Bloquante | Certaine | "Meta-learner" apprend une régression cross-sectional ; effet ensemble annulé | `xgb_meta.py:81-83`, `bma_aggregator.py:51`, `copula_ensemble.py:51` | Refondre L1 : prédictions per-row, k-fold temporel. |
| R3 | **Overfit sur val** par double-usage (IQN, Thompson, conformal, BMA, Copula, isotonic). | Haute | Certaine | Métriques val optimistes, généralisation test dégradée | Compter les lectures de `val_features.parquet` dans le pipeline (7+) | Introduire un hold-out final disjoint de tout fit/calibration. |
| R4 | **Split XGB-meta non-temporel** (`xgb_meta.py:101`). | Haute | Certaine | Conformal downstream calibré sur données leak | `n*0.8` sur ordre pandas merge non-trié | Sortir par (route, fetched_at) avant split, ou TimeSeriesSplit. |
| R5 | **Rolling features incluent valeur courante** (`02-features.py`, `_common.py`). | Haute | Certaine | `z_score_30d` partiellement auto-prédictif | `(p - rolling_mean).abs()` anormalement faible | `shift(1)` avant agrégation. |
| R6 | **Per-route anchor d'ensemble utilisé sur test sans re-calibration saisonnière**. | Moyenne | Probable | Biais systématique si prix test sur-inflation vs val | Comparer `median(anchor)/median(p_test)` par saison | Appliquer un ajustement de niveau par saison ou ré-estimer l'anchor sur un holdout test calibration. |
| R7 | **Foundation models (Chronos, TiRex, Moirai-2, TimesFM)** utilisés sans vérifier leur distribution pre-training vs domaine vols. | Moyenne | Possible | Zero-shot biaisé | Comparer leurs prédictions sur un petit échantillon de prix vols réels | Tenir au moins 2 sur 4, tester sur held-out, n'inclure qu'après gain mesuré. |
| R8 | **GPD tail sur données i.i.d.** produit des paramètres shape≈0 (Gumbel), scale proche de σ_q. | Haute | Certaine | Alertes "extreme price" sans fondement | `shape` estimé ≈ 0 sur toutes routes | Supprimer ce composant tant que données réelles manquent. |
| R9 | **IQN CVaR réduit à moyenne par route** dans le backtest (`v76_backtest.py:102`). | Haute | Certaine | Signal IQN perd sa dynamique | CVaR est constant par route en backtest | Utiliser prédiction par timestep, pas la moyenne. |
| R10 | **Thompson winrate insuffisant pour déclencher** (wr×2 = 0.59 < 3). | Basse | Certaine | Thompson est quasi-no-op | Ablation Thompson vs no-Thompson → delta ≈ 0 | Supprimer Thompson ou repenser le score seuil. |
| R11 | **Absence de test statistique V7.6 vs V1** (Wilcoxon apparié, IC bootstrap). | Moyenne | Certaine | 62.9 % beats peut être bruit | Pas de p-value dans le summary | Ajouter test apparié + IC 95 % bootstrap. |
| R12 | **Pas de regret monétaire rapporté**. | Moyenne | Certaine | Le business case reste abstrait | `v76_summary.json` ne contient pas de $ save | Calculer `regret = p_paid - floor` et `economic_gain = p_buy_now - p_paid` par route. |
| R13 | **Conformal c_α = 199.86 USD énorme sans explication segmentée**. | Moyenne | Probable | Ou sur-couverture décorative, ou queues réelles non comprises | Coverage empirique par segment ; largeur/price ratio | Mondrian conformal par bucket TTD + route frequency. |
| R14 | **Pas de stress test out-of-distribution** (routes absentes du train). | Moyenne | Probable | Modèle peut fausser gravement sur nouvelle route | Coverage conformel sur routes `n_train=0` | Gate : si `n_train_route < 20`, agent répond ABSTAIN. |

---

## 2. Risques produit / ingénierie

| # | Risque | Gravité | Probabilité | Impact | Signal de détection | Mitigation |
|---|---|---|---|---|---|---|
| R15 | **ML Python V7.6 non branché au produit.** Le predictor utilisé en prod est `lib/agent/predictor.ts` (heuristique maison). | Haute | Certaine | 30+ scripts Modal inutiles, ROI compute proche de zéro | `grep "parquet\|modal" lib/` → 0 match | Exposer un endpoint Modal `@web_endpoint` et adapter `watcher.ts`. |
| R16 | **Auto-buy gate sur `predictor TS + threshold` seul.** Pas de gate par segment / route-fréquence / variance. | Haute | Certaine | Risque d'auto-buy mauvais sur routes rares ou très volatiles | `app/api/missions/[id]/propose/route.ts:191-320` | Ajouter gates : `n_train ≥ 50`, `conformal_width/price < 0.25`, `confidence ≥ 0.8`, `ttd_min_before_buy ≥ 3`. |
| R17 | **Confiance hardcodée 0.6 dans propose/route**. | Moyenne | Certaine | Seuil arbitraire non calibré sur taux de FP produit | Voir gate ligne 191+ | Tuner sur simulation, documenter la dérivation. |
| R18 | **Missions persistées dans `.data/missions.json`** (file system mono-instance). | Haute | Certaine | Race conditions, perte de données, scale bloqué | Commentaires explicites `lib/store/missions-db.ts:10-12` | Passer sur Supabase / Postgres managé. |
| R19 | **Pas de kill-switch auto-buy.** | Haute | Probable | Impossible de suspendre rapidement en cas de bug | Pas de flag runtime dans `propose` | Ajouter feature flag `AUTOBUY_ENABLED` + per-user toggle. |
| R20 | **Pas de shadow mode.** | Haute | Certaine | Pas de période "decision but don't execute" pour auditer | Pas de logs `decision_log` non-exécutés | Ajouter table `agent_decisions` + mode shadow. |
| R21 | **Contract BudgetPilotReceipt non audité**. | Moyenne | Possible | Si déployé en prod, vulnérabilité contractuelle | Contract de 41 lignes sans modifier/access | Audit indépendant + event-only suffit pour démo. |
| R22 | **FX rates writer est no-op caché** (`fx-rates.ts` `inserted++` sans insert DB). | Basse | Certaine | Features de change pas en DB | grep sur le fichier | Corriger l'appel DB. |
| R23 | **Expedia ICDM injecte données hôtel dans vol**. | Haute | Certaine | Pollution de la table tarifs | `origin='EXP', destination=prop_country_id` | Retirer l'ingester. |
| R24 | **BTS T-100 injecte prix reconstruit formule**. | Haute | Certaine | Prix de training partiellement fictif | `50 + distance*0.12` | Retirer ou flag `source='synthetic_regression'` + filter downstream. |
| R25 | **Wayback scraper bruyant regex $XX**. | Moyenne | Probable | Outliers non-vols injectés | quality=50 self-flag | Désactiver ou resserrer la regex + whitelist d'airlines. |
| R26 | **Kaggle `fetched_at = new Date()`** efface l'horodatage original. | Haute | Certaine | Perte du signal temporel d'observation | `kaggle.ts` au moment de `_normalize_*` | Préserver le `searchDate` d'origine. |

---

## 3. Risques compute / coût

| # | Risque | Gravité | Probabilité | Impact | Signal | Mitigation |
|---|---|---|---|---|---|---|
| R27 | **14+ modèles entraînés sur A100 pour 0 gain réel** (données synthétiques). | Haute | Certaine | ~15 $ de compute par run jetés | Historique runs Modal | Désactiver tous les experts sauf LightGBM quantile + 1 foundation tant que données pas réelles. |
| R28 | **Stack foundation (Chronos+TiRex+Moirai+TimesFM) inférence 4×2h**. | Moyenne | Certaine | ~8 $/run | Idem | Garder 1 à 2 sur 4. |
| R29 | **Re-calcul conformal + stacking + policy à chaque itération** | Moyenne | Certaine | Modification d'un poids redéclenche tout | `run_all_v3.py` | Découper l'orchestrateur pour ré-exécuter uniquement les étapes en aval d'un changement. |
| R30 | **Budget Modal restant ~30 $** — si un run foundation x4 échoue partiellement, on dépense sans feedback. | Moyenne | Possible | Épuisement budget sans gain | Historique | Séquencer les jobs du plus cheap au plus cher, stopper si baseline ne passe pas. |

---

## 4. Risques business / utilisateur

| # | Risque | Gravité | Probabilité | Impact | Signal | Mitigation |
|---|---|---|---|---|---|---|
| R31 | **Auto-buy à mauvais prix** sur routes rares → perte financière directe utilisateur. | Bloquante | Possible sans gate | Perte monétaire + churn | `auto-buy FPR > 1 %` | Gate `n_train_route < 50 → no auto-buy` ; plafond `B_auto` strict. |
| R32 | **Auto-buy pendant déviation marché inhabituelle** (grève, crise, covid-like). | Haute | Possible | Perte / achat panique | Pas de détection de régime macro | Feature macro (T-2 load factor, indices volatilité carrier) + gate si écart-type des prix récents explose. |
| R33 | **Utilisateur surpris** par une décision BUY_NOW non expliquée. | Moyenne | Certaine | Churn, plainte | Pas d'explanation UI | Fournir une justification : prix_vs_médiane, conformal width, TTD. |
| R34 | **Aucune action WAIT détaillée.** Le système est 0/1 BUY vs FORCE-BUY ; pas de scoring d'alertes "surveille attentivement". | Moyenne | Certaine | Produit moins pédagogique, utilisateur perd confiance | `v76_backtest.py:235-236` | Ajouter action ALERT avec seuil de confiance intermédiaire. |
| R35 | **Confusion de versions V7 TS (non entraîné) vs V7.6 Python**. | Moyenne | Certaine | Dette technique, bug-prone, message produit flou | `FLYEAS_ALGO_VERSION` env var | Unifier sous un seul nom de version, déprécier V7 TS. |

---

## 5. Risques de gouvernance / maintenance

| # | Risque | Gravité | Probabilité | Impact | Signal | Mitigation |
|---|---|---|---|---|---|---|
| R36 | **40+ scripts train / cloud, plusieurs variantes `-fast` et `-v2`** — dette technique expérimentale non rationalisée. | Haute | Certaine | Refactor difficile, bugs à chaque run | `scripts/cloud/v76_ultra/`, `v76_prod/`, `scripts/train/*-fast.py` | Choisir une seule pipeline canonique ; archiver le reste. |
| R37 | **`docs/FLYEAS_*_PROMPT.md` et rapports sans CI de reproduction**. | Moyenne | Probable | Rapport non reproductible, doute sur chiffres | Fichiers docs non versionnés de manière stricte | Pipeline reproductible + hash des données source. |
| R38 | **Pas de tests unitaires Python visibles** sur les policies/stacking. | Haute | Certaine | Bugs silencieux en production | Absence de `tests/` | Ajouter tests sur conformal, sur la formule regret, sur la causalité des features. |
| R39 | **Pas de CI lint/type** sur les scripts Python. | Moyenne | Certaine | Erreurs à l'exécution | Absence de `.github/workflows` pour Python | Ajouter mypy + ruff + pytest CI. |
| R40 | **Poids et artefacts sur volume Modal non versionnés par hash des données**. | Moyenne | Certaine | On ne peut pas savoir quel modèle a produit quelle métrique | Pas de manifest | Ajouter un manifest `run_<sha>_<timestamp>/` contenant data hash + git sha + seed. |

---

## 6. Synthèse — risques à mitiger *avant toute démo publique*

1. **R1 — Données synthétiques** (geler `01b-expand-temporal.py`).
2. **R2 — Stacking dégénéré** (refondre L1).
3. **R15 — Déconnexion ML / produit** (pont Modal ↔ Next.js).
4. **R23 — Contamination Expedia ICDM** (retirer).
5. **R24 — Prix T-100 reconstruit** (retirer).
6. **R26 — Timestamp Kaggle effacé** (préserver).
7. **R31 — Gate auto-buy** (ajouter `n_train_route`, `conformal_width/price`, `confidence ≥ 0.8`).

**Tant que 1, 2, 15, 23, 24, 26 ne sont pas traités, aucune communication externe sur les métriques ne doit être faite** — elles sont plausiblement toutes trompeuses.
