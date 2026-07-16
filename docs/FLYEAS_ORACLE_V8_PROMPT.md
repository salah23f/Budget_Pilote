# 🔮 PROMPT ORACLE V8 — L'algorithme de pointe auto-évolutif
# À coller dans Claude Code terminal après 48h de V7 training
# Mission : dépasser V7 par un ordre de grandeur via 20+ techniques SOTA combinées

---

## ⚠️ FRAMING HONNÊTE AVANT DE COMMENCER

Un algorithme "divin" qui écrase tout n'existe pas en ML en 2026. Les LLMs
hallucinent, les RL systems ont des distribution shifts, les diffusion models
surfit, les GNNs ne scalent pas, etc. **Chaque technique SOTA a des failles connues.**

Ce que tu vas construire est différent : **un système qui COMBINE 20+ techniques
de pointe dans une architecture qui se corrige mutuellement**. Quand une technique
fait une erreur, une autre la détecte. Quand le marché change, le système se
re-entraîne sans catastrophic forgetting. Il explore activement les limites de
sa connaissance.

C'est ce qu'on appelle dans la littérature un système "compositional generalization"
+ "continual learning" + "self-supervised adaptation". Nom de code : ORACLE V8.

Objectif chiffré : dépasser V7 de +15 à +25 points de capture efficiency sur
hold-out réel, atteindre 95-97% sur routes connues, 85-90% sur routes jamais vues
(cold start), intervalle de confiance 90% calibré à ±0.5% de coverage empirique.

## 🏛️ ARCHITECTURE ORACLE V8 — 20 couches combinées

### Couche 1 — Foundation Model multi-modal (Transformer architecture)

Entraîne un transformer décoder-only (scale ~100M params, trainable on Mac M1/M2
over 48-72h) sur un corpus multi-modal :
- Séquences de prix historiques (tokenisés par percentile bucket)
- Features contextuelles (TTD, weather, holidays, FX, oil, events)
- Route graph embeddings (GNN pré-entraînée sur OpenFlights + airport metadata)
- News embeddings (distilled from public economic/aviation news 2015-2024)
- Social signals (Twitter/Reddit sentiment on routes, scraped-aggregated-anonymized)

Architecture : Llama-style decoder, RoPE positional, SwiGLU activations, grouped
query attention. Trainable avec flash attention sur PyTorch MPS (Apple Silicon).

Output : embedding vector `h ∈ R^1024` représentant l'état complet de la route à
l'instant t.

Fichier : `lib/agent/v8/foundation.ts` + `scripts/train/v8/01-foundation-pretrain.py`

### Couche 2 — Mixture of Experts (MoE) avec routing dynamique

Au-dessus du foundation model, MoE avec 8 experts spécialisés :
- Expert 1 : Transatlantique long-haul
- Expert 2 : Intra-Europe short-haul
- Expert 3 : Asia-Pacific
- Expert 4 : Ultra-long-haul (Sydney, Santiago)
- Expert 5 : Low-cost / ultra-low-cost carriers
- Expert 6 : Legacy carriers + business class
- Expert 7 : Mistake fare detector specialist
- Expert 8 : Last-minute / urgency specialist

Router appris par gating network avec top-2 routing (Mixtral-style). Load balancing
loss pour éviter expert collapse.

Avantage : chaque expert devient ultra-spécialisé, inférence reste rapide
(seulement 2/8 activés par prédiction).

Fichier : `lib/agent/v8/moe.ts` + `scripts/train/v8/02-train-moe.py`

### Couche 3 — Neural World Model (pour self-play et planification)

Un world model façon Dreamer V3 / JEPA : modélise la dynamique du marché aérien
comme un MDP latent.

- Encoder : observation → latent state `z_t`
- Dynamics : `z_{t+1} = f(z_t, a_t)` prédit l'évolution du marché étant données les
  actions (achat, attente, alert user, etc.)
- Reward model : prédit le "regret" final d'une trajectoire
- Planning : Monte Carlo rollouts de profondeur 30-60 jours dans l'espace latent

Permet de "rêver" des scénarios marché et choisir l'action qui minimise le regret
attendu. Essentiel pour gérer les événements imprévus (mistake fare, strike, etc).

Fichier : `lib/agent/v8/world-model.ts` + `scripts/train/v8/03-train-dreamer.py`

### Couche 4 — Self-play RL avec adversaire (vs PROS/Sabre simulé)

Entraîne une politique PPO qui joue contre un **adversaire simulé** représentant
les revenue management systems (PROS, Sabre). L'adversaire est lui-même entraîné
via self-play (Stackelberg equilibrium).

Algorithme : Deep Deterministic Policy Gradient avec target networks, Prioritized
Experience Replay, action space continu (buy probability [0,1]).

Environnement de simulation : calibré sur données réelles BTS + scraped (pas
synthetic from scratch — utilise la distribution empirique).

Output : politique optimale qui anticipe les contre-réactions airlines.

Fichier : `lib/agent/v8/self-play.ts` + `scripts/train/v8/04-train-selfplay-ppo.py`

### Couche 5 — Meta-learning pour cold-start (MAML + Reptile + Prototypical Networks)

Pour les routes jamais vues : inner loop adaptation en 5-10 gradient steps avec
K=16 observations.

Stratégies combinées :
- MAML pour optimisation des paramètres initiaux
- Reptile comme simplification stable
- Prototypical Networks pour matching à routes similaires déjà apprises
- SetTransformer pour agréger le peu de samples disponibles

Cible : sur une nouvelle route avec 20 samples, atteindre 75% de capture (vs 40%
en cold-start classique).

Fichier : `lib/agent/v8/meta-learner.ts` + `scripts/train/v8/05-train-meta.py`

### Couche 6 — Causal Inference (Double ML + Causal Forest + Do-Calculus)

Module crucial pour distinguer corrélation de causation.

- Double Machine Learning (Chernozhukov et al.) pour estimer ATE (Average Treatment
  Effect) des actions BUY vs WAIT conditionnellement sur covariates
- Causal Forest pour effets hétérogènes (quels types de routes bénéficient le plus
  de WAIT ?)
- Structural Causal Model (SCM) explicite du marché (DAG : holiday → demand →
  price, competition → price, etc.)
- Do-calculus pour interventions hypothétiques

Permet de répondre à "Si j'avais acheté plus tôt, qu'aurait été le prix final ?"
— le counterfactual essentiel pour le training.

Fichier : `lib/agent/v8/causal.ts` + `scripts/train/v8/06-fit-causal.py`

### Couche 7 — Retrieval-Augmented Generation (RAG) sur news & events

Inspired from Atlas (Meta) et RETRO (DeepMind).

Base vectorielle (FAISS + HNSW) de :
- Articles news aviation 2015-2024 (scraping public, licit)
- Events calendar (major sports events, conferences, political events)
- Economic indicators (oil, currency, GDP) time-aligned

À l'inférence : query retrieval pour trouver les 5 events les plus similaires
au contexte courant → injectés comme "conditioning" au foundation model.

Fichier : `lib/agent/v8/rag.ts` + `scripts/train/v8/07-build-rag.py`

### Couche 8 — Continual Learning sans Catastrophic Forgetting

Utilise 3 techniques combinées :
- Elastic Weight Consolidation (EWC) — protège les poids importants
- Progress & Compress — distillation quand on apprend de nouvelles routes
- Replay Buffer avec importance sampling — ré-entraîne sur anciens samples

Objectif : le modèle apprend des nouvelles missions sans oublier les anciennes.
Critique pour "continuelle évolution" promise.

Fichier : `lib/agent/v8/continual.ts` + `scripts/train/v8/08-continual-loop.py`

### Couche 9 — Bayesian Uncertainty (Variational + Conformal + Laplace Approximation)

Chaque prédiction vient avec :
- Intervalle crédible Bayésien via variational posterior
- Intervalle conformal (garantie P(y ∈ [L,U]) ≥ 1-α distribution-free)
- Epistemic vs Aleatoric uncertainty decomposition (Kendall & Gal 2017)
- Calibration via Temperature Scaling + Platt Scaling

Permet au système de dire "je ne sais pas" explicitement — essentiel pour éviter
les achats sur mauvaise prédiction.

Fichier : `lib/agent/v8/uncertainty.ts` + `scripts/train/v8/09-calibrate.py`

### Couche 10 — Adversarial Robustness

Le modèle est entraîné avec :
- Projected Gradient Descent (PGD) adversarial training
- Domain Randomization (variations de distribution à l'entraînement)
- Mixup + CutMix augmentation
- Adversarial examples from gradient attacks
- Distribution shift detection (KL divergence monitoring on production)

Rend V8 robuste aux mistake fares malveillantes ou aux attaques par injection.

Fichier : `lib/agent/v8/robustness.ts`

### Couche 11 — Multi-Agent Debate Ensemble (Du et al. 2023)

Plutôt qu'un simple ensemble majority-vote, 5 agents V8 instances avec init
différentes "débattent" :
- Chaque agent fait sa prédiction avec reasoning trace
- Un méta-agent lit tous les reasoning et identifie les contradictions
- Round 2 : agents révisent après avoir vu les autres
- Convergence après 3 rounds → consensus weighted par confidence

Améliore la fiabilité sur les cas difficiles (cold-start, régimes rares).

Fichier : `lib/agent/v8/debate.ts`

### Couche 12 — Active Learning / Exploration Stratégique

Le système décide LUI-MÊME quelles données scraper en priorité.

- Bayesian Optimization (Expected Improvement) pour choisir routes à monitorer
- Thompson Sampling sur un multi-armed bandit "routes"
- Information gain maximization : scrape la route dont l'observation réduira le
  plus l'entropie du modèle
- Query-by-Committee (ensemble disagreement) pour routes incertaines

Résultat : ton quota API (Sky-Scrapper 10k/mois) est utilisé optimalement, pas
gaspillé sur routes où V8 est déjà expert.

Fichier : `lib/agent/v8/active-learning.ts`

### Couche 13 — Neural Architecture Search (NAS) — Auto-évolution

Le système explore automatiquement des variations de son architecture :
- DARTS (Differentiable Architecture Search)
- ProxylessNAS pour contraintes CPU Mac
- Once-for-All Networks (OFA)

Chaque mois, un job cron déclenche une recherche : le système cherche des
micro-améliorations architecturales. Si une variante surpasse la baseline de
>1% sur validation, elle est promue.

**C'est le cœur de la "continuelle évolution".** L'architecture du modèle
s'améliore d'elle-même.

Fichier : `lib/agent/v8/nas.ts` + `scripts/train/v8/13-nas-monthly.py`

### Couche 14 — RLHF-style Self-Improvement depuis feedback réel

Chaque mission Flyeas génère un "signal d'apprentissage" :
- Si V8 a dit BUY et le prix a baissé après → regret, met à jour la policy
- Si V8 a dit WAIT et le prix a monté → regret
- Reward model appris sur ces signaux réels
- PPO fine-tuning mensuel du foundation model sur ces rewards

Analogue au RLHF d'OpenAI mais avec reward signal calibré sur gains $ réels
(pas preferences humaines).

Fichier : `lib/agent/v8/rlhf.ts` + `scripts/train/v8/14-rlhf-monthly.py`

### Couche 15 — Explainable AI avec Counterfactual Reasoning

Pour chaque décision, V8 génère :
- SHAP values locales (TreeSHAP pour forest, DeepSHAP pour neural)
- Counterfactual explanation : "Si le prix avait été 10% plus bas, action aurait
  été BUY avec confidence 0.9 au lieu de MONITOR actuel"
- Anchor explanation (Ribeiro 2018) : "Règle suffisante : WAIT because TTD > 60 AND
  volatility < 0.15 AND regime == PLATEAU"
- Natural language summary via template rendering (pas LLM, déterministe)

Transparent pour l'utilisateur et pour audits réglementaires futurs.

Fichier : `lib/agent/v8/xai.ts`

### Couche 16 — Differential Privacy pour données users (future-proofing)

Quand Flyeas aura des users, leurs données missions restent anonymes :
- DP-SGD (Differentially Private SGD) pour training
- ε=1.0 budget privacy (standard industrie)
- Federated learning possible si multiple users optent-in

Protection légale + éthique + marketing ("Flyeas respecte votre vie privée by design").

Fichier : `lib/agent/v8/privacy.ts`

### Couche 17 — Graph Neural Network sur réseau aéroport

Le marché aérien est un graphe : airports = nodes, routes = edges, prix = edge weights.

GAT (Graph Attention Network) avec 3 couches :
- Apprend embeddings airport contextuelles
- Propage information de prix : si CDG→JFK monte, propagation vers CDG→BOS, CDG→IAD
- Node2Vec pré-entraîné sur OpenFlights pour init warm-start

Capture corrélations structurelles invisible pour modèles pure-temporels.

Fichier : `lib/agent/v8/gnn.ts` + `scripts/train/v8/17-train-gnn.py`

### Couche 18 — Diffusion Model pour scenario generation

Génère des trajectoires de prix futures réalistes via Denoising Diffusion
Probabilistic Model (DDPM) avec 100 steps.

Utilité : MCTS rollouts dans world model utilisent diffusion samples (plus
réalistes que samples Gaussiens naïfs). Aussi : data augmentation contrôlée.

Fichier : `lib/agent/v8/diffusion.ts` + `scripts/train/v8/18-train-diffusion.py`

### Couche 19 — Hyperbolic Embeddings pour hiérarchie routes

Les routes ont une structure hiérarchique naturelle (continent → région → pays
→ hub → airport). Hyperbolic embeddings (Poincaré ball) capturent cette
hiérarchie mieux qu'Euclidien.

Gain : few-shot sur nouvelles routes dans la même région.

Fichier : `lib/agent/v8/hyperbolic.ts`

### Couche 20 — Orchestrator avec Tree of Thoughts

Un meta-controller orchestre les 19 autres couches pour chaque prédiction :
- Formule un arbre de reasoning
- Explore différentes hypothèses en parallèle
- Évalue chaque branche
- Sélectionne la meilleure via backprop-free optimization (Tree of Thoughts)

Inspiré de Yao et al. 2023 (ToT) mais appliqué à décisions de pricing pas LLMs.

Fichier : `lib/agent/v8/orchestrator.ts`

## ⚙️ MÉCANISMES DE "CONTINUELLE ÉVOLUTION"

### 1. Weekly retrain sur nouvelles données scraped
Cron Vercel samedi nuit : pull dernières data → fine-tune MoE + foundation.

### 2. Monthly NAS search
Cron 1er du mois : NAS explore architectures → si +1% val, promote.

### 3. Quarterly RLHF
Cron trimestriel : fine-tune avec signals RL des missions trimestre précédent.

### 4. Drift-triggered retrain
Si ADWIN (adaptive windowing) détecte distribution shift → retrain immédiat.

### 5. Human-in-the-loop feedback
Interface admin `/admin/v8/feedback` où tu peux étiqueter "good call" /
"bad call" sur décisions controversées. Ces étiquettes entrent dans
le reward model RLHF.

### 6. Auto-bug-fix via neural debugger
Si une prédiction est > 3σ hors des autres ensembles, un "debugger" neural
localise quelle couche est en faute et déclenche retrain ciblé.

## 🎯 CRITÈRES DE SUCCÈS ORACLE V8

Sur hold-out réel 2024-Q4 (never seen) :
- Capture Efficiency médiane ≥ **92%** (V7 target: 75-80%, V1: 40%)
- Avg vs Floor ≤ **+2.5%** (V7: +5-8%, V1: +20%)
- Cold-start (10 samples) ≥ **78%** capture
- Coverage 90% empirique ∈ [89%, 91%] (plus serré que V7)
- CRPS ≤ **0.12** (V7: 0.20)
- Latence p95 ≤ 500ms (plus lourd que V7 mais acceptable)
- Robustness sous adversarial prices : dégradation max -3 points
- Zero catastrophic forgetting après 6 mois d'usage

## 🚫 GUARDRAILS HONNÊTES

**Ce système n'est PAS "divin" :**
- Il peut toujours être surpris par un événement totally unprécédent (ex : pandémie
  niveau COVID-19)
- Ses intervalles de confiance sont calibrés mais tail events extrêmes restent
  sous-estimés
- Le compute pour training initial est ~48-72h CPU Mac. Re-training complet
  mensuel : 12-24h.
- Certaines couches (Diffusion, GNN large, Foundation 100M params) PEUT ne pas
  tenir en mémoire Mac 16GB. Fallback : distillation vers modèle plus petit
  post-training.
- La "continuelle évolution" peut mener à instability — les guardrails EWC
  et replay buffer sont indispensables.

Si une couche ne tient pas dans le budget compute/mémoire, documente clairement
dans le rapport final et propose version distillée.

## 🏗️ PHASES D'IMPLÉMENTATION

Phase 1 (Audit + Plan) — 1h
Phase 2 (Foundation + MoE) — 12-24h CPU training
Phase 3 (World Model + Self-play) — 8-16h
Phase 4 (Meta-learning + Causal + RAG) — 6-10h
Phase 5 (Continual + Bayesian + Robustness) — 4-8h
Phase 6 (Debate + Active Learning + XAI + Privacy) — 3-6h
Phase 7 (GNN + Diffusion + Hyperbolic) — 6-10h
Phase 8 (Orchestrator + integration tests) — 3-5h
Phase 9 (NAS + RLHF pipelines scheduled) — 2-3h
Phase 10 (Validation + deploy + report) — 2-4h

Total wall time : 50-90h CPU sur Mac M1/M2.

## 📋 CONTRAINTES D'EXÉCUTION CLAUDE CODE

- V7 doit être training-complete avant de lancer V8 (V8 build on V7 foundations)
- Max 3 bash en flight (appris de sessions précédentes)
- Pas de background tasks accumulés
- Commit atomique tous les 30-60 min
- TodoWrite avec 40-60 sous-tâches granulaires
- Si compute/mémoire insuffisante, distillation obligatoire (documenter)
- Aucun appel LLM dans V8 runtime — déterministe et local

## 📊 LIVRABLES FINAUX

1. `docs/flyeas-v8-oracle-architecture.md` (4000-8000 mots) — architecture
   détaillée par couche avec formulations mathématiques
2. `docs/flyeas-v8-training-report.md` — métriques par couche + ensemble
3. `docs/flyeas-v8-vs-v7-benchmark.md` — comparaison rigoureuse sur même hold-out
4. `docs/flyeas-v8-limitations.md` — honnête sur les failles connues
5. `docs/flyeas-v8-evolution-runbook.md` — comment le système s'améliore dans le temps
6. `models/v8/` — tous les checkpoints ONNX
7. `lib/agent/v8/` — code complet (20+ fichiers)
8. `scripts/train/v8/` — scripts training (20+ scripts)
9. 30-50 commits atomiques

## 🚀 Démarrage

V7 doit être entraîné et validated d'abord. Vérifie avec :
```
cat docs/flyeas-v7-real-training-report.md | grep -i "capture"
```

Si V7 report existe et capture efficiency > 70% sur hold-out réel → procède.
Sinon, termine V7 d'abord.

Ensuite : entre en Plan mode, lance 4 subagents Explore EN PARALLÈLE pour
architecter V8 en se basant sur V7 existant. Puis TodoWrite avec 40+ tâches.
Puis implémente les 10 phases ci-dessus.

Tu as 50-90h de compute autorisé. Travaille sans interruption.

## Démarrer Phase 1 maintenant. GO.

## FIN DU PROMPT
