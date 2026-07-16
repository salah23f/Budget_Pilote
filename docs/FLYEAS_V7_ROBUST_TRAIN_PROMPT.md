# PROMPT V7 ROBUSTE — Version production-ready avec gestion d'échecs
# À coller dans Claude Code terminal session fresh

---

## DÉBUT DU PROMPT (copie tout ce qui suit jusqu'à FIN)

MISSION : Entraîner V7 de Flyeas sur données réelles historiques. Durée 48-72h.
Cette session doit être ROBUSTE — chaque étape valide ses prérequis et peut
reprendre après échec partiel.

Repo : /Users/salahfarhat/Desktop/BudgetPilot_Live

## ⚠️ CONTRAINTES ABSOLUES

1. Max 2 bash commands en flight simultanés
2. Pas de background (&), pas d'Agent tool pour les commandes bash longues
3. Commit atomique toutes les 30-60 min, PUSH après chaque commit
4. Si commande > 15 min sans output → kill et décompose
5. TodoWrite immédiat avec 30 tâches. Update en temps réel.
6. **Checkpoint de validation** à chaque fin de phase (assert + log)
7. **Graceful degradation** : si sous-étape X échoue 3 fois, skip-la et note dans le rapport, continue le reste

## PHASE 0 — Audit 5 min (OBLIGATOIRE, ne skip pas)

Lance en parallèle 3 subagents Explore pour auditer l'état actuel :

Subagent A (Explore) :
"Lis scripts/ingest/bts-db1b.ts et scripts/ingest/bts-t100.ts. Dis-moi en ≤200 mots : ces scripts téléchargent-ils automatiquement (autonomous) ou attendent-ils un CSV en argument (stub) ? Quelles URLs utilisent-ils ? Quel schema INSERT Supabase ? Y a-t-il des bugs évidents ?"

Subagent B (Explore) :
"Lis scripts/ingest/kaggle.ts, scripts/ingest/huggingface.ts, scripts/ingest/quality-gate.ts, scripts/ingest/_env.ts (si existe). Même questions : autonomes ? bugs ? chargent-ils .env.local correctement ?"

Subagent C (Explore) :
"Liste tous les fichiers dans scripts/train/ avec une ligne de statut par fichier :
- Nom de fichier
- Existe et prêt à tourner (OK)
- Stub/placeholder (STUB)
- A un bug bloquant identifié (BUG: description)
Focus sur 01-split.py, 02-features.py, 03-fit-gp, 04-fit-hmm, 05-fit-qrf, 06-train-lstm.py, 07-train-tft.py, 08-train-deepar.py, 09-train-vae.py, 10-train-maml.py, 11-train-cql.py, 12-fit-ensemble, 13-validate."

Avec les résultats des 3 subagents, crée une TodoWrite avec 30 tâches granulaires COUVRANT uniquement les problèmes identifiés. Pas de tâches "hypothétiques".

Ensuite, lance requête Supabase pour vérifier l'état actuel des tables :
```sql
SELECT 'real_price_samples' as t, COUNT(*) FROM real_price_samples
UNION ALL SELECT 'real_aggregated_fares', COUNT(*) FROM real_aggregated_fares
UNION ALL SELECT 'ingestion_runs', COUNT(*) FROM ingestion_runs;
```

Affiche les counts. Si real_price_samples + real_aggregated_fares > 1M déjà → phase ingestion déjà partiellement faite, adapte le plan.

Commit : "docs(v7): audit initial phase 0 — <résumé 1 ligne>"

## PHASE 1 — Fix ingesters (itératif, un par un avec test)

Pour CHAQUE ingester problématique identifié en Phase 0, suis ce cycle :

1. Réécris le script pour auto-download (pas d'argument CLI)
2. Test isolé :
   ```
   set -a; source .env.local; set +a
   source .venv-train/bin/activate
   npx tsx scripts/ingest/<name>.ts 2>&1 | tee /tmp/<name>.log | head -30
   ```
3. Attends la fin (max 30 min). Si OK → commit + push.
4. Si échoue : lis l'erreur, 1 retry max avec fix. Si 2e échec → skip, note dans docs/v7-ingestion-blockers.md, continue avec l'ingester suivant.

Install deps UNE SEULE FOIS au début de Phase 1 :
```
npm install unzipper csv-parse axios p-limit cheerio
```

### Priorité des ingesters (ordre à suivre)
1. bts-db1b (le + gros volume potentiel)
2. bts-t100 (gros volume agrégé)
3. kaggle (via CLI, fiable)
4. expedia-icdm (si accessible)
5. huggingface (best effort)
6. bts-t2, opensky, wayback (nice-to-have, skip si bloqué)
7. quality-gate (toujours en dernier)

### Pour bts-db1b spécifiquement
URL pattern : https://transtats.bts.gov/PREZIP/Origin_and_Destination_Survey_DB1BMarket_YYYY_Q.zip
Itère YYYY=2023..2024, Q=1..4 (8 fichiers, ~4 GB total)
Stream unzip + csv-parse + batch insert 5000
Source quality = 85, source = 'bts-db1b'
Log toutes les 10k rows

### Pour kaggle spécifiquement
Utilise child_process.execFile (pas exec — sécurité)
Datasets : nikhilmittal/flight-fare-prediction-mh, usdot/flight-delays, dilwong/flightprices (try/catch)
Source quality = 80

### Règle de graceful degradation
Si après Phase 1 on a au moins 2 ingesters fonctionnels → continuer Phase 2.
Sinon → stop et envoie moi un rapport d'erreurs.

## PHASE 2 — Ingestion (4-8h wall time)

Crée scripts/ingest/_run-all.sh :
```bash
#!/bin/bash
set -e
set -a; source .env.local; set +a
source .venv-train/bin/activate
mkdir -p logs

INGESTERS=(bts-db1b bts-t100 kaggle quality-gate)
# Ajoute expedia-icdm, huggingface, bts-t2, opensky, wayback si validés en Phase 1

for name in "${INGESTERS[@]}"; do
  echo "==== Running $name at $(date) ===="
  if npx tsx "scripts/ingest/${name}.ts" 2>&1 | tee "logs/ingest-${name}-$(date +%Y%m%d-%H%M).log"; then
    echo "✅ $name done"
  else
    echo "⚠️ $name failed (exit $?), continuing"
  fi
done

echo "==== ALL INGESTERS DONE at $(date) ===="
```

Rend exécutable : `chmod +x scripts/ingest/_run-all.sh`

Lance en FOREGROUND (1 seul bash call, laisse run) :
```
bash scripts/ingest/_run-all.sh
```

Si ça prend > 10 min sans output sur stderr → tu as un problème de buffering, vérifie avec `tail logs/ingest-*.log`.

### Checkpoint de validation Phase 2 (OBLIGATOIRE)

Après la fin, lance cette requête via Supabase client TS :
```sql
SELECT source, COUNT(*) as n
FROM (
  SELECT source FROM real_price_samples
  UNION ALL
  SELECT source FROM real_aggregated_fares
) sub
GROUP BY source
ORDER BY n DESC;
```

Affiche les résultats.

**Décision** :
- Si total rows ≥ 5M → passe à Phase 3
- Si total rows ∈ [100k, 5M] → continue mais note que training sera "limited data". Document dans le rapport final.
- Si total rows < 100k → STOP. Rapport d'erreurs dans docs/v7-ingestion-failed.md. Ne passe PAS à training (training sur 100k rows serait faussement confiant).

Commit : "feat(ingest): run complete — XXM rows ingested"

## PHASE 3 — Feature engineering (1-2h)

1. Vérifie que scripts/train/02-features.py charge .env.local (via scripts/train/_env.py)
2. Lance :
   ```
   source .venv-train/bin/activate
   python scripts/train/02-features.py 2>&1 | tee logs/features-$(date +%Y%m%d-%H%M).log
   ```
3. Vérifie que les parquet files sont créés :
   ```
   ls -lh data/features/
   ```
   Attendu : train.parquet, val.parquet, test.parquet avec tailles > 10 MB chacun.

### Checkpoint validation Phase 3
- Si train.parquet n'existe pas → debug 02-features.py, retry 1 fois, si échec → STOP
- Si train.parquet < 5 MB → données insuffisantes, warning dans rapport

4. Lance audit leakage :
   ```
   python scripts/train/audit-leakage.py
   ```
5. Si audit signale leakage → STOP, fix les features concernées
6. Commit : "feat(train): features built, no leakage, ready for training"

## PHASE 4 — Training (8-20h, séquentiel avec fallback)

Pour CHAQUE script training, suis ce pattern :

```bash
# Si fichier existe et n'est pas un stub
if [ -f scripts/train/<script>.py ] && [ $(wc -l < scripts/train/<script>.py) -gt 50 ]; then
  python scripts/train/<script>.py 2>&1 | tee logs/train-<name>-$(date +%Y%m%d-%H%M).log
  if [ $? -eq 0 ]; then
    git add -A && git commit -m "feat(train): <name> fitted on real data" && git push
  else
    echo "⚠️ <name> training failed, skipping"
    # Note in limitations
  fi
fi
```

### Ordre (commit après chaque succès)

1. 03-fit-gp (rapide, ~30 min)
2. 04-fit-hmm (rapide, ~20 min)
3. 05-fit-qrf (~1h)
4. 06-train-lstm (~2-4h, plus lourd)
5. 09-train-vae (~1-2h)
6. 10-train-maml (~1-2h)
7. 11-train-cql (~2-4h, le + lourd RL)
8. 12-fit-ensemble (~30 min)
9. 13-validate (~30 min)

### Règles
- Skip gracieux si script absent ou stub (< 50 lignes)
- Skip gracieux si training crash après 1 retry
- Continue avec les suivants même si un échoue
- Note les échecs dans docs/v7-training-partial.md

### Checkpoint validation Phase 4
Après toute la phase :
```
ls -lh models/
```
Attendu : plusieurs fichiers .onnx ou .pkl. Au minimum GP + QRF + Ensemble.

Si modèles ensemble (12-fit-ensemble) manquant → STOP, c'est bloquant pour validation.

## PHASE 5 — Validation + rapport final (30 min)

1. Lance :
   ```
   npx tsx scripts/train/13-validate.ts 2>&1 | tee logs/validate-$(date +%Y%m%d-%H%M).log
   ```
2. Si le script génère automatiquement docs/flyeas-v7-real-training-report.md → vérifie son contenu
3. Sinon, génère manuellement le rapport avec :
   - Section "Data sources" : table des rows par source, dates range
   - Section "Models trained" : quels modèles sont fit, lesquels ont échoué
   - Section "Validation metrics" sur test hold-out (capture efficiency médiane, avg vs floor, coverage 90%)
   - Section "V7 vs V1 comparison" sur mêmes missions
   - Section "Known limitations" : scripts qui ont échoué, données insuffisantes sur certaines sources
   - Section "Next steps" : recommandations pour améliorer

4. Commit : "docs(v7): final training report"

## PHASE 6 — Deploy shadow (10 min, seulement si Phase 5 OK)

**Prérequis** : rapport contient `capture_efficiency_median >= 60` (seuil minimal acceptable).

Si prérequis rempli :
```
vercel env add FLYEAS_ALGO_VERSION production
# value: shadow
vercel --prod
```

Commit : "feat(v7): shadow deployment active"

Si prérequis non rempli → ne deploy pas, note dans le rapport qu'il faut plus de données ou debug avant deployment.

## PHASE 7 — Récap utilisateur

Affiche un markdown clair avec :
- État des 6 phases (✅ completed, ⚠️ partial, ❌ failed)
- Volumes data par source
- Métriques V7 vs V1
- Top 3 problèmes rencontrés + comment ils ont été gérés
- Liste des 15-25 commits atomiques faits
- Prochaines actions pour l'utilisateur

## 🎯 CRITÈRES DE SUCCÈS

### Minimum acceptable (graceful degradation possible)
- ≥ 1M rows réelles ingérées
- ≥ 3 modèles level-0 fit (GP, QRF, HMM minimum)
- Rapport final généré
- 10+ commits atomiques

### Cible idéale
- ≥ 10M rows
- Tous les 11 modèles fit
- Capture efficiency médiane ≥ 75%
- Deploy shadow actif

## 🚫 Règles qui éviteront le blocage

1. Jamais plus de 2 bash commands en flight
2. Si une commande dépasse 20 min sans progress → kill
3. Entre chaque phase : `git status` + `git log --oneline -3` pour vérifier état
4. Checkpoint commit/push toutes les 30 min (pas plus tard)
5. Si 3+ échecs consécutifs sur une même étape → skip et continue
6. Logs structurés dans logs/ pour debug post-mortem
7. Pas de `rm -rf` ou destructive
8. TodoWrite update au moins toutes les heures

## 🏁 Démarrage

Commence MAINTENANT par Phase 0. Les 3 subagents Explore en parallèle (1 seul message, 3 tool calls).
Puis TodoWrite avec 30 tâches.
Puis Phase 1 itérative.

Tu as 48-72h wall time. Travaille sans interruption. GO.

## FIN DU PROMPT
