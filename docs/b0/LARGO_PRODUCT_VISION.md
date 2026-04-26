# Largo — Product Vision

> **Status:** B0 (pre-implementation framing). Product-level translation of `LARGO_DOMINATION_STRATEGY.md`.
> **Audience:** product, design, frontend, UX writers, future hires.
> **Author:** Flyeas team.
> **Last updated:** 2026-04-26.
> **Predecessor:** `LARGO_DOMINATION_STRATEGY.md` (strategic foundation).
> **Successors (to come):** `LARGO_ADVICE_CONTRACT.md`, `LARGO_FRONTEND_UX_SPEC.md`, `LARGO_BACKEND_API_SPEC.md`.

---

## 0. One-sentence vision

> **Largo is a transparent travel decision agent that helps users decide when to buy, when to wait, and when not to trust the data yet.**

Everything in this document is a translation of that sentence into product surfaces, states, copy principles, and behaviour rules. A longer formulation, expanded across the document body: Largo helps users buy at the right time, under their own constraints, with calibrated honesty about what it knows and what it doesn't, and with explicit safety guards on any action it takes on their behalf.

---

## 1. Product Vision

Largo is the user-facing layer of Flyeas. It is the only product surface most users will ever interact with directly. Internally it is a decision engine; externally it is **a calm, honest travel companion that does the watching and the waiting on the user's behalf**.

Three product principles, in priority order:

1. **Honesty before conversion.** When Largo does not know, it says so. When Largo recommends a buy, it explains why. When Largo recommends waiting, it does not panic the user.
2. **Calmness before excitement.** No urgency timers, no fake scarcity, no countdown banners. The product moves at the speed of the trip, not at the speed of the funnel.
3. **Agency before automation.** The user always retains the final word. Auto-buy is opt-in by default-off, three-step consented, and audit-traceable.

These principles are not aesthetic preferences. They are how Largo earns trust on a dimension where conversion-driven incumbents are structurally less incentivized to prioritize this level of transparency.

---

## 2. User Promise

What Largo promises to the user, in plain words:

- **"We will tell you when buying makes sense, and when waiting makes sense, and when we honestly don't know."**
- **"We will explain why, in your language, with the numbers behind the advice."**
- **"We will only act on your behalf when you've explicitly told us to, with conditions you control."**
- **"We will never push you to buy with fake urgency or pressure."**
- **"You can always see what we did, why, and undo it within the limits allowed by the provider and our refund policy."**

What Largo does **not** promise:

- Not "we will find you the cheapest flight in the world".
- Not "we will beat every comparator on every search".
- Not "we will guarantee a price drop".
- Not "we will catch every mistake fare".

This restraint is intentional. Promises we cannot prove are debt against trust. We do not take that debt.

---

## 3. What Largo Should Make Users Feel

Five emotional states Largo aims to produce, in order of importance:

| Emotion | What it means in product | How we cause it |
|---|---|---|
| **Control** | The user feels in charge of their travel decision. | Explicit constraints, opt-in actions, undo paths, transparent state. |
| **Clarity** | The user understands what they are looking at. | Plain copy, visible reasons, no jargon, no scores without meaning. |
| **Trust** | The user believes the app acts in their interest. | Audit trail, "I don't know" states, no dark patterns, evidence over claims. |
| **Calmness** | The user does not feel rushed or pressured. | No timers, no FOMO, snooze without guilt, slow product cadence. |
| **Competence** | The user feels the app is good at its job, without arrogance. | Calibrated confidence, comparison anchors, observed track record. |

Five emotional states Largo must **avoid causing**:

- Anxiety ("buy now or lose forever").
- Confusion ("score 87/100 — what does that mean?").
- Guilt ("are you sure you want to leave?").
- Helplessness ("we already booked it for you, no take-backs").
- Cynicism ("this app says 'good price' on everything").

If a feature reliably produces an avoided emotion, the feature is wrong, regardless of its conversion impact.

---

## 4. Simple Search Experience

Most first-touch users come through the search flow. Largo must add value here without requiring a mission, an account, or a payment.

### Flow

1. User lands on the search page (or arrives via deep link).
2. User enters route, dates, passengers, simple constraints.
3. Largo returns the result list **and** an `AdviceCard` at the top.
4. The `AdviceCard` shows: action, short message, confidence indication, comparison anchor, "Why?" expander, "Start a watch" call-to-action.
5. User can click a result to book externally **or** start a Largo mission to monitor.

### Behaviour rules

- AdviceCard always renders, even when uncertain (in which case it shows ABSTAIN with explanation). ABSTAIN is a product state, not a failure.
- AdviceCard is **above** the result list, not buried.
- AdviceCard takes ~80–120 px of vertical space; not a banner, not a popup.
- "Start a watch" is the secondary CTA; primary CTA is "View flights".
- No "BUY_NOW" message displayed if `confidence < 0.5`.
- No information requested from the user beyond what's needed for the search.
- Anonymous (logged-out) users receive AdviceCards subject to a per-IP daily quota; signup is encouraged but never required to receive an opinion.

### Example AdviceCard renderings (draft copy, not final)

**Strong buy:**
> ✅ **Largo: good price** — buying now is reasonable.
> Below the historical 25th percentile for this route. *(confidence: high)*
> [View flights] [Why?] [Start a watch]

**Wait:**
> ⏳ **Largo: above-average price** — we'd watch a bit longer.
> Higher than the median price observed on this route in the last 30 days. *(confidence: moderate)*
> [View flights] [Why?] [Start a watch]

**Abstain:**
> ❓ **Largo: not enough data** — no advice on this route yet.
> We don't have enough history on this specific route to give a reliable opinion. You can start a watch and we'll learn together. *(confidence: unavailable)*
> [View flights] [Start a watch]

**Provider disagreement:**
> ⚠️ **Largo: price not yet verified.**
> Our sources currently disagree on the price. Holding advice until we can confirm.
> [View flights] [Try again in a moment]

---

## 5. Mission Experience

Missions are the heart of Largo. They turn a one-shot search into a longitudinal relationship.

### Flow

1. User creates a mission: route(s), date window, passengers, total budget, optional constraints (airline, stops, eco-preference, cabin).
2. User optionally enables auto-buy with explicit threshold ≤ budget cap.
3. Largo begins monitoring (cron-driven scans).
4. User sees a **mission dashboard**, not a result list.
5. Each scan produces a `LargoAdvice`. Advices are visible on the timeline; only meaningful changes generate notifications.
6. When advice meets buy conditions (or auto-buy thresholds, if enabled), the user is notified.
7. The user takes action (buy manually, accept, snooze, dismiss, cancel mission). If auto-buy fires, the user receives an immediate notification with full advice and a refund/cancel window where provider terms allow.
8. Mission terminates: booked, expired, cancelled. Outcome is recorded.
9. Optional: post-mission feedback survey.

### Mission dashboard principles

- The dashboard is **temporal**: it shows the trajectory of prices and advices over the mission window, not a snapshot.
- Budget burn-down is always visible (when applicable to the product type).
- Action history is always accessible.
- The "current advice" card is prominent.
- The auto-buy state (enabled / disabled / threshold) is always visible if relevant.
- The user can pause the mission, change the threshold, or cancel at any time without friction.

### Example dashboard zones (textual wireframe)

```
┌────────────────────────────────────────────────┐
│ Mission: NYC → Tokyo (Mar 5 → Mar 19)          │
│ Budget: $1,200 deposited · $0 spent             │
│ Auto-buy: enabled below $850                    │
│ Status: Watching (12 days remaining)            │
├────────────────────────────────────────────────┤
│  CURRENT ADVICE                                 │
│  ⏳ Above-average price ($940) — we'd wait.     │
│  Confidence: moderate · 4 reasons →             │
├────────────────────────────────────────────────┤
│  PRICE TIMELINE (last 30 days)                  │
│  [sparkline with markers for each advice]       │
├────────────────────────────────────────────────┤
│  RECENT ADVICES                                  │
│  Apr 24 · Wait ($940)                           │
│  Apr 22 · Wait ($965)                           │
│  Apr 20 · Wait ($982)                           │
│  Apr 18 · Mission started ($955)                │
├────────────────────────────────────────────────┤
│  [Pause] [Edit threshold] [Cancel mission]      │
└────────────────────────────────────────────────┘
```

This is illustrative. The exact layout is for `LARGO_FRONTEND_UX_SPEC.md`.

---

## 6. Future Multi-Product Experience (hotels, cars, bundles)

The same product shell extends across products. The `AdviceCard` and `MissionDashboard` components remain identical; only the internal advice shape and copy changes.

### Hotels (Phase 2)

- Decision is less about timing and more about **lock-in vs flexibility**: refundable rate vs cheaper non-refundable, room type, cancellation window.
- AdviceCard might say "This rate looks fair, and refundable until 24h before check-in. Reasonable to lock now." vs "Cheaper non-refundable rate available, but you lose flexibility — your call."
- Mission for hotel = monitoring window + budget + minimum room/preference constraints.

### Cars (Phase 2 late or Phase 3)

- Decision is mainly about **availability vs price tradeoff** as pickup date approaches.
- AdviceCard might say "Inventory tightening on your dates; locking in within 5 days reduces risk."

### Bundles (Phase 3)

- A single mission with a global budget across flight + hotel + car.
- Largo allocates the budget intelligently and recommends timing per component.
- AdviceCard becomes a **compound advice**: "Lock the flight at $480 now (flight prices volatile here), keep watching the hotel (stable, refundable), don't pre-book the car yet."
- Bundle savings are computed against a "three separate searches" baseline.

This is the structurally non-replicable surface. None of it is built in Phase 1; the product shell is designed from day one to accommodate it.

---

## 7. Advice States Specification

Five canonical states. Each has visual treatment, copy tone, and recommended next-action.

| State | Meaning | Visual treatment | Copy tone | Default user action |
|---|---|---|---|---|
| **BUY_NOW** | Conditions favor buying. Calibrated confidence ≥ 0.5. | Green accent, prominent | Affirmative, not pushy | "View flights" / "Buy via partner" |
| **WAIT** | Conditions favor waiting. | Neutral grey, calm | Patient, no urgency | "View flights" / "Snooze" |
| **ALERT** | Important change since last advice — typically a price drop crossing threshold or window closing. | Amber accent, high visibility, requires interaction | Specific, factual | "Review now" |
| **MONITOR** | Continued passive observation; no actionable change. | Muted, secondary | Quiet | (no CTA, just status) |
| **ABSTAIN** | Largo cannot give a reliable advice (data quality, model down, route unknown). Treated as a first-class product state, not as an error. | Neutral with question mark icon | Honest, soft | "Start a watch" / "Try later" |

### Transition rules

- BUY_NOW → MONITOR is allowed (price went up, advice cooled).
- WAIT → BUY_NOW triggers a notification.
- ABSTAIN → any other state when data improves; no notification (avoid noise).
- ALERT is an interrupt: must require an explicit user dismiss or action, never silently expires without surfacing.

### Display rules

- Each advice on the dashboard timeline carries: state badge, observed price, key reason, timestamp.
- Hovering / expanding an advice reveals the full `reasons[]` array and `comparison_anchor`.
- Older advices remain visible for transparency (we never hide past mistakes).

---

## 8. UX of Uncertainty

The hardest design problem in Largo. The product must communicate uncertainty clearly without making the user feel the app is incompetent.

### Principles

- **Show a band when calibrated intervals are available; otherwise explain why no interval is shown.** A band reads better than a point estimate ("Likely between $480 and $560 for the next 7 days") — but bands require a calibrated ML/conformal layer that may not always be online. When unavailable, the UI explains plainly: "Detailed range not available — current advice is based on baseline data only."
- **Use semantic labels, not raw numbers.** "Confidence: high" / "moderate" / "limited" / "unavailable" — never "score: 0.73" in the customer UI.
- **Translate confidence into a behavior.** "We're confident enough to suggest buying" vs "We have an opinion but you may want to check yourself".
- **Make ABSTAIN feel honest, not broken.** Use language like "We don't have enough data on this route" rather than "Error: insufficient data".
- **When confidence is low and the user still asks, give a soft hedge.** "If we had to guess, we'd say wait — but please use this with caution."

### What to avoid

- ❌ "Buy now! 100% chance of price increase." (false certainty)
- ❌ "Algorithmic confidence: 0.73" (jargon without meaning, not for customer UI)
- ❌ "Sorry, we couldn't compute" (sounds broken)
- ❌ Hiding confidence when low to drive conversion

### Sample copy

| Situation | Bad copy | Good copy |
|---|---|---|
| High confidence | "100% sure!" | "We're confident this is a good price." |
| Moderate confidence | "Maybe a good deal" | "This looks reasonable, with some uncertainty." |
| Low confidence | (hidden) | "Limited data — take this with caution." |
| No confidence | "Error" | "Not enough data on this route to advise yet." |

---

## 9. UX of Confidence

Confidence is shown explicitly, not hidden. Three layers:

1. **Visual indicator.** A horizontal bar with 3–4 segments — high / moderate / limited / unavailable. Color-blind safe.
2. **Semantic label.** One word or short phrase next to the bar.
3. **Plain explanation on demand.** Click to expand: "We've observed this route X times in the last 30 days. The current price is in the bottom Y% of our historical range. Our confidence reflects this depth of evidence."

### Levels

| Level | Underlying calibration | Label | Allowed actions |
|---|---|---|---|
| High | calibrated, ECE-validated, > threshold | "High confidence" | BUY_NOW shown; auto-buy permitted (if other conditions met) |
| Moderate | calibrated, intermediate | "Moderate confidence" | BUY_NOW shown without auto-buy; user must click |
| Limited | heuristic only or low data | "Limited confidence" | WAIT or BUY_NOW with strong qualifier; no auto-buy |
| Unavailable | calibration absent | "Confidence unavailable" | ABSTAIN or MONITOR only |

### Hard rules

- We do not display "high confidence" without a calibration check (ECE within target).
- **We do not display a numeric score (e.g., "73 %") in the customer UI.** Numeric values are visible only in internal/debug/admin surfaces, never as a user-facing setting.
- We always link confidence to evidence (sample size, comparison anchor).

---

## 10. UX of Reasons & Explanations

Every advice carries 1–3 short causal sentences (`reasons[]`). They are accessible at three depth levels:

1. **Inline on the AdviceCard:** the most important reason, in one short sentence.
2. **Expanded "Why?" panel:** all 1–3 reasons + comparison anchor (e.g., "Compared against the historical 10th percentile of $208 for this route").
3. **Technical details (internal / debug / admin only):** model versions, raw quantiles, conformal width — accessible only via internal tooling, never to general users.

### Reason quality rules

- Every reason refers to **a concrete observable** (price, history, time-to-departure, route knowledge, provider freshness). Not vague.
- Every reason is **falsifiable**. The user can in principle look at the underlying data and check.
- Every reason is **plain language**, no statistical jargon. "This price is 14 % below the typical price for this route" — not "z-score = -1.7".

### Examples (draft copy)

| Reason source | Plain-language reason |
|---|---|
| `comparison_anchor.training_quantile` | "This price is in the bottom 10 % of what we've seen for this route." |
| `rolling_min_30` | "Lower than every price we've recorded for this route in the past 30 days." |
| `gate_route_unknown` | "We don't have enough recent data on this specific route to be sure." |
| `provider_disagreement` | "Our two sources currently disagree on the price by more than 10 %." |
| `ttd_pressure` | "With your departure 4 days away, prices typically don't drop much further." |

---

## 11. Notifications Policy

Notifications are the highest-leverage and highest-risk surface. A single bad notification destroys retention.

### Hard rules

- **Opt-in only.** Default off. The user explicitly enables per mission and per channel (email / SMS / push).
- **Actionable only.** No "still watching" pings. Notifications fire only on:
  - Advice state transition that changes the recommended action (e.g., WAIT → BUY_NOW with sufficient confidence).
  - Threshold crossing (price below user's auto-buy threshold).
  - Auto-buy executed (always notify within 60 seconds).
  - Mission window closing (final reminder, optional, opt-in).
  - Provider failure causing prolonged advice unavailability (≥ 24h).
- **Frequency cap.** Maximum 1 notification per mission per 24h, except for auto-buy executions (always notify) and ALERT events (must surface).
- **Channel respect.** SMS only for high-importance events (auto-buy capture, security). Email for advice changes. Push for in-app retention.
- **Easy unsubscribe.** One tap, no friction, no "are you sure" dialogs.

### Forbidden notification patterns

- Daily "your mission is still running" pings.
- "We found a deal!" without a clear price action.
- Marketing pushes within mission notifications.
- Notifications during user's local night hours unless time-critical.
- "Re-engagement" notifications after user has been inactive for N days without new substance.

### Sample notification copy (draft)

**WAIT → BUY_NOW transition:**
> Subject: Largo: good time to consider buying your NYC → Tokyo trip
> Body: The current price is now $815, below your auto-buy threshold of $850 with high confidence. Open Largo to review or take action.

**Auto-buy capture:**
> Subject: Largo booked your trip — NYC → Tokyo, $815
> Body: Largo just secured your trip. Refund or cancellation is handled according to provider terms and Flyeas refund policy. [View booking] [Request cancellation]

**Mission window closing:**
> Subject: 48h left on your NYC → Tokyo mission
> Body: Current best price: $880. We haven't seen a confident BUY signal yet. You can extend the window or buy at the current price.

---

## 12. Mission Timeline

The single most important UI surface in Largo. The timeline turns Largo from "an alert" into "a relationship".

### Visual elements

- **Sparkline** of observed prices over the mission window.
- **Advice markers** at each scan point, color-coded by state.
- **User actions** (snooze, threshold change, cancel, buy) overlaid as labeled markers.
- **Budget burn-down** (when applicable) as a secondary line.
- **Today indicator** (vertical line at current date).
- **Auto-buy threshold** as a horizontal line (when enabled).

### Interactions

- Hover/tap on any marker → expand the advice details (reasons, confidence, comparison anchor).
- Drag to zoom in on a time range.
- Toggle visibility of advice markers / user actions / threshold line.
- Export timeline as PNG or PDF (for user records, audit).

### Why this matters

The timeline is **the visual proof** that Largo did the work. It makes the value visible. A user who looks at their timeline after a successful mission and sees "Here are the 14 advices Largo gave me, and I bought at the right one" has a fundamentally different trust relationship than a user who got a single notification.

This is where calibration becomes a feature, not just a metric.

---

## 13. Search Advice Card

Detailed in Section 4. Two additional UX rules:

1. **Card reflects state hierarchy.** A `BUY_NOW` card is more visually prominent than a `MONITOR` card. An `ABSTAIN` card is honest but not alarming. Visual weight should match informational weight.
2. **No CTA pressure.** The card always offers "Start a watch" but never makes it the only option. The user can always close the card or proceed with the result list as if Largo were absent.

---

## 14. Auto-Buy UX, Without Premature Activation

Auto-buy is the most consequential feature. Its UX must be slow, deliberate, and reversible.

### Three-stage consent

1. **Stage 1 — Mission creation.** User checks "I authorize Largo to auto-buy under conditions I will set" — this is general authorization, no specific transaction.
2. **Stage 2 — Threshold setup.** User explicitly sets a price below which Largo may auto-buy. This is per-mission.
3. **Stage 3 — Per-execution window.** When triple-condition is met, Largo creates a Stripe pre-authorization and notifies the user. The capture happens after a confirmation window (size TBD in `LARGO_SECURITY_PAYMENTS.md`). **In Phase 1, every auto-buy requires this confirmation window — there is no silent execution.** Silent execution may be evaluated in a later phase only after dispute rate, audit completeness, cohort safety, and user trust have been validated; that decision belongs to `LARGO_SECURITY_PAYMENTS.md`.

### Activation rules

- Auto-buy is **never enabled by default**.
- The toggle is in the mission settings, not in the main flow.
- Enabling auto-buy requires the user to acknowledge a clear summary: what happens, how to cancel, refund handling per provider terms, audit access.
- 2FA is required to enable auto-buy (and to change threshold).
- Auto-buy is automatically disabled when ML layer is down or providers are flagged unreliable.

### Visual treatment

- The auto-buy state is shown prominently on the mission dashboard: "Auto-buy: enabled below $850" or "Auto-buy: disabled".
- A green dot or padlock icon, never a flame or urgency symbol.
- The threshold line on the timeline is clear and labeled.

### Cancel & refund UX

- After an auto-buy capture, the user has a cancel window (duration TBD in `LARGO_SECURITY_PAYMENTS.md`), where provider terms allow.
- The cancel button is **prominent**, not hidden in a settings menu.
- Cancellation triggers a refund handled according to provider terms and Flyeas refund policy, plus a confirmation email.
- Where provider terms do not allow a full refund, the UI explains exactly what is recoverable and what is not, before the user clicks cancel.

### What the user must never feel

- Surprise: "I didn't know it would buy."
- Helplessness: "I can't undo this."
- Confusion: "What just happened?"
- Pressure: "I had to commit immediately."

If any of those happen, the auto-buy UX has failed regardless of the technical correctness.

---

## 15. Onboarding

The first 30 seconds determine retention.

### Goals

1. The user understands what Largo is (an honest agent, not a comparator).
2. The user knows what Largo does (watches, advises, optionally buys).
3. The user understands Largo can say "I don't know" — and that's a feature.
4. The user has either started a mission or completed one search with advice.

### Anti-goals

- The user is **not** asked to enable auto-buy in onboarding.
- The user is **not** shown a wall of explainer text.
- The user is **not** required to register before getting value.

### Proposed flow (draft)

**Step 1 (5 sec):** Single-line value prop.
> "Largo helps you buy at the right time, with calibrated honesty."

**Step 2 (10 sec):** Try it without commitment.
> Search field with a recent example route pre-filled. User can run a search immediately and see an `AdviceCard`.

**Step 3 (10 sec):** Optional mission start.
> "Want us to keep watching? Start a free mission" — single button, no signup gate.

**Step 4 (5 sec):** Honest framing.
> "We tell you when we don't know. We never push you to buy. You're always in charge."

The whole flow is fully skippable via a clear "skip" control. No nag screens. We never block value behind onboarding.

---

## 16. Healthy Retention

Retention comes from repeated proven utility, never from FOMO loops.

### Sustainable retention triggers

- **Useful advice changes** worth a notification (gated by Section 11).
- **Mission outcomes** that the user wants to revisit (savings display, see rules below).
- **Aggregated savings page** showing cumulative value over multiple missions, subject to the verified-vs-estimated rules below.
- **Reasons archive** — the user can browse past advices and see how they aged.
- **Provider disagreement / coverage warnings** that are genuinely informative.
- **Seasonal recommendations** that respect frequency caps and only fire on real signal.
- **Trust / Methodology page** from MVP — explains how Largo works, what it claims, what it doesn't, and what evidence supports its reasoning.
- **Public audit page** introduced once real audit events exist (auto-buy executions and advice outcomes meaningful at scale). We do not ship an empty audit page on day 1; that would feel immature and erode trust.
- **Calibration metrics published** after evidence is collected at scale.

### Savings display rules (verified vs estimated)

The "we saved you $X" feature is powerful but easy to misuse. Hard rules apply:

- **Verified savings** — only displayed when measured against a clearly defined baseline (e.g., the price at mission creation, the baseline "always BUY_NOW", or the highest observed price in the window). Methodology is documented and accessible from the savings display.
- **Estimated savings** — must be explicitly labeled as estimation, with a tooltip or "How is this computed?" link.
- **No savings display** if the calculation is not defensible (e.g., we don't know what the user would have paid otherwise, or the baseline is ambiguous). It is better to show nothing than to show a misleading number.

### Forbidden retention triggers

- Streaks ("don't break your 7-day streak!").
- Re-engagement notifications after 7+ days inactivity without new content.
- Gamification badges that don't reflect real value.
- Push notifications during user's local night.
- "Featured deals" that aren't tailored or audited.

### Retention metrics (internal targets, see `LARGO_EVALUATION_PLAN.md`)

- 7-day retention.
- 30-day retention.
- Mission completion rate.
- Notification dismissal rate (lower = better-targeted).
- Unsubscribe rate from notifications.
- Voluntary feedback rating.

We do not optimize for "daily active users" as a top metric. We optimize for **value delivered per user**.

---

## 17. Forbidden Dark Patterns

This is a hard list. Anything on this list is **not shipped**, regardless of conversion impact.

| Pattern | Forbidden because |
|---|---|
| Urgency timers ("Buy in 9:43") | Manufactures pressure not reflecting real urgency |
| Fake scarcity ("Only 2 left!") unless verified provider data | Manipulates without ground truth |
| "X people viewing now" widgets | Social proof faked or out of context |
| Default-on auto-buy | Bypass of explicit consent |
| Hidden cancel buttons | Traps users |
| Guilt-tripping dismissal modals ("Are you sure you want to lose these savings?") | Manipulative |
| Fake reviews / testimonials | Trust violation |
| Comparative claims without published methodology | Trust violation |
| Aggressive paywalls in onboarding | Friction without delivering value first |
| Email re-engagement with fake "new" signals | Pollutes notification trust |
| Pre-checked subscription opt-ins | Manipulative |
| Single-click auto-buy confirmation | Bypass of safety |
| Selling user data | Existential trust violation |
| Mandatory account creation before any value | Friction without reciprocity |
| Hiding uncertainty to increase conversion | Trust violation, contradicts core posture |
| Burying fees / unclear total price | Misleading the user about the real cost |
| Pre-selected paid add-ons | Manipulative consent |
| Misleading AI certainty ("our AI is 99 % sure") | False certainty, hides calibration reality |
| Making cancellation or refund harder than activation | Asymmetric friction; manipulative |

### The interview test

Every feature passes through this filter: **"Could I defend this on stage at a press interview, with a journalist explicitly looking for dark patterns, and feel comfortable?"**. If the honest answer is "probably not", the feature does not ship.

---

## 18. Failure & Fallback States

Largo will fail in many ways. The product must degrade gracefully.

### Provider failures (price unavailable)

- AdviceCard shows: "We can't fetch a current price right now. We're trying again every few minutes."
- No advice generated until price is verified.
- Mission status: "Paused — provider issue. Resumes automatically when verified."

### ML layer down (`ml_available = false`)

- AdviceCard shows: "Limited analysis available today (deep model temporarily down)."
- Largo can still produce baseline advice but with `confidence: limited` semantic.
- Auto-buy is disabled until ML layer recovers.

### Route unknown to model

- AdviceCard shows ABSTAIN: "We don't have enough data on this route to advise yet."
- "Start a watch" remains available — observation will accumulate data.
- Auto-buy is disabled.

### Provider disagreement

- AdviceCard shows: "Our sources disagree on the current price by more than 10 %. Holding advice until we can confirm."
- No notification fires until verified.
- Auto-buy is disabled.

### Advice expired (older than `valid_until`)

- AdviceCard shows: "This advice is from N hours ago and may be stale. Refreshing..."
- Forced re-fetch on user view.
- Auto-buy will not fire on expired advice.

### Auto-buy refused (any safety flag)

- User receives notification explaining which condition was not met.
- Mission continues with auto-buy logged as "skipped — reason: X".
- User can adjust threshold or override (with explicit consent).

### Mission window closed without action

- Final notification with summary: "Your mission window has closed. Best observed price was $X. We never saw a confident BUY signal."
- The user can extend, buy at the current price, or end the mission.
- Mission is then archived, not silently deleted.

### General principle

In every failure mode, **the user knows what's happening and what to do next**. No silent failures, no "something went wrong" without context.

---

## 19. What Must Wait

Explicitly deferred to later phases. Listed here so the team avoids scope creep.

### Phase 2 deferred

- Hotel `LargoAdvice` integration.
- Bayesian per-route updating user-visible.
- Bandit-driven copy variation.
- First public whitepaper publication.
- Subscription tiers UI.
- Cohort-graduated auto-buy rollout.
- Live public audit page (replacing the Trust / Methodology page).

### Phase 3 deferred

- Car `LargoAdvice` integration.
- Bundle decision UI (joint flight + hotel + car).
- User personalization based on history.
- LLM-generated explanation enhancements.
- B2B API surface.
- Silent auto-buy execution option (only after evidence per Section 14).

### Phase 4 deferred

- Native mobile app (iOS / Android).
- International localization beyond English.
- Inventory partnership UI (negotiated rates).
- Open-source components publishable to GitHub.
- Public-facing competitive benchmark page.

If a feature on these lists appears in a Phase 1 implementation discussion, the proposal must be challenged. We do not skip phases.

---

## 20. Decisions Made (per founder validation, 2026-04-26)

The following ten product decisions were validated by the founder during B0 framing and are treated as binding for Phase 1 implementation. They may be revisited in subsequent B0 documents (notably `LARGO_GO_TO_MARKET.md` and `LARGO_SECURITY_PAYMENTS.md`).

| # | Decision | Resolution |
|---|---|---|
| 1 | Brand naming | "Largo" is **user-visible** as the agent's name (e.g., "Largo recommends waiting"). Final naming may be revisited in `LARGO_GO_TO_MARKET.md`. |
| 2 | AdviceCard rendering policy | **Always render**. ABSTAIN is a first-class product state, not a failure to be hidden. |
| 3 | Default landing page | **Search first** in Phase 1. Mission setup is the natural upsell after the user has seen the value. A/B testing may be considered in Phase 2+. |
| 4 | Audit page from day 1 | **No empty audit page.** A **Trust / Methodology page** ships from MVP. A **live Public Audit Page** is introduced only when real audit events exist (auto-buy executions, advice outcomes meaningful at scale). |
| 5 | Confidence visual treatment | **Horizontal bar with 3–4 segments + semantic label**. Color-blind safe. |
| 6 | Numeric confidence to power users | **Customer UI: semantic labels only.** Numeric values are accessible only in internal/debug/admin surfaces, never as a user-facing setting. |
| 7 | Search advice card without registration | **Anonymous users receive advice with a per-IP daily quota.** Value before signup, but bounded to prevent abuse. |
| 8 | Auto-buy "execute silently" option | **Phase 1: not allowed.** Every auto-buy requires a per-execution confirmation window. Silent execution may be revisited only in `LARGO_SECURITY_PAYMENTS.md` after evidence (low dispute rate, complete audit, validated cohort, validated user trust). |
| 9 | Mission expiration default | **Final notification with summary, then archive.** Never silent expiration. |
| 10 | Onboarding skippable | **Always skippable.** No friction before delivering value. |

---

## 21. Document Status

- **B0 framing only.** No implementation authorized.
- **Coherence dependency:** any change to `LARGO_DOMINATION_STRATEGY.md` may invalidate parts of this document.
- **Implementation requires:** V7a-7 closure, all B0 docs validated, founder authorization.
- **Authority:** product source of truth for Largo. Subordinate to founder; superior to per-feature designs.

---

*End of document.*
