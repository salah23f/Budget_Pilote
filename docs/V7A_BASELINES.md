# V7A_BASELINES — Baselines de référence

V7a ne peut prétendre à un gain que s'il bat un ensemble de baselines simples.  
Les baselines sont évaluées sur `features_v7a/test.parquet` avec la même boucle de décision que la policy V7a (premier tick qui déclenche BUY, sinon force-buy au dernier tick).

## Baselines implémentées

| Baseline | Règle d'achat | Pourquoi |
|---|---|---|
| `buy_now` | Achète au premier tick observé | Borne basse universelle |
| `fixed_horizon_14` | Achète au tick le plus proche de TTD=14 | Heuristique utilisateur classique |
| `rolling_min_30` | Buy si `p_i ≤ min(p_{i-30..i-1})` | Baseline statistique triviale |
| `simple_quantile_10` | Buy si `p_i ≤ Q10(train_route_prices)` | Quantile par route |
| `v1_heuristic` | Reprise simplifiée `lib/agent/predictor.ts` | Comparaison au produit existant |

## Métriques

Pour chaque baseline :
- `regret_abs_{mean, p50, p90, p99}` en USD
- `regret_rel_{mean, p50, p90}` en proportion du floor
- `capture_{mean, median}` en % du floor
- `economic_gain_vs_buy_now_mean` = `regret_buy_now - regret_policy`

## Pourquoi ces choix

- **`buy_now`** : sans cette baseline, impossible de savoir si V7a apporte de la valeur ou si le marché est tellement stable qu'attendre ne rapporte rien.
- **`fixed_horizon_14`** : J-14 est le conseil populaire des agents de voyage et des articles grand public. Battre cette heuristique est la barre minimale "utile".
- **`rolling_min_30`** : baseline statistique zero-cost. Si LGBM ne la bat pas, le problème est dans les features, pas dans le modèle.
- **`simple_quantile_10`** : teste l'utilité d'une ancre per-route.
- **`v1_heuristic`** : compare V7a au produit déjà en prod.

## Critères Go/No-Go V7a

**Go** pour passer en Phase 11 (branchement Modal) si :
- `v7a.capture_median > rolling_min_30.capture_median` **et** Wilcoxon apparié p < 0.05.
- `v7a.capture_median > v1_heuristic.capture_median` (même si p > 0.05, la direction doit être correcte).
- `v7a.regret_rel_p90 ≤ rolling_min_30.regret_rel_p90`.

**No-Go** — on arrête et on corrige les données/features si :
- LGBM perd contre `buy_now` (signal temporel quasi-absent).
- LGBM perd contre `rolling_min_30` sur tous les segments TTD.
- `v7a.regret_rel_p99 > 0.5` (une route perd > 50 % d'occasions = panique).

## Sortie

- `reports/v7a_baselines.json` — dict par baseline.

## Commande

```bash
python3 scripts/train/v7a/baselines.py
```
