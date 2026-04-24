# V7A_WATCHER_WORKFLOW — GitHub Actions `Flyeas watcher`

## Contexte

Le workflow GitHub Actions `flyeas-watcher` appelle `/api/agent/sweep` toutes les 15 minutes pour maintenir le watcher "toujours à l'affût". Il échouait systématiquement car `FLYEAS_BASE_URL` n'était pas configuré. V7a corrige :

1. **Préflight** séparé qui valide les secrets avant d'attaquer Vercel.
2. **Messages d'erreur actionnables** (renvoient vers cette doc).
3. **Retry** avec backoff 15 s, 3 tentatives.
4. **Variable optionnelle** `FLYEAS_FAIL_IF_UNCONFIGURED=false` pour forks ou environnements en cours de setup.

## Fichier

`.github/workflows/flyeas-watcher.yml`

## Secrets GitHub requis

| Secret | Valeur attendue | Où trouver |
|---|---|---|
| `FLYEAS_BASE_URL` | URL prod Vercel sans trailing slash. Ex : `https://faregenie.vercel.app` | Dashboard Vercel → project → Settings → Domains |
| `FLYEAS_CRON_SECRET` | Même chaîne que `CRON_SECRET` côté Vercel env. ≥ 32 caractères aléatoires recommandés | Dashboard Vercel → project → Settings → Environment Variables |

**Configuration** :
GitHub → repo → Settings → Secrets and variables → Actions → **New repository secret**.

## Variable GitHub optionnelle

| Variable | Valeur | Effet |
|---|---|---|
| `FLYEAS_FAIL_IF_UNCONFIGURED` | `true` (défaut) | Le workflow échoue si un secret manque |
| `FLYEAS_FAIL_IF_UNCONFIGURED` | `false` | Le workflow exit 0 proprement en loggant un `::notice::`. Utile sur fork ou setup en cours |

**Configuration** :
GitHub → repo → Settings → Secrets and variables → Actions → **Variables** tab → New repository variable.

## Contrat côté Vercel

- `/api/agent/sweep` attend `Authorization: Bearer <CRON_SECRET>`.
- `process.env.CRON_SECRET` doit être égal à `FLYEAS_CRON_SECRET` côté GitHub.
- Vérifier les variables sur **tous les environnements** (Preview, Production, Development).

## Test manuel

```bash
# Remplacer par la vraie URL et le vrai secret
curl -X POST "https://faregenie.vercel.app/api/agent/sweep" \
  -H "authorization: Bearer <CRON_SECRET>" \
  -H "content-type: application/json" \
  -d '{"source":"manual"}'
```

Codes de retour attendus :
- `200` — sweep exécuté, JSON `{ success: true, checked, triggered }`.
- `401` — secret incorrect (mismatch CRON_SECRET).
- `404` — mauvais `BASE_URL`.
- `5xx` — erreur côté Vercel, logs à consulter.

## Déclenchement manuel depuis GitHub

Onglet **Actions** → **Flyeas watcher** → **Run workflow**. Le workflow respecte la même logique de préflight que le cron.

## Diagnostic

Si le workflow échoue :

1. Regarder les logs du job **Preflight secrets check**.
2. Si `FLYEAS_BASE_URL missing` → configurer le secret côté GitHub.
3. Si `Sweep unauthorized (401)` → `FLYEAS_CRON_SECRET` diffère de `CRON_SECRET` côté Vercel.
4. Si `404` → l'URL de production a changé ou le déploiement est invalide.
5. Si `5xx` → regarder les logs Vercel (`vercel logs`).

## Secrets complets pour V7a en prod

Au-delà de ce workflow :

| Secret / Env | Plateforme | Obligatoire V7a | Rôle |
|---|---|---|---|
| `FLYEAS_BASE_URL` | GitHub Actions | ✅ | Cron watcher |
| `FLYEAS_CRON_SECRET` | GitHub Actions | ✅ | Cron auth |
| `CRON_SECRET` | Vercel | ✅ | Bearer sweep + shadow-log |
| `NEXT_PUBLIC_APP_URL` | Vercel | ✅ | Fallback host sweep |
| `MODAL_V7A_URL` | Vercel | ⚠ Phase 11+ | URL endpoint Modal |
| `MODAL_V7A_SECRET` | Vercel + Modal | ⚠ Phase 11+ | Bearer endpoint Modal |
| `FLYEAS_ALGO_VERSION` | Vercel | ⚠ | `v1` \| `shadow` \| `v7a` |
| `FLYEAS_AUTOBUY_ENABLED` | Vercel | ⚠ | Kill-switch auto-buy |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel | Optionnel | Persistance shadow-log |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel | Optionnel | idem |
| `SCRAPER_SECRET` | GitHub Actions + Vercel | Déjà existant | Workflow scraper |

## Vérification périodique

Ajouter au checklist ops mensuelle :
- [ ] Le workflow `flyeas-watcher` a un success rate ≥ 95 % sur les 7 derniers jours ?
- [ ] Les secrets n'ont pas été rotation accidentellement ?
- [ ] L'URL `FLYEAS_BASE_URL` pointe toujours sur la bonne production ?
