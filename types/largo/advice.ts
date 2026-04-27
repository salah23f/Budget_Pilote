/**
 * Largo — minimal `LargoAdvice` type surface (Sprint 1, B1).
 *
 * Purpose: provide the smallest local TypeScript shape needed to type the
 * customer-safe stripping function. This is intentionally *not* a full
 * implementation of `LARGO_ADVICE_CONTRACT.md` v0.1.0; it covers only the
 * fields exercised by `stripToCustomerSafe` and its tests.
 *
 * Sources of truth (read these before extending this file):
 *  - `docs/b0/LARGO_ADVICE_CONTRACT.md` §3 (enums), §4 (master interface),
 *    §8 (ProductContext), §9 (PriceObservation), §10 (ProviderInfo),
 *    §11.1 (FlightSpecific — Phase 1 = flights only), §12 (Reasons),
 *    §13 (ComparisonAnchor), §16 (BundleContext), §17 (AuditBlock).
 *  - `docs/b0/LARGO_BACKEND_API_SPEC.md` §10 (strip rule).
 *
 * Constraints (per `docs/b1/CLAUDE_CODE_RULES.md`):
 *  - Pure types only. No runtime behavior.
 *  - No `numeric_value` or `technical_details` ever rendered to a customer
 *    surface; this file only declares them — stripping is enforced in
 *    `lib/largo/safe-view/strip.ts`.
 *  - `observed_price_usd` and `provider_info.primary_provider` are
 *    intentionally `number | null` / `string | null` — never coerced.
 */

// -----------------------------------------------------------------------------
// Enums (from `LARGO_ADVICE_CONTRACT.md` §3)
// -----------------------------------------------------------------------------

/** Schema version of the LargoAdvice contract. */
export type ContractVersion = '0.1.0';

/** The recommended action for the user. ABSTAIN is a first-class state. */
export type LargoAdviceAction =
  | 'BUY_NOW'
  | 'WAIT'
  | 'ALERT'
  | 'MONITOR'
  | 'ABSTAIN';

/**
 * Customer-facing confidence label. Numeric values are NEVER displayed in
 * customer UI per `LARGO_BACKEND_API_SPEC.md` §10.
 */
export type LargoConfidenceLabel =
  | 'high'
  | 'moderate'
  | 'limited'
  | 'unavailable';

/** The product the advice is about. Phase 1 emits only `'flight'`. */
export type LargoProductType = 'flight' | 'hotel' | 'car' | 'bundle';

/** Where the advice was generated. */
export type LargoSurface = 'simple_search' | 'mission_scan' | 'manual_check';

/** Severity tag on a single reason. */
export type LargoReasonSeverity =
  | 'info'
  | 'positive'
  | 'cautionary'
  | 'blocking';

// -----------------------------------------------------------------------------
// Sub-interfaces (from `LARGO_ADVICE_CONTRACT.md` §8–§17)
// -----------------------------------------------------------------------------

/** §8 — ProductContext: the user's query in product-agnostic terms. */
export interface ProductContext {
  origin: string | null;
  destination: string | null;
  outbound_date: string | null;
  inbound_date: string | null;
  passengers_adults: number;
  passengers_children: number;
  passengers_infants: number;
}

/**
 * §9 — PriceObservation. All four price fields are nullable together;
 * `price_missing_reason` is non-empty iff any price field is null.
 * `observed_price_usd === null` MUST never be coerced to 0.
 */
export interface PriceObservation {
  observed_price_usd: number | null;
  observed_currency_original: string | null;
  observed_price_original: number | null;
  fx_rate_to_usd: number | null;
  fx_observed_at: string | null;
  price_missing_reason: string | null;
}

/**
 * §10 — ProviderInfo. `primary_provider === null` MUST never be coerced.
 * `cross_check_*` fields are admin-only per `LARGO_BACKEND_API_SPEC.md` §10
 * row "provider.disagreement = full"; the customer-safe view receives only
 * a semantic summary.
 */
export interface ProviderInfo {
  primary_provider: string | null;
  primary_provider_offer_id: string | null;
  cross_check_provider: string | null;
  cross_check_offer_id: string | null;
  cross_check_disagreement_pct: number | null;
  price_freshness_seconds: number | null;
}

/**
 * §11.1 — FlightSpecific. Phase 1 producers emit only `product_type === 'flight'`.
 * Hotel/Car/Bundle variants exist in the contract but are out of scope for
 * Sprint 1 stripping logic.
 */
export interface FlightSpecific {
  product_type: 'flight';
  airline_code: string | null;
  stops: number | null;
  cabin: 'economy' | 'premium_economy' | 'business' | 'first' | null;
  is_round_trip: boolean;
  outbound_duration_minutes: number | null;
  inbound_duration_minutes: number | null;
}

/** §12 — Reason: customer-safe plain-language explanation tied to a stable code. */
export interface Reason {
  code: string;
  message: string;
  severity: LargoReasonSeverity;
}

/** §13 — ComparisonAnchor: the single concrete number a user can be shown. */
export interface ComparisonAnchor {
  anchor_type:
    | 'training_quantile'
    | 'rolling_min_30'
    | 'rolling_median_30'
    | 'mission_baseline'
    | 'historical_avg';
  anchor_value_usd: number | null;
  description: string;
}

/** §16 — BundleContext: present on a per-product component advice within a bundle. */
export interface BundleContext {
  bundle_id: string;
  component_role: 'flight' | 'hotel' | 'car';
  total_components: number;
}

/**
 * §17 — AuditBlock: minimal sibling envelope. Per `LARGO_BACKEND_API_SPEC.md`
 * §10, both `audit_id` and `parent_advice_id` are admin-only and stripped from
 * the customer-safe view.
 *
 * Phase 1 invariant: `audit_id === advice_id`.
 */
export interface AuditBlock {
  audit_id: string;
  parent_advice_id: string | null;
}

// -----------------------------------------------------------------------------
// Master interface (from `LARGO_ADVICE_CONTRACT.md` §4)
// -----------------------------------------------------------------------------

/**
 * Minimal `LargoAdvice` shape used by `stripToCustomerSafe`.
 *
 * The contract's master interface is broader (hotel/car/bundle variants,
 * full validation rules, etc.); this minimal shape covers what Sprint 1
 * needs to demonstrate the strip transform.
 *
 * `audit_block` is included as an OPTIONAL field for stripping convenience
 * even though the contract treats `AuditBlock` as a separate envelope (§17.1).
 * Real producers may pair them when serializing for admin tooling; the strip
 * function must remove it regardless.
 */
export interface LargoAdvice {
  // ---- Schema -----------------------------------------------------------
  schema_version: ContractVersion;

  // ---- Identification ---------------------------------------------------
  advice_id: string;
  user_id: string | null;
  mission_id: string | null;
  surface: LargoSurface;

  // ---- Temporal ---------------------------------------------------------
  generated_at: string;
  valid_until: string;

  // ---- Decision ---------------------------------------------------------
  action: LargoAdviceAction;
  confidence_label: LargoConfidenceLabel;
  /** ADMIN-ONLY. Stripped from customer view per BACKEND_API_SPEC §10. */
  numeric_value: number | null;

  // ---- Product context --------------------------------------------------
  product_type: LargoProductType;
  product_context: ProductContext;
  /** Phase 1 = flight only; future variants extend here. */
  product_specific: FlightSpecific;

  // ---- Price (nullable) -------------------------------------------------
  price_observation: PriceObservation;

  // ---- Provider info (nullable) -----------------------------------------
  provider_info: ProviderInfo;

  // ---- Explanation ------------------------------------------------------
  reasons: Reason[];
  comparison_anchor: ComparisonAnchor | null;
  short_message: string;

  // ---- Technical (debug / audit only) -----------------------------------
  /** ADMIN-ONLY. Stripped from customer view per BACKEND_API_SPEC §10. */
  technical_details: Record<string, unknown> | null;

  // ---- Capability flags -------------------------------------------------
  can_autobuy: boolean;
  ml_available: boolean;

  // ---- Bundle context ---------------------------------------------------
  bundle_context: BundleContext | null;

  // ---- Audit envelope (optional, paired in admin serializations) --------
  /**
   * ADMIN-ONLY when present. Stripped from customer view per BACKEND_API_SPEC
   * §10 rows "audit_block.audit_id" and "audit_block.parent_advice_id".
   * Phase 1 invariant: when present, `audit_block.audit_id === advice_id`.
   */
  audit_block?: AuditBlock | null;
}
