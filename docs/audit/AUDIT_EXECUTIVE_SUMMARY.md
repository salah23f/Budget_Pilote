# AUDIT EXECUTIVE SUMMARY — Flyeas V7.6 Ultra

Date : 2026-04-23  
Auditeur : principal research engineer / quant scientist (critique indépendant)  
Périmètre : `scripts/train/*`, `scripts/cloud/v76_ultra/*`, `scripts/cloud/v76_prod/*`, `scripts/ingest/*`, couche produit Next.js.

---

## Verdict global (tranché)

**Le moteur V7.6 n'est pas un moteur de décision fiable aujourd'hui. C'est un moteur de prédiction cross-sectional (prix moyen par route), sophistiqué en façade, qui optimise une quantité mal définie sur des données en majorité synthétiques.**

- Les chiffres « V7.6 capture median 62.74 %, beats V1 62.9 % » proviennent d'un backtest où le signal temporel intra-trimestre est pur bruit gaussien (voir §1). Ce n'est pas un gain ML réel, c'est un ajustement au modèle de génération synthétique.
- Le stack ML Python V7.6 sur Modal est **déconnecté du produit Next.js**. L'auto-buy en production tourne sur un prédicteur heuristique maison (`lib/agent/predictor.ts`), pas sur les artefacts V7.6. Les poids BMA/XGB/Copula ne sont lus par aucun fichier TS.
- L'architecture Python est surdimensionnée pour le signal réel disponible : 14 experts (4 foundation + 7 custom deep + 3 ensembles + 4 policy) compressés en une médiane par route lors du stacking.
- **L'auto-buy illimité est aujourd'hui dangereux.** L'auto-buy plafonné (B_auto ≤ 500 USD, ≤ 1 achat / mission / jour, hors routes rares) pourrait être envisagé **dans 4-8 semaines** après refondation du pipeline et données réelles temporelles.

Niveau scientifique actuel : **faible à moyen selon les composants** (voir `AUDIT_MODELS_TABLE.md`). La sophistication de surface dépasse le signal exploitable.  
Niveau produit actuel : **moyen** côté backend (missions, Stripe, escrow, cron sweep fonctionnels), **nul** côté intégration ML-produit.  
Niveau de risque auto-buy : **élevé** tant que les points §1-§4 ne sont pas corrigés.

---

## Top 5 forces (à garder absolument)

1. **Split temporel strict à la source** (`01-split.py` lignes 325-329 : train < 2024-01-01, val < 2024-07-01, test ≥). Propre, pas de leakage inter-split.
2. **Conformal prediction correctement formé** (`policy/conformal_os.py`) : quantile empirique des résidus OOF avec offsets per-route ≥ 30 obs. La *mécanique* est saine, même si les données sous-jacentes sont compromises.
3. **Isotonic calibration par modèle avant stacking** (`12-fit-ensemble.py` ligne 47) : corrige proprement les biais niveau-prix, préserve le rang.
4. **Pareto filter + bootstrap stability guardrail** (`12-fit-ensemble.py` lignes 81-96, 58-78) : le NNLS ensemble n'accepte une blend non-standard que si elle bat le standard en CVaR sur ≥ 55 % des 200 resamples. Ingénierie défensive propre — rare dans un POC.
5. **Couche produit backend réelle** (`app/api/missions/*`, `app/api/agent/sweep`, `lib/agent/watcher.ts`) : missions persistées, Stripe hold, escrow on-chain, cron 15 min, gates `threshold` + `predictor` avec capture explicite. C'est un vrai squelette d'auto-buy, juste branché au mauvais prédicteur.

## Top 10 faiblesses (par ordre de gravité)

| # | Faiblesse | Gravité |
|---|---|---|
| 1 | **`01b-expand-temporal.py` synthétise 50 obs/quarter en tirant i.i.d. N(µ_q, σ_q) clippé.** La structure temporelle intra-trimestre est du bruit gaussien. Invalide toute métrique « séquentielle ». | Bloquant |
| 2 | **Le stack stacking (`xgb_meta`, `bma_aggregator`, `copula_ensemble`) agrège par `groupby(route).median()` avant fit.** On perd toute la dimension temporelle. Le « meta-learner » est en réalité une régression cross-sectional sur 11 297 routes × 12 modèles. | Bloquant |
| 3 | **V7.6 perd sur 37.10 % des routes contre V1.** Pour un auto-buy, ce taux de dégradation est rédhibitoire. | Bloquant pour auto-buy |
| 4 | **Le `xgb_meta.py` ligne 101 fait un split `0.8·n` sur l'ordre pandas après merge — pas temporel.** Leakage masqué, conformal downstream calibré sur une val contaminée. | Haute |
| 5 | **val utilisé simultanément pour : entraîner IQN, fit Thompson, calibrer conformal, estimer σ BMA, corrélations Copula, isotonic calibration NNLS, early-stopping XGB.** Aucun vrai hold-out. | Haute |
| 6 | **BTS T-100 injecte des prix reconstruits par régression `50 + dist·0.12`** dans `real_aggregated_fares` sans flag. Ce n'est pas un prix observé. Pollution directe. | Haute |
| 7 | **Expedia ICDM (hôtels Kaggle 2013) injecté avec `origin='EXP', destination=prop_country_id`** dans la table tarifs vols. Contamination cross-produit. | Haute |
| 8 | **IQN, BOCPD, GARCH-NN, Thompson apprennent sur du bruit i.i.d.** : les paramètres convergent vers les valeurs analytiques d'une normale, les « signaux » extraits sont des artefacts. | Haute |
| 9 | **`audit-leakage.py` est trop faible** : il rate rolling-features-inclusives-du-présent, stacking-median, split-pandas-non-temporel, double-usage de val. Fausse sécurité. | Moyenne |
| 10 | **Le produit utilise `lib/agent/predictor.ts` (heuristique TS) et `lib/agent/v7/*` (réimpl TS naïve non entraînée) — pas V7.6 Python.** Les 30+ scripts Modal ne servent à rien en production. | Stratégique |

---

## Top 5 priorités immédiates

1. **Geler `01b-expand-temporal.py`** et marquer tous les artefacts downstream comme non-fiables. Toute métrique publiée avant la refondation est à considérer comme provisoire.
2. **Reconstruire le dataset d'entraînement sur `Kaggle dilwong/flightprices`** uniquement (500k lignes, TTD réel, 2022-2023). C'est le seul jeu avec un horodatage d'observation crédible dans le repo.
3. **Remplacer le stacking par une unique régression quantile temporelle** (LightGBM q10/q50/q90) avec OOF k-fold temporel (TimeSeriesSplit), puis conformal calibration sur un vrai hold-out disjoint.
4. **Brancher le prédicteur V7.6 Python sur l'API produit** via un endpoint Modal `@modal.web_endpoint` lu par `lib/agent/watcher.ts`. Sinon tout le pipeline est de la R&D sans impact.
5. **Définir une fonction objectif produit explicite** et la métrique de décision correspondante. Aujourd'hui le backtest optimise « `signals ≥ 3` » — ce n'est pas l'objectif métier.

---

## Auto-buy : est-ce prêt ?

**Non.** Liste minimale avant déploiement d'un auto-buy même plafonné :

- [ ] Données temporelles réelles (TTD horodaté, pas agrégat trimestriel).
- [ ] Hold-out test intact (aucun composant ne l'a jamais vu).
- [ ] Calibration conformelle valide sur segment TTD (≤ 7j, 8–21j, 22–60j, > 60j).
- [ ] Regret moyen < 2 % du prix-plancher sur chaque segment.
- [ ] Regret p90 < 8 % du prix-plancher.
- [ ] Taux de faux-positif auto-buy (achat > 120 % du floor) < 1 %.
- [ ] Gate contextuel : pas d'auto-buy si `conformal_width / price > 0.25` ou si route inconnue du train.
- [ ] Shadow mode pendant ≥ 2 semaines : on affiche BUY_NOW mais on n'exécute pas, on mesure le regret a posteriori sur les prix suivants.

Aucun de ces critères n'est aujourd'hui satisfait.

---

## Réponses explicites aux 17 questions du prompt

**1. Quel problème mathématique le moteur résout-il *actuellement* ?**  
Une régression cross-sectional : estimer le prix moyen par route à partir de 12 prédicteurs indépendants agrégés par médiane. La couche policy transforme ensuite une déviation `(anchor − p) / anchor` en un score discret, et achète si ce score dépasse 3.

**2. Quel *devrait* être le problème ?**  
Un problème d'arrêt optimal séquentiel sous incertitude :  
`max_π E[U(π)]` avec `U = Quality(offer) − λ₁·Price/Budget − λ₂·Regret(π) − λ₃·CVaR_α(Regret) + λ₄·PreferenceMatch`, sous contraintes `Cost ≤ B_auto`, `Coverage_conformal(α) ≥ 1−α`, `filters respected`. Alternativement : minimiser `E[Regret] + β·CVaR_α(Regret)` avec Regret = price_paid − floor_feasible.

**3. Vrai moteur de décision ou moteur prédictif ?**  
Moteur prédictif déguisé en moteur de décision. La couche « décision » est une somme pondérée de règles seuils — pas une politique d'arrêt optimale. Il n'y a ni V(s), ni Bellman, ni comparaison U_buy(s_t) vs E[U_buy(s_{t+1})].

**4. Fonction objectif correcte ?**  
Non. La seule métrique optimisée est le capture median (floor/price_paid). Cette métrique ne pénalise ni le regret p90, ni la CVaR, ni le risque de mauvais auto-buy. Un agent qui attend toujours le dernier jour a un capture médiocre mais un regret prévisible ; un agent qui achète toujours tôt peut avoir un bon capture moyen mais un regret catastrophique quand il se trompe.

**5. Modèles centraux ?**  
Conformal prediction, LightGBM/XGBoost quantile tabulaire, isotonic calibration, TimeSeriesSplit OOF. Tout le reste est secondaire.

**6. Modèles du luxe technique ?**  
TimeGrad (diffusion), GARCH-NN, Mamba, MLCAFormer, KAN (fallback MLP), Thompson bandit, BOCPD, Copula ensemble (faux nom). Tous supposent une structure temporelle absente des données.

**7. Métriques pilotables ?**  
Non. Le summary (`v76_summary.json`) expose `capture_median`, `beats_v1_pct`, `cvar10_capture`. Il manque : regret monétaire absolu, regret p90, coverage conformelle effective, calibration par bucket TTD, taux de faux positifs auto-buy, economic gain vs buy-now, Brier pour P(price_drop), interval width.

**8. Backtest crédible ?**  
Non. Trois raisons :  
(a) données synthétiques (§1),  
(b) le floor par route est calculé sur la série test entière, ce qui est l'oracle ex-post — OK comme borne supérieure mais trompeur si interprété comme « performance du modèle »,  
(c) 37 % des routes perdent contre V1, ce que le headline n'explicite pas.

**9. Risques de leakage / sur-évaluation ?**  
Trois leakages majeurs :  
(a) `xgb_meta.py:101` split 80/20 sur ordre pandas après merge, pas temporel,  
(b) rolling features dans `02-features.py` et `_common.py` incluent la valeur courante,  
(c) val utilisé 7 fois de suite sans hold-out final,  
(d) per-route anchor en backtest est la médiane OOF train → OK formellement mais fragile si les routes de test ont une distribution différente (cf. segment rare).

**10. Système bien calibré ?**  
Probablement sur-confiant sur les routes fréquentes (isotonic + conformal sur val déjà multi-usages). Probablement sous-couvrant sur les routes rares (pas de per-route offset si n < 30). Le conformal `c_α = 199.86` est anormalement large → soit la distribution a des queues réelles que le conformal capture, soit l'isotonic laisse passer une dispersion synthétique. Il faudrait segmenter pour savoir.

**11. Bon partout ou bon en moyenne ?**  
En moyenne. 37 % des routes perdent contre V1. Aucune segmentation par TTD, volatilité, fréquence de route n'est faite dans le summary. Le chiffre capture_median dissimule la variance.

**12. Segments fragiles ?**  
Routes rares (< 30 obs), routes à forte volatilité (non identifiées car GARCH sur bruit), TTD courts (< 7j où le force-buy prend le dessus), classes premium ou LCC (pas de ventilation), dates proches jours fériés (non validé).

**13. Prêt pour auto-buy ?**  
Non. Cf. checklist ci-dessus.

**14. Si non, que manque-t-il ?**  
(a) Données temporelles réelles, (b) hold-out propre, (c) regret calibré, (d) fonction objectif explicite, (e) gate de confiance par route, (f) pont Python→produit, (g) shadow mode, (h) kill switch, (i) audit humain périodique des décisions.

**15. Noyau minimal à conserver ?**  
- Split temporel strict (01-split.py).  
- LightGBM quantile q10/q50/q90 (remplace 12 experts).  
- Isotonic calibration.  
- Conformal prediction avec hold-out séparé.  
- Règle de décision `buy si p_t ≤ q50_t(TTD) − c_α(route, TTD)`.  
- Couche produit déjà en place.

**16. Composants à contextualiser ?**  
Foundation models zero-shot (Chronos, TiRex, Moirai-2) — utiles *uniquement* en ajout quand les données réelles seront disponibles et uniquement sur routes à historique long. Thompson sampling — seulement si on passe à un vrai bandit contextuel avec log live.

**17. Meilleur usage des ~30 $ Modal ?**  
- ~5 $ : un baseline LightGBM quantile sur Kaggle dilwong + conformal hold-out (45 min A10G).  
- ~5 $ : ablation contre buy-now / fixed-horizon / rolling-min / per-TTD-quantile.  
- ~5 $ : segmentation full (TTD × route fréquence × volatilité) et calibration per-bucket.  
- ~3 $ : bootstrap IC 95 % sur chaque métrique.  
- ~12 $ : marge / itérations.  
Détaillé dans `AUDIT_ACTION_PLAN_30_DOLLARS.md`.

---

## Fichiers livrés

1. `AUDIT_EXECUTIVE_SUMMARY.md` (ce fichier)  
2. `AUDIT_ARCHITECTURE_CURRENT.md`  
3. `AUDIT_MODELS_TABLE.md`  
4. `AUDIT_METRICS_AND_EVAL.md`  
5. `AUDIT_RISK_REGISTER.md`  
6. `AUDIT_COMPUTE_PLAN.md`  
7. `AUDIT_TARGET_ARCHITECTURE.md`  
8. `AUDIT_ACTION_PLAN_30_DOLLARS.md`
