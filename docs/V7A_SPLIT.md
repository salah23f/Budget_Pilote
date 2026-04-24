# V7A_SPLIT — Split temporel 4-blocs

## Philosophie

Il faut **quatre blocs**, pas trois. Le bloc `cal` ne sert *qu'à* la calibration conformelle, ce qui garantit que les intervalles ne sont jamais calibrés sur les mêmes rows qui ont entraîné ou tuné les modèles.

## Règles

1. Ordre chronologique strict par `fetched_at` ascendant.
2. Pas de random. Pas de stratification. Pas de fold aléatoire inter-bloc.
3. Les fractions (par défaut) :
   - `train` 70 %
   - `val` 15 %
   - `cal` 10 %  ← **CONFORMAL UNIQUEMENT**
   - `test` 5 %  ← **FROZEN**
4. Les frontières exactes (`cutoffs_utc`) sont écrites dans `data/splits_v7a/split_meta.json` pour traçabilité.

## Règles d'usage par bloc

| Bloc | Usages autorisés | Usages interdits |
|---|---|---|
| `train` | Fit modèles, OOF k-fold temporel, features maps (popularity, mean, std) | Lecture par backtest |
| `val` | Early stopping, tuning hyperparams, isotonic calibration | Tout ce qui aurait besoin d'être indépendant de l'entraînement |
| `cal` | **Uniquement** `scripts/train/v7a/calibrate.py` | Tout le reste |
| `test` | **Uniquement** `scripts/train/v7a/backtest.py` | Tout le reste (y compris inspection manuelle) |

## Garde-fou en code

`scripts/train/v7a/_env.py:assert_test_split_not_read()` est appelé en tête de `backtest.py`. Tout autre script V7a qui tente de lire `data/splits_v7a/test.parquet` ou `data/features_v7a/test.parquet` doit être rejeté par l'audit leakage.

`scripts/train/v7a/audit_leakage.py:check_forbidden_test_reads()` scanne tous les fichiers `scripts/train/v7a/*.py` à la recherche de références au split `test` et émet un leak critique si trouvé ailleurs que `backtest.py`.

## Drift saisonnier

Si l'écart de prix médian entre `train` et `test` est > 15 %, ajouter un flag `drift_warning` dans le rapport de backtest. V7a ne tente pas de corriger ce drift — un V7b avec feature saison/macro est nécessaire.

## Commande

```bash
python3 scripts/train/v7a/split.py
# → data/splits_v7a/{train,val,cal,test}.parquet + split_meta.json + _guard_test.txt
```
