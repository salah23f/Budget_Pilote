# V7A_DATASET — Dataset V7a propre

## Source principale autorisée

**Kaggle `dilwong/flightprices`**
- US domestic, 2022-04 → 2022-10 (extensions en 2023 selon versions).
- ~5M observations, colonnes utiles :
  - `searchDate` → `fetched_at` (timestamp d'observation réel)
  - `flightDate` → `depart_date`
  - `startingAirport` → `origin`
  - `destinationAirport` → `destination`
  - `totalFare` → `price_usd`
- TTD réel (`searchDate` → `flightDate`).
- **Seul dataset du repo** qui préserve un vrai horodatage d'observation.

## Sources SECONDAIRES (features uniquement, jamais target)

| Source | Usage V7a |
|---|---|
| BTS DB1B (`real_aggregated_fares` trimestriel) | Feature statique `route_mean_usd_quarter` si ≥ 1000 obs/route-quarter. Pas comme target. |
| BTS T-2 (`real_features`) | Contexte demande : load factor mensuel par carrier. |
| OpenSky (`real_features`) | Flight frequency 7 jours. |
| FX rates (Frankfurter) | Non utilisé en V7a (données US). Conservé pour V7b. |

## Sources EXCLUES

| Source | Raison |
|---|---|
| BTS T-100 | `avg_fare_usd = 50 + dist·0.12` (reconstruit par régression, flag `bts-t100-synthetic-regression` → filtré) |
| Expedia ICDM 2013 | Données HÔTELS, `origin='EXP'`, contamination |
| HuggingFace auto-discovery | Volume <1k lignes, `year=2023 q=1` hardcodé |
| Wayback Machine | Regex `$XX` bruitée, qualité 50 auto-déclarée |
| Kaggle non-dilwong | Pas de TTD réel, `fetched_at = new Date()` écrasé |

## Schéma `data/ml_cache/v7a_clean.parquet`

| Colonne | Type | Description |
|---|---|---|
| `route` | string | `ORIGIN-DEST` (3+3 lettres IATA) |
| `origin` | string(3) | IATA majuscule |
| `destination` | string(3) | IATA majuscule |
| `fetched_at` | datetime64[ns, UTC] | Timestamp d'observation (pas `new Date()`) |
| `depart_date` | datetime64[ns, UTC] | Date de départ prévue |
| `ttd_days` | float32 | `(depart_date - fetched_at).days`, clampé [1, 365] |
| `price_usd` | float64 | Prix observé en USD |
| `airline` | string | Compagnie (peut être `Unknown`) |
| `stops` | int | 0 si direct, sinon correspondances connues |
| `source` | string | Ex: `kaggle/dilwong/flightprices` |
| `quality` | int | 100 si horodatage préservé, 50 sinon (on filtre ≥100) |

## Filtrage

Appliqué dans `scripts/train/v7a/build_dataset.py:clean()` :

- `origin` et `destination` exactement 3 caractères, majuscules.
- `price_usd ∈ [20, 5000]` USD.
- `fetched_at` et `depart_date` parseables, `fetched_at ≤ depart_date`.
- `ttd_days ∈ [1, 365]`.
- `quality ≥ 100`.
- Déduplication sur `(route, fetched_at, depart_date, price_usd)`.

## Volumes attendus (indicatifs dilwong)

Deux variantes sont produites via `fetch_dilwong.py` :

| Mode | `V7A_TAG` | `SAMPLE_EVERY` | Rows bruts | Rows finaux | Parquet | Usage |
|---|---|---|---|---|---|---|
| Local smoke test | `local` | `25` (défaut) | ~82 M | ~2-3 M | ~300-500 MB | MacBook 8 GB |
| Modal full-data | `modal` | `1` | ~82 M | ~70-80 M | ~3-5 GB | Container 32 GB |

- Routes uniques : **~2 000**.
- Période : 6 mois (2022-04 → 2022-10).
- `p05`/`p50`/`p95` price : ~70 / ~280 / ~900 USD (à confirmer empiriquement).
- Le même script traite les deux modes via `V7A_SAMPLE_EVERY` en env var.

## Sous-échantillonnage (scripts/train/v7a/fetch_dilwong.py)

Le CSV brut fait **~82 millions de lignes** (~5.5 GB compressé). On ne peut
pas le tenir en RAM sur un MacBook Air 8 GB. Le script `fetch_dilwong.py`
applique un **systematic sampling reproductible** pendant le streaming.

### Paramètres

- `SAMPLE_EVERY = 25` — garde 1 ligne sur 25 → ~3.3M lignes avant
  filtrage/dedup, ~2.5-3M lignes finales.
- `SEED = 42` — seed numpy pour l'offset du systematic sampling.
- `offset = np.random.default_rng(SEED).integers(0, SAMPLE_EVERY)` — point
  d'entrée du peigne (évite un biais systématique sur la position 0).

### Mécanisme

Pour chaque ligne du CSV brut, on calcule son **index global absolu** `i`
(commence à 0 et incrémente à travers les chunks). On garde la ligne si :

```
i % SAMPLE_EVERY == offset
```

Chunk par chunk, ça se traduit par :
```python
first_local = (offset - global_idx) % SAMPLE_EVERY
sampled_chunk = raw_chunk.iloc[first_local::SAMPLE_EVERY]
global_idx += len(raw_chunk)
```

Propriétés :
- **Reproductible** : même `SEED` → même échantillon, exactement.
- **Uniforme temporellement** : le CSV dilwong est ordonné par `searchDate`,
  donc 1/25 lignes uniformément équivaut à 1/25 temporellement.
- **Pas de biais de position** : l'offset initial est tiré du RNG, pas 0.
- **Zéro dépendance à un dict en RAM** (contrairement à un reservoir sampling
  par route qui exige de retenir un compteur).

### Validation de représentativité

`fetch_dilwong.py` calcule des stats cumulatives **avant** (chunk entier
cleaned) et **après** (chunk sampled cleaned) dans un seul passage sur le
CSV. Métriques comparées :

| Axe | Comparaison |
|---|---|
| Distribution mensuelle des dates | proportion par mois `YYYY-MM` |
| TTD buckets | 0-7 / 8-21 / 22-60 / 61+ |
| Prix buckets | 0-100 / 100-200 / ... / 800-1000 / 1000+ |
| Top 20 routes | retention ratio par route |
| Volume global | ratio `n_after / n_before` vs `1/SAMPLE_EVERY` attendu |

La distance L1 entre les distributions (before vs after) est reportée dans
`reports/v7a_dataset_sampling_report.json`. **Critère de validité** :

- L1 ≤ 0.03 sur chaque axe (date / TTD / prix) = distributions préservées
  à ±3 points de pourcentage cumulés.
- Ratio effectif vs `1/25 = 0.04` dans une fourchette ±0.5 pp.
- Top-20 routes ont toutes au moins 1 obs dans l'échantillon (retention
  min > 0).

Le champ `comparison.verdict.representative` dans le rapport est `true`
quand ces critères passent.

### Si on veut changer le sampling

- **Plus dense** (plus de lignes) : réduire `SAMPLE_EVERY` (attention RAM).
- **Stratifié par route** : remplacer le systematic par un reservoir
  sampling per-route (complexifie le code, 1 dict de ~2k compteurs à
  maintenir). Recommandé seulement si une route rare est sous-représentée
  dans le rapport actuel.
- **Stratifié temporellement** : si la représentation mensuelle est
  déséquilibrée, partitionner par mois et sampler K' lignes par mois.

### Sortie du script

Les paths sont taggés par `V7A_TAG` (défaut `local`) :

- `data/ml_cache/v7a_clean_<tag>.parquet` — dataset propre final.
- `data/ml_cache/v7a_clean_<tag>.manifest.json` — git sha, data hash,
  rows_scanned, rows_final, bornes dates, quantiles prix, seed, sample_every.
- `reports/v7a_dataset_sampling_report_<tag>.json` — before vs after + verdict.

En mode Modal, les chemins vivent sur le Volume (`/vol/data/...`, `/vol/reports/...`).
Les downloader en local via :
```bash
modal volume get flyeas-v7a /data/ml_cache/v7a_clean_modal.parquet data/ml_cache/
modal volume get flyeas-v7a /reports/v7a_dataset_sampling_report_modal.json reports/
```

### Méthode de construction — Modal full-data

`scripts/cloud/v7a/build_dataset_modal.py` tourne dans un container Modal
**CPU 32 GB** avec :

1. Secret Modal `kaggle-creds` (KAGGLE_USERNAME + KAGGLE_KEY) injecté en env.
2. Volume `flyeas-v7a` monté sur `/vol`.
3. Exécution de `fetch_dilwong.py` avec `V7A_SAMPLE_EVERY=1` → zéro
   sous-échantillonnage.
4. Écrit `/vol/data/ml_cache/v7a_clean_modal.parquet`.
5. `volume.commit()` pour persister.

Commande :
```bash
modal run scripts/cloud/v7a/build_dataset_modal.py
# ou avec un sous-sampling moins agressif (pour itérations plus rapides) :
modal run scripts/cloud/v7a/build_dataset_modal.py --sample-every 5
```

### Vérification de représentativité du subset local vs full Modal

`scripts/train/v7a/compare_local_vs_modal.py` lit les deux rapports de
sampling et produit :

- Ratio `n_rows_modal / n_rows_local` → devrait être ≈ 25 si `SAMPLE_EVERY_local=25`
  et `SAMPLE_EVERY_modal=1`.
- Distances L1 sur distributions dates/TTD/prix → déjà reportées dans chaque
  `dataset_sampling_report_*.json`.
- Les deux `verdict.representative` doivent être `true` pour que la
  comparaison local vs Modal ait du sens.

### Limites du sampling systematic 1/K (local uniquement)

- **Si une route rare** (moins de 25 obs dans le CSV brut) peut disparaître
  complètement de l'échantillon 1/25. Le rapport liste les routes retenues
  (top 20) avec retention ratio — toute route tombant à 0 sera signalée.
- **Si la densité temporelle varie fortement** au sein du CSV (ex : gros
  pic en juillet), le sampling 1/25 préserve proportionnellement cette
  densité. Ce n'est pas un biais tant que l'analyse est aussi faite au
  prorata. L'audit leakage ne déclenche PAS sur cette propriété.

## Limites connues

1. **Géographie** : US uniquement. Tout modèle V7a doit être annoté "US domestic" dans l'UI tant que d'autres sources temporelles n'existent pas.
2. **Période** : 2022-2023 — marché post-COVID. Décisions futures doivent être monitorées pour drift.
3. **Pas de cabin class** fiable dans dilwong. Le filtre cabin est donc désactivé en V7a.
4. **Pas de bundles** (vol+hotel+voiture) — V7a est mono-produit vol.

## Manifest

`build_dataset.py` écrit `data/ml_cache/v7a_clean.manifest.json` avec :
- `rows`, `routes`, `min_date`, `max_date`, `price_p05/p50/p95`
- `file_sha256` pour traçabilité
- `git_sha`, `ts_utc`, `v7a_version`

Le manifest est référencé dans tous les rapports downstream.

## Commande

```bash
# Mode recommandé (Supabase déjà ingéré) :
python3 scripts/train/v7a/build_dataset.py --mode supabase

# Mode parquet (si 00-export-to-local a tourné) :
python3 scripts/train/v7a/build_dataset.py --mode parquet

# Mode CSV direct (POC rapide sans DB) :
python3 scripts/train/v7a/build_dataset.py --mode kaggle-raw --kaggle-csv data/kaggle/dilwong_flightprices/itineraries.csv
```
