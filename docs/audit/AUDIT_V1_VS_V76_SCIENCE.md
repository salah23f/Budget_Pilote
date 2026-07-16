# AUDIT V1 vs V7.6 ULTRA — VALIDITÉ SCIENTIFIQUE

## 1. Formulation du problème

### Ce que devrait résoudre Flyeas

Problème d'arrêt optimal séquentiel sous incertitude :

```
max_π  E[U(π)]    avec    U = Quality(offer) − λ₁·Price/Budget − λ₂·Regret(π) − λ₃·CVaR_α(Regret) + λ₄·PreferenceMatch
sous   Cost ≤ B_auto, Coverage_conformal(α) ≥ 1−α, filters respected
```

ou de façon équivalente : `min E[Regret] + β·CVaR_α(Regret)` avec `Regret = price_paid − floor_feasible`.

### Ce que résout V1

Une **règle de seuil pondérée** sur 4 features causales du présent :

```
composite = 0.40·z + 0.25·percentile + 0.20·trend + 0.15·ttd_pressure
action    = BUY si composite ≥ 0.40, WAIT si ≤ -0.30, sinon MONITOR
```

C'est un **classifieur ternaire heuristique**, pas une politique d'arrêt optimale. Il n'y a ni V(s), ni Bellman, ni comparaison `U_buy(s_t) vs E[U_buy(s_{t+1})]`. Mais la sortie est claire et alignée produit : recommander quand acheter.

### Ce que résout V7.6 ultra

Une **régression cross-sectional** (estimer le prix moyen par route à partir de 12 prédicteurs agrégés par médiane), suivie d'une **règle de score discret** sur 8 termes additifs :

```
signals  = 3·1{p ≤ q50_meta − c_α} + 1·1{(p − fair)/std < −1} + 2·1{is_extreme} + 2·1{TTD<7}
         + 2·1{anchor_disc ≥ 0.10} + 1·1{anchor_disc ≥ 0.20} + 1·1{IQN_CVaR > 0}
         + winrate·2·1{Thompson buy}
buy = (signals ≥ 3) ∧ (idx ≥ 3)
```

C'est un **moteur prédictif déguisé en moteur de décision**. Les 8 termes ne dérivent pas d'une fonction d'utilité ; les coefficients (3, 1, 2, 2, 2, 1, 1, 2) ne sont pas calibrés.

### Verdict §1 — formulation

**Égalité formelle, V1 plus honnête.** Aucun des deux ne résout l'arrêt optimal. V1 affiche son heuristique sans prétention. V7.6 emballe une heuristique scoring derrière 11 modèles entraînés, ce qui obscurcit la simplicité réelle de sa décision.

---

## 2. Données et targets

### V1

- **Source unique** : `price_history` table (Supabase) + `.data/price-history.json` en dev. Chaque sample est issu d'une recherche réelle (Amadeus / Sky-Scrapper / Kiwi) horodatée par le watcher.
- **Pas de target appris.** V1 calcule `mean(window)`, `stdev(window)`, `percentile(allSamples)`, `trend slope` à la volée. Pas de fit, pas de leakage possible — les statistiques sont définies sur des observations passées sans utiliser le futur.
- **Fenêtre TTD** : `getSamplesForWindow(daysUntilDeparture, ±14j)` isole les obs comparables (un vol à 30j ne se compare pas à un vol à 5j sur la même route).

### V7.6 ultra

- **Sources mélangées** :
  - **Kaggle dilwong/flightprices** (`scripts/ingest/kaggle.ts`) : ✅ horodatage `searchDate` réel, 500k lignes 2022-2023, **seul jeu propre**.
  - **BTS T-100** (`scripts/ingest/bts-t100.ts`) : ❌ trafic mensuel, prix **reconstruits** par régression `50 + dist·0.12`. Pas un prix observé.
  - **BTS DB1B** : trimestriel, agrégat — utilisable comme feature route, pas comme observation horodatée.
  - **Expedia ICDM 2013** : ❌ **hôtels**, injecté dans la table tarifs vols (`origin='EXP', destination=prop_country_id`). Contamination cross-produit confirmée par `docs/audit/AUDIT_RISK_REGISTER.md` R1 (et `expedia-icdm.ts` désactivé via throw).
  - **HuggingFace** : ❌ horodatage forçé à 2023.
  - **Wayback** : <50 obs, regex bruyant.

- **Expansion temporelle** : `01b-expand-temporal.py` synthétisait 50 obs/quarter par tirage `N(µ_q, σ_q)` clippé. Aujourd'hui gelé (`sys.exit(2)`), mais les artefacts entraînés en amont du gel restent.
- **Target appris** : `actual` = prix observé sur cette ligne après agrégation. Le meta-learner XGBoost (`xgb_meta.py:94`) apprend à prédire ce prix.
- **Split** : `01-split.py` fait un split temporel strict à la source (train < 2024-01-01, val < 2024-07-01, test ≥) — **propre**. Mais en aval, `xgb_meta.py:101` refait un split `n*0.8` sur l'ordre pandas après `merge` route — **non temporel**, leakage masqué.

### Verdict §2 — données

**V1 utilise des données causales horodatées par le watcher en temps réel.** V7.6 ultra utilise un mélange contaminé d'au moins quatre sources (T-100 reconstruit, Expedia hôtels, HuggingFace forçé, expansion synthétique). Le seul jeu propre (Kaggle dilwong) est aussi celui qu'utilise V7a après le pivot. **Avantage net V1.**

---

## 3. Évaluation / backtest

### V1

- Pas de backtest historique propre dans le repo `lib/agent/`. V1 est observé en shadow log temps réel via `agent_decisions`.
- **Référence externe** : `reports/v7a_backtest_local.json` mesure une **réimplémentation de V1** (`v1_heuristic`) sur dilwong test split. Résultat :

| Métrique | V1 global | V1 0-7 | V1 8-21 | V1 22-60 |
|---|---|---|---|---|
| capture_median | 0.814 | 0.815 | 0.752 | 0.855 |
| capture_mean | 0.756 | 0.753 | 0.711 | 0.780 |
| regret_abs_p50 | $33.0 | $58.7 | $59.4 | $21.0 |
| regret_abs_p90 | $230 | $309 | $303 | $171 |
| regret_rel_mean | 0.600 | 0.602 | 0.775 | 0.521 |

V1 bat `buy_now` (0.626 capture median) et `fixed_horizon_14` (0.652) mais perd contre `rolling_min_30` (0.868), `simple_quantile_10` (0.873), `ensemble_ttd_switch` (0.911).

### V7.6 ultra

- Backtest unique : `scripts/cloud/v76_ultra/policy/v76_backtest.py`.
- **Métriques rapportées** : `v76_capture_median`, `v76_beats_v1_pct`, `cvar10_capture`, `conformal_c_alpha`, `delta_median`. Pas de CI95, pas de regret monétaire, pas de coverage empirique segmenté.
- **Aucun fichier `v76_summary.json` n'existe en local** (`find -name "v76_summary*"` → 0). Les seuls chiffres connus sont ceux cités dans `docs/audit/AUDIT_EXECUTIVE_SUMMARY.md` (62.74 % capture median, 62.9 % beats V1) — issus d'une exécution antérieure non reproductible aujourd'hui.

#### Six défauts structurels du backtest V7.6

1. **Données contaminées** — cf §2, le pipeline en amont passe (passait) par `01b-expand-temporal.py`. Le backtest mesure l'ajustement à un bruit gaussien généré.
2. **Réimplémentation V1 biaisée** — `v76_backtest.py:158-172` ré-implémente V1 avec `idx ≥ 5` cold-start, alors que V7.6 utilise `idx ≥ 3`. Donne deux observations d'avance à V7.6.
3. **Floor oracle ex-post** — `floor = float(p.min())` sur la série test entière. Acceptable comme borne supérieure théorique, trompeur comme métrique de qualité car interprété en headline.
4. **Stacking par groupby route median** — `xgb_meta.py:80-82` fait `groupby(route).agg(median)` avant fit. Perte totale de la dimension temporelle. Le meta-learner devient une régression cross-sectional sur ~11k routes × 12 modèles.
5. **Split non-temporel masqué** — `xgb_meta.py:101` `split = int(n*0.8)` après merge sur route, donc split par ordre route alphabétique, pas par date. Leakage probable, conformal calibré sur val contaminé.
6. **val sur-utilisé** — val sert à : (a) early stop XGBoost, (b) fit IQN, (c) calibrer conformal, (d) σ BMA, (e) corrélations Copula, (f) NNLS isotonic, (g) Thompson posteriors. Pas de hold-out propre.

### Verdict §3 — évaluation

**V1 est honnêtement médiocre, V7.6 est métriquement trompeur.** Les chiffres V1 (`reports/v7a_backtest_local.json`) sont ré-mesurés sur dilwong avec CI95, segmentation TTD, regret p50/p90/p99. Les chiffres V7.6 sont sur synthétique, sans CI, sans segmentation, et le V7.6 perd quand même sur 37 % des routes.

---

## 4. Calibration / incertitude

### V1

- `confidence` ∈ [0, 1] : combinaison `0.5·sampleConfidence + 0.2·trendConfidence + 0.3·compositeCertainty`.
- **Pas de coverage garanti.** Pas d'intervalle conformel, pas de Brier score, pas de calibration plot.
- Cold-start force `confidence ≤ 0.35` — sain mais ad-hoc.

### V7.6 ultra

- **Conformal Optimal Stopping** (`policy/conformal_os.py`) : offset empirique `c_α = 199.86 USD` (alpha=0.10). La mécanique est correcte mais calibrée sur val contaminé (cf §3 défaut 6).
- **Isotonic calibration par modèle** avant stacking (`12-fit-ensemble.py`) : préserve le rang, corrige biais niveau. Pratique propre **en théorie**.
- **GPD per-route** (POT/EVT) : 99e percentile de l'excédence comme seuil "extreme low". Calculé sur bruit i.i.d. → équivaut à un percentile empirique.
- **IQN distributional RL** : apprend une distribution de retour. Sur données i.i.d. la distribution est dégénérée, l'incertitude apprise est l'écart-type du bruit.

### Verdict §4 — calibration

**V7.6 ultra a une mécanique d'incertitude techniquement plus riche, mais calibrée sur un substrat invalide.** V1 n'a pas de calibration formelle mais ne prétend pas en avoir.
**Aucun des deux n'est exploitable comme gate auto-buy "prudent" (`if conformal_width / price > 0.25 → abstain`).**

---

## 5. Logique de décision

| Critère | V1 | V7.6 ultra |
|---|---|---|
| Lisibilité de la règle | 4 termes pondérés explicites, 240 lignes lisibles | Composite 8 termes, coefficients non dérivés d'une utilité |
| Explicabilité | `reason` en langage naturel par cas (BUY/MONITOR/WAIT) | Aucune sortie explicable côté policy |
| Garde-fous | Cold-start TTD-only, MIN_USABLE_SAMPLES=5, MIN_CONFIDENT_SAMPLES=30 | force-buy `TTD<14 ∧ idx<3`, gate `idx≥3` |
| Stabilité | Déterministe, pas de stochasticité | Déterministe en backtest mais Thompson sampling stochastique en prod |
| Cohérence avec timing achat | TTD pondéré 15 % du composite | TTD `<7` injecte +2 dans signals (force quasi-buy) |
| Distinction offre/timing/sécurité | Une seule sortie ternaire | Une seule sortie ternaire |

### Verdict §5 — décision

**V1 est plus simple, plus testable, plus interprétable.** V7.6 a plus de garde-fous mécaniques mais ils tirent de paramètres non-validés.

---

## 6. Alerting

V1 n'a pas de notion d'alerte structurellement séparée du buy. L'alerte produit est dérivée de `action='BUY_NOW' && confidence ≥ 0.6` (gate predictor dans `propose/route.ts`).

V7.6 ultra n'a pas non plus de sortie ALERT séparée. **V7a (le successeur) sépare** `BUY_NOW / ALERT_STRONG / ALERT_SOFT / WAIT / ABSTAIN` et mesure precision/recall ALERT (`reports/v7a_backtest_local.json`).

### Verdict §6 — alerting

Aucun des deux n'est un bon moteur d'alerte. V7a est le bon endroit pour ça. V1 est légèrement préférable pour l'alerte minimale (signal binaire sain) ; V7.6 ultra n'a même pas d'output ALERT.

---

## 7. Synthèse scientifique

| Axe | V1 | V7.6 ultra | Gagnant |
|---|---|---|---|
| Formulation problème | Heuristique honnête | Heuristique cachée derrière ML | V1 |
| Données | Causales temps réel | Mélange contaminé, expansion synthétique gelée | **V1** |
| Target | Pas de target appris | `actual` price, biaisé par split non-temporel | V1 |
| Backtest crédibilité | Médiocre mais honnête (mesuré sur dilwong réel) | Métriquement trompeur (synthétique, CI absent, V1 réimplémenté biaisé) | **V1** |
| Calibration | Aucune formelle | Conformal/isotonic propre en théorie, calibrée sur invalid | Égalité (V7.6 mécaniquement supérieur, V1 pratiquement) |
| Logique décision | 4 règles lisibles | 8 termes additifs non-justifiés | V1 |
| Incertitude exploitable | Non | Non (en pratique) | Égalité |
| Alerte | Implicite via BUY+confidence | Aucune | V1 |

**Score : V1 6 — V7.6 ultra 0 — Égalité 2.**

---

## 8. Réponse au point sévère

> "Entraîné" ≠ "meilleur".

V7.6 ultra est entraîné. XGBoost converge, NNLS optimise, isotonic calibre. Mais ces optimisations s'exécutent sur :

1. Un substrat de données dont l'expansion temporelle a été reconnue invalide en interne (`01b-expand-temporal.py` gelé).
2. Un split non-temporel au niveau du meta-learner (`xgb_meta.py:101`).
3. Un val sur-utilisé pour 7 calibrations en série.
4. Une cible (`actual` price moyen route) qui est cross-sectional, pas séquentielle.

**Un modèle entraîné sur des données invalides n'est pas un modèle ; c'est un modèle de la procédure qui a généré les données invalides.** Dans ce cas précis, V7.6 a appris à reconnaître la moyenne et l'écart-type d'un bruit gaussien synthétisé par trimestre. C'est mathématiquement intéressant et opérationnellement inutile.

V1, qui n'apprend rien et applique des seuils visibles, est strictement plus crédible : il n'a aucune occasion d'apprendre du bruit, parce qu'il n'apprend pas. C'est une force, pas une faiblesse.
