# V7A_BACKTEST — Backtest V7a

## ⚠ ÉTAT ACTUEL — pivot A

Le backtest montre que la baseline composée `ensemble_ttd_switch` domine
V7a ML sur tous les segments TTD, même avec H1 (règle de stopping durcie).

| Bucket | baseline | V7a ML+H1 | écart |
|---|---|---|---|
| Global | 0.9115 | 0.8880 | −2.35 pp |
| 0-7 | 0.9496 | 0.9396 | −1.00 pp |
| 8-21 | 0.8989 | 0.8796 | −1.93 pp |
| 22-60 | 0.9127 | 0.9079 | −0.48 pp |

Verdict : NO-GO strict → pivot A appliqué (voir `V7A_PIVOT_A_REPORT.md`).

Les **critères produit** s'appliquent désormais à la baseline + couche
confiance ML (pas à la policy ML) :

- Décision correcte (capture_median global) : ≥ 0.91 (atteint par baseline)
- `regret_rel_p90` ≤ 1.2 (atteint par baseline)
- Coverage conformal ≥ 0.88 par bucket dense (audit ML layer pour UI)

---

Seul script V7a autorisé à lire `features_v7a/test.parquet`.

## Deux variantes évaluées

| Variante | Description |
|---|---|
| `v7a_ml_only` | Policy basée **uniquement** sur `q50_gain + c_α` (ML pur) + `drop_proba_calibrated` pour alerting |
| `v7a_hybrid` | Même policy + trigger `price ≤ q10_train_route` comme fallback baseline |

Publiées ensemble pour **mesurer honnêtement la valeur ajoutée du ML**.

## A — Qualité d'achat (par variante)

Pour chaque route du test :
- Replay policy tick-par-tick
- Premier BUY_NOW/AUTO_BUY → prix payé ; sinon force-buy au dernier tick
- `floor_route = min(prices_test_route)` (oracle ex-post)

Métriques :
- `regret_abs_{mean, p50, p90, p99}` (USD)
- `regret_rel_{mean, p50, p90}` (%)
- `capture_{mean, median}` + IC95 bootstrap sur `capture_median`

## B — Qualité de timing d'alerte — **métriques HONNÊTES**

L'ancienne `alert_precision` (conformal lower hit) mesurait en réalité la volatilité normale des prix futurs. V7a utilise désormais des métriques alignées avec la valeur produit :

| Métrique | Définition | Cible V7a |
|---|---|---|
| `alert_precision_floor_1_05` | % alertes où `price_alerte ≤ floor_route × 1.05` | ≥ 0.30 |
| `alert_precision_floor_1_10` | idem × 1.10 | ≥ 0.50 |
| `alert_precision_floor_1_05_strong` | idem restreint à ALERT_STRONG | ≥ 0.50 |
| `alert_recall_floor_1_05` | % obs `price ≤ floor × 1.05` qui ont reçu une alerte (OU un BUY) | ≥ 0.60 |
| `regret_realized_after_alert_{mean, p50, p90}` | `price_alerte − floor` si le client achetait au moment de l'alerte | p50 ≤ 30 USD idéal |
| `alert_rate` | `n_alerts / total_test_rows` | 0.05 – 0.25 raisonnable |
| `alert_too_early_rate` | % alertes avec TTD > 45j | < 0.20 |
| `alert_too_late_rate` | % alertes avec TTD < 3j | < 0.05 |
| `alert_precision_legacy_future_lower` | **déprécié** — conformal lower hit | ignoré pour la décision |

### Pourquoi `alert_precision_floor_1_05` est la bonne métrique

Une alerte utile = **recommander un moment où le prix est proche du minimum réel de la route**. Si `price_alerte > 1.10 × floor_route`, on fait perdre du temps au client.

L'ancienne métrique `alert_precision` mesurait si « un prix futur passe sous le prix de l'alerte », ce qui se produit mécaniquement en raison du bruit — ~96 % trivial.

## C — Coverage conformal par segment

Déjà produite par `calibrate.py`. Le backtest la reprend et la ventile par segment test.

## D — Action distribution

Pour chaque variante, `report["action_distribution"]` contient `{action: {n, share}}`. Permet de voir si `BUY_NOW` se déclenche, ou si tout tombe en `WAIT`.

## E — Buy trigger diagnostic

`report["buy_triggers_diagnostic"]` contient :
- `n_buy` : nombre de BUY_NOW/AUTO_BUY
- `share_total` : fraction du test
- `q50_gain_plus_c_alpha_mean` : valeur moyenne du trigger ML (diagnostic)

## Segmentation

`reports/v7a_segmented_metrics_<tag>.json` contient buy + alert par :
- `seg_ttd` ∈ {0-7, 8-21, 22-60, 61+}
- `seg_freq` ∈ {sparse, medium, dense}

Pour les deux variantes.

## Critères Go produit

**Recommend_only** (propose BUY à l'utilisateur) :
- `v7a_ml_only.capture_median ≥ simple_quantile_10.capture_median` sur au moins 2 segments TTD denses
- `alert_precision_floor_1_05 ≥ 0.30` globalement
- `alert_precision_floor_1_10 ≥ 0.50` globalement
- `ece_calibrated(drop) < 0.05`
- Coverage conformelle ≥ 0.85 par bucket dense

**Shadow auto-buy** :
- Tous les critères ci-dessus +
- `regret_rel_p90 ≤ 0.30` sur seg_freq=dense
- `regret_realized_after_alert_p50 ≤ 20 USD`
- `alert_too_early_rate ≤ 0.20` et `alert_too_late_rate ≤ 0.05`

**Auto-buy réel plafonné** : shadow 2 semaines + critères ci-dessus tenus.

## Commande

```bash
python3 scripts/train/v7a/backtest.py
```

Sortie :
- `reports/v7a_backtest_<tag>.json`
- `reports/v7a_segmented_metrics_<tag>.json`
- `data/models_v7a_<tag>/lgbm_test.parquet`
