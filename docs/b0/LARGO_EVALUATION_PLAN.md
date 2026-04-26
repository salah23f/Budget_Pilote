# Largo — Evaluation Plan

> **Status:** B0 (pre-implementation framing). Evaluation discipline specification, not a measurement run.
> **Audience:** product, ML, data, security, growth, founder, future hires, future external reviewers.
> **Author:** Flyeas team.
> **Last updated:** 2026-04-26.
> **Predecessors:** `LARGO_DOMINATION_STRATEGY.md`, `LARGO_PRODUCT_VISION.md`, `LARGO_ADVICE_CONTRACT.md`.
> **Successors (to come):** `LARGO_SECURITY_PAYMENTS.md`, `LARGO_DATA_STRATEGY.md`, `LARGO_MODEL_STRATEGY.md`, `LARGO_BACKEND_API_SPEC.md`, `LARGO_FRONTEND_UX_SPEC.md`, `LARGO_COMPETITIVE_BENCHMARK.md`, `LARGO_GO_TO_MARKET.md`.
> **Contract version evaluated:** `LargoAdvice` `0.1.0`.

---

## 0. Executive Summary

This document defines how Flyeas/Largo proves it is actually better — not faster to market, not louder, not more confident-sounding. Better. The standard is evidence: defined metrics, defined segments, defined baselines, defined publication thresholds.

Largo's evaluation discipline rests on three commitments:

1. **No claim without measurement.** Every public statement of superiority requires a metric, a segment, a counterfactual, a methodology, and evidence at meaningful scale. Internal targets may be ambitious; published targets are reported only after we have hit them in production.
2. **Concordance is a diagnostic, not a verdict.** Agreement between Largo and another system (V7a, baseline, competitor) tells us whether we move in the same direction, not whether we are right. Regret reduction, calibration error, safety incidents, and user-reported usefulness are the verdict.
3. **ABSTAIN is a first-class outcome.** When uncertainty is real, abstaining is the correct decision. The evaluation framework distinguishes honest ABSTAIN (data is genuinely insufficient) from lazy ABSTAIN (model gave up on a route it could have decided), and both rates are tracked.

The evaluation plan covers offline evaluation (replays on V7a backtest data, n=11,750 trips), online evaluation (Phase 1+ audit rows from `LargoAdvice`), trust and UX metrics, notification quality, safety and payment rails, and auto-buy gating. It defines kill criteria as strictly as go criteria, because the most dangerous evaluation regime is one that only catches successes.

This document does not authorize any implementation, model run, or measurement campaign. It defines the rules under which any future measurement counts.

---

## 1. Evaluation Philosophy

### 1.1 Decision quality, not prediction accuracy

The dominant evaluation frame in travel tech is "given a query, did the model predict the correct future price?". That frame favors raw forecast accuracy. Largo's frame is different: "given a user's budget, window, and constraints, did the advice sequence reduce realized regret while staying calibrated, safe, and understandable?".

Predicting prices well is necessary but not sufficient. A perfectly accurate price forecast paired with an unactionable advice card, or with a confidently wrong "BUY_NOW" recommendation that triggers an auto-buy on a stale price, is a worse product than a slightly less accurate forecast paired with calibrated, safe, explained advice.

Evaluation therefore measures the decision pipeline end-to-end, not the forecast in isolation.

### 1.2 Concordance is not a verdict

Comparing Largo's advice with V7a's advice, with a baseline, or with a competitor's recommendation produces an *agreement rate*. Agreement is a useful diagnostic — large divergence on a known segment is informative — but it is **never** a measure of quality. Two systems can agree and both be wrong; one system can disagree and be right.

Whenever a comparison is presented, it must be paired with a downstream outcome (regret, calibration, dispute rate). Concordance alone is not allowed as evidence in any internal review or external claim. This is a hard rule (see §25).

### 1.3 We measure what catches our own failures

The single most dangerous evaluation regime is one that only confirms wins. Every metric in this plan has at least one paired counter-metric or kill criterion designed to surface failure modes:

- For coverage (how often we ship advice), we track **lazy ABSTAIN rate** to catch over-confidence by absence.
- For calibration, we track **ECE drift** and per-segment ECE to catch confidence collapse on long-tail routes.
- For auto-buy safety, we track **dispute rate, refund rate, kill-switch activations, audit completeness** to catch silent failures.
- For UX, we track **dismissal rate, unsubscribe rate, ABSTAIN dismissal rate** to catch noise dressed up as value.

A metric with no paired failure detector is not a metric. It is marketing.

### 1.4 The five dimensions of advice quality

Every advice can be evaluated along five dimensions. They compose; they do not substitute.

| Dimension | Question | Primary signal |
|---|---|---|
| **Correct** | Did the advice match what hindsight shows was best? | Realized regret vs counterfactual baselines |
| **Useful** | Did the user act on the advice or accept it? | Action-taken rate, mission completion, snooze rate |
| **Safe** | Did the system avoid harm to the user? | Dispute rate, refund rate, kill-switch activations, security incidents |
| **Profitable** | Did the user save money relative to baselines? | Realized savings, regret reduction |
| **Understandable** | Did the user grasp the reasoning? | Reasons-expansion rate, methodology-page revisits, post-mission qualitative trust score |

A correct-but-incomprehensible advice is not better. A profitable-but-unsafe advice is not better. A useful-but-uncalibrated advice is not better. Largo's evaluation must be multi-dimensional or it is fraudulent by construction.

### 1.5 The journalist test

Restated from `LARGO_DOMINATION_STRATEGY.md` §13: any public evaluation claim must survive the question "could a journalist verify this with the methodology I would hand them?". If the answer is "probably not", the claim is not made.

---

## 2. What "Better" Means for Largo

Largo's superiority is defined dimension by dimension and segment by segment. There is no single scalar that captures it.

| Superiority axis | Definition | Internal target | Publication condition |
|---|---|---|---|
| Calibration | Expected Calibration Error on `BUY_NOW` advices, aggregated and per-segment | ECE < 0.05 (Phase 2 target); ECE < 0.07 (Phase 1 internal acceptance) | Sustained over ≥ 1 quarter at meaningful scale; reliability diagrams published alongside scalar |
| Honesty | Fraction of advices with `action == 'ABSTAIN'` when uncertainty is genuine | > 15 % of low-evidence routes | Public via audit page once auto-buy is enabled and rates are stable |
| Regret reduction | Mean realized regret vs `always-BUY_NOW` counterfactual | -50 % to -70 % | After ≥ 1,000 completed missions and reproducible methodology |
| Safety | Stripe dispute rate on auto-buys | < 0.5 % | Public via audit page once cohort step 2 reached |
| Bundle savings | Average savings of bundle vs three separate searches | > 8 % | After ≥ 100 completed bundle missions (Phase 3+) |
| Mission completion | Missions reaching booking-on-advice | > 25 % | Internal first; public sample after Phase 2 |
| Trust | Post-mission trust score (1–5 Likert), volunteered | > 4.0 mean | After ≥ 500 responses with > 30 % response rate |
| ABSTAIN quality | Fraction of ABSTAIN that retroactively become decidable within window (lower = better) | < 25 % "lazy ABSTAIN" rate | Internal only Phase 1; public methodology after Phase 2 |

Targets above are internal goals, not public commitments. They become public claims only when measured at scale per §22.

The list is intentionally not exhaustive. New axes will be added as products extend. Removed axes require an explicit changelog entry, because retiring a metric is sometimes the way evaluation is gamed.

---

## 3. What Largo Must Prove Before Implementation

Phase 0 → Phase 1 gate. Before any producer code ships, the following must be in place:

1. **Calibration methodology agreed.** ECE bin scheme, segment definitions (route, TTD bucket, cabin), reliability diagram tooling.
2. **Baseline set frozen.** The list in §17 is the canonical baseline set for Phase 1; any addition or removal requires a changelog entry.
3. **Regret definition formalized.** Per §10. The definition must be computable from `LargoAdvice` audit rows alone (plus the observed price trajectory of the route).
4. **Audit row sufficiency confirmed.** The `LargoAdvice` contract `0.1.0` must carry every field needed to recompute every Phase 1 metric offline. Spot checks against the contract (`LARGO_ADVICE_CONTRACT.md`) confirm this.
5. **Reporting locations reserved.** Subdirectories under `reports/` (per §24) created or reserved, with naming and freshness conventions agreed.
6. **Kill criteria approved.** Per §21. The team must agree on what triggers a stop *before* shipping, not after.
7. **Public claims policy understood.** Per §22, restated from strategy doc §13, internalized as the default posture.

A missing item on this list blocks Phase 1.

---

## 4. What Largo Must Prove Before Production

Phase 1 implementation → first user-visible Largo advice. Before flipping the producer from shadow to production:

| Criterion | Threshold | Source |
|---|---|---|
| Calibration ECE on `BUY_NOW`, aggregated | < 0.07 | offline replay + first shadow rows |
| Reliability diagram inspection | No bucket > ±15 % off the diagonal | offline replay |
| Latency p95 of advice generation | < 800 ms | producer benchmark |
| Audit completeness | 100 % of generated advices written immutably | shadow audit table audit |
| Producer error rate | < 0.5 % | shadow run telemetry |
| ABSTAIN rate sanity check | within 5–40 % range across surfaces | shadow run telemetry |
| Provider availability | primary ≥ 95 %, cross-check ≥ 80 % over 7 days | provider monitoring |
| `valid_until` honored | 100 % of consumed advices are non-stale at consumption | consumer audit |
| Contract validation | 100 % of audit rows pass §18 of `LARGO_ADVICE_CONTRACT.md` | persistence layer check |

Failure on any criterion postpones the production cutover.

---

## 5. What Largo Must Prove Before Auto-Buy

The most consequential gate. All of §4 must hold, plus:

| Criterion | Threshold | Phase |
|---|---|---|
| Cohort step 1 (~10 users) audit completeness | 100 % | Phase 2 cohort 1 |
| Cohort step 1 silent-failure count | 0 | Phase 2 cohort 1 |
| Cohort step 1 disputes | 0 | Phase 2 cohort 1 |
| Notification delivery within 60 s of capture | 100 % | Phase 2 cohort 1 |
| Synthetic refund pathway success | 100 % on N test cases (N defined in `LARGO_SECURITY_PAYMENTS.md`) | pre-cohort |
| Idempotency stress test (duplicate intents rejected) | 100 % | pre-cohort |
| Kill-switch activation latency | < 30 s end-to-end | pre-cohort |
| Cancel-window UX validated with users | qualitative pass on ≥ 5 users | pre-cohort |
| Cohort step 2 (~100 users) cumulative dispute rate | < 2 % | Phase 2 cohort 2 |
| Cohort step 3 (~1,000 users) cumulative dispute rate | < 1 % | Phase 2 cohort 3 |
| General-availability cohort dispute rate | < 0.5 % | Phase 3+ |

These are hard stops. There is no "ship it now and fix dispute rate next iteration" option for auto-buy. Dispute rate above target halts new captures until root cause is identified, fixed, and validated against the same cohort.

The full safety architecture (triple condition, idempotency, immutable audit, kill switch, refund pathway, 1-hour rétractation) is normative in `LARGO_DOMINATION_STRATEGY.md` §12 and will be detailed in `LARGO_SECURITY_PAYMENTS.md`. This document specifies only the evaluation gates.

---

## 6. Evaluation Objects and Data Sources

Evaluation operates on the following objects and sources. Anything not in this list is not used to make claims.

| Source | Object | Volume (current / target) | Use |
|---|---|---|---|
| V7a backtest dataset (Kaggle dilwong, 2022) | trip + price trajectory | 11,750 trips today | offline regret, calibration baselines, sanity checks |
| `agent_decisions` (V7a shadow) | shadow advice rows | 7 rows on 2026-04-25, accumulating via `demo-shadow-sweep` cron | V7a vs Largo concordance (diagnostic only) |
| `LargoAdvice` audit rows (Phase 1+) | full contract `0.1.0` payload + `AuditBlock` | none yet | online ECE, regret, ABSTAIN rate, latency, all online metrics |
| Mission outcome records (Phase 1+) | mission ID + final state + booked price (if any) + window-best price | none yet | realized regret, mission completion, savings |
| Post-mission feedback (Phase 1+) | volunteer survey (1–5 trust, free text, "did you find better elsewhere?") | none yet | trust score, qualitative failures |
| Provider cross-check telemetry | per-advice disagreement % and provider freshness | implicit in `LargoAdvice.provider_info` | provider quality, disagreement-driven downgrade audit |
| Notification delivery logs | per-notification status (sent, delivered, opened, clicked, dismissed, unsubscribed) | none yet | notification quality (§12) |
| Stripe events | dispute, refund, capture, intent failure | none yet (auto-buy not active) | safety metrics (§15) |
| Support tickets | structured triage tags (advice-wrong, auto-buy-issue, ux-confusion, billing) | minimal | qualitative failure detection |
| External comparator scrapes | competitor-published price for same query | none yet, ethics gated | competitive benchmark (Phase 3+, see `LARGO_COMPETITIVE_BENCHMARK.md`) |

Sources marked "none yet" are deliberate. Phase 0 has no live evaluation data; this plan defines what we will measure as soon as data exists, not what we already claim.

---

## 7. Offline Evaluation Metrics

Offline metrics are computed on retrospective data (the V7a backtest, plus accumulated shadow audit rows once available). They are cheap to recompute and do not depend on user behavior.

### 7.1 Calibration

- **Expected Calibration Error (ECE)** on `numeric_value` (the persisted, never-displayed scalar). Bin scheme: 10 equal-mass bins by default; equal-width bins as a sensitivity check.
- **Maximum Calibration Error (MCE)** as a worst-bin diagnostic.
- **Reliability diagram**, per-segment when sample size allows.
- **Brier score** as a complementary aggregate metric.

### 7.2 Sharpness

- **Predictive entropy** of the calibrated distribution (when available).
- **Conformal interval width**: median, p25, p75. Wider intervals = humbler model.
- **Quantile crossing rate**: must be 0 % (q10 ≤ q50 ≤ q90 always). Any non-zero rate is a hard bug.

### 7.3 Coverage

- **Conformal coverage** of the realized price by the [q10, q90] band: target ~80 % for an 80 % conformal target, with allowed slack ±5 percentage points.

### 7.4 Backtest regret

- **Realized regret** on the V7a backtest, per advice and per trip.
- Distribution: mean, median, p90, p99, max.
- Per-segment: route family, TTD bucket, cabin.
- Counterfactual deltas: vs `always-BUY_NOW`, vs `always-WAIT`, vs V7a `ensemble_ttd_switch` baseline.

### 7.5 Concordance (diagnostic only)

- **Action concordance** between Largo and V7a baseline on same trip-window pairs. Reported per segment.
- **Confidence concordance** between Largo and V7a (when V7a emits a confidence proxy).
- *Reminder:* concordance is reported alongside regret. Concordance alone is not a quality claim (§1.2, §25).

### 7.6 Per-segment breakdowns

All offline metrics are reported aggregated *and* per-segment. Segments include:

- Route family (US-domestic, US-international, intra-EU, transatlantic, transpacific, other).
- TTD bucket (≤7 days, 8–30, 31–90, > 90).
- Cabin (economy, premium-economy, business+).
- Round-trip vs one-way.
- Provider primary.

Aggregated-only metrics hide selection bias and are not accepted as evidence.

---

## 8. Online Evaluation Metrics

Online metrics are computed on production audit rows. They depend on user behavior and provider behavior; they are noisier than offline and require disciplined denominators.

### 8.1 Advice volume and shape

- Advices generated per surface per day.
- Action distribution (`BUY_NOW` / `WAIT` / `ALERT` / `MONITOR` / `ABSTAIN`) per surface.
- Confidence distribution (`high` / `moderate` / `limited` / `unavailable`).
- `ml_available == false` rate (degradation indicator).
- `can_autobuy == true` rate among `BUY_NOW` advices.

### 8.2 Live calibration

- Live ECE on completed missions and on simple-search advices that were followed by external booking with a known final price (sparse, but real).
- Drift signal: rolling 14-day ECE vs trailing baseline.

### 8.3 Realized regret on completed missions

- Per-mission realized regret vs each baseline.
- Per-segment breakdown.

### 8.4 ABSTAIN telemetry

- ABSTAIN rate per surface.
- ABSTAIN reason distribution (top `Reason.code` values).
- **Lazy ABSTAIN rate** (see §1.3 and §10): fraction of ABSTAINs whose route became decidable within the same window after the advice was emitted.

### 8.5 Operational

- Producer p50/p95/p99 latency.
- Producer error rate.
- Provider primary uptime per day; cross-check uptime per day.
- Audit write failure rate (target 0 %).
- Stale-advice consumption rate (target 0 %).

---

## 9. Calibration Metrics

Calibration is the foundation. A miscalibrated `BUY_NOW` is the most expensive error Largo can ship — it is the precondition for harmful auto-buys.

### 9.1 Definitions

- **ECE** = Σ over bins of |bin_accuracy − bin_confidence| × bin_weight.
- **MCE** = max over bins of |bin_accuracy − bin_confidence|.
- **Reliability diagram** = scatter of bin_accuracy against bin_confidence.

The "ground truth" used to compute bin_accuracy depends on the modeled quantity. For "this is a good buy" probability, ground truth = "the realized regret was below threshold T" where T is defined per product. Phase 1 uses T = 5 % above window-min for flights as a starter; revisable in `LARGO_MODEL_STRATEGY.md`.

### 9.2 Targets

| Metric | Phase 1 internal target | Phase 2 internal target | Publication |
|---|---|---|---|
| ECE on `BUY_NOW` (aggregated) | < 0.07 | < 0.05 | only after ≥ 1 quarter at meaningful scale |
| MCE on any single bin (n ≥ 50) | < 0.15 | < 0.10 | with reliability diagram |
| ECE on `BUY_NOW` per segment | < 0.10 on segments with n ≥ 100 | < 0.07 same | with segment breakdown |

### 9.3 Drift detection

Rolling 14-day ECE compared against a trailing 90-day baseline. A drift > +0.02 sustained over 14 days triggers a yellow flag and a calibration audit.

### 9.4 Failure modes the calibration metrics must catch

- Confidence collapse on long-tail routes (high confidence everywhere, no segment-level differentiation).
- Calibration on aggregate but breakdown on segments.
- Quantile crossing (q10 > q50 anywhere).
- Conformal coverage drift (band coverage drops below 70 % when target is 80 %).
- "All `high`" pathology (model loses ability to express uncertainty).

Each of these failure modes has at least one detector above and is added to the daily report (§23).

---

## 10. Regret Metrics

Regret is the dollar-honest measure of decision quality.

### 10.1 Definition (per advice)

For an advice generated at time `t` on a route with monitoring window `[t_start, t_end]`:

- `price_paid_or_at_close` = the price the user actually paid (if booked) or the price observed at `t_end` (if not booked).
- `min_observed_in_window` = the lowest price observed on this route during `[t_start, t_end]`.
- `regret = price_paid_or_at_close − min_observed_in_window`.
- `regret_relative = regret / min_observed_in_window`.

Regret is non-negative by construction.

### 10.2 Counterfactual regrets

For the same window and route, regret is also computed under each baseline policy in §17. The **regret reduction** metric is:

- `Δregret_vs_baseline = regret_baseline − regret_largo`.

Positive Δ means Largo helped; negative means Largo hurt. Distribution-level summaries (mean, median, p10, p90) are reported alongside per-segment breakdowns.

### 10.3 Targets

- **V7a anchor**: `ensemble_ttd_switch` baseline regret_abs_mean = $58.33 on 11,750 trips (offline backtest, 2022 data). This is the floor Largo must beat.
- **Phase 1 internal target**: Largo mean realized regret < $58 on a comparable backtest replay.
- **Phase 2 internal target**: Largo mean realized regret < $50 on Phase 2 mission outcomes (≥ 1,000 completed missions).
- **Publication condition**: per §22.

### 10.4 Lazy ABSTAIN penalty

ABSTAIN advices carry no realized regret by definition (the user got no recommendation). To prevent the model from "winning" by abstaining everywhere, lazy ABSTAIN is tracked separately:

- An ABSTAIN is **lazy** if, within the same window, a confidently-actionable signal emerged that the model could have surfaced (using the same features) and chose not to.
- Lazy ABSTAIN rate is computed offline by replaying the model on the same input plus the within-window observations.
- Lazy ABSTAIN rate target: < 25 % of total ABSTAINs in Phase 1.
- High lazy-ABSTAIN rate is a kill criterion (see §21).

### 10.5 Honesty floor on ABSTAIN

Conversely, ABSTAIN rate must not collapse to zero. An honest system on heterogeneous routes will produce non-trivial ABSTAIN, especially on long-tail. ABSTAIN rate < 5 % across all surfaces with all routes considered is itself a yellow flag — possible over-confidence.

---

## 11. Trust and UX Metrics

The user's experienced trust is part of the product. It cannot be inferred only from action; it must be probed.

### 11.1 Engagement with explanation

- Reasons-expansion rate (clicks on "Why?") per advice rendered.
- Confidence-bar hover rate.
- Methodology page visit rate (per session, per user).
- Mission timeline expansion rate.

These metrics are diagnostic, not goals. A high reasons-expansion rate may indicate confusion as much as engagement; it is interpreted alongside qualitative signals.

### 11.2 Survey-based trust

- Post-mission survey (volunteer, opt-in): "On a 1–5 scale, how much did you trust Largo's recommendations?".
- Post-mission survey: "Did you find a better deal elsewhere? At what price?".
- Quarterly NPS-equivalent for active users.

Targets:

- Mean trust score > 4.0 once response volume ≥ 500.
- Response rate > 30 % among completed missions.
- "Found better elsewhere" rate < 10 % once auto-buy is enabled.

### 11.3 Comprehension signals

- Reasons-expansion-then-immediate-action rate (positive: user read the reasons and acted).
- Reasons-expansion-then-dismiss rate (yellow: user read, didn't trust).
- Methodology page revisit within 7 days (positive).
- Customer support tickets categorized "ux-confusion" per 1,000 advices (target near zero).

### 11.4 Forbidden trust signals

- Time-on-page (correlates with confusion as much as engagement).
- Bounce rate from the AdviceCard (could mean "I got value and left").
- Number of advices viewed (could mean indecision).

These are not used to make UX claims. See §25.

---

## 12. Notification Quality Metrics

Notifications are the highest-leverage and highest-risk surface. The quality bar is "every notification was worth sending".

### 12.1 Volume metrics (denominators, not goals)

- Notifications sent per mission per week.
- Notifications per surface (advice transition, threshold crossing, auto-buy capture, window closing, provider issue).

### 12.2 Quality metrics

- **Action-on-notification rate**: fraction that produced a user action within 24 h.
- **Dismissal rate**: fraction dismissed without interaction.
- **Unsubscribe rate per notification**: an unsubscribe within 7 days of a notification is attributed to it (with attribution caveats logged).
- **"Useless ping" complaint rate** (qualitative tag from support tickets).
- **Inverse ratio**: actionable notifications / total notifications. Target > 0.6 in Phase 1.

### 12.3 Hard rules

- Send-rate > 1 per mission per 24 h is a yellow flag (excluding auto-buy capture and ALERT).
- Unsubscribe rate > 5 % per cohort per quarter is a kill criterion.
- Marketing notifications inside mission notification channels: forbidden (§25).

---

## 13. Mission Metrics

Missions are Largo's primary commercial unit. They are also the richest evaluation surface.

### 13.1 Lifecycle metrics

- Mission creation rate.
- Mission completion rate (booked OR archived with closure notification, NOT silent expiration).
- Mean and median mission duration.
- Mission cancellation rate, with reason distribution.
- Window-extension rate.
- Threshold-edit rate.

### 13.2 Outcome metrics

- Realized regret per mission (per §10).
- Realized savings per mission (vs `always-BUY_NOW` baseline at mission start).
- Auto-buy fire rate among missions where auto-buy is enabled (Phase 2+).
- Manual-buy-on-advice rate (user accepted advice and booked manually).

### 13.3 Internal targets

- Mission completion rate > 25 % (Phase 1).
- Mean realized regret < $58 once n ≥ 200 completed missions (Phase 1).
- Mission cancellation rate < 30 % among missions reaching window mid-point (Phase 1).
- Threshold-edit rate informational only (no target).

### 13.4 Mission failure modes the metrics must catch

- Missions silently expiring without notification (forbidden per `LARGO_PRODUCT_VISION.md` §18).
- Missions producing no actionable advice across the full window.
- Missions producing daily MONITOR-only advices (engagement-degenerate).
- Missions where the user paid > p90 of in-window observed prices.

---

## 14. Simple Search Metrics

Simple search is the entry point. Per `LARGO_PRODUCT_VISION.md` §4, the AdviceCard always renders.

### 14.1 Coverage

- AdviceCard render rate: target 100 % (any miss is a producer bug).
- Anonymous quota-blocked rate: low single-digit %, with a clear copy explaining the limit.

### 14.2 Action shape

- Action distribution (`BUY_NOW` / `WAIT` / `ABSTAIN` / others). The shape over time is informative; target ranges are deferred to `LARGO_BACKEND_API_SPEC.md`.
- "Start a watch" CTR among logged-in users.
- "View flights" CTR (external partner handoff).
- "Why?" expansion rate.

### 14.3 Quality

- ABSTAIN rate on simple search: monitored, no fixed target — function of route mix.
- Cross-check disagreement rate.
- `ml_available == false` rate (degradation telemetry).

### 14.4 Failure modes

- AdviceCard not rendering (producer error, hard bug).
- BUY_NOW shown with `confidence_label == 'limited'` or `'unavailable'` (contract violation; impossible if `LARGO_ADVICE_CONTRACT.md` validation runs).
- BUY_NOW with `can_autobuy == true` but `ml_available == false` (contract violation).

---

## 15. Safety and Payment Metrics

Auto-buy is the surface where evaluation discipline matters most. A single high-profile failure here is unrecoverable.

### 15.1 Core safety metrics (Phase 2+)

- **Stripe dispute rate** on auto-buys, rolling 30 days. Target < 0.5 % at general availability; cohort-specific thresholds in §5.
- **Refund rate** (provider-failure refund rate). Provider-failure refunds within 24 h are an SLA.
- **Refund-success rate** within the SLA window. Target 100 %.
- **Idempotency hit rate** (duplicate intents correctly rejected). Target 100 % under stress test.
- **Kill-switch activation count** (per cohort, per quarter). Each activation requires a postmortem.
- **Audit completeness** on auto-buy events. Target 100 %.
- **Time-to-notification** after capture. Target < 60 s for 99 % of captures.
- **Cancel-window usage rate** (informational, not a target).
- **2FA challenge success rate** for auto-buy enable / threshold change.

### 15.2 Negative-space metrics

- Captures fired on stale advices (`now > valid_until`): target 0.
- Captures fired with `ml_available == false`: target 0.
- Captures fired with `can_autobuy == false`: target 0 (hard contract violation).
- Captures exceeding `mission.budget_deposited`: target 0.

### 15.3 Incident severity ladder

| Severity | Trigger example | Response |
|---|---|---|
| SEV1 | unauthorized capture; capture above budget; audit row missing | immediate kill-switch; postmortem within 48 h; cohort rollback |
| SEV2 | provider-failure refund missed SLA; 2FA bypass; idempotency violation | feature freeze; postmortem within 72 h |
| SEV3 | dispute rate exceeds cohort threshold for 7 days | cohort halt for new captures; root cause analysis |
| SEV4 | notification delivery > 60 s for > 5 % of captures over 7 days | yellow flag; root cause investigation |

---

## 16. Auto-Buy Evaluation Gates

Cohort-by-cohort gates, all hard stops. Restated and made operational from §5.

### Cohort 0 — pre-cohort (before first auto-buy)

- §5 pre-cohort criteria all green.
- Triple-condition logic verified by code review.
- Idempotency stress test passed.
- Kill switch end-to-end test passed.
- Synthetic refund pathway test passed.

### Cohort 1 — ~10 users

- Audit completeness 100 %.
- Disputes 0.
- Silent failures 0.
- Notification delivery 100 % within 60 s.

If any criterion fails, halt; postmortem; reset to pre-cohort.

### Cohort 2 — ~100 users

- Cumulative dispute rate < 2 %.
- Cumulative refund-success rate within SLA = 100 %.
- No SEV1 incident in cohort window.

### Cohort 3 — ~1,000 users

- Cumulative dispute rate < 1 %.
- Cumulative refund-success rate within SLA = 100 %.
- No SEV1 in cohort window.
- Notification quality (§12) green.

### General availability

- Rolling 30-day dispute rate < 0.5 % maintained.

Each cohort gate also requires founder-level review and approval.

---

## 17. Baselines and Counterfactuals

The canonical baseline set for Phase 1 evaluation.

### 17.1 The set

| Baseline | Definition | Status |
|---|---|---|
| `always-BUY_NOW` | Buy at the first observation in the window. Maximum impatience. | trivially computable |
| `always-WAIT` | Wait until window close, buy then. Maximum patience. | trivially computable |
| `V1` | Legacy decision logic prior to V7a. Conceptual; never deployed as advice. Treated as null/no-op for Phase 1 (no live V1 advice rows exist). | conceptual placeholder |
| `V7a baseline` | `ensemble_ttd_switch` with regret_abs_mean = $58.33 on 11,750 trips (offline). Live in shadow mode via `agent_decisions`. | active reference |
| `Largo previous version` | The most recently retired `LargoAdvice` schema/model deployed in production. Begins to matter at Phase 1 → Phase 1.x bumps. | reserved |
| `User manual behavior` | Simulated baseline of "what would the user have done without advice", inferred from observation patterns and survey. | inferred, low-confidence |

### 17.2 Why this set

- `always-BUY_NOW` and `always-WAIT` bracket the decision space. Largo must outperform both on average.
- `V7a baseline` is our internal floor: if Largo is worse than V7a on a comparable replay, we should ship V7a-as-Largo and skip the rebuild.
- `V1` exists as a placeholder; it produces no rows today. Its inclusion documents intent: if a "V1 like" rule-based system is ever fielded, it will be added to the evaluation matrix.
- `Largo previous version` matters from Phase 1.x onward and is the safety net against regression on schema bumps.
- `User manual behavior` is honest about its low confidence. It is reported with explicit error bars, never used as the sole baseline.

### 17.3 Counterfactual computation rules

- Same input data, same window, same passenger context.
- Counterfactual regret is computed only when the realized price trajectory is fully observable for the window (i.e., the mission has terminated or the user has not booked).
- Counterfactuals are recomputed when models change. Old reports are not retroactively rewritten; new reports clearly mark the model version evaluated.

---

## 18. V1 vs V7a vs Largo — Comparison Protocol

A focused subsection because this comparison drives the V7a-7 decision and the Phase 1 go/no-go.

### 18.1 Current state (2026-04-26)

- **V1**: not a deployed system. No rows.
- **V7a**: shadow mode, `agent_decisions` accumulating (7 rows on 2026-04-25, growing via `demo-shadow-sweep` at `0 2,14 * * *`). `ml_available == false` in 100 % of rows; `confidence` correctly NULL.
- **Largo Phase 1**: not yet implemented. No rows. Contract `0.1.0` defined.

### 18.2 What we can compare today

- V7a vs offline `ensemble_ttd_switch` backtest: already done. $58.33 mean abs regret on 11,750 trips.
- V7a shadow telemetry: latency, error rate, audit completeness on the 7+ rows.
- Concordance between V7a shadow advice and a naive baseline on the same input: computable.

### 18.3 What we cannot compare today

- Largo vs V7a on production: Largo is not implemented.
- V7a vs incumbent comparator: requires a reproducible methodology per §22.
- Any user-experienced metric: no Largo user yet.

### 18.4 What we will compare once Largo Phase 1 ships

For every Largo advice on a route also covered by V7a:

- Action concordance (diagnostic).
- Realized regret on the same window.
- Calibration on shared buckets.
- Latency.
- ABSTAIN rate (V7a only ABSTAINs on data absence; Largo also on calibration unavailability).

The protocol report will be a quarterly artifact under `reports/v7a-vs-largo/`.

### 18.5 V7a-7 decision input

This evaluation plan does not render V7a-7. V7a-7 is a strategic decision driven by:

1. V7a shadow row volume and segment coverage.
2. V7a action vs Largo action (post-Largo Phase 1) concordance.
3. V7a vs Largo regret comparison on shared windows.
4. Founder strategic call.

This document supplies the metrics; the decision is elsewhere.

---

## 19. Shadow Evaluation Protocol

Shadow mode is the safe-by-default Phase 1 stance.

### 19.1 Definition

Shadow mode = the producer generates advice and writes the audit row, but the consumer (UI, notification, auto-buy) does not act on it. The user does not see the shadow advice.

### 19.2 Required properties

- 100 % of shadow advices written immutably with full `LargoAdvice` `0.1.0` payload + `AuditBlock`.
- 0 user-visible side effects from a shadow row.
- 0 differences in producer code path between shadow and production runs (the only difference is the consumer side).
- Latency of shadow generation measured exactly as production latency.

### 19.3 Shadow → demo → production progression

1. **Pure shadow**: producer runs on cron and on every search; no consumer. Used for baseline calibration and audit shape validation.
2. **Internal demo**: producer feeds an internal-only dashboard. Founding team reads advice and reports anomalies. Still no end users.
3. **Production rollout (cohort step 0)**: small cohort sees AdviceCards; no auto-buy.
4. **Cohort steps 1+**: per §16.

Each step has explicit entry and exit criteria already defined in §4–§5.

---

## 20. Cohort Rollout Protocol

Restated and made operational.

| Stage | Audience | Entry criteria | Duration (order-of-magnitude) | Exit criteria |
|---|---|---|---|---|
| Pure shadow | none (system only) | producer ready, audit ready | until §4 criteria green | §4 green |
| Internal demo | founding team | §4 green | ~2–4 weeks | no SEV1, no SEV2, ECE within target |
| Public production (no auto-buy) | all users (search + missions, no auto-buy) | internal demo green | open-ended | safety §5 green for cohort 1 |
| Cohort 1 auto-buy | ~10 users | §5 cohort 1 criteria green | ~4 weeks | §16 cohort 1 gate green |
| Cohort 2 auto-buy | ~100 users | cohort 1 gate green | ~6 weeks | §16 cohort 2 gate green |
| Cohort 3 auto-buy | ~1,000 users | cohort 2 gate green | ~8 weeks | §16 cohort 3 gate green |
| GA auto-buy | all users | cohort 3 gate green | open-ended | rolling §15 metrics green |

Rollback to a previous stage is a first-class operation. Any SEV1 or SEV2 in any stage triggers an automatic rollback proposal to the founder.

---

## 21. Go / Keep-Shadow / Kill Rules

Three states for every release candidate.

### 21.1 Go (promote)

All preset metrics for the current stage are green. Founder review confirms. Rollback plan rehearsed.

### 21.2 Keep-shadow (hold)

Any single yellow signal:

- ECE drift > +0.02 sustained 14 days.
- Latency p95 > 800 ms sustained 7 days.
- Audit completeness < 99.9 % over 7 days.
- ABSTAIN rate outside 5–40 % range.
- Provider primary uptime < 95 % over 7 days.
- Producer error rate > 0.5 % sustained 7 days.

Hold means: stay in current stage, investigate, re-evaluate.

### 21.3 Kill (rollback)

Any of:

- ECE > target +50 % sustained 14 days.
- Audit completeness < 99 % on any day.
- Stripe dispute rate spike > 1 % in any cohort step.
- Calibration silent breakdown (e.g., model emits `high` confidence on routes where it has zero training coverage).
- Producer error rate > 5 %.
- Lazy ABSTAIN rate > 50 %.
- Any SEV1 incident.
- Two SEV2 incidents within 30 days.

Kill triggers an immediate rollback to the previous stage. Re-promotion requires postmortem, fix, and validation against the original criteria.

---

## 22. Public Claims Policy

Restated from `LARGO_DOMINATION_STRATEGY.md` §13, made operational here.

### 22.1 The five conditions

A public claim of superiority requires:

1. **Defined metric.** Explicit, auditable, with formula.
2. **Defined segment.** Explicit population (route family, TTD bucket, time window, user cohort).
3. **Reproducible methodology.** Documented to the level a third party could re-run with the same inputs.
4. **Counterfactual baseline.** Named, computable, included in the published comparison.
5. **Evidence at meaningful scale.** Sample size threshold defined per metric (e.g., n ≥ 1,000 missions for regret reduction).

### 22.2 Forbidden phrasing

- "Best price guaranteed."
- "Most accurate predictions."
- "AI-powered" (without specifying model, training data, methodology).
- "Saves the most money."
- Anything without an attached methodology link.

### 22.3 Allowed phrasing — example template

> "On 1,234 mission outcomes between Aug-2026 and Oct-2026, on US-domestic round-trip economy flights with TTD ≥ 30 days, Largo's mean realized regret was $X (median $Y). The same windows evaluated under the always-BUY_NOW counterfactual produced a mean regret of $Z. Methodology and reproducibility instructions: [link]."

### 22.4 Pre-publication review

Every public claim passes through:

1. Methodology document review.
2. Statistical significance sanity check (CIs reported, not just point estimates).
3. Founder approval.
4. Journalist test (§1.5).

---

## 23. Reporting Cadence

| Cadence | Reports | Audience |
|---|---|---|
| Daily (automated) | latency p50/p95, producer error rate, audit completeness, ABSTAIN rate, provider uptime, kill-switch state | engineering on-call |
| Weekly (automated) | ECE per segment, regret per segment when n permits, notification quality, cohort progression, cancel-window usage | engineering + product |
| Monthly (curated) | UX dashboard, public-claim eligibility check, cohort decision document, mission outcomes summary | founder + team |
| Quarterly (curated) | Strategy alignment, calibration deep dive, baseline recomputation, public-claim publication review, V7a-vs-Largo comparison | founder + future board |
| Pre-release | full evaluation packet with all §4 / §5 / §16 gates evaluated | founder + reviewer |
| Post-incident | postmortem with metric impact, root cause, fix, prevention | full team |

The cadences above are commitments. A skipped report is itself a yellow signal.

---

## 24. Required Reports and Future Dashboards

### 24.1 Reports under `reports/`

Phase 1 reserves the following subdirectories:

- `reports/calibration/` — weekly ECE breakdowns, MCE, reliability diagrams (PNG + raw data CSV).
- `reports/regret/` — per-mission counterfactual analyses, per-segment summaries.
- `reports/safety/` — per-cohort dispute logs, refund logs, idempotency stress test results, kill-switch state history.
- `reports/notifications/` — per-week notification quality (action rate, dismiss rate, unsubscribe attribution).
- `reports/audit-completeness/` — daily integrity check (rows-written vs advices-generated).
- `reports/abstain/` — per-week ABSTAIN distribution and lazy-ABSTAIN computation.
- `reports/v7a-vs-largo/` — quarterly comparison protocol output.
- `reports/incidents/` — SEV-tagged postmortems.
- `reports/public-claims/` — methodology documents for any externally published claim.

Naming convention: `YYYY-MM-DD_topic_subtopic.md` (or `.csv`, `.png`). Frozen after publication; corrections create a new dated file referencing the original.

### 24.2 Future dashboards

Out of scope for this document but reserved as Phase 2+ deliverables:

- Live Grafana-equivalent (or `vercel` analytics) for §23 daily metrics.
- Cohort progression dashboard.
- Mission outcomes dashboard (anonymized).
- Public audit page (replaces Trust / Methodology page once auto-buy is enabled — per `LARGO_PRODUCT_VISION.md` §16).

Dashboard tooling choice is deferred. The report files are the authoritative artifacts; dashboards visualize them.

---

## 25. Forbidden Metrics and Anti-Patterns

Hard list. Anything below is **not** used as an evaluation signal, KPI, OKR, or public claim.

| Forbidden metric / pattern | Why |
|---|---|
| DAU as a primary success metric | Rewards re-engagement notifications; conflicts with notification discipline (§12). |
| Time-on-page | Correlates with confusion as much as engagement. |
| Click-through rate alone | Says nothing about whether the click produced value. |
| Conversion rate as a Largo success metric | Largo's job is to recommend "wait" when waiting is correct; optimizing conversion fights this. |
| Notification open rate as a goal | Incentivizes notification spam. |
| Total notifications sent | Same as above, with extra blast radius. |
| Total advices generated | Vanity volume. The metric that matters is per-segment quality. |
| Average savings without a counterfactual baseline | Selection-biased toward winners. |
| Concordance with another model as proof of superiority | §1.2: agreement is not quality. |
| Numeric confidence anywhere in customer copy | Violates `LARGO_PRODUCT_VISION.md` §9 and `LARGO_ADVICE_CONTRACT.md` §7.3 (and §20 forbidden patterns). |
| Public ECE figure before measurement at scale | Violates §22 publication conditions. |
| "BUY_NOW" rate as a KPI | Optimizing this fights the WAIT discipline and the safety posture. |
| Vanity 5-star ratings without methodology | No methodology = not a metric. |
| Inferring user satisfaction from app-open frequency | App-open frequency is engagement, not satisfaction. |
| Binary "advice was right / wrong" without regret quantification | Loses signal magnitude. |
| Comparative "% better than competitor X" without published methodology | Violates §22. |

These are not preferences. They are hard rules for any document, dashboard, or claim Largo produces.

---

## 26. Open Questions

Defer to subsequent B0 documents or to operational decisions made before Phase 1.

1. **Calibration measurement frequency at low traffic.** Phase 1 will produce few advices initially; weekly ECE may be statistically meaningless. Defer the policy (rolling window vs accumulated sample) to `LARGO_MODEL_STRATEGY.md`.
2. **Counterfactual baseline for hotels.** Always-BUY_NOW is well-defined for flights but ambiguous for hotels (refundable vs non-refundable). Defer to `LARGO_MODEL_STRATEGY.md` Phase 2.
3. **Counterfactual baseline for bundles.** "Three separate searches" is the right baseline shape but requires a fixed methodology. Defer to Phase 3 / `LARGO_MODEL_STRATEGY.md`.
4. **Provider scrape ethics for external benchmarks.** Defer to `LARGO_COMPETITIVE_BENCHMARK.md`.
5. **User-survey response rate target and incentive policy.** Defer to `LARGO_GO_TO_MARKET.md` and `LARGO_FRONTEND_UX_SPEC.md`.
6. **Reproducible benchmark publication venue.** GitHub repo, dedicated page, blog, whitepaper? Defer to `LARGO_GO_TO_MARKET.md`.
7. **Whether reliability diagrams are published alongside scalar ECE.** Strong default: yes. Confirm in `LARGO_MODEL_STRATEGY.md`.
8. **Pre-cohort dispute baseline calibration.** What dispute rate do we expect on naïve auto-buy? Probably high — defer to `LARGO_SECURITY_PAYMENTS.md`.
9. **Pre-Phase-2 evaluation cadence for low-volume periods.** When n is small, daily/weekly reports may be noise. Defer to operational policy.
10. **Statistical significance thresholds for cohort gating.** Currently the §16 thresholds are point estimates. Confidence-interval-aware gating policy: defer.
11. **External reviewer / red team pre-publication step.** Should every public claim pass an external reviewer? Defer to `LARGO_GO_TO_MARKET.md`.
12. **Long-tail ECE policy.** Per-segment ECE on segments with n < 50 is unstable. Aggregation policy: defer to `LARGO_MODEL_STRATEGY.md`.

Each open question becomes a section in the corresponding successor document.

---

## 27. Document Status

- **B0 framing only.** This document defines evaluation discipline; it does not authorize implementation, model runs, measurement campaigns, or public claims.
- **Coherence dependency:** any change to `LARGO_DOMINATION_STRATEGY.md`, `LARGO_PRODUCT_VISION.md`, or `LARGO_ADVICE_CONTRACT.md` may invalidate parts of this plan.
- **Implementation requires:** V7a-7 closure, the remaining B0 documents written and validated, founder authorization.
- **Authority:** evaluation source of truth for Largo. Subordinate to founder decisions; superior to per-feature evaluation proposals and to per-model metric choices.
- **Versioning:** this plan evaluates `LargoAdvice` contract `0.1.0`. Contract bumps may require an evaluation plan revision.

---

*End of document.*
