# Largo — B0 Closure Audit

**Document type :** B0 closure audit, not implementation.
**Status :** Source-of-truth audit for whether B0 is internally coherent and ready to transition toward B1.
**Version :** 0.1.0
**Last updated :** 2026-04-27
**Scope :** Verify cross-document coherence of the 11 B0 documents, surface contradictions and ambiguities, define the exact gates that must be met before B1 implementation may begin.

This document does **not** open B1. It does **not** propose code, migrations, endpoints, components, or deployment. It only audits whether B0 is closed and ready, and pins the conditions under which B1 may be opened in a future, separately-scoped session.

---

## 0. Executive summary

The eleven B0 documents (`LARGO_DOMINATION_STRATEGY`, `LARGO_PRODUCT_VISION`, `LARGO_ADVICE_CONTRACT`, `LARGO_EVALUATION_PLAN`, `LARGO_SECURITY_PAYMENTS`, `LARGO_DATA_STRATEGY`, `LARGO_MODEL_STRATEGY`, `LARGO_BACKEND_API_SPEC`, `LARGO_FRONTEND_UX_SPEC`, `LARGO_COMPETITIVE_BENCHMARK`, `LARGO_GO_TO_MARKET`) form a coherent specification stack. All declared anchors hold across the eleven : `LargoAdvice` v0.1.0, `AuditBlock` minimal envelope, `audit_id === advice_id` Phase 1, customer-safe view stripped server-side, numeric confidence internal/admin only, ABSTAIN first-class, nullable price and provider, no silent BUY_NOW fallback, no live auto-buy in Phase 1, no LLM in the decision path, no dark patterns, public claims gated by evidence.

No blocking contradiction has been found. Several minor ambiguities (vocabulary mapping between *Phase 1/2/3* and *Cohort 0→10→100→1000→GA*, the working category label *Travel Fiduciary Agent* versus the marketing-facing label *Travel Decision Agent*, the boundary between "ML available" and "ML in shadow") are listed in Section 19 and assigned to B1 decision owners.

The verdict (Section 30) is **A — B0 closed, ready for B1 planning** with the explicit reservation that B1 implementation must not start without a separately-authored `B1_IMPLEMENTATION_PLAN.md` document and the readiness gates in Section 23 met.

This audit is the closing artefact of B0. After this document, no further B0 document is required.

---

## 1. Scope and non-scope

**In scope (this document) :**

- Verify cross-document coherence of the 11 B0 documents.
- Inventory the documents with their commit hashes and authority area.
- Surface contradictions, if any, with severity and recommended resolution.
- Surface ambiguities with priority and recommended B1 decision owners.
- Consolidate the hard rules and forbidden patterns that B1 must respect.
- Define the readiness gates for B1.
- List the candidate first-sprint backlog for B1, without implementing anything.
- List what B1 must not implement yet.
- Pin the AI / Claude coding discipline that B1 sessions must respect.
- Flag the working tree noise as a future B1 prerequisite, not a B0 task.
- Issue the final B0 closure verdict.

**Out of scope (this document) :**

- Any code, any endpoint, any handler, any component, any migration.
- Any V7a touch, any watcher touch, any Modal touch, any cron touch.
- Any deployment, any model run, any training run.
- Any modification of files outside `docs/b0/B0_CLOSURE_AUDIT.md`.
- Any commit, any push, any rebase performed by the assistant.
- Any cleanup of the working tree.
- The `B1_IMPLEMENTATION_PLAN.md` document itself (separate session).
- Any decision that re-opens an already-frozen B0 anchor (those require an explicit B0 amendment session, not this audit).

If a contradiction with a frozen anchor is discovered, this document records it but does not resolve it. Resolution belongs to a B0 amendment session.

---

## 2. B0 document inventory

The eleven B0 documents, in creation order. All eleven are pushed to `origin/main` as of the timestamp of this audit.

| # | file | commit | role | status | key authority |
|---|---|---|---|---|---|
| 1 | `docs/b0/LARGO_DOMINATION_STRATEGY.md` | `ea674a16` | Strategic blueprint, category creation, five moats, superiority ladder | pushed | What Largo competes on, what it does not compete on first |
| 2 | `docs/b0/LARGO_PRODUCT_VISION.md` | `133691e7` | Product principles, user promise, emotional posture, surface inventory | pushed | What Largo feels like, what it never feels like |
| 3 | `docs/b0/LARGO_ADVICE_CONTRACT.md` | `d9b25872` | TypeScript contract `LargoAdvice` v0.1.0, `AuditBlock`, enums, mapping rules | pushed | Single typed shape every decision flows through |
| 4 | `docs/b0/LARGO_EVALUATION_PLAN.md` | `9b2245c4` | Metrics, baselines, ECE targets, ABSTAIN quality, kill criteria, journalist test | pushed | What "better" means and how it is proved |
| 5 | `docs/b0/LARGO_SECURITY_PAYMENTS.md` | `1cbbf08f` | Threat model, trust boundaries, auto-buy gate, payment lifecycle, kill switches | pushed | What may never go live, what gates each step |
| 6 | `docs/b0/LARGO_DATA_STRATEGY.md` | `3cac38bf` | Data moat thesis, source inventory, lineage, label policy, missing-as-information | pushed | What data Largo will and will not own, how it is contracted |
| 7 | `docs/b0/LARGO_MODEL_STRATEGY.md` | `c87e71fd` | Model inventory, V7a active baseline, V7.6 research, calibration, abstention, promotion gates | pushed | What models are allowed, what is forbidden, how promotion happens |
| 8 | `docs/b0/LARGO_BACKEND_API_SPEC.md` | `dae875d6` | Future endpoints, idempotency, audit construction, error model, fallback, latency budgets | pushed | What the backend authority is, what the frontend is never allowed to decide |
| 9 | `docs/b0/LARGO_FRONTEND_UX_SPEC.md` | `fd180847` | Surfaces, AdviceCard states, ABSTAIN UX, copy, accessibility, anti-dark-patterns | pushed | What the customer sees, what they never see |
| 10 | `docs/b0/LARGO_COMPETITIVE_BENCHMARK.md` | `74c2f3d7` | Competitor categories, what Largo competes on first, public claims policy, "to verify" markers | pushed | Which claims may be made, when, on what evidence |
| 11 | `docs/b0/LARGO_GO_TO_MARKET.md` | `61c18a41` | Cohort rollout, ICP, messaging, trust signals, founder-led launch, B0→B1 transition | pushed | When and how Largo is introduced to the world |

This table is the canonical B0 manifest. Any future reference to "B0" in B1 sessions points to these eleven documents at these eleven commit hashes (latest of each branch, modulo authorized amendments).

---

## 3. Methodology

How this audit was performed.

1. **Inspection.** Each of the eleven documents was inspected at the leading sections (header, scope, philosophy, principles) and selected mid-document sections relevant to the cross-cutting anchors. Cross-references between documents were spot-checked by keyword.
2. **Anchor verification.** The fifteen anchors enumerated by the closure prompt were each searched across the documents. Every anchor was found to be present in every document where it is relevant, with consistent phrasing.
3. **Cross-cutting concern check.** Twelve cross-cutting concerns (ABSTAIN, auto-buy, confidence, audit, pricing/savings claims, customer-safe view, data moat, model promotion, provider failure, null price, no dark patterns, public benchmark claims) were each traced through all eleven documents. The Section 17 matrix records the result.
4. **Contradiction search.** Direct contradictions (one document forbids what another mandates) were sought. None was found at the blocking severity level. Section 18 records this verdict.
5. **Ambiguity search.** Soft inconsistencies (vocabulary drift, scope-overlap, undecided defaults) were collected. Section 19 records them as ambiguities for B1 owners.
6. **No web browsing.** No external source was consulted for this audit. The audit reports only on internal coherence of the eleven documents.
7. **No code, no migration, no deployment.** This audit did not modify any file outside `docs/b0/B0_CLOSURE_AUDIT.md`.

The methodology is intentionally conservative : the audit does not attempt to *re-litigate* the design choices already frozen in B0. Re-litigation belongs to a B0 amendment session, not to a closure audit.

---

## 4. Global coherence verdict

The eleven B0 documents form a coherent specification stack.

- **Vertical coherence** (strategy → product → contract → backend / frontend / security / data / model → benchmark → GTM) holds. Each downstream document builds on its declared predecessors, references them by filename, and respects the anchors set above.
- **Horizontal coherence** (cross-document anchors) holds. The same fifteen anchors appear in the documents where they are relevant, in compatible language, without semantic drift.
- **Forbidden-pattern coherence** holds. The forbidden lists across documents are complementary, not overlapping in contradictory ways. A pattern forbidden in one document is not "permitted with conditions" in another.

The stack is therefore *internally coherent* at the resolution of B0. Implementation will inevitably surface higher-resolution questions; those belong to B1, not to this audit.

---

## 5. Decision lock summary

The decisions below are *frozen for B0*. They may be revisited only via an explicit B0 amendment session. B1 implementation must respect them as starting constraints.

| Decision | Lock | Authority |
|---|---|---|
| Phase 1 product scope = flights only | locked | `LARGO_DOMINATION_STRATEGY` §2, `LARGO_ADVICE_CONTRACT` §0 (multi-product future-proof, runtime restricted), `LARGO_BACKEND_API_SPEC` §0, `LARGO_FRONTEND_UX_SPEC` §0, `LARGO_COMPETITIVE_BENCHMARK` §3, `LARGO_GO_TO_MARKET` §3 |
| No live auto-buy in Phase 1 | locked | `LARGO_PRODUCT_VISION` §1, `LARGO_SECURITY_PAYMENTS` philosophy + auto-buy section, `LARGO_BACKEND_API_SPEC` Phase 1 gates, `LARGO_FRONTEND_UX_SPEC` deferred surfaces, `LARGO_GO_TO_MARKET` cohort table |
| No silent auto-buy in Phase 1 | locked | `LARGO_PRODUCT_VISION` §1 (agency before automation), `LARGO_SECURITY_PAYMENTS` (triple-condition gate, explicit consent), `LARGO_ADVICE_CONTRACT` (`can_autobuy` flag), `LARGO_BACKEND_API_SPEC` (no silent fallback to BUY_NOW), `LARGO_FRONTEND_UX_SPEC` (60s anti-dark-pattern confirmation TTL) |
| `LargoAdvice` schema version | `0.1.0` | `LARGO_ADVICE_CONTRACT` §2, declared once and re-anchored in eight downstream documents |
| `AuditBlock` minimal envelope | `audit_id`, `parent_advice_id` only | `LARGO_ADVICE_CONTRACT` §17 |
| `audit_id === advice_id` in Phase 1 | locked | `LARGO_ADVICE_CONTRACT` §17, `LARGO_BACKEND_API_SPEC` idempotency, `LARGO_DATA_STRATEGY` audit chain |
| Customer-safe view stripped server-side | locked | `LARGO_BACKEND_API_SPEC` §1–§2, `LARGO_FRONTEND_UX_SPEC` §1, `LARGO_ADVICE_CONTRACT` §6 (`numeric_value` never customer-facing), `LARGO_PRODUCT_VISION` §3 |
| Numeric confidence internal / admin only | locked | `LARGO_ADVICE_CONTRACT` §3, `LARGO_PRODUCT_VISION` §3, `LARGO_FRONTEND_UX_SPEC` §1, `LARGO_MODEL_STRATEGY` §3 |
| ABSTAIN is first-class | locked | `LARGO_PRODUCT_VISION` §4, `LARGO_ADVICE_CONTRACT` §3, `LARGO_EVALUATION_PLAN` §1.3, `LARGO_MODEL_STRATEGY` §1, `LARGO_FRONTEND_UX_SPEC` §3, `LARGO_BACKEND_API_SPEC` (ABSTAIN as a 200 response) |
| `observed_price_usd` may be `null` | locked | `LARGO_ADVICE_CONTRACT` price section, `LARGO_BACKEND_API_SPEC` nullability rules, `LARGO_FRONTEND_UX_SPEC` failure-state UX |
| `provider.primary_provider` may be `null` | locked | same as above |
| No fake zero price | locked | `LARGO_ADVICE_CONTRACT`, `LARGO_BACKEND_API_SPEC`, `LARGO_FRONTEND_UX_SPEC` (null is not 0) |
| No frontend safety authority | locked | `LARGO_BACKEND_API_SPEC` §1–§2, `LARGO_FRONTEND_UX_SPEC` §1 |
| No LLM in the decision path | locked | `LARGO_MODEL_STRATEGY` (LLM policy), `LARGO_SECURITY_PAYMENTS` (auto-buy gate stack), `LARGO_BACKEND_API_SPEC` (decision authority) |
| No dark patterns | locked | `LARGO_PRODUCT_VISION` §3, `LARGO_FRONTEND_UX_SPEC` §1.3, `LARGO_GO_TO_MARKET` (forbidden GTM patterns), `LARGO_COMPETITIVE_BENCHMARK` (forbidden positioning) |
| Public claims require evidence | locked | `LARGO_EVALUATION_PLAN` §22 (public claims policy), `LARGO_COMPETITIVE_BENCHMARK` §0 (`[to verify]` convention), `LARGO_GO_TO_MARKET` (no claim ahead of evidence) |

These are the rails any B1 ticket must run on.

---

## 6. Phase 1 locked scope

The Phase 1 product is, in one paragraph :

> A decision-support layer for **flights only**, accessible via simple search and via missions, that returns a `LargoAdvice` v0.1.0 payload with one of `BUY_NOW / WAIT / ALERT / MONITOR / ABSTAIN`, with a customer-safe view that never exposes numeric confidence, never coerces null prices to zero, never silently falls back to `BUY_NOW`, and never executes an auto-buy. Auto-buy execution is **architecturally specified** in `LARGO_SECURITY_PAYMENTS` and disabled in production. The methodology page exists from MVP. The public audit page is disabled in Phase 1. Notifications are opt-in. All communication is founder-led. No paid acquisition, no public comparative claim. ECE target on `BUY_NOW` advices is internal-only at `< 0.07` and is not published.

What is **not** in Phase 1, even though specified architecturally :

- Auto-buy execution.
- Hotels, cars, bundles.
- International coverage at meta-search parity.
- Public audit page.
- Public calibration claims.
- Public comparative claims against named competitors.
- Conversational "AI travel agent" experience.

The vocabulary distinction *Phase 1 vs Cohort step* is recorded in Section 19 (ambiguity 1) and resolved in Section 23 (gate 4 : the first B1 sprint scope must explicitly map Phase 1 work to cohort steps `0` and `0→10`).

---

## 7. Product coherence audit

Source : `LARGO_PRODUCT_VISION.md`.

Coherence with the rest of the stack :

- **One-sentence vision** : "Largo is a transparent travel decision agent that helps users decide when to buy, when to wait, and when not to trust the data yet." This sentence is consistent with `LARGO_DOMINATION_STRATEGY` §3 (Travel Fiduciary Agent wedge) and with `LARGO_GO_TO_MARKET` §2 (Travel Decision Agent positioning). Vocabulary alignment between *Fiduciary* and *Decision* is flagged as ambiguity 2 (Section 19) for marketing decision.
- **Three principles** (honesty before conversion, calmness before excitement, agency before automation) propagate cleanly into `LARGO_FRONTEND_UX_SPEC` §1 (no dark patterns, no urgency theatre) and into `LARGO_GO_TO_MARKET` §1 (trust before traffic, honesty as positioning).
- **User promise / non-promise** language is consistent with `LARGO_COMPETITIVE_BENCHMARK` forbidden-claims list and with `LARGO_GO_TO_MARKET` taglines policy.
- **Five emotional states to produce / five to avoid** are operationalized into `LARGO_FRONTEND_UX_SPEC` UX principles and copy guidelines.
- **AdviceCard always renders, including ABSTAIN** : consistent with `LARGO_ADVICE_CONTRACT` (ABSTAIN is a normal action), `LARGO_BACKEND_API_SPEC` (ABSTAIN returns 200), `LARGO_FRONTEND_UX_SPEC` (ABSTAIN state has dedicated copy).
- **Anonymous quota** appears in `LARGO_PRODUCT_VISION` §4 and in `LARGO_BACKEND_API_SPEC` (per-IP, per-fingerprint rate limits) consistently.

Verdict : product layer is coherent with the layers below.

---

## 8. Contract coherence audit

Source : `LARGO_ADVICE_CONTRACT.md`.

Coherence with downstream consumers :

- **`schema_version: '0.1.0'`** is referenced by every downstream document (six explicit references, plus implicit anchor in this audit).
- **`advice_id` is ULID, server-side generated** : `LARGO_BACKEND_API_SPEC` echoes ULID server-side only, never trusts client-provided IDs. Coherent.
- **`numeric_value` persisted but never displayed** : `LARGO_PRODUCT_VISION` §3, `LARGO_FRONTEND_UX_SPEC` §1, `LARGO_BACKEND_API_SPEC` (customer-safe view strips it), `LARGO_MODEL_STRATEGY` §3 all align.
- **`can_autobuy` flat boolean** : referenced in `LARGO_SECURITY_PAYMENTS` triple-condition gate, in `LARGO_BACKEND_API_SPEC` autobuy gating, in `LARGO_EVALUATION_PLAN` safety metrics, in `LARGO_FRONTEND_UX_SPEC` (gating UI surfaces). Coherent.
- **`AuditBlock` minimal envelope** : `LARGO_ADVICE_CONTRACT` §17 is the source. `LARGO_BACKEND_API_SPEC` audit construction matches. `LARGO_DATA_STRATEGY` and `LARGO_SECURITY_PAYMENTS` reference the same minimal shape.
- **`audit_id === advice_id` in Phase 1** : `LARGO_ADVICE_CONTRACT` §17 introduces this, and `LARGO_BACKEND_API_SPEC` idempotency model uses `audit_id` as the natural key consistently.
- **`technical_details` 4 KB cap, never customer-facing** : consistent everywhere.
- **Multi-product contract from day one, runtime flights-only** : `LARGO_BACKEND_API_SPEC` enforces `product_type === 'flight'` at the producer side in Phase 1. Coherent.

Verdict : contract is the spine, and every consumer respects it.

---

## 9. Evaluation coherence audit

Source : `LARGO_EVALUATION_PLAN.md`.

Coherence with the rest of the stack :

- **ECE thresholds** : `< 0.07` Phase 1 internal acceptance, `< 0.05` Phase 2 target. Referenced consistently in `LARGO_MODEL_STRATEGY` (calibration policy), `LARGO_GO_TO_MARKET` (no public calibration claim before threshold met), `LARGO_DOMINATION_STRATEGY` (trust posture).
- **Baseline set frozen for Phase 1** : `LARGO_EVALUATION_PLAN` §17 lists the baselines ; `LARGO_MODEL_STRATEGY` references the same. V7a remains the active baseline ($58.33 mean abs regret on 11,750 trips, shadow validated 2026-04-25).
- **Regret definition** : computable from `LargoAdvice` audit rows alone. The contract carries every field needed.
- **ABSTAIN as first-class outcome with lazy-vs-honest distinction** : `LARGO_PRODUCT_VISION`, `LARGO_FRONTEND_UX_SPEC`, `LARGO_MODEL_STRATEGY`, and `LARGO_BACKEND_API_SPEC` all carry the same definition.
- **Concordance is a diagnostic, not a verdict** : restated in `LARGO_MODEL_STRATEGY` shadow protocol.
- **Public claims policy** : the journalist test is referenced in `LARGO_DOMINATION_STRATEGY` §13, in `LARGO_COMPETITIVE_BENCHMARK` §0, and in `LARGO_GO_TO_MARKET` §1 principle 4. Consistent.

Verdict : evaluation is coherent and the contract carries the data needed to recompute every Phase 1 metric.

---

## 10. Security / payments coherence audit

Source : `LARGO_SECURITY_PAYMENTS.md`.

Coherence with the rest of the stack :

- **Pessimistic by default, opt-in for power** : `LARGO_PRODUCT_VISION` §1 (agency before automation) and `LARGO_GO_TO_MARKET` (auto-buy disabled until cohort gates met) align.
- **Triple-condition auto-buy gate** : (`action == BUY_NOW`) ∧ (`confidence_label ∈ {high, moderate}` per contract mapping rules) ∧ (`can_autobuy == true`) reproduced consistently in `LARGO_ADVICE_CONTRACT` §1.3, `LARGO_BACKEND_API_SPEC` autobuy gating, `LARGO_EVALUATION_PLAN` safety section.
- **Stripe Payment Intent manual capture, signature-verified webhooks** : `LARGO_BACKEND_API_SPEC` echoes, no contradiction.
- **Kill switches** : the env-var names listed in `LARGO_SECURITY_PAYMENTS` are echoed in `LARGO_BACKEND_API_SPEC` kill-switch enforcement section.
- **No live auto-buy in Phase 1** : consistent across every relevant document.
- **No Stripe live keys in Phase 1** : echoed in `LARGO_GO_TO_MARKET` (no live keys before cohort gate satisfied) and re-stated in this audit Section 21.
- **Threat model classes** : the eleven classes drive forbidden-pattern lists in downstream documents. No mitigation appears without a mapped threat.

Verdict : security/payments is coherent ; defense-in-depth posture holds.

---

## 11. Data coherence audit

Source : `LARGO_DATA_STRATEGY.md`.

Coherence with the rest of the stack :

- **Data-as-moat** thesis : echoed in `LARGO_DOMINATION_STRATEGY` (Moat 1), in `LARGO_MODEL_STRATEGY` §1.1 (model is a depreciating asset), in `LARGO_COMPETITIVE_BENCHMARK` (proprietary intent + outcome data is uncopyable).
- **No data without lineage** : `LARGO_MODEL_STRATEGY` §29 forbids model deployment without lineage. Coherent.
- **Missing is information** : `LARGO_ADVICE_CONTRACT` (nullable price and provider), `LARGO_BACKEND_API_SPEC` (never coerce null to 0), `LARGO_FRONTEND_UX_SPEC` (failure-state UX) all align.
- **Existing data assets inventoried, no commitment to keep / modify** : aligned with the broader "do not touch V7a / scripts" boundary repeated across docs.
- **Future proprietary assets begin Day 1 of Phase 2** : aligned with `LARGO_GO_TO_MARKET` cohort table and `LARGO_EVALUATION_PLAN` Phase 2+ metrics.
- **Privacy class labelling** (PII vs pseudonymous) : echoed in `LARGO_SECURITY_PAYMENTS` retention rules.

Verdict : data layer is coherent and is the producer-side spine to the contract's consumer-side spine.

---

## 12. Model coherence audit

Source : `LARGO_MODEL_STRATEGY.md`.

Coherence with the rest of the stack :

- **V7a is the active baseline** : ($58.33 mean abs regret on 11,750 trips, shadow validated 2026-04-25). Echoed in `LARGO_EVALUATION_PLAN` baseline list and in `LARGO_DOMINATION_STRATEGY`.
- **V7.6 Ultra is research-asset only** : echoed in `LARGO_DATA_STRATEGY` (working artefacts inventoried, not Largo training inputs), and `LARGO_GO_TO_MARKET` does not reference it for marketing.
- **Calibration is the price of confidence** : `LARGO_PRODUCT_VISION` §1, `LARGO_EVALUATION_PLAN` §1, `LARGO_FRONTEND_UX_SPEC` §1 all align.
- **ABSTAIN as feature, not bug** : echoed everywhere relevant.
- **No LLM in decision path** : restated in `LARGO_SECURITY_PAYMENTS`, `LARGO_BACKEND_API_SPEC`, `LARGO_GO_TO_MARKET` (forbidden GTM pattern : no « powered by GPT » framing).
- **Promotion gates** (named baseline, named metric, calibration measured, lineage declared) : echoed in `LARGO_EVALUATION_PLAN` §17 and `LARGO_DATA_STRATEGY` §29.
- **Smallest model that beats the next baseline** : echoed in `LARGO_EVALUATION_PLAN` (no architecture promotion without measurable gain).

Verdict : model layer is coherent ; the *restraint over complexity* posture is uniform across the stack.

---

## 13. Backend coherence audit

Source : `LARGO_BACKEND_API_SPEC.md`.

Coherence with the rest of the stack :

- **Server is the authority, frontend is untrusted, ML is semi-trusted** : echoed in `LARGO_FRONTEND_UX_SPEC` §1 (renderer not decider) and in `LARGO_MODEL_STRATEGY` §3 (model is an advisor, not the decider).
- **Endpoint surface (`/api/largo/*`)** : the Phase 1 endpoint list is consistent with the surfaces declared in `LARGO_FRONTEND_UX_SPEC` and the missions / advices / payments / webhooks split is consistent with `LARGO_SECURITY_PAYMENTS` payment lifecycle.
- **Idempotency keyed to `audit_id`** : matches `LARGO_ADVICE_CONTRACT` §17 (`audit_id === advice_id` Phase 1).
- **ULID server-side only, never client-provided** : matches `LARGO_ADVICE_CONTRACT` §5.1.
- **ABSTAIN returns 200** : matches `LARGO_FRONTEND_UX_SPEC` (ABSTAIN is a state, not an error) and `LARGO_PRODUCT_VISION` §3.
- **Eleven stable error codes** : consistent vocabulary with `LARGO_FRONTEND_UX_SPEC` failure-state UX.
- **Latency budgets** (mission advice ≤ 800 ms, simple search ≤ 1.2 s, autobuy gating ≤ 300 ms p95) : consistent with `LARGO_MODEL_STRATEGY` inference architecture latency envelope.
- **Eight kill switches** : matches `LARGO_SECURITY_PAYMENTS` kill-switch policy.
- **Eight future Supabase tables** (`largo_advices`, `largo_advice_events`, `largo_mission_events`, `largo_payment_attempts`, `largo_autobuy_audit`, `largo_provider_observations`, `largo_model_runs`, `largo_evaluation_snapshots`) : consistent with `LARGO_DATA_STRATEGY` data assets and `LARGO_EVALUATION_PLAN` reporting locations.

Verdict : backend layer is coherent and respects the contract authority.

---

## 14. Frontend coherence audit

Source : `LARGO_FRONTEND_UX_SPEC.md`.

Coherence with the rest of the stack :

- **Renderer not decider** : matches `LARGO_BACKEND_API_SPEC` §1.
- **Customer-safe view stripped server-side** : matches the contract's `numeric_value` discipline and the backend's customer-safe-view contract.
- **AdviceCard always renders, including ABSTAIN, including provider disagreement, including null price** : matches `LARGO_PRODUCT_VISION` §4 and `LARGO_ADVICE_CONTRACT` mapping rules.
- **No "BUY_NOW" with limited confidence** : matches `LARGO_ADVICE_CONTRACT` §3 mapping rule (`BUY_NOW` may only ship with `confidence_label ∈ {high, moderate}`).
- **No emoji on safety / decision surfaces** : matches `LARGO_GO_TO_MARKET` forbidden GTM patterns.
- **WCAG 2.2 AA floor** : not contradicted elsewhere.
- **60 s anti-dark-pattern auto-buy confirmation TTL** : matches `LARGO_SECURITY_PAYMENTS` (explicit consent) and `LARGO_PRODUCT_VISION` §1 (agency before automation).
- **Methodology page from MVP** : matches `LARGO_GO_TO_MARKET` §15 (trust before traffic).
- **Public audit page Phase 2+** : matches `LARGO_GO_TO_MARKET` (only when populated) and `LARGO_EVALUATION_PLAN` (publication conditions).

Verdict : frontend layer is coherent ; the renderer-not-decider posture is uniform.

---

## 15. Competitive benchmark coherence audit

Source : `LARGO_COMPETITIVE_BENCHMARK.md`.

Coherence with the rest of the stack :

- **`[to verify]` markers on any unverified factual claim** : matches the journalist test in `LARGO_EVALUATION_PLAN` §1.5 and the public-claims discipline in `LARGO_GO_TO_MARKET` §1 principle 4.
- **What Largo is not competing on first** : aligned with `LARGO_DOMINATION_STRATEGY` §2 (asymmetries) and `LARGO_GO_TO_MARKET` (anti-ICP segments).
- **What Largo competes on first** (mission decisioning, transparency, ABSTAIN, auditability) : aligned with `LARGO_PRODUCT_VISION` and `LARGO_GO_TO_MARKET` wedges.
- **Forbidden positioning** ("Better than Hopper", "Cheapest", "Guaranteed savings", "Powered by GPT") : matches `LARGO_PRODUCT_VISION` non-promise list and `LARGO_GO_TO_MARKET` forbidden taglines.
- **Mystery shopping plan** to validate `[to verify]` markers : referenced in `LARGO_GO_TO_MARKET` § (waitlist / beta strategy) as a B1+ activity.
- **Phase 1 = no public comparative claim** : echoed everywhere relevant.

Verdict : benchmark is coherent and disciplined ; the `[to verify]` posture is preserved.

---

## 16. Go-to-market coherence audit

Source : `LARGO_GO_TO_MARKET.md`.

Coherence with the rest of the stack :

- **Trust before traffic** : matches the methodology-page-from-MVP rule in `LARGO_FRONTEND_UX_SPEC`.
- **Cohort discipline (0 → 10 → 100 → 1000 → GA)** : provides the externally-visible scale ladder. The technical documents speak of *Phase 1 / 2 / 3*. Mapping is recorded in Section 19 ambiguity 1.
- **Honesty as positioning** : matches `LARGO_PRODUCT_VISION` honesty principle and `LARGO_COMPETITIVE_BENCHMARK` no-comparative-claim posture.
- **No paid acquisition Phase 1** : matches `LARGO_EVALUATION_PLAN` (claims gated by evidence).
- **Founder-led until Phase 2** : matches `LARGO_PRODUCT_VISION` (one founder voice, traceable accountability).
- **Pricing Phase 1 = $0** : matches `LARGO_PRODUCT_VISION` (no monetization without proven decision quality).
- **Mission pricing refundable on ABSTAIN** : matches the ABSTAIN-first-class anchor.
- **Auto-buy success-fee only (Phase 3+)** : matches `LARGO_SECURITY_PAYMENTS` (no perverse incentive).
- **Public audit page Phase 2+** : matches `LARGO_FRONTEND_UX_SPEC` deferred surfaces.
- **B0 → B1 transition rule** : Section 46 of GO_TO_MARKET states V7a continuity is preserved and B1 wraps V7a under decision policy. Matches Section 24 of this audit.

Verdict : GTM is coherent with the technical and product specs ; cohort discipline is consistent with the readiness gates of B1.

---

## 17. Cross-document consistency matrix

Twelve cross-cutting concerns × eleven documents.

Legend : **OK** = mentioned consistently with rest of stack ; **tension** = mentioned but with minor vocabulary drift, no semantic conflict ; **missing** = not mentioned (intentionally or inadvertently) ; **n/a** = not applicable to this document's authority.

| Concern \ Doc | strategy | product | contract | evaluation | security | data | model | backend | frontend | benchmark | GTM |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **ABSTAIN** | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| **auto-buy** | OK | OK | OK | OK | OK | n/a | OK | OK | OK | OK | OK |
| **confidence** | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| **audit** | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| **pricing/savings claims** | OK | OK | n/a | OK | n/a | n/a | n/a | n/a | OK | OK | OK |
| **customer-safe view** | n/a | OK | OK | n/a | OK | OK | OK | OK | OK | n/a | n/a |
| **data moat** | OK | n/a | n/a | n/a | n/a | OK | OK | n/a | n/a | OK | OK |
| **model promotion** | n/a | n/a | n/a | OK | n/a | OK | OK | OK | n/a | n/a | n/a |
| **provider failure** | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | n/a |
| **null price** | n/a | OK | OK | OK | OK | OK | OK | OK | OK | n/a | n/a |
| **no dark patterns** | OK | OK | n/a | n/a | OK | n/a | n/a | OK | OK | OK | OK |
| **public benchmark claims** | OK | OK | n/a | OK | n/a | OK | OK | n/a | n/a | OK | OK |

No **tension** or **missing** at the blocking level. Where a cell is marked `n/a`, the concern is not the authority of that document and absence is not a coherence defect.

---

## 18. Contradictions found

Direct contradictions (one document forbids what another mandates).

| severity | documents involved | issue | impact | recommended resolution |
|---|---|---|---|---|

**No blocking contradiction found.**

The audit looked specifically for : (a) anchor inversions (e.g., one doc says ABSTAIN is an error, another says it is a state), (b) authority inversions (e.g., one doc lets the frontend decide `can_autobuy`, another forbids it), (c) Phase-gate inversions (e.g., one doc enables auto-buy in Phase 1, another forbids it), (d) numeric-value disclosure inversions (e.g., one doc displays it in customer UI, another forbids it). None was found.

---

## 19. Ambiguities found

Soft inconsistencies — not contradictions, but decisions B1 must make explicit.

| priority | ambiguity | documents involved | why it matters | recommended B1 decision owner |
|---|---|---|---|---|
| high | *Phase 1 / Phase 2 / Phase 3* (technical docs) versus *Cohort 0 / 0→10 / 10→100 / 100→1000 / GA* (GTM) — mapping is implied but never written explicitly | `LARGO_GO_TO_MARKET` vs all technical docs | B1 sprint planning needs to know which cohort step a Phase 1 deliverable serves | founder + product, before first B1 sprint |
| high | "Travel Fiduciary Agent" (working category label, `LARGO_DOMINATION_STRATEGY`, `LARGO_PRODUCT_VISION`) versus "Travel Decision Agent" (`LARGO_GO_TO_MARKET` positioning sentence) | strategy, product, GTM | Public copy must pick one ; legal/trademark check pending | founder + marketing ; legal review |
| medium | `ml_available: false` is observed in V7a shadow but the contract permits the field to be `true | false` ; the gating semantics (when ABSTAIN is forced solely by `ml_available == false`) are not exhaustively pinned | `LARGO_ADVICE_CONTRACT`, `LARGO_MODEL_STRATEGY`, `LARGO_BACKEND_API_SPEC` | B1 must specify the producer behaviour when ML is unavailable | ML lead + backend lead |
| medium | `confidence: NULL` in V7a shadow versus `confidence_label` always set on `LargoAdvice` ; producer mapping from V7a numeric to `LargoAdvice` semantic label is sketched but not finalized | `LARGO_ADVICE_CONTRACT`, `LARGO_MODEL_STRATEGY` | Without an explicit mapping rule, the contract producer can ship inconsistent labels | ML lead + backend lead |
| medium | "K-anonymity ≥ 5 for cohort exposure" is mentioned in `LARGO_DATA_STRATEGY` privacy section but operational details (threshold computation, fallback when n < 5) are not fully specified | data, evaluation, GTM | Public audit page Phase 2+ depends on it ; cohort step 100→1000 requires it operational | data lead + privacy reviewer |
| medium | "Customer-safe view" is described as "stripped server-side" but the exact field-by-field stripping rule is enumerated in `LARGO_BACKEND_API_SPEC` and re-described in `LARGO_FRONTEND_UX_SPEC` ; the two enumerations should be reconciled into one canonical list before any rendering work | backend, frontend, contract | Risk of drift if field added to contract and only one document is updated | backend lead, owns the canonical list |
| low | Vocabulary drift on "auto-buy" / "auto-purchase" / "autobuy" across documents (no semantic difference, only style) | all | Cosmetic | a B1 housekeeping pass |
| low | "Methodology page" content draft is referenced from multiple documents but its content has not yet been drafted | product, frontend, GTM, evaluation | Page exists from MVP per `LARGO_FRONTEND_UX_SPEC` and `LARGO_GO_TO_MARKET` ; content draft is a B1 deliverable | product + founder writing |
| low | "No LLM in decision path" is unambiguous, but "LLM allowed for marketing copy support" is implied negatively rather than positively. A short positive carve-out would close the loop. | model, GTM | Avoids the ambiguity that an internal copywriter using an LLM is "violating" a forbidden pattern | model lead, GTM lead |
| low | The "11 critical UI states" of `LARGO_FRONTEND_UX_SPEC` and the "11 stable error codes" of `LARGO_BACKEND_API_SPEC` are different lists, but the matching from one to the other is implicit | backend, frontend | First B1 frontend ticket should produce the explicit mapping table | backend lead + frontend lead |
| low | "Founder-led until Phase 2" is a posture, but the exact handoff criteria (what triggers the move from `founder@` to `team@`) is not pinned | GTM | Cosmetic until Phase 2 approaches | GTM lead |

None of these is blocking. They are the natural surface where B0 ends and B1 begins.

---

## 20. Open decisions carried into B1

Decisions that B0 deliberately does not make and that B1 must make. These are not ambiguities (no document contradicts another) ; they are explicit deferrals.

1. **Routing topology** : exact `app/api/largo/...` route structure (Next.js App Router or other) — out of B0 scope by `LARGO_BACKEND_API_SPEC` §0.
2. **Supabase migration sequencing** : the eight tables specified in `LARGO_BACKEND_API_SPEC` are listed but their first-migration ordering is a B1 decision.
3. **Provider chain order in Phase 1** : the priority of RapidAPI providers under fallback is a B1 operational decision.
4. **Calibration cron cadence** : daily / weekly / per-mission — B1 decision once shadow data is reviewed.
5. **Public audit page schema** : the aggregation grain (route, week, cohort) — Phase 2+ decision, B1 should keep the door open without pinning.
6. **First production cohort allowlist** : which routes are open in cohort step `0→10` — founder + ops decision, B1 timing.
7. **Stripe sandbox configuration** : test-key environment policy and key rotation cadence — B1 operational.
8. **Notification copy library** : the per-state strings for the dozen Phase 1 transitions — B1 product writing, traceable to `LARGO_FRONTEND_UX_SPEC` sample copy.
9. **Methodology page draft** : long-form trust copy — B1 deliverable, founder writing.
10. **Repo hygiene scope** : which legacy `scripts/*`, `.env.local.bak.*`, `reports/`, `logs/` artefacts are kept and which are quarantined — B1 prerequisite per Section 29 of this audit.

These ten items are the natural first agenda of `B1_IMPLEMENTATION_PLAN.md`.

---

## 21. Hard rules consolidated

The most important rules in B0, consolidated. Any B1 ticket that conflicts with one of these rules is rejected at review.

1. **No code before B1 plan.** No file outside `docs/` may be modified until `B1_IMPLEMENTATION_PLAN.md` exists, is reviewed, and is signed off.
2. **No V7a touch during B0 closure.** V7a remains in shadow as validated 2026-04-25.
3. **No watcher / Modal / cron touch.** Existing infrastructure stays untouched until B1 plan authorizes.
4. **No migration without explicit migration plan.** The eight Supabase tables specified in `LARGO_BACKEND_API_SPEC` may not be created until the migration plan is approved.
5. **No endpoint without backend spec-derived implementation ticket.** Each endpoint cites the exact section of `LARGO_BACKEND_API_SPEC` it implements.
6. **No frontend component without customer-safe view contract.** Each component cites the exact section of the contract and of `LARGO_FRONTEND_UX_SPEC` it renders.
7. **No customer UI numeric confidence.** `numeric_value` never reaches the customer surface. Internal/admin only.
8. **No `technical_details` in customer UI.** Internal/admin only.
9. **No fake zero price.** `null` is rendered as a proper failure state, never as `$0`.
10. **No silent fallback to BUY_NOW.** Failure returns ABSTAIN with reason or a 503 with a stable error code.
11. **No live auto-buy in Phase 1.** Architecture only.
12. **No silent auto-buy in Phase 1.** Triple-condition gate + explicit consent + 60 s confirmation TTL.
13. **No Stripe live key usage in Phase 1.** Sandbox only ; live keys gated to a later cohort step.
14. **No model promotion without named baseline + named metric + lineage + calibration.**
15. **No model trained on data without lineage.**
16. **No public claim before benchmark evidence.** Every claim cites a measurement.
17. **No dark patterns.** No fake scarcity, no fake urgency, no hidden cancel, no pre-checked auto-buy, no manipulated cancel/keep cognitive load.
18. **No `git add .` and no broad staging by the assistant.** Files are staged by name.
19. **No `.env*` commit.** Period.
20. **No LLM in decision path.** LLM is forbidden anywhere on the path that decides whether a customer-visible action is taken.
21. **No customer-facing "AI" theatre.** Calibrated decisions, plain language, no marketing of magic.
22. **No emoji on safety / decision surfaces.**
23. **No claim "better than X" without segment + metric + reproducible methodology.**
24. **ABSTAIN is a 200 response, never a 4xx, never a 5xx.**
25. **`audit_id === advice_id` in Phase 1.** The contract spine is preserved.

These rules survive verbatim into B1.

---

## 22. Forbidden patterns consolidated

Across the eleven B0 documents, forbidden patterns fall into seven families. The full per-document lists remain authoritative ; this is the synthesis.

1. **Decision-authority violations.** Frontend deciding price / confidence / `can_autobuy`. ML output triggering payment without the gate stack. Audit row written by anyone other than the backend audit writer.
2. **Disclosure violations.** Numeric confidence in customer UI. `technical_details` in customer UI. `audit_id` in customer UI. PII inside the audit payload (IP, UA, fingerprint belong in request logs, not in audit). Stripe full PAN anywhere — only tokenized references.
3. **Data integrity violations.** Coercing `null` price to `0`. Silent imputation of missing values. Random-split scoring used for promotion. Reusing `advice_id` across two distinct decisions. Mutating an audit row after write.
4. **Safety violations.** Live auto-buy in Phase 1. Silent auto-buy in any phase. Stripe live keys in Phase 1. Model promotion without calibration. Endpoint shipping without rate limit. Webhook handler not signature-verified.
5. **UX dark patterns.** Fake scarcity, fake urgency, hidden cancel, pre-checked upsell, asymmetric prominence between confirm and cancel, daily "still watching" spam, manipulation of cognitive load on cancel/keep.
6. **GTM dishonesty.** Public claim ahead of evidence. Fake testimonials. Vanity metrics presented as proof. Cross-product comparison without shared methodology. "Powered by GPT" framing. Founder-signed copy authored by an LLM without disclosure.
7. **Process violations.** `git add .` by the assistant. Touching `.env*`. Modifying legacy scripts outside scope. Creating a migration without a migration plan. Implementing an endpoint without a backend ticket. Implementing a payment branch without a payment ticket. Implementing auto-buy without the cohort gate.

Every B1 implementation pull request must affirmatively pass through this list.

---

## 23. B1 readiness gates

Gates that must be all green before B1 implementation may begin.

| gate | description | status as of this audit |
|---|---|---|
| 1 | B0 closure audit completed | this document — green when committed |
| 2 | V7a observation status checked (shadow loop healthy, no regression vs 2026-04-25 baseline) | externally maintained ; founder verifies before B1 |
| 3 | Repo hygiene plan decided (legacy `scripts/*`, `.env.local.bak.*`, `reports/`, `logs/` either kept, quarantined, or scheduled for removal under their own ticket) | open — Section 29 ; pre-B1 prerequisite |
| 4 | First B1 scope selected (one of the candidates in Section 26, with an explicit Phase-to-Cohort mapping) | open — choose in B1 planning session |
| 5 | Implementation branch strategy decided (e.g., `b1/<scope>` branches, no direct commits to `main` for code work) | open — founder decision |
| 6 | Supabase migration policy decided (single migration per ticket, named, reviewed, no production migration without approval) | open — founder + data lead |
| 7 | Vercel environment policy confirmed (preview vs production, env-var separation per `LARGO_SECURITY_PAYMENTS`) | open — ops decision |
| 8 | Stripe live keys prohibited until later phase (cohort step 100→1000 minimum, conditional on auto-buy gate readiness) | confirmed by anchor lock ; restated here |
| 9 | Claude / AI coding rules accepted (Section 28) | open — founder accepts at B1 kickoff |

Until all nine gates are green, B1 implementation may not start. A failing gate is grounds to pause, not to override.

---

## 24. What B1 may implement first

The candidates below are *candidates*. None of them is authorized by this audit. They are listed so that the next session can choose, not so that they happen.

**Backlog of candidate B1 first-sprint tickets.**

| candidate | why useful | risk | dependency | recommended order |
|---|---|---|---|---|
| Create customer-safe advice view type (TypeScript) | Pins the field-by-field stripping rule into one canonical type; closes ambiguity 6 from §19 | Type drift if not synchronized with the contract; mitigated by single source-of-truth file | `LARGO_ADVICE_CONTRACT` v0.1.0, `LARGO_BACKEND_API_SPEC` customer-safe section | 1 |
| Create backend schema validation plan (no code) | Ensures every `LargoAdvice` payload is re-validated server-side; defines the validator library choice | Validator library choice may force tradeoffs; deferred design | `LARGO_BACKEND_API_SPEC` validation section | 2 |
| Create LargoAdvice fixture examples (JSON / TS test fixtures only, no producer) | Anchor for downstream tests, copy review, frontend mocks | Fixtures becoming stale; mitigated by lint check against contract | `LARGO_ADVICE_CONTRACT` v0.1.0 | 3 |
| Design (only) a no-op `/api/largo/advice` (no code), with input schema, output schema, error codes | Sharpens the implementation ticket without shipping a route | Premature design lock; mitigated by review checkpoint | candidates 1 + 2 | 4 |
| Design (only) the `AdviceCard` mock spec (no React), with state matrix and copy | Sharpens the implementation ticket without shipping a component | Same as 4 | `LARGO_FRONTEND_UX_SPEC` | 5 |
| Draft the methodology page content (Markdown text only, not yet a route) | Required artifact from MVP per `LARGO_FRONTEND_UX_SPEC` and `LARGO_GO_TO_MARKET` | Tone drift; mitigated by founder writing | `LARGO_PRODUCT_VISION`, `LARGO_DOMINATION_STRATEGY` | 6 |
| Draft the waitlist / landing copy (Markdown text only) | Required artifact before any traffic per `LARGO_GO_TO_MARKET` § (waitlist questions, landing sections) | Premature commitment; mitigated by "draft" status | `LARGO_GO_TO_MARKET` | 7 |
| Author repo hygiene plan (separate doc) | Section 29 prerequisite | Risk of touching legacy by mistake; mitigated by explicit allow-list | this audit Section 29 | 8 |

The recommended ordering is documentation-and-types first, design-only second, drafted copy third. **No production code in the first B1 sprint.**

---

## 25. What B1 must not implement yet

The list below is non-exhaustive and inherits from §22. Restated here for B1 ticket review.

- **Live auto-buy.** Architecture only ; no Stripe capture in Phase 1.
- **Stripe capture.** No production capture path until cohort gates 100→1000 minimum and auto-buy gate stack readiness verified.
- **Provider booking.** No booking handoff that converts to a real ticket in Phase 1 ; user click-out remains the path.
- **Model training (any new training run).** B1 first sprint does not retrain V7a, does not train a new Largo model, does not touch V7.6 Ultra artefacts.
- **V7.6 resurrection.** V7.6 Ultra remains a research asset. Not a Phase 1 model.
- **Supabase migrations without plan.** Each migration requires its own ticket and review.
- **Public benchmark claims.** Phase 1 = no public comparative claims, even if true, until `[to verify]` markers are validated by mystery shopping per `LARGO_COMPETITIVE_BENCHMARK`.
- **Paid ad scaling.** Phase 1 = founder-led organic only.
- **Broad public launch.** Cohort discipline trumps any "big launch" temptation.
- **Silent execution.** Of any kind. Especially not auto-buy ; especially not background charges.
- **LLM decisioning.** No LLM on the decision path, ever.
- **Removing V7a.** V7a stays as the active baseline until a successor beats it on the named primary metric per `LARGO_MODEL_STRATEGY` promotion gates.
- **Live keys.** No `.env*` commit. No live Stripe key in Phase 1 environments. No production secret in repo.
- **Components without contract citation.** Every B1 component cites its source-of-truth section.
- **Endpoints without ticket citation.** Every B1 endpoint cites its source-of-truth section.

---

## 26. First sprint recommendation

This audit recommends, but does not authorize, the following first-sprint shape for B1, contingent on Section 23 gates being green :

1. **Open `B1_IMPLEMENTATION_PLAN.md`** as a separate document (not in this session).
2. **Author the repo hygiene plan** as a B1 prerequisite ticket. The working tree contains legacy `scripts/*`, `.env.local.bak.*`, `reports/`, `logs/` that B0 left untouched ; B1 must decide their fate per ticket, not en masse.
3. **Pick one candidate from Section 24, table column "candidate"**, ideally the customer-safe advice view type (no code yet — only a `.ts` or `.md` design file outside `docs/b0/`).
4. **Map the chosen candidate to a Cohort step** (most likely cohort step `0` or `0→10`) per ambiguity 1 of §19.
5. **Cite the exact sections of the relevant B0 documents** that the candidate implements.
6. **Stop at the design boundary.** No production code, no migration, no deployment in the first sprint.

The first sprint is a **discipline-installation sprint**, not a feature sprint.

---

## 27. Risk register for B1

Top risks B1 must monitor. Each risk has at least one mitigation traceable to a B0 document.

| risk | likelihood | impact | mitigation source |
|---|---|---|---|
| Premature production deployment of an endpoint without rate limit | medium | high | `LARGO_BACKEND_API_SPEC` rate-limit section ; readiness gate 1 + 6 + 7 |
| Frontend component leaking `numeric_value` to customer surface | medium | high | `LARGO_FRONTEND_UX_SPEC` §1, `LARGO_BACKEND_API_SPEC` customer-safe view ; first sprint candidate 1 |
| Migration shipped without ticket, mutating a future audit table | low | catastrophic | readiness gate 6 |
| `.env*` accidentally committed | low | catastrophic | hard rule §21 item 19 ; pre-commit hook strongly recommended |
| Auto-buy code path created "just to test" without gate stack | low | catastrophic | hard rule §21 items 11, 12 ; cohort discipline §23 |
| Public claim shipped on landing copy ahead of evidence | medium | medium-high | `LARGO_GO_TO_MARKET` §1 principle 4 ; `LARGO_COMPETITIVE_BENCHMARK` §0 ; first sprint candidate 7 (drafts only) |
| V7a accidentally modified during repo hygiene | medium | high | hard rule §21 item 2 ; explicit allow-list per repo hygiene plan |
| Schema drift between `LargoAdvice` contract and producer code | medium | high | first sprint candidate 1 + 3 ; lint check against contract |
| LLM-generated copy passing as founder voice | medium | medium | hard rule §21 item 21 ; ambiguity 9 of §19 |
| Branch strategy ambiguity leading to direct commits to `main` | medium | medium | readiness gate 5 |
| Stripe sandbox / live key cross-contamination | low | catastrophic | hard rule §21 item 13 ; `LARGO_SECURITY_PAYMENTS` env separation |
| Frontend component built before its customer-safe view contract | medium | medium | hard rule §21 item 6 ; first sprint candidate 1 before candidate 5 |
| Forgetting to map Phase 1 → Cohort step in B1 ticket | high | low | ambiguity 1 of §19 ; readiness gate 4 |
| Drift in vocabulary "auto-buy / autobuy / auto-purchase" | high | low | ambiguity 7 of §19 ; B1 housekeeping pass |
| Re-opening B0 frozen anchors mid-B1 | medium | high | this audit ; require B0 amendment session, not casual edit |

Risks not listed remain inheritable from per-document lists in the eleven B0 documents.

---

## 28. Claude / AI coding discipline for B1

How Claude Code (or any AI coding assistant) is to be used from B1 onward. These rules are binding on every B1 session.

1. **Always one file or one bounded task at a time.** No "while we are at it" sweeps.
2. **Always inspect before edit.** Read the file ; understand the function ; then propose a diff.
3. **Always show the diff before commit.** Never auto-commit a code change without the user's explicit go.
4. **Never auto-stage all files.** No `git add .` ; no `git add -A`. Stage by name.
5. **Never touch `.env*`.** Period. If a secret is needed, it is added by the user, out of the repo.
6. **Never modify legacy ML scripts** (`scripts/cloud/v76_ultra/*`, `scripts/train/*`, `scripts/train/v7a/*`) unless the session prompt explicitly scopes the modification. Otherwise hands off.
7. **Never create migrations** (Supabase or otherwise) without an explicit migration prompt that authorizes a single, named migration with a reviewed schema.
8. **Never implement payment code** without a payment-scoped prompt that names `LARGO_SECURITY_PAYMENTS` sections being implemented, and never with live keys.
9. **Never implement auto-buy** without the readiness gate stack and an auto-buy-scoped prompt.
10. **Stop on ambiguity.** If the prompt is unclear, ask. Do not invent the missing decision.
11. **Ask for validation before code.** Especially for any ticket that crosses a trust boundary (frontend → backend, ML output → decision path, request → audit).
12. **Every implementation must cite which B0 document section it implements.** A pull request without a B0 citation is rejected.
13. **No `git push` from the assistant** by default. Push is a user action.
14. **No `git rebase -i`, no `git push --force` to `main`.** Period.
15. **No silent removal of TODOs, FIXMEs, or comments** that existed in the inspected file unless explicitly scoped.
16. **No "improvements" outside the ticket.** Even if the assistant sees a better way, it stays in scope unless invited.
17. **Convergence mode by default** : diff before execution, format respected mot pour mot, parallel findings noted but not opened, git operations controlled by the user.

These rules are not preferences. They are the operating contract of the assistant in B1.

---

## 29. Repository hygiene warning

The working tree may contain legacy artefacts from earlier phases :

- `scripts/*` ML training and ingestion files (V7a is in scope as the active baseline ; V7.6 Ultra files are research-only ; ingestion scripts are inventoried in `LARGO_DATA_STRATEGY` §3.1 with no Phase 1 commitment).
- `.env.local.bak.*` backup environment files.
- `reports/` historical evaluation outputs.
- `logs/` historical run logs.
- `.tmp-bts-db1b/`, `.tmp-bts-t100/` working ingestion directories.

This audit does **not** clean any of them. It does **not** stage any of them. It does **not** propose a one-shot cleanup.

The repo hygiene plan is a **B1 prerequisite ticket** (Section 23 gate 3, Section 24 candidate 8). It must be authored before any B1 sprint begins, and it must :

- enumerate each legacy artefact category with its current file paths (or globs),
- propose a per-category disposition (keep / quarantine / remove / move out of repo),
- mark explicitly any artefact whose disposition the V7a shadow loop depends on,
- be reviewed by the founder before any rm or git mv touches the working tree,
- explicitly forbid `git add .` during cleanup,
- be a separate commit per category, never a mass cleanup commit.

Until that plan exists, the working tree noise is **outside scope** and to be ignored. Do not stage. Do not move. Do not delete.

---

## 30. Final B0 closure verdict

**Verdict : A — B0 closed, ready for B1 planning.**

The eleven B0 documents form a coherent specification stack. No blocking contradiction was found. The ambiguities listed in §19 are real but not blocking ; they are the natural surface where B0 ends and B1 begins, and each has a recommended decision owner.

**Reservation** : B1 implementation **must not** start without :

1. A separately-authored `B1_IMPLEMENTATION_PLAN.md` document, in its own session, with its own scope.
2. The nine readiness gates of Section 23 all green.
3. The Claude / AI coding discipline of Section 28 explicitly accepted at B1 kickoff.
4. The repo hygiene plan of Section 29 authored as a B1 prerequisite.

If any of those four items is open at B1 kickoff, B1 implementation is paused until they close. A green light here is **not** a green light to implement ; it is a green light to **plan implementation**.

V7a remains the active baseline, in shadow, untouched.
V7.6 Ultra remains a research asset, untouched.
The frozen-for-B0 anchors of Section 5 remain frozen until a B0 amendment session re-opens them.

**B0 documentary phase is closed here. The next document in this project line is `B1_IMPLEMENTATION_PLAN.md`, in a separate session.**

---

## 31. Document status

| field | value |
|---|---|
| Document type | B0 closure audit |
| Phase | B0 documentary, closing artefact |
| Version | 0.1.0 |
| Status | Draft, closing |
| Frozen anchors | per Section 5 |
| Open ambiguities | per Section 19, ten items |
| Open decisions | per Section 20, ten items |
| Verdict | A — B0 closed, ready for B1 planning, contingent on Section 23 gates |
| Predecessors | the eleven B0 documents listed in Section 2 |
| Successor | `B1_IMPLEMENTATION_PLAN.md` (separate session, not opened here) |
| Forbidden in this document | code, migrations, endpoints, components, V7a touch, deployment, model runs, training runs, commits and pushes by the assistant, `.env*` modification, broad git staging, modification of any file outside `docs/b0/B0_CLOSURE_AUDIT.md` |
| Author | Flyeas team (assistant-supported, founder-validated) |
| Last updated | 2026-04-27 |

B0 closes here.
