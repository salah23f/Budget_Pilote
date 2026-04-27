/**
 * Largo — `produceStubLargoAdvice` (Sprint 1, B1, second code task).
 *
 * Deterministic, pure, contract-safe stub producer for `LargoAdvice` v0.1.0.
 * Closes the first vertical slice of B1:
 *
 *   StubLargoAdviceInput
 *      → produceStubLargoAdvice (this file)
 *      → LargoAdvice
 *      → stripToCustomerSafe (Sprint 1.1)
 *      → CustomerSafeAdvice
 *
 * What this producer is, by contract:
 *  - PURE. No I/O, no async, no fetch, no DB, no env access, no Date.now().
 *  - DETERMINISTIC. Same input → same output, byte-for-byte.
 *  - NON-MUTATING. The input object is structurally unchanged on return.
 *  - ABSTAIN-honest. Out-of-distribution / null inputs produce ABSTAIN, never
 *    a fabricated BUY_NOW (per `LARGO_MODEL_STRATEGY.md` §21, §25.4, §37 row 12).
 *  - NULL-PRESERVING. Never coerces `observed_price_usd: null` to 0;
 *    never invents a provider when `primary_provider: null`.
 *  - NO-FAKE-CONFIDENCE. When `ml_available === false`, `numeric_value: null`
 *    and `confidence_label !== 'high'` (per `LARGO_MODEL_STRATEGY.md` §18.5,
 *    §37 row 17).
 *  - PHASE-1 SAFE. `can_autobuy` is always `false`
 *    (per `LARGO_ADVICE_CONTRACT.md` §6 + Phase 1 anchor in
 *    `docs/b1/B1_IMPLEMENTATION_PLAN.md` §4 anchor 2).
 *
 * What this producer is NOT:
 *  - NOT a production model. Numeric values populated for testing strip-rule
 *    enforcement; never claim calibration. Model attribution string is
 *    intentionally `'stub_producer@0.1.0'` to avoid confusion with V7a or
 *    V7.6 Ultra artefacts.
 *  - NOT an endpoint. No request/response handling, no HTTP, no validation
 *    framework. Future API routes will compose this with a validator.
 *  - NOT a provider call. `primary_provider` is taken from input verbatim.
 *  - NOT an ML call. No model invocation. The "scenario" tag is a label,
 *    not a model output.
 *  - NOT auto-buy. `can_autobuy` is locked to `false`.
 *
 * Sources of truth (read these before extending this file):
 *  - `docs/b0/LARGO_ADVICE_CONTRACT.md` §3 (enums), §4 (master interface),
 *    §6 (`can_autobuy` semantics), §8–§17 (sub-shapes).
 *  - `docs/b0/LARGO_BACKEND_API_SPEC.md` §10 (strip rule — strip uses the
 *    fields this producer emits).
 *  - `docs/b0/LARGO_MODEL_STRATEGY.md` §4 (forbidden), §21 (ABSTAIN), §25.4
 *    (never default to BUY_NOW), §37 (forbidden patterns table).
 *  - `docs/b1/B1_IMPLEMENTATION_PLAN.md` §4 (Phase 1 anchors), §7 (purity),
 *    §12 (Sprint 1 first code), §19 (test invariants).
 *  - `docs/b1/CLAUDE_CODE_RULES.md` §10 (no auto-buy), §11 (no numeric
 *    confidence to customer), §17 (no scope creep).
 */

import type {
  ComparisonAnchor,
  ContractVersion,
  FlightSpecific,
  LargoAdvice,
  LargoAdviceAction,
  LargoConfidenceLabel,
  LargoSurface,
  PriceObservation,
  ProductContext,
  ProviderInfo,
  Reason,
} from '@/types/largo/advice';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Frozen contract version. Source: `LARGO_ADVICE_CONTRACT.md` §3. */
const SCHEMA_VERSION: ContractVersion = '0.1.0';

/**
 * Stub model attribution. Intentionally distinct from `v7a@*`,
 * `ensemble_ttd_switch@*`, or any V7.6 Ultra version string so audit logs
 * cannot confuse stub output with real model output.
 */
const STUB_MODEL_VERSION = 'stub_producer@0.1.0';

/** Default validity window when caller does not pin `valid_until_iso`. */
const DEFAULT_VALIDITY_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours

// -----------------------------------------------------------------------------
// Public input type
// -----------------------------------------------------------------------------

/** Surface labels accepted by the stub. Maps to `LargoSurface` internally. */
export type StubSurface = 'simple_search' | 'mission';

/** Cabin classes accepted by the stub. Mirrors `FlightSpecific.cabin` (non-null). */
export type StubCabinClass = 'economy' | 'premium_economy' | 'business' | 'first';

/**
 * Scenario label, optional. Acts as a *tag* on `technical_details`; it never
 * overrides explicit input fields. The action is derived from explicit signals
 * (price, provider, route_known, disagreement, ml_available); scenario only
 * disambiguates BUY_NOW vs WAIT when no inhibitor is set.
 */
export type StubScenario =
  | 'buy_now_good_price'
  | 'wait_high_price'
  | 'abstain_route_unknown'
  | 'abstain_provider_unavailable'
  | 'provider_disagreement'
  | 'ml_unavailable';

/**
 * Minimal, explicit input for the stub. Intentionally smaller than the full
 * production API request contract; it covers what a Sprint 1 vertical slice
 * needs to demonstrate `producer → strip → CustomerSafeAdvice`.
 */
export interface StubLargoAdviceInput {
  // ---- Identification & surface --------------------------------------------
  surface: StubSurface;
  user_id?: string | null;
  mission_id?: string | null;
  /** Optional override; if absent, derived deterministically from input. */
  advice_id?: string;

  // ---- Product context (route + party) -------------------------------------
  origin_iata: string;
  destination_iata: string;
  departure_date: string;
  return_date?: string | null;
  passengers: number;
  cabin_class: StubCabinClass;

  // ---- Price observation ----------------------------------------------------
  observed_price_usd: number | null;
  observed_currency_original?: string | null;
  original_price?: number | null;
  fx_rate_to_usd?: number | null;

  // ---- Provider info --------------------------------------------------------
  primary_provider: string | null;
  price_freshness_seconds?: number | null;

  // ---- Decision signals -----------------------------------------------------
  route_known_to_model: boolean;
  provider_disagreement?: boolean;
  ml_available?: boolean;

  // ---- Temporal -------------------------------------------------------------
  /** Required ISO-8601 timestamp; the producer MUST NOT call `Date.now()`. */
  now_iso: string;
  /** If absent, defaults to `now_iso + 6h`. */
  valid_until_iso?: string;

  // ---- Scenario tag (optional) ---------------------------------------------
  scenario?: StubScenario;
}

// -----------------------------------------------------------------------------
// Internal helpers (pure, deterministic)
// -----------------------------------------------------------------------------

/** Map the stub's surface label to the contract `LargoSurface` enum. */
function mapSurface(surface: StubSurface): LargoSurface {
  return surface === 'mission' ? 'mission_scan' : 'simple_search';
}

/**
 * Derive a deterministic `advice_id` when the caller does not supply one.
 * Not a ULID; intentionally tagged with `STUB-` so it cannot be mistaken for
 * a real production identifier in audit logs.
 */
function deriveAdviceId(input: StubLargoAdviceInput): string {
  const tag = input.scenario ?? 'default';
  const date = input.departure_date.replace(/-/g, '');
  const now = input.now_iso
    .replace(/[-:]/g, '')
    .replace('T', '')
    .replace('Z', '')
    .replace(/\..*$/, '')
    .slice(0, 14);
  return `STUB-${tag}-${input.origin_iata}-${input.destination_iata}-${date}-${now}`;
}

/**
 * Compute `valid_until` from `now_iso + 6h` when caller does not pin one.
 * `Date` arithmetic on a known string is pure (no clock dependency).
 */
function defaultValidUntilIso(nowIso: string): string {
  const generatedAt = new Date(nowIso);
  return new Date(generatedAt.getTime() + DEFAULT_VALIDITY_WINDOW_MS).toISOString();
}

/**
 * Action derivation. Conservative ordering: ABSTAIN preconditions FIRST;
 * BUY_NOW only when every inhibitor is absent and the scenario explicitly
 * authorizes it.
 *
 * Rationale: `LARGO_MODEL_STRATEGY.md` §25.4 forbids defaulting *to* BUY_NOW
 * under failure; the safe direction is downward (BUY_NOW → MONITOR → ABSTAIN).
 */
function deriveAction(input: StubLargoAdviceInput): LargoAdviceAction {
  if (input.observed_price_usd === null) return 'ABSTAIN';
  if (input.primary_provider === null) return 'ABSTAIN';
  if (input.route_known_to_model === false) return 'ABSTAIN';
  if (input.provider_disagreement === true) return 'WAIT';
  if (input.ml_available === false) return 'WAIT';
  if (input.scenario === 'buy_now_good_price') return 'BUY_NOW';
  // Default and 'wait_high_price' both map here — conservative.
  return 'WAIT';
}

/**
 * Confidence label derivation. Customer-facing semantic only; numeric values
 * are admin-only and live in `numeric_value`.
 */
function deriveConfidenceLabel(
  input: StubLargoAdviceInput,
  action: LargoAdviceAction,
): LargoConfidenceLabel {
  if (action === 'ABSTAIN') return 'unavailable';
  if (input.ml_available === false) return 'limited';
  if (input.provider_disagreement === true) return 'limited';
  if (action === 'BUY_NOW') return 'high';
  return 'moderate';
}

/**
 * Internal admin-only `numeric_value`. Stripped by `stripToCustomerSafe`.
 *
 * Hard rule: when `ml_available === false`, the calibrated number is `null`.
 * Never fabricate calibration (per `LARGO_MODEL_STRATEGY.md` §18.5 and §37
 * row 17).
 */
function deriveNumericValue(
  input: StubLargoAdviceInput,
  action: LargoAdviceAction,
): number | null {
  if (action === 'ABSTAIN') return null;
  if (input.ml_available === false) return null;
  if (input.provider_disagreement === true) return 0.32;
  if (action === 'BUY_NOW') return 0.78;
  return 0.41;
}

/**
 * Customer-facing reasons. Codes drawn from `LARGO_ADVICE_CONTRACT.md` §12.2
 * reserved set; messages are short, plain-language, no marketing tone.
 */
function buildReasons(
  input: StubLargoAdviceInput,
  action: LargoAdviceAction,
): Reason[] {
  if (action === 'ABSTAIN') {
    if (input.observed_price_usd === null) {
      return [
        {
          code: 'price_unavailable',
          severity: 'blocking',
          message: "We can't fetch a current price right now.",
        },
      ];
    }
    if (input.primary_provider === null) {
      return [
        {
          code: 'provider_unavailable',
          severity: 'blocking',
          message: 'No provider could quote this route right now.',
        },
      ];
    }
    if (input.route_known_to_model === false) {
      return [
        {
          code: 'route_unknown_to_model',
          severity: 'blocking',
          message: "Not enough recent data on this specific route to be sure.",
        },
      ];
    }
    return [
      {
        code: 'unspecified_abstain',
        severity: 'blocking',
        message: "We're holding off on a recommendation for this query.",
      },
    ];
  }

  // Non-ABSTAIN branches — order matters: provider_disagreement and
  // ml_layer_unavailable carry blocking severity that constrains the action
  // to WAIT and must surface to the customer as the primary explanation.
  if (input.provider_disagreement === true) {
    return [
      {
        code: 'provider_disagreement',
        severity: 'blocking',
        message: 'Sources disagree on the current price by more than 10%.',
      },
    ];
  }
  if (input.ml_available === false) {
    return [
      {
        code: 'ml_layer_unavailable',
        severity: 'blocking',
        message:
          'Deep analysis temporarily unavailable; advice based on baseline only.',
      },
    ];
  }

  if (action === 'BUY_NOW') {
    return [
      {
        code: 'price_below_p10',
        severity: 'positive',
        message:
          "This price is in the bottom 10% of what we've seen for this route.",
      },
    ];
  }

  // Default WAIT.
  return [
    {
      code: 'above_median_30',
      severity: 'cautionary',
      message: 'Higher than the median price observed in the last 30 days.',
    },
  ];
}

/** Customer-facing one-liner; Phase 1 English only. */
function buildShortMessage(
  input: StubLargoAdviceInput,
  action: LargoAdviceAction,
): string {
  if (action === 'BUY_NOW') return 'Good price — buying now is reasonable.';
  if (action === 'ABSTAIN') {
    if (input.observed_price_usd === null) {
      return "Price unavailable right now — we'll keep trying.";
    }
    if (input.primary_provider === null) {
      return 'No provider could quote this route right now.';
    }
    if (input.route_known_to_model === false) {
      return "We don't have enough history on this route to advise yet.";
    }
    return "We're holding off on a recommendation for now.";
  }
  if (input.provider_disagreement === true) {
    return 'Our sources disagree on this fare — we will wait.';
  }
  if (input.ml_available === false) {
    return 'Limited analysis right now — baseline says wait.';
  }
  return "Above-average price — we'd watch a bit longer.";
}

/**
 * Comparison anchor. Suppressed when ABSTAIN (no useful number); for
 * BUY_NOW/WAIT, anchored to a deterministic ratio of the observed price so
 * stub output looks coherent without fabricating market data.
 */
function buildComparisonAnchor(
  input: StubLargoAdviceInput,
  action: LargoAdviceAction,
): ComparisonAnchor | null {
  if (action === 'ABSTAIN') return null;
  if (input.observed_price_usd === null) return null;
  if (action === 'BUY_NOW') {
    return {
      anchor_type: 'training_quantile',
      anchor_value_usd: roundCents(input.observed_price_usd * 1.15),
      description:
        'Compared against the historical 10th percentile for this route.',
    };
  }
  return {
    anchor_type: 'rolling_median_30',
    anchor_value_usd: roundCents(input.observed_price_usd * 0.92),
    description: 'Median over the last 30 days for this route.',
  };
}

/**
 * Admin-only debug payload. Stripped by `stripToCustomerSafe`. Tests inject
 * values here precisely so the strip rule has something to remove and we can
 * assert the customer view never carries them.
 */
function buildTechnicalDetails(
  input: StubLargoAdviceInput,
  action: LargoAdviceAction,
): Record<string, unknown> {
  const details: Record<string, unknown> = {
    model_version: STUB_MODEL_VERSION,
    scenario: input.scenario ?? 'default',
    derived_action: action,
  };
  if (input.observed_price_usd !== null && action !== 'ABSTAIN') {
    details.q10 = roundCents(input.observed_price_usd * 0.85);
    details.q50 = roundCents(input.observed_price_usd * 1.05);
    details.q90 = roundCents(input.observed_price_usd * 1.3);
  }
  if (input.provider_disagreement === true) {
    details.cross_check_price =
      input.observed_price_usd === null
        ? null
        : roundCents(input.observed_price_usd * 0.875);
  }
  if (input.ml_available === false) {
    details.fallback_reason = 'ml_service_timeout';
  }
  return details;
}

/**
 * Provider info. `primary_provider: null` is preserved exactly. When the
 * caller flags `provider_disagreement`, we populate the `cross_check_*`
 * admin-only fields so the strip function can replace them with the
 * semantic `disagreement_summary` per `BACKEND_API_SPEC.md` §10.
 */
function buildProviderInfo(input: StubLargoAdviceInput): ProviderInfo {
  const disagreement = input.provider_disagreement === true;
  const noProvider = input.primary_provider === null;
  return {
    primary_provider: input.primary_provider,
    primary_provider_offer_id: noProvider
      ? null
      : `stub-offer-${input.origin_iata.toLowerCase()}-${input.destination_iata.toLowerCase()}`,
    cross_check_provider: disagreement ? 'stub-cross-check' : null,
    cross_check_offer_id: disagreement
      ? `stub-cross-${input.origin_iata.toLowerCase()}-${input.destination_iata.toLowerCase()}`
      : null,
    cross_check_disagreement_pct: disagreement ? 0.142 : null,
    price_freshness_seconds:
      input.price_freshness_seconds ?? (noProvider ? null : 30),
  };
}

/**
 * Build `PriceObservation`. The four nullable price fields are coupled:
 * if `observed_price_usd` is null, the others are null and
 * `price_missing_reason` is non-empty (per `LARGO_ADVICE_CONTRACT.md` §9).
 *
 * Stub limitation: when caller passes a non-USD `observed_currency_original`
 * without an explicit `original_price`, `observed_price_original` defaults to
 * the USD value (assumed USD-native). Tests must pass `original_price`
 * explicitly to exercise non-USD scenarios.
 */
function buildPriceObservation(input: StubLargoAdviceInput): PriceObservation {
  if (input.observed_price_usd === null) {
    return {
      observed_price_usd: null,
      observed_currency_original: input.observed_currency_original ?? null,
      observed_price_original: input.original_price ?? null,
      fx_rate_to_usd: input.fx_rate_to_usd ?? null,
      fx_observed_at: null,
      price_missing_reason: 'provider_timeout',
    };
  }
  return {
    observed_price_usd: input.observed_price_usd,
    observed_currency_original: input.observed_currency_original ?? 'USD',
    observed_price_original: input.original_price ?? input.observed_price_usd,
    fx_rate_to_usd: input.fx_rate_to_usd ?? 1.0,
    fx_observed_at: input.now_iso,
    price_missing_reason: null,
  };
}

/** Build `ProductContext`. Children/infants are always 0 in this stub. */
function buildProductContext(input: StubLargoAdviceInput): ProductContext {
  return {
    origin: input.origin_iata,
    destination: input.destination_iata,
    outbound_date: input.departure_date,
    inbound_date: input.return_date ?? null,
    passengers_adults: input.passengers,
    passengers_children: 0,
    passengers_infants: 0,
  };
}

/**
 * Build `FlightSpecific`. Phase 1 emits only `product_type === 'flight'`.
 * `airline_code` is never invented (always `null` in this stub); a real
 * producer pairs it with provider data.
 */
function buildFlightSpecific(input: StubLargoAdviceInput): FlightSpecific {
  const isRoundTrip = input.return_date != null && input.return_date !== '';
  return {
    product_type: 'flight',
    airline_code: null,
    stops: input.route_known_to_model ? 0 : null,
    cabin: input.cabin_class,
    is_round_trip: isRoundTrip,
    outbound_duration_minutes: input.route_known_to_model ? 240 : null,
    inbound_duration_minutes:
      isRoundTrip && input.route_known_to_model ? 240 : null,
  };
}

/** Round to two decimal places. Pure. */
function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Produce a full `LargoAdvice` v0.1.0 object from a small explicit input.
 *
 * Pure, deterministic, non-mutating. Output includes admin-only fields
 * (`numeric_value`, `technical_details`, `audit_block`) so that the strip
 * function has something to remove; customer code MUST consume the output of
 * `stripToCustomerSafe(produceStubLargoAdvice(input))`, not this function's
 * output directly.
 *
 * Phase 1 anchors enforced:
 *  - `schema_version === '0.1.0'`.
 *  - `can_autobuy === false` always.
 *  - `null` price preserved; never coerced to 0.
 *  - `null` provider preserved; never coerced.
 *  - ABSTAIN is a first-class action (returned for null price / null provider
 *    / unknown route).
 *  - Provider disagreement never resolves to BUY_NOW.
 *  - `ml_available === false` ⇒ `numeric_value === null` and
 *    `confidence_label !== 'high'`.
 *
 * @param input Small, explicit, contract-safe input.
 * @returns A fresh, structurally complete `LargoAdvice`.
 */
export function produceStubLargoAdvice(
  input: StubLargoAdviceInput,
): LargoAdvice {
  const surface = mapSurface(input.surface);
  const action = deriveAction(input);
  const confidence_label = deriveConfidenceLabel(input, action);
  const numeric_value = deriveNumericValue(input, action);
  const reasons = buildReasons(input, action);
  const comparison_anchor = buildComparisonAnchor(input, action);
  const short_message = buildShortMessage(input, action);
  const technical_details = buildTechnicalDetails(input, action);
  const provider_info = buildProviderInfo(input);
  const price_observation = buildPriceObservation(input);
  const product_context = buildProductContext(input);
  const product_specific = buildFlightSpecific(input);

  const advice_id = input.advice_id ?? deriveAdviceId(input);
  const generated_at = input.now_iso;
  const valid_until = input.valid_until_iso ?? defaultValidUntilIso(input.now_iso);
  // Default `ml_available: true` unless explicitly `false`.
  const ml_available = input.ml_available !== false;

  return {
    // ---- Schema -----------------------------------------------------------
    schema_version: SCHEMA_VERSION,

    // ---- Identification ---------------------------------------------------
    advice_id,
    user_id: input.user_id ?? null,
    mission_id: input.mission_id ?? null,
    surface,

    // ---- Temporal ---------------------------------------------------------
    generated_at,
    valid_until,

    // ---- Decision (numeric_value is admin-only; stripped before customer) -
    action,
    confidence_label,
    numeric_value,

    // ---- Product context --------------------------------------------------
    product_type: 'flight',
    product_context,
    product_specific,

    // ---- Price (null preserved; never coerced to 0) -----------------------
    price_observation,

    // ---- Provider (null preserved; cross_check_* admin-only, stripped) ----
    provider_info,

    // ---- Explanation ------------------------------------------------------
    reasons,
    comparison_anchor,
    short_message,

    // ---- Technical (admin-only; stripped before customer) -----------------
    technical_details,

    // ---- Capability flags -------------------------------------------------
    /**
     * Phase 1 anchor: `can_autobuy` is ALWAYS `false` in this stub.
     * Source: `LARGO_ADVICE_CONTRACT.md` §6 + `B1_IMPLEMENTATION_PLAN.md`
     * §4 anchor 2 ("no live auto-buy", "no silent auto-buy").
     */
    can_autobuy: false,
    ml_available,

    // ---- Bundle context ---------------------------------------------------
    bundle_context: null,

    // ---- Audit envelope (admin-only; stripped before customer) ------------
    audit_block: {
      audit_id: advice_id, // Phase 1 invariant: audit_id === advice_id.
      parent_advice_id: null,
    },
  };
}

// -----------------------------------------------------------------------------
// Internal-only re-exports for tests (do NOT import from customer code)
// -----------------------------------------------------------------------------

/**
 * Internal helpers exposed for unit testing only. Not part of the public API.
 * Customer code MUST NOT import these — use `produceStubLargoAdvice` instead.
 *
 * @internal
 */
export const __internal = Object.freeze({
  SCHEMA_VERSION,
  STUB_MODEL_VERSION,
  DEFAULT_VALIDITY_WINDOW_MS,
  mapSurface,
  deriveAdviceId,
  defaultValidUntilIso,
  deriveAction,
  deriveConfidenceLabel,
  deriveNumericValue,
});
