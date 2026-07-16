# AUDIT — Métriques, évaluation, leakage

## 1. Métriques actuellement calculées

### 1.1 Dans `v76_backtest.py`

| Métrique | Formule | Lieu | Interprétation | Critique |
|---|---|---|---|---|
| `v1_capture_median` | `median(floor_route / v1_price)` × 100 | L255 | % du prix-plancher capturé par V1 | `floor = min(p_test_route)` est l'oracle ex-post. OK comme upper bound. |
| `v76_capture_median` | idem pour V7.6 | L256 | idem | idem |
| `v76_beats_v1_pct` | `mean(v76_price ≤ v1_price) × 100` | L257 | % de routes où V7.6 ≤ V1 | **Masque 37 % de dégradation.** |
| `v1_cvar10_capture` | `mean(10 % pires captures V1)` | L260-261 | Tail risk V1 | OK |
| `v76_cvar10_capture` | idem V7.6 | idem | Tail risk V7.6 | OK |
| `delta_median` | `v76_cap_med - v1_cap_med` | L270 | Gain absolu | Sans significativité statistique |
| `conformal_c_alpha` | scalaire global | L271 | Largeur conformelle globale | 199.86 USD pour alpha=0.1, énorme |

### 1.2 Dans `12-fit-ensemble.py`

| Métrique | Formule | Critique |
|---|---|---|
| MAE | `mean(\|y - ŷ\|)` | Standard. Utile. |
| CVaR-MAE | `mean(r\|r ≥ Q_{1-α}(r))` avec `r = \|y - ŷ\|` | Bonne idée pour tail. |
| Pareto set sur (MAE, CVaR10, CVaR5) | Domination vectorielle | Ingénierie propre. |
| Bootstrap win ratio | `#{b: CVaR_cand(y_b, p_b) < CVaR_base} / 200` | Ignore autocorrélation temporelle. |

### 1.3 Dans `xgb_meta.py`

| Métrique | Formule | Critique |
|---|---|---|
| `val_mae` | `mean(\|ŷ - y\|)` sur 20 % split non-temporel | ⚠ split 80/20 sur ordre merge pandas — non temporel. |
| `feature_importance` | XGBoost importance | Utile mais montre quelles *colonnes-modèles* comptent, pas quelles *features de base*. |

### 1.4 Dans `iqn_policy.py`

| Métrique | Formule | Critique |
|---|---|---|
| `iqn_pinball` | `mean_τ max(τ(y-q), (τ-1)(y-q))` | Correct si y est bien `future_min - current`. |
| `cvar10` | `mean(Q(s, τ)\|τ ≤ 0.1)` approché par 50 samples | OK si fonction quantile apprise ; ici sur bruit, c'est trivial. |

---

## 2. Métriques manquantes (critique)

### 2.1 Manque prioritaire pour un moteur de décision

| Métrique manquante | Formule | Pourquoi critique |
|---|---|---|
| **Regret absolu en $** | `price_paid - floor_feasible` | C'est la métrique monétaire directe. Capture % cache la magnitude. |
| **Regret absolu p50, p90, p99** | quantiles empiriques | Essentiel pour auto-buy (queues). |
| **Regret relatif p90** | `(price_paid - floor)/floor` | Comparable entre routes. |
| **Economic gain vs buy-now** | `p_buy_now - price_paid` | Le vrai bénéfice utilisateur. |
| **Economic gain vs naïf à J-14** | idem avec baseline `p[ttd=14]` | Compare à la stratégie humaine courante. |
| **Safe-abstain rate** | `P(action = WAIT \| ttd > τ)` | Mesure la prudence. |
| **Auto-buy precision** | `#{p_paid ≤ q10_pred} / #{auto-buy}` | % d'auto-buy réellement bons. |
| **Auto-buy false-positive rate** | `#{p_paid ≥ 1.2·floor}/ #{auto-buy}` | Taux de regret catastrophique. |
| **Conformal empirical coverage** | `#{p_t ≥ L_α(x_t)} / n` | **Métrique cœur** du conformal, jamais calculée dans le summary. |
| **Conformal average interval width** | `mean(U_α - L_α)` | Mesure d'informativité. |
| **Brier score** sur P(price_drop) | `mean((p - y_binary)²)` | Si on binarise "price baissera dans X jours". |
| **Segment-level metrics** | mêmes métriques par bucket TTD / route-freq / volatilité | Sans segmentation, on ne sait pas où le modèle échoue. |
| **Confidence interval bootstrap** sur chaque métrique | resampling routes | Pour distinguer signal du bruit. |
| **Statistical test** V7.6 vs V1 | test de signe apparié / Wilcoxon | 62.9 % de "beats" n'est pas significatif sans test. |

### 2.2 Manque sur la calibration

- **Reliability diagram** par bucket de prediction : tracer (predicted vs observed) par décile.
- **Expected Calibration Error (ECE)** : `Σ_k |bucket_acc_k - bucket_conf_k|·|bucket|/n`.
- **Segmented ECE** : par TTD, par route frequency, par volatility band.
- **Coverage par segment** : α=0.1 doit donner ≥ 90 % de coverage par segment. À vérifier.

### 2.3 Manque sur la décision

- **Temps moyen avant achat** (TTD effectif).
- **Variance du TTD d'achat par route** — un système robuste achète à des TTD cohérents.
- **Taux d'overruling heuristique** (quand force-buy à ttd<14 prend le dessus).
- **Sensibilité à α** : comment la coverage/regret varie-t-elle si on passe α=0.05 vs 0.10 vs 0.20.

---

## 3. Définitions formelles à adopter

Pour alignement avec la théorie :

### 3.1 Forecasting

- MAE : `MAE = (1/n) Σ |y_i - ŷ_i|`
- RMSE : `RMSE = sqrt((1/n) Σ (y_i - ŷ_i)²)`
- Pinball loss (quantile τ) : `L_τ(y, ŷ) = max(τ·(y-ŷ), (τ-1)·(y-ŷ))`
- CRPS : `CRPS(F, y) = ∫ (F(z) - 1[y≤z])² dz`

### 3.2 Décision

- Regret : `R_i = p_paid_i - floor_i` où `floor_i = min_{t ∈ window_i} p_{i,t}`  
  (NB : la fenêtre doit être **avant deadline**, pas globale — à vérifier dans le code).
- Capture : `C_i = floor_i / p_paid_i ∈ (0,1]`
- CVaR-regret (α) : `CVaR_α(R) = E[R | R ≥ VaR_α(R)]`
- Expected gain : `G = E[p_buy_now - p_paid]`

### 3.3 Probabiliste

- Coverage empirique (α) : `Coverage = (1/n) Σ 1[L_α(x_i) ≤ y_i ≤ U_α(x_i)]`  
  Cible : `Coverage ≥ 1 - α` marginal + par segment.
- Interval Score : `IS_α(L, U, y) = (U-L) + (2/α)[(L-y)·1[y<L] + (y-U)·1[y>U]]`  
  Meilleur qu'une coverage seule.

---

## 4. Audit du backtest

### 4.1 Ce qui est correct

- Le split temporel à la source (`01-split.py`) est strict.
- Le floor `floor = min(p)` est calculé sur **la série test de la route**, donc ne leak pas.
- Le V1 baseline et V7.6 sont exécutés sur la même boucle avec la même contrainte de causalité (pas de peek forward dans la décision).

### 4.2 Ce qui ne va pas

| # | Problème | Impact |
|---|---|---|
| 1 | Le prix-plancher (`floor`) est l'oracle global de la série ; c'est la borne **théorique** d'un agent omniscient — le présenter comme « cible » gonfle artificiellement le capture %. | Haute |
| 2 | La fenêtre d'achat est **toute la série test par route** — dans la vraie vie, l'utilisateur a une deadline. Rien ne modélise la deadline réelle. | Haute |
| 3 | `opt_mask = p ≤ floor·1.05` est utilisé pour des stats "in_window" mais pas pour pénaliser le choix hors fenêtre. | Moyenne |
| 4 | Le per-route anchor vient de `xgb_meta_oof` qui a été produit sur **val** (split temporel). En backtest test, on utilise donc un anchor appris sur val. **OK formellement.** Mais si la distribution route entre val et test diffère (post-covid rebound, etc.), l'anchor peut être systématiquement biaisé. | Moyenne |
| 5 | Le conformal `c_α = 199.86` est issu des résidus val — mêmes remarques. De plus, sa largeur suggère soit une vraie forte variance soit une sur-estimation. | Moyenne |
| 6 | Aucun test statistique entre V7.6 et V1 n'est calculé (pas de Wilcoxon apparié, pas de bootstrap IC sur delta). | Moyenne |
| 7 | Le signal Thompson apporte `wr × 2 = 0.594` à un score seuillé à 3 → **effet presque nul**, non pris en compte dans les ablations. | Basse |
| 8 | Pas de matrice de confusion BUY_NOW / WAIT / ALERT ventilée par segment. | Moyenne |

---

## 5. Audit du leakage — chasse exhaustive

### 5.1 Leakages identifiés

| # | Type | Fichier : ligne | Description | Sévérité |
|---|---|---|---|---|
| L1 | **Données synthétiques présentées comme réelles** | `01b-expand-temporal.py:146-152` | 50 obs/quarter tirées i.i.d. de N(µ,σ) clipped. Pas du leakage au sens strict, mais invalidation conceptuelle complète. | Bloquant |
| L2 | **Split non-temporel caché** | `xgb_meta.py:101` | `split = int(n*0.8)` sur rows issues d'un merge pandas sans sort ; ordre non déterministe temporel. | Haute |
| L3 | **Rolling features incluent le présent** | `02-features.py:45-56`, `_common.py:162-168` | `transform(rolling(X).mean)` inclut `price_t` dans le calcul de `rolling_mean_t`. `z_score_30d = (price_t - mean_t)/std_t` est trivialement 0 sur warmup et très corrélé à `price_t` partout. | Haute |
| L4 | **Double usage de val** | `policy/iqn_policy.py`, `conformal_os.py`, `thompson_sampling.py`, `stacking/*.py` | val sert à entraîner IQN, fit Thompson, calibrer conformal, fit BMA, fit Copula, isotonic calibration NNLS, early-stop XGB-meta — **simultanément**. | Haute |
| L5 | **Route popularity calculé globalement** | `02-features.py:104` | `groupby.size` calculé sur le split complet — mais comme chaque split est traité séparément, c'est la popularité *dans le split*. OK train, mais val/test voient des populations différentes. | Moyenne |
| L6 | **Floor global utilisé comme reference** | `v76_backtest.py:146` | `floor = p.min()` incluant tous les points test de la route. OK pour mesurer l'oracle, mais rappeler que c'est borne supérieure. | Basse (si bien documenté) |
| L7 | **OOF = hold-out, pas k-fold** | tous les modèles L0 | Les `*_oof_predictions.parquet` sont en fait des prédictions val, pas des OOF k-fold temporel. Le stacking L1 les combine comme s'ils l'étaient. | Haute |
| L8 | **BMA/Copula fit et score sur même rows** | `bma_aggregator.py`, `copula_ensemble.py` | σ_k, τ_k estimés et utilisés pour pondérer sur les mêmes lignes → surfit direct du BMA. | Haute |
| L9 | **Isotonic cal_frac=0.3 sur les premiers 30 %** | `12-fit-ensemble.py:47` | Si OOF est sorted par index pandas, les 30 % "calibration" sont arbitraires. | Moyenne |
| L10 | **Per-route anchor depuis OOF val utilisé dans test** | `v76_backtest.py:61-70` | Formellement OK mais introduit un biais de distribution inter-split. | Moyenne |

### 5.2 Ce que `audit-leakage.py` ne détecte pas

- L1 (données synthétiques)
- L2 (split non-temporel déguisé)
- L3 (rolling inclut présent) — son test heuristique L73-81 compare à la fenêtre *forward*, pas à l'inclusion du présent.
- L4 (double-usage val) — hors scope.
- L7, L8, L9, L10 — hors scope.

**L'audit en place donne une fausse assurance.** Il faut le renforcer.

### 5.3 Nouveaux contrôles à ajouter

```python
# Contrôle A — rolling shifté ?
for col in rolling_cols:
    shifted = df.groupby('route')['price_usd'].apply(
        lambda s: s.rolling(window).mean().shift(1)
    )
    if (df[col] - shifted).abs().mean() > 0.01:
        warn(f"{col} uses current value — shift(1) missing")

# Contrôle B — split temporel dans chaque fit ?
for path in ['xgb_meta.py', 'bma_aggregator.py', ...]:
    # AST parse : recherche 'n*0.8' précédé d'un sort by time
    ...

# Contrôle C — val utilisé plusieurs fois ?
usage_count = defaultdict(list)
# scan imports et lectures de parquet
if usage_count['val_features.parquet'] > 2:
    warn(...)

# Contrôle D — conformal hold-out disjoint ?
# (lire conformal_os.py, vérifier que le calibration block n'a jamais servi à fit xgb_meta)

# Contrôle E — floor ≤ p_t ∀ t ?
assert (df.groupby('route')['price_usd'].transform('min') <= df['price_usd']).all()
```

---

## 6. Audit OOF

### 6.1 État des prédictions OOF

- Les fichiers `*_oof_predictions.parquet` contiennent (`route`, `actual`, `prediction`) et parfois `q10/q50/q90`.
- Mais ils sont produits comme **prédictions val**, pas comme **OOF k-fold sur train**.
- Le stacking L1 les traite comme si c'étaient des OOF, ce qui biaise l'évaluation du meta-learner.

### 6.2 Ce qu'il faudrait

- **TimeSeriesSplit(n_splits=5)** sur le train pour chaque expert → vraies OOF sans leakage.
- Couverture complète du train (chaque row a exactement une prédiction OOF).
- Stacking L1 entraîné sur ces OOF train, évalué sur val, conformal calibré sur un hold-out disjoint de val.

---

## 7. Audit baselines

### 7.1 Baselines actuelles

- **V1** : heuristique z-score + percentile + trend + TTD (même structure que V7.6, plus simple).
- **Buy-now** : non présent comme ligne dans le summary. **Manque.**
- **Fixed-horizon** (buy à J-14) : non présent. **Manque.**
- **Rolling min** (buy si `p ≤ rolling_min(30d)`) : non présent. **Manque.**
- **Simple quantile threshold** (buy si `p ≤ Q_10(train_prices_route)`) : non présent. **Manque.**
- **Historical lowest** (buy si `p ≤ min(prior_same_quarter_same_route)`) : non présent. **Manque.**

### 7.2 Pourquoi c'est grave

Battre V1 de 20 pp capture_median est peu informatif tant qu'on ne sait pas si V7.6 bat aussi :
- buy-now (= ne rien faire),
- fixed-horizon (= stratégie utilisateur naïve),
- rolling-min (= baseline statistique triviale).

Un cas fréquent : V7.6 > V1 > buy-now — gain vrai. Un autre : V7.6 > V1 ≈ buy-now — V7.6 surperforme V1 mais rate un signal trivial.

---

## 8. Audit calibration

### 8.1 Ce qui est fait

- `12-fit-ensemble.py:38-55` : isotonic per-model, `cal_frac=0.3`.
- `policy/conformal_os.py` : `c_α = Quantile_{1-α}(residuals)` global + per-route si n≥30.

### 8.2 Ce qui manque

- **Per-segment coverage check** (TTD bucket, route frequency, volatility band).
- **Reliability diagram** plot.
- **ECE par segment**.
- **Test de calibration conditionnelle** (Mondrian conformal par segment).

### 8.3 Signal fort d'un problème

`c_α = 199.86` pour α=0.1 est énorme. Sur un prix moyen de 400-600 USD, c'est 30-50 % de l'ordre de grandeur. Soit :
- (a) la distribution des résidus a vraiment des queues → OK mais alors l'intervalle est peu informatif,
- (b) l'isotonic a lissé mais laissé passer une dispersion → sur-confiance cachée,
- (c) les résidus val sont contaminés par des outliers synthétiques → tout est faussé.

**Ne pas déployer d'auto-buy avant d'avoir une explication chiffrée par segment.**

---

## 9. Audit segmentation

### 9.1 Pas de segmentation dans le summary actuel

Le `v76_summary.json` est agrégé sur 11 297 routes.  
Il faut impérativement ventiler :

| Segment | Critère | Pourquoi |
|---|---|---|
| TTD ≤ 7 | `ttd_days ≤ 7` | Zone force-buy, domine la décision |
| 8 ≤ TTD ≤ 21 | | Zone à plus fort gain potentiel |
| 22 ≤ TTD ≤ 60 | | Zone classique booking |
| TTD > 60 | | Faible urgence |
| Route fréquente | n_obs_train ≥ 1000 | Forte confiance attendue |
| Route rare | n_obs_train < 50 | Fragile |
| Low volatility | std(p_train)/mean < 0.10 | Faible gain attendu |
| High volatility | std/mean > 0.30 | Fort gain *et* fort risque |
| International | distance > 500km | Structure différente |
| Intra-europe | set membership | Structure différente |

Chaque segment doit avoir son propre couple (capture_median, regret_p90, coverage, auto-buy_precision).

---

## 10. Synthèse

**Le backtest rapporte trois chiffres qui sont insuffisants pour un moteur de décision :**
- `capture_median 62.74 %`
- `beats_v1 62.9 %`
- `cvar10 capture`

**Il en manque au minimum dix :**
- regret monétaire (mean, p50, p90, p99)
- gain vs buy-now, vs fixed-horizon, vs rolling-min
- coverage conformelle marginale *et* conditionnelle
- interval width moyenne
- auto-buy precision / FPR
- segment-level breakdown TTD × freq × volatility
- significance test (Wilcoxon apparié, IC bootstrap)
- TTD moyen d'achat et sa variance
- calibration per segment (ECE)
- taux d'overruling heuristique (force-buy)

**Sans ces métriques, on optimise à l'aveugle et on ne peut pas valider un auto-buy.**
