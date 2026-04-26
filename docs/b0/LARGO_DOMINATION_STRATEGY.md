# Largo — Domination Strategy

> **Status:** B0 (pre-implementation framing). Strategic blueprint, not implementation guide.
> **Audience:** product, engineering, ML, growth, future hires, future investors.
> **Author:** Flyeas team.
> **Last updated:** 2026-04-26.
> **Related docs (to come):** `LARGO_PRODUCT_VISION.md`, `LARGO_ADVICE_CONTRACT.md`, `LARGO_EVALUATION_PLAN.md`, `LARGO_SECURITY_PAYMENTS.md`, `LARGO_DATA_STRATEGY.md`, `LARGO_MODEL_STRATEGY.md`, `LARGO_BACKEND_API_SPEC.md`, `LARGO_FRONTEND_UX_SPEC.md`, `LARGO_COMPETITIVE_BENCHMARK.md`, `LARGO_GO_TO_MARKET.md`.

---

## 0. Executive Summary

Flyeas builds **Largo**, a decision-support layer that aims, over time, to become the **number one travel decision system** — measured by advice quality, regret reduction, user trust, auto-buy safety, personalization, bundle quality, and progressively prediction performance on the segments where our proprietary data becomes superior.

We do not start by competing head-on with incumbents (Hopper, Kayak, Google Flights) on generic spot-price prediction. That terrain rewards data volume and inventory partnerships we do not yet have. We build a different category first — **mission-based decision quality** — and use it to accumulate proprietary intent and outcome data. Once that data flywheel matures, we extend our advantage into prediction itself, on the segments where our data is structurally richer than what incumbents can collect from their search-driven funnels.

This strategy is built on five durable moats: proprietary mission-intent data, escrow-backed safe auto-buy, multi-product bundle decision, calibration honesty as cultural posture, and a unified multi-product engine. None of these moats are reproducible by incumbents without cannibalizing their existing funnel. Each moat reinforces the others.

This document lays out the path from today (V7a in passive shadow observation, no Largo code) to long-term category leadership and beyond. The aspiration is global #1; the path is sequenced and measurable.

---

## 1. The Core Thesis

> **Decision quality under uncertainty is a different problem from price prediction at scale. We win first by redefining the question, then by extending our edge into prediction itself.**

The dominant frame in travel tech is "given this query, what's the best price right now?". That frame favors incumbents with massive inventory and historical data.

The Flyeas frame is: "given this user's budget, window, and constraints, what's the best decision sequence over the next N days, with calibrated uncertainty, with safe execution, with transparent reasoning?".

These are two fundamentally different problems:
- The first rewards data volume and inventory negotiation.
- The second rewards calibration, transparency, longitudinal observation, and trust architecture.

Largo competes on the second problem first. As mission-based data accumulates over years, the data shape we collect (intent + trajectory + outcome) becomes structurally different from what incumbents collect (search snapshots). On segments where this richer data dominates, we aim to outperform incumbents on prediction quality too. That is the long-game extension.

---

## 2. Why "Generic Price Comparator" Is Not Our First Battle

| Asymmetry | Incumbent advantage *(estimated, order of magnitude — to be verified in `LARGO_COMPETITIVE_BENCHMARK.md`)* | Our position |
|---|---|---|
| Historical price data | Multiple orders of magnitude more price points | ~3.3M Kaggle dilwong rows (2022, 235 US routes) |
| Inventory negotiation | GDS / airline partnerships | None today |
| ML team size | Tens of engineers | One |
| ML compute budget | Multi-million-dollar GPU clusters | Modal CPU |
| Brand & user base | Tens of millions of users | Pre-launch |
| Marketing budget | Hundred-million-dollar class | Bootstrap |
| A/B testing velocity | Continuous, multivariate, large samples | Slow, low traffic |
| Provider freshness | Partner-fed continuous streams | Cron 2×/day via RapidAPI fallback chain |

> *Numbers above are order-of-magnitude assumptions. Exact figures will be sourced and verified in `LARGO_COMPETITIVE_BENCHMARK.md`. They illustrate scale gaps, not precise claims.*

Trying to compete on accuracy of generic spot price prediction in Phase 0/1 is structurally unfavorable. Our data and compute moats are too small relative to the question. We do not pursue this battle yet.

This does not mean we abandon prediction. It means we choose **when** to play that game: after we have built data assets the incumbents cannot replicate. Frame discipline is part of the strategy. Any communication, internal or external, claiming "we predict prices better than Hopper" today is refused — until and unless we publish a reproducible benchmark on a defined segment.

---

## 3. The New Ground: Travel Fiduciary Agent (the Wedge)

Largo establishes a new product category: an algorithmic agent that acts in the user's strict interest, with a defined mission, a defined budget, defined constraints, and the authority to execute conditionally with explicit safeguards.

This category is the **wedge**, not the destination. It is the entry point that lets us build the data and trust assets needed to compete more broadly later.

Structural differences with the incumbent category:

| Dimension | Comparator/aggregator (incumbents) | Largo / Fiduciary Agent |
|---|---|---|
| Entry point | Search box | Mission setup |
| User horizon | Minutes | Weeks |
| Success metric | Conversion, revenue per visitor | Realized regret reduction, retention, dispute rate |
| Stance on waiting | Pushes the buy | Recommends waiting when it's better for the user |
| Decision style | Reactive (post-search) | Proactive (post-monitoring) |
| Primary surface | Result list | Mission timeline |
| Buy authority | Manual click | Conditional auto-buy with audit trail |
| Trust model | Implicit (brand) | Explicit (audit, reasons, escrow) |
| Bundle handling | Three separate funnels | Unified budget allocation |

This category is essentially uninhabited. Hopper has "Watch this trip" but it is a sidecar feature serving its main funnel. Largo treats this category as the entire product.

Incumbents cannot pivot to it without cannibalizing their conversion-driven business. That structural resistance is our wedge.

---

## 4. The Five Moats

In order of strategic importance and time-to-build.

### Moat 1 — Mission-Intent Data (3–5 years to mature)

Each mission captures (initial intent, hard constraints, soft preferences, monitoring trajectory, advice history, user acceptance, final outcome). One mission ≈ 100× richer than one search query *(structural estimate — not a measured benchmark)*.

Why it is hard to reproduce:
- Incumbents cannot ask for "your full constraints" without breaking their search funnel completion rate.
- Capturing intent requires a mission-first product, which is incompatible with their architecture.

At 10K+ complete missions × ~100 observations × rich context, we have a dataset that does not exist anywhere else. This is the structural moat — and the foundation for our eventual move back into prediction (see Superiority Ladder, Section 6).

### Moat 2 — Escrow + Audit Trust Layer (1–2 years)

Triple-condition auto-buy, immutable audit, public anonymized audit page, automatic refund on provider failure, kill switch, idempotency keys.

Why it is hard to reproduce:
- Building it slows down conversion → incumbents are structurally disincentivized.
- Once we have the audit page public, copying it after-the-fact looks reactive, not principled.
- This is a posture moat reinforced by a technical moat.

### Moat 3 — Bundle Decision Graph (2–3 years)

Joint flight + hotel + car decision under a global budget, with cross-product timing optimization (e.g., "the flight market is volatile, lock the hotel first").

Why it is hard to reproduce:
- Meta-search engines are organized vertically by product. They lack the unified contract.
- Optimizing jointly requires shared modeling and a shared advice contract — architectural decisions easier to make from scratch.

### Moat 4 — Calibration Culture (cultural, durable)

Largo systematically refuses to fake confidence. Every advice is calibrated. Every "BUY_NOW" has reasons. Every "ABSTAIN" is publishable. Every dark pattern is forbidden.

Why it is hard to reproduce:
- Imitating this posture later costs short-term conversion → incumbents won't pay that cost.
- First-mover advantage on honesty: any later imitator faces "you were lying before".
- Publishing methodology and calibration metrics turns this into evidence-based positioning.

### Moat 5 — Unified Multi-Product Decision Engine (technical)

One endpoint (`/api/largo/advice`) handles flights/hotels/cars/bundles with a single contract.

Why it is hard to reproduce:
- Incumbents have inherited verticals; consolidation is expensive and risky for them.
- We carry no legacy → architectural simplicity is our luxury.
- Once unified, every new product (cruises, trains, activities) ships as configuration of an existing engine, not as a new build.

---

## 5. Outflanking the Data Advantage

We do not match incumbent data volume directly. We capture data they cannot capture, and we let it compound.

### 5.1 Capture intent, not just searches

Every search query, anonymized and opt-in, gets logged with context. At meaningful scale, segment-level intent patterns emerge. This is data that is hard to collect in funnels that prioritize speed-of-search.

### 5.2 Mission as the unit of data

A mission is a complete narrative: initial conditions → monitoring trajectory → decisions → outcome. Each mission yields enriched, causally-interpretable observations — a property that scraped generic price data does not have.

### 5.3 Explicit feedback loop

Post-mission survey: "Did the advice help? Did you find better elsewhere? At what price?". Even at low response rates, this provides external signal that no incumbent dataset includes.

### 5.4 Provider cross-check telemetry

When two providers disagree on a price, we log the disagreement. The dataset of "where do markets diverge?" is itself a research asset.

### 5.5 User price telemetry

When a user clicks through to an external partner and returns, we ask "Did you book? At what price?". Even sparse, this is ground truth on inventory at decision time.

### Volume target (internal aspiration)

| Year | Missions | Enriched observations | Mission outcomes captured |
|---|---|---|---|
| Year 1 | ~1,000 | ~100,000 | ~250 |
| Year 2 | ~10,000 | ~1,000,000 | ~2,500 |
| Year 3 | ~100,000 | ~10,000,000 | ~25,000 |

> *Volumes above are internal aspirations contingent on growth, not commitments.*

At Year 3 volume, we can train models that no one else can train, because the data shape is unique to our product. This is when prediction-quality extension (Superiority Ladder rung 7) becomes attainable.

---

## 6. Superiority Ladder

Largo's superiority compounds across seven rungs. Each rung is independently valuable; together they form the path to category leadership and beyond.

| Rung | Dimension | What it means concretely | What evidence proves it |
|---|---|---|---|
| 1 | **Trust / Clarity** | Largo says "I don't know" when uncertain; reasons accompany every advice; no dark patterns. | Public audit page; calibration ECE published; user-reported trust scores. |
| 2 | **Mission-Based Advice** | Continuous monitoring over a defined window with budget and constraints; proactive notifications gated to actionable signals. | Mission completion rate; notification spam ratio; user-reported usefulness. |
| 3 | **Regret Reduction** | Users who follow Largo pay less than naive baselines (e.g., always-buy-now). | Realized regret per mission; vs counterfactual baseline; per-segment breakdown. |
| 4 | **Personalization** | Advice adapts to user history, preferences, observed flexibility. | Segmented regret reduction; per-user calibration; A/B against non-personalized variant. |
| 5 | **Safe Auto-Buy** | Auto-buy executes only under triple-condition, audit-immutable, refund-automatic, kill-switchable. | Dispute rate; refund rate; audit completeness rate; security incident count. |
| 6 | **Bundle Multi-Product** | Joint flight + hotel + car decision under global budget produces measurably lower total cost than three separate searches. | Bundle savings vs separate-search baseline; bundle completion rate; cross-product timing accuracy. |
| 7 | **Segment-Level Prediction Superiority** | On the segments where our proprietary mission data is structurally richer than incumbents' search data, we outperform them on prediction accuracy. | Reproducible head-to-head benchmark on defined segments; published methodology. |

**Direction of progress.** Rungs 1–3 are reachable in Phase 1 (MVP). Rungs 4–6 emerge during Phase 2–3. Rung 7 is a Phase 3–4 ambition, contingent on the data flywheel working as projected. We do not claim a rung publicly until we have evidence for it — see Section 13.

This ladder defines what "becoming #1" means for Flyeas. We do not promise all rungs at launch. We commit to climbing each one with measurable proof.

---

## 7. Where We Can Win First vs Where We Win Later

### Quick wins (now → ~3 months, mostly in Phase 0–1 framing and MVP)

- **Honest "ABSTAIN" advice** when route data is insufficient. No competitor does this.
- **Reasons array** on every advice. Causal, copy-pasteable into support emails.
- **Calibration discipline** as engineering culture. Pipeline ECE check before any model deploy.
- **Mission timeline UI** as a primary surface, not a sidecar.
- **Public audit page** initialized (even if empty until auto-buy enabled).
- **Refusal of dark patterns** documented explicitly (interview test rule).

### Six-month wins (Phase 1 active, early Phase 2)

- **Calibrated `LargoAdvice` in production** for flights with internal target ECE < 0.05.
- **Mission completion rate** measurable across hundreds of active missions.
- **Search-time advice cards** providing instant value without registration.
- **First cohort of safe auto-buys** (single-digit users, full audit trail).
- **Regret reduction measured** on completed missions vs baseline (internal target).

### Twelve-month wins (Phase 2 mature, early Phase 3)

- **Hotel integration** in the same `LargoAdvice` contract.
- **Bayesian per-route updating** absorbing drift continuously.
- **First public whitepaper** with calibration and regret evidence.
- **Auto-buy expanded to ~1,000 cohort** with maintained dispute rate.
- **Personalization v1** based on user history.
- **Bundle decision (flight + hotel) v1** with measured savings.

### Twenty-four-month-plus wins (Phase 3–4)

- **Bundle decision (flight + hotel + car)** as a flagship capability.
- **Proprietary models** on mission-data shapes that competitors cannot reproduce.
- **Segment-level prediction superiority** demonstrated and published.
- **B2B API** as revenue stream and credibility lever.
- **International expansion** with localized providers.
- **Inventory partnership negotiations** unlocked by scale.
- **Native mobile app**.

> Each wins-bracket is conditional on the previous bracket's evidence. We do not skip rungs.

---

## 8. Largo in Simple Search Mode

Even without a mission, Largo provides value.

### Behaviour

When a user runs a simple search (flight / hotel / car), Largo returns a `LargoAdvice` alongside the result list with calibrated action, confidence, price assessment, reasons, and short message. Detailed contract is in `LARGO_ADVICE_CONTRACT.md`.

### Sample messages (testable, not final)

| Case | Short message |
|---|---|
| Strong buy, high confidence | "Good price — buying now is reasonable." |
| Buy, modest confidence | "Reasonable price, but waiting may improve it." |
| Wait recommended | "Above-average price. We'd watch a bit longer." |
| Insufficient route data | "Not enough data on this route to advise. You can start a watch." |
| Provider disagreement | "Price not yet verified across sources. Holding advice." |
| ML layer down | "Advice limited today (deep analysis temporarily unavailable)." |

### Hard rules

- No "BUY_NOW" message displayed if `confidence < 0.5`.
- Always offer an escape ("start a watch") when advice is uncertain.
- Never show urgency timers, "X people viewing", or fake scarcity.
- Always show `reasons` when the user clicks "Why?".

---

## 9. Largo in Mission Mode

When a user creates a mission, Largo runs continuously over a window with explicit budget and constraints.

### Behaviour

- **Daily monitoring**: cron-driven scans, mission-specific.
- **Conditional advice**: each scan produces a `LargoAdvice` evaluating the current price against thresholds and historical context.
- **Notification gating**: notifications only when advice changes meaningfully.
- **Auto-buy authorization**: if and only if all triple-condition gates pass simultaneously.

### Mission timeline UI principle

The mission dashboard is **temporal, not list-based**. The user sees observed prices over the window, advice markers, alerts, budget burn-down, and action history. The product is the trajectory.

### Hard rules

- Auto-buy is opt-in by default-off; explicit per mission.
- Auto-buy threshold ≤ budget cap.
- Limit one auto-buy per mission, three per user per month (Phase 1, revisable).
- Every auto-buy generates an audit row before Stripe capture.
- Stripe pre-authorization first; capture only after triple-condition validation.
- 1-hour grace period for refund post-capture (where provider terms allow).

---

## 10. Multi-Product Evolution

Largo evolves from single-product to bundle decision.

### Stage A — Flights only (Phase 1 MVP)

Most existing infrastructure (V7a, baseline, providers). Clearest decision shape. Validated metrics from V7a backtest.

### Stage B — Hotels added (Phase 2)

Added to `LargoAdvice` with a different decision shape (lock-in vs flexibility). Same advice contract, different internal model.

### Stage C — Cars added (Phase 2 late or Phase 3)

Third product axis. Quasi-stable prices but availability volatility near pickup.

### Stage D — Bundle decision (Phase 3)

Joint optimization under a global budget. Allocate across components; lock the most volatile first; reserve flexibility on stable components. Each component still produces a `LargoAdvice` with a `bundle_context` field linking them.

This stage is where Largo becomes structurally non-replicable by vertically organized incumbents.

---

## 11. Ethical Addictiveness

Engagement is built through repeated proven utility, not psychological manipulation.

### Sustainable engagement patterns (use)

- "We saved you $X" history, verifiable, audit-linked.
- Actionable-only notifications.
- Mission timeline visualization (narrative engagement).
- Search-time advice cards (instant value).
- Snooze controls without pressure.
- Onboarding under 30 seconds, explicit about uncertainty.
- Public audit page.
- Calibration metrics published (after evidence).

### Forbidden patterns (refuse)

- Red urgency timers and FOMO countdowns.
- Unverified scarcity claims ("Only X left!").
- Daily notifications without new signal.
- Default-on auto-buy.
- Fake reviews / testimonials.
- Comparative claims without methodology.
- Hidden cancel buttons or guilt-trip dismissal modals.
- Single-click auto-buy confirmation.
- Selling user data.

### The interview test

A feature ships only if it passes this test: **"Could I defend this on stage at a press interview, with a reporter looking for dark patterns, and feel comfortable?"**. If "probably not", it does not ship.

---

## 12. Auto-Buy Safety Architecture

The single highest-risk surface of the product. A failure here destroys trust permanently.

### Required guardrails (all mandatory before any auto-buy)

1. Triple condition: `advice.action == 'BUY_NOW'` ∧ `advice.confidence ≥ 0.7` ∧ `advice.can_autobuy == true`.
2. Three explicit consents at three different moments: mission creation, threshold setup, per-execution notification window.
3. Idempotency key: `mission_id + advice_id + price`, enforced at Stripe payment intent level.
4. Budget cap: capture limited to `mission.budget_deposited`; never exceeded.
5. Kill switch: env var disables every auto-buy across the platform without redeploy.
6. Immutable audit row: written before Stripe capture, with full advice payload + consent timestamps.
7. 1-hour rétractation: cancel within 1 hour with full refund (where provider allows).
8. Rate limiting: 1 auto-buy per mission, 3 per user per month (Phase 1, revisable).
9. Notifications: email + SMS within 60 seconds of capture, with full advice and "cancel" button.
10. Provider failure refund: automatic Stripe refund within 24h if booking fails after capture.

### Cohort schedule for auto-buy rollout

- Phase 1: zero auto-buys executed.
- Phase 2 cohort step 1: ~10 users.
- Phase 2 cohort step 2: ~100 users.
- Phase 2 cohort step 3: ~1,000 users.
- Phase 3+: scale conditional on dispute rate < 0.5 % maintained.

> Each cohort step ships only after the previous cohort's safety metrics are measured and validated. We do not scale auto-buy on optimism.

### Vulnerabilities to anticipate

| Risk | Mitigation |
|---|---|
| Stale or fake provider price | Cross-check 2 providers; reject if disagreement > 10 %. |
| Race condition double-charge | Idempotency key at Stripe level. |
| Compromised account | 2FA required to enable auto-buy. SMS verification before each capture. |
| Hidden costs (baggage, change fees) | Display total price including known provider fees. |
| Currency mismatch | Lock FX rate at advice generation; advice expires within 6h. |
| Phishing | Notifications via verified channels only; no click-to-buy in email. |

### What is forbidden in Phase 1

- Auto-buy enabled by default.
- Auto-buy on routes flagged `route_unknown_to_model`.
- Auto-buy when ML layer is down.
- Auto-buy beyond a hard cap (Phase 1: TBD in `LARGO_SECURITY_PAYMENTS.md` based on risk, geography, provider reliability, and payment constraints), tunable.

---

## 13. Proving We're Better — Measurable Definitions

We do not claim "better" without published evidence. Each axis has an internal target and a publication condition.

| Axis | Metric | Internal target | Publication condition |
|---|---|---|---|
| Calibration | ECE on `BUY_NOW` advices | < 0.05 | Public only after measured for ≥ 1 quarter at scale. |
| Honesty | Fraction of advices with `action='ABSTAIN'` when truly uncertain | > 15 % | Public via audit page once auto-buy is enabled. |
| Regret reduction | Average user regret vs "always BUY_NOW" baseline | -50 % to -70 % | Public after ≥ 1,000 completed missions and reproducible methodology. |
| Auto-buy safety | Stripe dispute rate on auto-buys | < 0.5 % | Public via audit page once cohort step 2 reached. |
| Bundle savings | Average savings of bundle vs three separate searches | > 8 % | Public after ≥ 100 completed bundle missions. |
| Mission completion | Missions reaching auto-buy or manual purchase on advice | > 25 % | Internal first; public sample after Phase 2. |

We never publish "Largo is better than Hopper" without:
- A defined metric.
- A defined segment.
- A reproducible methodology.
- A counterfactual baseline.
- Evidence collected at meaningful scale.

This discipline is non-negotiable. **Targets above are internal goals, not public commitments**, until evidence is measured at scale.

---

## 14. Useful Models for the Long Game

Models are tools, ranked by expected ROI on our scale.

### Phase 1 (MVP)

- `ensemble_ttd_switch` baseline composite (validated: regret_abs_mean $58.33 on V7a backtest, n=11,750 trips).
- LightGBM quantile (q10/q50/q90) — already trained, not yet served.
- Mondrian conformal prediction — already calibrated.
- Isotonic calibration — already available.
- Hazard / time-to-better-price (logistic or Cox) — to design, simple.

Total: 5 models, all tabular, all explainable. No more in MVP.

### Phase 2 (data flywheel)

- Bayesian online posterior per route (drift absorption).
- Multi-task LightGBM (flight / hotel / car).
- Contextual bandits for copy / messaging (does not change decisions).
- Anomaly detector (IQR or isolation forest) for outlier flagging.

### Phase 3 (advanced models on proprietary data)

- Optimal stopping (Bayesian) over the mission window.
- Joint multi-product hazard models for bundle timing.
- User embedding for personalization.
- LLM (compact, fine-tuned) for explanation generation. **Never for decision.**

### Phase 4 (domination — conditional on data volume)

- Time-series transformers (PatchTST, Mamba), evaluated only if scale justifies.
- Offline contextual RL on mission outcomes.
- Stacking ensembles (BMA, copula) only if proven gain on backtest.

Every transition between phases requires a quantified business gain, not a research curiosity.

---

## 15. Sophisticated Models to Avoid Now

| Model family | Why we avoid in Phase 1–2 |
|---|---|
| Foundation TS models (Chronos2, TIRex, Moirai2, TimesFM) | Slow inference, GPU-heavy, marginal gain over LightGBM on tabular at our scale. The V7.6 Ultra ceiling at ~82 % capture is direct evidence of diminishing returns from heavy stacks at our data scale. |
| Deep online RL | Demands millions of episodes; brittle; opaque. |
| LLM agents for decisions | Hallucinations on financial advice are unacceptable. |
| MCTS / heavy planning | Overkill for a binary BUY/WAIT decision. |
| Gaussian Processes at scale | O(n³) scaling; not viable at >10K points per route. |
| 6-state HMM regimes | Hard to calibrate without years of data. |
| GARCH / volatility modeling | Noise > signal on flight prices. |
| Black-box ensembles without conformal | Destroys explainability, kills the trust moat. |
| AutoML pipelines for decisions | Overfit risk + opacity. |

Hard rule: **at most 5 active models in Phase 1, 8 in Phase 2**. Beyond that, audit becomes infeasible and the trust moat erodes.

---

## 16. Roadmap — Four Phases (Milestone-Based)

Phases are gated by milestones and evidence, not by calendar deadlines. Order-of-magnitude durations are given for planning context, not as commitments.

### Phase 0 — Framing (now → V7a-7 closed)

**Status:** open, in progress.

**Goal:** produce strategic and technical framing documents for Largo, without touching any code.

**Deliverables (all in `docs/b0/`, in priority order):**
1. `LARGO_DOMINATION_STRATEGY.md` (this document).
2. `LARGO_PRODUCT_VISION.md`
3. `LARGO_ADVICE_CONTRACT.md`
4. `LARGO_EVALUATION_PLAN.md`
5. `LARGO_SECURITY_PAYMENTS.md`
6. `LARGO_DATA_STRATEGY.md`
7. `LARGO_MODEL_STRATEGY.md`
8. `LARGO_BACKEND_API_SPEC.md`
9. `LARGO_FRONTEND_UX_SPEC.md`
10. `LARGO_COMPETITIVE_BENCHMARK.md`
11. `LARGO_GO_TO_MARKET.md`

**Exit gate:** V7a-7 final decision committed. Without it, Largo design lacks foundation.

*Order-of-magnitude duration: ~2–3 weeks of writing alongside V7a observation.*

### Phase 1 — Largo MVP (starts when V7a-7 is closed)

**Goal:** implement Largo flights-only, missions-only, in shadow mode. No auto-buy execution.

**Outputs:**
- Endpoint `POST /api/largo/advice`.
- Supabase table `largo_advices` (immutable audit).
- Frontend components: `AdviceCard`, `MissionTimeline`.
- Active models: 5 tabular models per Phase 1 list.
- Calibration metric (ECE) measured and tracked.
- Latency budget: p95 < 800 ms.
- Public audit page initialized (empty until auto-buy enabled).

**Exit metrics (internal):**
- ~100 active missions.
- ECE confidence < 0.07.
- Zero auto-buys executed.

**Exit gate:** auto-buy guardrails fully validated; calibration confirmed.

*Order-of-magnitude duration: ~3 months active engineering.*

### Phase 2 — Data Flywheel (starts when MVP logs enough interactions)

**Goal:** enable auto-buy in tightly controlled cohorts; accumulate proprietary data; extend to hotels.

**Outputs:**
- Auto-buy enabled in cohorts: ~10 → ~100 → ~1,000 users.
- Hotel integration in `LargoAdvice` contract.
- Bayesian online updating per route.
- Contextual bandits for messaging.
- ~1,000 complete missions accumulated.
- First public whitepaper on calibration and regret reduction (after evidence threshold).

**Exit metrics (internal):**
- ~1,000 active missions.
- Auto-buy dispute rate < 1 %.
- Average user savings positive.
- ECE confidence < 0.05.

**Exit gate:** data flywheel proven; 30-day retention milestone reached (target: > 30 %).

*Order-of-magnitude duration: ~5 months active engineering.*

### Phase 3 — Advanced Models on Proprietary Data (starts when proprietary data volume justifies)

**Goal:** leverage 10K+ missions and 1M+ enriched observations to train models specific to Flyeas.

**Outputs:**
- Multi-task models across flight / hotel / car.
- User embeddings.
- Optimal stopping over mission windows.
- Car integration.
- Bundle decision as first-class capability.
- Optional B2B API.

**Exit metrics (internal):**
- ~10,000 active missions.
- Bundle savings > 8 % vs separate-search baseline.
- Mean regret < $50 (vs $58 V7a baseline).
- 30-day retention > 25 %.
- First Superiority Ladder rung 7 evidence (segment-level prediction wins).

**Exit gate:** published competitive evidence on calibration and regret. Reproducible head-to-head benchmark on at least one segment.

*Order-of-magnitude duration: ~12 months.*

### Phase 4 — Multi-Product Domination (starts when metrics prove durable moat)

**Goal:** become the reference for mission-based travel decisioning, with extension into prediction superiority on segments where our data dominates.

**Outputs:**
- 100K+ active missions.
- Transformer time-series models on proprietary data, if measured ROI justifies.
- Public B2B API as revenue stream.
- Inventory partnership negotiations enabled by scale.
- International expansion.
- Native mobile.

**Exit metrics (internal):**
- ~100,000 active missions.
- Industry recognition (press, conferences, reproducible benchmarks).
- Auto-buy dispute rate < 0.3 %.
- Multiple Superiority Ladder rungs demonstrated publicly.

**Exit gate:** category leadership on Travel Fiduciary Agent **and** demonstrable prediction superiority on defined segments.

*Order-of-magnitude duration: 24+ months from now, contingent on the prior phases.*

---

## 17. Open Decisions

To be resolved before Phase 1 implementation:

1. Subscription pricing tiers. Free/Pro split, monthly vs annual, region-specific.
2. Auto-buy maximum dollar cap in Phase 1. TBD in `LARGO_SECURITY_PAYMENTS.md` based on risk, geography, provider reliability, and payment constraints.
3. Hotel and car provider selection.
4. Public audit page design (anonymization, freshness, exposed fields).
5. Calibration publication cadence.
6. Whitepaper authorship and review.
7. Open source scope (advice contract, baselines, metrics vs proprietary).
8. Legal disclaimers (US vs EU).
9. Data retention policy (mission data, deletion rights).
10. Phase 2 cohort sizing schedule for auto-buy rollout (risk-graduated).

Each open decision becomes a section in subsequent B0 documents.

---

## 18. Document Status

- **B0 framing only.** This document does not authorize implementation.
- **Implementation requires:** V7a-7 documented, the remaining 10 B0 documents written and validated, explicit founder authorization.
- **Revisions:** any update to this document requires a changelog entry and review.
- **Authority:** strategic source of truth for Largo. Subordinate to founder decisions; superior to per-feature implementation plans.

---

## Annex A — Internal Reality Check (2026-04-26)

> Honest snapshot of current state. Kept internally to prevent strategic drift into wishful thinking. The strategic body of this document is ambitious; this annex anchors it in observable facts.

- V7a is in shadow observation. Decision V7a-7 not rendered.
- `agent_decisions` has 7 rows (2026-04-25), all from Sky-Scrapper, one calendar day, four distinct routes.
- Cron `demo-shadow-sweep` runs 2×/day on Vercel Pro since 2026-04-26.
- `ml_available` is `false` in 100 % of rows; `confidence` correctly NULL.
- `ensemble_ttd_switch` validated on offline backtest only (n=11,750 trips, 2022 data).
- No production ML model currently serves decisions.
- Stripe escrow infrastructure exists but is unexercised at scale.
- ~35 ML modules exist in the repo (V7 TS, V7.6 Ultra) but are dormant; not connected to production.
- Brand recognition outside the founding team: zero.
- Active engineers on the moteur: one.

This annex is updated quarterly. The body of the document is updated when strategic direction shifts.

---

*End of document.*
