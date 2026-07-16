# AUDIT V1 vs V7.6 ULTRA — DÉCISION FINALE

Date : 2026-04-25
Auditeur : principal research engineer / quant scientist (audit comparatif tranché)

---

## VERDICT FINAL

### Qui est le meilleur moteur aujourd'hui ?

**V1 est le meilleur moteur Flyeas aujourd'hui, sans aucune ambiguïté.**

Niveau de confiance : **0.95.**

### Est-ce un meilleur moteur primaire, un meilleur fallback, ou aucun des deux ?

**V1 est le seul des deux qui est un moteur primaire viable aujourd'hui.** V7.6 ultra n'est ni moteur primaire ni fallback — c'est un projet de R&D non-câblé qui a été audité comme "non fiable" en interne le 2026-04-23, suivi du gel de son script central de génération de données (`scripts/train/01b-expand-temporal.py`, `sys.exit(2)`) et d'un pivot vers V7a (`docs/V7A_SCOPE.md`).

**Mais V1 reste un moteur primaire médiocre.** Sur les 11 750 trips dilwong test, V1 a `capture_median = 0.814` et `regret_p50 = $33`, là où la baseline composée `ensemble_ttd_switch` (déjà en serving via V7a Modal en mode shadow) atteint `capture_median = 0.911` et `regret_p50 = $13`. À moyen terme, **V1 doit être démis de son rôle de défaut au profit de `ensemble_ttd_switch`**, ce qui est précisément ce que fait le pivot V7a "Pivot A" déjà acté.

### Pourquoi exactement ?

Cinq raisons structurelles, par ordre de gravité décroissante :

1. **Branchement.** V1 est appelé par `lib/agent/watcher.ts` (ligne 320, défaut) et en fallback (ligne 287) du watcher en mode shadow et v7a. V1 alimente les décisions de `/api/agent/sweep` (cron GitHub Actions */15) et des deux crons Vercel (`/api/cron/monitor`, `/api/cron/demo-shadow-sweep`). V7.6 ultra n'est référencé nulle part dans `lib/`, `app/`, ni `vercel.json`. Aucun fichier TypeScript ne lit un seul artefact V7.6 (`bma_weights.json`, `xgb_meta_oof_predictions.parquet`, etc.). **Suppression de V1 = prod casse. Suppression de V7.6 = prod inchangée.**

2. **Validité scientifique.** Le pipeline d'entraînement V7.6 dépendait de `01b-expand-temporal.py` qui synthétisait 50 obs/quarter par tirage `N(µ_q, σ_q)` clippé. Toute dépendance temporelle apprise par les modèles deep (LSTM, TFT, DeepAR, MAML, Mamba, MLCAFormer, GARCH-NN, TimeGrad, BOCPD, IQN) tournait sur du bruit gaussien. Le script est aujourd'hui gelé (`sys.exit(2)`). Les artefacts entraînés sur ce substrat sont structurellement compromis. V1 n'apprend rien et ne peut pas être contaminé par ce substrat.

3. **Évaluation.** Le seul backtest V7.6 (`scripts/cloud/v76_ultra/policy/v76_backtest.py`) compare une V7.6 avec cold-start `idx≥3` à une V1 ré-implémentée avec `idx≥5` — V7.6 a deux observations d'avance déloyales. Le `floor` est l'oracle ex-post sur la série test entière. Le `v76_summary.json` n'a ni CI95, ni segmentation TTD, ni regret monétaire absolu. Et même dans ce cadre biaisé, V7.6 perd contre V1 sur 37 % des routes — ce qui est rédhibitoire pour un auto-buy. À l'inverse, le rapport V1 dans `reports/v7a_backtest_local.json` a CI95, segmentation TTD (0-7, 8-21, 22-60), et regret p50/p90/p99 par bucket.

4. **Décision opérationnelle.** V1 a une logique en 4 termes pondérés visibles, une sortie ternaire BUY/MONITOR/WAIT, une `reason` en langage naturel, et un cold-start défini. V7.6 ultra a un score additif à 8 termes opaque (`signals ≥ 3`), pas de sortie explicable, et un comportement non-spécifié sur routes hors-distribution train (anchor manquant → fallback EMA non-validé). V1 est UX-ready ; V7.6 demande une couche d'explication ad-hoc.

5. **Robustesse.** V1 fonctionne in-memory en TypeScript pur, latence <5 ms, fallback gracieux en cold-start. V7.6 ultra dépend de Modal cold-start (~500 ms à 1 s estimé), d'un volume `/vol/models_v76/` cohérent, de 6+ artefacts qui doivent rester alignés, et n'a aucun fallback défini. V7.6 ne peut pas être ré-exécuté de bout en bout aujourd'hui sans modifier le script gelé.

### Conditions dans lesquelles le verdict pourrait changer

Le verdict ne changerait que si **toutes** les conditions suivantes étaient simultanément satisfaites :

1. Le pipeline d'entraînement V7.6 est reconstruit sur Kaggle dilwong propre uniquement (suppression définitive des contributions T-100, Expedia, HuggingFace, expansion synthétique).
2. Le stacking est remplacé par une régression quantile temporelle (LightGBM TimeSeriesSplit OOF) avec un hold-out test gelé.
3. La calibration conformelle est refaite sur un val disjoint, jamais utilisé pour l'entraînement.
4. Un endpoint `@modal.web_endpoint` V7.6 est exposé et lu par `lib/agent/watcher.ts` avec un fallback V1 défini.
5. Un backtest V7.6 vs `ensemble_ttd_switch` (et non V1) montre un gain `capture_median` ≥ +1 pp **avec CI95 disjoint** sur **chaque segment TTD**.
6. Le shadow mode V7.6 tourne en prod ≥ 2 semaines avec regret réel p50 < $20 et regret p90 < $150.

À l'arrivée de ces 6 conditions, on aurait reconstruit le squelette de ce que V7a est en train d'être, plus une couche ML supplémentaire. **L'investissement rationnel est donc de continuer V7a (Pivot A acté), pas de ressusciter V7.6 ultra.**

---

## Que faut-il garder de V1 ?

| À garder | Pourquoi |
|---|---|
| `lib/agent/predictor.ts` (V1) | Moteur de défaut + fallback. Lisible, testable, sans dépendance externe. |
| `lib/agent/baselines.ts`, `lib/agent/price-history.ts` | Stats pures et time-series store, propres et réutilisables. |
| `lib/agent/watcher.ts` | Orchestrateur unique, déjà préparé pour V7a (mode shadow / v7a actif). |
| Cold-start TTD-only | Comportement défini en l'absence de données — propriété rare. |
| `Prediction.reason` | UX-ready, transparent, valuable côté UX et investor-facing. |

---

## Que faut-il garder de V7.6 ultra ?

**Très peu.** Liste honnête :

| À garder | Pourquoi |
|---|---|
| `scripts/train/01-split.py` | Split temporel strict, base saine pour V7a. Déjà gardé. |
| `scripts/cloud/v76_ultra/policy/conformal_os.py` | Mécanique conformal techniquement correcte. À ré-utiliser sur un val propre dans V7a. |
| `scripts/cloud/v76_ultra/_common.py` | Volume Modal, image base, helpers `load_split`, `route_key`. Réutilisable comme base de scripts/cloud/v7a/. |

Tout le reste (modèles L0 deep, stackers L1, policies BOCPD/IQN/Thompson, le backtest `v76_backtest.py`) est à archiver, pas à supprimer immédiatement (au cas où on voudrait re-mesurer un baseline futur sur le même setup), mais **à déplacer hors du chemin actif** : `archive/v76_ultra/` avec README explicite.

---

## Que faut-il abandonner ?

| À abandonner | Pourquoi |
|---|---|
| `scripts/train/01b-expand-temporal.py` (déjà gelé) | Source du leakage — laisser le `sys.exit(2)`. |
| `scripts/ingest/expedia-icdm.ts` (déjà désactivé) | Hôtels injectés en table vols. |
| Re-routage de `scripts/ingest/bts-t100.ts` vers la table tarifs | Prix reconstruits par régression `50 + dist·0.12`. Garder uniquement comme feature route si nécessaire, jamais comme observation prix. |
| `scripts/cloud/v76_ultra/stacking/{xgb_meta,bma_aggregator,copula_ensemble}.py` | Split non-temporel, agrégation par route, copule jamais fittée. |
| `scripts/cloud/v76_ultra/policy/{bocpd_evt,iqn_policy,thompson_sampling}.py` | Apprenent sur du bruit i.i.d. |
| `scripts/cloud/v76_ultra/models/{patchtst,mlcaformer,mamba,garch_nn,kan,timegrad,ts2vec}_*.py` | Dégénèrent en régresseur moyenne-route sur les données actuelles. |
| `lib/agent/v7/*.ts` (réimpl V7 TS non-entraînée) | Activé seulement en `FLYEAS_ALGO_VERSION=v7`, jamais en défaut. Bug `rKey` connu (cf `docs/V7A_SCOPE.md`). À supprimer après 4 semaines de V7a stable. |

---

## Plan d'action immédiat (sans implémentation, recommandations)

Ces actions ne sont **pas** à exécuter dans cet audit (l'utilisateur a explicitement demandé de ne rien implémenter), mais constituent la suite logique du verdict :

1. **Maintenir** `FLYEAS_ALGO_VERSION=shadow` en prod : V1 décide, V7a est observé. C'est la position de défaut la plus sûre aujourd'hui.
2. **Archiver** `scripts/cloud/v76_ultra/` et `scripts/train/{02..12}-*.py` sous `archive/v76_ultra/` avec un README pointant vers `docs/audit/AUDIT_EXECUTIVE_SUMMARY.md` et le présent audit.
3. **Déplacer** `bma_weights.json`, `copula_weights.json` (présents en `git status` à la racine) sous `archive/v76_ultra/artifacts/` — ces JSON traînent à la racine du repo et risquent d'être recâblés par erreur.
4. **Continuer** le pivot V7a : terminer le shadow log analysis sur ≥ 2 semaines de données post-commit-4fcf82e, puis basculer `FLYEAS_ALGO_VERSION=v7a` quand `ensemble_ttd_switch` est validé en regret réel.
5. **Ne pas** rebrancher V7.6 ultra avant que les 6 conditions du §"Conditions dans lesquelles le verdict pourrait changer" soient satisfaites — et même alors, vérifier que ce n'est pas une réinvention de V7a.
6. **Documenter** dans le `README.md` racine : "le moteur de prod est V1 (`lib/agent/predictor.ts`). Le pivot vers `ensemble_ttd_switch` (V7a) est en cours. Les artefacts `scripts/cloud/v76_ultra/` sont archivés (cf `docs/audit/`)."

---

## Réponses explicites aux 14 questions du prompt

**1. V1 résout-il un problème plus honnête que V7.6 ultra ?**
**Oui.** V1 affiche son heuristique. V7.6 emballe une heuristique scoring derrière 11 modèles, ce qui obscurcit la simplicité réelle de la décision finale (`signals ≥ 3`).

**2. V7.6 ultra est-il plus sophistiqué mais moins crédible ?**
**Oui, sans ambiguïté.** Sophistication confirmée (11 L0 + 3 L1 + 5 L2). Crédibilité nulle pour trois raisons : (a) substrat de données invalide, (b) split non-temporel masqué dans `xgb_meta.py`, (c) métriques rapportées sans CI ni segmentation.

**3. Le fait que V7.6 ultra ait été entraîné lui donne-t-il réellement un avantage ?**
**Non.** Un modèle entraîné sur des données invalides apprend les invalidités, pas le signal métier. C'est un anti-avantage : il génère une fausse confiance.

**4. V1 est-il plus simple mais plus sûr ?**
**Oui.** Plus simple ET plus sûr. Pas de surface d'attaque scientifique (rien à apprendre = rien à mal apprendre), pas de surface d'attaque opérationnelle (pas de dépendance Modal/artefacts).

**5. Lequel est le plus robuste pour le produit actuel ?**
**V1, sans comparaison possible.** V7.6 n'est pas robuste pour le produit actuel parce qu'il n'est pas le produit actuel.

**6. Lequel est le moins trompeur scientifiquement ?**
**V1.** Aucune métrique n'est auto-rapportée. V7.6 publie un `capture_median 62.74 %` qui occulte 37 % de routes pires, sur un substrat synthétique.

**7. Lequel serait le moins dangereux comme moteur primaire ?**
**V1.** Conservateur en cold-start, fallback gracieux, gate `confidence ≥ 0.6` côté `propose/route.ts`. V7.6 n'a pas de gate cold-start cohérent.

**8. Lequel serait le meilleur fallback ?**
**V1.** Il est déjà fallback en mode shadow et v7a. V7.6 ultra n'est pas qualifié pour ce rôle (latence Modal, dépendances artefacts, pas de validation prod).

**9. Que faut-il garder de V1 ?**
Cf §"Que faut-il garder de V1 ?".

**10. Que faut-il garder de V7.6 ultra ?**
Cf §"Que faut-il garder de V7.6 ultra ?". Réponse courte : `01-split.py`, `conformal_os.py`, `_common.py`. Le reste est à archiver.

**11. Que faut-il probablement supprimer ou ne plus utiliser ?**
Cf §"Que faut-il abandonner ?".

**12. Si on devait choisir aujourd'hui entre les deux, lequel choisirais-tu ?**
**V1.** Sans hésitation. Pas par préférence pour la simplicité — par constat froid que V1 est branché, valable scientifiquement (par défaut puisqu'il n'apprend rien), et que V7.6 ultra est compromis à la racine.

**13. Avec quel niveau de confiance ?**
**0.95.** Le 5 % résiduel concerne un scénario où je manquerais une intégration cachée de V7.6 ultra. Vérification : `grep -r "v76\|bma_weights\|xgb_meta_oof" lib/ app/ vercel.json` retourne 0 résultat. Donc 0.95.

**14. Pourquoi ce choix est-il le plus honnête ?**
Parce que V1 ne ment pas sur ce qu'il fait, ne s'est pas trompé sur ses données, n'est pas mesuré sur des métriques biaisées, et continue de produire une décision en prod toutes les 15 minutes. **C'est le seul des deux qui peut être audité par un humain en moins d'une heure et défendu honnêtement à un investisseur.** V7.6 ultra ne passe aucun de ces tests.

---

## Position finale

> **V1 est le moteur. Il est médiocre, mais il est le moteur. V7.6 ultra n'est rien — pas un moteur primaire, pas un fallback, pas un benchmark valide. La sophistication ne sauve pas un système entraîné sur du bruit. La trajectoire correcte est : maintenir V1 comme défaut, accélérer le pivot V7a (`ensemble_ttd_switch` baseline composée + ML auxiliaire), archiver V7.6 ultra hors du chemin actif.**

Cette position est tenable scientifiquement, opérationnellement et produit. Elle est cohérente avec l'audit interne `docs/audit/AUDIT_EXECUTIVE_SUMMARY.md` (2026-04-23), avec le pivot `docs/V7A_SCOPE.md` (2026-04-24), et avec les commits récents (4fcf82e, eb75d19, ffa079a, 570eb48) qui consolident la couche shadow log V1/V7a.

Le moteur de Flyeas n'est pas le plus impressionnant possible. C'est le plus honnête possible aujourd'hui, et c'est précisément ce qu'il faut quand on parle d'auto-buy avec de l'argent réel.
