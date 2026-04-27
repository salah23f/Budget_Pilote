/**
 * Largo — `LargoAdvice` test fixtures (Sprint 1, B1).
 *
 * Hand-built fixtures used by `tests/largo/safe-view/strip.test.ts` to verify
 * the customer-safe view strip rule per `LARGO_BACKEND_API_SPEC.md` §10.
 *
 * Fixture coverage (per the Sprint 1 prompt):
 *  1. BUY_NOW high confidence — internal `numeric_value` populated.
 *  2. WAIT moderate confidence — normal price.
 *  3. ABSTAIN — route unknown to model.
 *  4. ABSTAIN — provider unavailable, `observed_price_usd: null`.
 *  5. WAIT — provider disagreement above threshold (forced by reason code).
 *  6. Expired advice — `valid_until` in the past.
 *  7. ML unavailable — falls back to baseline, `ml_available: false`.
 *
 * No secrets. No real API keys. No PII. ULIDs are hand-crafted illustrative
 * strings consistent with `LARGO_ADVICE_CONTRACT.md` §5.1 (26-char Crockford
 * base32, lexicographically sortable).
 */

import type { LargoAdvice } from '@/types/largo/advice';

// -----------------------------------------------------------------------------
// Fixture 1 — BUY_NOW high confidence (internal numeric value populated)
// -----------------------------------------------------------------------------

export const fixtureBuyNowHighConfidence: LargoAdvice = {
  schema_version: '0.1.0',

  advice_id: '01HZQK8XB5W9V0NRJ7T3F4G6PA',
  user_id: null,
  mission_id: null,
  surface: 'simple_search',

  generated_at: '2026-04-26T14:02:11Z',
  valid_until: '2026-04-26T20:02:11Z',

  action: 'BUY_NOW',
  confidence_label: 'high',
  numeric_value: 0.78, // ADMIN-ONLY — must not appear in stripped output.

  product_type: 'flight',
  product_context: {
    origin: 'JFK',
    destination: 'NRT',
    outbound_date: '2026-06-12',
    inbound_date: '2026-06-26',
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
    inbound_duration_minutes: 790,
  },

  price_observation: {
    observed_price_usd: 812.4,
    observed_currency_original: 'USD',
    observed_price_original: 812.4,
    fx_rate_to_usd: 1.0,
    fx_observed_at: '2026-04-26T14:02:08Z',
    price_missing_reason: null,
  },

  provider_info: {
    primary_provider: 'sky-scrapper',
    primary_provider_offer_id: 'sk-9f1e2c',
    cross_check_provider: 'google-flights',
    cross_check_offer_id: 'gf-771ab3',
    cross_check_disagreement_pct: 0.018,
    price_freshness_seconds: 31,
  },

  reasons: [
    {
      code: 'price_below_p10',
      severity: 'positive',
      message:
        "This price is in the bottom 10% of what we've seen for this route.",
    },
    {
      code: 'rolling_min_30',
      severity: 'positive',
      message:
        'Lower than every price recorded for this route in the past 30 days.',
    },
  ],
  comparison_anchor: {
    anchor_type: 'training_quantile',
    anchor_value_usd: 905.0,
    description:
      'Compared against the historical 10th percentile of $905 for this route.',
  },
  short_message: 'Good price — buying now is reasonable.',

  technical_details: {
    // ADMIN-ONLY — must not appear in stripped output.
    model_version: 'ensemble_ttd_switch@2026.03',
    q10: 760.0,
    q50: 940.0,
    q90: 1180.0,
    conformal_half_width: 95.0,
    gates_passed: ['route_known', 'fresh_price', 'cross_check_ok'],
  },

  can_autobuy: true,
  ml_available: true,

  bundle_context: null,

  audit_block: {
    // ADMIN-ONLY — must not appear in stripped output.
    audit_id: '01HZQK8XB5W9V0NRJ7T3F4G6PA', // Phase 1: audit_id === advice_id.
    parent_advice_id: null,
  },
};

// -----------------------------------------------------------------------------
// Fixture 2 — WAIT moderate confidence (normal price, mission scan)
// -----------------------------------------------------------------------------

export const fixtureWaitModerate: LargoAdvice = {
  schema_version: '0.1.0',

  advice_id: '01HZQK9D2C7E1MA8YV4S6KJ0XB',
  user_id: 'usr_3f9a2c',
  mission_id: 'msn_8b1d77',
  surface: 'mission_scan',

  generated_at: '2026-04-26T02:15:04Z',
  valid_until: '2026-04-26T14:15:04Z',

  action: 'WAIT',
  confidence_label: 'moderate',
  numeric_value: 0.41,

  product_type: 'flight',
  product_context: {
    origin: 'CDG',
    destination: 'JFK',
    outbound_date: '2026-07-04',
    inbound_date: '2026-07-18',
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
    inbound_duration_minutes: 445,
  },

  price_observation: {
    observed_price_usd: 940.0,
    observed_currency_original: 'EUR',
    observed_price_original: 870.0,
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
    {
      code: 'above_median_30',
      severity: 'cautionary',
      message: 'Higher than the median price observed in the last 30 days.',
    },
  ],
  comparison_anchor: {
    anchor_type: 'rolling_median_30',
    anchor_value_usd: 880.0,
    description: 'Median over the last 30 days is around $880 for this route.',
  },
  short_message: "Above-average price — we'd watch a bit longer.",

  technical_details: {
    model_version: 'ensemble_ttd_switch@2026.03',
    q10: 780.0,
    q50: 880.0,
    q90: 1050.0,
    conformal_half_width: 110.0,
  },

  can_autobuy: false,
  ml_available: true,

  bundle_context: null,

  audit_block: {
    audit_id: '01HZQK9D2C7E1MA8YV4S6KJ0XB',
    parent_advice_id: '01HZQK7C0A1B0D2E3F4G5H6J7K',
  },
};

// -----------------------------------------------------------------------------
// Fixture 3 — ABSTAIN, route unknown to model
// -----------------------------------------------------------------------------

export const fixtureAbstainRouteUnknown: LargoAdvice = {
  schema_version: '0.1.0',

  advice_id: '01HZQKA1B2C3D4E5F6G7H8J9K0',
  user_id: null,
  mission_id: null,
  surface: 'simple_search',

  generated_at: '2026-04-26T16:00:00Z',
  valid_until: '2026-04-26T16:30:00Z',

  action: 'ABSTAIN',
  confidence_label: 'unavailable',
  numeric_value: null,

  product_type: 'flight',
  product_context: {
    origin: 'TLS',
    destination: 'BCN',
    outbound_date: '2026-08-10',
    inbound_date: null,
    passengers_adults: 1,
    passengers_children: 0,
    passengers_infants: 0,
  },
  product_specific: {
    product_type: 'flight',
    airline_code: null,
    stops: null,
    cabin: null,
    is_round_trip: false,
    outbound_duration_minutes: null,
    inbound_duration_minutes: null,
  },

  price_observation: {
    observed_price_usd: 142.5,
    observed_currency_original: 'EUR',
    observed_price_original: 132.0,
    fx_rate_to_usd: 1.0795,
    fx_observed_at: '2026-04-26T15:59:55Z',
    price_missing_reason: null,
  },

  provider_info: {
    primary_provider: 'sky-scrapper',
    primary_provider_offer_id: 'sk-tls-bcn-01',
    cross_check_provider: null,
    cross_check_offer_id: null,
    cross_check_disagreement_pct: null,
    price_freshness_seconds: 12,
  },

  reasons: [
    {
      code: 'route_unknown_to_model',
      severity: 'blocking',
      message:
        "Not enough recent data on this specific route to be sure.",
    },
  ],
  comparison_anchor: null,
  short_message: "We don't have enough history on this route to advise yet.",

  technical_details: {
    model_version: 'ensemble_ttd_switch@2026.03',
    route_history_count: 3,
    min_required: 30,
  },

  can_autobuy: false,
  ml_available: true,

  bundle_context: null,

  audit_block: {
    audit_id: '01HZQKA1B2C3D4E5F6G7H8J9K0',
    parent_advice_id: null,
  },
};

// -----------------------------------------------------------------------------
// Fixture 4 — ABSTAIN, provider unavailable, observed_price_usd: null
// -----------------------------------------------------------------------------

export const fixtureAbstainProviderUnavailable: LargoAdvice = {
  schema_version: '0.1.0',

  advice_id: '01HZQKB7F1J3R8KQ4M9X2T6YDE',
  user_id: null,
  mission_id: null,
  surface: 'simple_search',

  generated_at: '2026-04-26T14:30:00Z',
  valid_until: '2026-04-26T15:00:00Z',

  action: 'ABSTAIN',
  confidence_label: 'unavailable',
  numeric_value: null,

  product_type: 'flight',
  product_context: {
    origin: 'LHR',
    destination: 'BCN',
    outbound_date: '2026-09-15',
    inbound_date: '2026-09-22',
    passengers_adults: 1,
    passengers_children: 0,
    passengers_infants: 0,
  },
  product_specific: {
    product_type: 'flight',
    airline_code: null,
    stops: null,
    cabin: null,
    is_round_trip: true,
    outbound_duration_minutes: null,
    inbound_duration_minutes: null,
  },

  price_observation: {
    observed_price_usd: null, // CRITICAL: must NEVER be coerced to 0.
    observed_currency_original: null,
    observed_price_original: null,
    fx_rate_to_usd: null,
    fx_observed_at: null,
    price_missing_reason: 'provider_timeout',
  },

  provider_info: {
    primary_provider: null, // CRITICAL: must NEVER be coerced.
    primary_provider_offer_id: null,
    cross_check_provider: null,
    cross_check_offer_id: null,
    cross_check_disagreement_pct: null,
    price_freshness_seconds: null,
  },

  reasons: [
    {
      code: 'price_unavailable',
      severity: 'blocking',
      message: "We can't fetch a current price right now.",
    },
  ],
  comparison_anchor: null,
  short_message: "Price unavailable right now — we'll keep trying.",

  technical_details: {
    attempted_providers: ['sky-scrapper', 'google-flights'],
    last_error: 'upstream_timeout_after_8s',
  },

  can_autobuy: false,
  ml_available: true,

  bundle_context: null,

  audit_block: {
    audit_id: '01HZQKB7F1J3R8KQ4M9X2T6YDE',
    parent_advice_id: null,
  },
};

// -----------------------------------------------------------------------------
// Fixture 5 — Provider disagreement (forced WAIT, can_autobuy false)
// -----------------------------------------------------------------------------

export const fixtureProviderDisagreement: LargoAdvice = {
  schema_version: '0.1.0',

  advice_id: '01HZQKC3M5N7Q9V2X4Z6B8D0FH',
  user_id: 'usr_a1b2c3',
  mission_id: 'msn_xyz789',
  surface: 'manual_check',

  generated_at: '2026-04-27T09:30:00Z',
  valid_until: '2026-04-27T15:30:00Z',

  action: 'WAIT',
  confidence_label: 'limited',
  numeric_value: 0.32,

  product_type: 'flight',
  product_context: {
    origin: 'SFO',
    destination: 'LAX',
    outbound_date: '2026-06-15',
    inbound_date: '2026-06-22',
    passengers_adults: 1,
    passengers_children: 0,
    passengers_infants: 0,
  },
  product_specific: {
    product_type: 'flight',
    airline_code: 'UA',
    stops: 0,
    cabin: 'economy',
    is_round_trip: true,
    outbound_duration_minutes: 90,
    inbound_duration_minutes: 95,
  },

  price_observation: {
    observed_price_usd: 320.0,
    observed_currency_original: 'USD',
    observed_price_original: 320.0,
    fx_rate_to_usd: 1.0,
    fx_observed_at: '2026-04-27T09:29:55Z',
    price_missing_reason: null,
  },

  provider_info: {
    primary_provider: 'sky-scrapper',
    primary_provider_offer_id: 'sk-44c1de',
    cross_check_provider: 'google-flights',
    cross_check_offer_id: 'gf-aa20f1',
    cross_check_disagreement_pct: 0.142, // 14.2 % > threshold
    price_freshness_seconds: 64,
  },

  reasons: [
    {
      code: 'provider_disagreement',
      severity: 'blocking',
      message: 'Sources disagree on the current price by more than 10%.',
    },
  ],
  comparison_anchor: null,
  short_message: 'Our sources disagree on this fare — we will wait.',

  technical_details: {
    model_version: 'ensemble_ttd_switch@2026.03',
    primary_price: 320.0,
    cross_check_price: 280.0,
  },

  can_autobuy: false,
  ml_available: true,

  bundle_context: null,

  audit_block: {
    audit_id: '01HZQKC3M5N7Q9V2X4Z6B8D0FH',
    parent_advice_id: null,
  },
};

// -----------------------------------------------------------------------------
// Fixture 6 — Expired advice (valid_until in the past)
// -----------------------------------------------------------------------------

export const fixtureExpiredAdvice: LargoAdvice = {
  schema_version: '0.1.0',

  advice_id: '01HZQKD0E1F2G3H4J5K6L7M8N9',
  user_id: 'usr_old_session',
  mission_id: 'msn_expired_test',
  surface: 'mission_scan',

  generated_at: '2026-04-20T10:00:00Z',
  valid_until: '2026-04-20T16:00:00Z', // PAST relative to today (2026-04-27).

  action: 'BUY_NOW',
  confidence_label: 'high',
  numeric_value: 0.81,

  product_type: 'flight',
  product_context: {
    origin: 'BOS',
    destination: 'LON',
    outbound_date: '2026-07-01',
    inbound_date: '2026-07-15',
    passengers_adults: 1,
    passengers_children: 0,
    passengers_infants: 0,
  },
  product_specific: {
    product_type: 'flight',
    airline_code: 'BA',
    stops: 0,
    cabin: 'economy',
    is_round_trip: true,
    outbound_duration_minutes: 410,
    inbound_duration_minutes: 425,
  },

  price_observation: {
    observed_price_usd: 615.0,
    observed_currency_original: 'USD',
    observed_price_original: 615.0,
    fx_rate_to_usd: 1.0,
    fx_observed_at: '2026-04-20T09:59:48Z',
    price_missing_reason: null,
  },

  provider_info: {
    primary_provider: 'sky-scrapper',
    primary_provider_offer_id: 'sk-bos-lon-01',
    cross_check_provider: null,
    cross_check_offer_id: null,
    cross_check_disagreement_pct: null,
    price_freshness_seconds: 22,
  },

  reasons: [
    {
      code: 'price_below_p10',
      severity: 'positive',
      message:
        "This price is in the bottom 10% of what we've seen for this route.",
    },
  ],
  comparison_anchor: {
    anchor_type: 'training_quantile',
    anchor_value_usd: 720.0,
    description:
      'Compared against the historical 10th percentile of $720 for this route.',
  },
  short_message: 'Good price at the time — refresh for current advice.',

  technical_details: {
    model_version: 'ensemble_ttd_switch@2026.03',
    q10: 600.0,
    q50: 740.0,
    q90: 920.0,
  },

  can_autobuy: false, // Expired, so backend gating policy disables auto-buy.
  ml_available: true,

  bundle_context: null,

  audit_block: {
    audit_id: '01HZQKD0E1F2G3H4J5K6L7M8N9',
    parent_advice_id: null,
  },
};

// -----------------------------------------------------------------------------
// Fixture 7 — ML unavailable (baseline-only, ml_available: false)
// -----------------------------------------------------------------------------

export const fixtureMlUnavailable: LargoAdvice = {
  schema_version: '0.1.0',

  advice_id: '01HZQKE0P1Q2R3S4T5U6V7W8X9',
  user_id: 'usr_ml_test',
  mission_id: null,
  surface: 'simple_search',

  generated_at: '2026-04-27T11:00:00Z',
  valid_until: '2026-04-27T17:00:00Z',

  action: 'WAIT',
  confidence_label: 'limited',
  numeric_value: null, // No calibrated number — ML is down.

  product_type: 'flight',
  product_context: {
    origin: 'YYZ',
    destination: 'MIA',
    outbound_date: '2026-12-20',
    inbound_date: '2026-12-28',
    passengers_adults: 2,
    passengers_children: 1,
    passengers_infants: 0,
  },
  product_specific: {
    product_type: 'flight',
    airline_code: 'AC',
    stops: 0,
    cabin: 'economy',
    is_round_trip: true,
    outbound_duration_minutes: 215,
    inbound_duration_minutes: 220,
  },

  price_observation: {
    observed_price_usd: 545.0,
    observed_currency_original: 'CAD',
    observed_price_original: 745.0,
    fx_rate_to_usd: 0.7315,
    fx_observed_at: '2026-04-27T10:59:50Z',
    price_missing_reason: null,
  },

  provider_info: {
    primary_provider: 'sky-scrapper',
    primary_provider_offer_id: 'sk-yyz-mia-99',
    cross_check_provider: null,
    cross_check_offer_id: null,
    cross_check_disagreement_pct: null,
    price_freshness_seconds: 18,
  },

  reasons: [
    {
      code: 'ml_layer_unavailable',
      severity: 'blocking',
      message:
        'Deep analysis temporarily unavailable; advice based on baseline only.',
    },
  ],
  comparison_anchor: {
    anchor_type: 'historical_avg',
    anchor_value_usd: 600.0,
    description: 'Compared against the historical average of $600 for this route.',
  },
  short_message: 'Limited analysis right now — baseline says wait.',

  technical_details: {
    model_version: 'baseline_v1@2026.03',
    fallback_reason: 'ml_service_timeout',
  },

  can_autobuy: false,
  ml_available: false, // CRITICAL: enforced by `LARGO_ADVICE_CONTRACT.md` §15.2.

  bundle_context: null,

  audit_block: {
    audit_id: '01HZQKE0P1Q2R3S4T5U6V7W8X9',
    parent_advice_id: null,
  },
};

// -----------------------------------------------------------------------------
// Convenience export — all fixtures as an indexed bag
// -----------------------------------------------------------------------------

export const allFixtures = {
  buyNowHighConfidence: fixtureBuyNowHighConfidence,
  waitModerate: fixtureWaitModerate,
  abstainRouteUnknown: fixtureAbstainRouteUnknown,
  abstainProviderUnavailable: fixtureAbstainProviderUnavailable,
  providerDisagreement: fixtureProviderDisagreement,
  expiredAdvice: fixtureExpiredAdvice,
  mlUnavailable: fixtureMlUnavailable,
} as const;
