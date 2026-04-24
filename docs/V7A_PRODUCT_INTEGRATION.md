# V7A_PRODUCT_INTEGRATION — Branchement V7a ↔ produit (pivot A)

## ⚠ ÉTAT après pivot A (2026-04-24)

Le endpoint Modal V7a (`scripts/cloud/v7a/serve.py`) sert la décision de la
baseline composée `ensemble_ttd_switch`, et **pas** la policy ML. Les sorties
ML (quantiles, conformal, drop_proba) sont exposées dans `ml_layer` pour
UI/explainability uniquement.

- `action` ∈ {`BUY_NOW`, `AUTO_BUY`, `WAIT`, `ABSTAIN`}
- `action_source` = `ensemble_ttd_switch` | `gate_route_unknown` | `...+autobuy_gate`
- `alert_enabled = false` (alerting off tant que target B non revue)
- `ml_layer.ml_available` = true si les modèles ML sont uploadés sur le volume

Pré-requis déploiement après pivot A :

```bash
# 1. Export baseline assets (sur local ou Modal)
python3 scripts/train/v7a/export_baseline_assets.py

# 2. Upload assets + modèles ML sur le volume
modal volume put flyeas-v7a data/models_v7a_local/baseline_assets.json /models_v7a_modal/baseline_assets.json
# (optionnel : upload modèles ML pour couche confiance)
modal volume put flyeas-v7a data/models_v7a_local /models_v7a_modal --recursive

# 3. Déployer endpoint
modal deploy scripts/cloud/v7a/serve.py
```

## Objectif

Corriger le principal problème stratégique identifié par l'audit : le ML V7.6 était déconnecté du produit. V7a corrige ça via **un endpoint Modal minimal** + **un adaptateur TS** + **un feature flag**.

## Composants

```
  Next.js (Vercel)                            Modal
 ┌────────────────────────┐                 ┌──────────────────────────┐
 │ POST /api/agent/sweep  │                 │ POST predict (Modal web  │
 │  → watchMission(m)     │                 │   endpoint)              │
 │      └─ predictV7aFirst├── HTTP ──────→ │   scripts/cloud/v7a/     │
 │           callV7a()    │   2s timeout   │     serve.py             │
 │           fallback V1  │                 │   image: CPU, 4GB        │
 │                        │                 │   lgbm_*, isotonic_*,    │
 │ POST /api/missions/… / │                 │   conformal_mondrian.json│
 │      propose           │                 │   (lus depuis Volume)    │
 └────────────────────────┘                 └──────────────────────────┘
```

## Étapes de déploiement

1. **Entraîner V7a localement** (`run_all_local.sh`).
2. **Produire `runtime_stats.json`** depuis `data/features_v7a/train.parquet` :
   ```python
   import pandas as pd, json
   df = pd.read_parquet("data/features_v7a/train.parquet")
   stats = {
       "pop": df.groupby("route").size().astype(int).to_dict(),
       "comp": { f"{r.origin}|{r.destination}": int(n)
                 for (o,d), n in df.groupby(["origin","destination"])["airline"].nunique().items()
                 for r in [type("r", (), {"origin":o,"destination":d})]},
       "route_mean": df.groupby("route")["price_usd"].mean().to_dict(),
       "route_std":  df.groupby("route")["price_usd"].std().to_dict(),
       "distance":   df.drop_duplicates("route").set_index("route")["feat_route_distance_km"].to_dict(),
   }
   open("data/models_v7a/runtime_stats.json","w").write(json.dumps(stats))
   ```
3. **Uploader les artefacts sur le volume Modal** :
   ```bash
   modal volume create flyeas-v7a  # si besoin
   modal volume put flyeas-v7a data/models_v7a /models_v7a
   ```
4. **Déployer l'endpoint** :
   ```bash
   modal deploy scripts/cloud/v7a/serve.py
   ```
   Modal renvoie une URL du type :
   `https://<team>--flyeas-v7a-predict.modal.run`
5. **Configurer les env Vercel** :
   - `MODAL_V7A_URL` = URL ci-dessus
   - `MODAL_V7A_SECRET` = secret aléatoire 32+ chars (stocker aussi côté Modal via `modal secret create flyeas-v7a MODAL_V7A_SECRET=<value>` puis attacher à l'app).
   - `FLYEAS_ALGO_VERSION` = `shadow` (phase shadow) puis `v7a` (phase active).
   - `FLYEAS_AUTOBUY_ENABLED` = `false` tant que shadow pas validé.
6. **Brancher le watcher** : `lib/agent/watcher.ts` appelle `predictV7aFirst()` au lieu de `predict()`.

## Patch watcher (à appliquer)

```ts
// lib/agent/watcher.ts — remplacer la section predict actuelle par :
import { predictV7aFirst } from './v7a';

const enriched = await predictV7aFirst({
  origin: mission.origin,
  destination: mission.destination,
  currentPrice: cheapest.priceUsd,
  daysUntilDeparture,
  windowSamples,
  allSamples,
  budgetMaxUsd: mission.maxBudgetUsd,
  budgetAutoBuyUsd: mission.autoBuyThresholdUsd,
  autobuyEnabled: process.env.FLYEAS_AUTOBUY_ENABLED === 'true',
  preferenceMatch: 1.0,
  nowIso: checkedAt,
});
prediction = enriched;
if (enriched.v7a) {
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/agent/shadow-log`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.CRON_SECRET ?? ''}`,
    },
    body: JSON.stringify({
      missionId: mission.id,
      route: `${mission.origin}-${mission.destination}`,
      price: cheapest.priceUsd,
      ttdDays: daysUntilDeparture,
      engine: enriched.engine,
      action: enriched.v7a.action,
      confidence: enriched.v7a.confidence,
      v7a: enriched.v7a,
    }),
  }).catch(() => {});
}
```

Le patch n'est **pas** appliqué dans ce livrable V7a pour garder le watcher actuel fonctionnel tant que les artefacts Modal ne sont pas uploadés. L'ordre recommandé :
1. Phase shadow UI activée (`FLYEAS_ALGO_VERSION=shadow`) — watcher garde V1 mais log V7a.
2. 2 semaines de shadow → analyse du log.
3. Phase `v7a` active si critères `V7A_BACKTEST.md` passent en shadow.

## Modes `FLYEAS_ALGO_VERSION`

| Valeur | Comportement |
|---|---|
| `v1` | Ancien predictor TS seul — comportement existant |
| `shadow` | V1 en prod + log V7a en parallèle (aucun impact décision) |
| `v7a` | V7a en prod avec fallback V1 si Modal down |

## Modes auto-buy

| `FLYEAS_AUTOBUY_ENABLED` | Comportement |
|---|---|
| absent ou `false` | `AUTO_BUY` impossible ; la policy degrade à `BUY_NOW` (proposition utilisateur) |
| `true` | `AUTO_BUY` autorisé si **tous** les gates V7a passent |

## Fallback sûr

Si `MODAL_V7A_URL` est injoignable (timeout 2 s) :
- `callV7a()` retourne `null`.
- `predictV7aFirst()` retourne la prédiction V1 enrichie de `engine: 'v7a-fallback-v1'`.
- Le watcher continue normalement.
- Les logs `[shadow-log]` indiquent le fallback.

## Liste des secrets / env requis

| Nom | Où | Rôle |
|---|---|---|
| `MODAL_V7A_URL` | Vercel env + local `.env.local` | URL endpoint Modal |
| `MODAL_V7A_SECRET` | Vercel env + Modal secret attaché à l'app | Bearer auth |
| `FLYEAS_ALGO_VERSION` | Vercel env | `v1` \| `shadow` \| `v7a` |
| `FLYEAS_AUTOBUY_ENABLED` | Vercel env | `true` \| `false` |
| `CRON_SECRET` | Vercel env + GitHub secret `FLYEAS_CRON_SECRET` | Bearer pour `/api/agent/sweep` et `/api/agent/shadow-log` |
| `FLYEAS_BASE_URL` | GitHub Actions secret | URL prod Vercel sans trailing slash |
| `NEXT_PUBLIC_APP_URL` | Vercel env | URL pub utilisée en fallback dans sweep |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel env | shadow-log -> Supabase (optionnel) |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env | idem |
