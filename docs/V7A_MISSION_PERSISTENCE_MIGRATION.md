# V7A_MISSION_PERSISTENCE_MIGRATION — Correction d'infrastructure

Date : 2026-04-24
Statut : obligatoire avant toute observation prospective fiable en prod
Cadre : track fondamental (pas un patch tactique)

---

## 1. Pourquoi cette migration est nécessaire

### Le problème fondamental

Jusqu'à cette migration, `lib/store/missions-db.ts` utilisait un fichier JSON
local (`.data/missions.json`) comme backing store unique. Sur Vercel, le
filesystem est **éphémère** : il disparaît à chaque redeploy, chaque scale-up,
et n'est pas partagé entre instances lambda.

Conséquences concrètes :

1. **Aucune mission ne survit plus de quelques heures en prod.** Un push sur
   main déclenche un redeploy → `.data/missions.json` vide à nouveau.
2. **Les missions créées par une instance ne sont pas visibles des autres.**
   Vercel exécute des lambdas séparées pour des requêtes concurrentes.
3. **Le watcher V7a ne peut pas observer.** Le cron appelle
   `/api/agent/sweep`, qui liste les missions actives via `listMissions()`.
   Si la liste est systématiquement vide (ou instable), le shadow mode V7a
   n'a rien à observer → l'évaluation causale prospective prévue sur 2
   semaines ne peut pas démarrer.

Ce n'est **pas** un bug. C'est un choix d'infrastructure incompatible avec
le cadre théorique (évaluation causale prospective). Le fichier JSON est
conçu pour du dev local.

### Lien avec le cadre théorique

La case "évaluation causale prospective" dans le framework V7a (voir
`docs/V7A_SHADOW_MODE.md`) exige :

- Des missions qui vivent plusieurs jours.
- Un état qui persiste entre les scans.
- Une source de vérité partagée entre les routes API (watcher, sweep,
  shadow-log, cron).

Un filesystem éphémère casse les trois conditions. Tant que les missions
ne persistent pas dans une DB externe, **aucune conclusion** tirée des
logs shadow n'est scientifiquement valide — on ne peut pas distinguer
entre "V7a ne se déclenche pas" et "aucune mission n'est active parce que
la DB a été vidée".

## 2. Ce que fait la migration

### Schéma DB (Supabase Postgres)

Deux tables créées par `supabase/migrations/20260424000001_missions_tables.sql` :

```sql
missions (
  id                 text primary key,
  user_id            text not null,
  status             text not null,
  monitoring_enabled boolean not null default true,
  data               jsonb not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
)

mission_proposals (
  id         text primary key,
  mission_id text not null references missions (id) on delete cascade,
  status     text not null,
  data       jsonb not null,
  created_at timestamptz not null default now()
)
```

**Choix de design :**

- `data jsonb` contient l'objet Mission complet. Ajouter un champ Mission
  (ex. un nouveau flag package) ne nécessite pas de migration de schéma.
- Colonnes dénormalisées (`user_id`, `status`, `monitoring_enabled`) =
  index matérialisés pour les requêtes chaudes du sweep cron.
- Index `missions_monitoring_active_idx WHERE monitoring_enabled = true`
  = index partiel : le sweep ne scanne que les missions actives.
- `ON DELETE CASCADE` sur `mission_proposals` → simplifie `deleteMission()`.
- RLS désactivée pour l'instant (backend = service role côté serveur,
  auth applicative en amont). Activable plus tard si on expose des tables
  au client navigateur.

### Backend code

`lib/store/missions-db.ts` est réécrit avec deux backends :

- **SupabaseBackend** : actif si `NEXT_PUBLIC_SUPABASE_URL` et
  `SUPABASE_SERVICE_ROLE_KEY` sont définis. Utilise `@supabase/supabase-js`
  (déjà en dépendance pour shadow-log).
- **JsonBackend** : fallback fichier JSON local (ex-code). Actif quand les
  env vars Supabase sont absentes → dev local sans Supabase.

Interface publique **inchangée** : `listMissions`, `getMission`,
`createMission`, `updateMission`, `deleteMission`, `listProposalsForMission`,
`getProposal`, `createProposal`, `updateProposal`, `findPendingProposal`.
Aucun des 11 fichiers route API qui importent `missions-db.ts` n'a besoin
d'être modifié.

Un export diagnostic `getBackendKind()` permet de vérifier quel backend
est actif (utile pour une route `/api/agent/diagnostic`).

## 3. La migration SQL est défensive

L'erreur observée le 2026-04-24 ("column updated_at does not exist")
indiquait une table `missions` préexistante avec un schéma différent.
La migration gère ce cas :

1. Détecte si `missions` ou `mission_proposals` existe déjà.
2. Si le schéma est déjà correct (colonnes `updated_at` et `data jsonb`),
   ne touche à rien.
3. Si le schéma est incompatible **et que la table est vide** (0 lignes),
   la drop en CASCADE.
4. Si la table est incompatible **et non vide**, AVORTE avec un
   `raise exception` explicite. Un humain décide du chemin (ALTER ou
   DROP manuel après inspection).

Cas attendu 2026-04-24 : table préexistante, probablement 0 ligne (vu
que les missions étaient en filesystem éphémère jusqu'ici), donc drop +
recreate automatique.

## 4. Procédure de déploiement

### Étape 1 — Migration SQL dans Supabase

Dans le SQL Editor Supabase, coller le contenu de
`supabase/migrations/20260424000001_missions_tables.sql` et exécuter.

Logs attendus (NOTICE) :
- `Table missions existe avec schéma incompatible, 0 ligne → DROP CASCADE`
- Création des nouvelles tables + indexes.

En cas de `raise exception` (table non vide), arrêter et consulter
manuellement la table avant de continuer.

### Étape 2 — Vérifier les env vars Vercel

Dans Vercel → Project Settings → Environment Variables, confirmer :

- `NEXT_PUBLIC_SUPABASE_URL` (Production + Preview)
- `SUPABASE_SERVICE_ROLE_KEY` (Production + Preview)

Ces deux variables existent déjà pour le shadow-log. Pas de nouvelle clé
à créer.

### Étape 3 — Déployer le code

```bash
git add lib/store/missions-db.ts \
        supabase/migrations/20260424000001_missions_tables.sql \
        docs/V7A_MISSION_PERSISTENCE_MIGRATION.md
git commit -m "fix(infra): persist missions in Supabase, replace ephemeral JSON store"
git push
```

Vercel redeploy automatique.

### Étape 4 — Valider

5 checks après redeploy :

1. **Backend actif** : `curl https://<app>.vercel.app/api/agent/diagnostic`
   doit retourner `missions_db_backend: "supabase"` (si la route existe).
   Sinon, `curl /api/agent/missions` après création doit persister au-delà
   d'un redeploy.

2. **Création mission persistante** :
   - Créer une mission (via UI ou route de test).
   - Trigger un redeploy (ou `vercel deploy --prod`).
   - Re-lister `/api/agent/missions` → la mission doit toujours être là.

3. **Sweep cron voit les missions actives** : logs Vercel du cron doivent
   montrer `missions_checked > 0` pour au moins une mission réelle.

4. **Shadow V7a se déclenche** : logs Vercel du watcher doivent contenir
   `[v7a-shadow-watcher]` pour chaque mission active (plus seulement pour
   les appels sim-watch).

5. **Table `agent_decisions` reçoit des lignes** : SQL
   `select count(*), min(logged_at), max(logged_at) from agent_decisions`
   → count augmente avec le temps, timestamps étalés.

## 5. Risques résiduels

| Risque | Mitigation |
|---|---|
| Supabase down → `createMission` throw | Route API catch, retourne 503 à l'utilisateur. Acceptable vs data loss silencieuse du filesystem. |
| Latence Supabase > latence filesystem | Mesurée négligeable pour les 11 routes (1-2 requêtes par route). Le sweep cron est le chemin chaud ; l'index partiel `monitoring_enabled` le rend O(n actives) au lieu de O(n totales). |
| Schéma Mission évolue | `data jsonb` absorbe sans migration. Si un nouveau champ doit être indexé, ajouter une colonne dénormalisée + index, sans altérer `data`. |
| RLS absente | Backend utilise service role côté serveur, auth applicative protège les routes. À activer quand un client navigateur lira les tables directement. |

## 6. Ce qui reste après cette migration

**Maintenant possible :**
- Shadow mode V7a sur 2 semaines avec missions réelles persistantes.
- Diagnostic prospectif causal basé sur `agent_decisions` + `missions`.
- Kill-switch auto-buy testable (env var → false → vérification que plus
  aucun `AUTO_BUY` ≠ pre-existing pour 10 min).

**À construire ensuite (non bloqué par cette migration) :**
- Dashboard observabilité : taux de BUY_NOW V7a vs V1, capture_median
  prospective par bucket TTD.
- Route `/api/agent/diagnostic` qui retourne `missions_db_backend`,
  `shadow_rate_24h`, `v7a_calls_24h`, `fallback_v1_rate_24h`.
- Phase 2 : target B refondue + alerting.

## 7. Critère d'acceptation

La migration est **réussie** si et seulement si :

- Les 5 checks de §4 passent.
- Un redeploy Vercel ne vide plus les missions.
- Au moins une mission réelle active génère des entrées `agent_decisions`
  continues sur 24h.
- Aucune régression sur les 11 routes API qui importent `missions-db.ts`
  (validée par test manuel ou par e2e si disponible).
