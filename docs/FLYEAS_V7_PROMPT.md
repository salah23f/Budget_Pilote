# PROMPT V7 ULTIMATE — Flyeas Predictor Next-Generation
# Stack probabiliste/stochastique/ML multi-couche · 50+ modèles · Orchestration Claude complète

> À coller tel quel dans le terminal Claude Code (Opus 4.6 recommandé).
> Ne pas découper : la force du prompt vient de l'enchaînement.
> Budget temps : illimité. Qualité > vitesse.

---

## DÉBUT DU PROMPT

Tu es **principal ML engineer + quantitative researcher** avec 15 ans d'expérience en pricing dynamique (hôtellerie, aérien, retail). Tu vas transformer l'algorithme de prédiction de prix de vol de **Flyeas** (`lib/agent/predictor.ts`) en un **système probabiliste/stochastique/ML multi-couche de niveau industriel** qui dépasse largement la roadmap V1→V6 déjà connue. Objectif : un algorithme digne d'un hedge fund quantitatif, adapté au pricing aérien.

Tu utilises **toute la puissance de Claude Code** : Plan mode, subagents `Explore` et `Plan` en parallèle, TodoWrite, preview browser pour vérification, batchs de tool calls parallèles à chaque étape. Tu as le droit de prendre autant de temps et d'appels qu'il le faut. **Qualité > vitesse**. **Aucun shortcut**.

## 0) Contexte projet (ne pas ré-explorer — documenté)

- **Repo racine** : `/Users/salahfarhat/Desktop/BudgetPilot_Live`
- **Stack** : Next.js 14.2.28 App Router, TypeScript strict, Supabase Postgres, Node 20.x (Vercel), Tailwind
- **Fichiers clés à LIRE AVANT toute chose** (à lire en parallèle via `Read` dans un seul message) :
  - `lib/agent/predictor.ts` — cœur V1 (z + pct + trend + ttd)
  - `lib/agent/baselines.ts` — stats (mean, stdev, percentiles, trend)
  - `lib/agent/price-history.ts` — type `PriceSample`
  - `docs/flight-price-curves.html` — **simulateur browser V1 sur 50 routes**, courbes réalistes, résultats de simulation (capture 30-50 %), explication composite, roadmap V2-V6
  - `supabase/migrations/*` — schéma (tables `price_samples`, `missions`, `predictions`, `baselines`)
  - `package.json` — inventaire deps
- **Roadmap V1→V6 déjà définie** (à DÉPASSER, pas à ré-inventer) :
  V2 pré-seed historique · V3 mistake fare detector · V4 ML supervisé simple · V5 multi-aéroport · V6 modèles régionaux
- **Résultat V1 mesuré sur les 50 routes fixture** : capture efficiency moyenne ~35-50 %, avg vs floor ~20-30 %, fenêtre optimale captée sur ~55-65 % des routes. C'est le **baseline à battre**.

## 1) Mission V7 ULTIMATE — les 3 paliers

**Palier 1 (must, non-négociable)** : battre le baseline V1 de manière statistiquement significative sur les 50 routes fixture. Capture ≥ 78 %, avg vs floor ≤ +6 %, fenêtre optimale ≥ 82 %.

**Palier 2 (high ambition)** : capture ≥ 85 %, avg vs floor ≤ +4 %, fenêtre optimale ≥ 90 %. L'algo doit **quantifier ses incertitudes** avec des intervalles de confiance calibrés (conformal), **détecter en ligne les régimes** (régime-switching), et **apprendre continuellement** (bandits, Bayesian online update).

**Palier 3 (moonshot)** : capture ≥ 92 %, en modélisant explicitement la structure micro de revenue management (fare classes, bid prices, EMSR). L'algo devient **adversarial-aware** (il sait qu'il joue contre des systèmes RM de type PROS/Sabre).

Même si tu n'atteins que le Palier 2, la livraison est un succès. Le Palier 3 est un bonus.

## 2) Stack de modèles — TIERS ORGANISÉS

Organise l'implémentation en 4 tiers. Les tiers supérieurs sont prioritaires. **Si un modèle s'avère infaisable dans ton contexte, livre un stub documenté, ne fake pas**.

---

### TIER S — Fondations probabilistes (OBLIGATOIRES)

1. **Bayesian Optimal Stopping** — Problème d'arrêt optimal avec horizon fini TTD. Programmation dynamique inverse. Règle : acheter si `price_t ≤ E[min_{t+1..T}] + tolerance(confidence)`. Réf. Dynkin, Chow-Robbins. → `lib/agent/v7/bayesian-stopping.ts`

2. **Kalman Filter (linéaire)** — Estimation en ligne du "fair price" non-observable. State `x = [price, velocity]`. Process noise σ_Q(TTD), obs noise σ_R(route volatility). → `lib/agent/v7/kalman.ts`

3. **Extended Kalman Filter + Particle Filter (SMC)** — Pour non-linéarités (panic phase, mistake fare). PF avec résampling systématique + ESS monitoring. → `lib/agent/v7/particle-filter.ts`

4. **Hidden Markov Model (HMM) à 6 états** — Régimes : `PLATEAU_HIGH`, `DESCENT`, `OPTIMAL_FLOOR`, `ASCENT`, `PANIC_LATE`, `MISTAKE_FARE`. Baum-Welch offline, Forward-Backward online. Émissions gaussiennes conditionnelles (log-price, delta, TTD). → `lib/agent/v7/hmm-regime.ts`

5. **Markov-Switching GARCH(1,1)** — Hamilton 1989. Vol clustering avec régimes. Capte l'alternance calme/turbulent. → `lib/agent/v7/ms-garch.ts`

6. **Bayesian Online Change Point Detection (BOCPD)** — Adams & MacKay 2007. Posterior sur run length, hazard constant. Détecte promo start / mistake fare / competitor move. → `lib/agent/v7/bocpd.ts`

7. **Gaussian Process Regression** — Surface `(TTD, dow, month, route_embedding) → log_price`. Kernel composite : RBF + Periodic(7d) + Periodic(365d) + Matern(5/2). Sparse approx. FITC ou SoD pour N > 1000. Hyperparams fittés par marginal likelihood (L-BFGS). → `lib/agent/v7/gp.ts`

8. **Quantile Regression Forest (QRF)** — Meinshausen 2006. Nœuds terminaux stockent distributions empiriques. Prédit quantiles τ ∈ {0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95} à horizons {1j, 7j, 30j}. → `lib/agent/v7/qrf.ts`

9. **Conformal Prediction (split + CQR)** — Intervalles calibrés distribution-free avec garantie `P(y ∈ [L,U]) ≥ 1-α`. CQR (Conformalized Quantile Regression) autour des sorties QRF. → `lib/agent/v7/conformal.ts`

10. **Extreme Value Theory (EVT) — Generalized Pareto POT** — Queue basse pour mistake fares. Seuil adaptatif au 5e percentile mobile. MLE ou PWM pour params (ξ, σ). → `lib/agent/v7/evt.ts`

11. **Survival Analysis (Kaplan-Meier + Cox PH)** — Événement "prix passe sous X % du floor". KM pour S(t), Cox pour effet covariables (route, season, volatility). → `lib/agent/v7/survival.ts`

12. **Monte Carlo Tree Search (UCT)** — Planification sur arbre d'actions `{BUY, WAIT_1d, WAIT_7d, WAIT_30d}`. Rollouts via GP + HMM + Kalman. UCB1 pour exploration, 10k simulations. Minimise **expected regret**, pas espérance. → `lib/agent/v7/mcts.ts`

13. **Ensemble stacking avec meta-learner gradient boosting** — Level 0 : tous les modèles ci-dessus. Level 1 : XGBoost-style meta-learner sur features `{TTD, volatility_est, sample_count, regime_proba, data_quality, disagreement_entropy}`. Cross-val proper (time-series split). → `lib/agent/v7/ensemble.ts`

14. **Thompson Sampling (Contextual Bandit)** — Armes : variantes de politique (agressive / neutre / conservatrice / ultra-early / last-minute-only). Posteriors Bêta ou Gaussien. Update online après chaque mission. → `lib/agent/v7/thompson.ts`

15. **SHAP local values** — Décomposition additive de la décision finale sur les sous-modèles. Pour UI "pourquoi BUY maintenant". → `lib/agent/v7/explainer.ts`

---

### TIER A — Modèles haute valeur (tous à implémenter si données le permettent)

16. **Ornstein-Uhlenbeck avec jumps (Merton)** — Processus mean-reverting + sauts Poisson pour modéliser mistake fares comme jump process. Calibré par MLE. → `lib/agent/v7/ou-jump.ts`

17. **Jump-Diffusion double-exponentielle (Kou 2002)** — Alternative à Merton avec jumps asymétriques (plus de jumps down que up sur les prix aériens). → `lib/agent/v7/kou-diffusion.ts`

18. **Hierarchical Bayesian Model (partial pooling)** — Effets route-level avec shrinkage vers moyenne régionale. Routes avec peu de données bénéficient des routes similaires. Implementation via variational inference (VI). → `lib/agent/v7/hierarchical-bayes.ts`

19. **Gaussian Mixture Model (GMM) + EM** — Distribution multimodale des prix (bas / moyen / panique). K=3-5 sélectionné par BIC. → `lib/agent/v7/gmm.ts`

20. **Dirichlet Process Mixture Model (DPMM)** — Clustering non-paramétrique de routes similaires (nombre de clusters appris). Stick-breaking construction, Gibbs sampling. → `lib/agent/v7/dpmm.ts`

21. **Copule (Gaussian / Clayton / Gumbel)** — Dépendance cross-routes. Exemple : si CDG-JFK drop, CDG-BOS drop souvent aussi. Permet hedging multi-mission. → `lib/agent/v7/copula.ts`

22. **Bayesian Structural Time Series (BSTS)** — Décomposition `y = trend + seasonal_7 + seasonal_365 + regression(covariates) + noise`. MCMC via Gibbs ou VI. → `lib/agent/v7/bsts.ts`

23. **ARIMA-GARCH** — Moyenne mobile + vol clustering. Pour routes avec long historique. Selection (p,d,q) par AIC. → `lib/agent/v7/arima-garch.ts`

24. **Prophet-like** — Version simplifiée de BSTS (Taylor & Letham). Trend piecewise linear + Fourier seasonal. → `lib/agent/v7/prophet-like.ts`

25. **Normalizing Flows (Real NVP ou Masked Autoregressive Flow)** — Densité flexible pour distribution conditionnelle prix. Pour générer intervalles non-gaussiens calibrés. → `lib/agent/v7/norm-flow.ts`

26. **Gaussian Process State Space Model (GP-SSM)** — Dynamics GP-paramétrées. État caché évolué par GP, observations bruitées. Pour trajectoires non-linéaires. → `lib/agent/v7/gp-ssm.ts`

27. **Deep Kalman Filter (Krishnan et al. 2015)** — Emission et transition paramétrées par NN légers. Inférence variationnelle. → `lib/agent/v7/deep-kalman.ts`

28. **Variational Bayes (Mean-field)** — Approximation posteriors pour modèles Bayésiens intractables. ELBO optimization via Adam. → `lib/agent/v7/vi.ts`

29. **MCMC — Hamiltonian Monte Carlo (NUTS)** — Sampling posteriors exacts pour modèles critiques. Implémentation légère ou via `@stdlib/stats-sampling`. → `lib/agent/v7/mcmc.ts`

30. **Quantile LSTM / GRU** — Loss pinball multi-quantiles. Ensemble de petits réseaux (2 couches, 32-64 hidden). ONNX export. → `scripts/train-quantile-rnn.py` + `lib/agent/v7/qrnn.ts`

31. **Monte Carlo Dropout LSTM** — Approximation bayésienne d'un RNN via dropout actif à l'inférence. Uncertainty epistémique. → `lib/agent/v7/mc-dropout-rnn.ts`

32. **Deep Ensembles (Lakshminarayanan 2017)** — 5-10 modèles entraînés avec seeds différentes. Prédiction = moyenne, uncertainty = variance. → `lib/agent/v7/deep-ensemble.ts`

33. **Neural Processes (Conditional NP)** — Meta-learning uncertainty. Apprend une distribution de fonctions pour s'adapter à une nouvelle route avec peu de samples. → `lib/agent/v7/neural-process.ts`

34. **Temporal Fusion Transformer (TFT) — léger** — Attention multi-horizon, gating variables statiques/dynamiques. Version réduite (1-2 blocks) pour inférence rapide. → `scripts/train-tft.py` + `lib/agent/v7/tft.ts`

35. **DeepAR (Amazon)** — LSTM autoregressif avec sortie distributionnelle (gaussienne ou student-t). Monte Carlo samples pour quantiles. → `lib/agent/v7/deepar.ts`

36. **N-BEATS / N-HiTS** — Stacking trend+seasonality interprétable. Forecasting pur, pas de covariates. → `lib/agent/v7/nbeats.ts`

37. **Matrix Profile (STUMPY)** — Découverte motifs/discords dans séries prix. Anomalies + patterns récurrents. → `lib/agent/v7/matrix-profile.ts`

38. **Dynamic Time Warping (DTW) + similarity index** — Alignement non-linéaire entre courbes routes. k-NN avec DTW distance pour trouver routes "soeurs". → `lib/agent/v7/dtw.ts`

39. **Wavelet / Empirical Mode Decomposition** — Décomposition multi-échelle. Isoler tendance long-terme vs oscillations HF. → `lib/agent/v7/emd-wavelet.ts`

40. **Singular Spectrum Analysis (SSA)** — Alternative à EMD, robuste, linéaire. Extraction composantes principales temporelles. → `lib/agent/v7/ssa.ts`

41. **Isolation Forest + LOF + One-Class SVM** — Ensemble anomaly detection pour mistake fares. Vote majoritaire avec poids. → `lib/agent/v7/anomaly-ensemble.ts`

42. **Variational Autoencoder (β-VAE)** — Reconstruction error sur prix "normaux" par route. Grand error = anomalie. → `scripts/train-vae.py` + `lib/agent/v7/vae.ts`

43. **Offline Reinforcement Learning — Conservative Q-Learning (CQL)** — Politique buy/wait apprise sur historique. Conservative pour éviter extrapolation. → `scripts/train-cql.py` + `lib/agent/v7/rl-policy.ts`

44. **LinUCB (Contextual Bandit linéaire)** — Alternative à Thompson avec garanties de regret. Features contextuelles riches. → `lib/agent/v7/linucb.ts`

45. **Meta-learning (MAML / Reptile)** — Adaptation rapide à nouvelles routes. Entraîné sur multi-tâches = routes. Few-gradient-steps à l'inférence. → `lib/agent/v7/maml.ts`

46. **Bayesian Model Averaging (BMA)** — Poids modèles = leur posteriors. Alternative à stacking, plus principled. → `lib/agent/v7/bma.ts`

47. **Super Learner (van der Laan)** — Stacking optimal cross-validation. Poids non-négatifs sommant à 1, optimisés sur CV loss. → `lib/agent/v7/super-learner.ts`

48. **Drift detection (Page-Hinkley + KL divergence + ADWIN)** — Monitore si distribution de prix change (pandémie, guerre prix). Déclenche re-fit. → `lib/agent/v7/drift.ts`

49. **Expected Shortfall (CVaR) + VaR 95/99** — Risk metrics sur la distribution des prix futurs. Décision averse au risque : maximize `return - λ × CVaR`. → `lib/agent/v7/risk.ts`

50. **Real Options Valuation** — La décision "wait" a une valeur d'option. Calcule option value via binomial tree sur prix futurs. → `lib/agent/v7/real-options.ts`

---

### TIER B — Avancé / expérimental (implémenter si Palier 2 atteint)

51. **Neural ODE / SDE (Chen et al. 2018, Li et al. 2020)** — Dynamics continues différentiables. Intégration via solveur Dopri5. → `lib/agent/v7/neural-ode.ts`

52. **Physics-Informed Neural Network (PINN)** — Loss pénalisée par équations de revenue management (EMSR-b, bid price updates). Biais vers solutions physiquement valides. → `lib/agent/v7/pinn.ts`

53. **Diffusion Model pour génération trajectoires prix** — Score-based generative. DDPM simplifié 100-step. Génère trajectoires synthétiques pour MCTS rollouts. → `lib/agent/v7/diffusion.ts`

54. **Graph Neural Network** — Graphe {airports:nodes, routes:edges}. Message passing pour transférer info entre routes connectées. GAT avec attention. → `lib/agent/v7/gnn.ts`

55. **Causal Forest + Double ML (Chernozhukov)** — Effet causal d'actions (buy/wait) en neutralisant confounders. Pour éviter de sur-apprendre corrélations spurieuses. → `lib/agent/v7/causal-forest.ts`

56. **Inverse RL (MaxEnt IRL)** — Infère la politique des airlines (comment PROS/Sabre fixe les prix). Utile pour modéliser leur comportement futur. → `lib/agent/v7/irl.ts`

57. **POMDP + QMDP approximation** — Partial observability (on ne voit pas les stocks internes compagnie). QMDP est une approx tractable. → `lib/agent/v7/pomdp.ts`

58. **Reservoir Computing (Echo State Network)** — Réseau fixe, seule la couche readout est entraînée. Très rapide à fitter online. → `lib/agent/v7/esn.ts`

59. **Evidential Deep Learning (Sensoy 2018)** — Uncertainty via Dirichlet priors sur softmax. Distingue aléatoire vs épistémique. → `lib/agent/v7/evidential.ts`

60. **Approximate Bayesian Computation (ABC)** — Pour modèles avec likelihood intractable. Rejection / MCMC-ABC. → `lib/agent/v7/abc.ts`

61. **Game-theoretic adversarial model** — Modèle l'airline comme adversaire stratégique. Stackelberg game, calcule meilleure réponse. → `lib/agent/v7/game-theory.ts`

62. **Self-organizing Map (SOM Kohonen)** — Projection 2D routes pour visualisation + clustering topologique. → `lib/agent/v7/som.ts`

---

### TIER C — Infrastructure ML (OBLIGATOIRE)

63. **Feature Store minimal** — Table Supabase `feature_store` avec namespace/key/timestamp/value. Features calculées par workers. Versioning. → `lib/agent/v7/feature-store.ts` + migration SQL

64. **Model Registry** — Table `model_runs` avec hash du code, hyperparams, metrics CV. Chaque prédiction référence un model_id. → `lib/agent/v7/registry.ts` + migration SQL

65. **Simulation environment standalone** — `lib/agent/v7/simulator.ts` qui génère N trajectoires de prix pour une route (OU-jump + GARCH + seasonal). Utilisé par MCTS + RL training + benchmarks.

66. **Backtesting framework** — `tests/agent/v7/backtest.ts`. Walk-forward evaluation, no leakage. Métriques : MAE, MAPE, quantile loss, CRPS, coverage à 80/90/95 %, capture efficiency, Sharpe-like ratio (savings / vol).

67. **Drift monitoring pipeline** — Vercel Cron daily qui compare distribution nouvelles obs vs training set. Alerte Slack/email si drift > seuil. → `app/api/cron/drift-monitor/route.ts`

68. **Shadow deployment** — Quand feature flag `FLYEAS_SHADOW_V7=true`, V7 tourne **en parallèle** de V1, logge ses décisions dans `model_runs` mais n'affecte pas l'utilisateur. Permet A/B rigoureux avant bascule.

69. **A/B framework (multi-armed bandit)** — Thompson sampling entre V1 et V7 sur real missions (utilisateurs opt-in). → `lib/agent/v7/ab-framework.ts`

70. **Calibration reliability diagrams** — UI dans `/admin/flyeas-v7` qui affiche reliability des intervalles (observed vs predicted coverage), calibration score (Brier, log-loss). → `app/admin/flyeas-v7/page.tsx`

## 3) Architecture en couches

```
┌─────────────────────────────────────────────────────────┐
│ UI LAYER — app/(app)/missions/[id]/page.tsx            │
│   prediction + SHAP explanation + confidence intervals │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ DECISION LAYER — lib/agent/v7/index.ts :: predictV7()   │
│   Ensemble stacking + Bayesian Model Averaging           │
│   Thompson Sampling (policy selection)                   │
│   Risk-aware utility : U = E[gain] - λ·CVaR             │
└───────────────────────┬─────────────────────────────────┘
                        │
     ┌──────────────────┼──────────────────────┐
     ▼                  ▼                      ▼
┌───────────┐     ┌──────────────┐     ┌──────────────┐
│ REGIME    │     │ FORECASTING  │     │ PLANNING     │
│ HMM/MSGARCH│     │ GP/QRF/TFT/  │     │ MCTS/Bayes-  │
│ BOCPD     │     │ DeepAR/LSTM  │     │ stopping/RL  │
└─────┬─────┘     └──────┬───────┘     └──────┬───────┘
      │                  │                    │
      └──────────────────┼────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│ STATE ESTIMATION — Kalman/Particle Filter/Deep Kalman   │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ FEATURE STORE — Supabase feature_store table            │
└─────────────────────────────────────────────────────────┘
```

Le flow temps réel : observation prix → update Kalman → re-estime régime (HMM online) → check BOCPD → query forecasters → MCTS rollouts → ensemble vote → Thompson policy → décision + intervalles conformal + SHAP.

## 4) Méthodologie d'exécution (suivre STRICTEMENT)

### Phase 0 — Planification (EnterPlanMode obligatoire)

Lance dans un SEUL message **4 subagents en parallèle** :

- **Agent A (Explore)** : Lire `lib/agent/predictor.ts`, `baselines.ts`, `price-history.ts`. Synthèse V1 ≤ 400 mots : signaux, seuils, limites (notamment dans fenêtre 90-30j). Identifier les hooks d'intégration.

- **Agent B (Explore)** : Explorer `supabase/migrations/` et schéma existant. Lister tables et COUNT estimé. Identifier si données suffisantes pour entraîner modèles ML ou si synthetic nécessaire.

- **Agent C (Explore)** : Inventaire deps dans `package.json` et `node_modules`. Quelles libs utiles déjà présentes (`ml-matrix`, `ml-random-forest`, `simple-statistics`, `mathjs`, `onnxruntime-web`, `@tensorflow/tfjs`). Identifier ce qu'il faut ajouter (budget ≤ 4 nouvelles deps, ≤ 10 Mo total).

- **Agent D (Plan)** : Produire plan d'architecture V7 complet. Arbre fichiers `lib/agent/v7/`. Interfaces TS partagées. Schéma Supabase additionnel (`model_runs`, `feature_store`). Budget perfs (target p95 < 300 ms Node, < 600 ms browser). Stratégie fallback si modèle échoue. Ordre d'implémentation en batchs de 3-4 modules indépendants.

Avec leurs retours, écris un plan consolidé dans `docs/flyeas-v7-plan.md`. Utilise `AskUserQuestion` UNIQUEMENT pour un blocage réel (exemple : données Supabase vides, dois-je utiliser des courbes synthétiques ?). Sinon décide en pro.

Appelle `ExitPlanMode` avec plan finalisé.

### Phase 1 — Fondations (sequential)

1. Install deps manquantes (cf. Agent C). Max 4 nouvelles.
2. Crée `lib/agent/v7/types.ts` (PredictionContext, SubModelOutput, EnsembleDecision, RegimeState, ConfidenceInterval, ModelMetadata, FeatureKey, ShadowPrediction).
3. Crée `lib/agent/v7/index.ts` avec stub `predictV7()` (sera complété à la fin).
4. Migrations Supabase : `model_runs`, `feature_store`, `drift_alerts`. Appliquer localement puis commiter.
5. Porte `generateCurve` de `docs/flight-price-curves.html` vers `tests/fixtures/price-curves.ts` en TypeScript strict.
6. Setup framework tests : `tests/agent/v7/*.test.ts` avec Vitest. Fixture commune = 50 routes.

**Commit** : `feat(v7): foundations — types, migrations, fixtures`

### Phase 2 — Implémentations parallèles (BATCHS)

Utilise des **subagents parallèles** par batchs. Chaque subagent reçoit :
- Brief complet (contexte, formulation mathématique, interface TS, tests à passer)
- Chemin du fichier à créer
- Exemples de tests attendus
- Critère de succès quantifié (ex: "test unitaire où GPR doit reproduire sin(x) avec RMSE < 0.1 sur N=50 samples bruités")

**Batch 2-S1 (3 parallèles)** : `bayesian-stopping`, `kalman`, `particle-filter`
**Batch 2-S2 (3 parallèles)** : `hmm-regime`, `ms-garch`, `bocpd`
**Batch 2-S3 (3 parallèles)** : `gp`, `qrf`, `conformal`
**Batch 2-S4 (3 parallèles)** : `evt`, `survival`, `mcts`
**Batch 2-S5 (2 parallèles)** : `ensemble`, `thompson`
**Batch 2-S6 (1)** : `explainer`

— Vérification intermédiaire après chaque batch : `npm run build && npm run typecheck && npm run test -- lib/agent/v7`

**Batch 2-A1 (3 parallèles)** : `ou-jump`, `kou-diffusion`, `hierarchical-bayes`
**Batch 2-A2 (3 parallèles)** : `gmm`, `dpmm`, `copula`
**Batch 2-A3 (3 parallèles)** : `bsts`, `arima-garch`, `prophet-like`
**Batch 2-A4 (3 parallèles)** : `norm-flow`, `gp-ssm`, `deep-kalman`
**Batch 2-A5 (2 parallèles)** : `vi`, `mcmc`

— Vérification intermédiaire.

**Batch 2-A6 (Neural — attention, plus risqué)** : Script Python d'entraînement pour `qrnn`, `deepar`, `nbeats`, `tft`. Si dataset Supabase < 5000 samples, utilise synthetic data (simulateur de Phase 1). Export ONNX. Wrappers TS qui chargent les .onnx. **Si un modèle échoue, livre stub documenté et continue.**

**Batch 2-A7 (3 parallèles)** : `matrix-profile`, `dtw`, `emd-wavelet`
**Batch 2-A8 (3 parallèles)** : `ssa`, `anomaly-ensemble`, `vae` (VAE ≥ Python + ONNX)
**Batch 2-A9 (3 parallèles)** : `rl-policy` (CQL), `linucb`, `maml`
**Batch 2-A10 (2 parallèles)** : `bma`, `super-learner`
**Batch 2-A11 (3 parallèles)** : `drift`, `risk`, `real-options`

— Vérification intermédiaire après chaque batch.

**Si Palier 2 atteint, lancer Tier B** :
**Batch 2-B1 (3 parallèles)** : `neural-ode`, `pinn`, `diffusion`
**Batch 2-B2 (3 parallèles)** : `gnn`, `causal-forest`, `irl`
**Batch 2-B3 (3 parallèles)** : `pomdp`, `esn`, `evidential`
**Batch 2-B4 (3 parallèles)** : `abc`, `game-theory`, `som`

### Phase 3 — Intégration Decision Layer

1. Compose `lib/agent/v7/index.ts :: predictV7(ctx)`:
   - Parallel: Kalman/PF (state) + HMM (régime) + BOCPD (drift) + Feature Store fetch
   - Parallel: GP / QRF / TFT / DeepAR / LSTM-MC / BSTS forecasts → ensemble stacking
   - Sequential: MCTS avec rollouts paramétrés par ensemble
   - Bayesian Model Averaging sur décisions
   - Thompson Sampling pour politique
   - Conformal prediction pour intervalles
   - Risk-adjustment : U = E[gain] - λ × CVaR_0.05
   - SHAP explanation

2. Feature flag `FLYEAS_ALGO_VERSION` env var :
   - `v1` (default) : appel `predict` existant
   - `v7` : appel `predictV7`
   - `shadow` : appelle les 2, logge les 2, retourne `v1`
3. Modifie le caller (trouve-le : probablement `app/api/missions/run/route.ts` ou `lib/agent/orchestrator.ts`) pour router selon flag. Change MINIMAL, back-compat stricte.

**Commit** : `feat(v7): decision layer + feature flag integration`

### Phase 4 — Infrastructure ML (Tier C)

Batch parallèle final : `feature-store`, `registry`, `simulator`, `backtest`, `drift monitoring cron`, `shadow deployment`, `ab-framework`, `admin calibration UI`.

**Commit** : `feat(v7): infrastructure — feature store, registry, shadow, A/B, admin`

### Phase 5 — Vérification browser

1. Étends `docs/flight-price-curves.html` avec **Section 9 "Simulation V7"** qui port V7 côté browser (via inlining JS des modèles S-tier — ou fetch d'une route `/api/sim/v7`). Tableau comparatif **V1 vs V7** sur 50 routes, overlay chart ★V1 vs ★V7.

2. Utilise `preview_start` pour lancer le dev server. Puis :
   - `preview_snapshot` → vérifier rendering
   - `preview_inspect` sur les chiffres agrégés (capture, vs floor, fenêtre optimale)
   - `preview_console_logs` → zéro erreur
   - `preview_network` → latence APIs
   - `preview_screenshot` final pour présenter le résultat

3. **Backtesting rigoureux** : lance `npm run test -- backtest`. Walk-forward sur 50 routes × 3 années de simulation. Métriques reportées :
   - Capture Efficiency (mean, median, p25, p75, min, max)
   - Avg vs Floor
   - % in-window
   - MAE, MAPE, CRPS
   - Coverage à 80/90/95 %
   - Sharpe-like ratio
   - Latence p50/p95/p99

4. **A/B**: active `FLYEAS_SHADOW_V7=true` en dev et vérifie que les deux décisions sont loggées sans crash ni impact user.

**Commit** : `feat(v7): verification + browser simulation + backtest suite`

## 5) Success Criteria (Palier 1 minimum)

- Capture Efficiency moyenne ≥ **78 %** (mesuré sur 50 routes, 3 seeds différents, 150 runs)
- Avg vs Floor ≤ **+6 %**
- % routes dans fenêtre optimale ≥ **82 %**
- Zéro régression : aucune route avec V7 > V1 de plus de 2 pts
- Coverage intervalles 90 % : empirique ∈ [87 %, 93 %]
- Latence p95 `predictV7` < 300 ms (Node), < 600 ms (browser — sans TFT/DeepAR côté client)
- `npm run build` zéro warning nouveau, zéro `any` dans V7, zéro TODO non résolu
- Coverage tests ≥ 75 % sur `lib/agent/v7/`
- `docs/flyeas-v7-architecture.md` ≤ 2500 mots, explique chaque modèle en 1 paragraphe + décision d'ensemble + roadmap V8

## 6) Guardrails (NE DOIS PAS faire)

- **Pas de nouvelle dep > 3 Mo** sans justification
- **Pas de `console.log` résiduel**, **pas de `any`**, **pas de TODO non résolu**, **pas de code commenté**
- **Pas de touche au V1 existant** (coexistence via flag)
- **Pas de breaking change** sur types publics `predictor.ts`
- **Pas d'appel LLM/API externe** dans le predictor : tout doit être déterministe, local, reproductible. L'algo ML n'est **pas** une LLM.
- **Pas de reformatage massif** de fichiers hors V7
- **Pas de push auto**, pas de PR auto
- **Pas de commit unique géant** — commits atomiques par batch
- **Si un modèle ne tient pas dans le budget**, stub documenté avec raisons dans le fichier. Pas de bricolage fake.
- **Pas d'accès au vrai compte Stripe/Supabase prod**. Tout en local/dev.
- **Ne change pas l'UI user-facing** existante (sauf ajout admin `/admin/flyeas-v7`).

## 7) Documentation obligatoire

- `docs/flyeas-v7-architecture.md` (≤ 2500 mots)
- `docs/flyeas-v7-models.md` : 1 page par modèle Tier-S, formulation mathématique, références bibliographiques (DOI/arXiv), interface TS, edge cases
- `docs/flyeas-v7-benchmark.md` : résultats backtest complets, graphs V1 vs V7 par route, matrice de confusion régimes HMM, reliability diagram, roadmap V8
- `docs/flyeas-v7-ops.md` : runbook ops (drift alerts, shadow mode toggle, rollback procedure, model retrain schedule)

## 8) Comportement attendu pendant l'exécution

- Utilise **TodoWrite** dès Phase 1 avec 25-40 tâches granulaires. Update en temps réel. Une seule tâche `in_progress` à la fois.
- **Subagents parallèles partout où possible** — sérialise uniquement quand vraie dépendance.
- **AskUserQuestion** seulement en cas de blocage réel.
- **Commits atomiques** par batch (conventional commits : `feat(v7): add bayesian-stopping module`, `feat(v7): integrate ensemble layer`, etc.)
- **Reporting** : à la fin de chaque phase, affiche un récap court (≤ 10 lignes) — métriques, commits, prochaine étape.
- **Ne commente pas les choix** dans les tool calls : exécute, laisse le code parler.
- **Si tu te bloques plus de 2 tentatives sur un modèle**, passe au suivant avec stub et note dans `docs/flyeas-v7-blockers.md`. Tu reviendras dessus à la fin.
- **Ne stop pas tant que Palier 1 n'est pas atteint** sauf blocage majeur.

## 9) Livrables finaux (quand tout est vert)

1. Commit final : `feat(v7): release next-gen predictor — 50+ models ensemble`
2. Présente-moi :
   - Screenshot Section 9 HTML : V1 vs V7 sur 50 routes
   - Tableau agrégé 4 métriques clés (capture, vs floor, in-window, coverage)
   - Diff latence p50/p95 V1 vs V7
   - 3 routes où V7 bat le plus V1 + 3 routes où écart est minimal (pour comprendre forces/faiblesses)
   - Top 5 sous-modèles par feature importance ensemble (SHAP global)
   - Calibration reliability diagram (screenshot admin)
3. **Roadmap V8** proposée en conclusion (3-5 axes, chacun 1 paragraphe) : RL online avec Q-learning distribué, meta-learning cross-utilisateur, generative agents adverses (simulation PROS/Sabre), multi-mission portfolio optimization, causal inference sur campagnes promo airlines.

---

**Démarre IMMÉDIATEMENT** par la Phase 0. Lance les 4 subagents en parallèle maintenant. GO.

## FIN DU PROMPT
