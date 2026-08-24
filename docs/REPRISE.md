# Reprise du projet — état au 21 août 2026

Ce document existe pour qu'en revenant, tu n'aies pas à refaire l'enquête.
Il tient en une page et se termine par une checklist.

---

## Ce qui tourne, et qui va bien

La **production est en ligne** sur https://faregenie.vercel.app et n'a besoin
de rien. La refonte v3 y est déployée depuis le 21 août (commit `6da88d90`,
15 commits, 361 fichiers), après trois mois où `main` était figée au 26 mai.

Vérifié le jour du déploiement :

- les six pages du produit répondent en 200 ;
- les 30 photos de destinations et les 4 visuels de styles se chargent ;
- les routes missions renvoient 401 sans session, y compris en POST ;
- la clé Stripe de Vercel est valide, `sk_test` et `pk_test` correctement
  appairées, et `createBookingPayment` a été exercé en réel contre l'API
  Stripe (PaymentIntent créé avec `client_secret`, puis annulé) ;
- la base répond, `missions_db_backend` vaut bien `supabase` ;
- le mode shadow est actif (`FLYEAS_ALGO_VERSION=shadow` en production).

L'ancien état de `main` est conservé sur la branche
`sauvegarde-main-avant-refonte`, et Vercel garde son « Instant Rollback ».

---

## Ce qui est en pause, et pourquoi

**La collecte de prix est arrêtée volontairement.** Elle était déjà morte
depuis juin/juillet 2026 — je n'ai fait que cesser de faire semblant.

La cause, mesurée en direct sur les en-têtes RapidAPI :

```
x-ratelimit-requests-limit:     20     ← plan BASIC, par mois
x-ratelimit-requests-remaining:  0
```

Le pipeline consomme environ **4 500 appels par mois**. Il en a 20.

Le mécanisme exact de la panne silencieuse : `scripts/scraper/api-rotator.ts`
déclarait `monthlyQuota: 10000` pour sky-scrapper. Le rotateur ne freine qu'à
90 % du quota déclaré, soit 9 000 appels — un seuil jamais atteint puisque
RapidAPI coupe à 20. Il grillait donc le vrai quota en quelques minutes, puis
interrogeait un mur de 429 pendant trente jours. Et comme le 429 est traduit
en « aucune offre trouvée » en aval, **tout remontait vert** : GitHub Actions
réussissait toutes les 38 minutes, `/api/agent/sweep` renvoyait
`{"success":true}`, le scraper réussissait toutes les 4 heures.

Dernières données réellement écrites :

| Table | Lignes | Dernière entrée |
|---|---|---|
| `real_price_samples` | 2 230 | **9 juillet 2026** |
| `agent_decisions` | 325 | **20 juin 2026** |
| `price_history_samples` | 0 | jamais alimentée |

### Ce que j'ai changé pour la pause

- `scripts/scraper/api-rotator.ts` — le quota est maintenant honnête (20 par
  défaut) et pilotable par `SKY_SCRAPPER_MONTHLY_QUOTA`.
- `.github/workflows/flyeas-watcher.yml` — cron commenté (était `*/15`).
- `.github/workflows/scraper.yml` — cron commenté (était `0 */4`).

Les deux workflows gardent leur `workflow_dispatch` : ils restent
déclenchables à la main pour tester.

---

## La décision qui t'attend

**Il n'existe aucune source gratuite qui produise des données entraînables.**
Recherche menée le 22 août, sources vérifiées en direct :

- Amadeus Self-Service : portail fermé le 17 juillet 2026, points d'accès API
  injoignables (le site vitrine répond encore, pas l'API) ;
- tous les paliers gratuits RapidAPI empilés : ~720 appels/mois réellement
  exploitables, soit **5 jours de collecte sur 30** ;
- Travelpayouts, seul « illimité » : c'est un cache de 48 h à 7 j alimenté par
  les recherches d'autres utilisateurs. Un prédicteur entraîné là-dessus
  apprendrait la dynamique d'expiration du cache d'Aviasales, pas celle des
  tarifs. **À éviter absolument** — ça bougerait juste assez pour passer les
  contrôles de cohérence et te faire croire à un modèle qui fonctionne.

La seule option viable est **Sky Scrapper PRO, 9,99 $/mois, 10 600 appels**.
Elle ne demande aucune modification de code : la clé `RAPIDAPI_KEY` ne change
pas, et le quota se débloque dessus.

---

## Checklist de reprise

- [ ] **1. Souscrire** — https://rapidapi.com/apiheya/api/sky-scrapper/pricing
      → plan PRO à 9,99 $. Pas d'approbation, effet immédiat.

- [ ] **2. Poser une limite stricte immédiatement.** Le dépassement du plan PRO
      est facturé 0,002 $/requête **sans plafond**. Dans RapidAPI :
      Dashboard → App → Usage limits. Ne saute pas cette étape.

- [ ] **3. Débloquer le frein du rotateur** — ajouter dans Vercel (Production,
      Preview et Development) et dans `.env.local` :
      ```
      SKY_SCRAPPER_MONTHLY_QUOTA=10600
      ```

- [ ] **4. Vérifier que le quota est bien relevé** (sans consommer d'appel utile) :
      ```bash
      curl -s -D - -o /dev/null "https://sky-scrapper.p.rapidapi.com/api/v1/checkServer" \
        -H "x-rapidapi-key: $RAPIDAPI_KEY" \
        -H "x-rapidapi-host: sky-scrapper.p.rapidapi.com" | grep -i ratelimit
      ```
      Tu dois lire `x-ratelimit-requests-limit: 10600`.

- [ ] **5. Réactiver les crons** — décommenter les blocs `schedule:` dans
      `.github/workflows/flyeas-watcher.yml` et `scraper.yml`.

- [ ] **6. Déclencher une fois à la main** puis **vérifier que des lignes
      arrivent vraiment en base.** Ne considère rien comme réglé tant que le
      compteur n'a pas bougé :
      ```bash
      curl -s -I "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/real_price_samples?select=id" \
        -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
        -H "authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
        -H "Prefer: count=exact" -H "Range: 0-0" | grep -i content-range
      ```
      Référence à battre : **2 230**.

- [ ] **7. Poser l'alerte manquante** — « zéro échantillon inséré en 24 h →
      notification ». C'est l'absence de cette alerte, pas le fournisseur, qui
      a laissé la collecte morte pendant deux mois.

---

## Deux réglages à revoir au passage

- **`DEMO_SHADOW_ROUTES_PER_RUN` vaut 2** (le commentaire du fichier annonce
  10). Sur un pool de 112 routes, un passage complet prend 56 jours. À monter
  une fois le quota confortable.
- **`CRON_SECRET` ne fait que 16 caractères**, là où le workflow lui-même en
  recommande ≥32. C'est la seule protection de `/api/agent/sweep`. À
  régénérer aux trois endroits qui le partagent : Vercel, secrets GitHub, et
  le futur job Azure.

---

## Azure — prêt, et ne coûte rien en attendant

Posé le 21 août, sur les crédits Microsoft for Startups
(**10 000 $, valables jusqu'au 27 juillet 2028**) :

- garde-fou budget `flyeas-garde-fou` — 500 $/mois, alertes à 50 / 80 / 100 %
  plus une alerte prévisionnelle, vers `salah.farhat23@outlook.com` ;
- groupe de ressources `flyeas-prod` en `switzerlandnorth` ;
- environnement Container Apps `flyeas-env`.

**Aucun job n'y tourne**, et la facturation Container Apps est à la
consommation : tant qu'aucune réplique ne s'exécute, ça ne coûte rien. Le job
de collecte à 5 minutes n'a délibérément pas été créé — il n'aurait produit
que des 429 plus fréquents.

Note d'identification, pour ne pas reperdre une heure : l'abonnement est
`Azure subscription 1` (`a8eca4f1-…`) dans l'annuaire `8c3a1b42-…`, et cet
annuaire **exige l'authentification à deux facteurs**. Un `az login` simple
échoue en annonçant « No subscriptions found », ce qui est trompeur. La bonne
commande est :

```bash
az login --tenant 8c3a1b42-a3ef-4793-aa7b-3c7a8df7617d
```

---

## Hébergement — décision différée, pas oubliée

Vercel Hobby **interdit l'usage commercial** (documentation Vercel, juin
2026 : « the Hobby plan restricts users to non-commercial, personal use
only »). Tant que Stripe est en clés de test, aucun problème. Le jour du
lancement commercial, il faudra trancher entre Vercel Pro à 240 $/an et une
migration vers Azure — qui coûterait deux à trois jours de travail et te
ferait perdre les déploiements de prévisualisation, `next/image` et le cache
en périphérie. À arbitrer avec des revenus réels sous les yeux, pas avant.

---

## Hygiène locale

Le projet vit sur le Bureau synchronisé iCloud, ce qui a causé **quatre
incidents** : 6 605 fichiers `node_modules` évincés, des refs git revenues
trois semaines en arrière après une mise en veille, des `.lock` morts, et 30
fichiers doublons « … 2 » dans le dépôt (supprimés le 21 août). Deux minutes
pour supprimer une classe entière de pannes :

```bash
mkdir -p ~/Projets && mv ~/Desktop/BudgetPilot_Live ~/Projets/
```
