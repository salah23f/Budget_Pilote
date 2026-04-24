# V7A_SHADOW_MODE — Mode shadow V7a

## Définition

Le shadow mode produit des décisions V7a en parallèle du predictor V1, les **log**, mais ne les exécute pas. Aucun paiement, aucun escrow, aucune communication utilisateur n'est déclenché par une décision V7a en shadow.

Objectif : mesurer empiriquement sur des données live la qualité :
- de la recommandation d'achat,
- du timing d'alerte,
- de la coverage conformelle,
- et des scores (offer / alert / buy / autobuy).

## Activation

Côté Vercel env :
```
FLYEAS_ALGO_VERSION=shadow
FLYEAS_AUTOBUY_ENABLED=false
MODAL_V7A_URL=<url>
MODAL_V7A_SECRET=<secret>
```

`lib/agent/v7a/index.ts:predictV7aFirst` appelle V7a en plus de V1 quand `algo='shadow'`, et retourne la prédiction V1 comme décision active.

## Logging

Endpoint `POST /api/agent/shadow-log` (voir `app/api/agent/shadow-log/route.ts`).

Persistance (dans l'ordre) :
1. Supabase table `agent_decisions` si `SUPABASE_SERVICE_ROLE_KEY` configuré.
2. Fallback JSONL `.data/agent_decisions.jsonl` en local / dev.

### Schéma `agent_decisions`

```sql
create table agent_decisions (
  id uuid primary key default gen_random_uuid(),
  logged_at timestamptz not null default now(),
  mission_id text,
  route text,
  price double precision,
  ttd_days double precision,
  engine text,                   -- 'v1' | 'v7a' | 'v7a-fallback-v1'
  action text,                   -- V7a action label
  confidence double precision,
  v7a jsonb,
  note text
);
create index on agent_decisions (mission_id);
create index on agent_decisions (route);
create index on agent_decisions (logged_at desc);
```

### Payload exemple

```json
{
  "missionId": "mis_abc",
  "route": "JFK-LAX",
  "price": 298.5,
  "ttdDays": 21,
  "engine": "v1",
  "action": "ALERT_STRONG",
  "confidence": 0.82,
  "v7a": {
    "q10": 260, "q50": 315, "q90": 380,
    "conformal_lower": 280, "conformal_upper": 370,
    "bucket": "1-2-1",
    "score_offer": 0.34, "score_alert": 0.81, "score_buy": 0.38, "score_autobuy": 0.21,
    "width_over_price": 0.30,
    "reason": ["alert_strong=0.81"]
  }
}
```

## Analyse post-shadow

Après 2 semaines minimum (ou 500 décisions minimum par bucket dense), produire un rapport :

```bash
# À implémenter en V7b : scripts/train/v7a/shadow_analyze.py
#   - group by bucket (ttd × freq × vol)
#   - compute realized regret a posteriori (observer les prix futurs après chaque décision)
#   - coverage empirique : fraction des prix observés dans [conformal_lower, conformal_upper]
#   - alert precision empirique : fraction des ALERT_STRONG suivies d'un prix ≤ conformal_lower dans 14j
#   - comparer V1 vs V7a (disagreement rate)
```

## Critères pour activer `v7a` (exit shadow)

- ≥ 500 décisions shadow sur segment `dense`.
- Coverage empirique ≥ (1 − α) − 0.05 sur dense.
- `alert_precision_empirical ≥ 0.55` sur ALERT_STRONG.
- Pas d'incident de pipeline (taux d'erreur Modal > 5 % = investigation obligatoire).
- Drift detection : écart prix médian test vs shadow data < 15 %.

## Critères pour activer `AUTO_BUY` réel (plafonné)

En plus des critères `v7a` :
- ≥ 2 semaines de shadow sans issue.
- `regret_rel_p99 ≤ 0.25` sur segment `dense`.
- Kill-switch `FLYEAS_AUTOBUY_ENABLED=false` testé et confirmé opérationnel.
- UI d'explication `reason[]` déployée (l'utilisateur doit voir pourquoi on achète).

## Kill-switch

`FLYEAS_AUTOBUY_ENABLED=false` + redeploy → aucun AUTO_BUY possible. Temps d'activation : ~2 minutes (déploiement Vercel). À tester une fois lors de la mise en shadow.

## Règle d'or shadow

**Pas d'action produit user-facing** basée sur une décision shadow. Les logs servent uniquement à l'évaluation a posteriori par l'équipe ML.
