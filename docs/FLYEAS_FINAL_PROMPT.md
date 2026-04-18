# 🚀 PROMPT FINAL — Flyeas V7 Training Pipeline
# Version consolidée adaptée à l'environnement exact de Salah
# Date: 2026-04-17

> **À coller tel quel dans Claude Code terminal.**
> Ne pas modifier. Ne pas découper.

---

## DÉBUT DU PROMPT

Tu es principal ML engineer + data engineer senior. Tu vas implémenter pour Flyeas un système complet d'entraînement de l'algorithme V7 sur **vraies données historiques** + **scraping live continu**, en utilisant **exactement** les ressources disponibles dans ce projet.

**Budget : illimité en temps, qualité absolue.** Utilise Plan mode, subagents parallèles, TodoWrite pour tracker, preview browser pour vérifier.

## 0) Contexte projet EXACT (ne pas re-explorer au-delà du nécessaire)

- **Repo** : `/Users/salahfarhat/Desktop/BudgetPilot_Live`
- **Stack** : Next.js 14.2.28 App Router, TypeScript strict, Supabase Postgres, Node 20.x sur Vercel
- **Fichiers à LIRE en parallèle au démarrage** :
  - `lib/agent/predictor.ts` — V1 existant
  - `lib/agent/baselines.ts`
  - `lib/agent/price-history.ts`
  - `docs/flight-price-curves.html` — simulateur V1 sur 50 routes
  - `docs/FLYEAS_V7_PROMPT.md` — spec V7 complète (70+ modèles)
  - `docs/FLYEAS_REAL_DATA_TRAINING_PROMPT.md` — spec training données réelles
  - `docs/FLYEAS_FREE_TRAINING_PROMPT.md` — spec pipeline gratuit
  - `package.json` — deps
  - `supabase/migrations/` — schéma DB
  - `.env.local` (lire structure, pas valeurs)

**Les 3 specs ci-dessus contiennent les détails techniques approfondis — réfère-t'y pendant l'implémentation mais n'en duplique pas le contenu dans tes commits.**

## 1) Variables d'environnement DÉJÀ présentes dans .env.local

L'utilisateur a confirmé ces variables existent (ne pas recréer, juste utiliser) :

```
NEXT_PUBLIC_SUPABASE_URL            # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY       # Supabase anon key (client-side)
SUPABASE_SERVICE_ROLE_KEY           # Supabase admin (server-side, for ingestion)
RAPIDAPI_KEY                        # Clé unique pour les 6 APIs RapidAPI
RAPIDAPI_HOST                       # Host par défaut (peut être override par API)
RESEND_API_KEY                      # Pour notifications alertes
ALERT_FROM_EMAIL                    # Email source alertes
STRIPE_SECRET_KEY                   # Paiements existants
SCRAPER_SECRET                      # Secret généré récemment (vérifier présence)
```

**Si `SCRAPER_SECRET` absent, arrête-toi et demande à l'utilisateur de le générer avec `openssl rand -hex 32`.**

## 2) APIs RapidAPI disponibles (confirmées abonnées par l'utilisateur)

Ta clé unique `RAPIDAPI_KEY` donne accès à ces 6 APIs :

| API | Host header | Plan | Quota estimé |
|---|---|---|---|
| **Sky Scrapper** | sky-scrapper.p.rapidapi.com | **PRO PAID $8.99/mo** | 5 000-20 000 req/mois |
| **Air Scraper** | air-scraper.p.rapidapi.com | Basic Free | ~500 req/mois |
| **Kiwi.com Cheap Flights** | kiwi-com-cheap-flights.p.rapidapi.com | Basic Free | ~100 req/mois |
| **Booking COM** | booking-com15.p.rapidapi.com | Basic Free | ~100 req/mois |
| **Google Flights2** | google-flights2.p.rapidapi.com | Basic Free | ~100 req/mois |
| **WeatherAPI** | weatherapi-com.p.rapidapi.com | Basic Free | **1 000 000 req/mois** |

**Construis un `ApiRotator` qui :**
- Priorise Sky Scrapper (le plus de quota + données premium)
- Fallback en cascade : Kiwi → Air Scraper → Booking → Google Flights2
- Utilise WeatherAPI UNIQUEMENT pour enrichir les features météo par route/date
- Track quota restant par API (estimé), reset monthly
- Circuit breaker sur erreur 5xx (5 erreurs consécutives → skip 1h)
- Normalise toutes les réponses vers schéma `PriceSample` unifié

## 3) Mission en 5 Phases (ordre strict)

### PHASE 1 — Audit & Planification (2 subagents parallèles)

Lance simultanément :

**Subagent 1A (Explore)** : "Lire predictor.ts, baselines.ts, price-history.ts. Me retourner une synthèse de 300 mots sur la structure actuelle, les types publics, les points d'intégration pour V7. Identifier toutes les routes API existantes qui consomment predictor."

**Subagent 1B (Explore)** : "Explorer supabase/migrations/ et énumérer les tables existantes avec schéma. Identifier celles déjà présentes (price_samples ? missions ? predictions ?) et celles à créer. Lister les indexes existants."

Avec leurs retours, écris `docs/v7-integration-plan.md` (≤ 800 mots) qui décrit exactement :
- Quelles migrations SQL créer
- Quels fichiers modifier dans predictor.ts (minimally, feature-flagged)
- Structure de `lib/agent/v7/` finale
- Ordre d'implémentation batchs

### PHASE 2 — Fondations V7 (implémentation core, ~4-8h)

Crée dans `lib/agent/v7/` les 15 modules Tier-S de V7 (voir `docs/FLYEAS_V7_PROMPT.md` section Tier S pour la liste exacte). Organise en **6 batchs parallèles de 2-3 subagents** :

- Batch 2A : `bayesian-stopping.ts`, `kalman.ts`, `particle-filter.ts`
- Batch 2B : `hmm-regime.ts`, `ms-garch.ts`, `bocpd.ts`
- Batch 2C : `gp.ts`, `qrf.ts`, `conformal.ts`
- Batch 2D : `evt.ts`, `survival.ts`, `mcts.ts`
- Batch 2E : `ensemble.ts`, `thompson.ts`
- Batch 2F : `explainer.ts`

Entre chaque batch : `npm run typecheck && npm run test` doit passer.

**Contrainte** : pas de `any`, pas de console.log, TypeScript strict, coverage tests ≥ 70 % par module.

### PHASE 3 — Scraper & Ingestion (implémentation, ~4h)

**Bloc A — Scraper avec rotator** (1 subagent) :
- `scripts/scraper/routes.ts` : 100 routes mondiales populaires
- `scripts/scraper/api-rotator.ts` : rotator pour les 6 APIs
- `scripts/scraper/core.ts` : `runScrape()` main function
- `app/api/scraper/run/route.ts` : endpoint POST sécurisé par `SCRAPER_SECRET`
- `.github/workflows/scraper.yml` : GitHub Actions cron toutes les 4h

**Bloc B — Ingesters datasets historiques** (3 subagents parallèles) :
- `scripts/ingest/bts-db1b.ts` : download BTS DB1B 2020-2024 (~15M lignes)
- `scripts/ingest/bts-t100.ts` : download BTS T-100 2020-2024 (~3M lignes)
- `scripts/ingest/kaggle.ts` : download Kaggle flight datasets via Kaggle CLI
- `scripts/ingest/expedia-icdm.ts` : Expedia ICDM 2013 challenge data (10M lignes)
- `scripts/ingest/huggingface.ts` : auto-discovery HuggingFace airfare datasets
- `scripts/ingest/quality-gate.ts` : déduplication, outlier Tukey, currency normalization via Frankfurter API

**Bloc C — Migrations Supabase** :
```sql
-- Table principale
CREATE TABLE IF NOT EXISTS real_price_samples (...);
-- Table agrégées pour data sans TTD exact
CREATE TABLE IF NOT EXISTS real_aggregated_fares (...);
-- Log ingestion
CREATE TABLE IF NOT EXISTS ingestion_runs (...);
-- Feature store
CREATE TABLE IF NOT EXISTS real_features (...);
-- Model registry
CREATE TABLE IF NOT EXISTS model_runs (...);
-- Scraper monitoring
CREATE TABLE IF NOT EXISTS scraper_runs (...);
-- Drift alerts
CREATE TABLE IF NOT EXISTS drift_alerts (...);
```

Applique via `supabase migration new` puis `supabase db push`.

**Commandes orchestrateur** (à ajouter dans `package.json` scripts) :
- `npm run ingest:all` → enchaîne tous les ingesters
- `npm run quality:check` → lance quality gate
- `npm run scraper:deploy` → deploy Vercel + active GitHub Actions

### PHASE 4 — Training Pipeline (Python + Node, ~6h implémentation)

Crée `scripts/train/` avec :

1. `01-split.py` — train/val/test split no-leakage par date
2. `02-features.py` — feature engineering (rolling stats, z-score, holiday proximity, weather from WeatherAPI, FX from Frankfurter, regime HMM proba)
3. `03-fit-gp.ts` — GP par route (Node)
4. `04-fit-hmm.ts` — HMM Baum-Welch (Node)
5. `05-fit-qrf.ts` — Quantile Regression Forest (Node)
6. `06-train-lstm.py` — LSTM-quantile + export ONNX
7. `07-train-vae.py` — β-VAE anomaly detection + ONNX
8. `08-train-maml.py` — Reptile meta-learning + ONNX
9. `09-train-cql.py` — CQL offline RL sur simulateur + données réelles
10. `10-fit-ensemble.ts` — Super Learner stacking
11. `11-validate.ts` — walk-forward backtest sur hold-out 2024-Q4

**Commande master** : `npm run train:all`

**Dépendances Python** : crée `scripts/train/requirements.txt` avec versions pinnées :
```
torch==2.3.0
onnx==1.16.0
onnxruntime==1.17.0
pandas==2.2.0
pyarrow==15.0.0
scikit-learn==1.4.0
scipy==1.12.0
hmmlearn==0.3.0
supabase==2.4.0
```

### PHASE 5 — Intégration & Vérification

1. `lib/agent/v7/index.ts` : `predictV7(ctx)` qui orchestre tous les modules
2. `lib/agent/predictor-v7.ts` : wrapper qui respecte l'interface V1
3. Feature flag dans routes API : `process.env.FLYEAS_ALGO_VERSION` ∈ {`v1`, `v7`, `shadow`}
4. Étend `docs/flight-price-curves.html` avec **Section 9 "Simulation V7"** comparant V1 vs V7 sur les 50 routes fixture (exécuté dans le browser via port TS→JS des modèles S-tier)
5. Utilise `preview_start` pour lancer le dev server, `preview_snapshot` + `preview_screenshot` pour valider visuellement
6. Génère `docs/FLYEAS_V7_READY.md` : guide utilisateur avec commandes exactes pour entraîner

## 4) Guardrails NON négociables

- **Pas de modification à predictor.ts existant** (coexistence V1/V7 via feature flag)
- **Pas de `any`**, **pas de `console.log`** résiduel
- **Pas de secrets commités** (vérifier `.gitignore` contient `.env.local`, `.venv-train/`, `data/raw/`, `models/`)
- **Pas de dépendance > 3 Mo** sans justification
- **Pas de training sur validation set** (vérifier par audit script)
- **Commits atomiques** par Phase/Batch avec conventional commits :
  - `feat(v7): add bayesian stopping module`
  - `feat(ingest): add BTS DB1B ingester`
  - `feat(train): lstm-quantile training script`

## 5) Documentation finale à produire

À la fin, génère ces 3 fichiers :

1. **`docs/FLYEAS_V7_READY.md`** — Guide utilisateur en 10 étapes :
   - Étape 1 : vérifier .env.local complet
   - Étape 2 : appliquer migrations Supabase
   - Étape 3 : `npm run ingest:all` (durée : 4-8h)
   - Étape 4 : installer Python venv
   - Étape 5 : `npm run train:all` (durée : 6-16h)
   - Étape 6 : lire le rapport
   - Étape 7 : deploy scraper Vercel
   - Étape 8 : activer GitHub Actions
   - Étape 9 : shadow deployment
   - Étape 10 : bascule V7 prod

2. **`docs/v7-architecture.md`** — Architecture technique (≤ 2000 mots)

3. **`docs/v7-training-report-template.md`** — Template vide pour le futur rapport

## 6) Checkpoints de progression

Utilise TodoWrite avec 20-30 tâches granulaires. À la fin de chaque Phase, présente un récap court (≤ 10 lignes) :
- Fichiers créés
- Tests passant
- Commits faits
- Prochaine phase

## 7) Critères de succès final

- ✅ `npm run build` → zéro warning nouveau
- ✅ `npm run typecheck` → zéro erreur
- ✅ `npm run test` → tous tests verts, coverage v7 ≥ 70 %
- ✅ `npm run ingest:all` → stub fonctionnel (l'utilisateur l'exécutera vraiment plus tard)
- ✅ `npm run train:all` → scripts présents, smoke test sur 10 routes passe
- ✅ Docs `FLYEAS_V7_READY.md` présent et actionnable
- ✅ 20-30 commits atomiques

## Démarrage

1. Lance les 2 subagents Explore en parallèle (Phase 1)
2. Synthétise dans `docs/v7-integration-plan.md`
3. Puis implémente Phase 2 → 5 séquentiellement, avec batchs parallèles au sein de chaque phase
4. Commits atomiques avec messages clairs
5. À la fin : screenshot du dashboard `docs/flight-price-curves.html` Section 9 V1 vs V7

**Démarre MAINTENANT. GO.**

## FIN DU PROMPT
