/**
 * Largo — `stripToCustomerSafe` (Sprint 1, B1, first real code task).
 *
 * Implements the customer-safe view strip rule per:
 *  - `docs/b0/LARGO_BACKEND_API_SPEC.md` §10 (canonical strip table).
 *  - `docs/b0/LARGO_ADVICE_CONTRACT.md` §3, §4 (master typed shape, flat fields).
 *  - `docs/b0/LARGO_FRONTEND_UX_SPEC.md` §4 (customer-safe view fields).
 *  - `docs/b1/CLAUDE_CODE_RULES.md` §11, §12 (no numeric confidence, no
 *    technical_details, no audit_block in customer UI).
 *
 * Closes ambiguity #6 of `docs/b0/B0_CLOSURE_AUDIT.md` §19 by reconciling the
 * BACKEND_API_SPEC §10 prose ("confidence.numeric_value", "audit_block.*") to
 * the canonical ADVICE_CONTRACT §4 flat fields (`numeric_value`,
 * `audit_block` paired envelope).
 *
 * Function discipline (per `docs/b1/B1_IMPLEMENTATION_PLAN.md` §12, §19):
 *  - PURE. No I/O, no async, no fetch, no DB, no env access.
 *  - DETERMINISTIC. Same input → same output, byte for byte.
 *  - NO MUTATION. The input `LargoAdvice` is structurally unchanged on return.
 *  - NULL-PRESERVING. `observed_price_usd === null` stays `null` (never `0`).
 *    `provider_info.primary_provider === null` stays `null` (never coerced).
 *  - IDEMPOTENT on its output domain (note: type-safe idempotency requires
 *    re-shaping `CustomerSafeAdvice` back into `LargoAdvice` shape; the test
 *    suite verifies semantic equivalence rather than referential identity).
 */

import type {
  AuditBlock,
  ComparisonAnchor,
  FlightSpecific,
  LargoAdvice,
  PriceObservation,
  ProductContext,
  ProviderInfo,
  Reason,
  BundleContext,
} from '@/types/largo/advice';
import type {
  CustomerSafeAdvice,
  CustomerSafeProviderInfo,
  ProviderDisagreementSummary,
} from '@/types/largo/customer-safe-advice';

// -----------------------------------------------------------------------------
// Internal helpers — pure, deep-cloning to guarantee non-mutation
// -----------------------------------------------------------------------------

/**
 * Reason code that, when present in `reasons[]`, signals the backend's decision
 * policy classified the cross-provider check as a disagreement above the
 * safety threshold. Source: `LARGO_ADVICE_CONTRACT.md` §12.2 reserved codes.
 */
const PROVIDER_DISAGREEMENT_REASON_CODE = 'provider_disagreement';

/** Deep-clone a `ProductContext` — flat object of primitives. */
function cloneProductContext(ctx: ProductContext): ProductContext {
  return { ...ctx };
}

/** Deep-clone a `FlightSpecific` — flat object of primitives. */
function cloneFlightSpecific(spec: FlightSpecific): FlightSpecific {
  return { ...spec };
}

/**
 * Deep-clone a `PriceObservation`. Preserves all `null` fields exactly:
 * never coerces `observed_price_usd: null` to `0` (forbidden by
 * `LARGO_ADVICE_CONTRACT.md` §20 row 1 and `LARGO_BACKEND_API_SPEC.md` §31).
 */
function clonePriceObservation(price: PriceObservation): PriceObservation {
  return { ...price };
}

/** Deep-clone a single `Reason`. */
function cloneReason(reason: Reason): Reason {
  return { ...reason };
}

/** Deep-clone a `ComparisonAnchor` (or pass through `null`). */
function cloneComparisonAnchor(
  anchor: ComparisonAnchor | null,
): ComparisonAnchor | null {
  return anchor === null ? null : { ...anchor };
}

/** Deep-clone a `BundleContext` (or pass through `null`). */
function cloneBundleContext(ctx: BundleContext | null): BundleContext | null {
  return ctx === null ? null : { ...ctx };
}

/**
 * Derive the customer-facing disagreement summary from the input advice.
 *
 * Decision rules (no new threshold introduced — the threshold was already
 * applied by the backend's decision policy and surfaced in `reasons[]`):
 *
 *  - `cross_check_disagreement_pct === null` → `'unknown'` (no cross-check
 *    was performed; e.g. single-provider response or provider chain
 *    exhausted).
 *  - A `Reason` with `code === 'provider_disagreement'` is present →
 *    `'disagree'` (the upstream policy already flagged it).
 *  - Otherwise → `'agree'` (cross-check ran and the policy did not flag it).
 *
 * Source: `LARGO_ADVICE_CONTRACT.md` §10.3 (cross-check semantics) and
 * §12.2 (reserved reason code `provider_disagreement`).
 */
function summarizeDisagreement(
  providerInfo: ProviderInfo,
  reasons: ReadonlyArray<Reason>,
): ProviderDisagreementSummary {
  if (providerInfo.cross_check_disagreement_pct === null) {
    return 'unknown';
  }
  const flagged = reasons.some(
    (reason) => reason.code === PROVIDER_DISAGREEMENT_REASON_CODE,
  );
  return flagged ? 'disagree' : 'agree';
}

/**
 * Project `ProviderInfo` to its customer-safe form. Drops admin-only IDs and
 * the raw `cross_check_disagreement_pct` value (replaced by the semantic
 * summary). Preserves `primary_provider: null` exactly.
 */
function stripProviderInfo(
  providerInfo: ProviderInfo,
  reasons: ReadonlyArray<Reason>,
): CustomerSafeProviderInfo {
  return {
    primary_provider: providerInfo.primary_provider,
    price_freshness_seconds: providerInfo.price_freshness_seconds,
    disagreement_summary: summarizeDisagreement(providerInfo, reasons),
  };
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Strip a full `LargoAdvice` to its customer-safe view.
 *
 * Removes (per `LARGO_BACKEND_API_SPEC.md` §10):
 *  - `numeric_value`                              (admin-only).
 *  - `technical_details`                          (admin-only).
 *  - `audit_block` (when paired)                  (admin-only envelope).
 *  - `provider_info.primary_provider_offer_id`    (internal id).
 *  - `provider_info.cross_check_provider`         (admin-only, full disagreement).
 *  - `provider_info.cross_check_offer_id`         (admin-only).
 *  - `provider_info.cross_check_disagreement_pct` (admin-only, replaced by summary).
 *
 * Preserves (per `LARGO_FRONTEND_UX_SPEC.md` §4):
 *  - `schema_version`, `advice_id`, `user_id`, `mission_id`, `surface`.
 *  - `generated_at`, `valid_until`.
 *  - `action`, `confidence_label`.
 *  - `product_type`, `product_context`, `product_specific`.
 *  - `price_observation` (FULL sub-shape; nulls preserved exactly).
 *  - `provider_info.primary_provider` (preserved; nulls preserved exactly).
 *  - `reasons`, `comparison_anchor`, `short_message`.
 *  - `can_autobuy`, `ml_available`.
 *  - `bundle_context`.
 *
 * Pure, deterministic, non-mutating. Safe to call with frozen inputs.
 */
export function stripToCustomerSafe(advice: LargoAdvice): CustomerSafeAdvice {
  return {
    // ---- Schema -----------------------------------------------------------
    schema_version: advice.schema_version,

    // ---- Identification ---------------------------------------------------
    advice_id: advice.advice_id,
    user_id: advice.user_id,
    mission_id: advice.mission_id,
    surface: advice.surface,

    // ---- Temporal ---------------------------------------------------------
    generated_at: advice.generated_at,
    valid_until: advice.valid_until,

    // ---- Decision (numeric_value DROPPED) ---------------------------------
    action: advice.action,
    confidence_label: advice.confidence_label,

    // ---- Product context --------------------------------------------------
    product_type: advice.product_type,
    product_context: cloneProductContext(advice.product_context),
    product_specific: cloneFlightSpecific(advice.product_specific),

    // ---- Price (nulls preserved exactly; never coerced to 0) --------------
    price_observation: clonePriceObservation(advice.price_observation),

    // ---- Provider info (transformed; admin fields dropped) ----------------
    provider_info: stripProviderInfo(advice.provider_info, advice.reasons),

    // ---- Explanation ------------------------------------------------------
    reasons: advice.reasons.map(cloneReason),
    comparison_anchor: cloneComparisonAnchor(advice.comparison_anchor),
    short_message: advice.short_message,

    // ---- technical_details DROPPED ---------------------------------------

    // ---- Capability flags -------------------------------------------------
    can_autobuy: advice.can_autobuy,
    ml_available: advice.ml_available,

    // ---- Bundle context ---------------------------------------------------
    bundle_context: cloneBundleContext(advice.bundle_context),

    // ---- audit_block DROPPED ---------------------------------------------
  };
}

// -----------------------------------------------------------------------------
// Internal-only re-exports for tests (do NOT import from customer code)
// -----------------------------------------------------------------------------

/**
 * Internal helper exposed for unit testing only. Not part of the public API.
 * Customer code MUST NOT import this — use `stripToCustomerSafe` instead.
 *
 * @internal
 */
export const __internal = Object.freeze({
  PROVIDER_DISAGREEMENT_REASON_CODE,
  summarizeDisagreement,
  stripProviderInfo,
});

// Lint-quiet imports we keep for documentary consistency with §17 of the
// contract (AuditBlock is referenced via the optional `advice.audit_block`).
// `AuditBlock` is part of the documented contract surface and may be imported
// by future producer code; importing it here keeps this module's type
// dependency graph self-documenting.
export type { AuditBlock };
