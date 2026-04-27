/**
 * Largo — `CustomerSafeAdvice` type surface (Sprint 1, B1).
 *
 * The customer-safe view derived from `LargoAdvice` per the strip rule of
 * `docs/b0/LARGO_BACKEND_API_SPEC.md` §10.
 *
 * What is INTENTIONALLY ABSENT from this type (admin-only):
 *  - `numeric_value`            — `LARGO_BACKEND_API_SPEC.md` §10 row 5.
 *  - `technical_details`        — `LARGO_BACKEND_API_SPEC.md` §10 row 14.
 *  - `audit_block`              — `LARGO_BACKEND_API_SPEC.md` §10 rows 12, 13.
 *  - `provider_info.cross_check_provider`        — admin-only (full disagreement).
 *  - `provider_info.cross_check_offer_id`        — admin-only.
 *  - `provider_info.cross_check_disagreement_pct` — admin-only (replaced by `disagreement_summary`).
 *  - `provider_info.primary_provider_offer_id`   — internal id, no customer value.
 *
 * What is PRESERVED from `LargoAdvice` (customer-renderable):
 *  - `schema_version`, `advice_id`, `user_id`, `mission_id`, `surface`.
 *  - `generated_at`, `valid_until`.
 *  - `action`, `confidence_label`.
 *  - `product_type`, `product_context`, `product_specific`.
 *  - `price_observation` (full sub-shape, INCLUDING `observed_price_usd: null`).
 *  - `provider_info` (transformed; see `CustomerSafeProviderInfo`).
 *  - `reasons`, `comparison_anchor`, `short_message`.
 *  - `can_autobuy` (gate flag; see `docs/b1/CLAUDE_CODE_RULES.md` §10), `ml_available`.
 *  - `bundle_context`.
 *
 * Type discipline:
 *  - `CustomerSafeAdvice` is a structural strict subset of `LargoAdvice` (modulo
 *    the `provider_info` summary transform). The strip function returns this
 *    type and only this type; admin fields cannot type-leak into customer
 *    components by accident.
 */

import type {
  ComparisonAnchor,
  ContractVersion,
  FlightSpecific,
  LargoAdviceAction,
  LargoConfidenceLabel,
  LargoProductType,
  LargoSurface,
  PriceObservation,
  ProductContext,
  Reason,
  BundleContext,
} from './advice';

// -----------------------------------------------------------------------------
// Customer-safe provider info (semantic summary, never raw disagreement %)
// -----------------------------------------------------------------------------

/**
 * Semantic summary of cross-provider agreement. Customer view never receives
 * the raw `cross_check_disagreement_pct`; it sees only the qualitative state.
 *
 *  - `'agree'`   : providers agree (no `provider_disagreement` reason emitted).
 *  - `'disagree'`: providers disagree above the safety threshold (a
 *                  `provider_disagreement` reason is present in `reasons[]`).
 *  - `'unknown'` : no cross-check was performed (single-provider, or chain
 *                  exhausted) — `cross_check_disagreement_pct === null`.
 *
 * The strip function derives this label from the same upstream signal the
 * decision policy used (the `reasons[]` array), so no new threshold is
 * introduced on the customer-safe boundary.
 */
export type ProviderDisagreementSummary = 'agree' | 'disagree' | 'unknown';

/**
 * Customer-safe projection of `ProviderInfo`. Drops admin-only IDs and the
 * raw disagreement percentage; replaces them with a semantic summary.
 */
export interface CustomerSafeProviderInfo {
  /**
   * The provider that produced the price quote. May be `null` when the
   * provider chain was exhausted; MUST NEVER be coerced to a placeholder.
   */
  primary_provider: string | null;

  /**
   * Age of the price snapshot at `generated_at`. Customer-safe (does not
   * leak provider tokens or offer IDs); `null` when no provider responded.
   */
  price_freshness_seconds: number | null;

  /** Semantic summary of cross-provider agreement (see type doc above). */
  disagreement_summary: ProviderDisagreementSummary;
}

// -----------------------------------------------------------------------------
// CustomerSafeAdvice (from `LARGO_BACKEND_API_SPEC.md` §10 strip rule)
// -----------------------------------------------------------------------------

/**
 * The shape sent to any non-admin surface. Constructed by
 * `stripToCustomerSafe(advice: LargoAdvice): CustomerSafeAdvice`.
 *
 * Forbidden inhabitants: any field listed in `LARGO_BACKEND_API_SPEC.md` §10
 * as customer-view = "no". The TypeScript shape below makes accidental
 * inclusion a compile-time error in customer components.
 */
export interface CustomerSafeAdvice {
  // ---- Schema (preserved) -----------------------------------------------
  schema_version: ContractVersion;

  // ---- Identification (preserved; full ULID present, last 6 chars rendered) -----
  advice_id: string;
  user_id: string | null;
  mission_id: string | null;
  surface: LargoSurface;

  // ---- Temporal (preserved) ---------------------------------------------
  generated_at: string;
  valid_until: string;

  // ---- Decision (preserved minus `numeric_value`) -----------------------
  action: LargoAdviceAction;
  confidence_label: LargoConfidenceLabel;
  // numeric_value: REMOVED (admin-only).

  // ---- Product context (preserved) --------------------------------------
  product_type: LargoProductType;
  product_context: ProductContext;
  product_specific: FlightSpecific;

  // ---- Price (preserved; nulls preserved, never coerced) ----------------
  price_observation: PriceObservation;

  // ---- Provider info (transformed; see CustomerSafeProviderInfo) --------
  provider_info: CustomerSafeProviderInfo;

  // ---- Explanation (preserved) ------------------------------------------
  reasons: Reason[];
  comparison_anchor: ComparisonAnchor | null;
  short_message: string;

  // technical_details: REMOVED (admin-only).

  // ---- Capability flags (preserved) -------------------------------------
  can_autobuy: boolean;
  ml_available: boolean;

  // ---- Bundle context (preserved) ---------------------------------------
  bundle_context: BundleContext | null;

  // audit_block: REMOVED (admin-only, separate envelope per ADVICE_CONTRACT §17).
}
