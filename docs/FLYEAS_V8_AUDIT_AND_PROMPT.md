# FLYEAS — AUDIT V7.6/V7a → PROMPT V8 ORACLE+ADDICT

> Date : 2026-04-25 — Auteur : audit Claude Opus 4.7
> Scope : où en est l'app, ce qui bloque, ce qu'il faut bâtir pour atteindre le SOTA 2026 + UX addictive

---

## PARTIE 1 — ÉTAT ACTUEL (snapshot)

### 1.1. Identité produit
- **Flyeas** (nom legal : BudgetPilot Live, package `flyeas`) : agent IA autonome qui surveille les prix de vols 24/7 et exécute des achats via Stripe (manual-capture hold) ou USDC on-chain quand le timing est optimal.
- **Cible** : B2C freemium SaaS, voyageurs tech-savvy (FR/EN/ES/DE… 25 langues).
- **Tiers** : Free ($0, 1 mission, 3 recherches/jour) → Pro ($9.99/mo, $79/yr) → Elite ($29.99/mo, $249/yr).
- **Différenciateurs déclarés** : auto-buy basé ML, paiements crypto (zéro fees), receipt on-chain.

### 1.2. Stack technique réelle
| Couche | Implémentation | État |
|---|---|---|
| Frontend | Next.js 14.2 App Router, Tailwind, Framer Motion, Zustand, SWR, Sonner, shadcn/ui | Mature (25+ pages) |
| Auth | Privy (wallets) + Worldcoin minikit + Supabase OTP via Resend | Fonctionnel |
| Backend | Vercel Functions (Node 20, maxDuration 300s) | Stable |
| DB | Supabase Postgres (~19 tables : missions, agent_decisions, real_price_samples, etc.) | RLS non vérifiée |
| ML serving | Modal Labs (HTTP, timeout client 8s, cold-start 3-4s) | En shadow mode |
| Paiement | Stripe manual-capture (hold 7-30 jours, capture quand booké) | Live |
| Crypto | OP Sepolia + Base Sepolia testnets, contracts `BudgetPilotReceipt.sol` + `MissionEscrow.sol`, subgraph The Graph | Testnet seulement |
| Email | Resend (OTP, alerts, missions) | Live |
| Cron | GitHub Actions `flyeas-watcher.yml` (q15min) + Vercel cron (`/api/cron/monitor` quotidien 8h) | Actif |
| External APIs | RapidAPI (Sky-Scrapper, Kiwi, Booking, Google Flights2), Amadeus (backup), Anthropic Claude | Configuré |

### 1.3. Pipeline ML/algo — état brutal
**V7.6 Ultra (legacy, orphelin)** :
- 19+ scripts d'entraînement : GP, HMM, QRF, LSTM, TFT, DeepAR, VAE, MAML, CQL, BMA, Copula, BOCPD-EVT, IQN, XGB-meta, plus 11 fondation (Chronos2, TiRex, Moirai2, TimesFM, PatchTST, Mamba, KAN, GARCH-NN, MLCAFormer, TimeGrad, TS2Vec).
- Capture Efficiency p50 : **55.2%** (vs V1 = 42.6%, +12.6 pp), bat V1 sur 59.7% des routes (78 452 routes BTS DB1B 2023-2024).
- **Bloqueurs** : leakage temporel (`01b-expand-temporal.py`), contamination Expedia 2013, BTS T-100 synthétique, données dilwong 6 mois US-only.
- **Plafond** : ~82% capture avec 19 scripts, ~92% max sans données GDS (Amadeus/Sabre).
- **Prod** : aucun de ces modèles n'est appelé. Code dormant.

**V7a (en service partiel, post-Pivot A)** :
- Modèle ML : LightGBM quantile (q10/q50/q90) + isotonic + conformal Mondrian.
- **Échec ML** : sur Kaggle dilwong, ML capture = 88.80% **inférieur** à baseline = **91.15%** sur tous les segments TTD.
- **Décision actuelle** : `ensemble_ttd_switch` déterministe — `rolling_min_30` si TTD ≤ 7j, `simple_quantile_10` si TTD > 7j.
- **Rôle du ML aujourd'hui** : couche de confiance UI uniquement, **non décisionnel**. Target B (`drop_proba`) cassée (≈ 0.99 constant).
- **Auto-buy** : **désactivé partout** (`FLYEAS_AUTOBUY_ENABLED=false` même en mode v7a).
- **Mode actif** : `FLYEAS_ALGO_VERSION=shadow` — V1 décide en prod, V7a logue en parallèle dans `agent_decisions`.

### 1.4. Mécaniques de rétention déjà en place
- **Streak Duolingo-style** : +1 (open), +5 (search), +25 (mission), +100 (book). Freeze tous les 500 pts.
- **Badges** : 6 niveaux (Explorer 5pt → Travel Legend 5000pt) — purement cosmétique.
- **Points/cashback tiered** : 2 pts/$ × multi (1×/3×/5×). 10k pts = $5. Breakage modélisé ~30%.
- **Notifications** : bell + toast (Sonner) + email (Resend). Types : price_drop, booking, proposal, wallet, system.
- **Onboarding** : email OTP + Terms + wallet — **non gamifié**.
- **Referral** : code + lien, +50 pts par parrain.

### 1.5. Gaps "addiction" évidents
1. **Push notifications mobile** : `lib/push-notifications.ts` importé mais **non câblé** (aucun trigger push).
2. **Leaderboards** : code mentionné, **pas wired**.
3. **FOMO/scarcity** : aucun countdown timer, aucune mention "Deal ends in 2h", aucun "X people watching this route".
4. **Daily login reward** : seulement à 500 pts (rare). Pas de spin/scratch quotidien.
5. **Social pressure** : pas de "ton ami a 12 jours de streak".
6. **Onboarding gamifié** : pas de tutorial avec mini-wins (premier search → confetti → premier mission gratuit).
7. **Variable rewards** : tous les rewards sont prévisibles → pas de slot machine.
8. **Loss aversion** : streak cassée silencieusement, pas d'écran "tu vas perdre 47 pts demain".
9. **Telegram/WhatsApp bots** : absents (canal de relance majeur en travel).
10. **Story/replay** : pas de "Wrapped 2026" annuel ni recap mensuel des économies.
11. **Pull-to-refresh dopaminergique** : la page deal n'a pas d'animation slot/spin sur refresh.
12. **Achievement celebrations** : `savings-celebration.tsx` existe mais minimal (pas de plein écran, pas de partage social auto).

### 1.6. Points faibles infrastructure
- RLS Supabase **non vérifiée** (risque cross-user leak).
- `CRON_SECRET` partagé entre Vercel cron + GitHub Actions (single point of compromise).
- Aucune observabilité structurée (pas de Sentry/Datadog/PostHog).
- Pas d'idempotency keys sur Stripe `paymentIntents.capture()` (risque double-charge).
- `real_price_samples` non partitionnée (croissance exponentielle, coût Supabase).
- Subgraph + escrow sur testnets uniquement (revenue tracking on-chain inexistant).
- Modal cold-start 3-4s + timeout client 8s → bascule silencieuse vers V1 (pas d'alerte).

### 1.7. Économie actuelle (modélisée)
| Tier | ARPU/mo | Cashback cost | Net / user / mo |
|---|---|---|---|
| Free (1 booking $400) | $0 | -$0.38 | $9.62 (commission) |
| Pro (2 bookings $400) | $9.99 | -$2.28 | ~$25.71 |
| Elite (3 bookings $400) | $29.99 | -$5.70 | ~$43.30 |

Coût infra à l'échelle (100-500 missions actives) : **$345-2 650/mois** (Vercel + Supabase + Modal + Stripe + RapidAPI + autres).

### 1.8. Verdict synthétique
- **Produit** : squelette complet, UX honorable, freemium fonctionnel.
- **Algo** : actuellement **non différenciant** — V7a ML perd contre baseline simple. Marketing "IA prédictive" non tenu.
- **Addiction** : surface présente (streak, badges) mais **pas de boucles vraiment addictives** (pas de push, pas de FOMO, pas de variable reward, pas de social pressure).
- **Infra** : production-ready avec dette de sécurité/observabilité moyenne.

---

## PARTIE 2 — VISION V8 ORACLE+ADDICT

### 2.1. Objectifs chiffrés
| KPI | Actuel | Cible V8 (12 mois) |
|---|---|---|
| Capture Efficiency p50 | 91.15% (baseline déterministe) | **≥ 96.5%** |
| Win-rate vs marché spot | ~52% | **≥ 70%** |
| Coverage conformal q10-q90 | ~88% | **≥ 92%** |
| D1 retention (free user) | inconnu | **≥ 55%** |
| D7 retention | inconnu | **≥ 35%** |
| D30 retention | inconnu | **≥ 22%** |
| Free → Pro conversion | inconnu | **≥ 6%** |
| Pro → Elite conversion | inconnu | **≥ 12%** |
| Streak médiane DAU | n/a | **≥ 11 jours** |
| Sessions/jour DAU | n/a | **≥ 2.4** |
| Push opt-in rate | 0% (non câblé) | **≥ 60%** |

### 2.2. Algo SOTA 2026 — pile à bâtir

#### Couche données (combler le plafond GDS)
- **GDS premium** : Amadeus Self-Service Production + Travelport NDC API (déblocage live inventory).
- **Web scraping multi-OTA** : Skyscanner, Kayak, Hopper, Google Flights, Kiwi, Booking — dédupliqué en temps réel (proxy résidentiel + browser fingerprinting via Vercel Sandbox pour rotation IP).
- **Macro signals** : FX (BCE/Fed), Brent/jet fuel ($/baril), VIX, calendrier événements (eventbrite, sportcal, conférences), Google Trends route-level.
- **Social signals** : Reddit r/travel + r/awardtravel + Twitter/X mentions par route, TikTok travel hashtags.
- **Inventory signals** : seat-map scraping (load factor en direct via airline sites), cancellation rate par OD-jour-carrier.
- **Volatility regime** : VIX, FX implied vol, oil vol — feature contextuelle pour switch de policy.

#### Couche modèles (architecture mixture-of-experts)
1. **Encoder universel** : foundation model time-series — **TimesFM 2 (Google, fine-tuné)** ou **Chronos-Bolt (Amazon)** pré-entraîné sur ~1B time-series puis fine-tuné sur dataset Flyeas (BTS DB1B 2018-2026 + dilwong + scrapes propriétaires).
2. **Mixture of Experts (8 experts)** par cluster route :
   - Domestic short-haul vs long-haul, transatlantique, transpacifique, intra-EU, intra-Asia, awards/award redemption, low-cost carriers, business/first.
   - Router gating : XGBoost sur features statiques route (distance, carriers, saisonnalité, prix moyen).
3. **Probabilistic forecaster** : **DeepAR + TFT + PatchTST** en ensemble bayésien (BMA) avec quantiles q05/q25/q50/q75/q95.
4. **Changepoint + heavy tails** : **BOCPD-EVT** (Bayesian online changepoint + Pareto tail) pour détecter shocks (grèves, météo, événements géopo).
5. **Counterfactual / causal** : **DoWhy + EconML** pour mesurer effet d'achat sur prix (élasticité par OD-cabin), évite le confounding "j'achète quand prix bas car prix bas baisse encore".
6. **RL policy** : **Conservative Q-Learning (CQL)** + **Implicit Quantile Network (IQN)** entraîné en offline sur historique + simulation **self-play vs revenue management** (modèle EMSR-b airlines simulé) pour robustesse.
7. **World model (Dreamer V3)** : pour planification à horizon TTD variable, hallucination de trajectoires de prix possibles avant décision.
8. **Meta-learner stacking** : **XGBoost + Catboost ensemble** sur les outputs des couches 1-7, avec **calibration conformal adaptive** (mise à jour quotidienne via online conformal — Adaptive Conformal Inference, Gibbs et al. 2024).
9. **Decision layer** : politique Bayes-decision-theoretic — minimise regret pondéré par confiance + prise en compte de l'aversion au risque utilisateur (élu lors de l'onboarding via 3 questions style Kahneman).

#### Pourquoi ce stack bat 96.5% capture
- TimesFM/Chronos résolvent le cold start route (zero-shot ~85%).
- MoE évite la sur-généralisation cross-segment (gain +2-3 pp).
- BOCPD-EVT capture les pics tarifaires invisibles aux quantiles (gain +1-2 pp).
- Causal layer évite les faux positifs "WAIT" sur tendance baissière trompeuse (gain +1-2 pp).
- Self-play RL apprend à exploiter les patterns de revenue management airlines (gain +2-4 pp).
- World model permet la planification multi-step (gain +1-2 pp).
- Conformal adaptive maintient coverage en distribution shift (gain +0.5-1 pp).

#### Infra ML
- **Training** : Modal A100/H100 (managed), runs distribués, MLflow tracking.
- **Serving** : Modal endpoint avec **warm pool** (pas de cold start), fallback graceful Modal → Vercel function (LightGBM léger embarqué) → V1 heuristique.
- **Feature store** : Tecton ou Feast sur Supabase + Redis (Vercel KV via Marketplace : Upstash Redis).
- **Online learning** : drift detection (Evidently AI), retraining hebdomadaire automatique si KS-test > seuil.
- **Shadow → canary → prod** : rollout 1% → 10% → 50% → 100%, gates : capture ≥ baseline + 1pp et regret p95 ≤ 4%.
- **Observabilité ML** : Arize ou Vercel Agent (beta) pour drift, fairness par segment, latence.

### 2.3. UX addictive SOTA — boucles à câbler

#### Boucle 1 — Habit loop quotidien (Hooked, Eyal)
- **Trigger external** : push notif perso intelligente (heure optimale ML — quand l'user check le plus historique). Daily 18-21h, paramètres ajustés par bandit Thompson par user.
- **Trigger internal** : anxiété "ai-je raté un deal ?" → on entretient.
- **Action** : 1 tap → écran "Today's deals just for you" (3 cards swipeable Tinder-style sur les vols).
- **Variable reward** : 30% chance d'un "🎰 Surprise drop" (deal exceptionnel ML-curated), animation slot machine, son distinctif. Le user ne peut pas prédire quand.
- **Investment** : swipe right = ajout watchlist, swipe left = "pas pour moi" → améliore ML perso (collaborative filtering) → user a investi du temps → engagement futur ↑.

#### Boucle 2 — Streak 2.0 (Duolingo + Snapchat)
- Garde le streak existant + ajoute :
  - **Streak freeze automatique** une fois par 7 jours actifs (au lieu de tous les 500 pts).
  - **Streak shield achetable** ($0.99 ou 500 pts) — friction monétisable.
  - **Pair streak** avec un ami (Snapchat-style) — visible publiquement, pression sociale.
  - **Streak halo** sur photo de profil, tier émojis (🌱→🌿→🌳→🔥→🚀→👑).
  - **Push de relance** à H-2 avant expiration : "Tu vas perdre 47 jours de streak !" (loss aversion).

#### Boucle 3 — Mission cockpit dopaminergique
- **Real-time price ticker** sur la page mission (websocket Supabase Realtime), animation pulse à chaque update.
- **Confidence gauge animée** (V7a quantiles → barre de couleur), micro-interaction Framer Motion.
- **"L'agent travaille pour toi" feed live** : "12:34 — vérifié 14 prix, 3 carriers", "12:37 — détecté volatilité +3%", "12:41 — décision : MONITOR (confiance 87%)" → user voit que l'IA bosse pour lui.
- **Decision XAI** : click sur la décision → modal "Pourquoi MONITOR ?" avec top 3 features qui ont influencé (SHAP values vulgarisés).
- **Savings counter** anim qui monte chaque seconde tant que l'agent surveille.

#### Boucle 4 — Onboarding gamifié (mini-quest)
- Étape 1 : "What's your dream destination ?" (carte interactive).
- Étape 2 : Premier search → délivrer un "Welcome bonus deal" curaté (faux positif acceptable, ouvre un modal "🎁 Surprise!").
- Étape 3 : Premier mission gratuite (offre Free upgrade 7 jours sur Pro features).
- Étape 4 : Demande permission push (avec preview "Voici ce que tu vas recevoir").
- Étape 5 : Connexion d'un ami (referral immédiat).
- À chaque étape : confetti, son, +XP, badge unlock.

#### Boucle 5 — FOMO + scarcity
- **Countdown timers** sur deals : "⏱️ Ce prix expire dans 02:34:12" (vrai, basé sur volatilité ML).
- **Live counter** : "👀 14 personnes regardent ce vol en ce moment" (basé sur Supabase Realtime presence).
- **Stock counter** : "Plus que 3 sièges à ce prix" (réel via NDC API).
- **Drop prediction** : "L'IA prédit une hausse de $47 dans 6h" (ML output) → urgence.
- **Lost deal feedback** : si user n'achète pas et le prix monte, push "Tu as raté un deal de $X — l'agent t'aurait fait gagner $Y".

#### Boucle 6 — Social + viral
- **Wrapped 2026** annuel : top destinations, économies totales, miles tracking, partage Instagram story (template + hashtag).
- **Brag-share** : auto-générer carte de la mission réussie ("J'ai économisé $237 sur Paris-Tokyo grâce à @flyeas") → image OG Vercel optimisée.
- **Friends streaks** + leaderboard amis (pas global pour éviter découragement).
- **Group missions** (déjà en code) : finir le câblage — vote sur destinations + paiement split.
- **Referral pyramid** : 50 pts par parrain + 5 pts par filleul du parrain (2 niveaux), capped 1000 pts/mo.

#### Boucle 7 — Loss aversion explicite
- Dashboard : "Tu as économisé $X cette année grâce à Flyeas" (compteur cumulé visible).
- Email mensuel : "Sans Flyeas, tu aurais payé $Y de plus."
- Mission abandon screen : "Tu vas perdre l'analyse ML qui t'aurait fait économiser ~$Z" (calcul conservatif).
- Downgrade Pro → Free : modal "Tu vas perdre : auto-buy, alertes prioritaires, 5× points… Continuer ?".

#### Boucle 8 — Variable reward (slot machine)
- **Daily spin** : 1×/jour, gratuit, gains : 5-50 pts, freeze, coupon, surprise deal, rien (10% chance). Animation slot.
- **Weekly chest** : à 7 jours streak, ouvre une chest avec récompense aléatoire.
- **Mystery deals** : carte verrouillée sur dashboard, débloque à 5 searches/jour.

#### Boucle 9 — Push notifications intelligentes
- **Perso ML** : sujet/corps généré par Claude Sonnet 4.6 avec contexte user (passé behavior, watchlist, fuseau).
- **Triggers** : price drop ≥ 8% on watchlist, agent decision change, streak warning H-2, weekly digest, new badge unlocked, friend booked a deal.
- **Cap** : max 3/jour par user, throttling intelligent (skip si user pas ouvert depuis 5 jours → email à la place).
- **A/B testing** continu via PostHog ou Statsig.

#### Boucle 10 — Telegram/WhatsApp bot
- Bot Telegram avec commandes `/watch <route>`, `/missions`, `/dailydeals`.
- WhatsApp Business via Twilio pour les Elite (concierge AI Claude).
- Réponses streamées avec AI Gateway Vercel (Claude Sonnet 4.6 par défaut, fallback gpt-5).

### 2.4. Refonte infra — non négociable pour V8
| Domaine | Action |
|---|---|
| RLS | Audit complet + politiques par table (missions, agent_decisions, real_*) |
| Observabilité | PostHog (produit) + Sentry (errors) + Vercel Agent (incidents) |
| Feature flags | Statsig ou Vercel Edge Config pour rollouts ML/UX |
| Caching | Vercel Runtime Cache pour features ML, Upstash Redis pour sessions |
| Queues | Vercel Queues pour shadow-log + email batch (au lieu de cron) |
| Workflow durable | Vercel Workflow DevKit pour le watcher (au lieu de GitHub Actions cron) |
| Security | Rotation `CRON_SECRET` mensuelle, idempotency Stripe, BotID Vercel sur endpoints publics |
| Testing | Playwright e2e sur critical path + ML evals automatisés sur PR |
| Mobile | App native Expo + EAS pour push notifications iOS/Android (PWA insuffisant) |

### 2.5. Roadmap proposée 12 mois
| Quarter | Livrable | Owner |
|---|---|---|
| Q1 (Mai-Juil 2026) | Données : intégration Amadeus prod + 5 OTA scrapes + macro features. Ablation V7.6 (suppression code orphelin). UX : push notifs câblées, FOMO timers, daily spin, onboarding gamifié | Data + Frontend |
| Q2 (Aoû-Oct 2026) | Modèle V8 v0 : TimesFM fine-tuné + MoE 4 experts + conformal adaptive. Shadow mode 6 semaines. App Expo en beta TestFlight | ML + Mobile |
| Q3 (Nov 2026-Jan 2027) | RL self-play + world model. Canary 10%. Telegram bot. Wrapped 2026. Group missions GA | Full team |
| Q4 (Fév-Avr 2027) | Prod V8 100%. Activation auto-buy progressive (cap $500 free, $2000 pro, $10000 elite). Mainnet escrow USDC. Subgraph mainnet | Full team |

---

## PARTIE 3 — PROMPT V8 RÉUTILISABLE (à copier-coller dans une nouvelle session Claude/Cursor)

```
Tu es l'architecte tech principal de FLYEAS, une app B2C freemium SaaS Next.js qui surveille les
prix de vols et exécute des achats automatisés. L'app est en production. Repo :
/Users/salahfarhat/Desktop/BudgetPilot_Live (package.json: "flyeas").

ÉTAT ACTUEL CONFIRMÉ (audit 2026-04-25) :
• Stack : Next.js 14 App Router, Supabase Postgres, Modal Labs (ML), Stripe manual-capture,
  Privy + Worldcoin, Resend, GitHub Actions (cron q15min), OP Sepolia/Base Sepolia (testnets).
• ML : V7a en shadow mode. LightGBM quantile + conformal Mondrian → ML capture 88.80% INFÉRIEUR
  à baseline déterministe `ensemble_ttd_switch` (rolling_min_30 si TTD≤7j, quantile_10 sinon)
  qui fait 91.15%. V7.6 (19+ scripts foundation models) plafonné à ~82%, code orphelin.
  Auto-buy DÉSACTIVÉ. Target B (drop_proba) cassée.
• UX rétention présente : streak Duolingo, 6 badges, points 1×/3×/5×, notifs in-app + email,
  referral 50pts. ABSENT : push notifs câblées, leaderboards, FOMO countdowns, daily spin,
  social pressure, onboarding gamifié, Telegram/WhatsApp bot, Wrapped annuel.
• Infra weak : RLS Supabase non auditée, pas de Sentry/PostHog/Datadog, CRON_SECRET unique,
  Stripe sans idempotency, real_price_samples non partitionnée, escrow testnet only.

OBJECTIFS V8 (12 mois) :
• Capture Efficiency p50 ≥ 96.5% (vs 91.15% baseline).
• Win-rate vs marché spot ≥ 70%.
• Coverage conformal ≥ 92%.
• D7 retention ≥ 35%, D30 ≥ 22%.
• Free→Pro ≥ 6%, Pro→Elite ≥ 12%.
• Push opt-in ≥ 60%, sessions/DAU/jour ≥ 2.4.
• Auto-buy activé sur Free (cap $500), Pro ($2000), Elite ($10000) avec gates regret p95 ≤ 4%.

ARCHITECTURE ALGO CIBLE (à implémenter, ordre prioritaire) :
1. Données : Amadeus prod + 5 scrapes OTA (Skyscanner, Kayak, Hopper, Kiwi, Google Flights) via
   Vercel Sandbox + proxy résidentiel. Macro features (FX, jet fuel, VIX, événements). Social
   signals (Reddit, Twitter, TikTok). NDC inventory live (load factor, seat map).
2. Foundation encoder : TimesFM 2 ou Chronos-Bolt pré-entraîné, fine-tuné sur historique Flyeas
   (BTS DB1B 2018-2026 + dilwong + scrapes propriétaires).
3. Mixture of Experts (8 experts) : domestic short/long, transatlantique, transpacifique,
   intra-EU, intra-Asia, LCC, business/first, awards. Gating : XGBoost sur features statiques.
4. Probabilistic ensemble : DeepAR + TFT + PatchTST en BMA, quantiles q05/q25/q50/q75/q95.
5. Changepoint + heavy tails : BOCPD-EVT (Bayesian online changepoint + Pareto tail).
6. Causal layer : DoWhy + EconML pour mesurer élasticité achat→prix par OD-cabin.
7. RL policy : CQL + IQN, offline + self-play vs simulateur revenue management airlines (EMSR-b).
8. World model : Dreamer V3 pour planification multi-step à horizon TTD variable.
9. Meta-stacker : XGBoost + Catboost sur outputs 1-8 + conformal adaptive (Gibbs et al. 2024,
   mise à jour quotidienne).
10. Decision layer : Bayes-decision-theoretic, minimise regret pondéré confiance, intègre
    aversion au risque user (3 questions Kahneman lors onboarding).

UX ADDICTIVE — 10 BOUCLES À CÂBLER (Nir Eyal Hooked + Duolingo + Snapchat) :
1. Habit loop quotidien (push perso 18-21h, swipe deals Tinder, slot machine variable reward).
2. Streak 2.0 (freeze auto, shield achetable, pair streak ami, halo profil, push H-2 loss aversion).
3. Mission cockpit live (websocket Supabase Realtime, decision XAI SHAP, savings counter anim).
4. Onboarding mini-quest (5 étapes confetti+son+XP, premier mission gratuite).
5. FOMO/scarcity (countdown timers vrais, live viewers, stock counter NDC, drop predictions).
6. Social/viral (Wrapped annuel, brag-share OG, friends streaks, group missions, referral 2 niveaux).
7. Loss aversion explicite (savings cumulés visibles, downgrade modal "tu vas perdre…").
8. Variable reward (daily spin, weekly chest, mystery deals).
9. Push notifs intelligentes (Claude Sonnet 4.6, perso ML, max 3/jour, A/B test PostHog).
10. Telegram/WhatsApp bot (Twilio pour Elite, AI Gateway Vercel pour streaming Claude).

INFRA REFONTE :
• PostHog (produit) + Sentry (errors) + Vercel Agent (incidents).
• Vercel Queues pour shadow-log + email batch.
• Vercel Workflow DevKit pour watcher durable (remplace GitHub Actions cron).
• Vercel Edge Config / Statsig pour feature flags ML/UX.
• Upstash Redis (Marketplace) pour sessions + feature cache.
• RLS audit complet Supabase, partitioning real_* tables.
• Idempotency keys Stripe, rotation CRON_SECRET.
• BotID Vercel sur endpoints publics scrapés.
• App native Expo + EAS pour push iOS/Android (PWA insuffisant).
• Mainnet escrow USDC (sortie testnet) + subgraph The Graph mainnet.

ROADMAP 12 MOIS :
• Q1 : données Amadeus+OTA+macro, ablation V7.6, push+FOMO+spin+onboarding gamifié.
• Q2 : V8 v0 (TimesFM + MoE 4 experts + conformal adaptive), shadow 6 semaines, beta Expo.
• Q3 : RL self-play + world model, canary 10%, Telegram bot, Wrapped 2026, group missions GA.
• Q4 : V8 prod 100%, auto-buy activé progressif, mainnet USDC, subgraph mainnet.

CONTRAINTES :
• Budget Modal $300/mo max V8 v0, $1500/mo full stack.
• Privacy-first : aucun PII en clair côté client, RLS strict, GDPR/CCPA compliant, consent_logs.
• Aucun dark pattern manipulatoire (FOMO doit être basé sur données réelles, pas faux).
• Aucune metric-only feature : chaque ajout doit améliorer rétention ET conversion ET capture.

LIVRABLES IMMÉDIATS :
1. Audit RLS Supabase (script + corrections).
2. Câblage push notifications (web push + APNS/FCM).
3. Daily spin + variable reward UI.
4. Onboarding gamifié (5 étapes).
5. Countdown FOMO sur mission cockpit.
6. Intégration Amadeus prod + premier OTA scrape (Skyscanner via Vercel Sandbox).
7. Decision XAI modal (SHAP simplifié).
8. Plan migration GitHub Actions cron → Vercel Workflow.
9. Setup PostHog + Sentry + Vercel Agent.
10. Spec V8 v0 (TimesFM fine-tune, MoE 4 experts, conformal adaptive) — design doc + plan training Modal.

Commence par le livrable 1 (audit RLS) et propose le plan d'exécution complet pour les 10
livrables avec dépendances, estimations de durée, et risques majeurs. Demande mes priorités
avant d'écrire du code. Reste critique : si une décision n'a pas de sens (data manquantes,
budget irréaliste, dette technique cachée), challenge-moi.
```

---

## PARTIE 4 — POINTS DE VIGILANCE

### 4.1. Risques majeurs
1. **ML over-engineering** : V7.6 a essayé 19 modèles, échec. V8 doit prouver chaque couche en ablation avant ajout. Don't repeat.
2. **Dark patterns** : la frontière entre "addictive" et "manipulatoire" est étroite. Toute mécanique doit être basée sur signal réel (un countdown timer FOMO sur prix qui ne change pas est mensonger → churn dur quand l'user comprend).
3. **Activation auto-buy** : si V8 fait perdre $X à un user, churn instant + risque RGPD (responsabilité automatisée). Cap progressif obligatoire + opt-in explicite + insurance fund (1% de la commission mise de côté pour rembourser les achats sous-optimaux).
4. **Coût Modal** : RL self-play + world model = GPU intensive. Budget réaliste $1500-3000/mo en cruise. Modèle économique doit tenir.
5. **Privacy/RGPD** : push notifs perso = traitement données comportementales. DPA + privacy by design + consent granulaire.
6. **Scrape légal** : Skyscanner/Kayak/Booking ont des CGU strictes. Préférer NDC officiel + Amadeus + partenariats affiliate qu'un scrape massif sans accord.
7. **Onchain ≠ valeur** : sortir du testnet a des coûts réels (gas, audits Solidity). Si l'usage est nul → cost > value. Décision honnête à prendre Q4.

### 4.2. Décisions à prendre maintenant (avant d'écrire du code V8)
1. **Geo focus** : USA-only (BTS data) ou multi-régions (besoin GDS Europe + Asia) ?
2. **Mobile** : PWA suffisante ou app native Expo prioritaire ? (impact push opt-in)
3. **Crypto** : on continue testnet ou kill switch et focus Stripe ?
4. **Pricing** : tester $14.99 Pro / $49.99 Elite (price elasticity inconnue) ?
5. **Auto-buy** : on garde l'objectif ou on pivote vers "human-in-the-loop" 1-tap (moins risqué, conversion meilleure) ?
6. **B2B** : ajouter API entreprise (corporate travel) qui paye 10× le B2C ?
7. **Build vs buy** : Hopper a 5 ans d'avance et 10M users. Pivot vers niche underserved (awards travel ? business class deals ? group travel ?) ?

### 4.3. À ne PAS faire
- Ne pas remettre les 19 modèles V7.6 en prod tant que l'ablation n'a pas montré gain.
- Ne pas activer auto-buy sans 6 semaines minimum de shadow validé.
- Ne pas ajouter de gamification sans mesurer l'impact rétention (PostHog d'abord).
- Ne pas scaler scraping sans accord légal (risque cease & desist, IP ban).
- Ne pas mainnet escrow sans audit Solidity ($30-80k).

---

**FIN DE L'AUDIT.** Demande à l'auteur (Salah/Amine) ses priorités sur les 10 livrables immédiats avant lancement V8.
