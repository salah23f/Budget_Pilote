# LARGO_GO_TO_MARKET

**Document type :** B0 documentary specification
**Status :** Draft, frozen for B0
**Version :** 0.1.0
**Last updated :** 2026-04-27
**Scope :** Future go-to-market strategy for Largo. Not implemented. No public surface, no waitlist, no campaign shipped from this document.

This is the **eleventh and final** B0 document. It pulls together the discipline of the previous ten and translates it into a launch posture : how Largo is introduced to the world, to whom, on what evidence, in which order, and on what gates.

It is intentionally written **before** any landing page, before any waitlist, before any beta invitation, before any paid acquisition spend.

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
- `LARGO_COMPETITIVE_BENCHMARK.md`

Anchors preserved across all docs :

- `LargoAdvice` contract version `0.1.0`
- Phase 1 = flights only
- Phase 1 = no silent auto-buy
- Phase 1 = no live auto-buy execution before gates
- ABSTAIN is a first-class product state
- Numeric confidence is internal/admin only
- No claim "better than X" without segment + metric + reproducible evidence
- Methodology page from MVP ; public audit page only when real events exist
- No fake scarcity, no dark patterns, no urgency theatre

---

## 0. Document scope

This document does **not** :

- Build a landing page
- Open a waitlist
- Run a campaign
- Send any user-facing email
- Decide a marketing budget
- Touch app code or any non-doc file

This document **does** :

- Pin the launch thesis and the positioning
- Pin the ICP and anti-ICP
- Pin the cohort rollout (0 → 10 → 100 → 1000 → GA) with entry / exit criteria
- Pin which acquisition channels are allowed at which phase
- Pin the public claims policy as a function of evidence
- Pin the launch gates that link B0 to B1
- Pin the forbidden GTM patterns

The implementation of any go-to-market surface must justify any deviation through a B0 amendment.

---

## 1. GTM philosophy

Five principles. Non-negotiable.

1. **Trust before traffic.** The methodology page exists before paid acquisition begins. The audit posture exists before a public press claim. Largo earns the right to ask for users by being honest about what it does and does not do.
2. **Cohort discipline over launch theatre.** The cohort gates (0 → 10 → 100 → 1000 → GA) are real. No single "big launch" gambles the brand. Each phase exits when measured criteria are met, not when a calendar says so.
3. **Honesty as positioning.** Largo's wedge is calibrated decision quality, transparency, and honest abstention. Marketing copy reflects this or is rewritten until it does. Any tension between conversion-oriented copy and decision-oriented honesty resolves toward honesty.
4. **No claim ahead of evidence.** Every external claim has a source document and a reproducible measurement, or it is not made. The default is silence on a metric we cannot prove.
5. **Founder-led for as long as possible.** Until Phase 2, communication is signed by a human founder, in plain language, with traceable accountability. No corporate-voice ambiguity.

A GTM motion that contradicts these principles is rolled back, even if it costs growth.

---

## 2. Launch thesis

The thesis Largo bets on at launch :

> The travel-decision market is saturated with **search engines** (Google Flights, Kayak, Skyscanner), **deal aggregators** (Hopper, Going), and **OTAs** (Expedia, Booking, Priceline). It is **under-served on decisioning** : the user still has to decide alone whether the fare in front of them is good, whether to wait, what their mission really is. Largo enters not as another search engine but as a **travel decision agent** : honest, calibrated, mission-bound, auditable, refusable.

Implications :

- Largo is a category, not a feature. Marketing must establish the category before competing on it.
- "Travel Fiduciary Agent" is the working category label (subject to legal / trademark review per `LARGO_COMPETITIVE_BENCHMARK.md` § 42).
- The fight for SEO terms like "cheapest flight" is **not** the fight Largo enters first. The fight for terms like "should I buy now or wait" is closer to the wedge, but still secondary to category-creation copy.
- Conversion-oriented patterns (urgency timers, fake scarcity, hidden cancel, BUY_NOW-by-default) are out of bounds even when they would help short-term metrics, because they would invalidate the category we are creating.

---

## 3. What Largo is selling first

Phase 1 sells :

- **A calibrated decision** on whether to buy now, wait, or abstain on a flight, given a mission.
- **A transparent reason** in plain language.
- **A semantic confidence** that does not pretend.
- **A mission lifecycle** the user can see across time.
- **An audit posture** (admin Phase 1, aggregate public Phase 2+).
- **A safety posture** (auto-buy disabled until earned ; safe architecture published).
- **A refusal mechanism** (ABSTAIN) that earns trust.

Largo does not sell, in Phase 1 :

- A booking experience (handoff to provider remains).
- A bundle (flights only).
- A loyalty / points integration.
- An "AI travel agent" conversational experience.
- Auto-buy execution.
- Hotel or car decisions.
- International coverage at parity with global meta-search.
- A guarantee of any kind (no "guaranteed cheapest", no "guaranteed savings").

The pricing model (Section 30) reflects this scope.

---

## 4. What Largo is not selling first

These are positioning rejections, stated explicitly so they cannot drift back into copy :

- **"Cheapest flight ever"** — a claim Largo cannot guarantee and will not make.
- **"Better than Hopper"** — a comparative claim Largo will not make without `LARGO_COMPETITIVE_BENCHMARK.md` evidence.
- **"AI travel agent"** — a category Largo deliberately does not occupy ; it invites confusion with LLM-driven planners (per `LARGO_COMPETITIVE_BENCHMARK.md` § 12).
- **"Find me anything"** — Largo is bounded to flights and missions in Phase 1.
- **"Auto-buy is here"** — disabled in Phase 1 ; honesty about this is the posture.
- **"Trusted by thousands"** — fabricated trust is forbidden ; trust is earned with cohort time.
- **"Powered by GPT / Claude"** — LLM is forbidden in the decision path (per `LARGO_MODEL_STRATEGY.md`).

---

## 5. Ideal customer profiles

The Phase 1 ICP is narrow on purpose. Phase 1 is not for everyone.

| ICP segment | Pain | Willingness to trust new tool | Acquisition channel | Largo fit |
|---|---|---|---|---|
| Flexible leisure travelers | Want a fair fare, willing to wait, hate dark-pattern booking sites | High (frustrated by status quo) | Travel forums, founder-led content, word of mouth | **Strong** — mission decisioning fits flexible windows |
| Budget-conscious students | Tight budget, willing to abstain, willing to wait | High (price-sensitive, low brand-loyalty) | Campus channels, Reddit / Discord travel communities | **Strong** — abstain + transparent reasons resonate |
| Long-haul planners (booking ≥ 60 days out) | Long uncertainty window, want to know when to commit | High (currently using spreadsheets and alerts) | Travel-planning forums, blog content | **Strong** — mission timeline fits long horizon |
| Families planning expensive trips | High stakes, want trust, willing to wait | Medium-high | Founder-led content, family travel communities | **Medium-strong** — Phase 1 single-mission limit applies |
| Remote workers / digital nomads | Repeated travel, want to track multiple routes | High | Nomad communities, Substack, podcasts | **Strong** — multi-mission fits Phase 2+ |
| Frequent but non-expert travelers | Travel often but don't want to become experts | High | General-audience content | **Strong** — Largo's job is to remove the expert burden |
| Travel hackers | Already use multiple tools, evaluate methodology | Medium (skeptical, demanding) | Travel-hacking communities, methodology page | **Medium** — Largo is a complement, not a replacement |
| Business travelers | Constrained windows, employer policy | Low for personal Largo Phase 1 | n/a Phase 1 | **Out of Phase 1 scope** |
| Last-minute bookers | No time window, no flexibility | Low | n/a | **Anti-ICP** in Phase 1 |

Primary wedge users for Phase 1 cohort : the first three (flexible leisure, budget-conscious students, long-haul planners). All have flexible windows, are price-sensitive, and tolerate ABSTAIN. They are the segments most likely to validate the wedge before broader rollout.

---

## 6. Primary wedge users

Within the ICP, the **primary wedge user** is the one whose mission profile best validates Largo's wedge :

- Has **at least 30 days** between today and the mission's earliest departure.
- Is **flexible on dates** within a window of at least a week.
- Has a **clear budget ceiling** they can articulate.
- Is willing to **wait or abstain** if Largo says so.
- Is **price-sensitive** but not obsessively cheapest-driven.
- Wants to **understand why** a recommendation was made.
- Wants to **see a methodology** before trusting.

This is the user the Phase 1 cohort recruits. The acquisition channels and the messaging pillars are tuned for them.

---

## 7. Early adopter segments

Within the wedge, the earliest cohort is recruited from segments where founder-led acquisition can reach 10–100 trusted users without paid spend :

- Personal network of the founder and team.
- Travel-hacking subreddits and Discord servers (with respect for community rules ; no spam).
- Substack and newsletter communities of travel writers who value methodology.
- Slow-travel and digital-nomad communities.
- Campus organizations (where geography permits).
- Small product-hunt / Indie Hackers community drops, framed as honest beta requests rather than launches.

The early cohort is recruited slowly, transparently, and with a published methodology link. No paid acquisition until retention signal is observed (Section 22).

---

## 8. Anti-ICP

Users Largo does **not** target in Phase 1. Misaligning with these users would damage their experience and Largo's brand.

| Anti-ICP segment | Why not in Phase 1 |
|---|---|
| People who always buy immediately | Largo's value is in the wait / abstain decision ; immediate buyers don't benefit from the wedge |
| Luxury travelers indifferent to price | The cost-vs-decision-quality tradeoff is not Largo's wedge ; concierge models serve them better |
| People needing instant booking | Phase 1 has no execution layer ; Largo hands off to provider |
| Users who dislike automation | Largo's value is automation of decisioning ; manual users should keep their existing workflow |
| Users expecting guaranteed cheapest price | Largo refuses to guarantee what it cannot ; setting up these users for disappointment is anti-trust |
| High-risk payment users (chargeback-prone, fraud-suspect) | Phase 1 disables payments anyway ; Phase 2+ underwriting will exclude this segment |
| Users outside supported routes / products | Phase 1 = flights only, narrow route allowlist ; misalignment guaranteed |
| Users seeking financial advice | Largo is not a financial advisor ; not registered as one ; copy must never imply this |
| LLM travel-chatbot enthusiasts | Largo is not a conversational planner ; the experience will disappoint expectations of free-form chat |
| Users who require human concierge | Largo replaces a slice of the decision problem, not the relationship |

Anti-ICP is enforced by messaging (clear scope on the methodology page) and by the cohort gates (waitlist / beta entry questions filter for fit).

---

## 9. Positioning

The positioning statement Largo ships at launch :

> **Largo is a travel decision agent.** It tells you when to buy, when to wait, and when it doesn't know — with reasons you can read and a methodology you can verify.

Variants :

- **One sentence (general audience)** — "Largo is a travel decision agent : it tells you when to buy a flight, when to wait, and when it doesn't know."
- **One sentence (technical / methodology audience)** — "Largo is a calibrated, auditable travel decision agent : every advice has a reason, a confidence, and an audit trail."
- **One sentence (investor / buyer)** — "Largo is creating the travel-fiduciary-agent category : decision quality and transparency over conversion-driven booking."

Counter-positioning :

- Not a search engine. (Google Flights, Kayak, Skyscanner are.)
- Not an OTA. (Expedia, Booking, Priceline are.)
- Not a deal newsletter. (Going is.)
- Not a price-prediction app monetized through ancillary products. (Hopper is.)
- Not an LLM travel chatbot. (Various entrants are.)

---

## 10. Messaging pillars

| Pillar | What it says | What it does not say |
|---|---|---|
| **Buy at the right time** | "We tell you when to buy" | "We get you the cheapest fare" |
| **Know when to wait** | "We tell you when to wait, and why" | "Wait forever and save money" |
| **Know when not to trust the data** | "We tell you when our signal isn't strong enough — and we don't advise" | "We always know" |
| **No fake urgency** | "We never invent scarcity or countdowns" | "Hurry, this fare won't last" |
| **Transparent reasons** | "Every decision shows you why, in plain language" | "Trust the AI" |
| **Mission-based monitoring** | "Tell us your mission, we track it across time" | "Search forever" |
| **Safe auto-buy later** | "When we auto-buy on your behalf, we'll tell you exactly how — until then, we don't" | "Auto-buy is here" |
| **User stays in control** | "You set the budget, the dates, the constraints. We work within them." | "We optimize for you" |

Each pillar maps to an implementation surface that must be live before the messaging is used.

---

## 11. Taglines / value propositions

A small set of approved taglines, each with an explicit constraint :

| Tagline | Allowed when | Forbidden if |
|---|---|---|
| "The travel decision agent." | At launch | Implementation does not match (no decision agent surface) |
| "Buy. Wait. Abstain. With reasons." | At launch | Reason-code catalog is not implemented |
| "Calibrated travel decisions." | When ECE measured at target | ECE not yet measured on a published dataset |
| "The travel tool that says I don't know." | At launch | ABSTAIN is not implemented as first-class |
| "Audited by design." | Phase 2+ | Public audit page is not populated |
| "Methodology before marketing." | At launch | Methodology page is not live |
| "Honest about flights." | At launch | Phase 1 scope (flights only) is not enforced |
| "Mission-bound, mission-aware." | When mission concept is implemented | Missions are not in product |

Forbidden taglines :

- "The cheapest flights, every time."
- "Powered by AI."
- "Better than Hopper."
- "Save money on every flight."
- "Auto-buy your perfect flight."
- "Trusted by thousands of travelers."
- "The smart way to book."

Each forbidden tagline corresponds to a hard rule in this document or in `LARGO_COMPETITIVE_BENCHMARK.md` § 40.

---

## 12. Trust signals

Trust signals Largo will publish from MVP, in order of priority :

1. **Methodology page** — what Largo does, what it does not do, how confidence is calibrated, what ABSTAIN means, what the limits are. Linked from every advice surface.
2. **Honest scope statement** — Phase 1 is flights only, English / USD, narrow route allowlist, no auto-buy. Not buried.
3. **Founder-led communication** — early notes, change-logs, and methodology updates signed by a human, not a corporate "team".
4. **Plain-language reason codes** — visible on every AdviceCard.
5. **ABSTAIN exposure** — visible as a state, not hidden.
6. **No urgency / no scarcity** — verifiable on the live UX.
7. **No dark patterns** — verifiable through an independent UX audit (Phase 2+).
8. **Public audit page** — Phase 2+ when real events exist (per `LARGO_BACKEND_API_SPEC.md` and `LARGO_FRONTEND_UX_SPEC.md` § 35).
9. **Reproducible benchmarks** — Phase 2+ when published per `LARGO_EVALUATION_PLAN.md`.
10. **Transparent pricing** — when pricing exists, fully disclosed before any commitment (per `LARGO_SECURITY_PAYMENTS.md`).

Trust signals that Largo will **not** ship :

- Fabricated user testimonials.
- Stock-photo "happy traveler" reels.
- Borrowed credibility ("As featured in") without actual feature.
- "Money-back guarantee" without operationalized refund flow.
- "Zero fees forever" pre-commitments.

---

## 13. Methodology page GTM role

The methodology page is the **central trust artifact**. It is not a side surface, it is not a marketing afterthought.

Required role at GTM :

- Linked from the landing page above the fold.
- Linked from every AdviceCard (per `LARGO_FRONTEND_UX_SPEC.md`).
- Linked from every email and notification.
- Linked from every press kit and investor deck.
- Updated whenever Largo's methodology changes, with a visible change-log.
- Versioned (matches the contract / phase versions).
- Honest about what is **not** yet measured.

The methodology page is the answer to "why should I trust this?" and to "what does Largo not do?". A user who reads it and decides Largo is not for them in Phase 1 is a **success** of the GTM, not a failure.

---

## 14. Public audit page GTM role

The public audit page is **disabled in Phase 1** because there are no real, populated audit events to expose yet (per `LARGO_FRONTEND_UX_SPEC.md` § 35).

When it activates (Phase 2+), it becomes the second central trust artifact :

- Aggregate ABSTAIN rate over time, by reason code.
- Aggregate calibration drift.
- Recent kill-switch events (anonymized).
- Decision flips per mission cohort.
- All anonymized, all with k-anonymity ≥ 5 (per `LARGO_DATA_STRATEGY.md`).

In Phase 1, the methodology page substitutes : "We will publish an audit page when we have enough decisions to be honest about what it shows. Until then, this is what our methodology is."

GTM forbidden : claiming the public audit page exists or has data when it does not.

---

## 15. Waitlist strategy

The waitlist is not a vanity metric. It is a **filter** to the Phase 1 cohort.

Waitlist mechanics :

- Public landing page invites a waitlist signup.
- The signup form asks **honest qualification questions** (Section 15.1).
- Signups receive a confirmation email signed by a founder, with a methodology link and an honest expected timeline.
- No false scarcity ("Only 100 spots") unless the cap is real and enforced.
- No "skip the line" mechanics that bias toward viral spam.
- No paid acceleration.
- No referral pyramid where users are pressured to drag in others.

### 15.1 Recommended waitlist questions

Asked at signup, used to recruit the Phase 1 cohort honestly. Optional unless marked required.

| Question | Required | Use |
|---|---|---|
| Email | Required | Communication |
| First name (or handle) | Required | Personalized comms |
| Country of residence | Required | Compliance / scope |
| Primary travel use case (leisure / family / nomad / student / business) | Optional | ICP fit |
| How far ahead do you typically book a flight? | Optional | Mission window fit |
| How flexible are your dates, typically? (weeks / days / not at all) | Optional | Wedge fit |
| Do you currently use Hopper, Going, Kayak, Google Flights, or another tool? | Optional | Competitive context |
| Are you OK with us telling you "we don't know" when our signal is uncertain? | Optional but **highly weighted** | ABSTAIN tolerance |
| Why are you interested in Largo? (free text, optional) | Optional | Qualitative signal |

What we do **not** ask at signup :

- Income, credit, or payment data.
- Phone number (unless explicitly opt-in for SMS).
- Address.
- Any non-essential PII.
- Demographic profiling beyond country.

---

## 16. Beta strategy

The beta is **invitation-only** and **cohort-gated**. It is not a free-for-all.

Phase 1 beta principles :

- Founder-led recruitment first (personal network, trusted communities).
- Waitlist queue pulled in with explicit qualification (Section 15.1).
- Beta users sign a clear-language "this is early, here's what we do and don't do" agreement.
- Each beta user has a direct line to the team (small enough to not be theatre).
- Feedback collection structured (Section 16.1).
- No NDA-by-default (unless the user has access to admin / private data, which Phase 1 beta users do not).
- Honest opt-out at any time, with full data export and deletion.

### 16.1 Recommended beta application form (post-waitlist)

Sent to waitlist users we are pulling into the beta cohort. Optional except where marked.

| Question | Required | Use |
|---|---|---|
| Confirmation of waitlist email | Required | Identity check |
| Confirm you understand Largo is in early beta and may abstain often | Required | Expectation alignment |
| Do you agree we may use your decisions and outcomes (anonymized) to improve Largo? | **Required, default off, explicit opt-in** | Per `LARGO_DATA_STRATEGY.md` consent policy |
| What route family are you most interested in? | Optional | Cohort matching |
| What does "I don't know" feel like to you when an app says it? (free text) | Optional | UX qualitative |
| Are you available for a 20-minute interview during the beta? | Optional | User study recruitment |
| Preferred communication channel (email / no other) | Required | Comms |

The beta application explicitly does **not** ask for payment information. Phase 1 beta is unpriced.

---

## 17. Cohort rollout

Cohort gates are real. Each gate has entry criteria, exit criteria, allowed features, blocked features.

| Cohort | Size | Entry criteria | Exit criteria | Allowed | Blocked |
|---|---|---|---|---|---|
| **Internal dogfood** | Team only | Largo team and trusted insiders | Backend stable, advice generation reproducible, audit envelope written, methodology page draft | Search advice, mission CRUD minimal, admin audit | Payments, auto-buy, public claims |
| **0 → 10 trusted users** | 10 | Founder-recruited, ICP fit, ABSTAIN tolerance | Each user has completed ≥ 1 mission cycle ; qualitative interviews capture pain ; defects triaged | Search advice, mission, advice timeline, methodology page | Payments, auto-buy, public testimonials, paid acquisition |
| **10 → 100 beta users** | 100 | Waitlist + qualification + invitation | Calibration ECE ≤ 0.07 measured on cohort routes ; ABSTAIN rate stable and honest ; trust survey baseline ; no SEV1 incidents ; refund / dispute policy operational | + multiple missions, notification preferences, account export | Auto-buy execution, public claims of superiority, broad press |
| **100 → 1000 waitlist users** | 1,000 | Beta exit criteria met ; gated rollout from waitlist | Calibration ECE ≤ 0.05 ; benchmark protocol published ; public audit page live with real data ; cohort-validated auto-buy architecture (still disabled) ; first reproducible head-to-head study (per `LARGO_COMPETITIVE_BENCHMARK.md` § 35) | + payment preauthorization (Phase 2 surface), public methodology updates, modest organic content | Live auto-buy, paid acquisition scaling beyond test budgets |
| **1000 → GA** | 1,000+ | All Phase 2 gates passed ; legal / compliance reviewed ; refund / dispute SLA operational ; SRE on-call rotation ; security audit completed | Phase 3 scope (auto-buy execution cohort-gated) | Auto-buy execution under cohort gates per `LARGO_SECURITY_PAYMENTS.md` ; bundle decisioning (Phase 2+ feature) ; broader SEO and partnerships | Public claims of "we are #1" or category dominance |

Phase advancement requires **all** corresponding gates in `LARGO_DATA_STRATEGY.md`, `LARGO_MODEL_STRATEGY.md`, `LARGO_BACKEND_API_SPEC.md`, `LARGO_FRONTEND_UX_SPEC.md`, `LARGO_SECURITY_PAYMENTS.md`, `LARGO_EVALUATION_PLAN.md`, `LARGO_COMPETITIVE_BENCHMARK.md` to be satisfied. No unilateral GTM advancement.

---

## 18. 0 → 10 users

The first ten users are **founder-recruited**. They are not strangers ; they are people the founders can call and learn from.

Goals :

- Validate that the wedge resonates : do users understand BUY_NOW vs WAIT vs ABSTAIN? Do they trust ABSTAIN?
- Find where the AdviceCard is confusing.
- Find where the methodology page is unconvincing.
- Find where the mission lifecycle feels right or wrong.
- Find where the system fails silently (it shouldn't, but if it does, the first ten will catch it).

Anti-goals :

- "Conversion rate" is not the metric. Cohort engagement and qualitative feedback are.
- "Retention" is not yet measurable in 10 users.
- "Word of mouth" is not yet engineered.

Communication : weekly founder note to the cohort with what changed, what was learned, what is next.

Exit : every user has completed at least one mission cycle (created a mission, received advice across multiple time points, observed the outcome). Defects triaged. Methodology page revised based on real user reading.

---

## 19. 10 → 100 users

Recruited from waitlist with qualification (Section 15.1).

Goals :

- Validate calibration on a wider route distribution.
- Validate ABSTAIN rate is honest, not lazy.
- Validate that mission lifecycle holds up across 100 distinct missions.
- Validate that the methodology page survives scrutiny from skeptical users.
- Surface refund / dispute paths conceptually (no payments yet, but the conceptual contract is exercised).

Anti-goals :

- Paid acquisition.
- Press launch.
- Comparative claims.
- Auto-buy.

Cadence : biweekly founder updates. Quarterly methodology change-log.

Exit gate : Phase 1 → Phase 2 (per cohort table above).

---

## 20. 100 → 1000 users

This is the cohort that makes the public audit page meaningful. It is also the cohort where the first published benchmark becomes possible.

Goals :

- Measure calibration on a published dataset.
- Publish the first head-to-head study under `LARGO_COMPETITIVE_BENCHMARK.md` § 35.
- Activate the public audit page when k-anonymity is satisfied.
- Begin Phase 2 surfaces (payment preauthorization architecture, but not auto-buy execution).
- Begin modest organic content (founder essays on methodology, not feature announcements).

Anti-goals :

- "Better than Hopper" landing page (still requires evidence and legal review).
- Paid acquisition scaling beyond small test budgets.
- Auto-buy execution.

Cadence : monthly methodology updates. Audit page refresh on a defined cadence.

---

## 21. 1000 → GA

GA is **gradual**. There is no flag day.

Goals :

- Auto-buy execution under cohort gates per `LARGO_SECURITY_PAYMENTS.md`.
- Bundle decisioning (Phase 2+ feature) when implemented.
- Broader SEO based on real, methodology-anchored content.
- Partnerships (Section 27) only with structures that do not bias decisions.

Anti-goals :

- Category-dominance claims (Largo aspires to #1, but does not claim it).
- Unverified comparative claims.
- Hidden monetization surfaces.

GA is the phase where the system has **earned** the right to ask for broad public attention. Until then, every public surface is restrained.

---

## 22. Acquisition channels

Phase 1 acquisition is **organic and founder-led**.

| Channel | Phase 1 | Phase 2 | Phase 3 / GA |
|---|---|---|---|
| Founder essays / Substack | Active | Active | Active |
| Travel-community participation (Reddit, Discord) | Active, respect-of-rules-first | Active | Active |
| Methodology-driven SEO | Active (slow build) | Active | Active |
| Methodology-driven press (small, founder-introduced) | Selective | Active | Active |
| Referral (organic, no pyramid) | Allowed | Allowed | Allowed |
| Paid search | **Off** | Test budgets only | Active when retention signal observed |
| Paid social | **Off** | Test budgets only | Active when retention signal observed |
| Affiliate / partnership | Off Phase 1 ; conceptual study only | Selective | Active when economics aligned |
| Influencer partnerships | Off Phase 1 | Selective with clear disclosure | Active with disclosure |
| Press launches (TechCrunch, etc.) | **Off** | Off | Selective and earned |
| Product Hunt / Indie Hackers | Off Phase 1 ; small honest beta drop possible | Active | Active |
| Investor-driven announcements | Off Phase 1 | Selective | Active |

Paid acquisition scaling is gated on **retention signal**. Retention is defined per `LARGO_EVALUATION_PLAN.md`. No paid scaling until retention is proven, even if early-stage capital is available.

---

## 23. Organic content strategy

Content is :

- Anchored to methodology, not feature announcements.
- Honest about what Largo does and does not do.
- Calm in voice ; no superlatives ; no urgency.
- Founder-signed where possible.
- Linked to the methodology page from every essay.
- Open to community feedback ; comments allowed and moderated for civility, not for praise.

Topic ideas (Phase 1) :

- "Why we built a travel tool that says I don't know"
- "What is calibrated confidence, and why most travel tools don't have it"
- "How we think about ABSTAIN as a feature"
- "Why we don't auto-buy yet (and how we will)"
- "What our methodology page actually says"
- "What we are willing to be wrong about"
- "How we measure regret"
- "What we won't claim until we have proof"

Forbidden topic patterns :

- "We saved you $X this year" (without verified counterfactual).
- "How Largo is changing travel" (without traction).
- "5 reasons Largo beats Hopper" (without benchmark).
- "AI is the future of travel" (positioning by trend rather than substance).

---

## 24. SEO strategy

SEO is slow on purpose.

Phase 1 SEO targets :

- Long-tail informational queries that match the wedge ("should I buy this flight now or wait", "what does ABSTAIN mean in travel decisions", "calibrated price prediction flights").
- Methodology-page-anchored content.
- Founder-essay content that earns backlinks through substance.

Phase 1 SEO **forbidden** :

- "Cheapest flights to X" pages without inventory backing.
- "Vs Hopper" / "Vs Kayak" comparison pages without `LARGO_COMPETITIVE_BENCHMARK.md` evidence.
- AI-spun thin content for keyword density.
- Doorway pages.
- Cloaked content.
- Buying backlinks.
- Thin "City to City" pages without genuine route-level methodology.

SEO that violates these patterns is removed even if it ranks.

---

## 25. Social proof policy

Social proof is real or it is not used.

Allowed :

- Quoted user testimonials with explicit consent and identity (or pseudonymous with consent).
- Founder testimonials about why Largo was built.
- Genuine third-party press coverage (when earned).
- Community-generated comparisons (when fair) — Largo does not seed, does not pay, and does not astroturf.

Forbidden :

- Fabricated testimonials.
- "Trusted by thousands" without cohort.
- Stock-photo testimonial reels.
- Logos of users / companies displayed without permission.
- Paid review placement without explicit disclosure.
- Astroturfed forum posts.

Disclosure : any compensated testimonial or review is labeled `[sponsored]` or `[compensated]` clearly and unambiguously.

---

## 26. Referral strategy

Referral is allowed in **organic** form only.

Allowed :

- A "share Largo" link on the methodology page or in account settings.
- Optional referral code that grants the referrer and referee a small benefit (when pricing exists in Phase 2+).
- Direct conversation : a beta user inviting a friend.

Forbidden :

- Pyramid mechanics where the user is pressured to drag in many others.
- "Skip the line" referrals that bias toward viral spam.
- Auto-emailing the user's contacts.
- Dark-pattern share modals that interrupt critical flows.
- Compensation tied to volume rather than fit.

---

## 27. Partnerships strategy

Partnerships are **structurally restricted** to those that do not bias the decision.

Allowed in principle :

- Provider integrations (when economics support honest decisioning across providers, not toward one).
- Affiliate relationships disclosed clearly, with the disclosure visible from every advice surface that depends on it.
- Methodology partnerships (independent reviews, academic collaborations).
- Distribution partnerships with travel communities aligned with the trust posture.

Forbidden :

- Exclusive provider deals that would bias recommendations.
- Affiliate relationships that pay differently across providers in a way that biases the recommendation.
- "Featured partner" placement that overrides decisioning.
- Co-branded content that obscures Largo's voice.
- Partnerships that require Largo to disable ABSTAIN or to soften reasons.

---

## 28. Campus / student strategy

Students are a strong wedge fit (price-sensitive, flexible, ABSTAIN-tolerant).

Phase 1 approach :

- Founder-led talks at student travel clubs, when geography allows.
- Methodology-driven content that respects student information consumption (concise, plain, linkable).
- No paid campus ambassador programs in Phase 1 (they tend to incentivize over-recruiting).
- No fabricated student endorsements.

When pricing exists (Phase 2+), a student-friendly tier may be introduced if it does not bias decisioning.

---

## 29. Travel community strategy

Phase 1 approach :

- Participate in travel communities (Reddit, Discord, Substack) as a person, not a brand. Founder identity disclosed.
- Respect community rules ; no spam, no covert promotion.
- Answer questions about methodology when asked, link to the methodology page when relevant.
- Accept criticism publicly. Update the methodology page when criticism is fair.
- Do not seed or astroturf.
- Do not pay community moderators for placement.

The travel community is the source of trust signal that money cannot buy. Largo participates carefully and slowly.

---

## 30. Pricing strategy

Phase 1 = **free**, with anonymous quota and authenticated higher quota (per `LARGO_BACKEND_API_SPEC.md`).

Phase 2+ pricing is **out of B0 scope** in detail, but constrained here :

- Pricing must not create a perverse incentive to recommend BUY_NOW (per `LARGO_COMPETITIVE_BENCHMARK.md` § 27).
- Pricing must be fully disclosed before any commitment, with no hidden fees.
- Pricing must not make ABSTAIN a financial loss for Largo (i.e. a per-booking fee that only triggers on BUY_NOW would create the perverse incentive ; alternatives include subscription, transparent flat fee, or a model that pays Largo for being correct over time).
- Pricing copy must not pressure ("Limited time offer", "Don't miss out") even at promotional moments.

The chosen pricing model is decided in a Phase 2 amendment to this document. Phase 1 commits to the constraint, not the value.

---

## 31. Free vs paid plan

Phase 1 :

- Anonymous : limited quota of advice queries.
- Authenticated free : higher quota, mission creation, mission timeline, account export.
- No paid tier in Phase 1.

Phase 2+ candidates (constrained by Section 30) :

- Subscription tier with higher mission limits, multiple missions, advanced notifications.
- Per-mission flat fee disclosed up front, refundable on ABSTAIN.
- Eventually : auto-buy charge on successful execution under disclosed terms (Phase 3+).

The exact paid plan is a Phase 2 amendment. Phase 1 sets the constraints.

---

## 32. Mission pricing

Mission-level pricing (Phase 2+) constraints :

- Disclosed before mission creation.
- Refundable if Largo abstains for the entire mission window without recommendation.
- Refundable if Largo's recommendation results in a measurably worse outcome than the user's stated counterfactual (subject to a fair, pre-disclosed protocol).
- Not pyramidal (more missions ≠ steeper escalation that pressures into auto-buy).

A "mission price" is a commitment from Largo to do work over a window. If Largo cannot do the work (ABSTAIN throughout, provider failure, etc.), the user is refunded.

---

## 33. Auto-buy pricing future

Auto-buy pricing (Phase 3+) constraints :

- Charged only on successful execution.
- Charge amount disclosed in the auto-buy confirmation modal (per `LARGO_FRONTEND_UX_SPEC.md` § 30).
- Charge does not vary by which provider executed (no perverse incentive to route to a higher-fee provider).
- Charge structure is consistent across users (no surge pricing on auto-buy).
- Refundable in the cancellation window per `LARGO_SECURITY_PAYMENTS.md`.

Auto-buy pricing is decided in a Phase 3 amendment. Phase 1 commits to the constraints.

---

## 34. Trust-first onboarding

Onboarding is designed to **earn the right** to ask for trust.

Sequence (Phase 1) :

1. Landing page : honest one-sentence positioning.
2. Methodology link prominent.
3. Search-first : the user can try a search without an account.
4. AdviceCard renders honestly (including ABSTAIN if applicable).
5. Optional account creation, with explicit data consent layered (per `LARGO_DATA_STRATEGY.md`).
6. Optional notification opt-in, default off.
7. Optional mission creation.
8. Optional waitlist for upcoming features.

Onboarding is **skippable** at every step. No forced account creation. No forced consent bundling.

---

## 35. Landing page structure

Recommended sections for the Phase 1 landing page :

| Section | Purpose | Notes |
|---|---|---|
| Hero | One-sentence positioning + a primary "Try a search" CTA | No urgency timer, no fake user count |
| What Largo is (and is not) | Plain-language description, including the boundaries | Sets honest expectations |
| How it works | Three-step or four-step plain-language summary | No technical jargon |
| Sample AdviceCard | Static example of a real AdviceCard, including an ABSTAIN example | Shows the product, not stock illustrations |
| Methodology link | Prominent | Linked from hero AND from page bottom |
| What we don't do (yet) | Phase 1 limits stated openly | Anti-overpromise discipline |
| Trust signals | Methodology page, founder name, contact line | Real, not borrowed |
| Waitlist signup or "Try a search" CTA | Honest, with expected timeline | No false scarcity |
| Footer | Privacy, terms, contact, change-log link | Standard, complete |

Forbidden landing-page elements :

- Fake user counters.
- Fake "X people are looking now".
- Stock photos of "happy travelers".
- Borrowed logos ("As seen in") without proof.
- Pre-checked email-marketing consent.
- Auto-playing video with sound.
- Pop-up modal interrupting first interaction.
- Newsletter pop-up before any value is rendered.
- "Best price" or "Cheapest" claims.

---

## 36. Demo strategy

When Largo demos to users, beta candidates, investors, or press :

- Live, not pre-rendered.
- Includes an ABSTAIN moment if the live state produces one. Do not avoid an ABSTAIN to make the demo "look good".
- Methodology page is opened in the demo.
- Audit envelope (admin Phase 1) is opened in the demo for technical audiences.
- The demo explicitly says what is not in product yet.
- The demo never claims a measurement that has not been measured.

A demo that masks ABSTAIN or hides a real defect is a forbidden GTM pattern.

---

## 37. Investor / buyer narrative

The investor / buyer narrative is the **same narrative** as the user-facing narrative, expressed at a different altitude.

Pitch frame :

- **Category** : Travel Fiduciary Agent — decisioning over search and OTA conversion.
- **Wedge** : honest abstain, transparent reasons, mission-bound, auditable. None of these is a feature. Each is a refusal of a default in the existing market.
- **Moat** : decision-paired dataset (intent + advice + outcome + regret) plus operational discipline (ABSTAIN as feature). The moat compounds with usage and cannot be bought.
- **Defensibility** : conversion-driven competitors face a structural disincentive to expose ABSTAIN ; this is durable.
- **Phase plan** : 0 → 10 → 100 → 1000 → GA, gated, evidence-bound.
- **Risks** : addressed in Section 43.
- **Anti-claims** : we do not claim "better than Hopper", we do not claim auto-buy yet, we do not claim category dominance.

A 60-second investor pitch :

> "Largo is a travel decision agent. Hopper, Kayak, Booking, and Google Flights all do search or OTA conversion. They make money when you book. Nobody in the market answers the question 'should I buy this now, or wait, or abstain?' with honest calibration and a public methodology. Largo does, and refuses to advise when uncertain. We are gated by cohort, not by calendar : 10 trusted users, then 100 beta, then 1000, then GA. Auto-buy is disabled until we earn the right. Our moat is decision-paired data that we accumulate from real users making real decisions and living with real outcomes. The wedge is honesty in a market that has none."

A 60-second user pitch :

> "Largo tells you whether to buy a flight now, wait, or abstain — and tells you why, in plain language. It says 'I don't know' when our signal isn't strong enough, instead of pretending. You set the budget, the dates, the constraints. We work within them and show you our reasoning. We don't auto-buy yet, and we don't pretend to be cheaper than tools we haven't proven we can beat."

---

## 38. Metrics to show externally

External metrics published with rigorous discipline :

| Metric | When published | What it shows |
|---|---|---|
| Waitlist size | Anytime, honestly stated | Demand signal (not value) |
| Activation rate | When cohort ≥ 100 with k-anonymity ≥ 5 | Did users complete a first mission cycle |
| Mission creation rate | When cohort ≥ 100 | Wedge fit |
| Advice usefulness rating (in-product feedback) | When cohort ≥ 100 | Qualitative validation |
| Retention | When measurable across multiple periods | Repeat-use signal |
| Trust score (survey) | Phase 2+ | Independent trust posture |
| ABSTAIN acceptance rate | When cohort ≥ 100 | Did users accept ABSTAIN as a feature |
| Notification opt-in rate | Anytime, honestly stated | UX honesty |
| Mission completion rate | Phase 2+, k-anonymity ≥ 5 | Outcome signal |
| Verified savings | **Only when verified** with counterfactual per `LARGO_EVALUATION_PLAN.md` | Strict guard |
| Zero-dispute record (when payments are live) | Phase 2+ when applicable | Operational quality |

External claim discipline : every published metric carries its measurement window, its cohort size (or rounded floor), and its protocol citation. Otherwise it is not published.

---

## 39. Metrics to keep internal

Internal-only metrics that drive engineering and product but are **not** public :

- Numeric confidence values, raw quantiles, calibration ECE per route segment until published.
- Provider-specific reliability data (until disclosed in disagreement summaries).
- ABSTAIN reason distribution at fine granularity (until the public audit page is live).
- Latency p99 per endpoint (operational).
- Kill-switch toggle counts (operational).
- Engineering throughput, defect counts, model run logs.
- Per-user behavior (always, by privacy policy).
- Funnel-conversion mechanics (because they would tempt conversion-optimized copy).

Internal metrics inform engineering. They are never used to substantiate a public claim.

---

## 40. Public claims policy

Inherits from `LARGO_COMPETITIVE_BENCHMARK.md` § 33 and applies it to GTM surfaces.

The default for any external claim is **no**. A claim is allowed when :

- It is grounded in a measurement.
- The measurement protocol is published or referenced.
- The measurement is reproducible by a third party in principle.
- The claim is segment-bound, not global.
- The claim's caveats are stated alongside.
- The claim is reviewed by legal where it names a competitor or makes a guarantee.

A claim missing any of these is treated as marketing fiction.

GTM-specific claims allowed at launch (when implementation matches) :

- "Largo refuses to advise when our signal is uncertain."
- "Largo publishes its methodology before it asks for your trust."
- "Largo does not have dark patterns."
- "Largo does not auto-buy in Phase 1."
- "Largo treats your mission as a unit, not a search."
- "Largo's confidence is calibrated."
- "Largo records every decision so we can be accountable."

GTM-specific claims **forbidden** at launch :

- "Largo is the cheapest."
- "Largo beats Hopper / Kayak / Google Flights."
- "Largo guarantees savings."
- "Largo is the smartest travel app."
- "Largo is trusted by thousands."
- "Largo is powered by AI" used as superiority.
- "Largo finds you the best deal."
- "Largo will book for you" (in Phase 1).
- "Public audit shows we are honest" (until page is populated).

---

## 41. Launch gates

A launch gate is the explicit checklist that must be true before the next phase opens.

Phase 1 launch gates (before opening to the first ten trusted users) :

- Methodology page live and signed by a founder.
- Search-first AdviceCard implemented with ABSTAIN as first-class.
- Mission creation and timeline implemented.
- Append-only audit envelope implemented (admin Phase 1 visibility).
- Latency budgets respected (per `LARGO_BACKEND_API_SPEC.md`).
- Calibration measured on a small frozen dataset, ECE within Phase 1 target.
- Reason-code catalog complete for the implemented decision states.
- No dark-pattern UX detected on Phase 1 surfaces (per `LARGO_FRONTEND_UX_SPEC.md` § 41).
- Privacy / consent surfaces implemented (per `LARGO_DATA_STRATEGY.md`).
- Kill switches implemented (per `LARGO_SECURITY_PAYMENTS.md`).
- Forbidden patterns audit passed (no `[to verify]` items left in customer-facing copy).
- Founder-signed change-log live.

Phase 2 launch gates extend Phase 1 with payment surfaces, public audit page, first head-to-head benchmark publication, etc., per the cohort table (Section 17).

Phase 3 launch gates extend Phase 2 with auto-buy execution (cohort-gated), bundle decisioning, and the first reproducible cross-cohort benchmark.

---

## 42. Phase 1 / Phase 2 / Phase 3 GTM

| GTM element | Phase 1 | Phase 2 | Phase 3 / GA |
|---|---|---|---|
| Founder-led communication | Active | Active | Active |
| Methodology page | Live | Live | Live |
| Public audit page | **Off** | Live (when populated) | Live |
| Waitlist | Active | Active | Active |
| Beta cohort | 10 → 100 | 100 → 1000 | 1000+ |
| Paid acquisition | **Off** | Test budgets | Active when retention proven |
| Press | Off | Selective | Selective |
| Comparative claims | **Off** | Conditional on benchmark | Conditional on benchmark |
| Auto-buy claim | **Off** | **Off** | Active when cohort-gated |
| Pricing | Free | Phase 2 model | Phase 3 model |
| Investor narrative | Founder-led | Founder + early ops | Founder + ops + sales |
| Partnerships | Conceptual | Selective | Active |
| SEO scope | Long-tail informational | Methodology + segment | Broader |
| International | English / USD | Selective | Expanded |

GTM phase advancement is gated on the corresponding implementation, evaluation, security, and benchmark gates being satisfied across the other ten B0 documents.

---

## 43. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Premature comparative claim damages brand | Medium | High | Claims policy enforced ; legal review for any competitor naming |
| Honest ABSTAIN is misread as "broken product" | Medium | Medium | Methodology page explains ABSTAIN as feature ; reason codes are plain |
| ICP misalignment fills cohort with wrong users | Medium | Medium | Waitlist qualification ; honest scope copy ; anti-ICP enforced |
| Paid acquisition deployed before retention proven | Low (gated) | High | Gate enforced |
| Press launch attempted before evidence | Low (gated) | High | Phase 1 press = off ; gate enforced |
| Dark pattern slips in for conversion optimization | Medium | High | Forbidden patterns list, UX audit Phase 2+ |
| Founder voice diluted by corporate-speak rewrite | Medium | Medium | Founder-signed comms, no anonymous "team" voice |
| Public audit page launched before populated | Low | High | Disabled in Phase 1, gate enforced |
| Auto-buy claim slips into copy before live | Low | Critical | Forbidden statements list, copy review |
| Waitlist becomes vanity metric | Medium | Low | Waitlist used as filter, not as growth metric |
| Provider partnership biases recommendations | Medium | High | Affiliate disclosure ; structurally restricted partnerships |
| LLM "AI travel agent" confusion | High | Medium | Counter-positioning copy ; methodology page distinguishes |
| Brand absorbed into "another booking app" mental model | High | High | Category-creation copy ; messaging pillars enforced |
| Beta user data misused for training without consent | Low (controlled) | Critical | Layered consent ; default-off training reuse per `LARGO_DATA_STRATEGY.md` |
| Refund / dispute path incomplete at first paid action | Medium | High | Refund / dispute flow designed before payment activation |
| Press misquotes Largo claims | Medium | Medium | Press kit with explicit allowed/forbidden quotes ; founder review |
| Influencer overstates Largo capability | Medium | Medium | Partner code of conduct ; explicit allowed-claims list |
| Cohort gates bypassed by impatience | Medium | Critical | Documented gates ; written sign-off required for advancement |
| Rapid hiring dilutes voice and discipline | Low Phase 1 | Medium Phase 2+ | Onboarding to B0 docs as part of hire ; voice review |
| Marketing pressure to abandon ABSTAIN | Medium Phase 2+ | Critical | ABSTAIN is in the contract ; removing it is a B0 amendment, not a marketing decision |

---

## 44. Forbidden GTM patterns

Append-only list. New patterns are added ; existing patterns never softened.

| # | Pattern | Why forbidden |
|---|---|---|
| 1 | "Guaranteed cheapest flight" | Cannot be guaranteed |
| 2 | "Better than Hopper / Kayak / Google Flights" without benchmark proof | Claims policy violation |
| 3 | Fake urgency timers | Manipulation |
| 4 | Fake scarcity ("Only N left") | Manipulation |
| 5 | Fabricated user testimonials | Fraud |
| 6 | Cherry-picked savings | Misleading |
| 7 | "We saved you $X" without verified counterfactual | Misleading |
| 8 | Public claim about auto-buy before it is live and safe | False |
| 9 | Public claim about audit page before real audit events exist | False |
| 10 | Public prediction superiority claim before benchmark | Claims policy violation |
| 11 | Paid acquisition scaling before retention signal | Capital burn + brand risk |
| 12 | Launch to broad public before beta safety gates | Brand risk |
| 13 | Marketing of features not implemented | Misleading |
| 14 | Hiding ABSTAIN in marketing | Dishonest positioning |
| 15 | Using "AI" as proof of quality | Misleading positioning |
| 16 | Implying financial advice | Regulatory risk |
| 17 | Misleading refund claims | Trust + legal risk |
| 18 | Dark-pattern landing pages | Anti-trust posture |
| 19 | Pressure copy ("Don't miss out") | Manipulation |
| 20 | Pre-checked email-marketing consent | Coerced consent |
| 21 | Pop-up modal before first interaction | Dark pattern |
| 22 | Auto-playing video with sound | UX hostility |
| 23 | Borrowed logos ("As seen in") without proof | Fraud |
| 24 | Stock-photo testimonial reels | Fraud |
| 25 | Astroturfed forum / community posts | Fraud |
| 26 | Pyramid referral mechanics | Spam |
| 27 | "Skip the line" referrals | Spam |
| 28 | Auto-emailing user contacts | Privacy violation |
| 29 | Compensated reviews without disclosure | Fraud |
| 30 | "Trusted by thousands" before cohort exists | Fabricated |
| 31 | Affiliate relationships that bias recommendations | Conflict of interest |
| 32 | "Featured partner" placement that overrides decisioning | Conflict of interest |
| 33 | Co-branded content that obscures Largo's voice | Voice dilution |
| 34 | Press launch before Phase 2 gates | Premature exposure |
| 35 | Comparison landing pages before benchmark | Claims policy violation |
| 36 | "Limited time offer" pressure copy | Manipulation |
| 37 | Surge pricing on auto-buy | Conflict of interest |
| 38 | Bundling consent with auto-buy enrollment | Coerced consent |
| 39 | Skipping methodology link from any Largo external surface | Trust violation |
| 40 | Investor pitch overstating live capabilities | Fiduciary breach |
| 41 | Demo masking ABSTAIN or hiding live defect | Dishonest |
| 42 | "First to do X" claim without trademark / legal evidence | Risk |
| 43 | Hiring marketing without onboarding to B0 documents | Voice / discipline drift |
| 44 | Public roadmap promises bound to a calendar date | Premature commitment |

---

## 45. B0 completion checklist

This document closes B0. The eleven B0 documents that must exist, frozen for B0 :

| # | Document | Status |
|---|---|---|
| 1 | `LARGO_DOMINATION_STRATEGY.md` | Committed `ea674a16` |
| 2 | `LARGO_PRODUCT_VISION.md` | Committed `133691e7` |
| 3 | `LARGO_ADVICE_CONTRACT.md` | Committed `d9b25872` |
| 4 | `LARGO_EVALUATION_PLAN.md` | Committed `9b2245c4` |
| 5 | `LARGO_SECURITY_PAYMENTS.md` | Committed `1cbbf08f` |
| 6 | `LARGO_DATA_STRATEGY.md` | Committed `3cac38bf` |
| 7 | `LARGO_MODEL_STRATEGY.md` | Committed `c87e71fd` |
| 8 | `LARGO_BACKEND_API_SPEC.md` | Committed `dae875d6` |
| 9 | `LARGO_FRONTEND_UX_SPEC.md` | Committed `fd180847` |
| 10 | `LARGO_COMPETITIVE_BENCHMARK.md` | Committed `74c2f3d7` |
| 11 | `LARGO_GO_TO_MARKET.md` | This document, pending commit |

B0 completion criteria :

- [x] All eleven documents drafted, internally consistent.
- [x] `LargoAdvice` contract version `0.1.0` referenced consistently.
- [x] AuditBlock minimal envelope referenced consistently.
- [x] Phase 1 = flights only, no live auto-buy, no silent auto-buy referenced consistently.
- [x] ABSTAIN as first-class state referenced consistently.
- [x] Numeric confidence admin-only referenced consistently.
- [x] Cohort gates 0 → 10 → 100 → 1000 → GA referenced consistently.
- [x] V7a remains active baseline, untouched (anchor 2026-04-25).
- [x] V7.6 Ultra preserved as research asset, not declared useless.
- [x] Forbidden-pattern lists exist and are append-only across security, data, model, backend, frontend, GTM.
- [x] Public-claims policy enforced across competitive, evaluation, model, data, GTM.
- [x] Cross-document anchors maintained (no contradiction discovered to date).

When all eleven documents are committed and pushed, B0 is **complete**.

---

## 46. Transition from B0 to B1

B0 is **documentary**. B1 is **implementation**.

The transition is not automatic. It requires :

1. **B0 freeze acknowledgement.** All eleven documents committed, pushed, internally consistent, no `[to verify]` items in customer-facing claims.
2. **Implementation plan derived from B0.** A B1 plan that maps each B0 contract to an implementation step, with explicit gates referencing the corresponding B0 sections.
3. **Engineering scope decision.** Which pieces of `LARGO_BACKEND_API_SPEC.md` are built first, what frontend surfaces from `LARGO_FRONTEND_UX_SPEC.md` ship for the 0 → 10 cohort, what data scaffolding from `LARGO_DATA_STRATEGY.md` is required, what model from `LARGO_MODEL_STRATEGY.md` (V1 + V7a) ships into production wrapped by the rule policy.
4. **V7a continuity.** V7a is the active baseline. B1 does not replace it ; B1 wraps it under the Largo decision policy, audit envelope, and customer-safe view.
5. **First launch gate (Section 41) achievement plan.** Each gate item has an owner, an estimated timeline, and a measurable exit criterion.
6. **Operational readiness.** Kill switches operationalized, on-call rotation defined (even if minimal), incident response plan stubbed.
7. **B0 amendments process.** A documented mechanism for amending a B0 document when implementation reveals a missing constraint. B0 documents are not retired ; they are versioned forward.

B1 is **not** a green-light to drop B0 discipline. B1 is the discipline applied to code.

Initial B1 work scope (suggested order, decided in B1) :

- Backend skeleton implementing `LARGO_BACKEND_API_SPEC.md` Phase 1 endpoints (advice, mission CRUD minimal, advice history, admin audit reads).
- Audit envelope and append-only persistence per `LARGO_DATA_STRATEGY.md`.
- Frontend skeleton implementing `LARGO_FRONTEND_UX_SPEC.md` AdviceCard, mission dashboard, mission timeline, methodology page.
- V1 heuristic implementation as fallback per `LARGO_MODEL_STRATEGY.md`.
- V7a wrapped under decision policy + audit (no V7a code modification ; only integration shim).
- Kill switches per `LARGO_SECURITY_PAYMENTS.md`.
- Methodology page content drafted from B0 anchors.
- Internal dogfood cohort.

Auto-buy, payments, public audit page, comparative claims : **not in initial B1 scope**, per cohort gates.

---

## 47. Open questions before implementation

Tracked, not blockers for B0 closure.

1. Specific date for the first 0 → 10 cohort recruitment kick-off.
2. Specific provider chain for Phase 1 (Provider 1 + Provider 2 selection).
3. Specific route allowlist for Phase 1 cohort (IATA pairs).
4. Hosting / infrastructure choices (out of scope for B0 ; decided in B1).
5. Component library decision per `LARGO_FRONTEND_UX_SPEC.md` § 48.
6. Email / notification provider choice.
7. Privacy / cookie consent UI choice.
8. Methodology page authoring tool (Markdown, MDX, CMS).
9. Press kit content draft.
10. Founder essay calendar (first 6 essays).
11. Beta application form mechanics (form provider, anti-spam).
12. Waitlist segmentation / queue management mechanics.
13. Independent UX audit provider (Phase 2+).
14. Independent security audit provider (Phase 2+).
15. Independent calibration / benchmark reviewer (Phase 2+).
16. Pricing model decision (Phase 2 amendment).
17. Auto-buy pricing model decision (Phase 3 amendment).
18. Trademark / category-creation strategy ("Travel Fiduciary Agent").
19. Legal counsel for claims review.
20. Investor / capital strategy (out of B0 scope ; decided alongside B1).
21. First three pieces of organic content : titles and outlines.
22. Refund / dispute SLA timing (Phase 2+).
23. Public audit page schema design (Phase 2+).
24. Localization strategy and timing (Phase 2+ at earliest).
25. Crisis comms playbook (incident SEV ladder external version, per `LARGO_SECURITY_PAYMENTS.md`).

---

## 48. Document status

| Property | Value |
|---|---|
| Document | `LARGO_GO_TO_MARKET.md` |
| Phase | B0 documentary |
| Status | Frozen for B0, amendable via B0 review |
| Version | 0.1.0 |
| Date | 2026-04-27 |
| Implementation | None. No landing page, no waitlist, no campaign, no public surface from this document. |
| V7a impact | None. V7a remains active baseline, untouched. |
| Cross-doc consistency | Pinned to all ten prior B0 documents ; ABSTAIN first-class, Phase 1 flights-only, no live auto-buy, methodology before marketing, no claim ahead of evidence. |
| B0 completion | This document is the **eleventh and final** B0 document. When committed and pushed, B0 is complete. |
| Next phase | B1 — implementation plan derived from B0 ; transition rules in Section 46. |

This document is the contract on how Largo enters the world. The implementation of any go-to-market surface must justify any deviation through a B0 amendment.

B0 closes here.
