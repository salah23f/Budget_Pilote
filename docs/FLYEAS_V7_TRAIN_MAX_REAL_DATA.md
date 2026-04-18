# PROMPT V7 — Entraînement MAXIMUM données réelles
# À coller dans Claude Code terminal

---

## DÉBUT DU PROMPT

Tu es principal ML engineer. Tu vas entraîner **TOUS les modèles V7 de Flyeas** (`lib/agent/v7/`) en utilisant **le volume MAXIMUM de données réelles historiques disponibles publiquement**. Zéro synthétique pour le training principal. Zéro validation sur synthetic.

Contexte :
- Repo : `/Users/salahfarhat/Desktop/BudgetPilot_Live`
- V7 algo : 13 modèles probabilistes/ML (Kalman, HMM, BayesStopping, BOCPD, EVT, Survival, GP, QRF, MCTS, Thompson, Conformal, SHAP Explainer, Simulator, + Ensemble stacking)
- Stack : Next.js 14, TypeScript, Supabase, Node 20, Python 3.11+ pour training
- Supabase migrations déjà appliquées (tables : `real_price_samples`, `real_aggregated_fares`, `ingestion_runs`, `real_features`, `model_runs`, `scraper_runs`, `drift_alerts`)
- RAPIDAPI_KEY configurée (Sky-Scrapper PRO payant + 5 APIs gratuites)
- Kaggle CLI configurée (`~/.kaggle/kaggle.json` existe)
- Scripts d'ingestion déjà créés : `scripts/ingest/{bts-db1b,bts-t100,expedia-icdm,kaggle,huggingface,quality-gate}.ts`
- Scripts de training partiels : `scripts/train/{01-split,02-features,06-train-lstm}.py` + `requirements.txt`

## 1) MISSION — Maximum data réelle, zéro synthétique dans training principal

### 1.1 Étendre l'ingestion à TOUTES les sources publiques réelles

Audite `scripts/ingest/*.ts` existants et **étends-les** pour ingérer le MAXIMUM possible de ces sources réelles (toutes gratuites) :

**SOURCE A — BTS DB1B (US DOT) — L'ORIGINAL GOLDMINE**
- Déjà prévu dans `bts-db1b.ts`
- Étends la période couverte : **2015 → 2024 (10 ans, 40 trimestres)** au lieu de 2020-2024
- Volume attendu : **~50M lignes** (~1M-2M par trimestre)
- URL : https://transtats.bts.gov/Tables.asp?DB_ID=125
- Fichiers : DB1BMarket (trimestriels)
- Mapping : Origin, Dest, MktFare, TkCarrier, Passengers, Year, Quarter
- Normalisation : USD uniformisé via `fx_rates_snapshot`, déduplication

**SOURCE B — BTS T-100 Market**
- Étends à 2015-2024 (120 mois)
- Volume : **~6M lignes** agrégées mensuelles par route/carrier
- Utilité : tendances saisonnières, carrier pricing power

**SOURCE C — BTS DB1B Coupon (plus granulaire que Market)**
- NOUVEAU ingester : `scripts/ingest/bts-db1b-coupon.ts`
- URL : https://transtats.bts.gov/Tables.asp?DB_ID=289
- Volume : **~100M lignes** (coupon = one leg of ticket)
- Utilité : TTD approximation via trip duration

**SOURCE D — DOT Air Carrier Summary**
- NOUVEAU : `scripts/ingest/bts-t2.ts`
- URL : https://transtats.bts.gov/Tables.asp?DB_ID=110 (T-2 Traffic Segment)
- Load factor + capacité par route/mois — excellentes features de contexte

**SOURCE E — Expedia ICDM 2013 Challenge**
- Déjà prévu dans `expedia-icdm.ts`
- Assure toi que les 10M lignes sont bien ingérées
- Mapping : `srch_booking_window` → TTD (en jours), `price_usd` → price_usd
- FEATURE CRITIQUE : ce dataset a TTD exact, crucial pour entraîner les modèles TTD-aware

**SOURCE F — Kaggle datasets (ÉTENDS)**
- Actuellement : 1 dataset Inde (~300k)
- Ajoute :
  - `kaggle datasets download -d priyanshu594/flights-data-cleaned` (US fares)
  - `kaggle datasets download -d iqra2021/flights-dataset`
  - `kaggle datasets download -d dilwong/flightprices` (~5M rows US 2022-2023 avec TTD)
  - `kaggle datasets download -d andrewmvd/sp-flights` (Brazil flights)
  - `kaggle datasets download -d tsiaras/american-airlines-delay-and-fare`
- Volume cumulé : **~10M lignes** avec diversité géographique

**SOURCE G — HuggingFace datasets** (via `@huggingface/hub` ou `datasets` Python)
- Recherche auto : `flight-prices`, `airfare`, `airline-data`
- Priorise ceux avec TTD explicite
- Volume variable, typiquement 100k-2M selon trouvés

**SOURCE H — OpenSky Network (free, unlimited)**
- NOUVEAU : `scripts/ingest/opensky.ts`
- URL : https://opensky-network.org/data
- NE CONTIENT PAS les prix mais : trajectoires, délais, fréquence, load par route
- Utilité : features contextuelles (route popularity, delay rate) pour le modèle

**SOURCE I — Archive.org Wayback (fare pages historiques)**
- Déjà prévu dans `wayback.ts` ou à créer
- Parse snapshots Kayak/Google Flights/Expedia 2015-2024
- Volume attendu : 50k-200k samples selon la robustesse du parser
- Quality score bas (70) car parsing imparfait

**SOURCE J — Scraper live (accumulation continue)**
- Déjà configuré (GitHub Actions cron 4h)
- Le fix actuel : Sky-Scrapper retourne 0 flights — FIX CE BUG aussi
  (endpoint incorrect, probablement besoin de preview `searchAirport` pour obtenir skyId)
- Une fois fixé, accumulera ~5k-20k samples/semaine

### 1.2 Contraintes d'ingestion

- **Stream processing** : jamais tout charger en RAM. Parse CSV/JSON par chunks de 10k rows, batch insert Supabase
- **Déduplication** : hash sur `(origin, destination, depart_date, observed_at, carrier, price_usd)`. Garde la plus haute source_quality.
- **Currency normalization** : tout en USD via `fx_rates_snapshot` (taux mensuels 2010-2024). Pré-populate cette table si pas déjà fait.
- **Outlier marking** : Tukey fences par route (Q1 - 3×IQR, Q3 + 3×IQR sur log-price). Marque `is_outlier=true` (ne supprime PAS, EVT en a besoin).
- **TTD imputation** : datasets sans TTD → `ttd_imputed=true` + valeur médiane empirique. Ces samples sont utilisés UNIQUEMENT pour baselines route-level, EXCLUS du training TTD-aware.
- **Source quality** : BTS=85, Expedia=95 (TTD exact), Kaggle=80, HF=75, Wayback=50, scraper-live=90.

### 1.3 Commande orchestrateur

Ajoute / étends `npm run ingest:all` qui :
1. Vérifie prérequis (kaggle CLI, disk space > 10 GB, Supabase service role key)
2. Lance les 10 ingesters en **séquentiel** (pour éviter de saturer bande passante + API rate limits)
3. Après chaque ingester : log volume ingéré, erreurs, durée
4. À la fin : `npm run quality:check` pour dédup + outlier detection
5. Affiche un rapport final :
   ```
   === INGESTION SUMMARY ===
   Source              Rows          Quality   Has TTD
   BTS DB1B Market     48,239,122    85        no (imputed)
   BTS DB1B Coupon     89,421,450    85        approx
   BTS T-100           5,823,441     70        no
   Expedia ICDM        9,917,280     95        YES
   Kaggle (5 datasets) 9,412,000     80        varies
   ...
   TOTAL               172,456,891 rows
   With exact TTD      14,328,420 rows
   ```

## 2) FEATURE ENGINEERING à partir de données réelles

Étends `scripts/train/02-features.py` pour produire des features riches pour chaque sample (écrites dans `real_features` + parquet files pour training) :

### 2.1 Features temporelles (no leakage)
- `ttd` (exact si disponible, imputed sinon — flag séparé)
- `ttd_bucket` : [7, 14, 30, 60, 90, 150, 300]
- `ttd_log`, `ttd_sqrt`
- `day_of_week`, `day_of_month`, `month`, `quarter`
- `is_weekend_depart`, `is_holiday_proximity` (via `holidays` Python lib par pays)
- `season`, `days_to_next_holiday`

### 2.2 Features prix (rolling, past-only, no leakage)
- `rolling_mean_7d`, `rolling_std_7d`, `rolling_min_7d`, `rolling_max_7d` par route
- `rolling_mean_30d`, `rolling_std_30d` par route
- `rolling_trend_7d` (slope linear regression)
- `log_price`, `log_return_1d` (log price - log prev price same route)
- `price_vs_route_median`, `price_zscore_route`, `price_percentile_route`

### 2.3 Features route-level
- `route_distance_km` (haversine origin-dest)
- `is_international`, `is_transcontinental`, `is_intra_europe`
- `origin_hub_tier` : 1=major (IATA top 50), 2=regional, 3=minor
- `dest_hub_tier`
- `carrier_type` : legacy / lowcost / ultra-lowcost / charter
- `route_competition` : nb carriers distincts sur cette route

### 2.4 Features régime (HMM pré-calculé)
- `hmm_regime_proba_0..5` (6 régimes)
- `hmm_expected_duration` (jours restants dans le régime courant)

### 2.5 Features exogènes (enrichissement via APIs)
- `weather_at_dest_tempC` (via WeatherAPI, cached par date+destination)
- `fx_rate_origin_dest` (via Frankfurter API, cached)
- `brent_oil_price_monthly` (public dataset, proxy carburant)
- `holiday_boost_origin`, `holiday_boost_dest` (holiday intensity)

### 2.6 Output

- Écrit chaque feature vector dans `real_features` Supabase (pour query/audit)
- ET écrit en parquet files compressés (`data/features/train.parquet`, `val.parquet`, `test.parquet`) pour entraînement Python rapide

## 3) SPLIT train/val/test SANS LEAKAGE

Étends `scripts/train/01-split.py` :

- **Train** : 2015-01-01 → 2023-12-31 (9 ans de données réelles)
- **Validation** : 2024-01-01 → 2024-06-30 (6 mois)
- **Test hold-out FINAL** : 2024-07-01 → 2024-12-31 (6 mois, NEVER touched during training)

**Règle critique** : split par `observed_at` date, PAS par route. Les routes apparaissent dans tous les splits.

**Vérification leakage** :
- Pour chaque feature rolling_*, vérifie que `observation_window_end < observed_at`
- Pour chaque feature hmm_regime_proba, vérifie que le HMM est fit uniquement sur data < observed_at
- Test automatique : `scripts/train/audit-leakage.py` qui scan chaque feature et fait assert

## 4) ENTRAÎNEMENT COMPLET V7 sur données réelles

Implémente / complète ces 11 scripts de training (Python et TypeScript) :

**Script 03** — `scripts/train/03-fit-gp.ts` (Node, TS)
- GP par route avec ≥ 500 samples réels train
- Kernel composite : RBF(length_scale=30d) + Periodic(7d) + Periodic(365d) + Matern(5/2)
- L-BFGS sur marginal log-likelihood
- Si route < 500 samples → MAML fallback (Script 09)
- Sauvegarde hyperparams dans `model_params` Supabase

**Script 04** — `scripts/train/04-fit-hmm.ts` (Node, TS)
- HMM 6 états (PLATEAU_HIGH, DESCENT, OPTIMAL_FLOOR, ASCENT, PANIC_LATE, MISTAKE_FARE)
- Baum-Welch par cluster de routes (DPMM préliminaire)
- Émissions gaussiennes sur (log_price, log_return, ttd)
- Sauvegarde matrice transition + émissions par cluster

**Script 05** — `scripts/train/05-fit-qrf.ts` (Node, TS)
- Quantile Regression Forest (extends random forest)
- 300 arbres, profondeur 15 (plus deep car beaucoup de data)
- Quantiles : [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95]
- Horizons : J+1, J+7, J+30
- Features : toutes celles de Bloc 2
- Out-of-fold predictions pour ensemble stacking

**Script 06** — `scripts/train/06-train-lstm.py` (Python)
- LSTM-quantile multi-horizon
- Architecture : 3 layers × 256 hidden (gros car on a beaucoup de data), dropout 0.3
- Pinball loss multi-quantile
- Batch 1024, 80 epochs, early stopping sur val CRPS
- Training DataLoader streaming depuis parquet (jamais full RAM)
- Export ONNX `models/lstm-quantile-real.onnx`
- **Log détaillé** : train/val loss per epoch, CRPS, MAE, coverage

**Script 07** — `scripts/train/07-train-tft.py` (Python)
- Temporal Fusion Transformer (lib : `pytorch-forecasting`)
- 2 encoder + 2 decoder blocks (réduit pour CPU mais > version baseline)
- Multi-horizon J+1, J+7, J+30
- Variable selection networks pour features statiques/dynamiques
- Export ONNX

**Script 08** — `scripts/train/08-train-deepar.py` (Python)
- DeepAR autoregressive RNN
- Distribution output : Student-t (robuste aux outliers mistake fare)
- Monte Carlo 500 samples à l'inférence
- Training sur séquences temporelles par route
- Export ONNX

**Script 09** — `scripts/train/09-train-vae.py` (Python)
- β-VAE pour anomaly detection (mistake fares)
- Input : séquences prix normales (outliers exclus)
- Latent dim 16
- Reconstruction error threshold = p99 sur val set
- Export ONNX + threshold dans `model_params`

**Script 10** — `scripts/train/10-train-maml.py` (Python)
- Reptile meta-learning sur toutes les routes (chaque route = tâche)
- Permet cold-start rapide sur nouvelles routes
- Inner loop K=32 samples, outer loop adaptation
- Export weights ONNX

**Script 11** — `scripts/train/11-train-cql.py` (Python)
- Conservative Q-Learning offline RL
- Replay buffer construit depuis données réelles :
  - Chaque mission historique → (state=features, action=buy_if_at_floor, reward=-(price - route_floor))
  - Si < 50k épisodes réels possibles, complète avec simulateur calibré (pas depuis zéro synthetic — simulateur fit sur real_price_samples)
- CQL α=5.0 (conservatif)
- Export policy ONNX

**Script 12** — `scripts/train/12-fit-ensemble.ts` (Node, TS)
- Super Learner CV time-series split (5 folds)
- Level 0 : GP, QRF, LSTM, TFT, DeepAR, HMM-baseline, BayesianStopping
- Level 1 meta-learner : NNLS (non-negative least squares sommant à 1)
- Features contextuelles du meta-learner : ttd_bucket, volatility_est, sample_count, regime_proba, disagreement_entropy
- Sauvegarde weights + meta-learner coefs

**Script 13** — `scripts/train/13-validate.ts` (Node, TS)
- Walk-forward backtest sur test hold-out 2024-Q3-Q4
- Mode simulation réaliste : chaque mission est reproduite jour par jour (depuis first observed_at jusqu'à depart_date), V7 predict chaque jour, locked-in prix quand BUY_NOW
- Métriques complètes :
  - Capture Efficiency par route (median, p25, p75, min, max)
  - Avg vs Floor (%)
  - % missions achetées dans fenêtre optimale empirique
  - MAE, MAPE, CRPS
  - Coverage à 80/90/95 %
  - Reliability diagram (calibration)
  - Sharpe-like ratio
  - Comparaison V1 vs V7 sur mêmes missions
- Génère `docs/flyeas-v7-real-training-report.md` (5000-10000 mots) avec :
  - Volumes data par source (pie chart exporté PNG)
  - Distribution TTD dans training set (histogram PNG)
  - Métriques par modèle level-0 sur val
  - Métriques ensemble final sur test
  - Reliability diagrams (embedded PNGs)
  - Top 10 routes où V7 performe le mieux + top 10 où il sous-performe
  - Feature importance SHAP globale
  - Discussion limites

## 5) COMMANDES ORCHESTRATEUR

Ajoute / étends :

```bash
# Pipeline complet
npm run ingest:all          # 10 sources, 4-12h bande passante dépendant
npm run quality:check       # dedup + outlier, 10-30 min
npm run features:build      # feature engineering sur tout le corpus, 1-2h
npm run train:all           # 11 scripts training, 8-24h CPU Mac
npm run validate:real       # backtest hold-out, 30 min
npm run train:report        # génère le rapport final markdown
```

Pour debug / itération :
```bash
npm run train:smoke         # smoke test sur 50k lignes subset, 10 min
npm run train:single gp     # fit un seul modèle
npm run validate:quick      # backtest sur subset, 5 min
```

## 6) Seuils de succès (Palier cible avec data maximale)

Sur test hold-out 2024-Q3-Q4 (données réelles never seen) :

- **Capture Efficiency medium ≥ 82 %**
- **Avg vs Floor ≤ +5 %**
- **% fenêtre optimale ≥ 85 %**
- **Coverage 90 % empirique ∈ [87 %, 93 %]**
- **CRPS moyen ≤ 0.20**
- **V7 bat V1 sur ≥ 90 % des routes test**
- **Zéro régression** : aucune route V7 pire que V1 de plus de 2 pts

Avec ~170M rows réelles ingérées, ces chiffres sont atteignables.

## 7) Contraintes non-négociables

- **Aucun synthétique dans train/val/test principal** (uniquement pour CQL replay buffer augmentation, flag séparé, ≤ 20 % du buffer)
- **Aucun leakage temporel** (audit script obligatoire)
- **Tout en USD uniformisé**, taux historiques 2010-2024 pré-calculés
- **Commits atomiques** par script, conventional commits `feat(train-real): ...`
- **Logs JSON structurés** dans `logs/training/{script}-{timestamp}.log` pour chaque run
- **Checkpoints Python** tous les 5 epochs (recovery si crash)
- **Pas de GPU requis** : tout doit tourner sur CPU M1/M2 (ou Intel) en < 24h total
- **TypeScript strict, zéro `any`, zéro `console.log`** résiduel
- **Pas d'appel LLM dans le predictor ou le training** (reste déterministe)

## 8) Méthodologie d'exécution

### Phase 1 — Audit & plan (Plan mode + 3 subagents parallèles)
- Subagent A (Explore) : lire `scripts/ingest/*.ts` actuels et lister ce qui existe / manque
- Subagent B (Explore) : lire `scripts/train/*` existants
- Subagent C (Explore) : compter lignes actuelles dans Supabase `real_*` tables
- Puis écris plan consolidé dans `docs/v7-real-data-training-plan.md`

### Phase 2 — Étendre ingesters (batchs parallèles 3 subagents)
- Batch 2A : BTS DB1B period extension + DB1B Coupon nouveau + T-2 nouveau
- Batch 2B : Kaggle datasets étendus + HuggingFace discovery + Wayback robuste
- Batch 2C : OpenSky + FX rates snapshot pre-populate + Currency normalization

### Phase 3 — Execute `npm run ingest:all`
- Affiche progression live, résume à la fin
- Target : > 100M lignes réelles dans Supabase

### Phase 4 — Feature engineering complet (`npm run features:build`)
- Audit leakage automatique

### Phase 5 — Training parallèle
- Vague 1 (parallèle) : GP (Node), HMM (Node), QRF (Node)
- Vague 2 (parallèle Python) : LSTM, VAE
- Vague 3 (parallèle Python) : TFT, DeepAR
- Vague 4 : MAML (dépend du corpus)
- Vague 5 : CQL (dépend du simulateur calibré sur real data)
- Vague 6 : Ensemble stacking
- Vague 7 : Validation hold-out

### Phase 6 — Rapport final + commit

## 9) Livrables finaux

1. `docs/flyeas-v7-real-training-report.md` (5k-10k mots, graphs PNG embedded)
2. `docs/v7-data-manifest.md` (liste exhaustive des sources, volumes, qualité)
3. `models/` directory avec tous les .onnx exportés + hashes
4. `model_params` Supabase table peuplée
5. Benchmark V1 vs V7 sur test réel
6. Présente-moi à la fin :
   - Screenshot du rapport (capture efficiency médiane affichée)
   - Commandes exactes pour deploy V7 en shadow mode
   - Top 5 sources data qui ont le plus aidé (feature importance par source)
   - Liste des commits faits

## Démarrage

Entre en Plan mode, lance les 3 subagents Explore en parallèle, puis consolide le plan. Puis exécute Phases 2 → 6 avec subagents parallèles où possible. Commits atomiques. Travaille jusqu'au bout (24-48h autorisées si besoin). GO.

## FIN DU PROMPT
