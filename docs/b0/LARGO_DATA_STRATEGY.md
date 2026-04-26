# Largo — Data Strategy

> **Status:** B0 (pre-implementation framing). Data strategy specification before any new ingestion, training run, migration or endpoint.
> **Audience:** founder, ML/data, security, product, ops, future hires, future external data partners, future ML/data reviewers.
> **Author:** Flyeas team.
> **Coherence:** depends on `LARGO_DOMINATION_STRATEGY.md`, `LARGO_PRODUCT_VISION.md`, `LARGO_ADVICE_CONTRACT.md` (v0.1.0), `LARGO_EVALUATION_PLAN.md`, `LARGO_SECURITY_PAYMENTS.md`.

---

## 0. Document scope and non-scope

**In scope (B0 documentary):**
- The data philosophy and moat thesis.
- Inventory of existing data assets vs. future proprietary assets.
- Data contracts by source (schema, freshness, nullability, units).
- Ingestion policy, dedup, schema evolution, units, FX, freshness SLAs.
- Quality gates, missing-data policy, outlier policy, synthetic data policy.
- Label policy and regret-label construction.
- Train/val/test split policy and leakage prevention.
- Dataset versioning, lineage, retention.
- Privacy, PII handling, consent for data reuse.
- Data feedback loop and drift detection.
- Data health metrics and forbidden data patterns.
- Phase 1/2/3 rollout gates.
- Open questions explicitly listed.

**Out of scope (B0):**
- Any code change to existing ingestion scripts (`scripts/ingest/*`, `scripts/train/*`, V7a code).
- Any new ingestion run, training run, migration, endpoint, or deployment.
- Any commitment to a paid third-party data feed.
- Any public claim about dataset size or coverage (those are reserved for `LARGO_COMPETITIVE_BENCHMARK.md`).
- Any change to `LargoAdvice` contract v0.1.0 (the contract is the consumer-side spine; this document is the producer-side spine).

This document is the **data spine**. Implementation in B1+ will pin specific tables, ETL jobs, and snapshot IDs against this spine.

---

## 1. Data philosophy

Five principles that override speed, convenience, and "we already have a script for that."

1. **Data is the moat, model is a depreciating asset.** Models can be retrained, copied, even leaked. The user-decision data Largo accumulates over time is uncopyable. Strategy must protect data lineage with the same discipline as payments.
2. **Raw data is a liability; contracted data is an asset.** A pile of CSVs without a contract is technical debt. A typed, validated, lineage-tracked dataset is leverage. We pay the cost of contracting at ingestion, not at consumption.
3. **No data without lineage.** Every feature in any model must trace back to a source row, a source file, an ingestion run, and a contract version. No anonymous values, ever.
4. **User data is borrowed, never owned.** Consent is the perimeter. Reuse beyond stated purpose requires fresh consent. Aggregation does not erase consent boundaries when the population is small.
5. **Missing is information.** A `null` carries meaning (price unavailable, provider didn't respond, route unknown). Silent imputation destroys signal and creates calibration debt that surfaces later in model overconfidence.

These principles dominate ranking metrics, feature counts, and model leaderboards if they conflict.

---

## 2. Data moat thesis

### 2.1 Why model alone won't win
Off-the-shelf models on public price datasets (BTS DB1B, Kaggle airlines pricing, etc.) are now commodity. A team of 3 with a GPU and a notebook can match a vanilla XGBoost on those sets. The wedge is not the model; it is the **data the model sees**.

### 2.2 What the Largo moat looks like
The moat is the **decision-paired dataset**: every advice Largo generates is paired with:
- the user's stated intent (mission, ceiling, dates),
- the observed price at decision time,
- the provider response landscape (cross-check disagreement included, not averaged away),
- the action recommended (BUY_NOW, WAIT, ABSTAIN, …),
- the user's actual choice,
- the realized price after the decision window,
- the realized regret vs the recommended action,
- the calibration outcome of the numeric confidence,
- any safety event that fired.

This decision-paired dataset is **what calibrates Largo and what no incumbent has**, because incumbents optimized for booking conversion, not for honest decision quality.

### 2.3 Why incumbents cannot easily copy
- They lack **regret labels** (they don't track whether their recommendation was *correct*; they track whether it converted).
- They lack **provider disagreement** (they normalize to a single displayed price).
- They lack **honest ABSTAIN data** (they never abstain — they always show a result).
- They have **conflicting incentives**: their advertised "best price" is an ad slot, not a calibrated belief.
- They have **brand and legal constraints** that make publishing calibration data unattractive.

Largo can publish calibration. Largo can publish ABSTAIN rates. Largo can publish realized regret. The incumbent cannot do any of these without admitting defects. **That asymmetry is the moat.**

---

## 3. Source inventory

### 3.1 Existing data assets today

The repo already contains scripts touching these sources. **No B0 commitment to keep, modify, or run them as-is** — the inventory is a snapshot for context.

| Asset | Type | Origin | Repo trace today | Status |
|---|---|---|---|---|
| BTS DB1B (Origin & Destination Survey, ticket-level) | Historical, public | US DOT Bureau of Transportation Statistics | `scripts/ingest/bts-db1b.ts`, `.tmp-bts-db1b/` working dir | Ingestion script exists; no production contract yet |
| BTS T100 (segment-level traffic) | Historical, public | US DOT BTS | `scripts/ingest/bts-t100.ts`, `.tmp-bts-t100/` | Same |
| Kaggle airline pricing datasets | Historical, public | Kaggle community | `scripts/ingest/kaggle.ts` | Same |
| HuggingFace datasets | Historical, public | HF Hub | `scripts/ingest/huggingface.ts` | Same |
| Expedia ICDM dataset | Historical, research-licensed | Expedia / ICDM challenge | `scripts/ingest/expedia-icdm.ts` | License terms must be confirmed before any commercial use |
| dilwong public flight prices | Historical, public | Kaggle / GitHub mirror | `scripts/train/v7a/fetch_dilwong.py` (V7a only — not modified by this document) | V7a baseline data |
| Quality gate logic | Internal validation | Largo | `scripts/ingest/quality-gate.ts` | Existing script, untouched in B0 |
| Working artefacts (`bma_weights.json`, `copula_weights.json`, `xgb_meta_weights.json`) | Model weights | V7.6 ultra training | Repo root | V7.6 training artifacts; not Largo training inputs |

**Important:** the existence of a script in the repo does not constitute a commitment to use the source in Largo Phase 1. Each source must be re-evaluated against this document's contracts before being re-activated.

### 3.2 Future proprietary data assets

The following are the assets Largo *creates* (not ingests). They are the moat.

| Asset | Source | Earliest meaningful date | Privacy class |
|---|---|---|---|
| User-intent records | Largo product (search + mission inputs) | Day 1 of Phase 2 | PII (anonymized for aggregates) |
| Mission records | Largo product | Day 1 of Phase 2 | PII |
| Advice records (`LargoAdvice` v0.1.0) | Largo backend | Day 1 of Phase 2 | Pseudonymous |
| Audit records (`AuditBlock`) | Largo backend | Day 1 of Phase 2 | Pseudonymous |
| Outcome records (user accepted/declined, follow-through, realized price) | Largo backend + provider follow-up | Day 1 of Phase 2 | Pseudonymous |
| Feedback records (explicit user signals on advice) | Largo product | Day 1 of Phase 2 | PII |
| Provider disagreement records | Largo backend (when ≥ 2 providers cross-checked) | Day 1 of Phase 2 (when multi-provider live) | Pseudonymous |
| Safety events | Largo backend | Day 1 of Phase 2 | Pseudonymous |
| Calibration outcomes (numeric_value vs realized) | Largo backend, computed weekly | Day 30 of Phase 2 (need accumulation window) | Pseudonymous |
| Regret labels (per `LARGO_EVALUATION_PLAN.md`) | Largo backend, computed monthly | Day 60 of Phase 2 (need realization window) | Pseudonymous |

These assets do not exist today. They begin to exist when Largo Phase 2 launches with real users.

---

## 4. External historical sources

For each external source, the same discipline applies: license review, contract definition, freshness SLA declaration, quality gate ruleset, retention policy, and a written rationale for why the source belongs in Largo.

### 4.1 BTS DB1B
- **Content:** quarterly 10% sample of US domestic origin-destination tickets, fare paid, carrier, distance.
- **Use case for Largo:** historical fare distributions, carrier benchmarks, seasonality priors. **Not** a real-time signal.
- **Freshness:** quarterly release with ~6-month lag. Useless for tactical buy/wait timing; useful for distributional priors.
- **License:** US public data, no commercial restriction.
- **Risk:** systematic bias toward larger carriers and longer-haul tickets.

### 4.2 BTS T100
- **Content:** monthly segment traffic and capacity by carrier and route.
- **Use case for Largo:** capacity/load priors, route popularity, seasonality.
- **Freshness:** monthly with ~3-month lag.
- **License:** same as DB1B.
- **Risk:** segment-level only, no individual fare.

### 4.3 Kaggle airline pricing datasets
- **Content:** community-uploaded scrapes of fare data, varying quality and coverage.
- **Use case for Largo:** sanity checks, model dev, **never** as a production training source without explicit contract review.
- **License:** per-dataset, must be checked.
- **Risk:** unknown collection method, potential ToS violations of source sites if reused commercially.

### 4.4 HuggingFace datasets
- **Content:** community / research-uploaded datasets.
- **Use case:** same as Kaggle — dev only, contract review per dataset.
- **License:** per-dataset.
- **Risk:** same.

### 4.5 Expedia ICDM dataset
- **Content:** large-scale Expedia pricing data released for the ICDM challenge.
- **Use case:** historical price prediction baselines.
- **License:** **research only** under most ICDM challenge terms. Commercial reuse requires direct Expedia agreement.
- **Risk:** legal risk if used in production training without confirmation. **Default Phase 1 assumption: dev only.**

### 4.6 dilwong dataset
- **Content:** public flight pricing snapshots curated by dilwong.
- **Use case:** V7a baseline training (existing, unchanged).
- **License:** public.
- **Risk:** limited route coverage.

### 4.7 Future external sources (candidates only)
- Cirium / OAG schedules (paid).
- Skyscanner / Kayak partner feeds (terms TBD).
- ITA / Sabre / Travelport feeds (paid).
- IATA airline data (paid).
- Direct airline NDC connections (per-airline contract).

**No commitment** to any of these in B0. Each requires legal, financial, and product justification before procurement.

---

## 5. Real-time provider sources

### 5.1 Definition
Real-time provider sources are the **live price/availability feeds** Largo will query at advice generation time. These are the sources whose responses populate `LargoAdvice.price_observation` and `LargoAdvice.provider_info`.

### 5.2 Trust class
Per `LARGO_SECURITY_PAYMENTS.md` Section 3, all provider responses are **semi-trusted**: every value is validated against the data contract before use, and never autonomously trusted as basis for charge.

### 5.3 Cross-check requirement
- Phase 2 with single provider: allowed only with `confidence_label !== 'high'` (no high-confidence advice from a single source).
- Phase 3+: cross-check with ≥ 2 providers required for any high-confidence advice. Disagreement above 1% surfaces as `cross_check_disagreement_pct` in the advice and gates auto-buy.

### 5.4 Provider data contract (per provider)
Each provider integration must provide, before any production query:
- Endpoint(s), auth model, rate limits.
- Latency p50/p95 SLAs.
- Field-by-field schema mapped to `LargoAdvice.product_specific` and `PriceObservation`.
- Currency and FX handling (does provider quote in user currency, or convert?).
- Stale-price semantics (does provider return a `quoted_at`? if not, Largo timestamps on receipt and treats as ~immediate).
- Disagreement policy (when this provider disagrees with another, which signals matter).
- Failure semantics (timeout, malformed, partial response).

**No provider goes live without a written contract document.**

---

## 6. User-intent data

User intent is the most valuable, most sensitive data Largo collects.

### 6.1 What it captures
- Origin / destination / dates / passenger count.
- Mission ceiling (price ceiling user accepts).
- Mission flexibility (date flex, airport flex, cabin flex).
- Search-vs-mission distinction (anonymous casual search vs authenticated committed mission).

### 6.2 Anonymous search quota
Per `LARGO_PRODUCT_VISION.md`, anonymous casual search is allowed with a quota:
- IP-based rate limit (TBD numeric in B1).
- No mission persistence beyond session.
- No user-level history.
- Advice generated under anonymous search has `user_id === null` and `surface === 'simple_search'`.

### 6.3 Mission consent layer
Authenticated missions persist with explicit mission consent (per `LARGO_SECURITY_PAYMENTS.md` Section 11.2).

### 6.4 PII minimization
- Search inputs that imply PII (e.g., "John Doe" entered as a passenger name during search) are **never** stored against user_id without consent.
- Anonymous searches are **never** later linked to a user even if the user logs in.
- Search and mission tables are logically separated; cross-table joins are restricted.

---

## 7. Mission data

Missions are the longest-lived user-intent objects.

### 7.1 What a mission row contains
- `mission_id` (ULID).
- `user_id` (mandatory).
- Trip parameters (origin, destination, dates, pax, cabin, ceiling, flexibility).
- Mission state (active, paused, completed, cancelled, expired).
- Created / updated / completed timestamps.
- Linked advice IDs (one-to-many).
- Linked decision outcome (booked / abandoned / outside-Largo / unresolved).
- Mission consent reference.

### 7.2 Mission lifecycle and data
- **Active**: receiving advice, generating outcome data on user interactions.
- **Paused**: no new advice generated; existing advice remains valid until expiry.
- **Completed**: terminal — booked through Largo or confirmed booked elsewhere.
- **Cancelled**: terminal — user cancelled or mission expired.
- **Expired**: terminal — `valid_until` of last advice passed without action.

### 7.3 Outside-Largo outcomes
Users who book outside Largo are still in the mission dataset, with outcome `booked_outside_largo`. This is **the most important segment for measuring true regret**: it's the counterfactual we owe ourselves.

---

## 8. Advice data

The `LargoAdvice` v0.1.0 record itself is a data asset.

### 8.1 Storage rules
- Advice rows are **immutable** post-generation.
- Updates are forbidden; corrections produce a *new* advice with a `parent_advice_id` link.
- Advice rows reference an `AuditBlock` row 1:1.
- In Phase 1: `audit_id === advice_id` (a simplification permitted only while the audit envelope is minimal).

### 8.2 Indexed for analytical queries
- By `mission_id`, `user_id`, `surface`, `action`, `confidence_label`, `generated_at`.
- By `product_type` (flight / hotel / car / bundle — Phase 1 = flight only, but indexes are forward-compatible).

### 8.3 Snapshot for replay
- A weekly snapshot captures all advice rows generated in the prior week, frozen for evaluation reproducibility.
- Snapshots are versioned and never overwritten.

---

## 9. Outcome data

Outcome data is the bridge between advice and reality.

### 9.1 Categories of outcomes
| Outcome type | Source | Example |
|---|---|---|
| User decision | Frontend interaction | "user accepted BUY_NOW", "user dismissed", "user opened then ignored" |
| User booking action | Backend payment flow | "user confirmed booking", "user cancelled mid-flow" |
| Booking outcome | Provider response + Stripe state | "booking confirmed", "booking failed", "refunded" |
| Realized price after decision window | Re-query of the route over time | "price dropped to $X 7 days later", "price rose to $Y at departure" |
| Calibration result | Weekly batch job | "high-confidence BUY_NOWs in this cohort: 87% had no cheaper alternative within 7 days" |
| Regret outcome | Monthly batch job | "this BUY_NOW had $42 of realized regret vs WAIT counterfactual" |

### 9.2 Outcome data is append-only
- Outcome rows reference `advice_id`.
- Multiple outcome rows per advice are normal (a user decision row, a booking outcome row, a price-trajectory row, a regret row computed later).
- Outcome rows are never updated, only appended with a new computation timestamp.

### 9.3 Outside-Largo outcomes
- When user books outside Largo, the outcome is captured if the user reports it (post-mission survey, optional).
- Anonymous baseline: even when no user-level outside outcome is captured, the price trajectory itself is collected to compute counterfactual regret.

---

## 10. Feedback data

Feedback is the user telling us we are right or wrong.

### 10.1 Explicit feedback
- "This advice was helpful" / "not helpful".
- "I disagreed with this advice because…" (free-text, optional).
- "This price seems wrong" (mismatch report).
- Post-booking: "the trip went as expected" / "issues: …".

### 10.2 Implicit feedback
- Time-on-card (without becoming a vanity metric — this is for diagnostic only, never as primary quality signal).
- Dismissal rate per advice action.
- Re-engagement after WAIT advice (did user come back when WAIT promised value?).

### 10.3 Feedback bias
- Feedback is **self-selected** — users who feel strongly are over-represented.
- Feedback is **never** used as the sole quality signal; per `LARGO_EVALUATION_PLAN.md`, calibration and regret remain primary.

---

## 11. Payment / auto-buy audit data

Per `LARGO_SECURITY_PAYMENTS.md` Section 19, every payment-related state change generates an audit event. The data strategy aspect:

- Audit data is **append-only** (no UPDATE, no DELETE).
- Audit data is **retained 7 years minimum** for payment-related events.
- Audit data is **read-restricted**: bulk reads require dual control.
- Audit data is **never used directly as ML training input** without explicit anonymization and review (the audit log contains operational PII like IP and user-agent that are out of scope for model features).
- Audit data **may be used for safety analytics** (auto-buy block rate by reason, dispute pattern detection) — these analytics live in a separate analytical layer with its own access controls.

---

## 12. Provider disagreement data

A novel and high-value asset.

### 12.1 What is captured
For every multi-provider advice:
- All provider responses, in their entirety as received.
- The disagreement metric (`cross_check_disagreement_pct`) computed at advice time.
- The provider chosen as `primary_provider` and the reason (lowest, fastest, most reliable, …).

### 12.2 Why it matters
- It is the only honest signal of price uncertainty in the wild.
- It catches provider misbehavior (one provider systematically inflating).
- It is the input to future provider-trust scoring.

### 12.3 Discipline
- **Provider disagreement is never silently averaged.** The raw responses are kept; aggregation is computed downstream and tagged.
- **Provider disagreement is never overwritten** when an advice is re-generated — the new advice has its own disagreement record.
- **Provider responses are kept verbatim** (raw JSON) in a dedicated layer for at least 90 days, then hashed-summary thereafter.

---

## 13. Data contracts by source

Each source has a written data contract. The contract is the producer-side commitment that the consumer (Largo backend, ML training) can rely on.

### 13.1 Contract template
Every source contract specifies:
- **Source identifier** (canonical name, version).
- **Schema** (field name, type, units, nullability, semantic meaning).
- **Freshness SLA** (max acceptable lag from event to availability).
- **Volume SLA** (typical and peak rows per day).
- **Quality gates** (which checks must pass before data is exposed downstream).
- **Failure mode** (what happens when source is unavailable).
- **Owner** (human responsible).
- **Contract version** (semver; breaking changes require version bump).
- **Renegotiation triggers** (when contract must be reviewed).

### 13.2 Contract storage
Contracts live in `docs/contracts/` (future directory; not created in B0). Each contract is a markdown file referenced by canonical source name.

### 13.3 No contract → no consumption
**A source with no written contract may not be used in Largo production paths.** Dev / experimentation may use uncontracted sources with explicit "experimental" tagging and a deletion deadline.

---

## 14. Ingestion policy

### 14.1 Ingestion modes
- **Batch (scheduled)**: external historical sources, periodic refresh.
- **Stream (event-driven)**: provider responses arrive at advice generation time; user actions arrive in real time.
- **Snapshot (one-shot)**: research datasets pulled once, frozen, not refreshed.

Each source declares its mode in its contract.

### 14.2 Ingestion ownership
- Ingestion code lives in `scripts/ingest/` (existing) or successor location (B1+).
- **B0 commitment: no modification of existing ingestion scripts.** Existing scripts are working artifacts of prior phases; they will be re-evaluated against this document in B1 and either re-contracted, deprecated, or refactored.
- New ingestion in B1+ must be written *to* this document's contracts, not before.

### 14.3 Ingestion observability
- Every ingestion run produces an `ingestion_run` row: source, mode, started_at, ended_at, rows_in, rows_validated, rows_rejected, error_summary, contract_version.
- Ingestion runs are queryable for lineage (Section 29).
- Failed ingestion runs do not silently retry into a feedback loop; they alert per the alerting policy.

---

## 15. Idempotency and deduplication

### 15.1 Idempotency keys per source
- External historical sources: dedup key = `(source, snapshot_date, natural_key)` where natural_key is source-defined (e.g., DB1B itinerary ID).
- Real-time provider responses: dedup key = `(provider, advice_id, query_hash)`.
- User actions: dedup key = `(user_id, action_type, action_payload_hash, timestamp_bucket)`.

### 15.2 Replay handling
- Re-ingesting the same source row produces the same downstream state (idempotent).
- Re-ingesting with a *modified* row triggers a versioning event (the contract version may need a bump or the source has changed semantics).
- Replays log a `dedup_hit` counter; sustained `dedup_hit` rate > 1% indicates a feedback issue.

### 15.3 Watermarking
- Each batch source has a watermark (last successfully ingested cursor).
- Watermarks are persisted; restarts resume from the last watermark.
- Manual watermark resets require human approval and audit row.

---

## 16. Schema evolution

### 16.1 Additive by default
- Adding a new field with a sensible default is a **minor** version bump.
- Renaming or removing a field is a **major** version bump.
- Changing a field's type or semantics is a **major** version bump.

### 16.2 Breaking changes
- Major version bumps require: written rationale, consumer notification, migration plan for historical data (re-ingest? translate? preserve old?), and a sunset date for the old version.
- Old version is supported for at least one full evaluation cycle (per `LARGO_EVALUATION_PLAN.md`'s monthly cadence) before removal.

### 16.3 No silent schema drift
- Ingestion rejects rows that don't match the declared contract; rejected rows are logged with reason.
- Any rate of schema rejection > 0.1% triggers alert and contract review.

---

## 17. Units and normalization

A canonical units convention prevents the entire class of "we silently mixed minutes and seconds" bugs.

| Concept | Canonical unit | Notes |
|---|---|---|
| Money | USD with 4 decimal places (microdollars in compute, USD-with-cents in storage) | Plus original currency + FX rate per `LARGO_ADVICE_CONTRACT.md` |
| Currency code | ISO 4217 (`USD`, `EUR`, …) | Uppercase, 3 letters |
| Time | UTC, ISO 8601 with `Z` suffix | No naive timestamps |
| Duration | minutes (integer) | For flight durations, mission validity windows |
| Distance | kilometers (numeric) | Internal canonical; display may convert |
| Airport | IATA 3-letter code | Uppercase |
| Airline | IATA 2-letter code where possible, ICAO 3-letter as fallback | Documented per record |
| Country | ISO 3166-1 alpha-2 | Uppercase |
| Identifiers | ULID for all Largo-issued IDs (advice_id, audit_id, mission_id, …) | 26 chars, Crockford base32 |
| Booleans | strict `true` / `false`; never `1`/`0` or `"yes"`/`"no"` after ingestion | Validated at quality gate |
| Null | explicit `null`, never empty string, never `"NA"` | Validated at quality gate |

---

## 18. Currency and FX data

### 18.1 FX source
- One canonical FX source per environment, declared in env config (not in code).
- FX source name and timestamp captured in every `PriceObservation`.
- FX rate stored as `to_usd` ratio (foreign → USD).

### 18.2 FX freshness
- Live FX queries cached at most 60 seconds.
- Stale FX (> 60 s) triggers re-fetch before any auto-buy condition evaluation per `LARGO_SECURITY_PAYMENTS.md` Section 18.

### 18.3 No silent FX
- Every price observation in non-USD currency stores: `observed_currency_original`, `observed_price_original`, `fx_rate_to_usd`, `fx_observed_at`.
- Downstream consumers compute `observed_price_usd` themselves if needed; no silent FX conversion in storage.

---

## 19. Freshness SLAs

| Source class | Freshness SLA | Stale handling |
|---|---|---|
| Real-time provider response | ≤ 60 s at advice generation | Stale → BLOCK auto-buy |
| FX rate | ≤ 60 s for transactional use; ≤ 1 h for analytical | Stale transactional → re-fetch |
| User intent (active mission) | ≤ 5 s end-to-end | Stale → degrade to MONITOR advice |
| External historical (BTS, etc.) | per source release cadence | No real-time use; analytical only |
| Calibration computation | ≤ 24 h | Stale → flag in dashboard, no production blocking unless > 7 days |
| Regret computation | ≤ 7 days | Same |

Freshness SLAs are **monitored** (per Section 35) and **breached SLAs are alerts**, not silent degradations.

---

## 20. Data quality gates

The quality gate (existing in `scripts/ingest/quality-gate.ts`, **not modified in B0**) is the choke point through which every ingested row passes. The B0 commitment is the **set of checks** the gate must enforce in its current and future versions.

| Check class | Examples | Enforcement |
|---|---|---|
| Type checks | Numeric fields are numeric; ISO 8601 timestamps parse | Reject row, log reason |
| Range checks | Prices > 0 (no fake zeros); durations within plausible bounds | Reject row, log reason |
| Enum checks | Currency codes valid ISO 4217; airport codes valid IATA | Reject row, log reason |
| Null vs missing | Distinguish "field present and null" vs "field absent"; absent triggers contract version mismatch | Reject row, version-mismatch alert |
| Unit checks | Duration in minutes, not seconds; distance in km, not miles | Reject row, log reason |
| Cross-field consistency | `valid_until > generated_at`; `observed_price_usd` consistent with `observed_price_original × fx_rate_to_usd` | Reject row, log reason |
| Provider consistency | Two-provider responses for same query within tolerance per `LARGO_SECURITY_PAYMENTS.md` Section 5 | Flag, do not reject; downstream uses cross_check_disagreement_pct |
| Outlier flag | Price > N× median for route → flag, do not reject | Flag, downstream may downgrade confidence |
| Source freshness | Row's `observed_at` not older than declared SLA | Reject if hard SLA breach |
| Schema version match | Row's schema version matches contract version | Reject if mismatch |

**Quality gate failures are observable and aggregated**; sustained rejection rate > 0.5% on any source triggers contract review.

---

## 21. Missing data policy

### 21.1 Missing is information
- A `null` is preserved as `null` end-to-end. No silent imputation in ingestion, no silent imputation in features, no silent imputation in inference.
- Missingness patterns are themselves features in some models (e.g., "provider didn't return a price" is a real signal).

### 21.2 When imputation is allowed
- Only with **explicit imputation flag** that travels with the value.
- Only with **method declared** (mean, median, last-known, etc.).
- Only when **downstream model is trained on the same imputation** (no train/inference imputation skew).
- Imputed values must never feed **calibration metrics** without an explicit "imputed cohort" tag.

### 21.3 Forbidden imputation patterns
- No "fill with 0" for missing prices (creates fake-zero risk per `LARGO_ADVICE_CONTRACT.md`).
- No "fill with mean of training set" silently in inference.
- No "carry forward last value" for prices across providers.
- No "guess provider from heuristic" when provider is null.

---

## 22. Outlier policy

### 22.1 Detect, log, never silently drop
- Outliers are flagged with a structured reason (`outlier_reason: 'price_zscore_above_5_for_route'`).
- Flagged rows continue downstream; consumers decide.
- No silent removal at ingestion. (Removal is a model decision, not a data decision.)

### 22.2 Outlier categories tracked
- Price outliers (per route, per cabin).
- Duration outliers (flights with implausible durations).
- Stops outliers (flights with implausible connection counts).
- Provider response time outliers.

### 22.3 Outlier monitoring
- Outlier rate per source per day is a tracked health metric.
- Spike in outlier rate triggers source review.

---

## 23. Synthetic data policy

### 23.1 Allowed contexts
- **Dev / staging**: synthetic data is allowed and encouraged (avoids prod data in lower environments per `LARGO_SECURITY_PAYMENTS.md` Section 9).
- **Unit / integration tests**: synthetic data is the default.
- **Adversarial test sets**: synthetic adversarial inputs allowed for safety probing.

### 23.2 Forbidden contexts
- **Production training**: forbidden by default. Use of synthetic data in production training requires:
  - Explicit "synthetic" tag on every row.
  - Documented generation method.
  - Validation that the synthetic distribution does not skew model behavior in unintended ways.
  - Founder + ML lead sign-off.
  - Inclusion in lineage records (Section 29).

### 23.3 Always tagged
- Any synthetic row in any dataset carries an `is_synthetic: true` field.
- Aggregations may not silently mix synthetic and real data without explicit caller acknowledgment.
- A query that excludes synthetic data must be the easy default; a query that includes synthetic data is opt-in.

---

## 24. Label policy

Labels are the supervised signals models learn from. Bad labels = bad model, regardless of architecture.

### 24.1 Label categories
| Label | Definition | Source |
|---|---|---|
| `realized_price_at_horizon` | Price observed at decision-window end (e.g., 7 days post-advice) for the same route | Re-query of route over time |
| `realized_regret` | Difference between price under recommended action and counterfactual best action | Computed per Section 25 |
| `user_decision` | What the user actually chose given the advice | Frontend event |
| `booking_outcome` | Whether the booking succeeded end-to-end | Backend payment flow |
| `outcome_satisfaction` | User's post-trip satisfaction signal | Optional survey |
| `dispute_outcome` | Was a chargeback filed; outcome | Stripe webhook |

### 24.2 Label freshness
- Some labels are immediate (`user_decision`).
- Some labels require a forward window (`realized_price_at_horizon`, `realized_regret`).
- Forward-window labels are computed by a scheduled batch job; the job is **not active in Phase 1**.

### 24.3 Label review
- Each label definition has a written rationale.
- Changing a label definition requires retraining and re-evaluating affected models.
- Old labels are preserved alongside new ones during transitions.

---

## 25. Regret label construction

Regret is the primary quality label per `LARGO_EVALUATION_PLAN.md`.

### 25.1 Definition
For an advice `A` with action `act_A` issued at time `t_A` for route `r`:
- Forward window: `[t_A, t_A + W]` where `W` is the decision-relevant horizon (e.g., 7 days for typical missions, capped at `valid_until`).
- Counterfactual best action: the action that, in hindsight, minimizes price for the user.
- `realized_regret = price_under_act_A - price_under_counterfactual_best`.
- Regret ≥ 0 by construction (you cannot be better than the optimum hindsight).

### 25.2 Construction rules
- Forward window `W` is fixed per `mission_type`, declared in contract.
- Price trajectory for route `r` over `[t_A, t_A + W]` is reconstructed from provider re-queries.
- When the route disappears (flight no longer offered), regret is computed against the closest equivalent or marked `unresolvable_regret`.
- Regret is computed only after the window closes; advice without enough realized data is `pending_regret`.

### 25.3 Regret as anchor
- The V7a baseline (mean abs regret = $58.33 over 11,750 trips, per memory) is the public internal anchor.
- Largo's regret distribution is reported per cohort, not as a single number.
- Regret is **never reported as the only metric** — it must be reported with calibration (per `LARGO_EVALUATION_PLAN.md`).

### 25.4 Regret biases
- Survivorship bias: missions abandoned mid-window may have selection-biased regret. Tracked separately.
- Provider switching bias: if user books outside Largo, our regret computation lacks ground truth on what they actually paid; reported as `outside_largo_unverified_regret` cohort.

---

## 26. Train / validation / test split policy

### 26.1 Temporal split mandatory
- For all price-related models, splits are **strictly temporal**:
  - Train: data up to time `T_train_end`.
  - Validation: data in `(T_train_end, T_val_end]`.
  - Test: data in `(T_val_end, T_test_end]`.
- Random shuffling is **forbidden** for price models.

### 26.2 Holdout discipline
- Test set is **never** seen by model selection.
- Test set evaluation is run at most monthly on a fresh slice.
- Repeated test-set evaluation = test-set leakage = invalid claims.

### 26.3 Time-leak guards
- Every feature carries `available_at` metadata.
- `available_at` of any feature in a training row must be ≤ the row's `decision_at`.
- Features with `available_at > decision_at` are time-leaks and rejected at training-set construction.

### 26.4 Cross-validation
- For price models: rolling-window time series cross-validation only.
- K-fold random CV is forbidden for any pricing/decision model.

### 26.5 V7a as reference
- The V7a baseline uses a temporal split documented in V7a code (untouched in B0).
- Any new Largo model is evaluated against V7a on the same temporal slice for fair comparison (per `LARGO_EVALUATION_PLAN.md`).

---

## 27. Leakage prevention

### 27.1 Feature availability check
- Every feature must declare its `available_at` semantic: when in real production timeline this value is observable.
- Training-set construction fails if any feature's `available_at` is in the row's future.

### 27.2 Label leakage
- Label `realized_regret` is in the row's future by construction; using it as a feature is a leak.
- Lagged labels (e.g., last week's regret) are allowed only if `available_at` is correctly set.

### 27.3 Cross-mission leakage
- Features computed across the same user's missions must respect time order.
- Aggregates over "all missions" are only valid as features if the aggregate's `available_at` is correctly computed (often this requires nightly snapshots, not live aggregates).

### 27.4 Provider response leakage
- Provider responses received *after* the advice was generated are not available to the advice's features.
- Multi-provider cross-checks must use only responses received before advice timestamp.

### 27.5 Calibration leakage
- Calibration is computed on the **test cohort**, not on the training cohort.
- "We saw 90% accuracy on training" is not calibration; it is overfitting.

---

## 28. Dataset versioning

### 28.1 Snapshot naming
- Snapshots are named `<dataset_name>__<contract_version>__<snapshot_date>` (e.g., `bts_db1b__v1.0__2026-Q1`).
- Snapshot names are immutable.
- Re-snapshotting with the same name is forbidden.

### 28.2 Diff and rollback
- Each new snapshot of a dataset records a diff against the prior snapshot: rows added, rows changed (under what contract), rows removed.
- Rollback to a prior snapshot is possible; rollback creates a new snapshot pointing to old data with a `rollback_of` reference.

### 28.3 Snapshot retention
- Snapshots used by any production model are retained indefinitely.
- Snapshots only used in dev / experiments may be deleted after 90 days, with audit row.

### 28.4 Snapshot-as-input
- Models declare the exact snapshot IDs they were trained on.
- Re-training a model on a different snapshot yields a new model version.
- Inference time records the model version, which records its training snapshots; full lineage is reconstructable.

---

## 29. Lineage and reproducibility

Lineage is the chain that lets us answer "where did this number come from?" for any value Largo emits.

### 29.1 Lineage graph
- Every advice → audit_id → ingestion runs → source rows → contracts → snapshots → models → training datasets.
- Every label → outcome events → providers → ingestion runs.
- The graph is queryable; no orphan nodes.

### 29.2 Reproducibility
- Given an `advice_id`, we can reconstruct: which model emitted it, on which features, computed from which source rows, ingested by which run, validated by which contract version.
- A regulatory or dispute audit (per `LARGO_SECURITY_PAYMENTS.md` Section 27) is satisfied by the lineage chain.

### 29.3 Lineage storage
- Lineage records live alongside data, not as a separate optional layer.
- Loss of lineage = data integrity incident, SEV2 minimum.

---

## 30. Data retention

Different layers have different retention policies aligned to their utility and risk.

| Layer | Retention | Rationale |
|---|---|---|
| Raw provider responses | 90 days verbatim, then hashed-summary indefinitely | Storage cost vs forensic value |
| Raw external snapshots (BTS, etc.) | Indefinite while used by any production model | Reproducibility |
| Ingestion run logs | 2 years | Lineage forensics |
| Quality-gate rejection logs | 2 years | Trend analysis |
| Advice records | 7 years (regulatory, payment-adjacent) | Per `LARGO_SECURITY_PAYMENTS.md` Section 19 |
| Audit records | 7 years minimum | Same |
| User PII | Account lifetime + statutory minimum after closure | GDPR / CCPA |
| Outcome records (user decision) | 7 years | Disputes, calibration |
| Regret labels | Indefinite (small footprint, high analytical value) | Long-term moat |
| Calibration outcomes | Indefinite | Same |
| Synthetic data | 90 days unless re-tagged for retention | Avoid synthetic creep |
| Working artefacts (tmp dirs) | Rotated weekly | Hygiene |

Retention breaches (data kept longer than policy) are as serious as data loss.

---

## 31. Privacy and PII handling

Aligned with `LARGO_SECURITY_PAYMENTS.md` Section 22. Data-strategy-specific rules below.

### 31.1 PII at the data-platform layer
- PII is **separated from feature data** by default. Models train on pseudonymous IDs, not on emails or names.
- Joins from pseudonymous to PII tables are **gated** and audit-logged.
- Aggregate analytics avoid small-cell exposure (k-anonymity floor `k ≥ 5` for any cohort exposed to non-admin roles).

### 31.2 PII in training sets
- Training sets are scrubbed of direct PII (name, email, phone, exact passport).
- Quasi-identifiers (DOB, exact zip, exact device fingerprint) are bucketed.
- Any model that requires PII features (none in Phase 1) requires explicit founder + DPO sign-off.

### 31.3 PII deletion propagation
- A user erasure request triggers:
  - Deletion of PII from primary tables.
  - Anonymization (not deletion) of derived analytical rows where the row's existence is regulatorily required.
  - Re-training of any model that may have memorized the user — case-by-case decision, documented.

### 31.4 PII in lineage
- Lineage records reference IDs only.
- Lineage queries that resolve IDs to PII go through the access-controlled join layer.

---

## 32. User consent for data reuse

### 32.1 Layered consent
- **Operational consent** (running the booking): covered by ToS / Privacy Policy at signup.
- **Mission consent** (this trip's data scope): per mission, per `LARGO_SECURITY_PAYMENTS.md` Section 11.2.
- **Training reuse consent** (using user's mission/decision data to improve future models): **explicit opt-in**, separate toggle, default off.

### 32.2 Aggregation
- Aggregated statistics that cannot be re-identified (k-anonymity ≥ 5) do not require training-reuse consent.
- Statistics in small-cohort cells (k < 5) are suppressed for non-admin roles.

### 32.3 Marketing reuse
- **Forbidden by default.** No data sharing with marketing platforms in Phase 1. Re-evaluation in Phase 3 with explicit opt-in.

### 32.4 Research reuse
- Forbidden in Phase 1.
- May be allowed under specific anonymization protocols in later phases, with explicit opt-in.

---

## 33. Data feedback loop

A feedback loop is when a model's output influences the data the model later trains on. Largo has multiple feedback loops; each must be explicitly managed.

### 33.1 Loops Largo has
- **Advice → user decision → outcome → label → next model**: this is the moat-building loop.
- **Provider response → advice → provider chosen → provider trust score**: provider behavior over time.
- **WAIT advice → user waits → realized price → regret label**: validates WAIT calibration.
- **ABSTAIN advice → user does what?**: validates that ABSTAIN is honest, not lazy (per `LARGO_EVALUATION_PLAN.md`).

### 33.2 Risks of feedback loops
- **Confirmation bias**: model recommends X, user follows X, label says X was good (because no counterfactual).
- **Survivorship bias**: only users who trust Largo enough to follow through generate labels.
- **Reward hacking**: optimizing for "user clicked" instead of "user got value".

### 33.3 Mitigations
- **Counterfactual reasoning**: regret labels include counterfactual price trajectories, not only the realized path.
- **Holdout cohorts**: a fraction of advice is randomly downgraded (e.g., shown without confidence) to estimate untreated baseline.
- **Outside-Largo outcomes** captured when possible.
- **No optimization for click-through rate** as primary objective — `LARGO_EVALUATION_PLAN.md` forbids it.

### 33.4 Loop transparency
- Each model declares which feedback loops feed its training set.
- Loop changes (e.g., adding outside-Largo outcomes) are documented as model version bumps.

---

## 34. Drift detection

### 34.1 Drift categories
| Type | What drifts | Detection |
|---|---|---|
| **Feature drift** | Distribution of input features vs training | KS test or PSI per feature, weekly |
| **Label drift** | Distribution of realized labels vs training | Same approach, weekly |
| **Concept drift** | Mapping from features to labels changes (model becomes less accurate even if features look stable) | Calibration error trending up over time |
| **Provider drift** | Provider response distribution changes (new pricing strategy, new quoting behavior) | Per-provider distribution monitors |
| **Ingestion drift** | Source schema or volume changes silently | Quality-gate rejection rate, volume vs baseline |

### 34.2 Drift response
- Feature/label drift > threshold → alert ML team; model may be retrained.
- Concept drift detected → suspend high-confidence advice in affected cohort; retrain.
- Provider drift → renegotiate contract or downgrade provider trust.
- Ingestion drift → contract review.

### 34.3 No silent retrain
- Models do not automatically retrain on drift.
- Retraining is a deliberate decision with sign-off.

---

## 35. Data health metrics

The data-side analogue of the monitoring policy in `LARGO_SECURITY_PAYMENTS.md` Section 28.

| Metric | Target | Alert |
|---|---|---|
| Quality-gate rejection rate per source | < 0.5% | > 1% sustained 24h |
| Ingestion run failure rate | < 1% | Any consecutive 3 failures on a source |
| Freshness SLA breach rate | 0 | Any breach |
| Outlier flag rate | source-baselined | > 3σ above baseline |
| Schema rejection rate | < 0.1% | Any |
| Lineage completeness (% of features with traced source) | 100% | < 100% |
| Snapshot creation success | 100% | Any miss |
| Synthetic data leakage to prod training | 0 | Any (SEV2) |
| PII presence in feature tables | 0 | Any (SEV1) |
| Calibration computation freshness | ≤ 24 h lag | > 7 days |
| Regret computation freshness | ≤ 7 days | > 30 days |
| Cross-tenant query in routine path | 0 | Any |

These are observability commitments, not implementations.

---

## 36. Data for simple search

Per `LARGO_PRODUCT_VISION.md`, simple search is the anonymous casual surface.

### 36.1 What is captured
- Search inputs (origin, destination, dates, pax, cabin).
- IP-derived metadata for rate limiting (kept short-term only).
- Advice generated (with `surface === 'simple_search'`, `user_id === null`).

### 36.2 What is NOT captured
- No user identity.
- No long-term history.
- No cross-session linking.
- No advertising identifier.

### 36.3 Use in training
- Simple search advice rows are usable in aggregate analytics (calibration, ABSTAIN rates) but not joined to any user-level data.
- Quota enforcement metadata is short-lived (≤ 7 days) and not used in ML training.

---

## 37. Data for missions

### 37.1 What is captured
- Mission parameters (Section 7).
- Advice rows linked to mission.
- User decisions on each advice.
- Outcome (booked / abandoned / outside-Largo).
- Optional post-mission satisfaction signal.

### 37.2 Use in training
- Mission-level data is the highest-quality input for Largo models.
- Use is gated by training-reuse consent (Section 32.1).
- Cohorts that opted out of training reuse are excluded from training sets but still receive Largo's full product value.

---

## 38. Data for hotels / cars / bundles later

Per `LARGO_ADVICE_CONTRACT.md`, the contract reserves space for hotels, cars, and bundles. The data strategy reserves the corresponding space without committing to it.

- **Phase 1**: flights only. No hotel / car / bundle ingestion. No hotel / car / bundle features. No hotel / car / bundle labels.
- **Phase 2+**: each new product type requires its own source contracts, quality gates, label definitions, and a fresh consent layer.
- **Contract reservation**: the existence of `HotelSpecific`, `CarSpecific`, `BundleSpecific` in v0.1.0 does NOT mean Largo has data for those domains. It means the contract will not break when Largo expands.

---

## 39. External paid data strategy

### 39.1 When to consider paid data
- When a free or scraped source becomes legally untenable.
- When freshness SLAs cannot be met with current sources.
- When coverage gaps materially harm calibration in a measured cohort.

### 39.2 When NOT to consider paid data
- Because a competitor announced they bought it.
- Because a vendor demoed it well.
- Because we want to feel "more legitimate".

### 39.3 Procurement gate
- Document the calibration / regret improvement hypothesis.
- Pilot with a subset (sandbox / staging) before signing.
- Measure improvement against pre-stated thresholds.
- Sign with clear termination rights.
- Negotiate data ownership: Largo owns its derivatives.

### 39.4 Phase 1 commitment
- **No paid data in Phase 1.** Operate with public + first-party data only. Decision to add paid data is Phase 2/3.

---

## 40. Forbidden data patterns

The append-only data-side "no" list. Each entry is a regression to revert, not negotiate.

| # | Pattern | Why forbidden |
|---|---|---|
| 1 | Silent imputation of missing values | Destroys calibration |
| 2 | Filling missing prices with 0 | Creates fake-zero risk per `LARGO_ADVICE_CONTRACT.md` |
| 3 | Random shuffle for price-model splits | Time-leak |
| 4 | Reusing test set for model selection | Test-set leakage |
| 5 | Using `realized_regret` as a feature | Future-leak |
| 6 | Joining anonymous-search rows to authenticated-user rows | Privacy violation |
| 7 | Mixing synthetic and real data without explicit tagging | Unmarked drift |
| 8 | Production training on synthetic data without sign-off | Distributional risk |
| 9 | Silent FX conversion in storage | Auditability loss |
| 10 | Overwriting provider responses during cross-check | Loses disagreement signal |
| 11 | Silently averaging multi-provider prices | Same |
| 12 | Carrying forward last-known price across providers | Same |
| 13 | Modifying a snapshot in place | Reproducibility loss |
| 14 | Re-snapshotting under same name | Same |
| 15 | Updating an advice row | Immutability violation |
| 16 | Updating an audit row | Per `LARGO_SECURITY_PAYMENTS.md` |
| 17 | Joining feature tables to PII tables in routine paths | Privacy boundary breach |
| 18 | Exposing small-cell aggregates (k < 5) to non-admin roles | Re-identification risk |
| 19 | Marketing reuse of mission data in Phase 1 | Phase rule |
| 20 | Selling user data | Strategic boundary |
| 21 | Ingesting from uncontracted source into production paths | No-contract = no-trust |
| 22 | Bypassing quality gate "for one row" | Discipline collapse |
| 23 | Using ICDM Expedia data in commercial training without confirmation | Legal risk |
| 24 | Scraping ToS-protected sources | Legal + ethical risk |
| 25 | Storing `.env*` or any secret in any data table | Per `LARGO_SECURITY_PAYMENTS.md` |
| 26 | Logging raw card data anywhere in pipeline | Same |
| 27 | Optimizing models for click-through as primary label | Reward hacking |
| 28 | Using vanity metrics (DAU, time-on-page) as model objective | Per `LARGO_EVALUATION_PLAN.md` |
| 29 | Allowing a feature without `available_at` metadata | Time-leak risk |
| 30 | Allowing a model without declared training snapshot IDs | Lineage loss |
| 31 | Auto-retraining on drift without human sign-off | Stability risk |
| 32 | Deleting raw provider responses before 90 days | Forensics loss |
| 33 | Aggregating outcomes from sub-`k` cohorts publicly | Re-identification risk |
| 34 | Promising a dataset that does not yet exist in marketing material | False claim |
| 35 | Using outside-Largo outcomes as ground truth without flagging unverified | Survivorship bias propagation |
| 36 | `git add .` in the data scripts directory with `.env*` present | Per `LARGO_SECURITY_PAYMENTS.md` |

This list is **append-only**. Removal of any entry requires the same review level as a kill switch deactivation per `LARGO_SECURITY_PAYMENTS.md` Section 29.

---

## 41. Phase 1 / Phase 2 / Phase 3 gates

### Phase 1 — Documentary + dev (current)
- All work is design, contract definition, and dev-environment integration.
- No new ingestion runs against production data.
- No new training runs against production data.
- Existing scripts (V7a, V7.6 ultra training, ingestion scripts) **untouched**.
- Existing weights and tmp dirs **left in place**, not committed.
- Documentary discipline: B0 → B1 transition gate.

### Phase 2 — Live data accumulation begins
- User-intent, mission, advice, outcome, audit data flow into production tables.
- External historical sources may be ingested per their contracts.
- Calibration computation begins (lagged 24h).
- Regret computation begins (lagged 7-14 days, depends on horizon).
- No model trained on live first-party data yet (insufficient volume).

**Gates to enter Phase 2:**
- [ ] All B0 docs complete and signed off.
- [ ] At least one source contract written for each source intended to ingest in Phase 2.
- [ ] Quality gate ruleset reviewed and pinned.
- [ ] Lineage skeleton in place.
- [ ] Privacy controls (PII separation, k-anon, deletion propagation) implemented.
- [ ] Synthetic data gating in place.

### Phase 3 — First-party-trained model in shadow
- Largo Phase 2 has accumulated enough decision-paired data to train a first-party model.
- New model runs in shadow per `LARGO_EVALUATION_PLAN.md` shadow protocol.
- V7a remains baseline reference.

**Gates to enter Phase 3:**
- [ ] ≥ 90 days of clean first-party data accumulation.
- [ ] Drift detection operational.
- [ ] Calibration and regret metrics computed and trended.
- [ ] Snapshot/versioning operational.
- [ ] Feedback-loop mitigations validated.

### Phase 4+ — Auto-buy and silent execution per `LARGO_SECURITY_PAYMENTS.md` Section 31
- Data strategy gates inherit from security/payments phase gates.
- Each new product type (hotel/car/bundle) requires its own data contracts and quality gates before activation.

### Cross-phase principles
- **No skipping a phase.**
- **No marketing-driven phase advancement.**
- **Regression rolls back.** A SEV2 in Phase 3 returns operations to Phase 2 protocols.

---

## 42. Open questions before implementation

Explicit list of questions this document does not resolve. Each must be resolved (or explicitly deferred with rationale) before the corresponding implementation begins.

1. **Snapshot store**: object store (S3/R2) + manifest, or warehouse-native (e.g., Iceberg)?
2. **Lineage store**: bespoke, OpenLineage, Marquez, DataHub?
3. **Quality gate framework**: keep custom (`scripts/ingest/quality-gate.ts`), migrate to Great Expectations, or Soda?
4. **Provider raw response retention**: 90 days verbatim sufficient, or longer for forensics?
5. **K-anonymity threshold**: `k = 5` proposed; review for small markets?
6. **ICDM Expedia dataset**: confirm research-only license; obtain commercial license or remove?
7. **Outside-Largo outcomes capture**: post-mission survey design, response-rate target?
8. **Holdout cohort size**: 5%? 10%? for counterfactual estimation, balanced against UX cost?
9. **Drift detection windowing**: weekly vs daily, balanced against false-alarm rate?
10. **Synthetic data registry**: where do synthetic generators live, who reviews them?
11. **Training-reuse consent UX**: prominent or buried? (`LARGO_PRODUCT_VISION.md` favors prominent.)
12. **Cross-border data residency**: if EU users meaningful, do we mirror EU-region storage?
13. **Provider raw responses with PII** (e.g., passenger names submitted at booking): how stripped before retention?
14. **Forward window `W` per mission type**: documented per type, but values TBD.
15. **Counterfactual price reconstruction**: re-query cadence for routes (every hour? every 6 hours?).
16. **Model-snapshot retention** when models churn fast in early Phase 3?
17. **Schema registry**: in-repo markdown, or formal registry (Confluent-style)?
18. **`AuditBlock` simplification** when `audit_id !== advice_id` becomes necessary in Phase 3?
19. **Anonymous search quota** numeric values (per IP per hour)?
20. **Outlier detection methods**: simple z-score now, IsolationForest later?
21. **Bias monitoring**: which protected-class attributes to monitor (where legal), with what cadence?

These questions are tracked here so they cannot be silently bypassed.

---

## 43. Document status

- **B0 documentary specification.** No code, no migration, no endpoint, no deployment, no V7a touch derived from this document.
- **Aligned with**:
  - `LARGO_DOMINATION_STRATEGY.md` (data-as-moat thesis; incumbent asymmetry).
  - `LARGO_PRODUCT_VISION.md` (anonymous search vs mission split; honest ABSTAIN; no dark patterns; no vanity metrics).
  - `LARGO_ADVICE_CONTRACT.md` v0.1.0 (`PriceObservation`, `ProviderInfo`, `AuditBlock`, nullable price/provider, `valid_until` mandatory, ULID identifiers).
  - `LARGO_EVALUATION_PLAN.md` (regret as primary label, V7a $58.33 mean-abs-regret anchor, calibration ECE targets, public claims policy, cohort gates).
  - `LARGO_SECURITY_PAYMENTS.md` (PII handling, audit retention 7 years, GDPR shape from day 1, kill switches, forbidden patterns).
- **Existing assets are inventoried, not committed.** The presence of a script in `scripts/ingest/*` or `scripts/train/*` does not imply Phase 1 use.
- **Future assets are described, not promised.** No public claim about dataset size or coverage flows from this document; those claims are reserved for `LARGO_COMPETITIVE_BENCHMARK.md`.
- **Append-only forbidden patterns list.** Removal of any entry requires the same level of review as deactivating a kill switch.
- **Open for review by**: founder, future ML/data hire, future external data partner, future privacy reviewer.
- **Next document expected**: `LARGO_MODEL_STRATEGY.md` (model architecture choices, training discipline, evaluation hand-off, retirement criteria).

---

*End of LARGO_DATA_STRATEGY.md.*
