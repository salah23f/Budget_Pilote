# LARGO_COMPETITIVE_BENCHMARK

**Document type :** B0 documentary specification
**Status :** Draft, frozen for B0
**Version :** 0.1.0
**Last updated :** 2026-04-27
**Scope :** Future competitive benchmark of Largo against the travel / search / price-prediction landscape. Not implemented. No public claim shipped from this document.

This document defines :

- The categories on which Largo will and will not compete first
- The competitor landscape and what we believe about each (with explicit "to verify" markers where we are not certain)
- Where Largo can legitimately win first
- Where Largo cannot yet claim superiority
- The evidence required before any public comparative claim is made
- The forbidden marketing patterns

It is intentionally written **before** any public claim, before any benchmark publication, before any "vs Hopper" landing page.

Cross-document dependencies (must remain consistent) :

- `LARGO_DOMINATION_STRATEGY.md`
- `LARGO_PRODUCT_VISION.md`
- `LARGO_ADVICE_CONTRACT.md`
- `LARGO_EVALUATION_PLAN.md`
- `LARGO_SECURITY_PAYMENTS.md`
- `LARGO_DATA_STRATEGY.md`
- `LARGO_MODEL_STRATEGY.md`
- `LARGO_BACKEND_API_SPEC.md`
- `LARGO_FRONTEND_UX_SPEC.md`

Anchors preserved across all docs :

- Largo aims to become the #1 travel decision agent long-term, but does **not** claim superiority on the road
- Phase 1 wedge is **Travel Fiduciary Agent** — mission-based decision quality, transparency, honest ABSTAIN
- Public comparative claims gated by `LARGO_EVALUATION_PLAN.md`
- ABSTAIN is a first-class differentiator
- No fake scarcity, no dark patterns
- No claim "better than X" without segment + metric + reproducible evidence

---

## 0. Document scope and "to verify" convention

This document does **not** :

- Browse the web for fresh competitor data in this turn
- Decide pricing or marketing copy
- Publish anything externally
- Run a head-to-head benchmark
- Modify any code or app file

This document **does** :

- Pin which categorical strengths and weaknesses we believe of each competitor, **with explicit "to verify" markers** where the claim is not directly observed
- Pin which segments Largo can target first
- Pin the evidence bar for any public comparative claim
- Pin the forbidden positioning patterns

**"To verify" convention** : any factual claim about a competitor that is based on general knowledge rather than a directly observed and dated artifact is annotated `[to verify]`. Before any public-facing repetition of such a claim, the team must validate it against a primary source (the competitor's own documentation, app, or a recent independent study) and replace `[to verify]` with the source citation.

This convention applies to feature presence, pricing, marketing copy, accuracy claims, and any quantitative figure. The default assumption is that competitors evolve quickly and our priors decay.

---

## 1. Benchmark philosophy

Five principles. Non-negotiable.

1. **Honesty over positioning.** A benchmark we cannot reproduce is worse than no benchmark. We refuse the marketing temptation.
2. **Categories before competitors.** We compare on the dimension we want to win on (mission decisioning, transparency, ABSTAIN), not on the competitor's home turf (raw inventory, brand recall).
3. **Segments before averages.** Global "Largo beats Hopper" is meaningless. Segment-bound claims (route family, time horizon, user type) are the only honest claims we will ever make.
4. **Reproducibility is the threshold.** A claim survives if a third party can run the same protocol on the same dataset and reach the same result within tolerance. Otherwise it does not exist.
5. **Incumbent strengths acknowledged loudly.** We tell users what incumbents do better than us. Hiding their strengths makes us look untrustworthy and is a worse business than admitting them.

Largo wins by being the system users would build for themselves if they had infinite time. That system is honest, calibrated, auditable, and refuses to act when uncertain. Marketing cannot manufacture this. Only execution against these constraints over time creates the wedge.

---

## 2. Competitive categories

The travel-decision space is not one market. It is several adjacent markets that overlap. Largo must pick which it is in :

| Category | Definition | Largo Phase 1 stance |
|---|---|---|
| Price search | Find the cheapest current fare for a given route/date | **Not competing first.** Existing incumbents (Google Flights, Kayak, Skyscanner) are very good at this. |
| Price prediction | Predict the future fare trajectory for a route/date | Competing **carefully**, only on segments where we can prove calibration. Not making global claims. |
| Mission-based decisioning | "Should I buy now, wait, abstain, given my mission, my budget, my constraints?" | **Primary wedge.** This is the question existing tools answer poorly. |
| Auto-buy safety | Execute a purchase on the user's behalf at the right moment, safely | Competing **conceptually**, but disabled in Phase 1. Architecture is the differentiator before execution exists. |
| Trust and audit | Show the user how decisions were made, what was uncertain, what was abstained | **Primary wedge.** No incumbent we know of publishes a meaningful per-decision audit trail to users. |
| Explainability | Make the recommendation reason intelligible to a non-technical user | **Primary wedge.** Not based on SHAP-theatre but on plain-language reason codes. |
| Honest abstention | Refuse to advise when not calibrated | **Primary wedge and probably unique in market.** Most tools optimize conversion, not decision quality. |
| Bundle decision | Decide across flight + hotel + car for a mission | **Phase 2+ ambition.** Not Phase 1. |
| Personalization | Use the user's history and preferences to refine the decision | Phase 2+ via decision-paired dataset. |
| User data flywheel | Convert user decisions and outcomes into a proprietary dataset that improves the system over time | **Long-term moat.** Phase 1 builds the data scaffolding ; the moat itself accrues with usage. |

Largo's Phase 1 game is on the right column. Marketing on the left column ("we have more inventory than Kayak") is forbidden.

---

## 3. What Largo is not competing on first

These are areas where incumbents are stronger today and where Largo will not pretend otherwise :

- **Inventory breadth.** OTAs and meta-search engines have negotiated direct integrations with hundreds of providers. Largo will start with a far smaller provider chain.
- **Brand recall.** Hopper, Kayak, Skyscanner, Booking, Expedia have years of brand investment. Largo has none.
- **Mobile app scale.** Hopper in particular `[to verify]` reports very large monthly active user counts and has invested heavily in app UX. Largo is not entering that race in Phase 1.
- **Negotiated rates.** OTAs hold negotiated discounts and credits with airlines and hotels. Largo does not.
- **Real-time provider freshness across global coverage.** Sub-second freshness across the global flight inventory is an infrastructure investment Largo will not match in Phase 1.
- **Loyalty / points integration.** Credit-card travel portals integrate native points redemption. Largo does not in Phase 1.
- **Hotel and car coverage.** Phase 1 is flights only.
- **International coverage.** Phase 1 will likely be a constrained route allowlist and English / USD only.

We say this out loud on the methodology page (per `LARGO_FRONTEND_UX_SPEC.md` Section 34). Hiding it would be worse for trust than admitting it.

---

## 4. What Largo competes on first

Phase 1 wedges :

- **Mission-based decisioning.** A mission is a budget, a date window, and a set of constraints — not a single search. Largo treats this as a first-class object across time, not a one-shot query.
- **Honest ABSTAIN.** We refuse to advise when calibration is missing, when providers disagree, when the route is out of scope. We treat this as a feature, not a failure.
- **Per-decision transparency.** Every advice has a reason code, a semantic confidence, a `valid_until`, and an audit envelope. Users can see why we said what we said.
- **Auditability.** Append-only audit by construction (per `LARGO_BACKEND_API_SPEC.md` and `LARGO_SECURITY_PAYMENTS.md`). When the public audit page is populated (Phase 2+), users will see aggregate decisions, ABSTAIN rate, calibration, and kill-switch events.
- **No dark patterns.** Equal visual weight to cancel, opt-in notifications, no fake scarcity, no urgency theatre, no hidden refund maze (per `LARGO_FRONTEND_UX_SPEC.md`).
- **Safe auto-buy architecture (before execution).** Phase 1 disables auto-buy. The architecture (15-condition stack, idempotency keyed to `audit_id`, manual capture, kill switches) is published in `LARGO_SECURITY_PAYMENTS.md` and stands as the differentiator before any execution exists.
- **User-controlled budget and constraints.** The user sets the ceiling, the floor, the abstain conditions. Largo does not optimize for conversion against the user's stated mission.

These are not promises that we are best at these today. They are the dimensions on which we will be evaluated and on which we are willing to lose if we fail.

---

## 5. Competitor inventory

| Competitor / Category | Primary user job | Strength (high level) | Weakness (high level) | Largo wedge | Evidence needed |
|---|---|---|---|---|---|
| **Hopper** | Predict prices, send alerts, sell with insurance / freezes | Consumer-facing prediction at scale, mobile-first, large user base `[to verify]` | Conversion-oriented mechanics, opaque per-decision reasoning, in-app fees on freezes / refunds `[to verify]` | Mission-based decisioning, auditability, ABSTAIN | Reproducible head-to-head on segments; published methodology |
| **Kayak** | Meta-search across OTAs, price alerts | Wide inventory aggregation, mature filters, mature alerts | Search-oriented, not decision-oriented; alerts ≠ buy/wait advice | Decision quality across mission lifecycle | Mission completion study |
| **Google Flights** | Fast, no-friction price search ; some "good time to book" hints `[to verify]` | Speed, integration with Google ecosystem, calendar view, basic price-history hints | Not a fiduciary agent ; not auto-buy ; not auditable per-decision | Per-decision audit + ABSTAIN | Calibration on overlapping route segments |
| **Skyscanner** | Meta-search, price alerts, broad regional coverage | Strong international coverage, mature alerts | Search-oriented ; limited decisioning beyond alerts | Decisioning + transparency | Trust study + audit publication |
| **Going** (formerly Scott's Cheap Flights) | Curated deal newsletter / app | Deep curation of unusual / mistake fares ; subscription-funded | Newsletter cadence, not real-time mission decisioning ; not personalized auto-buy | Mission-based, real-time, calibrated decisioning | Side-by-side on a segment of "deal" routes vs. Largo mission outcomes |
| **Expedia** | Full-service OTA — flights + hotels + cars + bundles | Massive inventory, direct booking, customer support, refund mechanics | Conversion-oriented UX, dark-pattern history `[to verify]` ; not a decision agent | Decision-oriented agent vs. transactional OTA | Trust survey ; methodology comparison |
| **Booking.com** | OTA — primarily lodging, flights via partner inventory | Massive lodging inventory, loyalty mechanics | Repeated dark-pattern findings `[to verify]` ; not a decision agent on flights specifically | Honest decisioning + no dark patterns | Independent UX audit |
| **Priceline** | OTA with opaque pricing mechanics ("Express Deals", "Name Your Own Price" historic) `[to verify]` | Discounted opaque inventory | Opaque inventory contradicts decision transparency | Transparent, reasoned, calibrated decisioning | Per-route transparency comparison |
| **Trip.com** | OTA with strong APAC presence | Inventory in APAC, multi-language | Decisioning is search-oriented, not mission-based | Mission-based decisioning | Segment comparison if APAC scope ever entered |
| **Traditional travel agents** | Human-curated trip planning | Trust through human relationship, complex itineraries | Slow, expensive, not real-time, not calibrated | Real-time, calibrated, auditable, low-cost | Mission outcome quality at lower cost |
| **Generic AI travel planners** | Conversational trip planning, often LLM-driven | Conversational UX, broad scope | Hallucination risk, no calibrated decision, no audit, no abstain | LLM forbidden in decision path ; calibration ; audit | Hallucination / accuracy study |
| **Credit-card travel portals** (Chase Travel, Amex Travel, Capital One Travel) | Book travel with points and earn rewards | Native points integration, brand trust of issuer | Not decision agents ; not calibrated ; constrained by issuer's economics | Decision-oriented agent independent of issuer economics | Side-by-side on a portal-equivalent route segment |
| **Price alert tools** (Hopper alerts, Kayak alerts, Skyscanner alerts, Google Flights alerts) | Notify when a fare changes | Easy to set, broadly available | Alerts ≠ advice ; no abstain ; no calibration | Mission decisioning + reasons + abstain | Engagement-vs-decision-quality study |
| **Flight-deal newsletters** (Going, Scott's Cheap Flights legacy `[to verify]`, Thrifty Traveler, etc.) | Surface unusual deals on a cadence | Deep curation expertise | Cadence-based ; not personalized ; not real-time | Real-time, mission-bound | Mission-fit comparison on routes covered by both |

Every "high level" descriptor in this table is held loosely. The team must validate each before any public-facing comparative copy that depends on it.

---

## 6. Hopper analysis

What Hopper is known for `[to verify]` :

- Consumer-facing price prediction with confidence indicators in their UX
- Large mobile user base
- Monetized through ancillary products (price freeze, cancellation insurance, change for any reason) — these products generate significant revenue per booking `[to verify]`
- Mobile-first, gamified UX patterns

What Largo can wedge against :

- **Reasoning transparency.** Hopper exposes a confidence indicator, but its per-decision reasoning is internal. Largo publishes reason codes and a methodology page from MVP.
- **Honest ABSTAIN.** Hopper, like most consumer tools, optimizes for engagement and conversion. Refusing to advise when uncertain is uncommon in this space.
- **Auditability.** Hopper does not (to our knowledge `[to verify]`) publish a public audit page or per-decision audit envelope.
- **Pricing model.** Hopper monetizes ancillary products on top of bookings. Largo's economics will need to be different and is a separate document (`LARGO_GO_TO_MARKET.md`, pending).

What Largo cannot wedge against in Phase 1 :

- Mobile app scale and brand recall.
- Inventory breadth.
- Ancillary product breadth (freeze, insurance) — Largo will not offer these in Phase 1.

Public claim policy : **no "better than Hopper on prediction" claim** until at least one reproducible head-to-head study on a defined segment, dataset, and time window, published per `LARGO_EVALUATION_PLAN.md`.

---

## 7. Kayak analysis

Kayak is a meta-search aggregator with mature alerts and broad filter UX.

What Largo can wedge against :

- Mission-based decisioning vs. one-shot search.
- Reasoned advice vs. pure aggregation.
- ABSTAIN where Kayak would still surface the cheapest result regardless of confidence.

What Largo cannot wedge against in Phase 1 :

- Inventory aggregation breadth.
- Mature filter UX.
- Brand recall.
- Multi-product search (hotels, cars, packages).

Kayak is an aggregator. Largo is an agent. The wedge is the role, not the search.

---

## 8. Google Flights analysis

Google Flights `[to verify]` is fast, has a strong calendar view, and surfaces some "good time to book" hints.

What Largo can wedge against :

- Per-decision audit and reasoning beyond a "good time to book" hint.
- ABSTAIN as a state vs. always offering some implicit answer.
- Mission lifecycle vs. one-shot search.

What Largo cannot wedge against in Phase 1 :

- Speed of one-shot search.
- Integration with the broader Google ecosystem.
- Calendar / date-grid UX maturity.
- Inventory breadth.

Google Flights is a search-and-hint surface. Largo is a decision agent. Marketing positioning must respect this distinction.

---

## 9. Skyscanner analysis

Skyscanner is a meta-search with strong international coverage and mature alerts.

What Largo can wedge against :

- Decisioning beyond alerts.
- Transparency.
- ABSTAIN.

What Largo cannot wedge against in Phase 1 :

- International coverage.
- Multi-currency, multi-language UX.
- Mobile app maturity.

Skyscanner's strength on international coverage is exactly where Largo will be weakest in Phase 1. Honesty on this point is mandatory.

---

## 10. Going analysis

Going (formerly Scott's Cheap Flights `[to verify]`) curates unusual / mistake fares and distributes via newsletter / app on a cadence.

What Largo can wedge against :

- Real-time mission decisioning vs. cadence-driven curation.
- Personalized to the user's mission vs. broadcast deals.
- Calibrated confidence vs. editorial curation.

What Largo cannot wedge against in Phase 1 :

- Deep human curation expertise on unusual fares.
- Subscriber loyalty.

Going's wedge is editorial. Largo's wedge is calibrated automation. Both can coexist. Public messaging must not imply that calibrated automation always beats editorial curation. On rare deal events, editorial curation can outperform calibration. That is a feature of the world, not a marketing weakness.

---

## 11. Expedia / Booking / OTAs analysis

Expedia, Booking.com, Priceline, Trip.com are full OTAs.

What Largo can wedge against :

- Decision-oriented agent vs. conversion-oriented OTA.
- No dark patterns vs. documented dark-pattern findings in OTAs `[to verify]`.
- Mission lifecycle vs. transactional booking.

What Largo cannot wedge against in Phase 1 :

- Inventory breadth.
- Bundle execution (flight + hotel + car packages).
- Customer support infrastructure.
- Refund / cancellation handling at scale.
- Loyalty programs.

OTAs are transactional. Largo is fiduciary. Public messaging must avoid implying Largo will replace the OTA layer ; it will sit on top of providers (which may include OTAs or direct supplier feeds).

---

## 12. AI travel planners analysis

Generic AI travel planners (LLM-driven conversational tools) have appeared as the foundation-model wave matures.

What Largo can wedge against :

- **No LLM in the decision path.** Per `LARGO_MODEL_STRATEGY.md`, LLM is forbidden in production decision-making. Conversational AI travel planners are by construction subject to hallucination, miscalibration, and lack of audit.
- Calibration — Largo's confidence is measured (per `LARGO_EVALUATION_PLAN.md`). LLM-only tools rarely have a calibration framework on travel decisions.
- Audit — Largo has an append-only audit envelope. LLM-only tools do not, in general.
- ABSTAIN — Largo refuses to advise when uncertain. LLM tools default to confident-sounding output.

What Largo cannot wedge against :

- Conversational UX surface area. LLM tools handle a wider conversational surface than Largo will in Phase 1.
- Generic "plan my trip" task scope. Largo Phase 1 is decision-bound, not planner-bound.

This is the category Largo most needs to **not** be confused with. Public messaging must clearly distinguish "decision agent with measured calibration and audit" from "AI travel chatbot".

---

## 13. Credit-card portals analysis

Chase Travel, Amex Travel, Capital One Travel `[to verify]` integrate points redemption with travel booking.

What Largo can wedge against :

- Independence from issuer economics. A credit-card portal optimizes for points redemption value ; Largo optimizes for the user's mission outcome.
- Decisioning across providers regardless of issuer relationships.

What Largo cannot wedge against in Phase 1 :

- Native points integration.
- Brand trust of major card issuers.
- Customer-support infrastructure of card issuers.

Credit-card portals are a co-existence relationship, not a head-on competitor. A user with high points balance will likely use the portal first and Largo second (or vice versa). Public messaging must not imply Largo is a points-redemption tool.

---

## 14. Traditional travel agents analysis

Human travel agents remain meaningful in complex itineraries (multi-city business, luxury, large groups).

What Largo can wedge against :

- Real-time, calibrated decisioning at lower cost.
- 24/7 availability.
- Audit and reproducibility.

What Largo cannot wedge against :

- Trust built through human relationship.
- Handling of complex multi-leg itineraries that benefit from human judgement (Phase 1 is one-mission flights).
- Concierge-style problem resolution when something goes wrong on the road.

Largo is not "the death of travel agents". It is an alternative for a defined slice of the decision problem. Public messaging must respect this.

---

## 15. Feature comparison

The matrix uses **known / likely / unknown / not verified** language explicitly. We are not inventing facts about competitors.

| Feature | Largo (Phase 1) | Hopper | Google Flights | Kayak | Skyscanner | Going |
|---|---|---|---|---|---|---|
| Price search | Minimal (focus is decision) | Yes (search + predict) | Yes, mature | Yes, mature | Yes, mature | Editorial / curated |
| Price alerts | Yes (mission-driven, opt-in) | Yes (likely default-on `[to verify]`) | Yes | Yes | Yes | Newsletter-based |
| Buy / wait advice | **Yes, calibrated, with semantic confidence** | Yes (single confidence indicator) `[to verify]` | Hint-level only `[to verify]` | Not core | Not core | Editorial |
| Mission monitoring | **Yes, first-class** | Likely partial (saved searches) `[to verify]` | Saved search tracker `[to verify]` | Saved searches + alerts | Saved searches + alerts | N/A |
| Explicit ABSTAIN | **Yes, first-class** | Not known to be exposed `[to verify]` | Not known to be exposed `[to verify]` | Not exposed | Not exposed | Implicit (silence on routes) |
| Reasons / explanations | **Yes, plain-language reason codes** | Limited (confidence label only) `[to verify]` | Limited / not exposed | Not exposed | Not exposed | Editorial commentary |
| Confidence semantics | **Yes, semantic only ; numeric admin-only** | Likely numeric exposed `[to verify]` | Hint-level | None | None | Editorial certainty |
| Audit trail (per-decision, customer-visible) | **Yes (admin Phase 1 ; aggregate public Phase 2+)** | Not known | Not known | Not known | Not known | Not applicable |
| Auto-buy execution | **Disabled in Phase 1** ; architecture published | Yes via Price Freeze / similar `[to verify]` | No (booking handoff) | No (handoff) | No (handoff) | No |
| Refund / cancel flow | Spec'd in `LARGO_SECURITY_PAYMENTS.md` ; Phase 2+ | Yes, monetized ancillary products `[to verify]` | Handoff to airline / OTA | Handoff | Handoff | Handoff |
| Bundle decision (flight + hotel + car) | **Phase 2+** | Limited `[to verify]` | Limited (separate products) | Yes (search-level) | Yes (search-level) | No |
| Public methodology | **Yes from MVP** | Not published `[to verify]` | Not published | Not published | Not published | Editorial transparency |
| User-controlled budget / constraints | **Yes, mission-bound** | Limited (price drop watch) | Limited (filters) | Filters | Filters | N/A |

A blank or "not known" cell is honest. We will not fill it with assumption.

---

## 16. Trust comparison

Trust is built through behaviour over time. Phase 1 deliverables that build trust :

- Methodology page from MVP (per `LARGO_FRONTEND_UX_SPEC.md` Section 34).
- Honest ABSTAIN rather than hidden uncertainty.
- Equal-weight cancel, no dark patterns.
- Plain-language reason codes.
- Numeric confidence kept internal.
- Append-only audit (visible to admin Phase 1, aggregate public Phase 2+).

Phase 1 deliverables that do **not yet** earn trust at scale :

- Track record of decision quality vs. incumbents (we have no public history yet).
- Brand recall.
- Word-of-mouth and reviews.

Trust comparison is therefore a Phase 2+ measurement (cohort surveys, review parity). Phase 1 commits to the discipline ; the comparison comes later.

---

## 17. Prediction comparison

This is the most marketing-tempting category and the one where we are strictest.

What we will **not** claim before evidence :

- "Largo predicts prices better than Hopper / Google Flights / Kayak / Skyscanner / Going / Expedia."
- "Largo is more accurate at price prediction."
- "Largo saves more money than competitor X."
- "Largo's model beats benchmark Y" — unless benchmark Y is published, dataset and protocol are reproducible, and the comparison is segment-bound.

What we may claim after evidence :

- "On segment S, time window T, dataset D, evaluated under protocol P (per `LARGO_EVALUATION_PLAN.md`), Largo achieved metric M. The result is reproducible by protocol P."

The evaluation plan is the contract. The benchmark document is the publication.

---

## 18. Mission-based decision comparison

This is Largo's strongest wedge concept.

A mission is not a search. A mission has :

- A budget ceiling (or a confidence-tied threshold).
- A date window.
- A constraint set (cabin, stops, airlines acceptable, refundability).
- A decision lifecycle (track → recommend → confirm → execute → outcome).

Existing competitors :

- **OTAs** treat each booking as a transaction.
- **Meta-search** treats each query as a one-shot.
- **Price alerts** notify on a price condition but do not advise.
- **AI travel planners** plan a trip but do not commit to a calibrated decision lifecycle.

The mission concept is conceptually distinctive. We will measure it via mission completion rate, regret distribution per mission, ABSTAIN rate per mission, and user-reported satisfaction with the mission outcome (per `LARGO_EVALUATION_PLAN.md`).

---

## 19. Auto-buy comparison

Auto-buy is **disabled in Phase 1** for Largo. The differentiator in Phase 1 is therefore the **architecture**, not the execution :

- 15-condition stack (per `LARGO_SECURITY_PAYMENTS.md`).
- Stripe manual capture with idempotency keyed to `audit_id`.
- 60-second confirmation window with anti-dark-pattern UX (per `LARGO_FRONTEND_UX_SPEC.md` Section 30).
- Kill switches.
- Append-only audit before payment intent creation.
- Phase rollout 0 → 10 → 100 → 1000 → GA.

Hopper-style price-freeze / hold features `[to verify]` and OTA "book on your behalf" features exist in market. Largo's wedge in Phase 2+ is **not** that we will be the first to auto-buy ; it is that we will be the safest, most auditable, and most refusable.

Public messaging in Phase 1 must say "Auto-buy is not available yet" honestly (per `LARGO_FRONTEND_UX_SPEC.md` Section 31). No "coming soon" countdown. No fake waitlist scarcity.

---

## 20. Auditability comparison

To our knowledge `[to verify]`, no major competitor publishes a customer-facing per-decision audit envelope or an aggregate public audit page that exposes ABSTAIN rate, calibration, and kill-switch events.

Largo's plan :

- Phase 1 : append-only audit at backend, surfaced to admin only.
- Phase 2+ : aggregate public audit page with ABSTAIN rate, calibration over time, kill-switch events, decision flips — anonymized, k-anonymity ≥ 5 floor (per `LARGO_DATA_STRATEGY.md`).

This is a structural moat that compounds with usage. Marketing it is allowed only when the page is populated with real data. Until then, the methodology page substitutes (per `LARGO_FRONTEND_UX_SPEC.md` Section 34).

---

## 21. Explainability comparison

Most competitors :

- Show a price.
- Show a "good / bad time to book" hint or a confidence bar.
- Do not surface per-decision reasons in plain language.

Largo :

- Surfaces a recommendation badge.
- Surfaces a semantic confidence label.
- Surfaces a plain-language reason from the reason-code catalog.
- Surfaces a "Why?" panel without SHAP-theatre, without model versions, without raw quantiles.

This is achievable in Phase 1 because the rule layer is interpretable by construction (per `LARGO_MODEL_STRATEGY.md`). The wedge is real and immediate.

Public messaging must not imply this is "AI explainability" in a hyped sense. It is plain-language reasons over a semi-trusted ML output.

---

## 22. ABSTAIN / uncertainty comparison

ABSTAIN is, to our knowledge `[to verify]`, not exposed as a first-class state by any direct competitor in this market. Most tools give a "best fare" or a "good time to book" answer regardless of underlying calibration.

Largo's stance :

- ABSTAIN is a 200 response (per `LARGO_BACKEND_API_SPEC.md` Section 30).
- ABSTAIN renders as a normal AdviceCard (per `LARGO_FRONTEND_UX_SPEC.md` Section 15).
- ABSTAIN is surveilled for honest-vs-lazy (per `LARGO_MODEL_STRATEGY.md`).
- ABSTAIN reasons are part of the public methodology page.

This is a feature that is hard to copy because it costs conversion. Competitors that depend on conversion-driven monetization face a structural disincentive to expose ABSTAIN. That gives Largo a durable moat **if** Largo's economics permit foregoing conversion in uncertain segments.

---

## 23. Bundle decision comparison

Phase 1 = flights only. Bundle decisions are Phase 2+.

OTAs and meta-search engines already package flight + hotel + car. Largo will not enter this race in Phase 1. When Largo enters Phase 2+, the wedge will be the decision quality across the bundle (e.g. "should I book the flight now and the hotel later?") rather than the search aggregation.

Public messaging in Phase 1 must not imply bundle support exists.

---

## 24. Data moat comparison

OTAs and large meta-search engines have far more raw inventory data than Largo will in Phase 1. They do not necessarily have :

- Decision-paired data : intent + advice + provider disagreement + outcome + regret.
- User feedback explicitly tied to a per-decision audit envelope.
- Honest ABSTAIN labels paired with later outcome.

Largo's data moat is **decision-paired** (per `LARGO_DATA_STRATEGY.md`). It accrues with usage and cannot be bought.

In Phase 1 the moat does not yet exist meaningfully. Public claims of "data moat" are forbidden until at least one published cohort has produced a decision-paired dataset of meaningful size, validated for quality per `LARGO_DATA_STRATEGY.md` Section quality gates.

---

## 25. UX comparison

UX is a category where Largo's wedge is not "prettier" but "more honest" :

- Equal-weight cancel.
- No fake scarcity.
- No urgency theatre.
- No dark dismissal copy.
- Opt-in notifications.
- Plain-language reasons.
- Accessibility floor at WCAG 2.2 AA.

Hopper, OTAs, and credit-card portals `[to verify]` historically optimize UX for conversion. Largo's wedge here is sustainable as long as Largo's economics permit foregoing conversion mechanics. This is a positioning choice, not an aesthetic one.

Public messaging may say "no dark patterns" only when this is actually enforced and observable in the implementation.

---

## 26. Safety comparison

Auto-buy and payment safety is governed by `LARGO_SECURITY_PAYMENTS.md`.

Public safety claims allowed (when implementation is verified) :

- "Largo never auto-buys without your explicit confirmation."
- "Largo separates the search you do from the decision we publish from the action we take."
- "Largo treats every advice as audited."

Public safety claims **forbidden** :

- "Largo is more secure than Hopper / OTA / X" without an independent security audit.
- "Largo is PCI-compliant" without the corresponding SAQ-A attestation or higher.
- "Largo guarantees no fraud." (No platform can guarantee this.)
- "Largo will never charge you the wrong amount." (Implementation will work toward this, but a public guarantee is a liability claim.)

---

## 27. Pricing / business model comparison

This document does not decide pricing. That is the scope of `LARGO_GO_TO_MARKET.md`.

What it commits to :

- The pricing model must not depend on dark-pattern conversion to be viable.
- The pricing model must not be hidden from the methodology page.
- The pricing model must not penalize ABSTAIN (e.g. a per-booking fee that only triggers on BUY_NOW would create perverse incentive to over-recommend BUY_NOW). Any per-action fee structure must include a refusal-mechanism that does not bias the decision.

Competitors monetize through ancillary products (Hopper) `[to verify]`, commissions on bookings (OTAs), subscription (Going), and ad revenue / GDS economics (meta-search). Largo's choice will be made in `LARGO_GO_TO_MARKET.md` and will be subject to this section's no-perverse-incentive constraint.

---

## 28. Where incumbents are stronger today

| Category | Stronger incumbent (illustrative) | Phase 1 Largo posture |
|---|---|---|
| Inventory breadth | OTAs (Expedia, Booking, Trip.com, Priceline) | Acknowledge openly ; constrain Phase 1 to a small provider chain |
| One-shot price search speed | Google Flights, Kayak | Acknowledge ; not a Phase 1 wedge |
| International coverage | Skyscanner, Trip.com | Acknowledge ; Phase 1 English / USD only |
| Brand recall | All listed competitors | Acknowledge ; trust is earned through behaviour over time |
| Mobile app maturity | Hopper, OTAs | Acknowledge ; Phase 1 web-first |
| Loyalty / points | Credit-card portals | Acknowledge ; out of Phase 1 scope |
| Editorial deal curation | Going, Thrifty Traveler | Acknowledge ; Largo is real-time + calibrated, complement not replacement |
| Customer support at scale | OTAs | Acknowledge ; Phase 1 small cohort makes this manageable |
| Real-time provider freshness across global inventory | Meta-search engines | Acknowledge ; Phase 1 limited |

The methodology page (per `LARGO_FRONTEND_UX_SPEC.md` Section 34) is required to acknowledge these honestly. Hiding any of these is a forbidden positioning pattern.

---

## 29. Where Largo can win first

| Wedge | Why we can win this first |
|---|---|
| **Honest ABSTAIN** | Conversion-driven competitors face structural disincentive to expose ABSTAIN. Largo treats it as the product. |
| **Mission timeline** | Existing tools treat each search as a one-shot. Largo treats decisions across time as the unit. |
| **Transparent reasons** | Reason-code-driven plain-language explanations are immediately deliverable in Phase 1. |
| **Trust / methodology page** | Buildable from MVP, requires no scale. |
| **No dark patterns** | A positioning choice, enforceable from day 1. |
| **Safe auto-buy architecture** | The architecture is publishable in Phase 1 even before execution exists. |
| **Auditability (admin Phase 1, aggregate public Phase 2+)** | Append-only by construction ; visible auditing is a structural moat. |
| **User-controlled budget constraints** | Mission-bound from day 1. |

These are wedges where Largo can be **best in class** at Phase 1 cohort scale (0 → 10 → 100). They do not require beating incumbents on prediction accuracy globally.

---

## 30. Where Largo can win later

Phase 2+ wedges, conditional on data, evidence, and execution :

- **Calibrated price prediction on segments where Largo has accumulated decision-paired data.** Not a global claim ever ; segment-bound, dataset-bound, protocol-bound.
- **Per-decision auditability surfaced publicly.** Once the public audit page is populated.
- **Mission completion outcomes** (the user got what they wanted within budget within the date window).
- **Bundle decisioning** (Phase 2+).
- **Personalization** based on the user's prior missions and outcomes.
- **Lower-regret auto-buy** vs. price-freeze / similar incumbent ancillary products `[to verify]`. Measured by regret per dollar charged.
- **Refund / dispute handling that is explicitly fair and pre-disclosed**, not buried in support flows.
- **Transparent monetization** that does not bias toward BUY_NOW.

Each of these requires evidence per `LARGO_EVALUATION_PLAN.md` before any public claim.

---

## 31. Where Largo must not claim superiority yet

| Category | Why not yet |
|---|---|
| Global flight price prediction accuracy | Largo has no published global benchmark ; competitors' internal benchmarks (where they exist `[to verify]`) are not directly comparable |
| Inventory breadth | Phase 1 provider chain is small |
| Airline / OTA partnerships | None in Phase 1 |
| Mobile app scale | Phase 1 web-first ; no mobile app maturity |
| Negotiated rates | None in Phase 1 |
| Real-time provider freshness | Bounded by provider chain budget |
| International coverage | English / USD Phase 1 |
| Brand trust | No track record ; comes with usage and time |
| Customer-support infrastructure | Small cohort, small support footprint |
| Loyalty / points | Out of scope Phase 1 |
| Bundle decisioning | Phase 2+ |
| LLM-driven conversational planning | Forbidden in production decision path ; Largo is not a conversational planner |

Public claims in any of these categories require explicit Phase advancement and explicit evidence.

---

## 32. Benchmark metrics

The metrics Largo will track and, when ready, publish under the `LARGO_EVALUATION_PLAN.md` protocol :

| Metric | Definition | Phase 1 internal target | Public publication ready when |
|---|---|---|---|
| Regret | Difference between paid (or recommended) price and best-available price within mission window | V7a anchor : $58.33 mean abs regret on 11,750 trips | Phase 2+, after a published cohort with reproducible protocol |
| Calibration ECE | Expected calibration error on confidence | < 0.07 Phase 1 ; < 0.05 Phase 2 (per `LARGO_MODEL_STRATEGY.md`) | When measured on a published dataset |
| ABSTAIN correctness | Rate of ABSTAINs that correspond to true uncertainty (vs. lazy abstain) | Surveilled internally | When defined and published |
| User trust (survey-based) | Cohort survey on perceived trustworthiness | n/a Phase 1 (no cohort yet) | Phase 2+ |
| Mission completion | Rate of missions where user achieved their stated mission within budget within date window | Tracked from Phase 1 | When cohort size ≥ a defined floor with k-anonymity ≥ 5 |
| Dispute rate | Rate of bookings that result in disputes | n/a Phase 1 (no bookings) | Phase 2+ |
| Refund rate | Rate of bookings that result in refunds | n/a Phase 1 | Phase 2+ |
| Provider reliability | Provider uptime, disagreement rate, SLA conformance | Tracked from Phase 1 | When normalized across competitors via mystery-shopping protocol |
| Time-to-decision | Latency from search to advice | Tracked from Phase 1 (per `LARGO_BACKEND_API_SPEC.md` budgets) | Internal until normalized |
| Notification usefulness | Survey-based + opt-out rate | n/a Phase 1 | Phase 2+ |
| Explanation usefulness | Survey-based + helpful/not-helpful in-UI feedback | Tracked from Phase 1 | Phase 2+ |
| Bundle savings (Phase 2+) | Realized saving on bundle vs. independent booking | n/a Phase 1 | Phase 2+ |

Internal metrics inform engineering. Public metrics survive only after they are reproducible.

---

## 33. Public claims policy

| Claim | Allowed now? | Evidence required | Source document dependency | Risk if premature |
|---|---|---|---|---|
| "Largo is a travel decision agent." | Yes | Implementation matches the spec | `LARGO_PRODUCT_VISION.md` | Low |
| "Largo refuses to advise when uncertain." | Yes (when implementation enforces ABSTAIN) | ABSTAIN reason codes implemented | `LARGO_FRONTEND_UX_SPEC.md` § 15 | Low |
| "Largo publishes its methodology." | Yes (when methodology page is live) | Page exists with required sections | `LARGO_FRONTEND_UX_SPEC.md` § 34 | Low |
| "Largo has no dark patterns." | Yes (when verified by independent UX audit) | UX audit document | `LARGO_FRONTEND_UX_SPEC.md` § 41 | Medium if unverified |
| "Largo predicts better than Hopper / Kayak / X." | **No** | Reproducible head-to-head on segment + dataset + protocol | `LARGO_EVALUATION_PLAN.md` | High (legal + reputational) |
| "Largo is the cheapest." | **No** | Verified against defined providers and dates | n/a (would require permanent verification) | High (legal) |
| "Guaranteed savings." | **Never** | Cannot be guaranteed | n/a | High (legal) |
| "Best price." | **No** without methodology | Methodology disclosed | `LARGO_EVALUATION_PLAN.md` | High |
| "AI-powered" | Allowed only as honest descriptor (not as superiority proof) | Implementation uses ML in supervised role | `LARGO_MODEL_STRATEGY.md` | Medium (over-claiming) |
| "Calibrated confidence." | Yes (when ECE measured and at target) | Published ECE per route segment | `LARGO_MODEL_STRATEGY.md`, `LARGO_EVALUATION_PLAN.md` | Medium |
| "Auditable." | Conditional (admin Phase 1, public Phase 2+ when populated) | Audit envelope exists ; public page populated | `LARGO_BACKEND_API_SPEC.md`, `LARGO_DATA_STRATEGY.md` | Medium |
| "Mission-based." | Yes (when mission concept implemented) | Implementation matches spec | `LARGO_PRODUCT_VISION.md` | Low |
| "Auto-buy on your behalf." | **No, in Phase 1** | Phase 3 gates passed ; cohort-validated | `LARGO_SECURITY_PAYMENTS.md` | High |
| "We saved you $X." | Conditional | Verified counterfactual on the specific decision | `LARGO_EVALUATION_PLAN.md` | High (legal + trust) |
| "Better than human travel agents." | **No** | Cohort-controlled study | n/a | High |
| "More transparent than competitor X." | Conditional | Side-by-side documented evidence | `LARGO_FRONTEND_UX_SPEC.md` | Medium (legal review) |
| "First travel fiduciary agent." | Conditional | Trademark / category-creation evidence ; legal review | n/a | Medium |

A claim not in this table is not approved. The default is "no claim".

---

## 34. Evidence required before claims

For any public comparative claim to be approved, the following must exist :

1. **Segment definition.** Which routes, which time horizon, which user type, which provider scope.
2. **Dataset citation.** Which evaluation snapshot ID, per `LARGO_EVALUATION_PLAN.md`.
3. **Protocol citation.** Which evaluation protocol version was used.
4. **Reproducibility statement.** A third party could in principle re-run the protocol on the dataset and reach the same result within tolerance.
5. **Date.** Claims decay. The result is anchored to its evaluation date.
6. **Caveat.** What the claim does **not** say.
7. **Methodology link.** From the marketing surface to the methodology page.
8. **Legal review.** For claims that name a competitor.

A claim missing any of these is treated as marketing fiction and is forbidden.

---

## 35. Head-to-head test design

When (Phase 2+) a head-to-head against an incumbent is run, the protocol :

- Define a frozen route segment and time window.
- Define a frozen mission set (intents, budgets, date windows).
- Run Largo and the incumbent in parallel on the same missions.
- Capture each tool's recommendation at defined timestamps.
- Capture the actual price evolution and the realized outcome of each mission.
- Compute regret per mission per tool.
- Compute calibration of confidence per tool (where applicable).
- Compute ABSTAIN rate and ABSTAIN-correctness per tool (where ABSTAIN is exposed).
- Document tooling, timestamps, queries, raw responses, and any access constraints (rate limits, API access, web scraping ethics).
- Anonymize user data (k-anonymity ≥ 5 if real users are involved).
- Publish the protocol **before** the result, so reproducibility is verifiable.

The protocol is a `LARGO_EVALUATION_PLAN.md` extension. This document does not finalize the protocol ; it pins the requirements.

---

## 36. User study design

When (Phase 2+) a user study is run :

- Recruit through transparent mechanisms ; no incentives that bias the response.
- Measure : perceived trust, comprehension of the recommendation, comprehension of ABSTAIN, perceived urgency manipulation (looking for absence), comprehension of confidence label.
- Compare across tools when feasible, with informed consent.
- Anonymize aggregate results.
- Publish the protocol before the result.
- Submit to independent ethics review when the cohort is meaningful in size.

User study results are admissible as public evidence only when the protocol is published.

---

## 37. Mystery shopping / manual competitor audit plan

To validate `[to verify]` claims about competitors, a periodic manual audit :

- Cadence : quarterly (Phase 2+) or upon competitor product change.
- Scope : sampled set of routes / dates / user types ; fixed device classes.
- Captured artifacts : screenshots, screen recordings, API responses where available, terms of service.
- Documented findings : feature presence / absence, dark-pattern observations, refund-flow path length, ABSTAIN exposure (likely none observed), audit-page presence.
- Outcomes : update the `[to verify]` markers in this document, replace with citations.
- Ethics : respect competitor terms of service ; no automated scraping that violates ToS.
- Storage : artifacts archived with timestamps, accessible to admin only ; subject to anonymization policy.

This audit is the source of truth for the comparative claims this document allows.

---

## 38. SEO / messaging risks

Marketing creates pressure to over-claim. Risks tracked :

- **Over-indexed on "AI travel agent" search intent.** Brings traffic but invites confusion with LLM chatbots. Mitigation : positioning copy distinguishes "decision agent with audit" from "AI chatbot".
- **"Vs. Hopper" / "vs. Kayak" comparison pages.** Tempting for SEO. Allowed only when claims policy is satisfied. The default is no comparison page until evidence exists.
- **Affiliate / referral monetization SEO.** Acceptable only if disclosed and not biasing decisions.
- **Press claims.** Press releases that include a comparative claim require the same evidence threshold as public marketing.
- **Influencer / partner content.** Held to the same standard ; misrepresentation by a partner is treated as a Largo misrepresentation.

Marketing review is mandatory for any external surface that names a competitor.

---

## 39. Competitive positioning statements allowed

These positioning statements may be used in Phase 1 (subject to legal review where they name a competitor) :

- "Largo is a travel decision agent. We tell you when to buy, when to wait, and when we don't know."
- "Largo refuses to advise when our signal is uncertain. We treat that as a feature."
- "Largo publishes how it makes decisions. You can read the methodology before you trust us."
- "Largo treats your mission as a unit, not a search."
- "Largo is mission-bound. Set your budget and your dates ; we work within them."
- "Largo's confidence is calibrated. We do not perform certainty we do not have."
- "Largo does not auto-buy in Phase 1. When we do, we will tell you exactly how."
- "Largo records every decision we make for you, so we can be accountable to you."

Each of these maps to an implementation surface that must be live before the statement is used.

---

## 40. Competitive positioning statements forbidden

| Statement | Why forbidden |
|---|---|
| "Better than Hopper" (without published evidence) | Claims policy violation |
| "Smarter than Kayak" | Vague + claims policy violation |
| "Cheapest fares anywhere" | Cannot be guaranteed |
| "Beats Google Flights" | Claims policy violation |
| "Powered by AI" used as superiority proof | Misleading positioning |
| "Guaranteed savings" | Liability claim |
| "Largo finds you the best deal" (without methodology) | Vague superlative |
| "Replace your travel agent" | Overreach in Phase 1 |
| "Auto-buys for you" (in Phase 1) | False — disabled in Phase 1 |
| "Public audit page proves we are honest" (before page is populated) | False — Phase 2+ surface |
| "Trusted by thousands" (before cohort exists) | Fabricated |
| "Our model has X% accuracy" (without dataset, protocol, reproducibility) | Claims policy violation |
| "We saved you $X this year" (without verified counterfactual) | Misleading |
| "First in [category]" (without trademark / legal evidence) | Risk |
| "No fees ever" (when monetization is undefined) | Premature commitment |
| "We never recommend a bad fare" | Cannot be guaranteed |
| "Hopper-style price freeze, but better" | Misleading without product parity |
| "Most transparent travel tool" | Vague superlative |
| "Powered by GPT" / "Powered by Claude" (as decision proof) | LLM forbidden in decision path |

---

## 41. Phase 1 / Phase 2 / Phase 3 benchmark gates

| Gate | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|
| Methodology page live | **Yes** | Yes | Yes |
| Per-decision audit envelope (admin) | **Yes** | Yes | Yes |
| Public audit page (aggregate) | Disabled (no events yet) | Active | Active |
| Comparative public claim allowed | **No** | Conditional on evidence | Conditional on evidence |
| Head-to-head benchmark published | **No** | Yes (when protocol passed) | Yes |
| User study published | **No** | Yes (when protocol passed) | Yes |
| Mystery shopping cadence | Manual ad-hoc | Quarterly | Quarterly |
| "Better than X" claim | **Forbidden** | Conditional on evidence | Conditional on evidence |
| Auto-buy public claim | **Forbidden** | Conditional on Phase 2+ activation | Active |
| Cohort size | 0 → 10 | 10 → 100 | 100 → 1000 → GA |
| Calibration target ECE | < 0.07 | < 0.05 | < 0.05 |

Benchmark phase advancement requires the corresponding gates in `LARGO_EVALUATION_PLAN.md`, `LARGO_MODEL_STRATEGY.md`, `LARGO_DATA_STRATEGY.md`, `LARGO_FRONTEND_UX_SPEC.md`, `LARGO_BACKEND_API_SPEC.md` to all be satisfied. No unilateral benchmark phase bump.

---

## 42. Open questions before implementation

Tracked, not blockers for B0.

1. Mystery-shopping ethics : which competitor TOS allow which forms of measurement, and which require partnership.
2. Legal review process for any external surface that names a competitor.
3. Trademark consideration for the term "Travel Fiduciary Agent".
4. Independent UX audit provider for the "no dark patterns" claim.
5. User-study recruitment mechanism that does not bias self-selection.
6. Public audit page schema and aggregation cadence (Phase 2+).
7. Decision-paired dataset volume threshold before any "data moat" claim is allowed.
8. Cohort size and k-anonymity application in any public statistic.
9. Comparative landing-page strategy : default no, opt-in when evidence exists.
10. Affiliate / referral disclosure standard.
11. Press kit content : what is allowed by default, what requires legal review.
12. Influencer / partner content compliance review.
13. Methodology page versioning and change-log policy.
14. Translation / i18n strategy for methodology page (Phase 2+).
15. Competitor product change monitoring : who watches, on what cadence.
16. "First in category" claim : whether and how to assert this at all.
17. Acceptance criteria for Phase 1 → Phase 2 benchmark gate : what evidence triggers it.
18. Definition of an evaluation snapshot publishable to the outside world (privacy, IP, reproducibility).
19. Whether to participate in industry-wide benchmarks (when they exist).
20. Treatment of community-generated comparisons (Reddit, forums) : do not seed, do not astroturf, respond honestly when asked.

---

## 43. Document status

| Property | Value |
|---|---|
| Document | `LARGO_COMPETITIVE_BENCHMARK.md` |
| Phase | B0 documentary |
| Status | Frozen for B0, amendable via B0 review |
| Version | 0.1.0 |
| Date | 2026-04-27 |
| Implementation | None. No public claim, no comparative landing page, no benchmark publication from this document. |
| V7a impact | None. V7a remains active baseline, untouched. |
| Cross-doc consistency | Pinned to claims policy (`LARGO_EVALUATION_PLAN.md`), data moat policy (`LARGO_DATA_STRATEGY.md`), model claims policy (`LARGO_MODEL_STRATEGY.md`), trust UX (`LARGO_FRONTEND_UX_SPEC.md`), safety (`LARGO_SECURITY_PAYMENTS.md`), backend (`LARGO_BACKEND_API_SPEC.md`). |
| `[to verify]` markers | Multiple. To be replaced with primary-source citations during the manual competitor audit (Section 37). |
| Next B0 | `LARGO_GO_TO_MARKET.md` |

This document is a contract on how Largo positions itself against the field. The implementation of any external surface must justify any deviation through a B0 amendment.
