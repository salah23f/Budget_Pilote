# Largo — Advice Contract

> **Status:** B0 (pre-implementation framing). Technical contract specification, not implementation.
> **Audience:** product, backend, frontend, ML, data, security, future hires.
> **Author:** Flyeas team.
> **Last updated:** 2026-04-26.
> **Predecessors:** `LARGO_DOMINATION_STRATEGY.md`, `LARGO_PRODUCT_VISION.md`.
> **Successors (to come):** `LARGO_EVALUATION_PLAN.md`, `LARGO_SECURITY_PAYMENTS.md`, `LARGO_DATA_STRATEGY.md`, `LARGO_MODEL_STRATEGY.md`, `LARGO_BACKEND_API_SPEC.md`, `LARGO_FRONTEND_UX_SPEC.md`.
> **Schema version defined here:** `0.1.0`.

---

## 0. Executive Summary

This document defines `LargoAdvice`, the single typed contract that every Largo decision in the system flows through. Whether the surface is a simple anonymous search, a mission scan, a hotel check, a car check, or a bundle compound advice, the consumer-facing decision is always one shape: a `LargoAdvice` object.

The contract is the spine of the platform. It is consumed by:

- the frontend, to render the `AdviceCard`, the mission timeline, and the explanation panels;
- the backend, to persist immutable audit rows and feed downstream services;
- the auto-buy safety layer, to evaluate the triple condition before any Stripe capture;
- the evaluation pipeline, to compute calibration (ECE), regret, and per-segment metrics;
- future ML layers, to consume calibrated quantiles, conformal widths, and historical anchors.

This document does not propose any implementation. It does not propose Supabase migrations, endpoint shapes, or producer code. It defines the contract. Subsequent B0 documents (`LARGO_BACKEND_API_SPEC.md`, `LARGO_DATA_STRATEGY.md`, `LARGO_SECURITY_PAYMENTS.md`) will reference this contract and translate it into endpoint, persistence, and security specifications.

The contract is intentionally multi-product (flights, hotels, cars, bundles) from day one, even though Phase 1 producer code only emits `product_type: 'flight'`. The future-proof shape is part of the design discipline; the runtime restriction is part of the scope discipline.

---

## 1. Purpose of this Contract

A single contract serves four purposes simultaneously.

### 1.1 Predictable rendering

The frontend never has to switch on product type to know whether `action`, `confidence_label`, `short_message`, `reasons`, and `comparison_anchor` are present. They always are. Product-specific fields live in `product_specific`, behind a discriminated union — the only place where the frontend dispatches on product type.

### 1.2 Auditable persistence

Every advice that influences a user-visible recommendation, a notification, or an auto-buy attempt is written immutably. Audit rows are not summaries — they are the full advice payload, byte-for-byte. The `AuditBlock` (Section 17) is a minimal sibling envelope carrying only identity (`audit_id`) and chain linkage (`parent_advice_id`); the persistence layer pairs it with the advice without modifying the advice itself.

### 1.3 Safe auto-buy

Auto-buy authorization is a function of the advice payload alone. Three boolean-equivalent gates — `action == 'BUY_NOW'` ∧ `confidence_label == 'high'` (or numeric ≥ 0.7 internally) ∧ `can_autobuy == true` — must all evaluate true on the advice payload itself, without any side data. If the advice cannot stand on its own to authorize an action, no action is taken.

### 1.4 Evaluation continuity

Calibration metrics (ECE), regret reduction vs baselines, and per-segment performance are computed by reading historical advice rows. The contract must therefore preserve all the numeric internals (quantiles, conformal widths, baseline anchors) needed to recompute metrics offline — even if those internals are never displayed to the customer.

---

## 2. Schema Versioning

This document defines schema version **`0.1.0`**.

The version follows semantic-style discipline:

| Bump | Trigger |
|---|---|
| Patch (`0.1.x`) | Add an optional field with a safe default; clarify documentation; add a non-breaking enum value to a non-discriminator union. |
| Minor (`0.x.0`) | Add a required field with a documented migration; introduce a new product type or surface; widen a previously closed enum on a discriminator. |
| Major (`x.0.0`) | Remove or rename any field; change semantics of an existing field; restructure a sub-interface. |

Every persisted advice row carries `schema_version`. Consumers must reject payloads whose major version does not match what they know how to read. Consumers may accept higher minor or patch versions and ignore unknown fields, provided required fields are present.

There is no support for downgrading payloads to older versions at read time. Old audit rows remain readable in their own version forever; rendering code must keep backwards-compatible branches or explicitly mark old rows as "archive only".

---

## 3. Core Enums and Types

```ts
/** Schema version of the LargoAdvice contract. Bumps follow Section 2. */
export type ContractVersion = '0.1.0';

/** The recommended action for the user. */
export type LargoAdviceAction =
  | 'BUY_NOW'
  | 'WAIT'
  | 'ALERT'
  | 'MONITOR'
  | 'ABSTAIN';

/** Customer-facing confidence label. Numeric values are never displayed in customer UI. */
export type LargoConfidenceLabel =
  | 'high'
  | 'moderate'
  | 'limited'
  | 'unavailable';

/** The product the advice is about. */
export type LargoProductType =
  | 'flight'
  | 'hotel'
  | 'car'
  | 'bundle';

/** Where the advice was generated. */
export type LargoSurface =
  | 'simple_search'   // anonymous or logged-in one-off search
  | 'mission_scan'    // cron-driven scan attached to a mission
  | 'manual_check';   // user-triggered re-check inside a mission

/** Severity tag on a single reason. */
export type LargoReasonSeverity =
  | 'info'         // neutral context
  | 'positive'     // supports BUY_NOW
  | 'cautionary'   // supports WAIT or qualifies BUY_NOW
  | 'blocking';    // forces ABSTAIN or disables auto-buy
```

The `ContractVersion` literal type is intentionally narrow. Producers and consumers import it directly so the TypeScript compiler refuses any string mismatch at build time. When a future bump occurs (per Section 2), the literal widens to a union (e.g., `'0.1.0' | '0.2.0'`) and consumers explicitly opt into accepting older payloads.

Mapping rules:

- `BUY_NOW` may only ship with `confidence_label ∈ {'high', 'moderate'}`. Customer UI never shows `BUY_NOW` with `confidence_label == 'limited'` (this maps to a soft `WAIT` or `MONITOR`).
- `ABSTAIN` always carries `confidence_label == 'unavailable'`.
- `MONITOR` is the silent passive state used inside mission timelines when nothing meaningful changed.
- `ALERT` is reserved for surfacing important transitions (price drop crossing threshold, window closing) and is always associated with at least one `reason` of severity `positive` or `cautionary`.

---

## 4. The `LargoAdvice` Interface (master)

```ts
export interface LargoAdvice {
  // ---- Schema -----------------------------------------------------------
  schema_version: ContractVersion;

  // ---- Identification ---------------------------------------------------
  advice_id: string;                  // ULID, immutable
  user_id: string | null;             // null => anonymous (rate-limited backend-side)
  mission_id: string | null;          // null on simple_search
  surface: LargoSurface;

  // ---- Temporal ---------------------------------------------------------
  generated_at: string;               // ISO-8601 UTC
  valid_until: string;                // ISO-8601 UTC, MANDATORY even on ABSTAIN

  // ---- Decision ---------------------------------------------------------
  action: LargoAdviceAction;
  confidence_label: LargoConfidenceLabel;
  numeric_value: number | null;       // persisted in audit; NEVER displayed in customer UI

  // ---- Product context --------------------------------------------------
  product_type: LargoProductType;
  product_context: ProductContext;
  product_specific:
    | FlightSpecific
    | HotelSpecific
    | CarSpecific
    | BundleSpecific;

  // ---- Price (nullable) -------------------------------------------------
  price_observation: PriceObservation;

  // ---- Provider info (nullable) -----------------------------------------
  provider_info: ProviderInfo;

  // ---- Explanation ------------------------------------------------------
  reasons: Reason[];                  // 0..N, customer-safe plain language
  comparison_anchor: ComparisonAnchor | null;
  short_message: string;              // displayed on AdviceCard, English, no jargon

  // ---- Technical (debug / audit only) -----------------------------------
  technical_details: Record<string, unknown> | null;  // 4 KB soft cap

  // ---- Capability flags -------------------------------------------------
  can_autobuy: boolean;
  ml_available: boolean;

  // ---- Bundle context (only when this advice is part of a bundle) -------
  bundle_context: BundleContext | null;
}
```

Field-level discipline applies regardless of producer:

- `advice_id` is generated once at the moment of decision and never reused.
- `generated_at` and `valid_until` are populated at the producer side with UTC strings; consumers never recompute them.
- `numeric_value` carries the model's calibrated probability (or any single calibrated scalar that backed the decision). It is persisted to support evaluation. The customer UI never shows it. Internal/admin tooling may.
- `short_message` is the only required customer-facing string. It is produced in English in Phase 1.

---

## 5. Identification Fields

### 5.1 `advice_id`

Format: **ULID**. 26 characters, Crockford base32, lexicographically sortable by creation time. Chosen over UUIDv4 because creation-time sortability simplifies audit pagination and time-bounded queries.

The `advice_id` is generated at the producer side, immediately before any side effect (notification, audit write, auto-buy attempt). It is opaque to the customer — never displayed.

### 5.2 `user_id`

Type: `string | null`.

- Logged-in users: stable internal user identifier (not email, not raw OAuth subject).
- Anonymous users: `null`. Anonymous traffic is rate-limited at the backend layer (per-IP, per-fingerprint, per-route) **outside** the contract. The contract intentionally carries no IP, no User-Agent, no fingerprint. Those belong to request-scoped logs subject to retention rules, not to the audit payload.

Rationale: minimizing PII inside the audit payload reduces breach blast radius and simplifies compliance posture.

### 5.3 `mission_id`

Type: `string | null`. Non-null when the advice originated inside a mission (`surface ∈ {'mission_scan', 'manual_check'}`). Null on `surface == 'simple_search'`.

### 5.4 `surface`

Discriminator for advice origin. Used by analytics and by the rendering layer to choose which template applies. The contract treats all three surfaces with the same shape; downstream consumers may differentiate.

---

## 6. Temporal Fields

### 6.1 `generated_at`

ISO-8601 UTC, second precision sufficient. Set at producer side at the moment the decision is finalized (after model inference, after price fetch, after gating).

### 6.2 `valid_until`

ISO-8601 UTC. **Mandatory on every advice, including `ABSTAIN`.**

Rationale: an `ABSTAIN` advice is a first-class product state (per `LARGO_PRODUCT_VISION.md` §7). It must expire like any other, otherwise stale "we don't know" cards persist past the moment when fresh data could change the answer.

Per-product specific durations (e.g., 6 hours for flight BUY_NOW, 24 hours for hotel ABSTAIN) are deliberately **deferred** to a later document. This contract states only the principle:

- `valid_until > generated_at` always.
- After `valid_until`, the advice is stale; consumers must refuse to use it for auto-buy and should re-fetch before display.
- Stale advices are still kept in audit rows untouched; staleness is purely a runtime gating concern.

---

## 7. Decision Fields

### 7.1 `action`

One of `BUY_NOW | WAIT | ALERT | MONITOR | ABSTAIN`. Section 3 enumerates the allowed mappings to confidence.

### 7.2 `confidence_label`

The only confidence representation shown to customers. Mapping to internal numeric thresholds:

| Label | Internal numeric range (indicative; final calibration in `LARGO_MODEL_STRATEGY.md`) | Customer-facing meaning |
|---|---|---|
| `high` | calibrated ≥ ~0.7 | "We're confident this is a good price." |
| `moderate` | calibrated ~0.5–0.7 | "Reasonable, with some uncertainty." |
| `limited` | calibrated < ~0.5 or heuristic only | "Limited data — take with caution." |
| `unavailable` | no calibration available | "Not enough data to advise yet." |

The numeric thresholds above are illustrative. The authoritative mapping lives in the model strategy document and may be tuned over time. The contract guarantees only that these four labels are the only customer-facing values.

### 7.3 `numeric_value`

Type: `number | null`.

**Persisted in audit. Never displayed in customer UI.**

When non-null, this is the single calibrated scalar that backed the decision (e.g., probability of "good price now", or probability of "price will not drop further before window close"). Producers populate it whenever a model emitted a calibrated number. When the decision was purely heuristic or `ABSTAIN`-driven, it may be `null`.

This separation is deliberate. The contract carries the truth (the number) for evaluation. The product never exposes the number to avoid the "score: 0.73" anti-pattern explicitly forbidden in `LARGO_PRODUCT_VISION.md` §9.

---

## 8. Product Context

```ts
export interface ProductContext {
  origin: string | null;        // IATA code or city code
  destination: string | null;   // IATA code or city code
  outbound_date: string | null; // ISO date
  inbound_date: string | null;  // ISO date or null for one-way
  passengers_adults: number;
  passengers_children: number;
  passengers_infants: number;
}
```

`ProductContext` describes the user's query in product-agnostic terms. It is shared across product types because every product Largo advises on currently maps to "from origin, on outbound date, optionally returning, for N passengers".

For hotels and cars, `origin` and `destination` may be reinterpreted (origin = destination city; outbound_date = check-in / pickup). Product-specific clarifications live in `product_specific`.

Nullable fields anticipate provider failures: an advice can still be emitted (as `ABSTAIN`) even when the upstream search did not yield a normalized origin/destination.

---

## 9. Price Observation (nullable)

```ts
export interface PriceObservation {
  observed_price_usd: number | null;
  observed_currency_original: string | null;   // ISO 4217, e.g. 'USD', 'EUR'
  observed_price_original: number | null;      // amount in original currency
  fx_rate_to_usd: number | null;               // 1.0 when original is USD
  fx_observed_at: string | null;               // ISO-8601 UTC
  price_missing_reason: string | null;         // populated when prices are null
}
```

### 9.1 Why nullable

Phase 1 must be honest about provider failures. If the price feed is unreachable, the only correct action is to emit an `ABSTAIN` advice with `observed_price_usd: null` and a populated `price_missing_reason`. Inserting a fake `0` price would corrupt audit rows and downstream evaluation forever.

### 9.2 Validity rules

- If any of `observed_price_usd`, `observed_currency_original`, `observed_price_original`, `fx_rate_to_usd` is `null`, **all four must be `null`**, and `price_missing_reason` must be a non-empty string.
- If all four are populated, `price_missing_reason` must be `null`.
- `fx_observed_at` is `null` iff the price set is `null`.
- `observed_price_usd` and `observed_price_original` must satisfy `observed_price_usd ≈ observed_price_original × fx_rate_to_usd` within rounding tolerance.

### 9.3 `price_missing_reason` enumeration (extensible)

Recommended canonical strings:

- `provider_timeout`
- `provider_returned_no_offers`
- `provider_disagreement_unresolved`
- `route_unsupported_by_providers`
- `currency_normalization_failure`
- `producer_skipped_price_lookup`

Producers may use other strings; consumers must treat the field as opaque. Renderers map known strings to user-safe messages and fall back to a generic "price unavailable" copy otherwise.

---

## 10. Provider Info (nullable)

```ts
export interface ProviderInfo {
  primary_provider: string | null;             // 'sky-scrapper', 'google-flights', ...
  primary_provider_offer_id: string | null;
  cross_check_provider: string | null;
  cross_check_offer_id: string | null;
  cross_check_disagreement_pct: number | null; // e.g. 0.12 = 12%
  price_freshness_seconds: number | null;
}
```

### 10.1 Why nullable

If no provider responds, no provider can be honestly named. Forcing a fake `primary_provider` value or a fake `price_freshness_seconds` of `0` would create silent provenance lies in the audit trail. Both fields are `null` in that case, and `PriceObservation.price_missing_reason` carries the explanation.

### 10.2 Validity rules

- If `primary_provider` is `null`, then `primary_provider_offer_id`, `price_freshness_seconds`, and the cross-check fields must all be `null`.
- If `cross_check_provider` is non-null, `cross_check_disagreement_pct` should be populated (may be `0`).
- `price_freshness_seconds` is the age of the price snapshot at `generated_at`. Producers must compute it from observed timestamps, never default to a placeholder.

### 10.3 Cross-check semantics

`cross_check_provider` carries the secondary source consulted when the producer ran a disagreement check. When `cross_check_disagreement_pct` exceeds the safety threshold (defined per product in a later doc), the advice is downgraded to `WAIT` or `ABSTAIN` and `can_autobuy` becomes `false`.

---

## 11. Product-Specific Sub-Contracts

A discriminated union on `product_type`. Each variant carries the strictly product-typed fields the renderer and the auto-buy gate need.

### 11.1 `FlightSpecific`

```ts
export interface FlightSpecific {
  product_type: 'flight';
  airline_code: string | null;     // IATA airline code, NULLABLE
  stops: number | null;            // NULLABLE — unknown when no offer was retrievable
  cabin: 'economy' | 'premium_economy' | 'business' | 'first' | null;
  is_round_trip: boolean;
  outbound_duration_minutes: number | null;
  inbound_duration_minutes: number | null;
}
```

`airline_code` and `stops` are nullable specifically to model the provider-down / `ABSTAIN`-without-offer case. When the producer has no concrete offer to point at, lying about an airline or about "0 stops" would corrupt the audit; both are honest `null`.

`is_round_trip` is derived from `ProductContext.inbound_date` and is always known.

### 11.2 `HotelSpecific`

```ts
export interface HotelSpecific {
  product_type: 'hotel';
  hotel_id: string | null;
  hotel_name: string | null;
  check_in: string | null;            // ISO date
  check_out: string | null;           // ISO date
  room_type: string | null;
  refundable: boolean | null;
  cancellation_deadline: string | null;
  rooms: number;
}
```

Hotels introduce the `refundable` / `cancellation_deadline` axis, which materially changes advice semantics ("lock now" vs "keep flexibility"). Phase 1 producers do not emit hotel advices; the shape is reserved.

### 11.3 `CarSpecific`

```ts
export interface CarSpecific {
  product_type: 'car';
  pickup_location: string | null;
  dropoff_location: string | null;
  pickup_at: string | null;       // ISO-8601
  dropoff_at: string | null;      // ISO-8601
  car_class: string | null;
  supplier: string | null;
}
```

Cars introduce the availability-vs-price tradeoff that dominates close-to-pickup decisions. Phase 1 producers do not emit car advices; the shape is reserved.

### 11.4 `BundleSpecific`

```ts
export interface BundleSpecific {
  product_type: 'bundle';
  component_advice_ids: string[];     // references — NEVER full embedding
  global_budget_usd: number | null;
}
```

A bundle advice references its component advices by ULID. It does not embed them. Rationale:

- Embedding multiplies storage cost and creates synchronization hazards (which version of the component advice is canonical?).
- References preserve auditability: the bundle advice and each component advice are independently retrievable.
- Bundles can be re-evaluated cheaply by re-reading component rows.

Component advices each carry their own `bundle_context` (Section 16) pointing back to the bundle.

---

## 12. Reasons Array

```ts
export interface Reason {
  code: string;                     // machine-readable, stable, e.g. 'price_below_p10'
  message: string;                  // plain English, customer-safe, no jargon
  severity: LargoReasonSeverity;
}
```

### 12.1 Discipline

- Every reason refers to a concrete observable (price, history, time-to-departure, route knowledge, provider freshness, calibration). Vague reasons are forbidden.
- Every reason is falsifiable in principle.
- Every reason is plain English. No statistical jargon in `message`. The `code` carries the machine handle for analytics.
- Reasons are ordered by relevance, most relevant first.
- Up to ~3 reasons surface inline on the AdviceCard. Additional reasons are accessible through the "Why?" expander.

### 12.2 Reserved canonical codes (extensible)

A non-exhaustive starter list. Producers may add new codes; renderers fall back to `message` when the code is unknown.

| Code | Severity (typical) | Plain-language template |
|---|---|---|
| `price_below_p10` | positive | "This price is in the bottom 10% of what we've seen for this route." |
| `rolling_min_30` | positive | "Lower than every price recorded for this route in the past 30 days." |
| `above_median_30` | cautionary | "Higher than the median price observed in the last 30 days." |
| `ttd_pressure` | cautionary | "Departure is close; prices typically don't drop much further." |
| `provider_disagreement` | blocking | "Sources disagree on the current price by more than 10%." |
| `route_unknown_to_model` | blocking | "Not enough recent data on this specific route to be sure." |
| `ml_layer_unavailable` | blocking | "Deep analysis temporarily unavailable; advice based on baseline only." |
| `price_unavailable` | blocking | "We can't fetch a current price right now." |
| `mission_window_closing` | cautionary | "Mission window is closing soon." |

Severity drives whether the reason qualifies as decision support or as a hard block:

- `blocking` reasons disable `can_autobuy` regardless of action.
- `cautionary` reasons may downgrade `confidence_label` or push the action toward `WAIT`.
- `positive` reasons reinforce a `BUY_NOW`.
- `info` reasons are contextual only.

---

## 13. Comparison Anchor

```ts
export interface ComparisonAnchor {
  anchor_type:
    | 'training_quantile'
    | 'rolling_min_30'
    | 'rolling_median_30'
    | 'mission_baseline'
    | 'historical_avg';
  anchor_value_usd: number | null;
  description: string;              // plain language, customer-safe
}
```

The anchor is the single concrete number a user can be shown to ground the advice. Examples: "Compared against the historical 10th percentile of $208 for this route." Or: "Compared against the price observed when you started this mission ($955)."

Nullable when no defensible anchor exists (e.g., on a route with no historical observations). In that case the advice is typically `ABSTAIN` with `comparison_anchor: null`.

---

## 14. Technical Details (4 KB soft cap)

```ts
type TechnicalDetails = Record<string, unknown> | null;
```

`technical_details` is a free-form map. It carries internals used by:

- the evaluation pipeline (raw quantiles `q10/q50/q90`, conformal half-width, calibration version);
- internal/admin debug surfaces (model versions, gating decisions, feature snapshots);
- post-hoc forensic analysis when an advice looks anomalous.

**Soft cap: ~4 KB serialized JSON per advice.** Producers must keep this map compact. Larger payloads (raw feature vectors, full provider responses) belong in side tables keyed by `advice_id`, not in the advice itself. The cap is "soft" in that exceeding it is not a hard validation error, but it triggers a warning and is reviewed.

`technical_details` is **never** rendered in customer UI. Internal/admin tooling may render it in a hidden panel.

---

## 15. Capability Flags

### 15.1 `can_autobuy`

`true` if and only if every condition below is satisfied at producer side:

- `action == 'BUY_NOW'`;
- `confidence_label == 'high'` (mapped from internal numeric ≥ ~0.7);
- no `Reason` with `severity == 'blocking'` is present;
- `price_observation.observed_price_usd` is non-null;
- `provider_info.primary_provider` is non-null;
- `provider_info.cross_check_disagreement_pct` is `null` or below the safety threshold;
- `ml_available == true`;
- the advice is not stale (`now < valid_until`).

Otherwise `can_autobuy == false`. The auto-buy safety layer treats `can_autobuy` as necessary but not sufficient — additional gates (consent, idempotency, kill switch) live outside the contract per `LARGO_DOMINATION_STRATEGY.md` §12.

### 15.2 `ml_available`

`true` if the producer used the calibrated ML stack to back the decision; `false` if only baseline heuristics were used. Surfaces in the customer UI as the "limited analysis" state per `LARGO_PRODUCT_VISION.md` §18.

`ml_available == false` forces `can_autobuy == false`.

---

## 16. Bundle Context

```ts
export interface BundleContext {
  bundle_id: string;
  component_role: 'flight' | 'hotel' | 'car';
  total_components: number;
}
```

Set on a component advice (the per-product advice that participates in a bundle). The bundle's own master advice carries `bundle_context: null` and instead populates `BundleSpecific.component_advice_ids`.

This back-reference makes it possible to reconstruct the full bundle from any of its components by querying the audit table for `bundle_id`.

---

## 17. AuditBlock (separate from `LargoAdvice`)

```ts
export interface AuditBlock {
  audit_id: string;
  parent_advice_id: string | null;
}
```

### 17.1 Why separate, and why this minimal

Embedding a logging block inside `LargoAdvice` was considered and rejected. The advice payload must be immutable. Logging metadata, by contrast, may evolve (chain pointers, retention tags, persistence-layer hints) and must not pollute the contract that models the decision itself.

Two extremes were rejected:

- **Embedding the full advice payload inside `AuditBlock`** (i.e., `payload: LargoAdvice`) was rejected as redundant: the advice already carries `advice_id`, `generated_at`, and all decision data; doubling it inside an envelope creates drift hazards.
- **Adding `logging_payload`, `observed_at`, `retention_class` and similar fields directly inside `LargoAdvice`** was rejected as scope creep: those are persistence concerns, not decision concerns.

The chosen shape is the minimum viable envelope: identity (`audit_id`) and chain linkage (`parent_advice_id`). Anything else the persistence layer needs (write timestamp, retention tag, sensitivity flag) lives in the persistence schema, defined later in `LARGO_DATA_STRATEGY.md`, not in this contract.

### 17.2 `audit_id === advice_id` in Phase 1

For Phase 1, the audit identifier is the same ULID as the advice it identifies. There is no second namespace to manage and no foreign-key indirection to dereference. Future phases may decouple them if a single advice ever needs to be persisted under multiple audit identities (e.g., shadow vs production runs with the same advice payload), but that decoupling does not exist in Phase 1.

### 17.3 `parent_advice_id`

Used inside missions to reconstruct chains of advices for the same mission. Each mission scan emits an advice; `parent_advice_id` points to the previous scan's advice for the same mission. Null on the first scan and on `surface == 'simple_search'`.

This forms a per-mission linked list, which makes timeline reconstruction a single indexed query.

---

## 18. Validation Rules

A `LargoAdvice` payload is valid iff every rule below holds. Validation is enforced at producer side and re-checked at audit-write side.

### 18.1 Structural

1. `schema_version` equals the `ContractVersion` literal (`'0.1.0'` in this contract).
2. `advice_id` is a 26-char ULID.
3. `generated_at`, `valid_until` are ISO-8601 UTC strings; `valid_until > generated_at`.
4. `product_type` matches `product_specific.product_type` (discriminator coherence).
5. If `surface == 'simple_search'`, then `mission_id == null`. Otherwise `mission_id` is non-null.

### 18.2 Decision coherence

6. `BUY_NOW` ⇒ `confidence_label ∈ {'high', 'moderate'}`.
7. `ABSTAIN` ⇒ `confidence_label == 'unavailable'`.
8. `can_autobuy == true` ⇒ all conditions in Section 15.1 hold.
9. `ml_available == false` ⇒ `can_autobuy == false`.
10. At least one `Reason` is present whenever `action ∈ {'BUY_NOW', 'WAIT', 'ABSTAIN'}`.

### 18.3 Price coherence

11. Either all of `observed_price_usd`, `observed_currency_original`, `observed_price_original`, `fx_rate_to_usd` are non-null and `price_missing_reason == null`, or all four are null and `price_missing_reason` is a non-empty string.
12. When prices are non-null, `observed_price_usd ≈ observed_price_original × fx_rate_to_usd` within rounding tolerance.
13. `observed_price_usd == null` ⇒ `can_autobuy == false`.

### 18.4 Provider coherence

14. `primary_provider == null` ⇒ all other `ProviderInfo` fields are null.
15. `primary_provider == null` ⇒ `can_autobuy == false`.
16. `cross_check_disagreement_pct ≥ safety_threshold` ⇒ `can_autobuy == false` and at least one `Reason` with code `provider_disagreement` is present.

### 18.5 Bundle coherence

17. `product_type == 'bundle'` ⇒ `BundleSpecific.component_advice_ids.length ≥ 2`.
18. A component advice (`bundle_context != null`) carries `bundle_context.bundle_id` matching the master bundle advice's `advice_id`.

### 18.6 Size

19. `technical_details` serialized JSON ≤ ~4 KB (soft warning above).
20. `short_message` length ≤ 140 characters.

---

## 19. Phase 1 Producer Constraints

The contract supports flights, hotels, cars, and bundles. **Phase 1 producer code emits only `product_type: 'flight'`.** No code path produces hotel, car, or bundle advices in Phase 1.

The reserved shapes for hotel/car/bundle in this contract exist solely so that:

- the frontend rendering layer is forward-compatible from day one;
- audit storage schemas reserve room for future product types without migration;
- evaluation tooling treats product type as a normal dimension, not a special case.

When Phase 2 enables hotel producers, no contract change should be required for hotels themselves — only `LARGO_MODEL_STRATEGY.md` and `LARGO_BACKEND_API_SPEC.md` updates. The same holds for cars in late Phase 2 / Phase 3 and for bundles in Phase 3.

If a Phase 1 producer is ever observed emitting a non-flight `product_type`, that constitutes a scope violation and must be reverted before deploy.

---

## 20. Forbidden Patterns

These patterns are explicitly disallowed at the contract level. They are independent of UI and apply to every producer.

| Pattern | Forbidden because |
|---|---|
| Emitting `observed_price_usd: 0` when no price was actually observed | Corrupts audit and downstream evaluation; use `null` + `price_missing_reason`. |
| Emitting a fake `primary_provider` value when no provider responded | Silent provenance lie. |
| Emitting `BUY_NOW` with `confidence_label == 'limited'` or `'unavailable'` | Violates the customer-safe confidence mapping. |
| Emitting `can_autobuy == true` while `ml_available == false` | Bypass of the model-down safety gate. |
| Embedding raw provider responses in `technical_details` | Blows the 4 KB cap; use side tables keyed by `advice_id`. |
| Using `numeric_value` directly in customer-facing copy | Violates the no-numeric-confidence-in-UI rule. |
| Exposing internal/debug technical fields (`technical_details`, raw quantiles, conformal widths, model versions, gating diagnostics) to customer-facing UI | These fields exist for evaluation and admin tooling only; surfacing them violates the "no jargon, no scores" UX discipline of `LARGO_PRODUCT_VISION.md` §9–§10. |
| Reusing an `advice_id` across two distinct decisions | Breaks audit immutability and idempotency assumptions. |
| Carrying a mutable `logging_payload` (or any logging block) as a field of the advice object | The advice payload must be immutable; logging belongs in the `AuditBlock` envelope (Section 17) or in side tables — never inside `LargoAdvice` itself. |
| Mutating an audit row after write | Breaks immutability; new state must be a new advice with `parent_advice_id` pointing back. |
| Carrying IP, User-Agent, or fingerprint inside the advice payload | Belongs in request logs, not in the audit payload. |
| Producing a `BUY_NOW` advice on a route flagged `route_unknown_to_model` | Forbidden combination; must be `ABSTAIN`. |

---

## 21. Currency Normalization

Phase 1 carries dual-currency information on every advice with a non-null price:

- `observed_price_usd` — normalized USD value used by all internal comparisons, models, and evaluation.
- `observed_currency_original` — ISO 4217 code of the source currency at the provider.
- `observed_price_original` — the amount as quoted by the provider.
- `fx_rate_to_usd` — the conversion rate captured at `fx_observed_at`.

Rationale:

- USD normalization makes baselines, percentiles, and regret comparable across markets without per-route currency switching logic.
- Keeping the original currency and rate preserves auditability: a user shown a EUR price in the UI must be able to verify the EUR value the provider returned, not an FX-rounded reconstruction.
- FX is captured at producer time, not at display time. This pins the FX exposure to the moment of decision.

Display is a frontend concern. The contract carries both forms; `LARGO_FRONTEND_UX_SPEC.md` will define which form is shown to which user in which surface.

Localization beyond English is out of scope for Phase 1 (per validated decision Q6). No `locale` field is part of this contract version.

---

## 22. Examples

Five examples follow: three complete, two partial. They are illustrative payloads, not normative reference fixtures (final fixtures live with the validation tests, in a later doc).

### 22.1 Complete — `BUY_NOW` flight (simple search)

```ts
const example_buy_now_flight: LargoAdvice = {
  schema_version: '0.1.0',

  advice_id: '01HZQK8XB5W9V0NRJ7T3F4G6PA',
  user_id: null,                        // anonymous
  mission_id: null,
  surface: 'simple_search',

  generated_at: '2026-04-26T14:02:11Z',
  valid_until:  '2026-04-26T20:02:11Z', // 6 hours, indicative

  action: 'BUY_NOW',
  confidence_label: 'high',
  numeric_value: 0.78,                  // persisted, never displayed

  product_type: 'flight',
  product_context: {
    origin: 'JFK',
    destination: 'NRT',
    outbound_date: '2026-06-12',
    inbound_date:  '2026-06-26',
    passengers_adults: 1,
    passengers_children: 0,
    passengers_infants: 0,
  },
  product_specific: {
    product_type: 'flight',
    airline_code: 'JL',
    stops: 0,
    cabin: 'economy',
    is_round_trip: true,
    outbound_duration_minutes: 845,
    inbound_duration_minutes:  790,
  },

  price_observation: {
    observed_price_usd: 812.40,
    observed_currency_original: 'USD',
    observed_price_original: 812.40,
    fx_rate_to_usd: 1.0,
    fx_observed_at: '2026-04-26T14:02:08Z',
    price_missing_reason: null,
  },

  provider_info: {
    primary_provider: 'sky-scrapper',
    primary_provider_offer_id: 'sk-9f1e2c',
    cross_check_provider: 'google-flights',
    cross_check_offer_id: 'gf-771ab3',
    cross_check_disagreement_pct: 0.018, // 1.8 %
    price_freshness_seconds: 31,
  },

  reasons: [
    { code: 'price_below_p10', severity: 'positive',
      message: 'This price is in the bottom 10% of what we\'ve seen for this route.' },
    { code: 'rolling_min_30', severity: 'positive',
      message: 'Lower than every price recorded for this route in the past 30 days.' },
  ],
  comparison_anchor: {
    anchor_type: 'training_quantile',
    anchor_value_usd: 905.00,
    description: 'Compared against the historical 10th percentile of $905 for this route.',
  },
  short_message: 'Good price — buying now is reasonable.',

  technical_details: {
    model_version: 'ensemble_ttd_switch@2026.03',
    q10: 760.0, q50: 940.0, q90: 1180.0,
    conformal_half_width: 95.0,
    gates_passed: ['route_known', 'fresh_price', 'cross_check_ok'],
  },

  can_autobuy: true,
  ml_available: true,

  bundle_context: null,
};
```

### 22.2 Complete — `WAIT` flight (mission scan)

```ts
const example_wait_flight: LargoAdvice = {
  schema_version: '0.1.0',

  advice_id: '01HZQK9D2C7E1MA8YV4S6KJ0XB',
  user_id: 'usr_3f9a2c',
  mission_id: 'msn_8b1d77',
  surface: 'mission_scan',

  generated_at: '2026-04-26T02:15:04Z',
  valid_until:  '2026-04-26T14:15:04Z',

  action: 'WAIT',
  confidence_label: 'moderate',
  numeric_value: 0.41,

  product_type: 'flight',
  product_context: {
    origin: 'CDG',
    destination: 'JFK',
    outbound_date: '2026-07-04',
    inbound_date:  '2026-07-18',
    passengers_adults: 2,
    passengers_children: 0,
    passengers_infants: 0,
  },
  product_specific: {
    product_type: 'flight',
    airline_code: 'AF',
    stops: 0,
    cabin: 'economy',
    is_round_trip: true,
    outbound_duration_minutes: 495,
    inbound_duration_minutes:  445,
  },

  price_observation: {
    observed_price_usd: 940.00,
    observed_currency_original: 'EUR',
    observed_price_original: 870.00,
    fx_rate_to_usd: 1.0805,
    fx_observed_at: '2026-04-26T02:14:58Z',
    price_missing_reason: null,
  },

  provider_info: {
    primary_provider: 'sky-scrapper',
    primary_provider_offer_id: 'sk-2a8f04',
    cross_check_provider: null,
    cross_check_offer_id: null,
    cross_check_disagreement_pct: null,
    price_freshness_seconds: 88,
  },

  reasons: [
    { code: 'above_median_30', severity: 'cautionary',
      message: 'Higher than the median price observed in the last 30 days.' },
  ],
  comparison_anchor: {
    anchor_type: 'rolling_median_30',
    anchor_value_usd: 880.00,
    description: 'Median over the last 30 days is around $880 for this route.',
  },
  short_message: 'Above-average price — we\'d watch a bit longer.',

  technical_details: {
    model_version: 'ensemble_ttd_switch@2026.03',
    q10: 780.0, q50: 880.0, q90: 1050.0,
    conformal_half_width: 110.0,
  },

  can_autobuy: false,                  // not BUY_NOW
  ml_available: true,

  bundle_context: null,
};
```

### 22.3 Complete — `ABSTAIN` flight, no price (provider down)

```ts
const example_abstain_no_price: LargoAdvice = {
  schema_version: '0.1.0',

  advice_id: '01HZQKB7F1J3R8KQ4M9X2T6YDE',
  user_id: null,
  mission_id: null,
  surface: 'simple_search',

  generated_at: '2026-04-26T14:30:00Z',
  valid_until:  '2026-04-26T15:00:00Z', // short — re-fetch soon

  action: 'ABSTAIN',
  confidence_label: 'unavailable',
  numeric_value: null,

  product_type: 'flight',
  product_context: {
    origin: 'TLS',
    destination: 'BCN',
    outbound_date: '2026-08-10',
    inbound_date: null,                 // one-way
    passengers_adults: 1,
    passengers_children: 0,
    passengers_infants: 0,
  },
  product_specific: {
    product_type: 'flight',
    airline_code: null,                 // no offer retrievable
    stops: null,                        // unknown
    cabin: null,
    is_round_trip: false,
    outbound_duration_minutes: null,
    inbound_duration_minutes: null,
  },

  price_observation: {
    observed_price_usd: null,
    observed_currency_original: null,
    observed_price_original: null,
    fx_rate_to_usd: null,
    fx_observed_at: null,
    price_missing_reason: 'provider_timeout',
  },

  provider_info: {
    primary_provider: null,
    primary_provider_offer_id: null,
    cross_check_provider: null,
    cross_check_offer_id: null,
    cross_check_disagreement_pct: null,
    price_freshness_seconds: null,
  },

  reasons: [
    { code: 'price_unavailable', severity: 'blocking',
      message: 'We can\'t fetch a current price right now.' },
  ],
  comparison_anchor: null,
  short_message: 'Price unavailable right now — we\'ll keep trying.',

  technical_details: {
    attempted_providers: ['sky-scrapper', 'google-flights'],
    last_error: 'upstream_timeout_after_8s',
  },

  can_autobuy: false,
  ml_available: true,                   // ML is up; only the price feed failed

  bundle_context: null,
};
```

### 22.4 Partial — Bundle master + one component (referencing only)

The bundle master advice carries `BundleSpecific` with references; each component advice carries its own `bundle_context` pointing back. Only the distinguishing fields are shown.

```ts
const example_bundle_master_partial: Pick<
  LargoAdvice,
  'advice_id' | 'product_type' | 'product_specific' | 'bundle_context' | 'short_message'
> = {
  advice_id: '01HZQKC3M5N7Q9V2X4Z6B8D0FH',
  product_type: 'bundle',
  product_specific: {
    product_type: 'bundle',
    component_advice_ids: [
      '01HZQKC4P8R0T2W4Y6A8C0E2GJ', // flight component
      '01HZQKC5S1U3W5Y7A9C1E3G5JL', // hotel component
    ],
    global_budget_usd: 2400.00,
  },
  bundle_context: null,                 // master itself has no parent bundle
  short_message:
    'Lock the flight now; keep watching the hotel — total still within your $2,400 budget.',
};

const example_bundle_flight_component_partial: Pick<
  LargoAdvice,
  'advice_id' | 'product_type' | 'bundle_context' | 'short_message'
> = {
  advice_id: '01HZQKC4P8R0T2W4Y6A8C0E2GJ',
  product_type: 'flight',
  bundle_context: {
    bundle_id: '01HZQKC3M5N7Q9V2X4Z6B8D0FH',
    component_role: 'flight',
    total_components: 2,
  },
  short_message: 'Flight component: BUY_NOW (good price, refundable hotel still pending).',
};
```

### 22.5 Partial — ML down + provider disagreement (forced `WAIT`)

Only the distinguishing fields are shown. The advice falls back to baseline-only with `ml_available: false`, and a provider disagreement above threshold forces `can_autobuy: false`.

```ts
const example_degraded_partial: Pick<
  LargoAdvice,
  'action' | 'confidence_label' | 'reasons' | 'provider_info' | 'ml_available' | 'can_autobuy'
> = {
  action: 'WAIT',
  confidence_label: 'limited',
  reasons: [
    { code: 'ml_layer_unavailable', severity: 'blocking',
      message: 'Deep analysis is temporarily unavailable; advice based on baseline only.' },
    { code: 'provider_disagreement', severity: 'blocking',
      message: 'Sources disagree on the current price by more than 10%.' },
  ],
  provider_info: {
    primary_provider: 'sky-scrapper',
    primary_provider_offer_id: 'sk-44c1de',
    cross_check_provider: 'google-flights',
    cross_check_offer_id: 'gf-aa20f1',
    cross_check_disagreement_pct: 0.142, // 14.2 % > threshold
    price_freshness_seconds: 64,
  },
  ml_available: false,
  can_autobuy: false,
};
```

---

## 23. Open Questions

To be resolved in subsequent B0 documents:

1. **Per-product `valid_until` durations.** Defer to `LARGO_BACKEND_API_SPEC.md` and/or `LARGO_SECURITY_PAYMENTS.md`. The contract here only enforces presence and `valid_until > generated_at`.
2. **`cross_check_disagreement_pct` safety threshold.** Defer to `LARGO_SECURITY_PAYMENTS.md` (per-product calibration).
3. **Numeric → label thresholds.** Indicative numbers given in Section 7.2; authoritative mapping lives in `LARGO_MODEL_STRATEGY.md`.
4. **Retention policies for advice rows.** Defer to `LARGO_DATA_STRATEGY.md`. Sensitivity tagging (e.g., advices that touched a payment intent) is intentionally out of this contract version; if a tag is needed later, it will be added in the persistence schema or as a non-breaking optional field in a `0.x.0` minor bump.
5. **`price_missing_reason` canonical enum closure.** Phase 1 keeps the field free-form; closure to a strict enum will follow once usage stabilizes.
6. **Localization (`locale` field).** Out of scope for Phase 1 (English-only). Will be reopened when international expansion is on the roadmap.
7. **Side-table layout for oversized debug payloads.** Defer to `LARGO_DATA_STRATEGY.md` (the contract here only states the 4 KB soft cap and the principle of side-table offload).
8. **Schema evolution policy across major bumps.** Defer to a dedicated note when the first major bump is contemplated.
9. **`anchor_type` enum closure.** Phase 1 keeps it closed to the five values listed; broader catalog defers.
10. **Producer-side validation library distribution.** Whether a shared `@flyeas/largo-advice` package is published, and to whom, defers to `LARGO_BACKEND_API_SPEC.md`.

Each open question becomes a section in the corresponding successor document.

---

## 24. Document Status

- **B0 framing only.** This document defines a contract; it does not authorize implementation, code generation, migrations, or endpoints.
- **Coherence dependency:** any change to `LARGO_DOMINATION_STRATEGY.md` or `LARGO_PRODUCT_VISION.md` may invalidate parts of this contract; reviewers must re-read both predecessors before proposing changes here.
- **Implementation requires:** V7a-7 closure, the remaining B0 documents written and validated, and explicit founder authorization.
- **Versioning:** schema version defined here is `0.1.0`. Any field addition or removal requires a version bump per Section 2 and a changelog entry.
- **Authority:** technical source of truth for the Largo decision payload. Subordinate to founder decisions and to `LARGO_DOMINATION_STRATEGY.md` / `LARGO_PRODUCT_VISION.md`; superior to per-feature implementation plans.

---

*End of document.*
