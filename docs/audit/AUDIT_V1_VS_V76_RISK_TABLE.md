# AUDIT V1 vs V7.6 ULTRA — TABLEAU DE RISQUES

Convention :
- 🟢 risque faible / contenu
- 🟡 risque modéré / surveillé
- 🟠 risque élevé / mitigation requise
- 🔴 risque bloquant / incompatible avec auto-buy

---

## Risques scientifiques

| Catégorie | V1 | V7.6 ultra | Meilleur | Justification |
|---|---|---|---|---|
| Validité du signal appris | 🟢 N/A — n'apprend rien | 🔴 Pipeline d'expansion temporelle gelé après audit ; modèles entraînés sur bruit gaussien synthétisé | **V1** | Un modèle sans apprentissage ne peut pas apprendre du bruit. V7.6 a documenté son apprentissage du bruit. |
| Leakage train/val/test | 🟢 Pas de fit, pas de leakage | 🟠 Split temporel propre à la source (`01-split.py`) mais re-split non-temporel `xgb_meta.py:101` ; val sur-utilisé 7×; rolling features incluant le présent | **V1** | V7.6 a au moins 4 sources de leakage documentées dans `AUDIT_RISK_REGISTER.md`. |
| Données causales | 🟢 Observations watcher temps réel, horodatées | 🔴 Mélange contaminé : T-100 (prix reconstruit), Expedia (hôtels), HuggingFace (timestamp forcé), expansion gelée | **V1** | V1 utilise ce que le watcher voit au moment T. V7.6 utilise des données déjà mélangées et désinformées. |
| Calibration formelle | 🟡 Aucune calibration formelle (`confidence` ad-hoc) | 🟠 Conformal/isotonic mécaniquement propre, calibré sur val invalide | Égalité | V1 est pratiquement utile sans calibration. V7.6 a une calibration techniquement riche mais sur substrat invalide. |
| Métrique objectif explicite | 🟡 Pas d'objectif optimisé, juste règles | 🟠 Optimise `signals ≥ 3` qui n'a pas de sémantique métier | **V1** | V1 ne ment pas sur ce qu'il fait. V7.6 prétend optimiser quand il n'a pas défini de fonction d'utilité. |
| Régularisation / overfitting | 🟢 Pas de paramètres appris | 🟠 XGBoost reg_lambda=1.0, early stop sur val sur-utilisé | **V1** | |
| Couverture conformelle empirique | 🔴 Inexistante | 🟠 Théoriquement valide mais non-mesurée empiriquement par segment | Égalité | Aucun des deux n'a une coverage exploitable comme gate auto-buy. |

**Bilan scientifique : V1 4 — V7.6 ultra 0 — Égalité 2.**

---

## Risques produit

| Catégorie | V1 | V7.6 ultra | Meilleur | Justification |
|---|---|---|---|---|
| Décision produit en prod | 🟢 V1 décide depuis cron 15 min | 🔴 V7.6 ne décide nulle part | **V1** | Pas comparable — V7.6 n'est pas un moteur produit. |
| Risque de faux auto-buy | 🟡 Possible, gate `confidence ≥ 0.6` + `FLYEAS_AUTOBUY_ENABLED` | 🔴 Si branché aujourd'hui : 37 % de routes plus mauvaises que V1 | **V1** | |
| Confiance utilisateur | 🟢 `Prediction.reason` en NL, transparent | 🟠 Aucune sortie explicable | **V1** | |
| Cohérence buy timing | 🟡 TTD pondéré 15 % du composite | 🟠 TTD<7 force +2 dans signals | **V1** | V1 est plus mesuré sur le force-buy. |
| Lock-in vendor | 🟢 Vercel + Supabase (standard) | 🔴 Modal-only, pas d'option locale crédible | **V1** | |
| Coût opérationnel | 🟢 ~0 | 🟠 ~$8-10/run train + Modal inference | **V1** | |
| Latence décision | 🟢 <5 ms | 🟠 ~1 s estimé (Modal) | **V1** | |
| UX explicable | 🟢 `reason` en langage naturel | 🔴 Score numérique opaque | **V1** | |

**Bilan produit : V1 8 — V7.6 ultra 0.**

---

## Risques opérationnels

| Catégorie | V1 | V7.6 ultra | Meilleur | Justification |
|---|---|---|---|---|
| Dépendance externe | 🟢 Vercel + Supabase + flight providers | 🟠 + Modal + 6+ artefacts cohérents | **V1** | |
| Robustesse en panne | 🟢 Cold-start fallback + Supabase fallback fichier | 🔴 Aucun fallback défini | **V1** | |
| Debuggabilité | 🟢 `subScores` + `reason` exposés | 🟠 8 termes additifs difficiles à inverser | **V1** | |
| Capacité de rollback | 🟢 `git revert` ou `FLYEAS_ALGO_VERSION=v1` | 🟢 Trivial (rien à rollback) | Égalité | |
| Onboarding nouveau dev | 🟢 Senior TS suffit | 🟠 ML engineer + Modal expertise | **V1** | |
| Bug silencieux | 🟡 Seuils hardcodés peuvent dériver | 🟠 Pipeline en plusieurs services, plus de surface de bugs | **V1** | |
| Maintenance long terme | 🟢 ~650 LoC TS isolés | 🔴 ~7 000 LoC Python multi-runtime cross-cloud | **V1** | |
| Reproductibilité | 🟢 Déterministe pure | 🟠 Thompson stochastique, OOF non reproducibles sans seed | **V1** | |

**Bilan opérationnel : V1 7 — V7.6 ultra 0 — Égalité 1.**

---

## Risques de sur-évaluation et illusion métrique

| Catégorie | V1 | V7.6 ultra | Meilleur | Justification |
|---|---|---|---|---|
| Métriques rapportées trompeuses | 🟢 Pas de métriques internes auto-rapportées | 🔴 `capture_median 62.74 %` masque 37 % de routes pires que V1 ; pas de CI95 | **V1** | |
| Comparaison V1/V7.6 biaisée | 🟢 N/A | 🔴 V1 ré-implémenté avec cold-start `idx≥5` vs V7.6 `idx≥3` | **V1** | |
| Floor oracle ex-post | 🟢 Pas applicable | 🟠 `floor = float(p.min())` sur série test entière | **V1** | |
| Sur-confiance des coefficients | 🟡 Coefficients composite (0.4/0.25/0.2/0.15) non-calibrés | 🟠 Coefficients signals (3/1/2/2/2/1/1/2) non-justifiés | Égalité | Les deux ont des coefficients magiques. V1 les affiche, V7.6 les noie. |
| Faux sentiment de "ML serious" | 🟢 V1 ne se prétend pas ML | 🔴 V7.6 affiche 11 modèles foundation/custom alors que la décision finale est un score additif | **V1** | |

**Bilan sur-évaluation : V1 4 — V7.6 ultra 0 — Égalité 1.**

---

## Risques auto-buy spécifiques

| Catégorie | V1 | V7.6 ultra | Meilleur | Justification |
|---|---|---|---|---|
| Probabilité de fausse alerte BUY_NOW | 🟡 Inconnu, mais V1 est conservateur | 🟠 `signals ≥ 3` se déclenche fréquemment, distribution non documentée | **V1** | |
| Gate de confiance par route | 🟠 N'existe pas | 🟠 N'existe pas | Égalité | Les deux laissent passer des routes inconnues. |
| Gate "abstain si data sparse" | 🟢 Cold-start force `confidence ≤ 0.35`, le gate `confidence ≥ 0.6` filtre | 🔴 Pas de logique cold-start cohérente, `idx≥3` minimal | **V1** | |
| Coverage conformelle exploitable | 🔴 Pas de coverage | 🟠 Existe en théorie, calibrée sur invalid | Égalité | |
| Acceptabilité legale/produit pour vrai argent | 🟡 Auto-buy avec V1 = pari sur un système non-calibré | 🔴 Auto-buy avec V7.6 ultra = pari sur un système entraîné sur du bruit | **V1** | |
| Kill switch | 🟢 `FLYEAS_AUTOBUY_ENABLED=false` instantané | 🟢 Pas applicable | Égalité | |

**Bilan auto-buy : V1 3 — V7.6 ultra 0 — Égalité 3.**

---

## Risques d'incompréhension équipe

| Catégorie | V1 | V7.6 ultra | Meilleur | Justification |
|---|---|---|---|---|
| Lecture du code | 🟢 4 signaux, 367 lignes | 🟠 11 + 3 + 5 modules, plusieurs runtimes | **V1** | |
| Lecture des sorties | 🟢 `reason` en langage naturel | 🟠 Score numérique sans contexte | **V1** | |
| Surprise lors d'un incident | 🟢 Faible (V1 simple, log clair) | 🟠 Élevé (composite signal opaque) | **V1** | |
| Capacité de challenge par junior | 🟢 Possible (un dev mid peut auditer V1) | 🔴 Impossible (nécessite expertise ML) | **V1** | |

**Bilan équipe : V1 4 — V7.6 ultra 0.**

---

## Synthèse globale

| Axe | V1 (gagnant) | V7.6 ultra (gagnant) | Égalité |
|---|---|---|---|
| Scientifique | 4 | 0 | 2 |
| Produit | 8 | 0 | 0 |
| Opérationnel | 7 | 0 | 1 |
| Sur-évaluation | 4 | 0 | 1 |
| Auto-buy | 3 | 0 | 3 |
| Équipe | 4 | 0 | 0 |
| **Total** | **30** | **0** | **7** |

**V7.6 ultra ne gagne aucun axe.** Sur 37 catégories de risque évaluées, V1 est strictement préférable ou à égalité. **Cette asymétrie n'est pas une question d'opinion — elle est structurelle au fait que V7.6 ultra n'est pas branché et n'a pas été validé sur données réelles.**

---

## Top 7 risques résiduels même si on choisit V1

1. **V1 est lui-même médiocre** : capture_median 0.814 sur dilwong, battu par toutes les baselines composées. Pas un "bon" moteur, juste "moins faux".
2. **Seuils V1 non-calibrés** : les chiffres `-0.8`, `0.6`, `20`, `70` tiennent par chance. Pas d'ablation testée.
3. **V1 sans gate route inconnue** : si watcher voit une route nouvelle ou rare, V1 émet quand même une décision.
4. **V1 sans coverage formelle** : pas exploitable en gate auto-buy "prudent".
5. **Artefacts V7.6 ultra orphelins dans le repo** (`bma_weights.json`, `copula_weights.json`, scripts policy/stacking/models) — risque de recâblage par erreur.
6. **Shadow log V7a corrigé récemment** (commit 4fcf82e) : toute analyse historique d'avant ce commit est invalide. Pas un risque V1 strict, mais affecte la décision "promouvoir V7a".
7. **Le pivot V7a (`ensemble_ttd_switch`) bat V1 mesurablement.** Garder V1 comme moteur primaire est un choix de prudence court-terme, pas une recommandation moyen-terme.
