# AUDIT V1 vs V7.6 ULTRA — EXECUTIVE SUMMARY

Date : 2026-04-25
Auditeur : principal research engineer / quant scientist (audit comparatif tranché)
Périmètre : `lib/agent/predictor.ts` (V1) vs `scripts/cloud/v76_ultra/*` + `scripts/train/*` (V7.6 ultra)
Référentiel d'évaluation : `reports/v7a_backtest_local.json` (dilwong, 11 750 trips test)

---

## Verdict global (tranché, sans ambiguïté)

**V1 est meilleur que V7.6 ultra aujourd'hui comme moteur Flyeas. Mais aucun des deux n'est un bon moteur primaire à long terme.**

- V1 est en production. V7.6 ultra n'est branché à rien : aucun fichier TypeScript ne lit `bma_weights.json`, `xgb_meta_oof_predictions.parquet`, `copula_weights.json`, ni n'appelle un endpoint Modal V7.6. Le pipeline Python tourne dans le vide.
- L'audit interne `docs/audit/AUDIT_EXECUTIVE_SUMMARY.md` (2026-04-23) a déjà classé V7.6 "non fiable". Le script source de la contamination temporelle (`scripts/train/01b-expand-temporal.py`) a été gelé (`sys.exit(2)`). Le pivot V7a a été décidé.
- Les chiffres internes V7.6 ("capture median 62.74 %, beats V1 62.9 %") proviennent d'un backtest sur données synthétiques i.i.d. Ils ne mesurent pas un signal ML réel — ils mesurent l'ajustement à un bruit gaussien généré par un script aujourd'hui désactivé.
- Mesuré sur les vraies données dilwong (`reports/v7a_backtest_local.json`), V1 a `capture_median = 0.814` et `regret_p50 = $33`, contre `ensemble_ttd_switch` (le pivot V7a) à `capture_median = 0.911` et `regret_p50 = $13`. **Donc V1 est aussi battu par une simple baseline composée.**

Niveau de confiance dans ce verdict : **élevé.** Trois sources convergent : (1) absence d'intégration TS de V7.6, (2) audit interne déjà rendu, (3) `01b-expand-temporal.py` gelé en commit récent.

---

## Réponse explicite à la question

| Question | Réponse |
|---|---|
| Qui est le meilleur **moteur primaire aujourd'hui** ? | **V1.** V7.6 n'est pas un moteur — c'est de la R&D non câblée. |
| Qui est le meilleur **scientifiquement** ? | **V1**, par défaut. La sophistication V7.6 est entraînée sur du bruit. Une heuristique honnête > un modèle entraîné sur données invalides. |
| Qui doit-on **garder à long terme** ? | **Ni l'un ni l'autre comme moteur primaire.** V1 reste comme fallback. La pile décisionnelle doit basculer sur `ensemble_ttd_switch` (déjà choisi par le pivot V7a). |
| Faut-il **rebrancher V7.6 ultra** ? | **Non.** Les artefacts L0/L1/L2 sont contaminés par expansion synthétique. Reentraîner sans les corrections du pivot V7a serait répéter l'erreur. |

---

## Top 5 raisons pour lesquelles V1 gagne

1. **V1 décide en production. V7.6 ultra ne décide nulle part.** `vercel.json` route `/api/agent/sweep` vers le watcher TS qui appelle `predict()` (V1) en défaut et en fallback. Aucune route n'appelle V7.6. Suppression de V7.6 = la prod ne casse pas. Suppression de V1 = la prod casse.
2. **L'évaluation V7.6 est compromise à la racine.** `01b-expand-temporal.py` synthétisait 50 obs/trimestre par tirage i.i.d. `N(µ_q, σ_q)` clippé. Toute métrique séquentielle V7.6 est un artefact de cette synthèse. Le script est aujourd'hui gelé — l'aveu est interne.
3. **V1 a une logique vérifiable ligne à ligne.** 4 signaux (z-score, percentile, trend, TTD), seuils explicites, sortie explicable en langage naturel. V7.6 ultra a 11 modèles L0 → 3 stackers L1 → 5 modules policy L2. La somme `signals ≥ 3` n'a pas de sémantique probabiliste claire.
4. **Le backtest V7.6 contre V1 triche structurellement.** `v76_backtest.py:158-172` ré-implémente une "V1" avec cold-start `idx ≥ 5` alors que V7.6 utilise `idx ≥ 3`, donne à V7.6 deux observations supplémentaires d'avance. C'est un test biaisé en faveur de V7.6 — et même comme ça, V7.6 perd sur 37 % des routes.
5. **V1 a un comportement bien défini en cold-start.** Si `n < 5`, V1 retombe sur une règle TTD-only (`buy si TTD < 14 sinon monitor`) avec confiance bornée. V7.6 ultra n'a pas de comportement défini sur routes hors-distribution train (anchor manquant → fallback EMA, sans gate de confiance).

---

## Top 5 risques restants (avec ou sans V1)

1. **V1 est lui-même médiocre.** Capture median 0.814, regret p90 $230. Battu par toutes les baselines testées (`rolling_min_30`, `simple_quantile_10`, `ensemble_ttd_switch`). Un V1 en prod n'est pas un "bon moteur" — c'est juste "moins faux" que V7.6.
2. **Les seuils V1 sont hardcodés sans calibration.** `Z_BUY_THRESHOLD = -0.8`, `PCT_BUY_THRESHOLD = 20`, etc. Aucun de ces nombres n'est le résultat d'une optimisation sur données réelles. Ils tiennent par chance.
3. **V1 n'a pas d'incertitude calibrée.** `confidence` est une combinaison ad-hoc de `sampleConfidence`, `trendConfidence`, `compositeCertainty`. Pas de coverage garanti, pas d'intervalle conformel, donc pas exploitable en gate auto-buy "prudent".
4. **Le shadow log V7a/V1 vient d'être réparé.** Le commit 4fcf82e (récent) a corrigé un bug où `agent_decisions.action` recevait l'opinion V7a au lieu de l'action V1 réelle. Toute analyse shadow antérieure à ce commit est invalide.
5. **Les artefacts V7.6 traînent encore dans le repo.** `bma_weights.json`, `copula_weights.json`, `scripts/cloud/v76_ultra/policy/*` ne sont plus consommés mais subsistent. Risque qu'un futur contributeur recâble V7.6 par erreur sans relire l'audit. Recommandation forte : déplacer sous `archive/v76_ultra/` avec README explicite.

---

## Distinctions clés (sévérité demandée)

- **Sophistication ≠ qualité.** V7.6 ultra empile 11 modèles foundation/custom, 3 stackers, 5 policies. V1 a 4 règles. La sophistication V7.6 mesure du bruit gaussien synthétisé en aval, pas un signal métier.
- **Entraîné ≠ meilleur.** XGBoost meta-learner est techniquement entraîné. Mais le split `n*0.8` après merge pandas (`xgb_meta.py:101`) n'est pas temporel ; les OOF L0 sont alignés par `groupby(route).median()` ; la cible est une moyenne cross-sectional. L'entraînement converge vers la moyenne du bruit, pas vers une décision optimale.
- **Évaluation ≠ crédibilité.** Le `v76_summary.json` rapporte capture median, beats_v1 %, conformal `c_α`. Aucune CI95, aucune segmentation TTD/route, aucune significativité statistique. Le rapport `v7a_backtest_local.json` (V7a/baselines) en a, parce que le pivot V7a est sérieux.
- **Crédibilité réelle.** V1 est crédible parce que petit, lisible, branché. V7.6 ultra est non-crédible parce que sa pipeline d'entraînement passe par un script désactivé, et que personne ne consomme ses sorties.

---

## Niveau de confiance

| Affirmation | Confiance |
|---|---|
| V1 est branché en prod, V7.6 ultra non | 0.99 |
| Le backtest V7.6 est invalide à cause de `01b-expand-temporal.py` | 0.95 |
| V1 bat V7.6 sur tout critère opérationnel pertinent | 0.95 |
| V1 reste insuffisant comme moteur primaire à long terme | 0.90 |
| Le bon moteur primaire est `ensemble_ttd_switch` (V7a pivot A), pas V1 | 0.85 |

---

## Fichiers livrés

1. `AUDIT_V1_VS_V76_EXECUTIVE_SUMMARY.md` (ce fichier)
2. `AUDIT_V1_VS_V76_ARCHITECTURE.md`
3. `AUDIT_V1_VS_V76_SCIENCE.md`
4. `AUDIT_V1_VS_V76_PRODUCT_OPS.md`
5. `AUDIT_V1_VS_V76_RISK_TABLE.md`
6. `AUDIT_V1_VS_V76_FINAL_DECISION.md`
