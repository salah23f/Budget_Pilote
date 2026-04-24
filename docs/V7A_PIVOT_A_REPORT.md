# V7A_PIVOT_A_REPORT — Journal du pivot A

Date : 2026-04-24  
Décision : le moteur de décision V7a devient la baseline composée
`ensemble_ttd_switch`. Le ML LGBM quantile sur target `future_gain` est
conservé comme couche de confiance auxiliaire, non décisionnelle.

---

## 1. Historique des décisions

| Étape | Décision / observation | Résultat |
|---|---|---|
| Audit V7.6 | Target `y=price_usd`, règles de stopping dégénérées, leakage caché | Invalidation complète du pipeline ML V7.6 |
| V7a initial | Target `y=price_usd` + policy multi-niveaux avec ABSTAIN | capture_median = 0.28 (V7a bat personne) |
| Diag target | Target trivialement apprise (MAE=3 USD sur prix ~400) | Target décisionnelle requise |
| V7a target A | `target_future_gain = min(p_{t+1..t+k(ttd)}) - p_t` | Pipeline cohérent, coverage parfaite (0.900 à α=10) |
| Bug grouping | build_target groupait par `route` seule, pas (route, depart_date) | Coverage cible 0.6 % → catastrophe |
| Fix grouping | (route, depart_date) = trajectoire + fix bug slicing | Coverage 85-97 % |
| Bug ABSTAIN | `WIDTH_RATIO_ABSTAIN=0.35` tuné pour target=price, bloque 96 % obs | policy muette |
| Fix ABSTAIN | Seuil à 5.0 (adapté à target=gain) | capture 0.815 global — V7a bat `v1_heuristic`, perd vs `rolling_min_30` et `simple_quantile_10` |
| Baselines par TTD | Breakdown rigoureux par segment TTD | `ensemble_ttd_switch` (rolling_min_30 sur 0-7 + simple_quantile_10 sur >7) = 0.9115 global |
| Hypothèse H1 | Coussin conformal atténué sur TTD long `α(ttd>21)=0.3` | capture 0.8880 global (+7.3 pp vs V7a sans H1), 22-60 de 0.795 à 0.908 (+11.3 pp) |
| Verdict H1 | V7a < baseline sur tous segments ; critère go/no-go FAIL strict | **Pivot A** |

## 2. Chiffres finaux du test H1 (capture_median, test hold-out 11 750 trips)

| Bucket | ensemble_ttd_switch | V7a ML avant H1 | V7a ML après H1 | écart vs baseline |
|---|---|---|---|---|
| 0-7 | 0.9496 | 0.9396 | 0.9396 | −1.00 pp |
| 8-21 | 0.8989 | 0.8800 | 0.8796 | −1.93 pp |
| 22-60 | 0.9127 | 0.7950 | 0.9079 | −0.48 pp |
| **Global** | **0.9115** | 0.8153 | **0.8880** | **−2.35 pp** |

Critères go/no-go fixés avant H1 :
- GO global ≥ 0.9115 : **FAIL** (0.8880)
- GO segmental partiel ≥ 0.9127 sur 22-60 : **FAIL** (0.9079)

## 3. Ce que le pivot A implique concrètement

### Moteur de décision produit

**Avant pivot A** : policy ML `q50_gain + c_α ≥ 0` + gates ABSTAIN/AUTO_BUY.  
**Après pivot A** : règle simple 6 lignes :

```python
def decide(current_price, ttd_days, price_history, q10_train):
    if ttd_days <= 7:
        window = price_history[-30:]
        return "BUY_NOW" if (window and current_price <= min(window)) else "WAIT"
    else:
        return "BUY_NOW" if (q10_train and current_price <= q10_train) else "WAIT"
```

### Rôle du ML

- **Quantiles** `q10_gain / q50_gain / q90_gain` → affichage intervalle dans l'UI.
- **Conformal** `[q50 − c_α, q50 + c_α]` → niveau de confiance.
- **`drop_proba_calibrated`** → réservé pour V7b alerting (désactivé en prod).

### Alerting

**Désactivé** (`alert_enabled=false` retourné par le endpoint). Raison : la
target B `target_future_drop` est quasi-constante (drop_rate ≈ 0.99 sur
dilwong) → `drop_proba_calibrated` ne discrimine pas. À revoir en V7b avec
une target B plus sélective (θ_drop ≥ 0.20 ou cible distance-au-floor).

## 4. Ce qui reste disponible (non retiré)

- Code ML V7a complet sur disque (build_target, lgbm_quantile, calibrate,
  backtest, policy) — intact pour expérimentations V7b éventuelles.
- Modal images / volume / orchestrateur (`run_v7a_modal.py`) — exploitable
  pour relancer un pipeline ML full-data si V7b recommence avec target
  revue.
- Audit leakage renforcé, breakdown TTD par segment, comparaison
  local-vs-modal : tous gardés.

## 5. Ce qui serait nécessaire pour revenir au ML (V7b)

Non garanti, à tester une fois réuni :

1. **Target reformulée** : `y = min(p_{t+1..t+k}) - p_t` est trop
   pessimiste sur dilwong (min d'une fenêtre bruitée). Alternatives :
   - `y = quantile_25(future_prices) - p_t` (moins bruitée)
   - `y = p_{t+k} - p_t` (prix à horizon fixe)
   - `y binaire` : "le prix baisse-t-il de ≥ 20 % ?"
2. **Features manquantes** : pas de macro (FX, calendrier événements),
   pas d'embedding route, pas de signal externe demande.
3. **Dataset** : dilwong = 6 mois, US only, prix quasi-stables. Tester sur
   un marché plus volatile (vol internationaux, saisonnalité forte) pour
   voir si le ML peut capter de l'information que les baselines ratent.
4. **Re-run Modal full-data** : seulement si H1 refit avec target revue
   donne un signal local ≥ baseline.

## 6. Artefacts produits

### Code

- `scripts/train/v7a/export_baseline_assets.py` — NOUVEAU (exporte
  `baseline_assets.json` avec Q10 et popularity par route).
- `scripts/cloud/v7a/serve.py` — **RÉÉCRIT** : décision via
  `ensemble_ttd_switch`, ML en couche confiance auxiliaire.
- `lib/agent/v7a/client.ts` — **RÉÉCRIT** : schéma `V7aPrediction` aligné
  avec pivot A (action_source, ml_layer, alert_enabled).
- `lib/agent/v7a/index.ts` — **RÉÉCRIT** : mapping V7a.action → V1.action
  (ABSTAIN → V1 'WAIT').

### Docs

- `docs/V7A_SCOPE.md` — section pivot A en tête, tableau composants mis à jour.
- `docs/V7A_POLICY.md` — section pivot A en tête, policy ML archivée en bas.
- `docs/V7A_BACKTEST.md` — résultats finaux ajoutés, critères produit sur baseline.
- `docs/V7A_PRODUCT_INTEGRATION.md` — procédure déploiement pivot A.
- `docs/V7A_PIVOT_A_REPORT.md` — ce fichier.

### Inchangé

- `scripts/train/v7a/{build_dataset,fetch_dilwong,split,features,audit_leakage,
  baselines,lgbm_quantile,calibrate,policy,backtest,build_target,
  compare_local_vs_modal}.py` — intacts pour V7b.
- `.github/workflows/flyeas-watcher.yml` — inchangé.
- `app/api/agent/shadow-log/route.ts` — inchangé.

## 7. Commandes de déploiement

```bash
# 1. Export baseline assets en local (instant, 0 USD)
cd ~/Desktop/BudgetPilot_Live
python3 scripts/train/v7a/export_baseline_assets.py

# 2. Upload sur le volume Modal (flyeas-v7a)
modal volume put flyeas-v7a \
  data/models_v7a_local/baseline_assets.json \
  /models_v7a_modal/baseline_assets.json

# 3. (Optionnel, pour activer couche confiance ML)
modal volume put flyeas-v7a data/models_v7a_local /models_v7a_modal

# 4. Déployer endpoint
modal secret create flyeas-v7a-secret MODAL_V7A_SECRET=$(openssl rand -hex 32)
modal deploy scripts/cloud/v7a/serve.py

# 5. Configurer Vercel env
# MODAL_V7A_URL=https://<team>--flyeas-v7a-predict.modal.run
# MODAL_V7A_SECRET=<même valeur que modal secret>
# FLYEAS_ALGO_VERSION=shadow    # pour 2 semaines de shadow mode
# FLYEAS_AUTOBUY_ENABLED=false  # kill-switch

# 6. Tester manuellement
curl -X POST "$MODAL_V7A_URL" \
  -H "authorization: Bearer $MODAL_V7A_SECRET" \
  -H "content-type: application/json" \
  -d '{
    "origin":"JFK","destination":"LAX","ttd_days":30,
    "current_price":350,"fetched_at":"2026-04-24T00:00:00Z",
    "price_history":[],
    "budget_max":500,"budget_autobuy":450,"autobuy_enabled":false
  }'
```

## 8. Critères de validation post-pivot

Avant de passer `FLYEAS_ALGO_VERSION=v7a` (exit shadow) :

- [ ] Endpoint répond en < 500 ms sur 95 % des requêtes.
- [ ] 0 erreur d'auth ou de schéma sur 100 requêtes shadow mode.
- [ ] Pour chaque décision shadow loggée dans `agent_decisions`, V7a
      produit la même action que la règle "ensemble_ttd_switch" locale
      appliquée au même `(price, ttd, history, q10)`.
- [ ] `reason[]` cohérent et actionnable pour l'UI.
- [ ] Aucun champ `v7a.action = BUY_NOW` avec `route_known=false`.

Avant de passer `FLYEAS_AUTOBUY_ENABLED=true` :

- [ ] 2 semaines de shadow mode sans divergence.
- [ ] Taux de faux positif auto-buy (paid > 120 % du floor trip) < 1 % sur
      les décisions simulées en shadow.
- [ ] Kill-switch testé (env var → false → pas d'AUTO_BUY ≥ 10 min).
