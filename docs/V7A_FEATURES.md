# V7A_FEATURES — Features causales V7a

Règle d'or : **aucune feature à l'instant t n'inclut d'information future**.

## Liste complète et statut

| Feature | Formule | Causale | Utilité attendue | Statut |
|---|---|---|---|---|
| `feat_dow` | `fetched_at.dayofweek` | ✅ | Cycle hebdo | garder |
| `feat_month` | `fetched_at.month` | ✅ | Saisonnalité | garder |
| `feat_is_weekend` | `feat_dow >= 5` | ✅ | | garder |
| `feat_doy` | `fetched_at.dayofyear` | ✅ | | garder |
| `feat_days_to_holiday` | min diff vs US holidays | ✅ | Jours fériés | garder (US only) |
| `feat_ttd_log` | `log1p(ttd_days)` | ✅ | Pression décision | garder |
| `feat_ttd_sqrt` | `sqrt(ttd_days)` | ✅ | idem | garder |
| `feat_ttd_bucket` | 0/1/2/3 selon ≤7/21/60/+ | ✅ | Segment clé | garder |
| `feat_origin_is_hub` | set membership | ✅ | Structure route | garder |
| `feat_dest_is_hub` | idem | ✅ | | garder |
| `feat_route_distance_km` | Haversine | ✅ | | garder |
| `feat_is_international` | distance > 500km | ✅ | | garder |
| `feat_roll_mean_{7,14,30}` | `price.shift(1).rolling(W).mean()` per-route | ✅ | Niveau récent | **garder (shift(1) obligatoire)** |
| `feat_roll_std_{7,14,30}` | idem `.std()` | ✅ | Volatilité récente | garder |
| `feat_roll_min_{7,14,30}` | idem `.min()` | ✅ | Ancre basse | garder |
| `feat_roll_max_{7,14,30}` | idem `.max()` | ✅ | Ancre haute | garder |
| `feat_price_vs_min_14` | `(p - roll_min_14) / roll_min_14` | ✅ | Proximité bas | garder |
| `feat_price_vs_mean_14` | `(p - roll_mean_14) / roll_mean_14` | ✅ | Position médiane | garder |
| `feat_z_14` | `(p - roll_mean_14) / roll_std_14` | ✅ | Écart-type récent | garder |
| `feat_log_return` | `log(p_t) - log(p_{t-1})` per-route | ✅ | Variation log | garder |
| `feat_realized_vol_30` | `rolling(30).std(log_return).shift(1)` | ✅ | Vol réalisée | garder |
| `feat_route_popularity` | `train.groupby(route).size()`, mappé | ✅ | Densité route | garder |
| `feat_route_competition` | `train.groupby(OD).airline.nunique()`, mappé | ✅ | | garder |
| `feat_route_mean_train` | `train.groupby(route).price.mean()`, mappé | ✅ | Ancre long-terme | garder |
| `feat_route_std_train` | idem .std() | ✅ | | garder |
| `feat_route_known` | `feat_route_popularity > 0` | ✅ | Gate ABSTAIN | garder |

## Targets décisionnelles (ajoutées par `build_target.py`)

Après `features.py`, le script `build_target.py` ajoute 4 colonnes :

| Colonne | Type | Définition |
|---|---|---|
| `target_future_min` | float32 | `min(p_{t+1..t+k(ttd)})` (USD) |
| `target_future_gain` | float32 | `target_future_min − price_usd` (cible LGBM quantile) |
| `target_future_drop` | int8/NaN | `1[ target_future_min ≤ price_usd × 0.90 ]` (cible LGBM binary) |
| `target_window_k` | int8 | Fenêtre effective appliquée (3, 7, 14 ou 30 jours) |

Construction :
- Par-split uniquement (aucun cross-split, donc aucune fuite train → val/cal/test).
- Rows en fin de split dont la fenêtre dépasserait la fin → NaN (exclues de fit/évaluation).
- Rapport de couverture : `reports/v7a_target_build_<tag>.json`.

Cf. `V7A_LGBM.md` pour l'usage.

## Ce qui change vs V7.6

1. **`shift(1)` systématique** sur toutes les rolling features (vs inclusion du présent en V7.6).
2. **Popularity/competition/mean/std calculées sur TRAIN seulement**, puis mappées sur val/cal/test. V7.6 les recalculait par split, ce qui créait une distribution différente au démarrage de chaque bloc.
3. **`feat_route_known` explicite** (flag ABSTAIN) plutôt qu'un 0 implicite.
4. **Pas de feature `realized_vol` non-shiftée**.

## Validation

- `scripts/train/v7a/audit_leakage.py:check_rolling_shift()` compare `feat_roll_mean_7` aux versions causale et naïve ; si proche de la naïve, leak critique.
- `check_target_leakage()` rejette toute feature avec `|corr(feat, price)| > 0.98`.

## Limites connues

- Pas de features macro (FX, événements sportifs, grèves, prix carburant).  
  → Ajouts candidats en V7b.
- Pas d'embedding route (TS2Vec) — reporté en V7b.
- `feat_ttd_bucket` est catégoriel mais encodé en int → OK pour LightGBM.
- `feat_days_to_holiday` est US-only — pour international, mapping à étendre.

## Commande

```bash
python3 scripts/train/v7a/features.py
# → data/features_v7a/{train,val,cal,test}.parquet
# → features_meta.json (liste des feat_*, tailles)
```
