# V7A_POLICY — Policy V7a (après pivot A)

## ⚠ ÉTAT ACTUEL — pivot A

Le moteur de décision V7a est désormais **`ensemble_ttd_switch`**, une
baseline statique composée (voir `V7A_PIVOT_A_REPORT.md`).

```
BUY_NOW si TTD ≤ 7  et  price ≤ rolling_min_30(price_history)
BUY_NOW si TTD > 7  et  price ≤ Q10(train_route)
WAIT    sinon
ABSTAIN si route inconnue du dataset train
```

`AUTO_BUY` est possible uniquement si :
- `autobuy_enabled = true` (feature flag env `FLYEAS_AUTOBUY_ENABLED`)
- `price ≤ budget_autobuy`
- `ttd_days ≥ 2`
- en plus des conditions BUY_NOW

**Alerting** (ALERT_SOFT / ALERT_STRONG) est **désactivé** en prod via
`alert_enabled=false` dans la réponse endpoint. Raison : la target B
(drop_proba) est quasi-constante ~0.87 sur dilwong → pas de signal. Ré-
activation après fix target B en V7b.

La documentation ci-dessous (sections 1-3) décrit la **policy ML historique**
(archivée, non utilisée en production). Elle est conservée pour traçabilité
des expérimentations.

---

## ARCHIVE — Policy ML V7a (non utilisée en production)

V7a produit six actions, chacune dérivée de **règles explicites basées sur la target décisionnelle**.

## Actions

| Action | Description | Déclenchement produit |
|---|---|---|
| `ABSTAIN` | Modèle hors domaine | Rien à l'utilisateur |
| `WAIT` | Prix acceptable, pas d'urgence | Monitoring continu |
| `ALERT_SOFT` | Drop probable — fenêtre de vigilance | Push légère |
| `ALERT_STRONG` | Drop fort probable — opportunité sérieuse | Push forte + email |
| `BUY_NOW` | Règle de stopping : attendre n'apporte rien | Modal "buy now" |
| `AUTO_BUY` | Pire cas confirme + gates de sécurité | Capture auto |

## Quatre scores explicites

### A. `score_offer` — qualité intrinsèque

```
implied_future_price = price + q50_gain
relative_discount = max(0, (implied_future_price − price) / implied_future_price)
score_offer = min(1, 0.7 · min(1, 3·relative_discount) + 0.3 · preference_match)
```

### B. `score_alert` — timing d'envoi (drop proba)

```
ttd_weight = 1.0 si 3 ≤ TTD ≤ 120
           = 0.1 si TTD < 3
           = 0.6 si 3 ≤ TTD < 7
           = 0.3 si TTD > 120
score_alert = min(1, drop_proba_calibrated · ttd_weight)
```

### C. `score_buy` — règle de stopping

```
ml_trigger = q50_gain + c_alpha_gain
ml_score = clamp(0.5 + ml_trigger / 20, 0, 1)
# +10 USD gain → score 1 ; 0 → 0.5 ; −10 USD gain → 0

# Mode hybride (optionnel, pour comparaison) :
if hybrid_mode and q10_train_route > 0:
  under_train_q10 = 1 si price ≤ q10_train_route else 0
  score_buy = max(ml_score, 0.7·under_train_q10 + 0.3·ml_score)
else:
  score_buy = ml_score
```

### D. `score_autobuy` — sécurité

```
worst_case = q90_gain + c_alpha_gain
si worst_case < 0 → score_autobuy = 0  (attendre est mieux même dans pire cas)
sinon : score_autobuy = clamp(0.5·score_buy + 0.25·freq_bonus + 0.25·tight_bonus, 0, 1)
```

## Règles de transition

Dans l'ordre (first-match) :

1. **ABSTAIN** si :
   - `route_known == False`
   - ou `width/price > 0.35` (`conformal_width_gain = 2·c_α`)
2. **AUTO_BUY** si tous :
   - `autobuy_enabled`
   - `price ≤ budget_autobuy`
   - `ttd_days ≥ 2`
   - `score_autobuy ≥ 0.80`
   - `worst_case ≥ 0`
3. **BUY_NOW** si `score_buy ≥ 0.65` et `price ≤ budget_max`.
4. **ALERT_STRONG** si `score_alert ≥ 0.75`.
5. **ALERT_SOFT** si `score_alert ≥ 0.55`.
6. **WAIT** sinon.

## Mode `v7a_ml_only` vs `v7a_hybrid`

Le backtest produit **deux variantes** :

| Variante | Signal BUY | Rôle |
|---|---|---|
| `v7a_ml_only` | uniquement `q50_gain + c_α ≥ 0` | Mesure la valeur ajoutée du ML pur |
| `v7a_hybrid` | ML + trigger `price ≤ q10_train_route` | Policy robuste utilisable en prod, mélange ML et baseline |

**Transparence** : si `v7a_hybrid >> v7a_ml_only`, ça veut dire que le ML seul ne fournit pas assez de signal et que la baseline Q10 porte la policy. C'est acceptable en production mais doit être assumé.

Inversement, si `v7a_ml_only ≈ v7a_hybrid`, le ML apporte la valeur attendue.

## Garde-fous auto-buy

- `FLYEAS_AUTOBUY_ENABLED` env var (kill-switch).
- Pas d'AUTO_BUY sur route inconnue (`route_known = False`).
- Pas d'AUTO_BUY si `ttd_days < 2`.
- Pas d'AUTO_BUY si `q90_gain + c_α < 0` (le modèle dit "attends même dans le pire cas").
- Pas d'AUTO_BUY si `width/price > 0.20`.
- `budget_autobuy` de la mission utilisateur est un plafond dur.

## Explicabilité

Chaque décision renvoie un champ `reason: list[str]` avec la règle qui a déclenché. Exemple :
```
reason = ["buy_score=0.72 (q50_gain+c_alpha≥0)"]
reason = ["alert_strong drop_proba_calib=0.82"]
reason = ["width_over_price=0.41>0.35"]
```

Ces raisons sont **loggées** côté shadow-log et **affichables** dans l'UI.
