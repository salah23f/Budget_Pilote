# AUDIT — Table des modèles & composants

Légende verdict : **garder** | **conditionnel** | **simplifier** | **supprimer**.

---

## 1. Experts L0 entraînés

| # | Composant | Famille théorique | Formule / principe | Rôle | Hypothèses | Bénéfice pratique (données actuelles) | Coût compute | Risque | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **PatchTST** (`models/patchtst_train.py`) | Transformer probabiliste patch-based | Pinball loss sur (q10,q50,q90) par patch de 16 jours | Forecasting quantile TS | Auto-corrélation temporelle exploitable | Nul — intra-quarter i.i.d., dégénère en régresseur moyenne-route | A100 2h ≈ 2 $ | Overfit noise, fausse confiance | **simplifier** (remplacer par LightGBM quantile) |
| 2 | **MLCAFormer** (`models/mlcaformer_train.py`) | Transformer multi-échelles causales | Self-attention à échelles 1/2/4 + MSE | Idem, multi-résolution | Idem + existence de patterns multi-échelles | Redondant avec PatchTST | A100 2h ≈ 2 $ | Décoratif | **supprimer** |
| 3 | **Mamba TimeMachine** (`models/mamba_timemachine.py`) | State-space linéaire (SSM) | `h_t = A h_{t-1} + B x_t`, `y_t = C h_t` | Longue portée | Séquences longues avec dépendances | Lisse du bruit gaussien | A100 2h + mamba-ssm | Fallback LSTM silencieux | **supprimer** |
| 4 | **GARCH-NN** (`models/garch_nn_train.py`) | Volatility clustering hybride | `σ²_t = ω + α·ε²_{t-1} + β·σ²_{t-1}` + MLP | Prédire volatilité | Volatility clustering | α,β→0 sur bruit i.i.d. → std route | A10G 90min ≈ 0.9 $ | Trompeur (vend clustering absent) | **supprimer** |
| 5 | **TS2Vec** (`models/ts2vec_pretrain.py`) | Contrastive representation learning | SimCLR-style sur fenêtres | Encodeur TS pour downstream | Invariances TS | Apprend signature route → utile comme embedding | A100 2h ≈ 2 $ | Overclaim temporal | **conditionnel** (garder comme embedding route, pas TS) |
| 6 | **KAN** (`models/kan_train.py`) | Kolmogorov-Arnold splines | Fonctions univariées apprenables | Alternative MLP | Spline-friendly target | Fallback MLP (pykan instable) | A10G 60min ≈ 0.6 $ | Slot vide | **supprimer** |
| 7 | **TimeGrad** (`models/timegrad_diffusion.py`) | DDPM conditionnel | `x_0 = f_θ(x_T, cond)` via 50 DDPM steps | Quantiles via sampling | Distribution conditionnelle riche | Apprend marginale N(mean,std) route | A100 90min + 80 samples | Très coûteux pour 0 gain | **supprimer** |
| 8 | **QRF / LightGBM quantile** (`05-fit-qrf.py`) | Quantile Regression Forest / GBM | `Q_τ(Y|X) = inf{y: P(Y≤y|X)≥τ}` | Forecast quantile tabulaire | Features causales | Baseline honnête, capture signal cross-sectional | A10G 30min | Limité (ignore ordre) | **garder** — *cœur V7a* |
| 9 | **GP** (`03-fit-gp.py`) | Gaussian Process | `f~GP(m,k)`, noyau RBF | Smooth per-route | Séries courtes par route | O(n³), gain limité | A10G 60min | Coût cubique | **conditionnel** (si ≥ 100 obs réelles/route) |
| 10 | **HMM** (`04-fit-hmm.py` / `-fast.py`) | Hidden Markov Model | `p(z_t\|z_{t-1}), p(y\|z_t)` gaussien | Régime latent | États discrets stables | Pas de régime vrai infra-quarter | CPU fast | Faux positifs | **supprimer** (sans données réelles) |
| 11 | **LSTM** (`06-train-lstm.py`) | RNN | classique | Baseline séquentielle | Dépendance temporelle | Régresseur moyenne | A10G 45min | Redondant | **simplifier** (fold dans LGBM quantile) |
| 12 | **TFT** (`07-train-tft[-fast].py`) | Temporal Fusion Transformer | Variable selection + LSTM + multi-head attn | Forecast multi-horizon | Covariables connues du futur | Gain marginal sur données actuelles | A100 2h | Très lourd | **supprimer** |
| 13 | **DeepAR** (`08-train-deepar[-fast].py`) | RNN autorégressif probabiliste | Student-t output | Distributional forecast | Structure temporelle | Sur-paramétré vs signal | A100 1h | Complexe | **supprimer** |
| 14 | **VAE** (`09-train-vae.py`) | Variational Autoencoder | `log p(x) ≥ E_q[log p(x\|z)] - KL` | Anomalie / embedding | Latent manifold | Usage produit flou | A10G 30min | Décoratif | **supprimer** |
| 15 | **MAML** (`10-train-maml.py`) | Meta-learning | `θ*_task = θ - α∇_θL_task` | Few-shot par route | Tâches proches | Sur-ingénierie | A10G 30min | Dépassé | **supprimer** |
| 16 | **CQL** (`11-train-cql.py`) | Offline Q-learning conservative | `Q(s,a) - α·OOD penalty` | Policy offline | Buffer d'actions | Aucun log d'actions réelles | A100 45min | RL prématuré | **supprimer** |

## 2. Experts L0 zero-shot (foundation models)

| # | Composant | Famille | Principe | Rôle | Bénéfice | Coût | Verdict |
|---|---|---|---|---|---|---|---|
| 17 | **Chronos-Bolt** (`chronos2_inference_v2.py`) | Foundation Amazon | Token-based TS LM | Quantile zero-shot | Prior externe robuste | A100 150min ≈ 2.5 $ | **conditionnel** (si ≥ 32 obs/route) |
| 18 | **TiRex** (`tirex_inference_v2.py`) | xLSTM NX-AI | 35M params, sLSTM+mLSTM | Quantile zero-shot | Diversité vs Chronos | A100 120min ≈ 2 $ | **conditionnel** |
| 19 | **Moirai-2** (`moirai2_inference_v2.py`) | Salesforce foundation | Transformer TS multi-fréq | Quantile zero-shot | Diversité | A100 120min ≈ 2 $ | **conditionnel** |
| 20 | **TimesFM** (`timesfm_inference_v2.py`) | Google foundation | Decoder-only TS | Quantile zero-shot | Diversité | A100 120min ≈ 2 $ | **conditionnel** (choisir 2 sur 4, pas 4) |

## 3. Stacking L1

| # | Composant | Formule | Rôle | Hypothèse critique violée | Verdict |
|---|---|---|---|---|---|
| 21 | **XGB-meta** (`stacking/xgb_meta.py`) | `ŷ = f_XGB(ŷ_1,...,ŷ_K)` avec K experts | Meta-learner non-linéaire | `groupby(route).median()` perd le temps + split 80/20 non-temporel (L101) | **supprimer** en l'état |
| 22 | **BMA aggregator** (`stacking/bma_aggregator.py`) | `w_k ∝ exp(-n/2·log σ_k² - Σres²/2σ_k²)` | Bayesian Model Averaging | Même agrégation par route, σ estimé et utilisé sur mêmes rows | **supprimer** |
| 23 | **Copula ensemble** (`stacking/copula_ensemble.py`) | Revendique Clayton, applique `ρ_rank → τ → θ` puis poids linéaires | Agrégation par dépendance de queue | Aucune copule fittée, `θ` jamais utilisé | **supprimer** (nom trompeur) |
| 24 | **NNLS ensemble** (`train/12-fit-ensemble.py`) | `argmin ‖y - X·w‖² s.t. w≥0, Σw=1` + isotonic + Pareto + bootstrap | Super Learner avec garde-fous | Isotonic sur 30% cal puis apply à 100% OK, mais val sert aussi à conformal downstream | **conditionnel** — *mécanique sauveable avec vraie OOF k-fold temporel* |

## 4. Couche policy / décision

| # | Composant | Formule | Rôle | Hypothèse | Verdict |
|---|---|---|---|---|---|
| 25 | **Conformal Optimal Stopping** (`policy/conformal_os.py`) | `c_α = Quantile_{1-α}(y - ŷ)` sur OOF val ; `BUY si p ≤ ŷ - c_α` | Borne inférieure calibrée | Échangeabilité résidus val↔test | **garder** (mécanique propre, à réalimenter avec hold-out intact) |
| 26 | **BOCPD + GPD** (`policy/bocpd_evt.py`) | `P(r_t=k\|y_{1:t})` récurrence + `genpareto.fit(u - p_low)` | Détection régime + queue basse | µ,σ figés sur série entière (L53) + données i.i.d. → rien à détecter | **supprimer** |
| 27 | **IQN policy** (`policy/iqn_policy.py`) | Pinball multi-τ + `CVaR_α = E[Q(s,τ)\|τ≤α]` | Distributional RL-like | État=fenêtre de 32 prix alors que i.i.d. | **supprimer** (remplacer par LGBM quantile) |
| 28 | **Thompson sampling** (`policy/thompson_sampling.py`) | Beta(α_k, β_k) sur 4 experts heuristiques, reward = `1[p≤1.05·min]` | Bandit Bernoulli | Dit "contextuel" (L1) mais ne l'est pas ; n_rounds=200 | **supprimer** |
| 29 | **v76_backtest compound score** (`policy/v76_backtest.py`) | `signals = w_c·1[p≤fair-c] + w_e·1[extreme] + w_a·1[discount≥10%] + ...` ; BUY si signals ≥ 3 | Règle de décision finale | Rule-based, pas d'optimal stopping | **simplifier** vers stopping Bayes explicite |

## 5. Ingestion

| # | Source | Type | Période | Timestamp réel ? | Volume | Qualité | Verdict |
|---|---|---|---|---|---|---|---|
| 30 | Kaggle dilwong/flightprices | CSV US TTD réel | 2022-2023 | ✅ (`searchDate`) mais écrasé par `new Date()` | 500k | Bon | **garder** — *seul jeu vraiment exploitable* |
| 31 | Kaggle autres (nikhilmittal, sp-flights...) | CSV snapshot | 2019 | ❌ | ~850k | Moyen | **conditionnel** |
| 32 | HuggingFace auto-discovery | first-rows API | 2023 forcé | ❌ | <1k | Médiocre | **supprimer** |
| 33 | BTS DB1B | Agrégat trimestriel US | 2023-2024 | ❌ (quarter) | 62M | Bon pour baseline niveau route, pas pour timing | **conditionnel** (utiliser comme feature statique route_mean_usd, pas comme TS) |
| 34 | BTS T-100 | Trafic par carrier/mois | idem | ❌ | millions | Pas de prix (reconstruit `50+dist·0.12`) | **supprimer** pour prix ; garder pour demande |
| 35 | BTS T-2 | Load factor mensuel | idem | ❌ | millions | Contextuel | **conditionnel** (feature demande) |
| 36 | FX rates (Frankfurter) | ECB daily | 2023+ | ✅ | small | Bon, no-op caché (L insert sans write) | **garder** (corriger le no-op) |
| 37 | OpenSky | Flight tracker API | 7j | ✅ | small | Contextuel | **conditionnel** (feature demande) |
| 38 | Wayback Kayak/Google | HTML regex | divers | ✅ | <50/pattern | Bruit regex "quality=50" | **supprimer** |
| 39 | Expedia ICDM | Hôtels Kaggle 2013 | 2013 | ❌ | millions | **HÔTELS, pas vols**, origin='EXP' | **supprimer immédiatement** (contamination) |

## 6. Features

| # | Feature | Formule | Causale ? | Utile | Verdict |
|---|---|---|---|---|---|
| 40 | `rolling_Xd_{mean,std,min,max}` | `transform(rolling(X).stat)` | ⚠ inclut valeur courante | Oui mais biaisé | **corriger** (shift(1)) |
| 41 | `z_score_30d` | `(price - roll_mean) / roll_std` | ⚠ idem | Pivot du V1 | **corriger** |
| 42 | `log_return`, `realized_vol_30d` | `diff(log price)`, `rolling(30).std()` | ✅ | Oui (si données réelles) | **garder** |
| 43 | TTD (`ttd_days`, `ttd_log`, `ttd_sqrt`, `ttd_bucket`) | `depart - fetched` | ✅ | ⚠ cassé — `depart_date` souvent vide pour BTS | **corriger en amont** |
| 44 | Calendar (`dow`, `month`, `is_weekend`, `days_to_holiday`) | dt accesseurs | ✅ | Oui | **garder** |
| 45 | `route_distance_km` (haversine) | formule sphère | ✅ | Oui | **garder** |
| 46 | `is_hub`, `is_lcc`, `is_intra_europe` | set membership | ✅ | Oui | **garder** |
| 47 | `route_popularity`, `route_competition` | `groupby(route).size/nunique` | ⚠ calculé global, potentiel leakage temporel | Oui | **corriger** (calculer sur train seul, mapper val/test) |
| 48 | `feat_price_vs_min_14`, `feat_price_vs_mean_14`, `feat_z_14` | ratios au rolling | ⚠ inclut courant | Oui | **corriger** (shift(1)) |

## 7. Couche produit (Next.js)

| # | Composant | Rôle | Connecté ML V7.6 ? | Verdict |
|---|---|---|---|---|
| 49 | `lib/agent/predictor.ts` | Prédicteur TS heuristique | ❌ | **garder** comme filet — remplacer par pont vers V7.6 |
| 50 | `lib/agent/v7/*` | Réimpl TS naïve Kalman/HMM/.../Thompson | ❌ | **supprimer** (pas entraîné, confusion de nom) |
| 51 | `lib/agent/watcher.ts` | Boucle de surveillance | ❌ | **garder** (orchestrateur) |
| 52 | `app/api/agent/sweep` | Cron endpoint | ❌ | **garder** |
| 53 | `app/api/missions/[id]/propose` | Gate threshold + predictor, capture Stripe + chain | ❌ | **garder** (solide) |
| 54 | `lib/scoring.ts` | Scoring offre (prix, carbone, etc.) | ❌ | **garder** (séparé du predictor, cohérent) |
| 55 | `contracts/BudgetPilotReceipt.sol` | Event on-chain | N/A | **garder** (bounty) |
| 56 | `contracts/MissionEscrow.sol` | Escrow paiement | N/A | **garder** (si déployé) |

---

## 8. Synthèse — matrice keep/drop

**Noyau à garder (V7a, ~3 composants ML) :**
- LightGBM quantile (remplace experts 1–16)
- Isotonic calibration + NNLS blend (simplifié, hold-out propre)
- Conformal prediction
- Features corrigées (causales, TTD, calendar, route_distance)

**Ajouts utiles (V7b, conditionnels) :**
- Foundation model zero-shot (Chronos **ou** TiRex, pas les 4)
- TS2Vec pour *embedding* route
- BTS DB1B comme feature statique `route_mean_usd` par quarter

**Recherche ultérieure (V7c) :**
- Vrai bandit contextuel une fois logs live
- Offline RL (CQL) une fois buffer d'actions
- HMM régime si données réelles multi-mois
- GP si données denses par route

**À supprimer immédiatement :**
- `01b-expand-temporal.py` (racine du problème)
- Expedia ICDM ingestion (contamination)
- BTS T-100 injection dans `real_aggregated_fares` (prix reconstruit)
- Stacking XGB/BMA/Copula en l'état
- IQN/BOCPD/GARCH-NN/Thompson/TimeGrad/KAN/MLCAFormer/Mamba/TFT/DeepAR/VAE/MAML/CQL trained on synthetic

Voir `AUDIT_TARGET_ARCHITECTURE.md` pour l'architecture cible détaillée et `AUDIT_ACTION_PLAN_30_DOLLARS.md` pour la feuille de route.
