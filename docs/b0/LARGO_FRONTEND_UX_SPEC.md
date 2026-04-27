# LARGO_FRONTEND_UX_SPEC

**Document type :** B0 documentary specification
**Status :** Draft, frozen for B0
**Version :** 0.1.0
**Last updated :** 2026-04-27
**Scope :** Future frontend / UX of Largo. Not implemented. No React component, no CSS, no route shipped from this document.

This document specifies the **future** frontend experience of Largo : surfaces, conceptual components, UI states, copy, accessibility, secure rendering of the customer-safe `LargoAdvice` view, handling of uncertainty, ABSTAIN, auto-buy confirmation, mission timeline, errors, loading, empty states, and anti-dark-patterns.

It is intentionally written **before** any component is built.

Cross-document dependencies (must remain consistent) :

- `LARGO_DOMINATION_STRATEGY.md`
- `LARGO_PRODUCT_VISION.md`
- `LARGO_ADVICE_CONTRACT.md`
- `LARGO_EVALUATION_PLAN.md`
- `LARGO_SECURITY_PAYMENTS.md`
- `LARGO_DATA_STRATEGY.md`
- `LARGO_MODEL_STRATEGY.md`
- `LARGO_BACKEND_API_SPEC.md`

Anchors preserved across all docs :

- `LargoAdvice` contract version `0.1.0`
- Customer surface receives only the **customer-safe view** (stripped server-side per `LARGO_BACKEND_API_SPEC.md`)
- ABSTAIN is a first-class product state, not an error, not hidden
- Numeric confidence is internal/admin only, **never** rendered in customer UI
- `observed_price_usd` and `provider.primary_provider` may be `null` and must never be coerced
- Phase 1 = flights only
- Phase 1 = no silent auto-buy
- No customer-facing comparative claims before benchmark proof

---

## 0. Document scope

This document does **not** :

- Create React components
- Create routes
- Create CSS or design tokens implementation
- Create screenshots or Figma artifacts
- Modify any app file
- Decide rendering framework specifics beyond the constraint that the customer view is stripped server-side

This document **does** :

- Pin the surfaces and the states each must support
- Pin copy guidelines and sample copy for the 11 critical states
- Pin the rendering matrices for `recommendation` and `confidence`
- Pin failure-state UX
- Pin accessibility floor
- Pin forbidden UX patterns (anti-dark-patterns)
- Pin Phase 1 / Phase 2 / Phase 3 gates for the frontend

The implementation must justify any deviation through a B0 amendment.

---

## 1. Frontend philosophy

Five principles. Non-negotiable.

1. **The frontend is a renderer, not a decider.** No safety value (price, confidence, recommendation, `can_autobuy`) is computed client-side. The frontend displays what the backend sends. If the backend says ABSTAIN, the frontend shows ABSTAIN. There is no "smart fallback" in the client.
2. **Honest uncertainty over fake confidence.** When confidence is limited, the UI says so. When data is unavailable, the UI says so. The product earns trust by refusing to pretend.
3. **No dark patterns, ever.** No fake scarcity, no manufactured urgency, no hidden cancellation, no pre-selected auto-buy, no daily "still watching" spam, no manipulation of the cancel/keep cognitive load.
4. **Accessibility is a floor, not a polish.** WCAG 2.2 AA is the minimum. State is never communicated by color alone. Every interactive element is keyboard-reachable. Screen-reader copy is real.
5. **Mobile-first, real network.** The primary device is a phone on a slow connection. The UI must remain usable when the price is null, when the model is unavailable, when latency degrades.

---

## 2. UX principles

| Principle | What it means |
|---|---|
| **Clarity over cleverness** | Plain language. No jargon. No "AI-powered" theatre. |
| **Calibration over confidence theatre** | Show the band. Show the abstain. Don't perform certainty. |
| **One decision per surface** | The advice card answers one question : should I buy now, wait, monitor, alert, or abstain? Everything else is supporting context. |
| **Reversibility surfaced** | Every commitment shows how to undo it before it is made, not after. |
| **No surprise charges** | Every charge is preceded by a confirmation surface with full price, currency, fees, and a hard cancel. |
| **Symmetric prominence** | Cancel, decline, abstain are rendered with equal visual weight to confirm/buy/proceed. |
| **Quiet by default** | Notifications opt-in. Daily noise off by default. Only meaningful events. |
| **Trust signals always reachable** | Methodology and audit (when populated) are linkable from every advice surface. |

---

## 3. Information architecture

Top-level surfaces (Phase 1) :

- **Landing** — what Largo is, how it works, methodology link.
- **Simple search** — origin, destination, dates → AdviceCard.
- **Mission dashboard** — list of saved missions with their current advice and timeline.
- **Mission detail** — single mission with its advice timeline, current advice card, controls.
- **Methodology / trust page** — how decisions are made, how confidence is calibrated, what ABSTAIN means.
- **Account** — profile, notification preferences, payment methods (Phase 2+), data export.

Deferred surfaces (Phase 2+) :

- Auto-buy setup
- Auto-buy confirmation modal
- Payment management
- Public audit page
- Admin / debug surfaces (separate auth tier)

Hierarchy :

```
Largo
├── Landing
├── Search
│   └── AdviceCard (simple search result)
├── Missions
│   ├── Mission list
│   ├── Mission detail
│   │   ├── Current advice card
│   │   ├── Advice timeline
│   │   ├── "Why?" panel
│   │   └── Mission controls (edit, cancel)
│   └── New mission flow
├── Methodology / Trust
│   └── Public audit (Phase 2+, when real events exist)
└── Account
    ├── Profile
    ├── Notifications
    ├── Payment methods (Phase 2+)
    └── Data export
```

---

## 4. Customer-safe advice view

The customer-safe view is what the backend sends to any non-admin surface (per `LARGO_BACKEND_API_SPEC.md` Section 10). The frontend renders this and **only** this :

| Field | Customer view | Notes |
|---|---|---|
| `recommendation` | yes | enum : BUY_NOW, WAIT, ALERT, MONITOR, ABSTAIN |
| `recommendation_reason_code` | yes | mapped to copy via reason-code catalog |
| `recommendation_human_summary` | yes | short server-side string |
| `confidence.label` | yes | semantic only : HIGH, MODERATE, LIMITED, UNAVAILABLE |
| `confidence.numeric_value` | **no** | admin-only, never rendered |
| `observed_price_usd` | yes (or null) | rendered as price or "price not available" |
| `currency` | yes | ISO 4217 |
| `provider.primary_provider` | yes (or null) | rendered as provider name or "checking sources" |
| `provider.disagreement_summary` | yes (when present) | semantic, e.g. "providers disagree on this fare" |
| `valid_until` | yes | drives expiry indicator + "refresh" CTA |
| `schema_version` | yes | hidden detail, available to support |
| `audit_block.audit_id` | **no** | admin-only |
| `audit_block.parent_advice_id` | **no** | admin-only |
| `technical_details` | **no** | admin-only |

The frontend treats any unknown / extra field as a noop. If the backend adds a field, the customer surface must not display it until copy and behavior have been specified.

---

## 5. Surfaces overview

| Surface | Phase 1 | Auth | Notes |
|---|---|---|---|
| Landing page | Active | Anonymous | Trust signals, methodology link |
| Simple search page | Active | Anonymous + auth | Quota-rate-limited per `LARGO_BACKEND_API_SPEC.md` |
| Search AdviceCard | Active | Anonymous + auth | Always renders, including ABSTAIN |
| Mission creation flow | Active (minimal) | Auth | Intent → budget → constraints → submit |
| Mission dashboard | Active | Auth | List of own missions |
| Mission detail / timeline | Active | Auth (own) or admin | Advice chain via `parent_advice_id` |
| Advice details modal | Active | Auth (own) or admin | Drill-down, "Why?" panel |
| "Why?" explanation panel | Active | Same | Semantic reasons, not technical |
| Auto-buy setup | **Disabled** | Auth | Phase 2+ |
| Auto-buy confirmation modal | **Disabled** | Auth | Phase 2+ |
| Notification preferences | Active (minimal) | Auth | Opt-in only |
| Trust / methodology page | Active | Anonymous | From MVP |
| Public audit page | **Disabled** | Anonymous | Phase 2+ once real events exist |
| Admin / debug surfaces | Active (admin only) | Admin + MFA | Separate auth tier |

---

## 6. Search page experience

Entry surface for first-time and anonymous users.

States :

- **Empty** : input fields focused on origin. Placeholder text in plain language. No "AI" badge, no marketing claims, no fake testimonials.
- **Typing / autosuggest** : airport autocomplete with IATA + city + country. No fabricated results.
- **Submitted, loading** : skeleton AdviceCard with neutral copy ("Checking sources…"). Cancel-able. Loading copy never says "buying" or "booking".
- **Anonymous quota approaching** : non-blocking notice ("You have N anonymous searches left. Sign in to continue."). Never blocks the current advice display.
- **Anonymous quota exceeded** : AdviceCard replaced by quota notice + sign-in CTA + plain-language explanation. Returns HTTP 429 from backend, not a fake advice.
- **Submitted, success** : AdviceCard renders the customer-safe view (Section 7).
- **Submitted, ABSTAIN** : AdviceCard renders ABSTAIN as a first-class state, not an error.
- **Submitted, error** : ErrorPanel with stable error code, customer copy, and retry CTA.

The search page never auto-buys, never auto-saves to a mission, never opts into notifications by default.

---

## 7. Search AdviceCard

The AdviceCard is the central rendering primitive. It always renders. It is the surface the user looks at.

Layout principles (conceptual, not implementation) :

- **Top zone** : route summary (origin → destination, dates, passengers).
- **Decision zone** : recommendation badge (BUY_NOW / WAIT / ALERT / MONITOR / ABSTAIN) with semantic color + icon + textual label. Never color-only.
- **Price zone** : observed price + currency + provider name (or "checking sources" when null). When `observed_price_usd` is null, render "Price not available right now" — **never $0**.
- **Confidence zone** : semantic confidence label (HIGH / MODERATE / LIMITED / UNAVAILABLE) with a short explanation pulled from `recommendation_human_summary`.
- **Reason zone** : one-sentence customer-safe reason from the reason-code catalog.
- **CTA zone** : primary CTA depends on the recommendation × confidence matrix (Section 16-19). ABSTAIN has no buy CTA.
- **Validity zone** : "Advice valid until HH:MM" derived from `valid_until`. After expiry, AdviceCard switches to a soft-disabled state with a "Refresh" CTA.
- **Trust footer** : link to methodology, advice ID (last 6 chars only, for support reference, **never the full audit_id**).

Constraints :

- AdviceCard always renders, even when ABSTAIN.
- AdviceCard never displays numeric confidence, technical_details, raw quantiles, model versions, or audit_id.
- AdviceCard never falls back to BUY_NOW under any failure.
- AdviceCard never invents a provider when `provider.primary_provider` is null.

---

## 8. Mission dashboard

Purpose : the user's saved missions, each with its current advice at a glance.

| Element | Behavior |
|---|---|
| Mission list | Cards sorted by activity. Each card shows route, dates window, current advice badge, current advice price (or "checking sources"), confidence label. |
| Empty state | Plain-language "No missions yet" + CTA to create one. No fake "popular routes" suggestion. |
| Pagination | Cursor-based (per backend), simple "Load more". |
| Filtering | Phase 1 minimal : by status (active / archived). |
| Dashboard-level notifications | Only meaningful events (price drop crossing the user's threshold, advice flipped, mission window closing). No daily summary by default. |

The dashboard never auto-creates missions from search history without explicit consent.

---

## 9. Mission timeline

The timeline is the chain of advice for a mission, ordered by time. It is the audit-equivalent at the customer surface.

| Element | Behavior |
|---|---|
| Entries | One per advice generation (`parent_advice_id` chain). Each entry shows recommendation badge, semantic confidence, price (or null), timestamp, short reason. |
| Direction | Newest first. |
| Density | Phase 1 : compact list. Drill-down opens the advice details modal. |
| Refresh | User can request a fresh advice. Rate-limited per backend. |
| Limits | Cursor pagination. Old advice never deleted from the user's view (append-only). |
| ABSTAIN entries | Rendered as first-class entries with their reason code, never collapsed or hidden. |
| Provider disagreement entries | Rendered with the disagreement summary, not erased to keep the timeline "clean". |

The timeline is the user-facing version of the audit. It is honest about every flip, every abstention, every disagreement.

---

## 10. Current advice card

Within a mission detail view, the "current advice card" is the most recent active advice. It is the same primitive as the Search AdviceCard with two differences :

1. It links to the mission (not anonymous).
2. It exposes mission controls : edit, cancel, refresh, view timeline, view methodology.

Mission controls never include "force buy now". The user's commitment goes through the auto-buy flow (Phase 2+) or through the user buying externally with the link the AdviceCard surfaces.

---

## 11. Advice details modal

Drill-down from any advice entry (search result, mission timeline entry, current advice card).

Sections :

- Recommendation + reason (semantic)
- Confidence label + plain-language explanation
- Price + provider + last-checked timestamp
- "Why?" panel (Section 12)
- Validity timer
- Mission link (if applicable)
- Methodology link
- Advice ID short reference (last 6 chars, for support)

The modal does **not** show :

- Numeric confidence
- Raw quantiles
- Model version
- Provider tokens
- Internal audit fields
- Disagreement raw provider names if disclosing them adds no customer value (summarized only)

---

## 12. "Why?" explanation panel

The customer-facing explanation. Semantic, not technical.

Composition :

- One sentence summary tied to `recommendation_reason_code`.
- 1–3 supporting bullets in plain language ("Prices on this route are typical for this time of year", "Two of our sources agree on the current fare", "We are early in your booking window").
- A link to the methodology page.

Forbidden in this panel :

- "Our model predicts…"
- "SHAP values show…"
- "Quantile 0.5 is…"
- Any numeric confidence
- Any model version
- Any internal feature name

The "Why?" panel is generated from the reason-code catalog server-side. The frontend never composes it from raw model output.

---

## 13. Confidence display

Confidence is **always semantic** in the customer UI. Four labels only, all defined in `LARGO_ADVICE_CONTRACT.md` :

- **HIGH** — strong agreement, calibrated, sufficient data.
- **MODERATE** — usable signal, some caveat.
- **LIMITED** — weak signal, surfaced honestly.
- **UNAVAILABLE** — calibration absent for this route / segment, no signal to share.

UI treatment :

- Each label has a distinct icon + label. Color is supportive, not the sole channel.
- Tooltip / inline explanation : one sentence, plain language.
- Never display the numeric value, never expose the calibrator, never show ECE values.

CTA gating tied to confidence — see Section 16-19 (state-by-state) and the matrix in this document.

---

## 14. Uncertainty display

When confidence is anything other than HIGH, the UI surfaces uncertainty explicitly :

- **Phrasing** : "Our signal is moderate / limited on this route", not "We are 73% confident".
- **No band on a graph** : Phase 1 does not display quantile bands or distribution graphs to customers. Bands are admin-only.
- **No false precision** : never round numeric confidence and display it. Never display "$X ± $Y" derived from quantiles.
- **Action gating** : LIMITED and UNAVAILABLE never present BUY_NOW as the primary CTA. The user can still proceed to an external booking link, but the recommendation is not BUY_NOW.

---

## 15. ABSTAIN state UX

ABSTAIN is a first-class product state. It is not an error, not a 4xx, not a friction.

UI treatment :

- AdviceCard renders normally.
- Recommendation badge : "ABSTAIN" with a neutral, non-alarming icon.
- Headline : plain-language explanation of why we are not advising right now.
- Reason copy from the catalog (route unknown, price unavailable, provider disagreement, confidence unavailable, etc.).
- Primary CTA : "Track this route" (creates a mission to monitor) or "Search a different route". Never a fabricated BUY_NOW.
- No apologetic copy ("Sorry we don't know") and no blame copy ("Try again later"). Neutral and honest.

ABSTAIN must be surveilled (per `LARGO_MODEL_STRATEGY.md`) for honest-vs-lazy. The UI must not bury ABSTAIN to preserve conversion. Hiding ABSTAIN is forbidden.

---

## 16. BUY_NOW state UX

| Confidence | UI treatment | Primary CTA | Allowed |
|---|---|---|---|
| HIGH | Strong recommendation badge, clear reason, optional band-honest phrasing | "View on {provider}" external link OR Phase 2+ "Confirm purchase" | Yes |
| MODERATE | Soft recommendation badge, hedged copy ("Looks like a good fare, signal is moderate") | "View on {provider}" external link | Yes |
| LIMITED | Recommendation downgraded to WAIT or ABSTAIN by decision policy. **BUY_NOW with LIMITED is forbidden by backend.** If frontend ever receives BUY_NOW + LIMITED, it surfaces an error and writes a defect log. | n/a | No |
| UNAVAILABLE | Same as LIMITED. **BUY_NOW with UNAVAILABLE is forbidden.** | n/a | No |

Sample copy — strong BUY_NOW :

> **Buy now.** This fare to {destination} on {date} looks well-priced based on what we know about this route. Our signal is strong.
>
> {Provider}: ${price}
> Advice valid until {time}.

Sample copy — moderate BUY_NOW :

> **Buy now, but read this.** This fare to {destination} on {date} looks better than typical. Our signal is moderate, which means it could move.
>
> {Provider}: ${price}
> Advice valid until {time}.

---

## 17. WAIT state UX

| Element | Behavior |
|---|---|
| Badge | Neutral "Wait" |
| Reason | "Prices on this route typically ease closer to {date}", or similar from catalog |
| Confidence | Shown semantically |
| Primary CTA | "Track this route" (create or update mission) |
| Secondary CTA | "View current fare anyway" (external link, no recommendation) |
| Notification | Opt-in : "Notify me if the price drops below {threshold} or the recommendation changes" |

Sample copy — WAIT :

> **Wait.** Based on what we know about this route, we expect a better fare to be available between now and {date}. We will track this for you if you want.

---

## 18. ALERT state UX

ALERT is reserved for cases where the user has set a threshold and the live price has crossed it, or for an unusual price event (sharp drop, route-rare low fare).

| Element | Behavior |
|---|---|
| Badge | "Alert" with attention icon, but **no urgency theatre** (no countdown unless tied to real provider expiry) |
| Reason | Plain language : "The fare crossed your threshold of ${threshold}" or "This is unusually low for this route" |
| Primary CTA | "View on {provider}" or "Confirm purchase" (Phase 2+) |
| Notification | Sent if user opted in |
| Frequency | Rate-limited : no more than one ALERT per mission per defined window unless the price moves materially |

ALERT is **never** synthetic. No "this fare may not last" copy unless backed by provider TTL.

---

## 19. MONITOR state UX

MONITOR is the default mission state when the recommendation is to keep watching.

| Element | Behavior |
|---|---|
| Badge | "Monitoring" |
| Reason | Plain language : "We are watching this route. We will let you know if anything meaningful changes." |
| Primary CTA | "View timeline" |
| Notification | Quiet by default. User opts in to specific event types. |

MONITOR must not generate daily noise. A "still monitoring" notification is only sent if the user explicitly opted in to a periodic digest, and the digest is opt-out from any notification.

---

## 20. Provider failure UX

When the provider chain returns insufficient data :

- AdviceCard renders ABSTAIN with reason `provider_unavailable`.
- Copy : "We could not get a reliable fare for this route right now. Try again in a few minutes, or track the route and we will check again."
- No fabricated price.
- No "$0".
- No "estimated" price unless the estimate is calibrated and the UI explicitly labels it.
- Auto-buy CTA disabled (when present in Phase 2+).

Sample copy — ABSTAIN provider unavailable :

> **We can't advise on this fare right now.** Our sources didn't return a usable price for {route} on {date}. We are not guessing. Track this route and we will check again.

---

## 21. Route unknown UX

When the route is outside the Phase 1 allowlist or has insufficient historical data :

- AdviceCard renders ABSTAIN with reason `route_out_of_scope`.
- Copy : "We don't have enough history on this route to give a calibrated recommendation. We can still track it and notify you of meaningful price changes."
- Primary CTA : "Track this route".
- No BUY_NOW, no WAIT, no fabricated confidence.

Sample copy — ABSTAIN route unknown :

> **We don't have enough history on {origin} → {destination} to advise yet.** We won't pretend. We can monitor this route for you and let you know if anything changes.

---

## 22. Price unavailable UX

When `observed_price_usd` is null (provider returned no price, or all providers failed) :

- Price zone of the AdviceCard : "Price not available right now".
- Never display `$0`.
- Never display `—` ambiguously without a label.
- The recommendation defaults to ABSTAIN unless the policy can decide on non-price signals (Phase 2+).

---

## 23. Provider disagreement UX

When the provider chain shows disagreement above tolerance :

- AdviceCard surfaces a small notice : "Our sources disagree on this fare."
- Reason : `provider_disagreement` from the catalog.
- Recommendation typically ABSTAIN in Phase 1 ; may be WAIT in Phase 2+ once disagreement signals are calibrated.
- Auto-buy CTA disabled (when present in Phase 2+).

Sample copy — provider disagreement :

> **Our sources disagree on this fare.** We won't advise a purchase when the price isn't consistent across what we check. We are tracking the route and will revisit.

---

## 24. Advice expired UX

When `valid_until` has elapsed :

- The AdviceCard transitions to a soft-disabled state : decision badge dimmed, price labelled "as of {time, expired}", primary CTA replaced by "Refresh advice".
- Expired advice is **never** acted upon for auto-buy (per backend gate).
- Refresh creates a new advice with a new `advice_id`, linked via `parent_advice_id`.

Sample copy — advice expired :

> **This advice is from {time} and is no longer current.** Refresh to get an up-to-date recommendation for {route}.

---

## 25. Loading states

| Surface | Loading treatment |
|---|---|
| AdviceCard (search) | Skeleton with neutral text "Checking sources…". Never preview a recommendation. Cancel-able. |
| Mission dashboard | Skeleton list. Last-known data preserved in cache until refresh completes. |
| Advice details modal | Spinner with "Loading details…". |
| Auto-buy confirmation (Phase 2+) | Spinner with "Verifying with payment provider…". Never optimistic. |

Loading copy is neutral. Loading is never "Buying for you…" or "Almost done…" before the action is committed server-side.

Loading is bounded by the latency budget (per `LARGO_MODEL_STRATEGY.md` and `LARGO_BACKEND_API_SPEC.md`). On budget breach, the UI degrades to ABSTAIN, not to a fabricated optimistic state.

---

## 26. Empty states

| Surface | Empty copy |
|---|---|
| Mission dashboard | "No missions yet. Search a route to get started." Single CTA. |
| Mission timeline | "No advice yet for this mission. We will start tracking now." |
| Notification list | "No notifications. We will only notify you of meaningful changes you opt in to." |
| Search history | "No recent searches." |

No fake popular routes. No fake "people are looking at this" prompts. No fabricated suggestions.

---

## 27. Error states

Every error state is bound to a stable error code from `LARGO_BACKEND_API_SPEC.md` Section 28.

| Error code | UI treatment | CTA |
|---|---|---|
| `LARGO_PRICE_UNAVAILABLE` | ABSTAIN AdviceCard | Track route / Try later |
| `LARGO_PROVIDER_DISAGREEMENT` | ABSTAIN AdviceCard with disagreement note | Track route |
| `LARGO_ROUTE_UNKNOWN` | ABSTAIN AdviceCard with scope note | Track route / Search different |
| `LARGO_ADVICE_EXPIRED` | Expired-advice treatment | Refresh |
| `LARGO_CONFIDENCE_UNAVAILABLE` | ABSTAIN AdviceCard | Track route |
| `LARGO_AUTOBUY_BLOCKED` | Inline notice on auto-buy surface (Phase 2+) | Show reason, allow manual |
| `LARGO_PAYMENT_DISABLED` | Inline notice on payment surface (Phase 2+) | Try again later |
| `LARGO_RATE_LIMITED` | Quota panel with `Retry-After` countdown (real, not theatre) | Sign in / Wait |
| `LARGO_UNAUTHORIZED` | Sign-in prompt | Sign in |
| `LARGO_FORBIDDEN` | Plain-language denial | Contact / Back |
| `LARGO_INTERNAL_ERROR` | Generic error panel with `request_id` last 6 chars | Retry / Contact |

Error copy is short, neutral, never blaming. No stack traces. No internal field names. No model versions.

---

## 28. Notification UX

Principles :

- **Opt-in only.** No notification is enabled by default.
- **No daily noise.** No "still watching" daily digest by default. Optional digest only by explicit opt-in.
- **Meaningful events only.**
  - Price drop crossing user's threshold
  - Advice recommendation flipped
  - Mission window closing
  - Auto-buy confirmation reminder (Phase 2+)
  - Auto-buy executed (Phase 2+)
- **One channel preference per mission.** Email, push, or none.
- **Frequency cap.** Maximum N notifications per mission per day, configurable.
- **Unsubscribe in-message.** Every notification carries a plain unsubscribe link.

Forbidden :

- "Hurry, prices changing" without backing
- "X people viewed this fare today" without backing
- Any urgency theatre

Sample copy — mission window closing :

> **Your mission window is closing.** We have not seen a fare meeting your criteria for {route} between now and {end_date}. We will keep watching, and we will send a final summary at the end.

---

## 29. Auto-buy setup UX (Phase 2+ surface, **disabled in Phase 1**)

Setup is opt-in, multi-step, with explicit disclosure.

Steps :

1. **Disclosure** : plain-language explanation of what auto-buy does, when it triggers, when it does not, what cancellation rights exist.
2. **Threshold selection** : user picks a fare ceiling and / or a confidence floor. No defaults pre-selected.
3. **Consent** : separate, explicit checkbox for auto-buy ; another for storing payment method ; another for notifications. **Never bundled.**
4. **Payment method** : Stripe Elements (no PAN ever to our server, per `LARGO_SECURITY_PAYMENTS.md`).
5. **Review** : full summary before submitting.
6. **Confirmation** : explicit submit ; no progress bar that completes alone ; no skip-to-buy.

Cancellation : visible at every step, equal weight to "Continue".

In Phase 1 this surface is not exposed to users. Backend returns 503 `LARGO_AUTOBUY_BLOCKED` for any attempt.

---

## 30. Auto-buy confirmation UX (Phase 2+ surface, **disabled in Phase 1**)

The confirmation modal is the most safety-critical UX in Largo.

| Element | Rule |
|---|---|
| TTL | 60 seconds, real, tied to backend `valid_until` (per `LARGO_SECURITY_PAYMENTS.md`) |
| Countdown | Honest countdown, not a theatrical urgency timer |
| Price displayed | Server-revalidated price, not the search-time price |
| Currency | Locked to advice currency |
| Fees | All fees disclosed before submit |
| Cancel | Equal visual weight to confirm. **Never** smaller, **never** dimmed, **never** in a less-prominent corner |
| Default focus | Cancel, not confirm |
| Implicit confirm | Forbidden. Pressing Enter must not auto-confirm a payment |
| Post-confirm | Server returns committed result. UI never shows "purchased" before server confirms |
| Rollback | If server fails post-click, UI shows the failure and never silently commits |

Sample copy — auto-buy confirmation :

> **Confirm purchase.**
> {Origin} → {Destination}
> {Date}
> {Provider}: ${price}
>
> By confirming, you authorize a charge of ${price} {currency} on {payment_method}.
> You have until {hh:mm:ss} to cancel without charge.
>
> [ Cancel ]    [ Confirm purchase ]

Both buttons same visual weight. Cancel is the default focus.

---

## 31. Auto-buy disabled UX (Phase 1)

When the user reaches a surface that would expose auto-buy in Phase 1 :

- Inline notice : "Auto-buy is not available yet. We are running Phase 1 with a small group and want to earn the right to charge cards on your behalf before opening this."
- No fake "Coming soon" countdown.
- No waitlist scarcity ("Only 50 spots left") unless real and verified.
- Manual purchase path remains : the user can click an external provider link to book themselves.

Sample copy — auto-buy disabled :

> **We don't auto-buy yet.** Phase 1 of Largo earns the right to handle purchases by being correct first. You can still book {route} directly with {provider}.

---

## 32. Payment-related UX (Phase 2+)

- Card data input via Stripe Elements only. Largo's frontend never sees PAN, CVV, or full expiry.
- Payment method storage is opt-in, per `LARGO_SECURITY_PAYMENTS.md`.
- Receipts surfaced in-account, with stable IDs, never with Stripe internal secrets.
- 3DS (SCA) flows handled by Stripe ; Largo's UI defers and surfaces only success / failure / pending states.
- Refunds and disputes are surfaced honestly (Section 33).

---

## 33. Cancellation / refund UX

- Cancellation window, when applicable, is surfaced before commitment, not after.
- Refund policy is plain-language : conditions, timeline, channel.
- Refund actions are user-initiable (when policy allows) ; no hidden "contact support" maze.
- Disputes : the UI explains how to escalate, with an SLA expectation.
- Booking failure (after capture) is surfaced honestly with the SEV-tier comms cadence from `LARGO_SECURITY_PAYMENTS.md`.

Sample copy — cancellation / refund window :

> **You can cancel within {hh:mm:ss} for a full refund.** After that, refunds are subject to {provider}'s policy. We will tell you if a fare can no longer be cancelled before you confirm.

---

## 34. Trust and methodology page

From MVP. The page is reachable from every advice surface and from the landing page.

Required content :

- **What Largo does** : a paragraph of plain language.
- **What Largo does not do (yet)** : Phase 1 limits stated honestly (flights only, no auto-buy yet, anonymous quota).
- **How we calibrate confidence** : semantic, not technical. Pointer to evaluation summary.
- **What ABSTAIN means** : explained as a feature, not a failure.
- **What audit means** : pointer to public audit page (when populated, Phase 2+).
- **Limits and known gaps** : honest list. No hype.
- **Data privacy** : link to privacy / consent surface.
- **Methodology summary** : version of the evaluation plan, with a link to the canonical doc when published.

Forbidden on this page :

- Comparative claims against Hopper / Skyscanner / Going / Kayak / Google Flights without benchmark evidence in the published `LARGO_COMPETITIVE_BENCHMARK.md` document and verified data.
- Unverified "we saved you X" totals.
- Marketing fabrications ("Used by 100,000 travelers").

---

## 35. Public audit page future UX (Phase 2+)

Conceptual surface. **Disabled in Phase 1** because there are no real, populated audit events to expose yet.

When activated :

- Shows aggregate, anonymized audit events : decisions made, ABSTAIN rate, calibration drift, recommendation flips.
- Shows method versions and snapshot references.
- Shows recent kill-switch events with reason (anonymized).
- Never exposes individual user audit data.
- K-anonymity ≥ 5 floor (per `LARGO_DATA_STRATEGY.md`) on any cohort statistic.

Required only when there is real history to publish. Until then, the route returns the methodology page or a "Coming soon when we have enough events to be honest" placeholder.

---

## 36. Accessibility

Floor : **WCAG 2.2 AA**. Aim for AAA where feasible.

Required :

- All recommendation badges have icon + text, not color-only.
- All interactive elements keyboard-reachable, with visible focus.
- All form inputs have associated labels.
- All errors associated with their inputs via ARIA.
- All confirmation modals trap focus while open.
- All countdown timers expose remaining time as text, not graphic-only.
- Screen-reader copy is real and tested, not auto-generated alt text.
- Contrast ratio ≥ 4.5:1 for body text, ≥ 3:1 for UI elements.
- Motion respects `prefers-reduced-motion`.
- No flashing content above WCAG threshold.
- Touch targets ≥ 44×44 pt on mobile.

Accessibility is non-negotiable. A surface that breaks the floor is rolled back.

---

## 37. Mobile-first behavior

Primary device : phone, slow 4G, one hand.

Implications :

- AdviceCard fits a single mobile viewport without horizontal scroll.
- Primary CTA reachable with the thumb (bottom half of the screen on a 6" device).
- Confirmation modal fully visible without scrolling.
- Tap targets respect the 44×44 pt floor.
- Forms reduced to essentials. No "creative" multi-column layouts on mobile.
- Skeletons on slow connections instead of empty white screen.
- Network failure visible immediately, not after a 30-second timeout.

---

## 38. Responsive layout

Breakpoints (conceptual, not implementation) :

| Breakpoint | Behavior |
|---|---|
| ≤ 640 | Single column, mobile-first. AdviceCard takes full width. Bottom-sheet confirmation. |
| 641 – 1024 | Two-column where appropriate (mission detail + timeline). |
| ≥ 1025 | Optional three-column (list + detail + timeline) for mission dashboard. |

Layout never causes content reflow that hides a CTA the user was about to click. No layout shift on critical surfaces beyond the platform `CLS` budget.

---

## 39. Internationalization future policy

Phase 1 : English only, USD only.

Future :

- All customer-visible copy externalized to a translation catalog from day 1 (no hardcoded strings on critical surfaces).
- Currency display localized when supported.
- Date / time localized.
- ABSTAIN reason copy translated as full sentences, not interpolated fragments (to preserve sentence structure across languages).
- RTL languages : layout mirroring planned, but not on the Phase 1 critical path.

---

## 40. Copywriting guidelines

Voice :

- Plain. Direct. Calm. Honest.
- Second person ("you") for the user.
- First person plural ("we") for Largo, used sparingly.
- No marketing superlatives.
- No "AI" branding theatre. We do not say "powered by AI" or "AI travel agent".
- No emojis on safety-critical surfaces. (Reduces clarity, can imply tone Largo doesn't intend.)

Mechanics :

- Sentences under 20 words on customer surfaces, where possible.
- Numbers as digits, currency with symbol and ISO code where ambiguous.
- Time in user's local timezone, with explicit timezone label on confirmation surfaces.
- "ABSTAIN" never appears as a word in customer copy. The label is "We're not advising right now" or similar plain phrase. (The internal value remains `ABSTAIN`.)
- "BUY_NOW" never appears as a word in customer copy. The label is "Buy now" with sentence-case and contextual reasoning.

Sample copy — mission window closing :

> **Your mission window for {route} closes on {end_date}.** We have not seen a fare meeting your criteria. We will keep watching until then and send a final summary.

---

## 41. Forbidden UX patterns

Append-only list. New patterns are added ; existing patterns never softened.

| # | Pattern | Why forbidden |
|---|---|---|
| 1 | Numeric confidence in customer UI | Internal-only |
| 2 | Technical details in customer UI | Internal-only |
| 3 | Raw model output in customer UI | Internal-only |
| 4 | Model version exposed to customer | Internal-only |
| 5 | Audit ID full value exposed to customer | Internal-only |
| 6 | `$0` instead of "Price not available" | Hides risk |
| 7 | Fabricated provider name when null | Dishonest |
| 8 | Fake scarcity ("Only 2 left") | Manipulation |
| 9 | Fake urgency ("Hurry, ends soon") without real provider TTL | Manipulation |
| 10 | Hidden cancel button | Dark pattern |
| 11 | Cancel button visually de-emphasized | Dark pattern |
| 12 | Pre-selected auto-buy on signup | Coerced consent |
| 13 | Bundled consent (one checkbox for multiple things) | Coerced consent |
| 14 | Default-on notifications | Coerced consent |
| 15 | Daily "still watching" notification by default | Spam |
| 16 | "We saved you $X" without verified counterfactual | Misleading |
| 17 | Estimated savings displayed as verified savings | Misleading |
| 18 | Hiding ABSTAIN to preserve conversion | Dishonest |
| 19 | Coercing ABSTAIN into a softer "We recommend waiting" | Dishonest |
| 20 | Rendering BUY_NOW when confidence is LIMITED | Safety violation |
| 21 | Rendering BUY_NOW when confidence is UNAVAILABLE | Safety violation |
| 22 | Auto-buy CTA when any safety/data-quality blocker present | Safety violation |
| 23 | Silent auto-buy in Phase 1 | Out of phase |
| 24 | Frontend computing `can_autobuy` | Trust violation |
| 25 | Frontend overriding ABSTAIN to BUY_NOW | Trust violation |
| 26 | Color-only state communication | Accessibility violation |
| 27 | Dark-pattern dismissal copy ("No, I don't want to save money") | Manipulation |
| 28 | Confirmshaming on cancel | Manipulation |
| 29 | Comparative claims vs Hopper/Skyscanner/Going/Kayak/Google Flights without published benchmark | Misleading |
| 30 | "AI travel agent" branding theatre | Misleading positioning |
| 31 | Fabricated user testimonials | Fraud |
| 32 | Fabricated route popularity | Fraud |
| 33 | Optimistic UI showing "purchased" before server confirms | Misleading |
| 34 | Loading copy implying purchase before submit ("Buying for you…") | Misleading |
| 35 | Auto-confirm on Enter for payments | Safety violation |
| 36 | Hidden refund / dispute path | Trust violation |
| 37 | Downplaying provider disagreement to look decisive | Dishonest |
| 38 | Downplaying provider failure to look reliable | Dishonest |
| 39 | Showing fabricated "estimated" price when null | Hides risk |
| 40 | Localizing currency without localizing risk copy | Inconsistent honesty |
| 41 | Skipping methodology link from advice surfaces | Trust violation |
| 42 | Pre-checking "share my data for training" | Coerced consent |

---

## 42. Component inventory

Conceptual list. Implementation phase decides framework primitives.

| Component | Purpose | Phase |
|---|---|---|
| `AdviceCard` | Renders the customer-safe advice view | 1 |
| `AdviceBadge` | Recommendation label + icon, never color-only | 1 |
| `ConfidenceLabel` | Semantic confidence (HIGH / MODERATE / LIMITED / UNAVAILABLE) | 1 |
| `PriceDisplay` | Price + currency + provider, handles null | 1 |
| `ValidUntilTimer` | Honest countdown to `valid_until` | 1 |
| `WhyPanel` | Reason-code-driven plain-language explanation | 1 |
| `RouteSummary` | Origin / destination / dates / passengers | 1 |
| `MissionList` | Dashboard list of missions | 1 |
| `MissionTimeline` | Chain of advice for a mission | 1 |
| `AdviceDetailsModal` | Drill-down with WhyPanel | 1 |
| `ErrorPanel` | Stable error code rendering | 1 |
| `QuotaPanel` | Anonymous quota display + sign-in CTA | 1 |
| `ExpiredAdviceCard` | Soft-disabled state with refresh CTA | 1 |
| `AbstainCard` | First-class ABSTAIN rendering | 1 |
| `MethodologyPage` | Trust surface | 1 |
| `NotificationPreferences` | Opt-in toggles, no defaults on | 1 |
| `AutoBuySetup` | Multi-step opt-in flow | 2 |
| `AutoBuyConfirmModal` | 60s real-TTL confirmation | 2 |
| `PaymentMethodInput` | Stripe Elements wrapper | 2 |
| `AccountDataExport` | GDPR-shape export | 1 minimal, 2 expanded |
| `PublicAuditPage` | Aggregate audit display | 2+ |

No component computes safety values. All components render server-derived data.

---

## 43. Design tokens / visual system principles

Phase 1 keeps the visual system honest and minimal :

- **Color** : a small palette. Recommendation states have distinct hues, but icon + text always co-present. No state communicated by color alone.
- **Typography** : one or two families maximum. System font fallback. Body text large enough on mobile (≥ 16 px equivalent).
- **Spacing** : a defined scale. Touch targets respect the floor.
- **Iconography** : consistent style ; recommendation icons are unambiguous (e.g. checkmark for BUY_NOW, hourglass for WAIT, bell for ALERT, eye for MONITOR, neutral pause for ABSTAIN).
- **Motion** : minimal. Respect `prefers-reduced-motion`. No bouncing, no flashing, no theatrical micro-interactions.
- **Imagery** : functional. No stock-photo travelers. No fabricated map graphics that imply unsupported routes.
- **Logo / brand** : Largo. Minimal mark. No "AI" sigil.

The visual system rewards trust, not engagement-bait.

---

## 44. Frontend performance budgets

| Metric | Phase 1 budget | Notes |
|---|---|---|
| Largest Contentful Paint (mobile, 4G) | ≤ 2.5 s | Critical surfaces only |
| First Input Delay / INP | ≤ 200 ms | All surfaces |
| Cumulative Layout Shift | ≤ 0.1 | Critical surfaces |
| AdviceCard render after API response | ≤ 200 ms | Customer-perceived |
| Skeleton-to-content transition | No CLS on critical surfaces | Must be reserved layout |
| Bundle size (initial route) | ≤ 200 KB gzipped | Phase 1 target, revisited after benchmarks |
| Time-to-interactive (mobile) | ≤ 3.5 s | Phase 1 target |

Performance budgets are checked on real devices, not synthetic-only Lighthouse runs.

---

## 45. Analytics / event tracking

Principles :

- Event tracking respects consent. No tracking without explicit opt-in for non-essential analytics.
- Essential analytics (error rates, latency, conversion of critical flows) is allowed, anonymized, and documented.
- No third-party trackers loaded before consent.
- No fingerprinting beyond first-party session.
- No cross-site tracking.
- No share of user data with ad networks.
- Events instrumented :
  - `advice_requested`
  - `advice_rendered`
  - `advice_abstained` (with reason code, anonymized)
  - `mission_created`
  - `mission_cancelled`
  - `notification_opted_in`
  - `error_displayed` (with stable code)
  - `auto_buy_setup_started` (Phase 2+)
  - `auto_buy_confirmed` (Phase 2+)
  - `auto_buy_cancelled_in_window` (Phase 2+)

Events are server-aggregated. Numeric confidence and audit_id are **never** included.

---

## 46. Privacy in frontend

- Forms collect the minimum needed for the action.
- PII is sent over HTTPS only, never in URL query strings, never in logs (per `LARGO_BACKEND_API_SPEC.md`).
- Consent surfaces are layered (per `LARGO_DATA_STRATEGY.md`) : essential, functional, training-reuse, marketing — each separately togglable, each defaulted off where applicable.
- Data export is reachable from the account surface with a single action.
- Account deletion is reachable with a single action ; soft-delete with anonymization period documented.
- Cookies : essential by default, all others opt-in.
- No localStorage / sessionStorage of secrets, tokens, or PII beyond ephemeral session needs.

---

## 47. Phase 1 / Phase 2 / Phase 3 gates

| Gate | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|
| Search AdviceCard | Active | Active | Active |
| Mission dashboard | Active | Active | Active |
| Mission timeline | Active | Active | Active |
| Advice details modal | Active | Active | Active |
| Trust / methodology page | Active | Active | Active |
| Notification preferences | Active (minimal) | Active (expanded) | Active |
| Auto-buy setup | **Disabled** | Active (cohort) | Active |
| Auto-buy confirmation modal | **Disabled** | Active | Active |
| Payment management | **Disabled** | Active | Active |
| Public audit page | **Disabled** | Active (when events populated) | Active |
| Comparative benchmark claims | **Disabled** | Conditional on `LARGO_COMPETITIVE_BENCHMARK.md` evidence | Conditional |
| i18n | English / USD | Selective | Expanded |
| Cohort gates | 0 → 10 | 10 → 100 | 100 → 1000 → GA |

Frontend phase advancement requires the corresponding gates in `LARGO_BACKEND_API_SPEC.md`, `LARGO_SECURITY_PAYMENTS.md`, `LARGO_DATA_STRATEGY.md`, `LARGO_MODEL_STRATEGY.md`, `LARGO_EVALUATION_PLAN.md` to all be satisfied. No unilateral frontend phase bump.

---

## 48. Open questions before implementation

Tracked, not blockers for B0.

1. Visual identity finalization (typeface, palette, mark).
2. Icon library choice (custom vs. open-source).
3. Animation library : minimal or none for Phase 1 ; library only if reduced-motion respected.
4. State management approach (server-component-first vs. client-state).
5. Cache invalidation strategy on customer-safe view (per `valid_until` vs. SWR-style).
6. Mission list pagination cursor format.
7. AdviceCard variants for ALERT vs. BUY_NOW visual differentiation.
8. ABSTAIN visual tone : neutral icon vs. "pause" vs. "thinking" — pick once and lock.
9. Methodology page authoring source : Markdown rendered, MDX, or CMS.
10. Email template framework for notifications.
11. Cookie consent UI provider or custom implementation.
12. Localization framework (per i18n future policy).
13. Public audit page schema and aggregation cadence.
14. Analytics platform choice (privacy-respecting first-party vs. external).
15. Performance monitoring (Real User Monitoring vs. synthetic).
16. Accessibility audit cadence (continuous vs. milestone).
17. Copy review process and ownership.
18. Feature flag mechanism for cohort gates.
19. Error reporting backend (Sentry, alternative, none).
20. Component library choice : custom, shadcn, headless UI primitives — Phase 1 decision deferred.
21. Auto-buy confirmation modal exact countdown timer pixel-level treatment.
22. Mobile bottom-sheet vs. centered modal for confirmations.
23. Empty state illustrations : functional vs. decorative — preference for functional.
24. Sign-in surface : modal vs. dedicated page.
25. Anonymous → authenticated transition preserving search context.

---

## 49. Document status

| Property | Value |
|---|---|
| Document | `LARGO_FRONTEND_UX_SPEC.md` |
| Phase | B0 documentary |
| Status | Frozen for B0, amendable via B0 review |
| Version | 0.1.0 |
| Date | 2026-04-27 |
| Implementation | None. No component, no route, no CSS, no deploy from this document. |
| V7a impact | None. V7a remains active baseline, untouched. |
| Cross-doc consistency | Pinned to `LargoAdvice` v0.1.0 customer-safe view, ABSTAIN first-class, numeric confidence admin-only, no fabricated price, no fake scarcity, no claims without benchmark proof. |
| Next B0 | `LARGO_COMPETITIVE_BENCHMARK.md`, `LARGO_GO_TO_MARKET.md` (order TBD by user) |

This document is a contract on the customer experience. The implementation must justify any deviation through a B0 amendment.
