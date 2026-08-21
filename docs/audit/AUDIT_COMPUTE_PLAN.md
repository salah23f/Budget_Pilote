# AUDIT — Plan compute (local vs Modal vs à éviter)

Contraintes :
- Machine locale : MacBook Air M2, 8 GB RAM.
- Budget Modal restant : ~30 $ (après les runs précédents).

---

## 1. Classification des jobs

### 1.1 À exécuter **localement** (coût 0 $, rapide)

| Job | Motif | Mémoire | Durée estimée |
|---|---|---|---|
| Audit / lint / tests unitaires | CPU pur | <1 GB | minutes |
| `01-split.py` | CPU, streaming | 2-4 GB | ~3 min pour 500k rows Kaggle dilwong seul |
| `02-features.py` (après correction rolling `shift(1)`) | CPU pandas | 2-4 GB | ~2 min |
| `audit-leakage.py` v2 (renforcé) | CPU | <1 GB | ~1 min |
| LightGBM quantile sur 500k rows Kaggle | CPU-friendly | 3-5 GB | 5-10 min |
| Isotonic calibration | CPU trivial | <500 MB | secondes |
| Conformal calibration | CPU trivial | <500 MB | secondes |
| NNLS ensemble 2-3 modèles | CPU trivial | <500 MB | secondes |
| Backtest Python sur hold-out | CPU | 2-3 GB | 1-2 min |
| Segmentation (TTD × freq × volatility) | CPU pandas | 2-3 GB | 1-2 min |
| Bootstrap IC 95 % | CPU, parallélisable | 2-3 GB | 5 min |
| Plot reliability diagrams | CPU trivial | <500 MB | secondes |

**Tout le cœur V7a peut tourner en local en <30 minutes, sans Modal.**

### 1.2 À exécuter sur **Modal** (coût justifié)

| Job | Motif | GPU | Durée | Coût estimé |
|---|---|---|---|---|
| Foundation model inference (Chronos *ou* TiRex, sur ≥ 32 obs/route) | ≥ 3 GB VRAM, modèle pré-entraîné lourd | A10G | 30-45 min | 0.5-0.8 $ |
| DB1B streaming aggregation (si 62M lignes locales pas OK) | I/O + mémoire | CPU 8 vCPU | 10 min | 0.1 $ |
| Large-scale backtest (>1M rows) si données réelles étendues | parallélisme | CPU 8 vCPU | 10-20 min | 0.2 $ |

**Raison** : on peut tout faire en local *sauf* l'inférence d'un foundation model et l'agrégation de 62M rows si le dataset reste en place.

### 1.3 À **éviter** (ROI négatif)

| Job | Motif |
|---|---|
| Re-train PatchTST / MLCAFormer / Mamba / KAN / TimeGrad / GARCH-NN / TS2Vec | Dégénèrent en régresseur moyenne-route sur données actuelles ; LGBM quantile fait mieux en 1/100ᵉ du temps |
| Re-train TFT / DeepAR / LSTM / VAE / MAML / CQL | Idem, et aucun log d'actions pour RL |
| Inférence les 4 foundation models | Redondant — 1 ou 2 suffisent |
| Re-fit BMA / Copula avant refonte du stacking | Le `groupby.median()` invalide tout |
| Ré-exécuter `01b-expand-temporal.py` | Produit les données synthétiques à l'origine de tout le problème |
| Re-fit IQN / BOCPD / GARCH-NN / TimeGrad en production sur synthetic | Gaspillage |
| Re-fit Thompson sur même data | Gaspillage |

---

## 2. ROI compute par composant

| Composant | Coût marginal | Gain métrique attendu | ROI |
|---|---|---|---|
| LightGBM quantile avec causal features | ~0 (local) | Baseline solide | ★★★★★ |
| Conformal calibration sur hold-out | ~0 | Fonde les intervalles | ★★★★★ |
| Segmentation metrics + bootstrap IC | ~0 | Sépare signal/bruit | ★★★★★ |
| Chronos zero-shot sur routes denses | 0.5 $ | Probablement +1-3 pp capture | ★★★ |
| TiRex zero-shot | 0.5 $ | Diversité | ★★ (sauf si complémentaire mesuré) |
| Moirai-2 | 0.5 $ | Diversité | ★★ |
| TimesFM | 0.5 $ | Diversité | ★★ |
| NNLS blending des 1-2 foundation + LGBM | ~0 | Robustesse queues | ★★★★ |
| Re-train PatchTST | 2 $ | ~0 | ★ |
| Re-train MLCAFormer | 2 $ | ~0 | ★ |
| Re-train Mamba / GARCH-NN / TimeGrad | 2-3 $ chacun | <0 (trompe le lecteur) | 0 |
| BOCPD / IQN / Thompson re-fit | 1-2 $ | ~0 | 0 |

**Conclusion ROI** : 90 % de la valeur en 10 % du compute si on fait baseline LGBM local + 1-2 foundation sur Modal.

---

## 3. Séquence recommandée des 30 $ Modal restants

Préambule obligatoire en local **avant tout run Modal** :
- Geler `01b-expand-temporal.py`.
- Reconstruire un dataset `kaggle_dilwong_clean.parquet` en préservant `searchDate` (pas `new Date()`).
- Corriger les rolling features (`.shift(1)`).
- Recalculer split train/val/test sur **les vraies dates d'observation**.
- Couper un **hold-out test** final que *rien* dans le pipeline ne touche.

Puis :

### Phase 1 — Baselines & calibration (local, 0 $)

1. Baseline buy-now, fixed-horizon, rolling-min, simple-quantile.
2. LightGBM quantile q10/q50/q90.
3. Isotonic calibration (pred vs target).
4. Conformal calibration avec vraie calibration-block disjointe.
5. Backtest produce `regret_p50, p90, p99, coverage, interval_width, capture`.
6. Segmentation : TTD × route_freq × volatility.
7. Test statistique V1 vs LGBM-quantile (Wilcoxon, IC bootstrap).

→ **Si V7 LGBM ne bat pas buy-now + fixed-horizon + rolling-min avec significance**, stop net. Pas la peine de lancer Modal.

### Phase 2 — Foundation models (Modal, ~6 $)

Conditionnel à : Phase 1 a donné un LGBM qui bat les baselines simples.

8. Chronos-Bolt zero-shot sur routes avec ≥ 32 obs. (A10G ~30 min, ~0.5 $).
9. TiRex zero-shot idem. (~0.5 $).
10. Upload prédictions à volume Modal, download en local.
11. NNLS blend (LGBM_q50, Chronos_q50, TiRex_q50) isotonic + Pareto en local.
12. Conformal sur résidus blend, par segment.

→ Si blend n'apporte pas >1 pp capture_median *statistiquement significatif* sur au moins 2 segments, on reste sur LGBM seul.

### Phase 3 — Validation finale (Modal, ~3 $)

13. Full backtest sur test hold-out avec manifest (git SHA, data hash, seed).
14. Shadow mode simulé : tracer BUY_NOW / WAIT / ALERT par mission synthétique.
15. Stress test : routes rares, ttd<7, high-vol routes.

→ Rapport `V7a_final_report.md` reproductible.

### Phase 4 — Monte-Carlo et bootstrap (local, 0 $)

16. 1000 bootstrap resamples par route pour IC sur capture_median.
17. Sensitivity study sur α conformal (0.05, 0.10, 0.20).
18. Coverage diagrams per segment.

### Phase 5 — Pont produit (local, 0 $)

19. Exposer `V7a predict(route, ttd, price_history)` via endpoint Modal `@modal.web_endpoint` (ou via inference locale CPU + API route Next.js).
20. Remplacer `lib/agent/predictor.ts` par appel à V7a.
21. Garder `lib/agent/v7/*` en fallback local si Modal down.

### Marge & itération (~16 $ restants pour Phase 2-3 retries)

Si une étape Modal casse ou demande ré-itération, on a ~16 $ pour :
- Tester un 3ᵉ foundation (Moirai-2 ou TimesFM).
- Augmenter la taille de training LGBM si Kaggle dilwong + BTS DB1B route-quarter (comme feature, pas comme TS).
- Re-fit si un bug data est détecté.

---

## 4. Ce qu'il **ne faut pas** faire avec le budget restant

- ❌ Ré-entraîner la pile deep V7.6 (PatchTST, MLCAFormer, Mamba, KAN, TimeGrad, GARCH-NN, TS2Vec) sur les données actuelles.
- ❌ Ré-exécuter `run_all_v3.py` end-to-end.
- ❌ Relancer conformal/BMA/Copula avant refonte.
- ❌ Ajouter un nouveau foundation model sans avoir d'abord mesuré la complémentarité de 2 existants.
- ❌ Entraîner un RL (CQL, MAML) tant qu'il n'y a pas de buffer d'actions/rewards logués.

---

## 5. Runtime local : ce qui rentre dans 8 GB RAM

| Dataset | Taille | RAM consommée pandas | OK sur M2 8GB ? |
|---|---|---|---|
| Kaggle dilwong 500k rows | ~200 MB csv | ~1.5 GB pandas | ✅ |
| BTS DB1B 62M rows | ~4 GB csv total | streaming only | ✅ en streaming |
| Features 500k × 30 colonnes float32 | ~60 MB | ~400 MB pandas | ✅ |
| LightGBM training 500k × 30 | 1-2 GB | ~2 GB | ✅ |
| Chronos inference 500k rows | N/A | doit passer sur GPU → Modal | ❌ local |

**Conclusion** : tout ce qui n'est pas un foundation model passe en local.

---

## 6. Priorité d'exécution par compute bucket

| Bucket | Total coût | Pourquoi |
|---|---|---|
| **Local (8 GB M2, 0 $)** | 0 $ | Baselines, LGBM, conformal, isotonic, backtest, segmentation, bootstrap, metrics, shadow simulation, plots |
| **Modal A10G (~6-8 $)** | 6-8 $ | 2 foundation zero-shot + petit aggregation DB1B si nécessaire |
| **Modal A100 (à éviter)** | 0 $ | Rien ne justifie A100 en V7a |
| **Marge / retries** | ~16 $ | Réserve pour débug et 2-3 itérations |

**Total usage optimal : 10-15 $ sur 30 $ disponibles. Les 15-20 $ restants sont la marge de sécurité.**

Voir `AUDIT_ACTION_PLAN_30_DOLLARS.md` pour les commandes exactes à lancer.
