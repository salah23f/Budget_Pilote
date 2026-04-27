/**
 * Largo — extended `LargoAdvice` fixtures (Sprint 2.1, B1).
 *
 * 13 deterministic, contract-safe fixtures covering the UI-critical states
 * named in `docs/b0/LARGO_FRONTEND_UX_SPEC.md` plus a few useful edge cases.
 * Each fixture is a `LargoAdvice` v0.1.0 that:
 *
 *   1. passes `validateLargoAdvice` (Sprint 1.3),
 *   2. survives `stripToCustomerSafe` (Sprint 1.1) without throwing,
 *   3. respects every Phase 1 anchor (`product_type === 'flight'`,
 *      `can_autobuy === false`, `audit_block.audit_id === advice_id`),
 *   4. preserves null price and null provider when the scenario warrants
 *      (no fake-zero, no fake-provider).
 *
 * Construction strategy:
 *  - For states the producer (`produceStubLargoAdvice`, Sprint 1.2) emits
 *    natively (BUY_NOW, WAIT, ABSTAIN, provider disagreement, ML unavailable),
 *    the fixture is the producer's output evaluated once at module load.
 *  - For states the producer does NOT emit (BUY_NOW moderate, MONITOR, ALERT,
 *    anonymous-quota-exceeded placeholder, manual_check surface), the fixture
 *    is a deep clone of a producer output with minimum-field overrides. The
 *    helper `withOverrides` keeps the Phase 1 audit invariant
 *    (`audit_block.audit_id === advice_id`) intact when `advice_id` is
 *    overridden.
 *  - Deep clone uses `JSON.parse(JSON.stringify(base))`, which is safe because
 *    `LargoAdvice` is plain JSON (no functions, Dates, Maps, Sets).
 *
 * What this file is NOT:
 *  - NOT a React component (Sprint 4+).
 *  - NOT an endpoint (Sprint 3+).
 *  - NOT a rate limiter / quota enforcement (the anonymous-quota fixture is
 *    a UI placeholder; it does not enforce anything).
 *  - NOT a producer extension (`lib/largo/producer/stub.ts` is unchanged;
 *    overrides happen here in the fixture file).
 *  - NOT a hotel/car/bundle fixture (Phase 1 = flights only).
 *
 * Sources of truth:
 *  - `docs/b0/LARGO_ADVICE_CONTRACT.md` §3 (enums), §4 (master interface),
 *    §6 (`can_autobuy`), §8–§17 (sub-shapes), §20 (forbidden patterns).
 *  - `docs/b0/LARGO_FRONTEND_UX_SPEC.md` §4 (customer-safe view fields),
 *    §41 (forbidden UI patterns).
 *  - `docs/b1/B1_IMPLEMENTATION_PLAN.md` §4 (Phase 1 anchors), §13
 *    (Sprint 2 deliverable: fixtures + validator).
 *  - `docs/b1/CLAUDE_CODE_RULES.md` §10 (no auto-buy), §11 (no numeric
 *    confidence to customer), §17 (no scope creep).
 */

import type { AuditBlock, LargoAdvice } from '@/types/largo/advice';
import {
  produceStubLargoAdvice,
  type StubLargoAdviceInput,
} from '@/lib/largo/producer/stub';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Frozen "now" used by every fixture for deterministic timestamps. */
const NOW_ISO = '2026-04-27T10:00:00.000Z';

/** A clearly-past timestamp used by the expired-advice fixture. */
const PAST_ISO = '2026-04-20T16:00:00.000Z';

// -----------------------------------------------------------------------------
// Internal helpers — pure, non-mutating
// -----------------------------------------------------------------------------

/**
 * Deep-clone an advice via JSON round-trip. Safe because `LargoAdvice` is
 * plain JSON (no functions, no `Date`, no `Map`, no `Set`).
 */
function deepCloneAdvice(advice: LargoAdvice): LargoAdvice {
  return JSON.parse(JSON.stringify(advice)) as LargoAdvice;
}

/**
 * Build a fresh advice from a base + sparse overrides. Keeps the Phase 1
 * invariant `audit_block.audit_id === advice_id` automatically when
 * `advice_id` is overridden.
 *
 * Overrides are applied at the top level only; for nested fields the caller
 * passes the full sub-object (e.g. `{ price_observation: { ...base.price_observation, ... } }`).
 */
function withOverrides(
  base: LargoAdvice,
  overrides: Partial<LargoAdvice>,
): LargoAdvice {
  const cloned = deepCloneAdvice(base);
  const merged: LargoAdvice = { ...cloned, ...overrides };
  if (merged.audit_block) {
    const ab: AuditBlock = {
      ...merged.audit_block,
      audit_id: merged.advice_id,
    };
    merged.audit_block = ab;
  }
  return merged;
}

// -----------------------------------------------------------------------------
// Producer input builders (deterministic, illustrative)
// -----------------------------------------------------------------------------

function buyNowGoodPriceInput(): StubLargoAdviceInput {
  return {
    surface: 'simple_search',
    user_id: null,
    mission_id: null,
    origin_iata: 'JFK',
    destination_iata: 'NRT',
    departure_date: '2026-06-12',
    return_date: '2026-06-26',
    passengers: 1,
    cabin_class: 'economy',
    observed_price_usd: 812.4,
    observed_currency_original: 'USD',
    original_price: 812.4,
    fx_rate_to_usd: 1.0,
    primary_provider: 'sky-scrapper',
    price_freshness_seconds: 31,
    route_known_to_model: true,
    provider_disagreement: false,
    ml_available: true,
    now_iso: NOW_ISO,
    scenario: 'buy_now_good_price',
  };
}

function waitHighPriceInput(): StubLargoAdviceInput {
  return {
    surface: 'mission',
    user_id: 'usr_extended',
    mission_id: 'msn_extended_wait',
    origin_iata: 'CDG',
    destination_iata: 'JFK',
    departure_date: '2026-07-04',
    return_date: '2026-07-18',
    passengers: 2,
    cabin_class: 'economy',
    observed_price_usd: 940.0,
    observed_currency_original: 'EUR',
    original_price: 870.0,
    fx_rate_to_usd: 1.0805,
    primary_provider: 'sky-scrapper',
    price_freshness_seconds: 88,
    route_known_to_model: true,
    provider_disagreement: false,
    ml_available: true,
    now_iso: NOW_ISO,
    scenario: 'wait_high_price',
  };
}

function abstainRouteUnknownInput(): StubLargoAdviceInput {
  return {
    surface: 'simple_search',
    origin_iata: 'TLS',
    destination_iata: 'BCN',
    departure_date: '2026-08-10',
    return_date: null,
    passengers: 1,
    cabin_class: 'economy',
    observed_price_usd: 142.5,
    observed_currency_original: 'EUR',
    original_price: 132.0,
    fx_rate_to_usd: 1.0795,
    primary_provider: 'sky-scrapper',
    price_freshness_seconds: 12,
    route_known_to_model: false,
    provider_disagreement: false,
    ml_available: true,
    now_iso: NOW_ISO,
    scenario: 'abstain_route_unknown',
  };
}

function abstainProviderUnavailableInput(): StubLargoAdviceInput {
  return {
    surface: 'simple_search',
    origin_iata: 'LHR',
    destination_iata: 'BCN',
    departure_date: '2026-09-15',
    return_date: '2026-09-22',
    passengers: 1,
    cabin_class: 'economy',
    observed_price_usd: null,
    observed_currency_original: null,
    original_price: null,
    fx_rate_to_usd: null,
    primary_provider: null,
    price_freshness_seconds: null,
    route_known_to_model: true,
    provider_disagreement: false,
    ml_available: true,
    now_iso: NOW_ISO,
    scenario: 'abstain_provider_unavailable',
  };
}

function providerDisagreementInput(): StubLargoAdviceInput {
  return {
    surface: 'simple_search',
    user_id: 'usr_extended_disagree',
    mission_id: null,
    origin_iata: 'SFO',
    destination_iata: 'LAX',
    departure_date: '2026-06-15',
    return_date: '2026-06-22',
    passengers: 1,
    cabin_class: 'economy',
    observed_price_usd: 320.0,
    observed_currency_original: 'USD',
    original_price: 320.0,
    fx_rate_to_usd: 1.0,
    primary_provider: 'sky-scrapper',
    price_freshness_seconds: 64,
    route_known_to_model: true,
    provider_disagreement: true,
    ml_available: true,
    now_iso: NOW_ISO,
    scenario: 'provider_disagreement',
  };
}

function mlUnavailableInput(): StubLargoAdviceInput {
  return {
    surface: 'simple_search',
    user_id: 'usr_extended_ml',
    mission_id: null,
    origin_iata: 'YYZ',
    destination_iata: 'MIA',
    departure_date: '2026-12-20',
    return_date: '2026-12-28',
    passengers: 2,
    cabin_class: 'economy',
    observed_price_usd: 545.0,
    observed_currency_original: 'CAD',
    original_price: 745.0,
    fx_rate_to_usd: 0.7315,
    primary_provider: 'sky-scrapper',
    price_freshness_seconds: 18,
    route_known_to_model: true,
    provider_disagreement: false,
    ml_available: false,
    now_iso: NOW_ISO,
    scenario: 'ml_unavailable',
  };
}

function expiredBuyNowInput(): StubLargoAdviceInput {
  return {
    ...buyNowGoodPriceInput(),
    advice_id: 'STUB-extended-expired-jfk-nrt',
    valid_until_iso: PAST_ISO,
  };
}

function oneWayBuyNowInput(): StubLargoAdviceInput {
  return {
    ...buyNowGoodPriceInput(),
    advice_id: 'STUB-extended-oneway-jfk-nrt',
    return_date: null,
  };
}

// -----------------------------------------------------------------------------
// Fixture 1 — BUY_NOW high confidence
// -----------------------------------------------------------------------------

/**
 * Standard happy path: route known, provider present, price present,
 * no disagreement, ML available. Producer maps this directly to BUY_NOW + high.
 */
export const fixtureExtendedBuyNowHigh: LargoAdvice =
  produceStubLargoAdvice(buyNowGoodPriceInput());

// -----------------------------------------------------------------------------
// Fixture 2 — BUY_NOW moderate confidence
// -----------------------------------------------------------------------------

/**
 * Same shape as (1) but with the customer-facing semantic confidence
 * downgraded to `moderate` and `numeric_value` reduced. Useful for testing
 * that BUY_NOW does not require `confidence_label === 'high'`.
 */
export const fixtureExtendedBuyNowModerate: LargoAdvice = withOverrides(
  fixtureExtendedBuyNowHigh,
  {
    advice_id: 'STUB-extended-buy-now-moderate-jfk-nrt',
    confidence_label: 'moderate',
    numeric_value: 0.55,
    short_message: 'Decent price — buying now is reasonable.',
  },
);

// -----------------------------------------------------------------------------
// Fixture 3 — WAIT high price
// -----------------------------------------------------------------------------

/**
 * Above-median price; default WAIT semantic with the producer.
 */
export const fixtureExtendedWaitHighPrice: LargoAdvice = produceStubLargoAdvice(
  waitHighPriceInput(),
);

// -----------------------------------------------------------------------------
// Fixture 4 — MONITOR (no actionable change yet)
// -----------------------------------------------------------------------------

/**
 * MONITOR is not natively produced by the stub; we override a WAIT base.
 * The semantic: nothing has changed materially since the last advice; the
 * system is watching but not recommending action either way.
 */
export const fixtureExtendedMonitor: LargoAdvice = withOverrides(
  fixtureExtendedWaitHighPrice,
  {
    advice_id: 'STUB-extended-monitor-cdg-jfk',
    action: 'MONITOR',
    confidence_label: 'moderate',
    short_message: "We're keeping an eye on this fare.",
    reasons: [
      {
        code: 'awaiting_change_signal',
        severity: 'info',
        message: 'No meaningful change since the last check. Watching.',
      },
    ],
  },
);

// -----------------------------------------------------------------------------
// Fixture 5 — ALERT (meaningful change since last advice)
// -----------------------------------------------------------------------------

/**
 * ALERT also is not natively produced by the stub. Semantic: a noteworthy
 * positive change happened; the user should look. `confidence_label` is
 * `'high'` because the alert relies on a strong signal.
 */
export const fixtureExtendedAlert: LargoAdvice = withOverrides(
  fixtureExtendedWaitHighPrice,
  {
    advice_id: 'STUB-extended-alert-cdg-jfk',
    action: 'ALERT',
    confidence_label: 'high',
    short_message: 'Price just dropped — worth a fresh look.',
    reasons: [
      {
        code: 'meaningful_price_drop',
        severity: 'positive',
        message: 'Price dropped meaningfully since your last check.',
      },
    ],
  },
);

// -----------------------------------------------------------------------------
// Fixture 6 — ABSTAIN, route unknown
// -----------------------------------------------------------------------------

export const fixtureExtendedAbstainRouteUnknown: LargoAdvice =
  produceStubLargoAdvice(abstainRouteUnknownInput());

// -----------------------------------------------------------------------------
// Fixture 7 — ABSTAIN, provider unavailable (null price + null provider)
// -----------------------------------------------------------------------------

export const fixtureExtendedAbstainProviderUnavailable: LargoAdvice =
  produceStubLargoAdvice(abstainProviderUnavailableInput());

// -----------------------------------------------------------------------------
// Fixture 8 — Provider disagreement
// -----------------------------------------------------------------------------

/**
 * Cross-check disagreement above threshold. Producer emits WAIT (never
 * BUY_NOW) and includes the `provider_disagreement` reason code so the
 * strip rule maps to `disagreement_summary === 'disagree'`.
 */
export const fixtureExtendedProviderDisagreement: LargoAdvice =
  produceStubLargoAdvice(providerDisagreementInput());

// -----------------------------------------------------------------------------
// Fixture 9 — Expired advice (`valid_until` in the past)
// -----------------------------------------------------------------------------

/**
 * Structurally valid; expiration handling belongs to backend gates later.
 * The producer accepts a past `valid_until_iso` and does NOT silently change
 * the action because of it.
 */
export const fixtureExtendedExpiredAdvice: LargoAdvice = produceStubLargoAdvice(
  expiredBuyNowInput(),
);

// -----------------------------------------------------------------------------
// Fixture 10 — ML unavailable (no fake calibration)
// -----------------------------------------------------------------------------

/**
 * `ml_available: false` ⇒ `numeric_value: null`, `confidence_label: 'limited'`.
 * Strip never exposes ML internals.
 */
export const fixtureExtendedMlUnavailable: LargoAdvice = produceStubLargoAdvice(
  mlUnavailableInput(),
);

// -----------------------------------------------------------------------------
// Fixture 11 — Anonymous quota exceeded (UI placeholder)
// -----------------------------------------------------------------------------

/**
 * Phase 1 has no `ERROR` action in the contract enum. The anonymous-quota
 * UI state is modeled as ABSTAIN with a customer-facing reason code
 * `anonymous_quota_exceeded` and a clear sign-in prompt in `short_message`.
 *
 * This fixture does NOT enforce any quota — it is a placeholder so the
 * future UI has a structurally valid input to render against. The actual
 * quota enforcement belongs to a backend gate (Sprint 3+) and a
 * rate-limiter (Sprint 5+).
 *
 * Built from the provider-unavailable base (already null price + null
 * provider) with the reason and message overridden — keeps the contract
 * shape minimal and avoids fabricating a price we do not have.
 */
export const fixtureExtendedAnonymousQuotaExceededPlaceholder: LargoAdvice =
  withOverrides(fixtureExtendedAbstainProviderUnavailable, {
    advice_id: 'STUB-extended-quota-exceeded-anon',
    user_id: null,
    surface: 'simple_search',
    short_message: 'Search quota reached. Please sign in to continue.',
    reasons: [
      {
        code: 'anonymous_quota_exceeded',
        severity: 'blocking',
        message:
          'You have reached the search quota for anonymous users. Sign in to continue.',
      },
    ],
  });

// -----------------------------------------------------------------------------
// Fixture 12 (bonus) — Manual check surface
// -----------------------------------------------------------------------------

/**
 * Surface `'manual_check'` is the only `LargoSurface` value the stub does not
 * emit (StubSurface narrows to two values). Built via override so that
 * future surface-specific UI tests have a fixture to consume.
 */
export const fixtureExtendedManualCheck: LargoAdvice = withOverrides(
  fixtureExtendedWaitHighPrice,
  {
    advice_id: 'STUB-extended-manual-check-cdg-jfk',
    surface: 'manual_check',
  },
);

// -----------------------------------------------------------------------------
// Fixture 13 (bonus) — One-way flight
// -----------------------------------------------------------------------------

/**
 * `return_date: null` ⇒ `is_round_trip: false`,
 * `inbound_duration_minutes: null`. Useful for one-way UI states.
 */
export const fixtureExtendedOneWayFlight: LargoAdvice = produceStubLargoAdvice(
  oneWayBuyNowInput(),
);

// -----------------------------------------------------------------------------
// Convenience exports
// -----------------------------------------------------------------------------

/**
 * All fixtures in declaration order. Tests iterate this list to apply
 * universal invariants (validates, strips, can_autobuy === false, etc.).
 */
export const extendedLargoAdviceFixtures: ReadonlyArray<LargoAdvice> = [
  fixtureExtendedBuyNowHigh,
  fixtureExtendedBuyNowModerate,
  fixtureExtendedWaitHighPrice,
  fixtureExtendedMonitor,
  fixtureExtendedAlert,
  fixtureExtendedAbstainRouteUnknown,
  fixtureExtendedAbstainProviderUnavailable,
  fixtureExtendedProviderDisagreement,
  fixtureExtendedExpiredAdvice,
  fixtureExtendedMlUnavailable,
  fixtureExtendedAnonymousQuotaExceededPlaceholder,
  fixtureExtendedManualCheck,
  fixtureExtendedOneWayFlight,
] as const;

/**
 * Indexed bag for code that wants to look up a single fixture by short name.
 */
export const extendedLargoAdviceFixtureByName = {
  buyNowHigh: fixtureExtendedBuyNowHigh,
  buyNowModerate: fixtureExtendedBuyNowModerate,
  waitHighPrice: fixtureExtendedWaitHighPrice,
  monitor: fixtureExtendedMonitor,
  alert: fixtureExtendedAlert,
  abstainRouteUnknown: fixtureExtendedAbstainRouteUnknown,
  abstainProviderUnavailable: fixtureExtendedAbstainProviderUnavailable,
  providerDisagreement: fixtureExtendedProviderDisagreement,
  expiredAdvice: fixtureExtendedExpiredAdvice,
  mlUnavailable: fixtureExtendedMlUnavailable,
  anonymousQuotaExceeded: fixtureExtendedAnonymousQuotaExceededPlaceholder,
  manualCheck: fixtureExtendedManualCheck,
  oneWayFlight: fixtureExtendedOneWayFlight,
} as const;

/**
 * Internal helpers exposed for unit testing only.
 *
 * @internal
 */
export const __internal = Object.freeze({
  NOW_ISO,
  PAST_ISO,
  deepCloneAdvice,
  withOverrides,
});
