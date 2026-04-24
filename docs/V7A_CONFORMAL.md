# V7A_CONFORMAL — Isotonic + Conformal Mondrian

## Ce qui est calibré

V7a calibre **deux sorties** :

1. **Target A — gain futur (régression quantile)** via conformal Mondrian sur résidus absolus :
   ```
   résidu = actual_gain − q50_gain
   c_α(bucket) = Quantile_{1−α}(|résidus| | bucket)
   intervalle autour de q50_gain : [q50_gain − c_α, q50_gain + c_α]
   ```
2. **Target B — drop proba (classif binaire)** via isotonic regression sur `cal` :
   ```
   drop_proba_calibrated = IsotonicRegression.fit(drop_proba_raw, actual_drop).predict()
   ```

## Pourquoi Mondrian

Un `c_α` global ne capture pas l'hétérogénéité. Segmenter par bucket permet une **coverage conditionnelle** honnête.

Buckets (inchangés) : `(ttd_bucket × route_freq × vol_class)` — 4×3×3 = 36 buckets. Fallback global si `n_bucket < BUCKET_MIN_N = 100`.

## Pourquoi l'intervalle est centré sur q50, pas sur [q10, q90]

On apprend q10/q50/q90 mais on calibre conformellement sur `|actual − q50|`. Ça donne un intervalle symétrique **autour de q50** qui :
- a une coverage garantie à (1 − α) marginalement et conditionnellement par bucket ;
- ne dépend pas de la qualité indépendante de q10/q90 ;
- s'utilise directement dans la règle de stopping `q50_gain + c_α ≥ 0`.

Les q10/q90 restent utiles comme signal auxiliaire (voir `score_autobuy` qui utilise `q90_gain + c_α`).

## Calibration target B

Isotonic regression préserve le rang et mappe `proba_raw → proba_calibrated` pour corriger les biais de sortie LGBM (typiquement sous-confiance dans les bins moyens).

Métriques tracking :
- `ece_raw` et `ece_calibrated` (Expected Calibration Error) — `ece_calibrated` doit être < 0.05 pour un modèle utilisable en alerting.
- `reliability_*` : tableau `bin → (n, mean_proba, mean_actual)` par bin de 10 %.

## Critères de succès V7a

- Coverage marginal Mondrian à α=0.10 : |coverage − 0.90| ≤ 2 pp sur cal.
- Coverage per-bucket (n ≥ 200) : ≥ 0.85.
- `width/price_mean` ≤ 0.30 sur dense+low_vol ; `≤ 0.40` sur sparse+high_vol.
- `ece_calibrated(drop)` < 0.05.
- `buy_trigger_rate` (% cal rows où `q50_gain + c_α ≥ 0`) doit être cohérent avec le régime. Trop bas (< 5 %) → policy muette. Trop haut (> 80 %) → policy trop permissive.

## Commande

```bash
python3 scripts/train/v7a/calibrate.py
```

Artefacts :
- `data/models_v7a_<tag>/conformal_mondrian.json` (target = "future_gain")
- `data/models_v7a_<tag>/isotonic_drop.pkl`
- `reports/v7a_conformal_metrics_<tag>.json`
