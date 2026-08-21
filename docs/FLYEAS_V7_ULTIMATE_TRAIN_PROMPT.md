# 🚀 PROMPT ULTIME — Flyeas V7 Training Pipeline Complet
# À coller dans Claude Code terminal (fresh session recommandée)

---

## DÉBUT DU PROMPT — COPIE TOUT CE QUI SUIT JUSQU'AU `FIN DU PROMPT`

Tu es staff-level ML engineer + data engineer. Tu vas finir ENTIÈREMENT la mise en production de V7 de Flyeas : ingestion de données réelles (≥ 10M lignes), entraînement des 11 modèles V7, validation, rapport final. De A à Z. Sans intervention humaine après ce prompt.

Repo : `/Users/salahfarhat/Desktop/BudgetPilot_Live`
Stack : Next.js 14, TypeScript strict, Supabase, Node 20, Python 3.11+
Algo V7 déjà codé : `lib/agent/v7/` (13 modèles probabilistes/ML)
Scripts partiels existants : `scripts/ingest/*.ts` (stubs), `scripts/train/*.py` (partiel)
Env configuré : `.env.local` avec `SUPABASE_SERVICE_ROLE_KEY`, `RAPIDAPI_KEY`, `SCRAPER_SECRET`

## ⚠️ CONTRAINTES CRITIQUES (à lire et respecter absolument)

Une session précédente a échoué à cause de **80 background shells accumulés** qui ont paralysé le terminal. Pour éviter ça :

1. **MAX 3 bash commands en flight** à tout instant. Avant de lancer un 4e, attends qu'un des 3 finisse.
2. **PAS de `&` pour mettre en background**. Tout en foreground.
3. **PAS d'`Agent` tool pour des commandes bash longues** — `Agent` crée des shells indépendants qui s'empilent. Réserve `Agent` aux tâches de LECTURE/RECHERCHE seulement (Explore, Plan).
4. **Entre chaque bash**, lis la sortie avant de lancer le suivant.
5. **Si une commande prend > 10 min**, tue-la et décompose.
6. **Checkpoint obligatoire** tous les 5 bash : `git status` + commit si changes staged.
7. **TodoWrite dès le début** avec 25-30 tâches granulaires. Update en temps réel.
8. **Pas de `npm run` chaînés avec `&&`** au-delà de 3 étapes — fais-les séquentielles avec vérif.

## 📋 PHASES (ordre strict, checkpoint git entre chaque)

### PHASE 0 — Audit & TodoWrite (5 min)

1. Lance 3 subagents `Explore` **en parallèle** (un seul batch de tool calls) :
   - Explore A : lire `lib/agent/v7/index.ts`, `lib/agent/v7/_types.ts` — synthèse architecture V7 en ≤ 300 mots
   - Explore B : lire `scripts/ingest/*.ts` — lister chaque ingester, signaler ceux qui sont des stubs (demandent CSV path), identifier ce qui manque pour auto-download
   - Explore C : lire `scripts/train/*.py` + `scripts/train/_env.py` — vérifier que le loader dotenv marche, lister les scripts manquants

2. Avec les résultats, crée une TodoWrite avec 25-30 tâches granulaires couvrant toutes les phases qui suivent.

3. Commit + push :
   ```
   git log --oneline -1
   ```
   Vérifie qu'on est bien sur main.

### PHASE 1 — Fix les ingesters pour auto-download (2-4h)

Pour CHAQUE ingester ci-dessous, réécris-le pour qu'il télécharge automatiquement sans argument CLI. Travaille **SÉQUENTIELLEMENT** (un ingester à la fois, test, commit, passe au suivant).

**Install deps une seule fois au début** :
```bash
npm install unzipper csv-parse cheerio axios p-limit
```

**Ingester 1 — `scripts/ingest/bts-db1b.ts`**
- URL : `https://transtats.bts.gov/PREZIP/Origin_and_Destination_Survey_DB1BMarket_YYYY_Q.zip`
- Itère YYYY=2023..2024, Q=1..4 → 8 fichiers (~4 GB total)
- Stream download + unzip mémoire + csv-parse streaming
- Insert batch 5000 dans `real_aggregated_fares` (source='bts-db1b', source_quality=85)
- Log progress toutes les 10000 rows
- Retry 3x exponential backoff sur 5xx
- Commit : `feat(ingest): bts-db1b auto-download 2023-2024`

**Ingester 2 — `scripts/ingest/bts-t100.ts`**
- URL : `https://transtats.bts.gov/PREZIP/T_T100_MARKET_ALL_CARRIER.zip`
- Un seul ZIP avec toutes les années 1990-2024
- Filter 2015-2024 pendant le parsing
- Insert `real_aggregated_fares` (source='bts-t100')
- Commit atomique

**Ingester 3 — `scripts/ingest/bts-t2.ts`**
- URL : `https://transtats.bts.gov/PREZIP/T_T2_SEGMENT_ALL_CARRIER.zip`
- Segments (route+carrier+month) — pas de prix mais features contexte
- Insert dans nouvelle table `real_segment_features` si pas créée (crée la migration si manque)
- Commit atomique

**Ingester 4 — `scripts/ingest/kaggle.ts`**
- Utilise `kaggle` CLI via `child_process.execFile` (pas `exec` qui risque l'injection)
- Download 3 datasets en séquence :
  - `kaggle datasets download -d nikhilmittal/flight-fare-prediction-mh -p /tmp/kaggle/mh --unzip`
  - `kaggle datasets download -d usdot/flight-delays -p /tmp/kaggle/delays --unzip`
  - `kaggle datasets download -d dilwong/flightprices -p /tmp/kaggle/dilwong --unzip` (try/catch si indisponible)
- Parse les CSV/Excel, insert dans `real_price_samples` (source='kaggle-XXX', quality=80)
- Commit atomique

**Ingester 5 — `scripts/ingest/huggingface.ts`**
- Utilise `@huggingface/hub` ou script Python via child_process
- Cherche datasets : `hub.listDatasets({ search: 'flight prices' })`
- Pour chaque dataset compatible (a `price_usd`, `origin`, `destination`) : download + insert
- Fallback gracieux si aucun trouvé
- Commit atomique

**Ingester 6 — `scripts/ingest/opensky.ts`**
- API publique : `https://opensky-network.org/api/flights/all?begin=TIMESTAMP&end=TIMESTAMP`
- Pas de prix → insère dans `real_segment_features` (route frequency, delay)
- Rate limit : 1 req/sec
- Sample 100 jours 2023-2024 (pas besoin de tout)
- Commit atomique

**Ingester 7 — `scripts/ingest/wayback.ts`**
- Wayback Machine CDX API : `https://web.archive.org/cdx/search/cdx?url=kayak.com/flights*&output=json`
- Pour 20 routes populaires × 10 dates 2018-2024 → fetch snapshots HTML
- Parse avec `cheerio`, extrait prix
- Insert `real_price_samples` (source='wayback', quality=50)
- **Skip gracieux si parsing échoue** — ne bloque pas
- Commit atomique

**Ingester 8 — `scripts/ingest/quality-gate.ts`**
- Déjà existe — vérifie qu'il charge `.env.local` via `_env.ts`
- Dédupli + outlier Tukey + currency normalize
- Commit si modifications

**Après CHAQUE ingester fixé** :
```bash
git add -A
git commit -m "feat(ingest): <name> auto-download"
git push
```

### PHASE 2 — Lance l'ingestion réelle (4-8h wall time)

Une fois TOUS les ingesters fixés et commités :

1. Crée script `scripts/ingest/_run-all.sh` :
   ```bash
   #!/bin/bash
   set -e
   set -a; source .env.local; set +a
   source .venv-train/bin/activate

   for script in bts-db1b bts-t100 bts-t2 kaggle huggingface opensky wayback quality-gate; do
     echo ""
     echo "========================================"
     echo "Running: $script"
     echo "========================================"
     npx tsx "scripts/ingest/${script}.ts" 2>&1 | tee "logs/ingest-${script}-$(date +%Y%m%d-%H%M).log"
     echo "✅ Done: $script"
   done

   echo ""
   echo "========================================"
   echo "All ingesters done. Running SQL counts..."
   echo "========================================"
   ```
   Rend-le exécutable : `chmod +x scripts/ingest/_run-all.sh`

2. Lance-le en FOREGROUND dans un SEUL bash call :
   ```
   bash scripts/ingest/_run-all.sh
   ```
   (si ça prend > 10 min sans sortie, kill et décompose manuellement par ingester)

3. À la fin, requête Supabase via client pour afficher counts :
   ```sql
   SELECT source, COUNT(*) as n FROM real_price_samples GROUP BY source ORDER BY n DESC;
   SELECT source, COUNT(*) as n FROM real_aggregated_fares GROUP BY source ORDER BY n DESC;
   ```
   Affiche les résultats.

4. **CHECKPOINT** : si total rows cumulé < 1M, l'ingestion a majoritairement échoué. Debug ingester par ingester. Sinon continue.

5. Commit log + rapport :
   ```bash
   git add logs/ docs/
   git commit -m "feat(ingest): ingestion run complete — XXM rows"
   git push
   ```

### PHASE 3 — Feature engineering (1-2h)

1. Vérifie que `scripts/train/02-features.py` charge bien `.env.local` via `_env.py`
2. Lance :
   ```bash
   source .venv-train/bin/activate
   python scripts/train/02-features.py
   ```
3. Vérifie que les parquet files sont créés dans `data/features/` :
   - `train.parquet` (2015-2023)
   - `val.parquet` (2024 H1)
   - `test.parquet` (2024 H2)
4. Affiche schéma + nb rows par fichier
5. Lance `scripts/train/audit-leakage.py` pour vérifier absence de leakage
6. Commit : `feat(train): features built on real data, no leakage detected`

### PHASE 4 — Training des 11 modèles (8-24h wall time)

Stratégie : les modèles légers (GP, HMM, QRF) d'abord, neural après, ensemble final.

**Vague 1 (séquentiel, ~2h)** :
```bash
npm run train:gp       # ou npx tsx scripts/train/03-fit-gp.ts
npm run train:hmm      # ou npx tsx scripts/train/04-fit-hmm.ts
npm run train:qrf      # ou python scripts/train/05-fit-qrf.py
```
Commit après chaque : `feat(train): <model> fitted on real data`

**Vague 2 (séquentiel, ~4-8h)** :
```bash
python scripts/train/06-train-lstm.py
python scripts/train/07-train-tft.py
python scripts/train/08-train-deepar.py
```
Chacun exporte ONNX dans `models/`. Commit après chaque.

**Vague 3 (séquentiel, ~3-5h)** :
```bash
python scripts/train/09-train-vae.py
python scripts/train/10-train-maml.py
python scripts/train/11-train-cql.py
```
Commit après chaque.

**Ensemble + validation (30 min)** :
```bash
npx tsx scripts/train/12-fit-ensemble.ts
npx tsx scripts/train/13-validate.ts
```
Commit final : `feat(train): V7 ensemble fitted, validation complete`

### PHASE 5 — Rapport final (30 min)

1. Lis les outputs de `13-validate.ts` qui a dû générer `docs/flyeas-v7-real-training-report.md`
2. Si le rapport n'est pas généré automatiquement, écris-le manuellement avec :
   - Volume data par source (tableau)
   - Flag `real_data_only: true` confirmé
   - Métriques par modèle level-0 (MAE, CRPS, coverage)
   - Métriques ensemble final sur test 2024-H2 :
     - Capture Efficiency médiane
     - Avg vs Floor (%)
     - % missions dans fenêtre optimale
     - Coverage 90 % empirique
   - Comparaison V1 vs V7 sur test
   - Top 10 routes où V7 performe le mieux
   - Feature importance SHAP globale (si calculable)
   - Roadmap améliorations
3. Commit : `docs: V7 real training report`

### PHASE 6 — Déploiement shadow (10 min)

1. Vérifie que Vercel a bien les env vars :
   ```
   vercel env ls production
   ```
2. Active shadow mode :
   ```
   vercel env add FLYEAS_ALGO_VERSION production
   # value: shadow
   vercel env add FLYEAS_SHADOW_V7 production
   # value: true
   ```
3. Redéploie : `vercel --prod`
4. Commit message de closure : `feat(v7): release — shadow deployment active`

### PHASE 7 — Résumé final à l'utilisateur

Présente un récap en markdown clair :
- Total rows ingérées par source (tableau)
- Métriques V7 sur test hold-out
- Comparaison V1 vs V7 (amélioration en %)
- Screenshot/extrait du rapport
- Liste des commits atomiques faits
- Prochaines actions utilisateur (bascule de shadow vers v7 plein)

## 🎯 Critères de succès

- ≥ 10M rows réelles ingérées dans Supabase (idéalement 50M+)
- `real_data_only: true` dans le rapport final
- Capture Efficiency médiane ≥ 75 % sur test 2024-H2
- V7 bat V1 sur ≥ 80 % des routes test
- Zéro synthetic dans train/val/test principal
- ≥ 20 commits atomiques pushed
- Rapport final complet et lisible

## 🚫 Guardrails

- Si une étape échoue 3x, skip-la et note dans le rapport final. Ne bloque pas tout le pipeline.
- Aucun `rm -rf` ou destructive command
- Aucun secret loggé ou commité
- Commits atomiques, conventional commits
- TypeScript strict, zéro `any`, zéro `console.log` résiduel (sauf dans les scripts/ingest pour le progress)
- Python 3.11+, type hints partout où raisonnable

## 🧭 Méthodologie tool use

- **TodoWrite** au début de chaque phase pour afficher les sub-tâches
- **Subagents `Explore` en parallèle** uniquement pour recherche dans codebase (pas pour bash/training)
- **Subagents `Plan`** pour architecture decisions complexes
- **Pas de subagent pour les tâches bash longues** (ingestion, training) — fais-les en foreground dans ton propre shell
- Checkpoint commit/push tous les 30-60 min
- `git status` + `git log --oneline -5` après chaque commit pour vérifier

## 🏁 Démarrage

Commence MAINTENANT par Phase 0. Lance les 3 Explore subagents en parallèle (un seul message, 3 tool calls). Puis crée la TodoWrite. Puis Phase 1.

Tu as le droit de travailler 48-72h si nécessaire. Objectif : V7 entraîné sur réel avec rapport final et deploy shadow. GO.

## FIN DU PROMPT
