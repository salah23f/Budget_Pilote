# V7A_LGBM — Modèle central V7a

## Target décisionnelle — changement majeur

V7a n'apprend plus le prix courant. Il apprend des quantités **directement utiles à la décision**.

### Target A — régression quantile sur le gain futur

```
y_A = min(p_{t+1..t+k(ttd)}) − p_t
```

Fenêtre adaptative `k(ttd)` :

| TTD courant | `k` |
|---|---|
| ≤ 7 | `min(TTD, 3)` |
| 8–21 | 7 |
| 22–60 | 14 |
| > 60 | 30 |

**Interprétation** :
- `y_A < 0` : le prix baissera → attendre est rentable
- `y_A ≈ 0` : aucun gain d'attente
- `y_A > 0` : le prix montera → acheter maintenant

Le modèle prédit `q10`, `q50`, `q90` de `y_A`. La règle de stopping devient :
```
BUY_NOW ssi  q50 + c_α ≥ 0     (on n'attend aucun gain)
AUTO_BUY ssi q90 + c_α ≥ 0     (même le pire cas confirme)
```

### Target B — classificateur binaire de drop

```
y_B = 1[ ∃ p' ∈ fenêtre tel que p' ≤ p_t × 0.90 ]
```

Classif binaire LGBM + isotonic calibration sur `cal` → `drop_proba_calibrated`.  
Sert exclusivement à l'alerting.

## Pourquoi deux targets

- **A seule** : permet l'achat optimal (continu) mais binarise mal pour l'UI d'alerte.
- **B seule** : donne une belle proba d'alerte mais n'est pas assez granulaire pour le buy timing.
- **A + B** : chacune est spécialisée dans son métier produit.

## Architecture

```
Target A : LGBMRegressor objective="quantile", alpha ∈ {0.10, 0.50, 0.90}
Target B : LGBMClassifier objective="binary"
```

Hyperparamètres identiques (n_estimators=800, num_leaves=63, early_stop=50 sur val).

## Ce qui change par rapport au V7a précédent

| Élément | Avant | Après |
|---|---|---|
| Target LGBM | `price_usd` | `target_future_gain` + `target_future_drop` |
| MAE q50 attendu | ~3 USD (trivial) | 20-50 USD (réaliste pour forecasting) |
| `conformal_lower` | `q50 − c_α ≈ price − 5 USD` | `q50_gain − c_α` (vrai signal) |
| Règle BUY | `price ≤ conformal_lower` (jamais déclenché) | `q50_gain + c_α ≥ 0` (sens décisionnel) |
| Scores alerting | Conformal lower hit (mesurait le bruit) | `drop_proba_calibrated` (vrai signal) |

## Validation attendue

Sur `val` :
- `coverage_10_90(gain) ≈ 0.80` (intervalle [q10, q90] du gain couvre 80 %)
- `brier(drop_proba) < 0.20`, `ece_calibrated < 0.05`

Sur `cal` :
- Coverage conformelle Mondrian par α = 1 − α (± 2 pp) sur gain
- `buy_trigger_rate` (% cal rows où `q50_gain + c_α ≥ 0`) doit être dans [0.10, 0.70] selon régime — hors de cette fourchette → policy mal calibrée

## Commande

```bash
python3 scripts/train/v7a/build_target.py     # AVANT lgbm
python3 scripts/train/v7a/lgbm_quantile.py
```

Artefacts :
- `data/models_v7a_<tag>/lgbm_q{10,50,90}.pkl`
- `data/models_v7a_<tag>/lgbm_drop.pkl`
- `data/models_v7a_<tag>/lgbm_{oof_train,val,cal}.parquet`
- `reports/v7a_lgbm_metrics_<tag>.json`
