# PROMPT ENTRAÎNEMENT GRATUIT — Flyeas V7 sans budget

> À coller dans le terminal Claude Code APRÈS avoir donné le prompt V7 principal.
> Toute l'infra utilisée est 100 % gratuite (APIs free-tier + GitHub Actions + training local).

---

## DÉBUT DU PROMPT

Tu es ingénieur data + infra. Tu vas construire pour Flyeas un **pipeline complet d'entraînement gratuit** de l'algo V7, utilisable sans un seul utilisateur payant, sans hébergement payant, sans GPU. L'objectif : accumuler des données réelles + datasets publics + synthétique pendant 6-8 semaines, puis entraîner localement tous les modèles ML pour qu'au jour du lancement Flyeas, V7 soit déjà au Palier 2 (capture efficiency ≥ 85 %).

Contraintes STRICTES :
- **Zéro coût mensuel**. Pas de Vercel Pro ($20), pas de RapidAPI paid, pas de cloud GPU.
- **Training sur la machine locale** de l'utilisateur (Mac Intel/Apple Silicon, CPU uniquement, 16 Go RAM).
- **Cron via GitHub Actions gratuit** (2000 min/mois sur repo privé, illimité sur public).
- **Rotation intelligente de 3 APIs free-tier** pour maximiser le quota quotidien combiné.

## 0) Contexte projet

- Repo : `/Users/salahfarhat/Desktop/BudgetPilot_Live`
- Stack : Next.js 14, TypeScript, Supabase, Node 20.x
- V7 algo déjà codé dans `lib/agent/v7/` (si pas le cas, signale-le et stoppe — ce prompt suppose V7 code existant)
- Supabase local déjà lié (tables `price_samples` supposée exister, sinon la créer)

## 1) Sources de données GRATUITES à exploiter

### API free-tier à orchestrer en rotation

| API | Quota gratuit | Usage |
|---|---|---|
| **Kiwi.com Tequila** | 100 req/jour = 3000/mois | Requêtes principales, meilleure qualité data |
| **Amadeus Self-Service** | 2000 req/mois | Fallback prioritaire |
| **Sky-Scrapper (RapidAPI Basic)** | 500 req/mois free | Fallback tertiaire / cross-check |
| **Travelpayouts** | Illimité via affiliate | Sans carte, enregistre-toi comme affiliate |
| **OpenSky Network** | Gratuit illimité | Data de capacité/fréquence vols (pas prix mais utile pour features) |

**Stratégie rotation** : chaque appel détermine quelle API utiliser selon le quota restant. Round-robin avec priorité Kiwi → Travelpayouts → Amadeus → Sky-Scrapper.

Budget combiné utilisable : ~180 requêtes/jour = **40-60 routes × 3-4 TTD buckets** chaque jour.

### Datasets publics (téléchargement ponctuel, pas de quota)

| Source | Volume | Lien |
|---|---|---|
| **BTS T-100 Market** | 50M+ lignes, fares US 1990-2024 | transtats.bts.gov/Tables.asp?DB_ID=111 |
| **BTS DB1B (Origin & Destination Survey)** | Sample 10 % des tickets US trimestriel | transtats.bts.gov |
| **Kaggle Flight Fare Prediction** | ~300k obs Inde | kaggle.com/datasets/nikhilmittal/flight-fare-prediction-mh |
| **Kaggle Airline Delay and Cancellation** | 5.8M vols | kaggle.com/datasets/usdot/flight-delays |
| **HuggingFace Datasets** | Plusieurs datasets airfare | huggingface.co/datasets?search=flight |
| **OAG Academic Samples** | Free pour recherche | oag.com (demander sample) |

### Données synthétiques (gratuit illimité)

- Simulateur de `docs/flight-price-curves.html` (generateCurve) → portable en Python
- Génération OU-jump diffusion paramétré par route
- Data augmentation : bruit gaussien + perturbations jumps

## 2) Ce que tu dois construire

### Bloc A — Scraper autonome avec rotation intelligente

1. **`scripts/scraper/routes.ts`** : liste 50 routes populaires prioritaires (hubs européens × hubs mondiaux) avec metadata (popularité estimée, saisonnalité, type long/moyen/court-courrier).

2. **`scripts/scraper/api-rotator.ts`** : classe `ApiRotator` qui gère :
   - Comptage requêtes par API + reset quotidien/mensuel
   - Priorisation selon quota restant
   - Circuit breaker si API KO (fallback auto)
   - Normalisation réponses vers schéma commun `PriceSample`
   - Retry exponential backoff

3. **`scripts/scraper/core.ts`** : fonction principale `runScrape(routes, buckets)` qui :
   - Pour chaque route, pour chaque TTD bucket `[7, 14, 30, 45, 60, 90, 120, 180]`
   - Query via rotator
   - Insert dans Supabase `price_samples`
   - Logge dans table `scraper_runs` (timestamp, routes_tried, success_count, errors)

4. **`app/api/scraper/run/route.ts`** : endpoint POST protégé par secret (`SCRAPER_SECRET` env var) qui exécute `runScrape`. Appellable depuis GitHub Actions.

5. **`.github/workflows/scraper.yml`** : GitHub Actions Cron schedule `0 */4 * * *` (toutes les 4h) qui fait `curl -X POST https://flyeas.vercel.app/api/scraper/run -H "Authorization: Bearer $SCRAPER_SECRET"`. Stocke le secret dans GitHub repo secrets.

6. **Monitoring** : table `scraper_runs` + dashboard `/admin/scraper` (page simple) qui affiche :
   - Req consommées / quota restant par API
   - Couverture routes × buckets (heatmap)
   - Erreurs récentes

### Bloc B — Ingestion datasets publics

7. **`scripts/bootstrap/download-bts.ts`** : download BTS T-100 CSVs (2020-2024), parse, normalise, insert dans `training_data_external` avec source='bts'.

8. **`scripts/bootstrap/download-kaggle.ts`** : utilise Kaggle CLI (user doit avoir `~/.kaggle/kaggle.json` configuré, sinon guide-le dans un message clair), télécharge les 2 datasets Kaggle cités.

9. **`scripts/bootstrap/download-huggingface.ts`** : utilise `@huggingface/hub` pour fetch quelques datasets airfare HF. Fallback silencieux si indisponible.

10. **`scripts/bootstrap/normalize-external.ts`** : pipeline ETL qui unifie toutes sources vers `PriceSample`. Gère conversions devise → USD (taux statique snapshot 2024), normalisation dates, déduplication.

11. **Commande orchestrateur** : `npm run bootstrap:data` qui exécute 7-10 en séquence.

### Bloc C — Simulateur Python pour synthetic + RL training

12. **`scripts/train/simulator.py`** : port Python du `generateCurve` + extensions :
    - Générateur OU-jump (mean-reverting avec jumps Poisson)
    - Markov-switching GARCH pour régime vol
    - Saisonnalité (weekly + yearly)
    - Mistake fare rate paramétrable
    - Fonction `generate_dataset(n_routes=500, n_years=3, n_runs_per_route=50)` → 75 000 trajectoires

13. **`scripts/train/feature-engineering.py`** : calcul features par sample :
    - Rolling stats (mean/std/min/max) sur fenêtres 7/14/30/60 jours
    - Z-score vs baseline route
    - Trend slope 7j/30j
    - Volatilité realized
    - Day-of-week / month / holiday proximity
    - TTD bucket one-hot
    - Route embedding (géodésique origin-dest + carrier type)
    - Export en parquet `data/features.parquet`

### Bloc D — Training pipeline local (CPU friendly)

14. **`scripts/train/01-fit-gp.ts`** (Node) : fit Gaussian Process hyperparams par route sur CPU. Utilise `ml-matrix` + L-BFGS. Sauve dans `model_params` Supabase.

15. **`scripts/train/02-fit-hmm.ts`** (Node) : Baum-Welch pour HMM 6 états par route (ou global si route a peu de data). Sauve transitions + émissions.

16. **`scripts/train/03-fit-qrf.ts`** (Node) : Quantile Regression Forest via `ml-random-forest` + post-processing quantile. 100 arbres, profondeur 10.

17. **`scripts/train/04-train-lstm.py`** (Python CPU) : LSTM 2 couches × 64 hidden avec loss pinball multi-quantile. Training batch 256, 30 epochs. Dataset = BTS + Kaggle + scraped + synthetic. Export ONNX vers `models/lstm-quantile.onnx`.

18. **`scripts/train/05-train-vae.py`** : β-VAE séquences prix pour anomaly detection. 20 epochs. Export ONNX.

19. **`scripts/train/06-train-maml.py`** : meta-learning sur 500 routes synthétiques avec Reptile (moins coûteux que MAML). Permet few-shot adaptation à nouvelle route. Export ONNX.

20. **`scripts/train/07-train-cql.py`** : CQL offline RL sur simulateur (100k épisodes). Plus léger que SAC/PPO. Export policy ONNX.

21. **`scripts/train/08-fit-ensemble.ts`** : Super Learner CV time-series split. Combine outputs de tous les level-0 models → poids optimaux via NNLS.

22. **`scripts/train/09-validate.ts`** : walk-forward backtest sur hold-out 30j réel scraped + 30j synthetic. Génère rapport markdown complet avec métriques par route, par bucket TTD, par régime HMM.

23. **Commande orchestrateur finale** : `npm run train:all` qui exécute 14-22 en séquence. Temps total attendu : 4-8h sur Mac M1/M2, 8-16h sur Intel.

### Bloc E — Infrastructure gratuite

24. **Setup `.env.local.example`** avec toutes les variables nécessaires documentées :
    ```
    KIWI_API_KEY=
    AMADEUS_CLIENT_ID=
    AMADEUS_CLIENT_SECRET=
    RAPIDAPI_KEY=
    TRAVELPAYOUTS_TOKEN=
    SCRAPER_SECRET=
    SUPABASE_URL=
    SUPABASE_SERVICE_ROLE_KEY=
    ```

25. **`docs/SETUP_FREE_APIS.md`** : guide pas-à-pas avec screenshots textuels pour créer chaque compte gratuit et récupérer les clés API. Inclut les quotas et les limitations.

26. **Migrations Supabase** : créer tables manquantes (`price_samples`, `training_data_external`, `scraper_runs`, `model_params`, `model_runs`) si pas déjà présentes. Indexes sur `(route_id, ttd, fetched_at)`.

27. **GitHub Actions workflow** : `.github/workflows/scraper.yml` (cron toutes les 4h) + `.github/workflows/weekly-retrain.yml` (hebdomadaire, re-fit GP/HMM automatique avec nouvelles données).

## 3) Ordre d'exécution

Utilise TodoWrite. Structure en 7 phases :

**Phase 1 — Setup infra** (1 subagent Plan en parallèle de la lecture des fichiers existants)
- Vérifie V7 existe dans `lib/agent/v7/`
- Audit tables Supabase existantes
- Crée migrations manquantes
- Documente prérequis utilisateur

**Phase 2 — Scraper** (3 subagents parallèles)
- Subagent S2-1 : Bloc A items 1-3 (routes, rotator, core)
- Subagent S2-2 : Bloc A items 4-5 (endpoint, workflow)
- Subagent S2-3 : Bloc A item 6 + monitoring dashboard

**Phase 3 — Ingestion externe** (3 parallèles)
- Subagent S3-1 : BTS download + normalize
- Subagent S3-2 : Kaggle download (nécessite kaggle CLI)
- Subagent S3-3 : HuggingFace + normalize-external

**Phase 4 — Simulateur & features** (2 parallèles)
- Subagent S4-1 : simulator.py
- Subagent S4-2 : feature-engineering.py

**Phase 5 — Training scripts** (implémentation parallèle par paires compatibles)
- Parallèle : GP + HMM + QRF (Node)
- Parallèle : LSTM + VAE (Python)
- Parallèle : MAML + CQL (Python)
- Séquentiel : Ensemble + Validate (dépend des précédents)

**Phase 6 — Infrastructure**
- Setup env example
- Documentation SETUP_FREE_APIS.md
- GitHub Actions workflows

**Phase 7 — Vérification end-to-end**
- `npm run build && npm run typecheck` → zéro erreur
- Test local scraper avec API keys mockées → 1 requête réussit
- Test `npm run bootstrap:data` sur sample → données insérées
- Test `npm run train:all` avec dataset réduit (10 routes × 100 samples) → tous scripts passent sans crash
- Génère `docs/free-training-playbook.md` : guide d'utilisation complet pour l'utilisateur

## 4) Documentation utilisateur (OBLIGATOIRE)

Crée `docs/free-training-playbook.md` qui explique en français, étape par étape :

1. Comment créer les 5 comptes API gratuits (avec liens exacts, screenshots textuels, temps estimé par compte)
2. Où coller les clés API (dans `.env.local` localement + dans Vercel env + dans GitHub repo secrets)
3. Comment activer le scraper GitHub Actions (instructions Settings → Actions → Enable)
4. Comment monitorer l'accumulation de données (`/admin/scraper` + SQL dans Supabase)
5. Comment lancer le bootstrap public data (`npm run bootstrap:data`)
6. Quand lancer le training (après 6-8 semaines + checklist volume données minimum)
7. Comment interpréter le rapport de training
8. Comment passer en shadow mode puis bascule prod

## 5) Guardrails

- Pas de dep payante, pas de service cloud payant
- Pas de push direct sur prod sans tests verts
- Tous les secrets API dans `.env.local` jamais commitée, documentés dans `.env.example`
- Kaggle CLI : si l'utilisateur n'a pas `~/.kaggle/kaggle.json`, skip gracieux avec message clair "config manquante, voici comment faire" — ne crash pas
- Python venv local dans `.venv-train/` ajouté au `.gitignore`
- Modèles ONNX entraînés dans `models/` ajoutés au `.gitignore` (sauf versions release dans un dossier séparé)
- Pas de data PII scraped ou stockée
- Respecter les ToS des APIs gratuites : pas de spam, rate limiting strict

## 6) Critères de succès

- Scraper déployé et run GitHub Actions réussi (1ère exécution verte)
- Au moins 500 price samples insérés après 48h de scraping
- `npm run bootstrap:data` insère ≥ 100k lignes depuis BTS + Kaggle
- `npm run train:all` sur dataset réduit (smoke test) passe en < 30 min
- Rapport de validation généré avec capture ≥ 70 % sur fixtures synthétiques (on atteindra Palier 2 plus tard avec vraies données)
- `docs/free-training-playbook.md` complet et actionnable

## 7) Livrables finaux

Quand tout est vert, présente-moi :
1. Liste des commits atomiques créés (5-10 max)
2. Screenshot du dashboard `/admin/scraper` (via preview_start + screenshot)
3. Le `docs/free-training-playbook.md` avec les étapes exactes à suivre côté utilisateur
4. Checklist des comptes à créer et ordre recommandé
5. Estimation temps utilisateur : combien de minutes pour activer le tout (création comptes + config clés + push)

**Démarre immédiatement par Phase 1. GO.**

## FIN DU PROMPT
