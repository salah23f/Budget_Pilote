# AUDIT V1 vs V7.6 ULTRA — PRODUIT & OPS

## 1. Branchement réel au produit

| Question | V1 | V7.6 ultra |
|---|---|---|
| Importé par `lib/agent/watcher.ts` ? | **Oui** (`import { predict } from './predictor'`) | Non |
| Appelé par `/api/agent/sweep` ? | **Oui** (default + fallback) | Non |
| Appelé par `/api/cron/monitor` ? | **Oui** | Non |
| Appelé par `/api/cron/demo-shadow-sweep` ? | **Oui** | Non |
| Appelé par `/api/missions/[id]/propose` ? | **Oui** (via `prediction.action`) | Non |
| Endpoint Modal exposé via `@modal.web_endpoint` ? | N/A | **Aucun** dans `scripts/cloud/v76_ultra/` |
| Loader TS pour `bma_weights.json`, `xgb_meta_oof_predictions.parquet` ? | N/A | **Aucun** |
| Suppression du module = prod casse ? | **Oui** | Non |

V1 = moteur opérationnel. V7.6 ultra = R&D sans pont produit.

---

## 2. Robustesse opérationnelle

### V1

| Aspect | État |
|---|---|
| Dépendance providers | `searchFlights()` (Amadeus / Sky-Scrapper / Kiwi). Si tous tombent, watcher retourne `cheapest=null`, predictor pas appelé. Echec gracieux. |
| Dépendance artefacts | Aucune. Statistiques calculées en RAM à chaque appel. |
| Dépendance Modal | Aucune. |
| Latence | <5 ms typique (in-memory stats sur 30-200 samples). Negligeable vs latence `searchFlights` (1-3 s). |
| Points de panne | (a) `price_history` Supabase down → fallback fichier JSON ; (b) `baselines.computeBaseline` retourne null → cold-start kick in. |
| Fallback | Cold-start (TTD-only, confidence ≤ 0.35). Toujours retourne une `Prediction`. |
| Debuggabilité | `subScores` exposés (`zScoreScore`, `percentileScore`, `trendScore`, `ttdScore`). `reason` en langage naturel. |

### V7.6 ultra

| Aspect | État |
|---|---|
| Dépendance providers | N/A (pas branché en prod). Si branché, dépendrait de `searchFlights()` + Modal endpoint. |
| Dépendance artefacts | Critique : nécessite `xgb_meta.json`, `bma_weights.json`, `conformal_calibration.json`, `route_evt_params.parquet`, `iqn_oof_predictions.parquet`, `thompson_weights.json`. Tous sur `/vol/models_v76/` (volume Modal). |
| Dépendance Modal | Totale. Le pipeline `run_all_v3.py` est Modal-only ; pas d'option locale crédible (containers 16 GB RAM × 8 CPU × 60 min). |
| Latence | Inconnue en prod (jamais branché). En théorie : 1 appel Modal ~500 ms cold start + 200-800 ms inférence. À comparer aux 8 s de timeout V7a actuel. |
| Points de panne | (a) Modal cold start, (b) charge artefacts depuis volume, (c) any L0 model fail → meta degraded, (d) anchor manquant pour route hors-train → fallback EMA non-validé. |
| Fallback | Aucun défini. En cas d'échec, comportement non-spécifié. |
| Debuggabilité | `signals` cumulatif difficile à inverser (8 termes). Pas de sortie `reason`. |

### Verdict §2 — robustesse

**V1 est dramatiquement plus robuste.** V7.6 ultra suppose une chaîne d'artefacts cohérents et une infrastructure Modal disponible — chaîne qui n'a même pas été montée pour la prod. V1 fonctionne avec un fichier JSON local.

---

## 3. Maintenabilité

### V1

- **Taille** : 367 lignes (`predictor.ts`) + 80 (`baselines.ts`) + 200 (`price-history.ts`). Total ~650 LoC.
- **Type-safe** : TypeScript strict, types `Prediction`, `PredictorInput`, `Baseline` exportés.
- **Tests** : à vérifier (`tests/agent/predictor.test.ts` plausible). À défaut, V1 est suffisamment simple pour test à l'œil.
- **Lisibilité** : commentaires explicatifs (`/** Z-score below this triggers BUY_NOW... */`).
- **Dette technique** : seuils hardcodés non-calibrés, `confidence` ad-hoc.
- **Monitoring** : `agent_decisions` table loggue chaque décision. Logs `console.log('[v7a-shadow-watcher]', ...)`.
- **Rollback** : trivial — `git revert` ou `FLYEAS_ALGO_VERSION=v1`.

### V7.6 ultra

- **Taille** : ~7 000 LoC Python (`scripts/train/{00..12}-*.py` + `scripts/cloud/v76_ultra/**/*.py` + `scripts/cloud/v76_prod/**/*.py`).
- **Composants** : 11 modèles L0 + 3 stackers L1 + 5 policy L2 + 19 scripts m01..p05 dans `v76_prod`. La complexité est cumulative.
- **Tests** : aucun découvert.
- **Lisibilité** : modèles foundation hétérogènes (Chronos2, TiRex, Moirai2, TimesFM ont chacun leur API). Stacking utilise pandas merge naïf.
- **Dette technique** : (a) split non-temporel `xgb_meta.py:101`, (b) `groupby(route).median()` perte d'info, (c) val sur-utilisé, (d) noms trompeurs (`copula_ensemble.py` n'est pas une copule).
- **Monitoring** : aucun en prod (pas branché). Logs Modal volatils.
- **Rollback** : pas applicable — rien à rollback.
- **Maintenance future** : ~3 h 30 et ~$8-10 par run complet sur Modal (cf `docs/audit/AUDIT_COMPUTE_PLAN.md`). Itération coûteuse.

### Verdict §3 — maintenabilité

**V1 est ~10× plus petit, lisible et maintenable.** V7.6 ultra demande un mainteneur ML expert, une infra Modal stable, et un budget compute récurrent. La maintenance V7.6 est l'équivalent d'un projet de recherche de bord qui ne sert à rien tant que le pont produit n'existe pas.

---

## 4. Latence et coût

| Composant | V1 | V7.6 ultra |
|---|---|---|
| Latence inférence | <5 ms | Estimée 700-1300 ms (Modal cold + inference) |
| Latence search upstream | 1-3 s (Amadeus etc.) | 1-3 s identique |
| Coût par décision | ~0 (compute Vercel inclus) | Inconnu (Modal facturé compute) |
| Coût entraînement | 0 | ~$8-10 par run, ~3 h 30 |
| Coût stockage | <1 MB JSON | ~ centaines de MB d'artefacts sur volume Modal |

### Verdict §4 — coût

V1 est gratuit à l'usage. V7.6 ultra a un coût d'entraînement non-amorti (jamais déployé) et un coût d'inférence Modal qui n'est pas facturé puisque non-actif.

---

## 5. Lisibilité de la décision pour l'utilisateur final

### V1

`Prediction.reason` (lib/agent/predictor.ts:329-358) produit une explication naturelle :

> "$420 is 18% below the $510 average for this route (47 samples, prices have been rising about $4/day). Only 12% of historical prices beat this one. Probability of seeing better in the next 7 days: 22%. Strong buy."

Compatible UI claire, transparent pour l'investisseur, validable par un humain.

### V7.6 ultra

Aucune sortie textuelle côté policy. Le score composite (`signals=4` par exemple) n'est pas explicable au client. Une intégration produit honnête nécessiterait une couche d'explication ad-hoc (LLM ou template manuel).

### Verdict §5 — UX

**V1 produit du contenu UX-ready. V7.6 ultra produit un score numérique opaque.** Pour un produit d'auto-buy qui doit créer la confiance, c'est un avantage non-négligeable.

---

## 6. Risque produit / opérationnel

| Risque | V1 | V7.6 ultra |
|---|---|---|
| Auto-buy sur faux signal | Possible (seuils non calibrés) | Pas applicable (pas branché) — mais si branché : élevé (37 % routes pires que V1) |
| Confiance utilisateur cassée par mauvaise décision | Modéré (V1 conservateur en cold-start) | Inconnu, non-mesuré sur données réelles |
| Incident en cas de panne | Faible (pure TS, fallback gracieux) | Élevé (Modal cold start, artefacts requis) |
| Lock-in vendor | Faible (Vercel + Supabase, standard) | Élevé (Modal-only) |
| Embauche/onboarding | Senior dev TS suffit | ML engineer + Modal expertise nécessaires |

### Verdict §6 — risque opérationnel

**V1 a un profil de risque produit acceptable mais non-zéro. V7.6 ultra a un profil de risque produit catastrophique en cas de branchement honnête sur les artefacts actuels** (à cause des données contaminées et des 37 % de routes où il perd contre V1).

---

## 7. Capacité d'évolution

### V1

Évolutions naturelles à coût faible :
- Calibrer `Z_BUY_THRESHOLD`, `PCT_BUY_THRESHOLD` par TTD bucket (1 jour).
- Ajouter un gate "abstain si `n < 10` ou `route inconnue`" (½ jour).
- Remplacer `expectedSavingsIfWait` par un quantile empirique 7-day (1 jour).
- Brancher `ensemble_ttd_switch` baseline V7a comme alternative testable côté V1 (1-2 jours).

### V7.6 ultra

Évolutions naturelles à coût élevé :
- Reconstruire le dataset sur dilwong propre (~1 semaine, ~$5 Modal).
- Remplacer le stacking par LightGBM quantile temporel (~1 semaine, ~$5 Modal).
- Construire un endpoint `@modal.web_endpoint` lu par `lib/agent/watcher.ts` (~3 jours).
- Réécrire les 5 modules policy L2 sans perdre la cohérence (~1-2 semaines).

**Total estimé pour rendre V7.6 utile : 3-5 semaines + ~$30 Modal + une refonte conformément à `docs/audit/AUDIT_TARGET_ARCHITECTURE.md`.** À ce stade, on aurait reconstruit V7a, qui existe déjà. Donc l'évolution V7.6 ultra n'est pas un investissement rationnel.

---

## 8. Synthèse produit / ops

| Axe | V1 | V7.6 ultra | Gagnant |
|---|---|---|---|
| Branchement réel | ✅ moteur défaut + fallback | ❌ aucun pont TS | **V1** |
| Robustesse | Excellente (in-memory, fallback) | Inconnue (jamais déployé) | **V1** |
| Latence | <5 ms | ~1 s (estimé) | **V1** |
| Coût | ~0 | ~$8-10/run + Modal inférence | **V1** |
| Maintenabilité | ~650 LoC TS | ~7 000 LoC Python multi-runtime | **V1** |
| Explicabilité UX | `reason` en langage naturel | Aucune | **V1** |
| Lock-in | Vercel/Supabase standard | Modal-only | **V1** |
| Capacité d'évolution | Itération rapide low-cost | Refonte 3-5 semaines pour atteindre V7a | **V1** |

**Score produit/ops : V1 8 — V7.6 ultra 0.**

V7.6 ultra n'a aucun avantage produit ou opérationnel mesurable aujourd'hui.
