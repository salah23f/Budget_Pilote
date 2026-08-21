# AUDIT — Architecture cible (V7a / V7b / V7c)

Principe directeur : **prouver que les composants simples fonctionnent avant d'ajouter de la sophistication**. Aujourd'hui le pipeline fait l'inverse — il empile la sophistication avant d'avoir validé la base.

---

## 0. Fonction objectif retenue

Le moteur doit résoudre, pour chaque mission `m = (u, O, D, T, B, B_auto, F, P)` :

```
maximize_π  E[ G(π, m) ]

G(π, m) = Quality(offer_π)
        - λ₁·Price(offer_π) / B
        - λ₂·Regret(π, m)               # regret vs floor faisable
        - λ₃·CVaR_α(Regret)             # tail risk
        + λ₄·PreferenceMatch(offer_π, P)

sous contraintes :
  Price(offer_π) ≤ B_auto               # plafond auto-buy
  filters F respectés
  Coverage_conformal(α) ≥ 1 - α         # garantie statistique
```

Les λᵢ et α sont des hyper-paramètres business.  
Formulation équivalente minimisation : `E[Regret] + β·CVaR_α(Regret)` sous les mêmes contraintes.

**Objectif métier concret** : sur un dataset temporel réel, obtenir :
- Regret médian ≤ 2 % du floor.
- Regret p90 ≤ 8 % du floor.
- Coverage empirique conformelle ≥ 90 % par segment (TTD, freq, vol).
- Auto-buy false-positive rate < 1 % (paid > 120 % du floor observé).

---

## 1. V7a — noyau robuste prioritaire

### 1.1 Composants

```
 ┌──────────────────────────────────────────────────────────────┐
 │ 1. DONNÉES                                                   │
 │    - Kaggle dilwong/flightprices (500k, TTD réel 2022-2023)  │
 │    - Préserver searchDate (pas de new Date())                │
 │    - BTS DB1B : feature statique route_mean_usd par quarter  │
 │      (pas injecté comme TS)                                  │
 │    - Supprimer Expedia ICDM, T-100 prix, HF discovery,       │
 │      01b-expand-temporal                                     │
 └──────────────────────────────────────────────────────────────┘
                               │
                               v
 ┌──────────────────────────────────────────────────────────────┐
 │ 2. SPLIT + HOLD-OUT                                          │
 │    - train 70 %                                              │
 │    - val   15 % (post-train chronologique)                   │
 │    - cal   10 % (post-val, disjoint, conformal uniquement)   │
 │    - test   5 % (post-cal, FROZEN — ne sert qu'au rapport)   │
 └──────────────────────────────────────────────────────────────┘
                               │
                               v
 ┌──────────────────────────────────────────────────────────────┐
 │ 3. FEATURES CAUSALES                                         │
 │    - rolling_{7,14,30}d_{mean,std,min,max}  (shift(1))      │
 │    - z_score_30d (shift(1))                                  │
 │    - log_return, realized_vol_30d                            │
 │    - TTD buckets (ttd_log, ttd_sqrt, ttd_bucket)             │
 │    - Calendrier (dow, month, is_weekend, days_to_holiday)    │
 │    - Haversine distance                                      │
 │    - Hub/LCC/intra_europe flags                              │
 │    - Route popularity/competition (calculé sur train seul)   │
 │    - Feature statique route_mean_usd (from BTS DB1B Q-avg)   │
 └──────────────────────────────────────────────────────────────┘
                               │
                               v
 ┌──────────────────────────────────────────────────────────────┐
 │ 4. LIGHTGBM QUANTILE                                         │
 │    Trois modèles : q10, q50, q90                             │
 │    Loss : Pinball(τ ∈ {0.1, 0.5, 0.9})                       │
 │    TimeSeriesSplit(n_splits=5) OOF                           │
 │    Early-stopping sur val                                    │
 │    → remplace PatchTST, MLCAFormer, Mamba, KAN, TimeGrad,    │
 │      GARCH-NN, TS2Vec, QRF, TFT, DeepAR, LSTM, VAE, MAML, CQL│
 └──────────────────────────────────────────────────────────────┘
                               │
                               v
 ┌──────────────────────────────────────────────────────────────┐
 │ 5. ISOTONIC CALIBRATION per-quantile                         │
 │    Cal : y ~ I(q50), idem q10, q90                           │
 │    Fitted sur val, appliqué sur cal + test                   │
 └──────────────────────────────────────────────────────────────┘
                               │
                               v
 ┌──────────────────────────────────────────────────────────────┐
 │ 6. CONFORMAL PREDICTION (Mondrian par segment)               │
 │    Split cal uniquement :                                    │
 │      c_α = Quantile_{1-α}(y - q̂_50) par bucket              │
 │      bucket = (TTD_group, route_freq_class, vol_class)       │
 │    Offset global en fallback si bucket sparse                │
 │    → borne inférieure fiable L_α(x) = q̂_50(x) - c_α(bucket(x)│
 └──────────────────────────────────────────────────────────────┘
                               │
                               v
 ┌──────────────────────────────────────────────────────────────┐
 │ 7. OPTIMAL STOPPING BAYESIEN (simple mais fondé)             │
 │    À chaque t :                                              │
 │      V_buy_now  = p_t                                        │
 │      V_wait = E[min(p_{t+1..deadline}) | x_t]               │
 │              ≈ q̂_10(x_t) via monte-carlo sur residuals       │
 │    ACTION =                                                  │
 │      BUY_NOW   si V_buy_now ≤ V_wait - δ ET idx ≥ 3          │
 │      FORCE_BUY si ttd < 3                                    │
 │      ALERT     si V_buy_now entre V_wait - δ et V_wait       │
 │      WAIT      sinon                                         │
 │    δ = calibré par segment pour équilibrer regret vs gain    │
 └──────────────────────────────────────────────────────────────┘
                               │
                               v
 ┌──────────────────────────────────────────────────────────────┐
 │ 8. GATE AUTO-BUY                                             │
 │    AUTO_BUY = BUY_NOW                                        │
 │             AND p_t ≤ B_auto                                 │
 │             AND n_train_route ≥ 50                           │
 │             AND conformal_width(x_t)/p_t ≤ 0.25              │
 │             AND confidence(q̂_50, q̂_10) ≥ 0.8                 │
 │             AND anomaly_score(x_t) < 0.9                     │
 │             AND kill_switch_enabled                          │
 └──────────────────────────────────────────────────────────────┘
                               │
                               v
 ┌──────────────────────────────────────────────────────────────┐
 │ 9. LOGGING SHADOW MODE                                       │
 │    Persistance dans agent_decisions : state, action, prices  │
 │    futurs observés, regret réalisé.                          │
 │    Audit hebdomadaire humain.                                │
 └──────────────────────────────────────────────────────────────┘
```

### 1.2 Bénéfices V7a

- **Fondement théorique clair** : minimisation de regret avec garantie conformelle par segment.
- **Leakage contrôlé** : hold-out cal + test disjoints.
- **Compute** : 100 % local, <30 min/run.
- **Débogable** : 1 modèle cœur (LGBM) + 1 couche calibration + 1 couche décision = 3 briques testables.
- **Branchement produit** : appel depuis `lib/agent/watcher.ts` via endpoint Modal @web_endpoint ou inference locale Next.js API route.

### 1.3 Coûts V7a

- Pas de « wow factor » technique (pas de transformer, pas de diffusion, pas de RL).
- Nécessite de **geler** la majorité du code V7.6 actuel — politiquement difficile.
- Suppose un dataset réel d'au moins 100k observations avec TTD.

### 1.4 Risques V7a

- Si le signal temporel réel dans Kaggle dilwong est faible (ce qui est possible : fares US 2022-2023 pendant la reprise post-COVID), les métriques seront modestes. **C'est exactement ce qu'on veut savoir.**

---

## 2. V7b — ajouts conditionnels

**À introduire seulement après V7a validé** avec les critères ci-dessus atteints.

### 2.1 Foundation model zero-shot (1, pas 4)

- Choix : **Chronos-Bolt** par défaut (bon support, léger, quantile natif).  
- Alternative : TiRex si complémentaire mesuré.
- Intégration :
  - Inférence sur routes avec n_train_route ≥ 32 et historique ≥ 30 jours.
  - Blend NNLS entre LGBM q50 et foundation q50, poids > 0 seulement si bootstrap_win_ratio > 0.55.
  - Conformal re-fitté sur le blend.

### 2.2 Features macro / demande

- BTS T-2 (load factor mensuel par carrier) → feature `demand_pressure`.
- OpenSky flight tracking 7j → feature `flight_frequency`.
- FX rates (corriger le no-op `fx-rates.ts`) → feature `fx_usd_eur`, `fx_usd_gbp`.
- Calendrier événements (pas hardcoded comme actuellement) → feature `days_to_major_event`.

### 2.3 Embedding route via TS2Vec (usage non-TS)

- Entraîner contrastive sur *toutes* les séries de prix route (même courtes).
- Utiliser l'embedding comme feature statique additionnelle dans LGBM.
- ⚠ Ne jamais utiliser comme prédicteur temporel direct.

### 2.4 Conformal Mondrian enrichi

- Buckets plus fins : (TTD_group × route_freq × season × is_holiday_proximity).
- Garantir n ≥ 50 par bucket, sinon fallback parent.

### 2.5 Shadow mode → supervised action learning

- Log tous les (state, action_heuristique, regret_observé).
- Après 2-4 semaines, on a un buffer réel → peut servir à entraîner un léger classificateur BUY/WAIT **en plus** de la règle V7a (ensemble "rule + data" avec override uniquement quand les deux d'accord).

### 2.6 Bénéfices V7b

- Diversité d'expert pour routes à historique long (foundation complément naturel).
- Exploitation des signaux macro légitimes.
- Amorce d'un vrai pipeline data-driven pour la décision.

### 2.7 Coûts V7b

- Compute Modal ponctuel pour Chronos (~0.5-1 $/run).
- Gestion de versions : LGBM seul vs LGBM+Chronos → traquer lequel est déployé.

---

## 3. V7c — recherche / long terme

**À ne pas déployer avant d'avoir :**
- V7a + V7b stables depuis ≥ 8 semaines.
- ≥ 10k missions réelles loggées avec regret mesuré.
- Un jeu de données temporel horodaté propre d'au moins 2 ans.

### 3.1 HMM à régime réel

- Après avoir des séries temporelles denses par route, tester HMM Markov-switching 2 ou 3 régimes.
- Condition : `BIC(HMM) < BIC(plain LGBM)` significatif.

### 3.2 BOCPD online

- Détection de rupture en temps réel pour déclencher un flag `regime_shift`.
- Utilisé en gate auto-buy (abstain si rupture récente).

### 3.3 Offline RL (CQL) *seulement avec logs d'actions*

- Buffer (s, a, r, s') venant du shadow mode en production.
- Reward = -regret.
- CQL pour éviter overestimation OOD.

### 3.4 Contextual bandit en live

- Thompson sampling sur priors par `route_cluster × season × TTD_bucket`.
- Mise à jour quotidienne.
- Sert à choisir entre `aggressive / conservative / balanced` policy.

### 3.5 Bundle logic

- Multi-produit (vol + hôtel + voiture).  
- Problème d'optimisation combinatoire sous budget :  
  `max Σ Utility_i  s.t. Σ Cost_i ≤ B`  
- Linear programming ou DP si budget discret.

### 3.6 Exploration cross-produit

- Hôtels ne partagent pas la structure TTD vol. Modèle séparé.
- Locations voiture : quasi-linéaire avec durée, peu de gain ML.
- Bundles : arbitrage combiné (package deals).

---

## 4. Matrice de transitions

| Phase | Durée estimée | Déclencheur pour passer à la suivante |
|---|---|---|
| V7a | 2-3 semaines | LGBM bat buy-now / fixed-horizon / rolling-min (Wilcoxon p<0.05) et coverage ≥ 1-α par segment sur test hold-out |
| V7b | 4-6 semaines | Blend Foundation+LGBM apporte > 1 pp capture stat. sig. sur ≥ 2 segments ; pont Modal↔Next.js opérationnel |
| V7c | 3-6 mois après V7b | 10k missions loggées, ≥ 2 ans données temporelles, métriques V7b stables |

---

## 5. Ce qui ne revient pas

Les composants suivants sont **définitivement retirés du roadmap** à moins d'une nouvelle justification :

- `01b-expand-temporal.py` (la source du problème).
- XGB-meta / BMA / Copula en l'état (`groupby.median()` est structurellement cassé).
- Foundation models zéro-shot 4x (redondance injustifiée).
- GARCH-NN (pas de clustering vérifié).
- TimeGrad diffusion (coût disproportionné).
- IQN policy (redondant avec LGBM quantile).
- Thompson naïf (apport mesurable ≈ 0).
- KAN (fallback MLP — pas un KAN).
- MAML / CQL sans buffer d'actions réelles.

---

## 6. Ce que l'utilisateur voit (UI / API)

```
POST /api/missions/create
  { origin, destination, date_window, budget, budget_auto, filters, prefs }
  → missionId

GET /api/missions/{id}/recommendation
  → { offer, price, action, confidence, conformal_width,
      reason: ["q50≤anchor-c_alpha", "ttd<7", "good match"] }

POST /api/missions/{id}/propose   ← côté agent_sweep uniquement
  gates + capture Stripe + emit receipt

GET /api/agent/decision_log/{missionId}
  → audit history (state, action, price_observed_after, regret)
```

Le `reason` exposé est essentiel pour la confiance utilisateur (cf. R33 du registre de risques).

---

## 7. Synthèse

| Niveau | Philosophie | Compute | Prêt pour auto-buy |
|---|---|---|---|
| **V7a** | « Prouver la base » — LGBM quantile + conformal + règle simple | Local | Auto-buy plafonné OK après validation (shadow 2 semaines) |
| **V7b** | « Ajouter ce qui est mesuré utile » — Foundation blend + macro | Modal ponctuel | Auto-buy plafonné + élargi par segment |
| **V7c** | « Recherche » — HMM, BOCPD, RL, bundles | Mixte | Auto-buy contextuel |

**Règle d'or** : avant chaque ajout, vérifier sur test hold-out que le gain marginal est ≥ 2 × le coût en complexité + compute. Sinon, on garde la version précédente.
