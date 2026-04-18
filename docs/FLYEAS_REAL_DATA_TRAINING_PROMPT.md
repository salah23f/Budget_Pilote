# PROMPT ENTRAÎNEMENT DONNÉES RÉELLES — Flyeas V7
# Training exclusivement sur données historiques réelles (BTS, Kaggle, Expedia ICDM, scraping live)
# Synthétique utilisé uniquement pour data augmentation limitée, jamais pour validation

> À coller dans le terminal Claude Code APRÈS avoir donné le prompt V7 principal.
> Objectif : entraîner V7 sur ~20M+ lignes de vraies observations de prix aérien,
> sans un seul utilisateur Flyeas.

---

## DÉBUT DU PROMPT

Tu es ingénieur data senior spécialisé en pricing aérien. Tu vas construire pour Flyeas un **pipeline d'entraînement exclusivement sur données réelles historiques** de prix de billets d'avion. L'objectif : entraîner tous les modèles ML de V7 (`lib/agent/v7/`) sur des millions d'observations réelles, sans aucune donnée synthétique dans l'entraînement principal ni dans la validation.

**Principe directeur** : synthetic data autorisée UNIQUEMENT pour (a) data augmentation légère (≤ 10 % du dataset d'entraînement), (b) MCTS rollouts à l'inférence, (c) CQL offline RL dans un environnement simulé. **Jamais** pour valider la performance. **Jamais** pour calibrer la confidence. **Jamais** comme source principale d'un modèle de forecasting.

## 0) Contexte projet

- Repo : `/Users/salahfarhat/Desktop/BudgetPilot_Live`
- V7 code existe déjà dans `lib/agent/v7/` (sinon stoppe et signale)
- Stack : Next.js 14, TypeScript, Supabase Postgres, Python 3.11+ pour training

## 1) Sources de données réelles à ingérer (TOUTES GRATUITES)

### Source 1 — BTS DB1B (US DOT) : LA GOLDMINE

**Description** : Origin and Destination Survey, 10 % random sample de TOUS les tickets vendus aux USA chaque trimestre depuis 1993. Contient fare réel payé, origin-destination, carrier, date.

- **URL** : https://transtats.bts.gov/Tables.asp?DB_ID=125
- **Fichiers à télécharger** : `DB1BMarket` (trimestriel) pour 2020Q1 → 2024Q4 = 20 trimestres
- **Volume** : ~500k-2M lignes par trimestre × 20 = **~15-30M lignes**
- **Schéma clé** :
  ```
  ItinID, MktID, Year, Quarter, Origin, Dest, OriginAirportID, DestAirportID,
  TkCarrierChange, TkCarrier, OpCarrierChange, OpCarrier, BulkFare, Passengers,
  MktFare (USD), MktDistance, MktMilesFlown, NonStopMiles, ItinGeoType, MktGeoType
  ```
- **Limitations** : pas de TTD exact (seulement trimestre d'achat), pas de date-of-departure précise. Ce dataset sert pour : route-level baselines, régional pricing levels, carrier effects.

### Source 2 — BTS T-100 Market (monthly averages)

- **URL** : https://transtats.bts.gov/Tables.asp?DB_ID=111
- **Période** : 2020-01 → 2024-12 = 60 mois × ~50k lignes = **~3M lignes**
- **Utilité** : tendances mensuelles par route, seasonality par marché

### Source 3 — Expedia ICDM 2013 Challenge Dataset (RÉEL)

**Description** : 10M+ recherches réelles sur Expedia avec prix observés, TTD, origin-destination, carrier. PARFAIT pour modéliser la relation TTD → prix.

- **Source primaire** : http://www.kaggle.com/c/expedia-personalized-sort/data (compte Kaggle requis)
- **Mirror académique** : plusieurs universités ont des copies → chercher via Google Scholar "Expedia ICDM 2013 dataset mirror"
- **Fallback** : si indisponible, signale-le clairement et continue avec les autres sources
- **Schéma clé** :
  ```
  srch_id, date_time, site_id, visitor_location_country_id,
  prop_id, prop_country_id, prop_starrating, prop_review_score,
  srch_destination_id, srch_length_of_stay, srch_booking_window (TTD!),
  srch_adults_count, srch_children_count, srch_room_count,
  price_usd, promotion_flag, click_bool, booking_bool
  ```

### Source 4 — Kaggle Flight Fare Prediction (Inde)

- **URL** : https://kaggle.com/datasets/nikhilmittal/flight-fare-prediction-mh
- **Volume** : ~300k obs Inde 2019, colonnes Airline/Source/Destination/Total_Stops/Price/Date_of_Journey/Dep_Time
- **Utilité** : pattern TTD → prix sur marché asiatique, diversité routes

### Source 5 — Kaggle US DOT Flight Delay & Cancellation (2015-2018, 5.8M vols)

- **URL** : https://kaggle.com/datasets/usdot/flight-delays
- **Utilité** : features de contexte (delays par route, cancellation rate) qui influencent pricing

### Source 6 — Kaggle Airfare Fare Dataset (2012-2016)

- **URL** : https://kaggle.com/datasets/airbnbfreq/airfare
- Volume : ~1M lignes US fares par route trimestriel

### Source 7 — OAG Academic Sample

- **URL** : https://www.oag.com (request academic sample via contact form)
- **Volume** : Variable selon samples disponibles, typiquement 100k-1M lignes
- **Fallback gracieux** si pas obtenu dans les 48h

### Source 8 — HuggingFace Datasets

Recherche automatique via `@huggingface/hub` sur keywords `airfare`, `flight-prices`, `airline-pricing`. Parse les schémas, conserve ceux compatibles.

### Source 9 — Scraping live (démarre jour 1, accumule en continu)

Via 4 APIs gratuites en rotation intelligente :
- **Kiwi.com Tequila** (100 req/jour)
- **Amadeus Self-Service** (2000 req/mois)
- **RapidAPI Sky-Scrapper** (500 req/mois)
- **Travelpayouts** (illimité via affiliate)

Accumule **~50k-100k samples réels supplémentaires** sur 8 semaines, avec TTD exact et granularité journalière par route — ce que les datasets historiques n'ont pas.

### Source 10 — Archive.org Historical Fare Pages

**Méthode** : Wayback Machine a des snapshots de Kayak/Google Flights/Expedia depuis 2010. Via `wayback-api`, fetch snapshots pour 50 routes clés × 200 dates → extraire prix via regex/HTML parsing.

- **Volume attendu** : 10k-30k samples, moins propres mais avec TTD estimable
- **Fallback gracieux** si parsing échoue sur une source

## 2) Architecture données

### Schéma Supabase unifié

Crée (ou vérifie l'existence de) ces tables :

```sql
-- Observations réelles, source scraper ou dataset historique
CREATE TABLE real_price_samples (
  id BIGSERIAL PRIMARY KEY,
  origin CHAR(3) NOT NULL,
  destination CHAR(3) NOT NULL,
  depart_date DATE NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  ttd INTEGER NOT NULL, -- computed: depart_date - observed_at
  price_usd NUMERIC(10,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  carrier VARCHAR(10),
  stops INTEGER,
  cabin VARCHAR(20),
  source VARCHAR(50) NOT NULL, -- 'bts-db1b', 'bts-t100', 'expedia-icdm', 'kaggle-mh',
                                -- 'kaggle-usdot', 'kiwi-live', 'amadeus-live', ...
  source_quality SMALLINT NOT NULL, -- 0-100, quality score per source
  raw_fields JSONB, -- preserve original record for audit
  ingested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rps_route_ttd ON real_price_samples(origin, destination, ttd);
CREATE INDEX idx_rps_depart ON real_price_samples(depart_date);
CREATE INDEX idx_rps_source ON real_price_samples(source);
CREATE INDEX idx_rps_observed ON real_price_samples(observed_at DESC);

-- Trimestriel, quand on n'a que niveau agrégé (BTS DB1B sans TTD)
CREATE TABLE real_aggregated_fares (
  id BIGSERIAL PRIMARY KEY,
  origin CHAR(3),
  destination CHAR(3),
  year INT,
  quarter SMALLINT,
  avg_fare_usd NUMERIC(10,2),
  passenger_count INT,
  carrier VARCHAR(10),
  source VARCHAR(50),
  raw_fields JSONB
);

-- Log de chaque ingestion pour traçabilité
CREATE TABLE ingestion_runs (
  id BIGSERIAL PRIMARY KEY,
  source VARCHAR(50),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  rows_inserted INT,
  rows_rejected INT,
  errors JSONB,
  checksum VARCHAR(64)
);

-- Feature store computed from real data
CREATE TABLE real_features (
  id BIGSERIAL PRIMARY KEY,
  sample_id BIGINT REFERENCES real_price_samples(id),
  feature_set_version VARCHAR(20),
  features JSONB, -- {z_score, rolling_mean_7d, ..., regime_proba, ...}
  computed_at TIMESTAMPTZ DEFAULT NOW()
);
```

Ajoute migrations dans `supabase/migrations/` avec timestamp actuel.

## 3) Ce que tu dois construire

### Bloc A — Ingesters pour chaque source réelle

Crée un ingester par source dans `scripts/ingest/` :

- `scripts/ingest/bts-db1b.ts` — download via HTTPS, unzip, stream CSV parsing (pas de chargement full en RAM), batch insert Supabase par chunks de 10k. Gère columns renaming et conversion types. Source quality = 85 (data officielle mais trimestrielle).

- `scripts/ingest/bts-t100.ts` — similaire, source quality = 70 (monthly aggregated).

- `scripts/ingest/expedia-icdm.py` — Python (dataset fourni en compressed TSV). Extract, filter on flight-related rows, map `srch_booking_window → ttd`, `price_usd → price_usd`. Batch insert via Supabase REST. Source quality = 95 (TTD exact + price réel).

- `scripts/ingest/kaggle-datasets.ts` — utilise `kaggle` CLI si `~/.kaggle/kaggle.json` existe. Sinon affiche un message clair avec instructions exactes pour configurer Kaggle API key. Traite les 3 datasets Kaggle listés. Source quality = 80.

- `scripts/ingest/huggingface.ts` — auto-discovery via `@huggingface/hub`, filter schemas compatibles. Source quality = 75.

- `scripts/ingest/wayback.ts` — fetch snapshots Wayback pour N routes clés, parse HTML avec `cheerio`, extrait prix + metadata. Respecte rate limits (max 20 req/min). Source quality = 50 (parsing imparfait).

- `scripts/ingest/oag-sample.ts` — stub qui explique à l'utilisateur comment demander le sample OAG et placer le fichier. Si fichier présent, parse. Sinon skip gracieux.

### Bloc B — Scraper live (accumulation réelle continue)

- `scripts/scraper/routes.ts` — 100 routes populaires mondiales (pas 50 — maximiser diversité géographique).

- `scripts/scraper/api-rotator.ts` — classe `ApiRotator` qui orchestre 4 APIs :
  - Tracking quota par API (daily + monthly)
  - Priorité : Kiwi → Travelpayouts → Amadeus → Sky-Scrapper
  - Circuit breaker sur erreur 5xx
  - Retry exponential backoff
  - Normalize réponses vers `real_price_samples` avec source = `{api}-live`
  - Source quality : Kiwi=92, Amadeus=90, Sky-Scrapper=85, Travelpayouts=80

- `scripts/scraper/core.ts` — fonction `runScrape()` qui itère routes × TTD buckets `[7, 14, 21, 30, 45, 60, 75, 90, 120, 150, 180]` (11 buckets, plus granulaire), query rotator, insert.

- `app/api/scraper/run/route.ts` — endpoint POST protégé par `SCRAPER_SECRET`, exécute runScrape.

- `.github/workflows/scraper.yml` — GitHub Actions cron `0 */4 * * *` qui curl l'endpoint en prod.

- `.github/workflows/scraper-daily-deep.yml` — quotidien, scrape plus profond (tous TTD buckets pour routes prioritaires).

### Bloc C — Data quality & cleaning

Crée `scripts/ingest/quality-gate.ts` qui :

1. Déduplication : même `(origin, dest, depart_date, observed_at, price_usd, carrier)` → garde la source de plus haute quality.

2. Outlier removal par route : Tukey fences (Q1 - 3×IQR, Q3 + 3×IQR) sur `log(price)`. Marqué `is_outlier=true` mais pas supprimé (EVT en a besoin).

3. Currency normalization : si `currency != USD`, convert via taux snapshot 2024 (table `fx_rates_snapshot` pré-remplie). Pour data historique < 2020, utilise taux moyen annuel.

4. TTD backfill : pour datasets sans TTD (BTS DB1B), assigne TTD = 45 (médiane observée Expedia) avec flag `ttd_imputed=true`. Ces samples sont utilisés pour route baselines mais EXCLUS du training TTD-aware.

5. Carrier canonicalization : mapping de codes IATA multi-format vers canonique (ex: `AA`, `AAL`, `American Airlines` → `AA`).

6. Report génération : après chaque ingestion, `docs/data-quality-reports/YYYY-MM-DD.md` avec stats (rows in/out, outliers detected, duplicates removed, by-source breakdown).

Exécuter via `npm run quality:check`.

### Bloc D — Feature engineering SUR DONNÉES RÉELLES

Crée `scripts/train/features.py` (Python, pandas + scikit-learn) :

```python
# Input : real_price_samples via Supabase client
# Output : parquet files dans data/features/

features_per_sample = {
    # Price-derived
    'log_price': log(price_usd),
    'price_vs_route_median': price / median_price(origin, dest),
    'price_zscore_route': (price - mean) / std,

    # TTD-derived
    'ttd': ttd,
    'ttd_bucket': bucketize(ttd, [7, 14, 30, 60, 90, 150]),
    'ttd_log': log1p(ttd),

    # Temporal
    'day_of_week': observed_at.weekday(),
    'month': observed_at.month,
    'is_holiday_proximity': days_until_nearest_holiday(observed_at),
    'season': categorize_season(observed_at),
    'is_weekend_depart': depart_date.weekday() >= 5,

    # Rolling stats (uses only past data, no leakage)
    'rolling_mean_7d': rolling(route, window=7d, before=observed_at).mean(),
    'rolling_std_7d': rolling(route, window=7d, before=observed_at).std(),
    'rolling_mean_30d': rolling(route, window=30d, before=observed_at).mean(),
    'rolling_min_30d': rolling(route, window=30d, before=observed_at).min(),
    'rolling_trend_7d': linear_regression(route, window=7d).slope,

    # Route-level
    'route_distance_km': haversine(origin, dest),
    'is_international': country(origin) != country(dest),
    'origin_hub_tier': hub_tier(origin),  # 1=major, 2=regional, 3=minor
    'dest_hub_tier': hub_tier(dest),
    'carrier_type': {'legacy', 'lowcost', 'ultra-lowcost'},

    # Regime (from HMM, computed on prior data only)
    'hmm_regime_proba': hmm.predict_proba(route, observed_at),

    # Volatility
    'realized_vol_30d': log_returns_std(route, window=30d),
}
```

**CRUCIAL** : toutes les rolling stats utilisent **uniquement** data antérieure à `observed_at`. Aucune leak du futur.

### Bloc E — Training pipeline RÉEL (Python + Node)

#### Step E1 — Split data sans leakage

`scripts/train/01-split.py` :
- Train set : 2020-01-01 → 2024-06-30 (données réelles uniquement)
- Validation set : 2024-07-01 → 2024-09-30
- Test set (hold-out final) : 2024-10-01 → 2024-12-31
- **Aucune augmentation synthétique dans val/test**
- **Aucune route unique à un set** (split par date, pas par route, pour tester generalisation)

Output : `data/splits/train.parquet`, `val.parquet`, `test.parquet`.

#### Step E2 — GP par route (Node TS)

`scripts/train/02-fit-gp.ts` :
- Pour chaque route avec ≥ 200 samples réels train, fit GP (kernel RBF + Periodic 7d + Matern)
- L-BFGS sur marginal likelihood
- Sauvegarde hyperparams dans `model_params` Supabase avec `model_type='gp-per-route'`, `trained_on='real-only'`

#### Step E3 — HMM régimes par cluster de routes (Node TS)

`scripts/train/03-fit-hmm.ts` :
- DPMM préliminaire pour clusteriser routes similaires
- Fit HMM 6 états par cluster via Baum-Welch sur séquences temporelles
- Sauvegarde transitions + émissions

#### Step E4 — Quantile Regression Forest (Node TS)

`scripts/train/04-fit-qrf.ts` :
- Random forest 200 arbres, profondeur 12
- Quantiles τ = [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95]
- Features : tous ceux de Bloc D
- Training sur 3M+ lignes du train set

#### Step E5 — LSTM-quantile (Python CPU)

`scripts/train/05-train-lstm.py` :
- 2 couches × 128 hidden (plus gros que version synthetic-only car on a beaucoup plus de data)
- Pinball loss multi-quantile
- Batch 512, 50 epochs, early stopping sur val loss
- Dataset loader streaming depuis parquet (jamais tout en RAM)
- Export ONNX `models/lstm-quantile-real.onnx`
- **Training log détaillé** : train/val loss per epoch, CRPS sur validation

#### Step E6 — TFT léger (Python CPU si faisable, sinon skip avec log)

`scripts/train/06-train-tft.py` :
- Temporal Fusion Transformer (PyTorch Forecasting lib)
- 1 encoder + 1 decoder block (réduit pour CPU)
- Multi-horizon forecast : J+1, J+7, J+30
- Si training dépasse 12h estimé, stoppe et export checkpoint partial + log warning

#### Step E7 — DeepAR (Python)

`scripts/train/07-train-deepar.py` :
- Distribution output Student-t (robuste aux outliers mistake fare)
- Export ONNX

#### Step E8 — VAE pour anomaly detection (Python)

`scripts/train/08-train-vae.py` :
- Training sur séquences "normales" (outliers exclus)
- β-VAE, latent dim 8
- Reconstruction error seuil = percentile 99 sur val → mistake fare threshold
- Export ONNX + threshold dans `model_params`

#### Step E9 — MAML pour few-shot cold-start (Python)

`scripts/train/09-train-maml.py` :
- Reptile meta-learning sur 300 routes train (chaque route = une task)
- Meta-train : pour chaque route, sample K=32 observations pour inner loop, évalue sur 32 autres
- Export weights ONNX

#### Step E10 — CQL offline RL

`scripts/train/10-train-cql.py` :
- Construit replay buffer depuis données RÉELLES : chaque mission historique reconstituée comme `(state=features_at_observation, action=buy_if_min_price, reward=-(price_at_obs - floor))`
- Pour les datasets sans séquences complètes (BTS), SKIP — utilise seulement scraped data + Expedia ICDM
- Si replay buffer < 10k épisodes réels, augmente avec simulateur calibré sur données réelles (`sim_calibration=real-fitted-OU-jump`)
- CQL avec conservative Q penalty α=5.0
- Export policy ONNX

#### Step E11 — Super Learner ensemble

`scripts/train/11-fit-ensemble.ts` :
- Génère prédictions OOF (out-of-fold) pour chaque level-0 model sur train set via time-series CV (5 folds)
- Meta-learner : NNLS (Non-Negative Least Squares) pour poids optimaux sommant à 1
- Features meta-learner : pred_gp, pred_qrf, pred_lstm, pred_tft, pred_deepar, ttd_bucket, volatility, sample_count
- Sauvegarde poids + meta-learner coefs

#### Step E12 — Validation finale sur hold-out 2024-Q4

`scripts/train/12-validate.ts` :
- Applique ensemble + MCTS + Bayesian stopping sur test set
- **Mode simulation réaliste** : reproduit la séquence d'observations comme si Flyeas avait monitoré chaque mission en temps réel, du premier observed_at jusqu'au depart_date
- À chaque observation, V7 predict action → si BUY, locked-in prix
- Compare prix locked-in vs floor empirique (min observé de la mission) et vs prix final J-1
- Métriques :
  - Capture Efficiency par route, médian + p25/p75
  - Avg vs Floor (%)
  - % missions achetées dans la fenêtre optimale empirique
  - MAE / CRPS / coverage 80/90/95 %
  - Reliability diagram
- Génère `docs/flyeas-v7-real-training-report.md` avec tous les graphs (exportés en PNG depuis matplotlib)

### Bloc F — Scripts orchestrateurs

- `npm run ingest:all` — exécute Bloc A dans l'ordre optimal (BTS puis Expedia puis Kaggle puis HF puis Wayback), ~4-8h selon bande passante.
- `npm run scraper:start` — déploie scraper + active GitHub Actions.
- `npm run train:all` — exécute E1 → E12, ~6-16h sur Mac CPU.
- `npm run validate:real` — re-run E12 seulement (utile après retraining).

### Bloc G — Monitoring continu

- `app/admin/data-health/page.tsx` — dashboard Next qui affiche :
  - Volume par source (barre stack)
  - Couverture par route × TTD bucket (heatmap)
  - Rate d'ingestion quotidien (timeseries 30d)
  - Outliers detected rate
  - Quota API restant (gauge per API)
- `app/api/cron/data-drift/route.ts` — Vercel Cron daily qui lance drift detection entre distribution nouvelles obs vs training set. Si KL divergence > seuil, insère alerte dans `drift_alerts` table.

## 4) Ordre d'exécution (STRICT)

Utilise TodoWrite. 5 phases :

**Phase 1 — Setup (1-2h)**
- Lance subagent Explore : vérifie V7 présent, audit tables Supabase existantes, liste deps
- Crée migrations SQL (real_price_samples, real_aggregated_fares, ingestion_runs, real_features, drift_alerts)
- Setup Python venv + requirements.txt (torch, onnx, onnxruntime, pandas, pyarrow, scikit-learn, scipy, hmmlearn, pytorch-forecasting, pytorch-lightning, supabase-py)

**Phase 2 — Ingestion parallèle (durée variable selon bande passante)**
4 subagents parallèles :
- S2-1 : Bloc A items 1-2 (BTS DB1B + T-100)
- S2-2 : Bloc A items 3-4 (Expedia ICDM + Kaggle)
- S2-3 : Bloc A items 5-6 (HuggingFace + Wayback)
- S2-4 : Bloc B (scraper live + deploy)

Attendre tous, puis Bloc C (quality gate) en séquentiel.

**Phase 3 — Feature engineering**
- Bloc D : 1 subagent focalisé qui crée `features.py` et génère parquet outputs pour train/val/test splits.

**Phase 4 — Training parallèle (ordonnée par dépendances)**
Vague 1 parallèle : E1 (split), E2 (GP), E3 (HMM)
Vague 2 parallèle : E4 (QRF), E5 (LSTM)
Vague 3 parallèle : E6 (TFT), E7 (DeepAR)
Vague 4 parallèle : E8 (VAE), E9 (MAML)
Vague 5 : E10 (CQL, séquentiel)
Vague 6 : E11 (ensemble, dépend de tout)
Vague 7 : E12 (validation)

Si une vague prend > 4h, parallélise agressivement au sein via `screen`/`tmux` ou background processes.

**Phase 5 — Vérification et docs**
- Run `npm run validate:real`, vérifie rapport
- Si Capture Efficiency réelle ≥ 72 % sur hold-out 2024-Q4 : succès
- Génère `docs/free-training-playbook.md` : guide utilisateur détaillé
- Génère `docs/flyeas-v7-real-training-report.md` : rapport technique complet
- Screenshot admin dashboard via preview_start

## 5) Documentation utilisateur OBLIGATOIRE

`docs/free-training-playbook.md` contient :

1. **Comptes API à créer** : Kiwi, Amadeus, RapidAPI, Travelpayouts, Kaggle — avec URLs exactes, durée estimée par compte, où trouver la clé API après inscription, quotas.

2. **Où coller les clés** :
   - `.env.local` (dev local)
   - `vercel env add` (prod)
   - GitHub repo Settings → Secrets (Actions)

3. **Commandes à lancer dans quel ordre**, avec temps estimé :
   ```
   npm install                     # 2 min
   python -m venv .venv-train
   source .venv-train/bin/activate
   pip install -r requirements-train.txt   # 5 min
   npm run bootstrap:migrations    # 30 sec
   npm run ingest:all              # 4-8h (network + parsing)
   npm run quality:check           # 10 min
   npm run scraper:deploy          # 2 min (pour accumulation continue)
   # attendre 0-8 semaines d'accumulation scraper (optionnel si datasets historiques suffisent)
   npm run train:all               # 6-16h (training CPU)
   npm run validate:real           # 20 min
   ```

4. **Interprétation des résultats** : que regarder dans le training report, quels seuils définissent un succès (Capture ≥ 72 % sur hold-out réel 2024-Q4), que faire en cas d'échec (re-run avec hyperparams ajustés, plus de data, etc).

5. **Déploiement shadow après training** :
   ```
   vercel env add FLYEAS_ALGO_VERSION production  # valeur: shadow
   vercel env add FLYEAS_SHADOW_V7 production     # valeur: true
   git push origin main
   vercel --prod
   ```

## 6) Critères de succès

- **≥ 15M lignes réelles ingérées** (BTS + Kaggle + Expedia au minimum)
- **≥ 10k samples de scraper live** après activation (24h de scraping)
- **Quality gate rejette < 5 %** des rows en outliers (sinon data pipeline buggé)
- **Validation hold-out 2024-Q4 réel** :
  - Capture Efficiency médiane ≥ 72 %
  - Avg vs Floor ≤ +9 %
  - Coverage 90 % empirique ∈ [85 %, 93 %]
  - CRPS moyen ≤ 0.25
- **Zéro leakage** : vérifier via `scripts/audit/check-leakage.ts` qui inspecte les splits et feature engineering
- **Tests unitaires** sur tous les ingesters et scripts training
- `npm run build` + typecheck propre
- Documentation utilisateur claire et testée par un dry-run

## 7) Guardrails

- **Jamais de synthetic dans val/test sets**
- **Jamais de TTD imputé dans training TTD-aware**
- **Respect ToS APIs** : rate limiting strict, User-Agent honnête, pas de scraping interdit
- **Respect licences datasets** : BTS public domain, Kaggle selon dataset license, Expedia ICDM usage académique autorisé
- **Pas de PII** : vérifier que aucun dataset contient noms/emails — filter si présent
- **Commits atomiques** par bloc/phase
- **Ne push jamais les données brutes** : `data/raw/` dans .gitignore. Seuls les scripts d'ingestion sont commitées.
- **Checkpoints training** : tous les 5 epochs, sauver model state pour reprise si interruption
- **Logs détaillés** : chaque script écrit un log dans `logs/training/{script-name}-{timestamp}.log`

## 8) Livrables finaux

Quand Phase 5 verte, présente :

1. **Rapport complet** `docs/flyeas-v7-real-training-report.md` (5000-10000 mots) :
   - Volumes data par source avec pie chart
   - Distribution TTD dans training set (histogram)
   - Métriques par modèle (level-0) sur val set
   - Métriques ensemble final sur test set 2024-Q4
   - Reliability diagrams (screenshots PNG embeds)
   - Top 10 routes où V7 performe le mieux + top 10 où il rate
   - Feature importance SHAP globale
   - Comparaison V1 vs V7 sur test set
   - Discussion limites observées
   - Roadmap améliorations

2. **Playbook utilisateur** `docs/free-training-playbook.md` actionnable

3. **Commits atomiques** avec messages `feat(training-real): ...`

4. **Screenshot dashboard** `/admin/data-health`

5. **Liste des prochaines actions utilisateur** :
   - Coller clés API (temps estimé)
   - Lancer commandes (temps total)
   - Monitorer scraper pendant N semaines
   - Re-run training à intervalle (weekly cron déjà configuré)
   - Quand bascule prod V7

**Démarre IMMÉDIATEMENT par Phase 1. GO.**

## FIN DU PROMPT
