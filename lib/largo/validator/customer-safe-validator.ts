/**
 * Largo — `validateCustomerSafeAdvice` runtime validator (Sprint 2.3, B1).
 *
 * Pure, deterministic, dependency-free runtime validator for the
 * customer-safe projection of `LargoAdvice` (the `CustomerSafeAdvice` type).
 * Closes the full pure pipeline:
 *
 *   StubLargoAdviceInput
 *     → produceStubLargoAdvice (Sprint 1.2)
 *     → LargoAdvice
 *     → validateLargoAdvice (Sprint 1.3)
 *     → stripToCustomerSafe (Sprint 1.1)
 *     → CustomerSafeAdvice
 *     → validateCustomerSafeAdvice (this file)
 *
 * Behavior contract:
 *  - INPUT: `unknown`. Caller may pass anything.
 *  - OUTPUT: a discriminated union, never throws.
 *      • `{ ok: true,  value: CustomerSafeAdvice, issues: [] }` when the
 *        input matches the customer-safe shape AND no admin-only field
 *        is present anywhere in the object tree.
 *      • `{ ok: false, value?: never,            issues: [...] }` otherwise.
 *        ALL issues from one pass are collected; the validator does not
 *        bail at the first error.
 *  - On success, `value` is the SAME REFERENCE as the input narrowed to
 *    `CustomerSafeAdvice`. The validator does NOT clone, does NOT freeze.
 *
 * Two distinct rejection layers (run in this order):
 *  1. **Forbidden customer keys.** A recursive walk flags any occurrence
 *     of admin-only field names anywhere in the object tree
 *     (`numeric_value`, `technical_details`, `audit_block`, `audit_id`,
 *     `parent_advice_id`, `primary_provider_offer_id`, `cross_check_*`,
 *     `model_version`, `q10`/`q50`/`q90`, `conformal_half_width`,
 *     `gates_passed`, `fallback_reason`, `attempted_providers`, `last_error`,
 *     `cross_check_price`, `derived_action`, `route_history_count`,
 *     `min_required`, `primary_price`, `debug`, `admin`, `internal`).
 *     Each finding emits a `forbidden_customer_field` issue with the exact
 *     path. This pass guards against accidental admin-leak even if the
 *     surrounding shape is otherwise valid.
 *  2. **Structural / Phase 1 validation.** Required fields, types, enums,
 *     literals, ISO datetimes/dates, numeric ranges, nested object shapes,
 *     and the two Phase 1 anchors:
 *      - `product_type === 'flight'` (else `invalid_phase1_product`),
 *      - `can_autobuy === false`     (else `invalid_autobuy_phase1`).
 *
 * Discipline:
 *  - PURE / DETERMINISTIC. No I/O, no async, no fetch, no DB, no env,
 *    no `Date.now()`, no `Math.random()`.
 *  - NON-MUTATING. Input is structurally unchanged on return.
 *  - NO COERCION. Reports issues, never repairs.
 *  - NULL-AWARE. Accepts valid `null` per contract; rejects missing
 *    required fields separately.
 *  - DEPENDENCY-FREE. No zod / valibot / yup / ajv / io-ts.
 *  - NEVER throws.
 *
 * Out of scope (deferred to backend gates):
 *  - Expired advice (`valid_until` in the past) — still structurally valid.
 *  - Provider disagreement — still structurally valid.
 *  - `ml_available === false` — still structurally valid.
 *  - Action ↔ price/provider/ml coupling — not enforced.
 *  - Strict mode for unknown non-forbidden keys — permissive (TypeScript
 *    structural acceptance). Only the explicit forbidden-key list rejects.
 *
 * Sources of truth:
 *  - `docs/b0/LARGO_ADVICE_CONTRACT.md` §3 (enums), §4 (master interface),
 *    §6 (`can_autobuy`), §8–§17 (sub-shapes), §20 (forbidden patterns).
 *  - `docs/b0/LARGO_BACKEND_API_SPEC.md` §10 (canonical strip rule —
 *    forbidden customer-side fields enumerated).
 *  - `docs/b0/LARGO_FRONTEND_UX_SPEC.md` §4 (customer-safe view fields),
 *    §41 rows 1, 6, 7 (forbidden UI patterns).
 *  - `docs/b1/B1_IMPLEMENTATION_PLAN.md` §4 anchors, §7 (purity), §13
 *    (Sprint 2 deliverable).
 *  - `docs/b1/CLAUDE_CODE_RULES.md` §11 (no numeric confidence to customer),
 *    §15 (no audit_block to customer), §17 (no scope creep), §18 (no new dep).
 */

import type {
  ComparisonAnchor,
  ContractVersion,
  FlightSpecific,
  LargoAdviceAction,
  LargoConfidenceLabel,
  LargoProductType,
  LargoReasonSeverity,
  LargoSurface,
  PriceObservation,
  ProductContext,
  Reason,
  BundleContext,
} from '@/types/largo/advice';
import type {
  CustomerSafeAdvice,
  CustomerSafeProviderInfo,
  ProviderDisagreementSummary,
} from '@/types/largo/customer-safe-advice';

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

/**
 * Stable issue codes the validator emits. Switch on these in downstream code.
 */
export type CustomerSafeValidationIssueCode =
  | 'not_object'
  | 'missing_field'
  | 'invalid_type'
  | 'invalid_enum'
  | 'invalid_literal'
  | 'invalid_number'
  | 'invalid_array'
  | 'invalid_iso_datetime'
  | 'invalid_date'
  | 'invalid_nullable'
  | 'invalid_nested_object'
  | 'invalid_contract_version'
  | 'invalid_phase1_product'
  | 'invalid_autobuy_phase1'
  | 'forbidden_customer_field';

/**
 * One structured validation issue. `path` uses dot/bracket notation
 * (e.g. `provider_info.cross_check_disagreement_pct`,
 *  `reasons[2].code`).
 */
export interface CustomerSafeValidationIssue {
  path: string;
  code: CustomerSafeValidationIssueCode;
  message: string;
  expected?: string;
  actual?: string;
}

/**
 * Discriminated union returned by `validateCustomerSafeAdvice`. Success carries
 * the input narrowed to `CustomerSafeAdvice`; failure omits `value` entirely.
 */
export type CustomerSafeValidationResult =
  | { ok: true; value: CustomerSafeAdvice; issues: [] }
  | { ok: false; value?: never; issues: CustomerSafeValidationIssue[] };

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const CONTRACT_VERSION_LITERAL: ContractVersion = '0.1.0';

const ACTION_VALUES: ReadonlySet<LargoAdviceAction> = new Set<LargoAdviceAction>(
  ['BUY_NOW', 'WAIT', 'ALERT', 'MONITOR', 'ABSTAIN'],
);

const CONFIDENCE_LABEL_VALUES: ReadonlySet<LargoConfidenceLabel> = new Set<LargoConfidenceLabel>(
  ['high', 'moderate', 'limited', 'unavailable'],
);

const PRODUCT_TYPE_VALUES: ReadonlySet<LargoProductType> = new Set<LargoProductType>(
  ['flight', 'hotel', 'car', 'bundle'],
);

const SURFACE_VALUES: ReadonlySet<LargoSurface> = new Set<LargoSurface>(
  ['simple_search', 'mission_scan', 'manual_check'],
);

const REASON_SEVERITY_VALUES: ReadonlySet<LargoReasonSeverity> = new Set<LargoReasonSeverity>(
  ['info', 'positive', 'cautionary', 'blocking'],
);

const FLIGHT_CABIN_VALUES: ReadonlySet<string> = new Set<string>([
  'economy',
  'premium_economy',
  'business',
  'first',
]);

const COMPARISON_ANCHOR_TYPE_VALUES: ReadonlySet<string> = new Set<string>([
  'training_quantile',
  'rolling_min_30',
  'rolling_median_30',
  'mission_baseline',
  'historical_avg',
]);

const BUNDLE_COMPONENT_ROLE_VALUES: ReadonlySet<string> = new Set<string>([
  'flight',
  'hotel',
  'car',
]);

const DISAGREEMENT_SUMMARY_VALUES: ReadonlySet<ProviderDisagreementSummary> = new Set<ProviderDisagreementSummary>(
  ['agree', 'disagree', 'unknown'],
);

/**
 * Field names that must NEVER appear anywhere in a customer-safe payload.
 * Sourced from:
 *  - `LARGO_BACKEND_API_SPEC.md` §10 (admin-only rows: numeric_value,
 *    technical_details, audit_block, audit_id, parent_advice_id,
 *    primary_provider_offer_id, cross_check_*).
 *  - `LARGO_MODEL_STRATEGY.md` §22, §37 row 17 (debug/model attribution
 *    fields: model_version, q10/q50/q90, conformal_half_width,
 *    gates_passed, fallback_reason, etc.).
 *  - `LARGO_FRONTEND_UX_SPEC.md` §41 (debug / admin / internal namespaces).
 *
 * Each match emits one `forbidden_customer_field` issue with the exact
 * dot/bracket path of the offending key.
 */
const FORBIDDEN_CUSTOMER_KEYS: ReadonlySet<string> = new Set<string>([
  // BACKEND_API_SPEC §10 admin rows.
  'numeric_value',
  'technical_details',
  'audit_block',
  'audit_id',
  'parent_advice_id',
  'primary_provider_offer_id',
  'cross_check_provider',
  'cross_check_offer_id',
  'cross_check_disagreement_pct',
  // MODEL_STRATEGY debug/model namespace.
  'model_version',
  'q10',
  'q50',
  'q90',
  'conformal_half_width',
  'gates_passed',
  'fallback_reason',
  'attempted_providers',
  'last_error',
  'cross_check_price',
  'derived_action',
  'route_history_count',
  'min_required',
  'primary_price',
  // Generic forbidden namespaces.
  'debug',
  'admin',
  'internal',
]);

/** ISO 8601 datetime regex (strict): YYYY-MM-DDTHH:MM:SS(.fff)?Z. */
const ISO_DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/;

/** ISO 8601 calendar-date regex: YYYY-MM-DD. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// -----------------------------------------------------------------------------
// Type guards (pure)
// -----------------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isNonNegativeFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

function isPositiveFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

function isNonNegativeInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

function isPositiveInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

function isIsoDatetime(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  if (!ISO_DATETIME_RE.test(v)) return false;
  return Number.isFinite(Date.parse(v));
}

function isIsoDate(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  if (!ISO_DATE_RE.test(v)) return false;
  return Number.isFinite(Date.parse(v + 'T00:00:00Z'));
}

// -----------------------------------------------------------------------------
// Issue helpers
// -----------------------------------------------------------------------------

function describe(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') {
    const truncated = v.length > 40 ? v.slice(0, 40) + '…' : v;
    return `string "${truncated}"`;
  }
  if (typeof v === 'number') {
    if (Number.isNaN(v)) return 'number NaN';
    if (!Number.isFinite(v)) return `number ${v > 0 ? 'Infinity' : '-Infinity'}`;
    return `number ${v}`;
  }
  if (typeof v === 'boolean') return `boolean ${v}`;
  if (Array.isArray(v)) return `array (length ${v.length})`;
  if (typeof v === 'object') return 'object';
  if (typeof v === 'function') return 'function';
  return typeof v;
}

function pushIssue(
  issues: CustomerSafeValidationIssue[],
  path: string,
  code: CustomerSafeValidationIssueCode,
  message: string,
  expected?: string,
  actual?: string,
): void {
  const issue: CustomerSafeValidationIssue = { path, code, message };
  if (expected !== undefined) issue.expected = expected;
  if (actual !== undefined) issue.actual = actual;
  issues.push(issue);
}

function joinPath(prefix: string, segment: string | number): string {
  if (typeof segment === 'number') return `${prefix}[${segment}]`;
  return prefix === '' ? segment : `${prefix}.${segment}`;
}

// -----------------------------------------------------------------------------
// Forbidden customer-key walker
// -----------------------------------------------------------------------------

/**
 * Recursively walk `value` and emit one `forbidden_customer_field` issue per
 * occurrence of any key in `FORBIDDEN_CUSTOMER_KEYS`. Continues walking into
 * the matched key's value too — a nested forbidden key still gets its own
 * issue with its own path.
 */
function walkForbiddenKeys(
  value: unknown,
  pathPrefix: string,
  issues: CustomerSafeValidationIssue[],
): void {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      walkForbiddenKeys(value[i], joinPath(pathPrefix, i), issues);
    }
    return;
  }
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const childPath = joinPath(pathPrefix, key);
    if (FORBIDDEN_CUSTOMER_KEYS.has(key)) {
      pushIssue(
        issues,
        childPath,
        'forbidden_customer_field',
        `field "${key}" is forbidden in customer-safe payloads (admin-only)`,
        '<absent>',
        describe(obj[key]),
      );
    }
    walkForbiddenKeys(obj[key], childPath, issues);
  }
}

// -----------------------------------------------------------------------------
// Generic field-level checks (each appends to issues, never throws)
// -----------------------------------------------------------------------------

function requireField(
  obj: Record<string, unknown>,
  field: string,
  pathPrefix: string,
  expected: string,
  issues: CustomerSafeValidationIssue[],
): { present: boolean; value: unknown } {
  const path = joinPath(pathPrefix, field);
  if (!(field in obj)) {
    pushIssue(
      issues,
      path,
      'missing_field',
      `required field "${field}" is missing`,
      expected,
    );
    return { present: false, value: undefined };
  }
  return { present: true, value: obj[field] };
}

function checkNonEmptyString(
  obj: Record<string, unknown>,
  field: string,
  pathPrefix: string,
  issues: CustomerSafeValidationIssue[],
): void {
  const { present, value } = requireField(
    obj,
    field,
    pathPrefix,
    'non-empty string',
    issues,
  );
  if (!present) return;
  if (!isString(value)) {
    pushIssue(
      issues,
      joinPath(pathPrefix, field),
      'invalid_type',
      `field "${field}" must be a string`,
      'string',
      describe(value),
    );
    return;
  }
  if (value.length === 0) {
    pushIssue(
      issues,
      joinPath(pathPrefix, field),
      'invalid_type',
      `field "${field}" must be a non-empty string`,
      'non-empty string',
      describe(value),
    );
  }
}

function checkNullableString(
  obj: Record<string, unknown>,
  field: string,
  pathPrefix: string,
  issues: CustomerSafeValidationIssue[],
): void {
  const { present, value } = requireField(
    obj,
    field,
    pathPrefix,
    'string | null',
    issues,
  );
  if (!present) return;
  if (value === null) return;
  if (!isString(value)) {
    pushIssue(
      issues,
      joinPath(pathPrefix, field),
      'invalid_nullable',
      `field "${field}" must be a string or null`,
      'string | null',
      describe(value),
    );
  }
}

function checkBooleanField(
  obj: Record<string, unknown>,
  field: string,
  pathPrefix: string,
  issues: CustomerSafeValidationIssue[],
): void {
  const { present, value } = requireField(obj, field, pathPrefix, 'boolean', issues);
  if (!present) return;
  if (!isBoolean(value)) {
    pushIssue(
      issues,
      joinPath(pathPrefix, field),
      'invalid_type',
      `field "${field}" must be a boolean`,
      'boolean',
      describe(value),
    );
  }
}

function checkEnumField<T extends string>(
  obj: Record<string, unknown>,
  field: string,
  pathPrefix: string,
  validValues: ReadonlySet<T>,
  expected: string,
  issues: CustomerSafeValidationIssue[],
): void {
  const { present, value } = requireField(obj, field, pathPrefix, expected, issues);
  if (!present) return;
  if (!isString(value) || !validValues.has(value as T)) {
    pushIssue(
      issues,
      joinPath(pathPrefix, field),
      'invalid_enum',
      `field "${field}" must be one of: ${expected}`,
      expected,
      describe(value),
    );
  }
}

function checkNullableNonNegativeFiniteNumber(
  obj: Record<string, unknown>,
  field: string,
  pathPrefix: string,
  issues: CustomerSafeValidationIssue[],
): void {
  const { present, value } = requireField(
    obj,
    field,
    pathPrefix,
    'non-negative finite number | null',
    issues,
  );
  if (!present) return;
  if (value === null) return;
  if (!isNonNegativeFiniteNumber(value)) {
    pushIssue(
      issues,
      joinPath(pathPrefix, field),
      'invalid_number',
      `field "${field}" must be a non-negative finite number or null`,
      'non-negative finite number | null',
      describe(value),
    );
  }
}

function checkNullablePositiveFiniteNumber(
  obj: Record<string, unknown>,
  field: string,
  pathPrefix: string,
  issues: CustomerSafeValidationIssue[],
): void {
  const { present, value } = requireField(
    obj,
    field,
    pathPrefix,
    'positive finite number | null',
    issues,
  );
  if (!present) return;
  if (value === null) return;
  if (!isPositiveFiniteNumber(value)) {
    pushIssue(
      issues,
      joinPath(pathPrefix, field),
      'invalid_number',
      `field "${field}" must be a positive finite number or null`,
      'positive finite number | null',
      describe(value),
    );
  }
}

function checkNullableNonNegativeInteger(
  obj: Record<string, unknown>,
  field: string,
  pathPrefix: string,
  issues: CustomerSafeValidationIssue[],
): void {
  const { present, value } = requireField(
    obj,
    field,
    pathPrefix,
    'non-negative integer | null',
    issues,
  );
  if (!present) return;
  if (value === null) return;
  if (!isNonNegativeInteger(value)) {
    pushIssue(
      issues,
      joinPath(pathPrefix, field),
      'invalid_number',
      `field "${field}" must be a non-negative integer or null`,
      'non-negative integer | null',
      describe(value),
    );
  }
}

function checkNullablePositiveInteger(
  obj: Record<string, unknown>,
  field: string,
  pathPrefix: string,
  issues: CustomerSafeValidationIssue[],
): void {
  const { present, value } = requireField(
    obj,
    field,
    pathPrefix,
    'positive integer | null',
    issues,
  );
  if (!present) return;
  if (value === null) return;
  if (!isPositiveInteger(value)) {
    pushIssue(
      issues,
      joinPath(pathPrefix, field),
      'invalid_number',
      `field "${field}" must be a positive integer or null`,
      'positive integer | null',
      describe(value),
    );
  }
}

function checkNonNegativeInteger(
  obj: Record<string, unknown>,
  field: string,
  pathPrefix: string,
  issues: CustomerSafeValidationIssue[],
): void {
  const { present, value } = requireField(
    obj,
    field,
    pathPrefix,
    'non-negative integer',
    issues,
  );
  if (!present) return;
  if (!isNonNegativeInteger(value)) {
    pushIssue(
      issues,
      joinPath(pathPrefix, field),
      'invalid_number',
      `field "${field}" must be a non-negative integer`,
      'non-negative integer',
      describe(value),
    );
  }
}

function checkPositiveInteger(
  obj: Record<string, unknown>,
  field: string,
  pathPrefix: string,
  issues: CustomerSafeValidationIssue[],
): void {
  const { present, value } = requireField(
    obj,
    field,
    pathPrefix,
    'positive integer',
    issues,
  );
  if (!present) return;
  if (!isPositiveInteger(value)) {
    pushIssue(
      issues,
      joinPath(pathPrefix, field),
      'invalid_number',
      `field "${field}" must be a positive integer`,
      'positive integer',
      describe(value),
    );
  }
}

function checkIsoDatetimeField(
  obj: Record<string, unknown>,
  field: string,
  pathPrefix: string,
  issues: CustomerSafeValidationIssue[],
): void {
  const { present, value } = requireField(
    obj,
    field,
    pathPrefix,
    'ISO 8601 datetime (UTC, "Z" suffix)',
    issues,
  );
  if (!present) return;
  if (!isIsoDatetime(value)) {
    pushIssue(
      issues,
      joinPath(pathPrefix, field),
      'invalid_iso_datetime',
      `field "${field}" must be an ISO 8601 datetime ending with "Z"`,
      'ISO 8601 datetime (UTC, "Z" suffix)',
      describe(value),
    );
  }
}

function checkNullableIsoDatetimeField(
  obj: Record<string, unknown>,
  field: string,
  pathPrefix: string,
  issues: CustomerSafeValidationIssue[],
): void {
  const { present, value } = requireField(
    obj,
    field,
    pathPrefix,
    'ISO 8601 datetime | null',
    issues,
  );
  if (!present) return;
  if (value === null) return;
  if (!isIsoDatetime(value)) {
    pushIssue(
      issues,
      joinPath(pathPrefix, field),
      'invalid_iso_datetime',
      `field "${field}" must be an ISO 8601 datetime or null`,
      'ISO 8601 datetime | null',
      describe(value),
    );
  }
}

function checkNullableIsoDateField(
  obj: Record<string, unknown>,
  field: string,
  pathPrefix: string,
  issues: CustomerSafeValidationIssue[],
): void {
  const { present, value } = requireField(
    obj,
    field,
    pathPrefix,
    'ISO 8601 date (YYYY-MM-DD) | null',
    issues,
  );
  if (!present) return;
  if (value === null) return;
  if (!isIsoDate(value)) {
    pushIssue(
      issues,
      joinPath(pathPrefix, field),
      'invalid_date',
      `field "${field}" must be an ISO 8601 date (YYYY-MM-DD) or null`,
      'ISO 8601 date (YYYY-MM-DD) | null',
      describe(value),
    );
  }
}

// -----------------------------------------------------------------------------
// Sub-shape validators (one per nested CustomerSafeAdvice field)
// -----------------------------------------------------------------------------

function validateProductContext(
  value: unknown,
  path: string,
  issues: CustomerSafeValidationIssue[],
): void {
  if (!isPlainObject(value)) {
    pushIssue(
      issues,
      path,
      'invalid_nested_object',
      'product_context must be an object',
      'object',
      describe(value),
    );
    return;
  }
  checkNullableString(value, 'origin', path, issues);
  checkNullableString(value, 'destination', path, issues);
  checkNullableIsoDateField(value, 'outbound_date', path, issues);
  checkNullableIsoDateField(value, 'inbound_date', path, issues);
  checkNonNegativeInteger(value, 'passengers_adults', path, issues);
  checkNonNegativeInteger(value, 'passengers_children', path, issues);
  checkNonNegativeInteger(value, 'passengers_infants', path, issues);
}

function validatePriceObservation(
  value: unknown,
  path: string,
  issues: CustomerSafeValidationIssue[],
): void {
  if (!isPlainObject(value)) {
    pushIssue(
      issues,
      path,
      'invalid_nested_object',
      'price_observation must be an object',
      'object',
      describe(value),
    );
    return;
  }
  checkNullableNonNegativeFiniteNumber(value, 'observed_price_usd', path, issues);
  checkNullableString(value, 'observed_currency_original', path, issues);
  checkNullableNonNegativeFiniteNumber(value, 'observed_price_original', path, issues);
  checkNullablePositiveFiniteNumber(value, 'fx_rate_to_usd', path, issues);
  checkNullableIsoDatetimeField(value, 'fx_observed_at', path, issues);
  checkNullableString(value, 'price_missing_reason', path, issues);
}

function validateCustomerSafeProviderInfo(
  value: unknown,
  path: string,
  issues: CustomerSafeValidationIssue[],
): void {
  if (!isPlainObject(value)) {
    pushIssue(
      issues,
      path,
      'invalid_nested_object',
      'provider_info must be an object',
      'object',
      describe(value),
    );
    return;
  }
  checkNullableString(value, 'primary_provider', path, issues);
  checkNullableNonNegativeInteger(value, 'price_freshness_seconds', path, issues);
  checkEnumField(
    value,
    'disagreement_summary',
    path,
    DISAGREEMENT_SUMMARY_VALUES,
    "'agree' | 'disagree' | 'unknown'",
    issues,
  );
  // Note: forbidden cross_check_* and primary_provider_offer_id keys, if
  // present here, are caught by the global walker. We do not duplicate the
  // check; the walker emits one issue per occurrence with the correct path.
}

function validateFlightSpecific(
  value: unknown,
  path: string,
  issues: CustomerSafeValidationIssue[],
): void {
  if (!isPlainObject(value)) {
    pushIssue(
      issues,
      path,
      'invalid_nested_object',
      'product_specific must be an object',
      'object',
      describe(value),
    );
    return;
  }

  const ptField = requireField(value, 'product_type', path, "literal 'flight'", issues);
  if (ptField.present && ptField.value !== 'flight') {
    pushIssue(
      issues,
      joinPath(path, 'product_type'),
      'invalid_literal',
      `product_specific.product_type must be the literal 'flight' in Phase 1`,
      "'flight'",
      describe(ptField.value),
    );
  }

  checkNullableString(value, 'airline_code', path, issues);
  checkNullableNonNegativeInteger(value, 'stops', path, issues);

  const cabinField = requireField(
    value,
    'cabin',
    path,
    "'economy' | 'premium_economy' | 'business' | 'first' | null",
    issues,
  );
  if (cabinField.present) {
    const cabin = cabinField.value;
    if (cabin !== null) {
      if (!isString(cabin) || !FLIGHT_CABIN_VALUES.has(cabin)) {
        pushIssue(
          issues,
          joinPath(path, 'cabin'),
          'invalid_enum',
          `cabin must be one of: economy, premium_economy, business, first, or null`,
          "'economy' | 'premium_economy' | 'business' | 'first' | null",
          describe(cabin),
        );
      }
    }
  }

  checkBooleanField(value, 'is_round_trip', path, issues);
  checkNullablePositiveInteger(value, 'outbound_duration_minutes', path, issues);
  checkNullablePositiveInteger(value, 'inbound_duration_minutes', path, issues);
}

function validateReason(
  value: unknown,
  path: string,
  issues: CustomerSafeValidationIssue[],
): void {
  if (!isPlainObject(value)) {
    pushIssue(
      issues,
      path,
      'invalid_nested_object',
      'reason must be an object',
      'object',
      describe(value),
    );
    return;
  }
  checkNonEmptyString(value, 'code', path, issues);
  checkNonEmptyString(value, 'message', path, issues);
  checkEnumField(
    value,
    'severity',
    path,
    REASON_SEVERITY_VALUES,
    "'info' | 'positive' | 'cautionary' | 'blocking'",
    issues,
  );
}

function validateReasonsArray(
  value: unknown,
  path: string,
  issues: CustomerSafeValidationIssue[],
): void {
  if (!Array.isArray(value)) {
    pushIssue(
      issues,
      path,
      'invalid_array',
      'reasons must be an array',
      'Reason[]',
      describe(value),
    );
    return;
  }
  for (let i = 0; i < value.length; i += 1) {
    validateReason(value[i], joinPath(path, i), issues);
  }
}

function validateComparisonAnchor(
  value: unknown,
  path: string,
  issues: CustomerSafeValidationIssue[],
): void {
  if (!isPlainObject(value)) {
    pushIssue(
      issues,
      path,
      'invalid_nested_object',
      'comparison_anchor must be an object or null',
      'ComparisonAnchor | null',
      describe(value),
    );
    return;
  }
  const atField = requireField(
    value,
    'anchor_type',
    path,
    "'training_quantile' | 'rolling_min_30' | 'rolling_median_30' | 'mission_baseline' | 'historical_avg'",
    issues,
  );
  if (atField.present) {
    if (!isString(atField.value) || !COMPARISON_ANCHOR_TYPE_VALUES.has(atField.value)) {
      pushIssue(
        issues,
        joinPath(path, 'anchor_type'),
        'invalid_enum',
        `anchor_type is not a valid ComparisonAnchor type`,
        "'training_quantile' | 'rolling_min_30' | 'rolling_median_30' | 'mission_baseline' | 'historical_avg'",
        describe(atField.value),
      );
    }
  }
  checkNullableNonNegativeFiniteNumber(value, 'anchor_value_usd', path, issues);
  checkNonEmptyString(value, 'description', path, issues);
}

function validateBundleContext(
  value: unknown,
  path: string,
  issues: CustomerSafeValidationIssue[],
): void {
  if (!isPlainObject(value)) {
    pushIssue(
      issues,
      path,
      'invalid_nested_object',
      'bundle_context must be an object or null',
      'BundleContext | null',
      describe(value),
    );
    return;
  }
  checkNonEmptyString(value, 'bundle_id', path, issues);
  const crField = requireField(
    value,
    'component_role',
    path,
    "'flight' | 'hotel' | 'car'",
    issues,
  );
  if (crField.present) {
    if (!isString(crField.value) || !BUNDLE_COMPONENT_ROLE_VALUES.has(crField.value)) {
      pushIssue(
        issues,
        joinPath(path, 'component_role'),
        'invalid_enum',
        `component_role must be one of: flight, hotel, car`,
        "'flight' | 'hotel' | 'car'",
        describe(crField.value),
      );
    }
  }
  checkPositiveInteger(value, 'total_components', path, issues);
}

// -----------------------------------------------------------------------------
// Phase 1 anchors
// -----------------------------------------------------------------------------

function checkPhase1ProductType(
  obj: Record<string, unknown>,
  issues: CustomerSafeValidationIssue[],
): void {
  if (obj.product_type !== undefined && obj.product_type !== 'flight') {
    pushIssue(
      issues,
      'product_type',
      'invalid_phase1_product',
      `product_type must be 'flight' in Phase 1 (per B1_IMPLEMENTATION_PLAN.md §4 anchor 1)`,
      "'flight'",
      describe(obj.product_type),
    );
  }
}

function checkPhase1AutoBuy(
  obj: Record<string, unknown>,
  issues: CustomerSafeValidationIssue[],
): void {
  if (obj.can_autobuy === true) {
    pushIssue(
      issues,
      'can_autobuy',
      'invalid_autobuy_phase1',
      `can_autobuy must be false in Phase 1 (per LARGO_ADVICE_CONTRACT.md §6 + B1_IMPLEMENTATION_PLAN.md §4 anchor 2)`,
      'false',
      describe(obj.can_autobuy),
    );
  }
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Validate that an arbitrary `unknown` value matches the runtime shape of
 * `CustomerSafeAdvice` AND contains no admin-only field anywhere in its
 * object tree.
 *
 * Pure, deterministic, non-mutating, never throws. Collects ALL issues from
 * a single pass.
 *
 * On success, `result.value` is the SAME REFERENCE as the input narrowed to
 * `CustomerSafeAdvice`. On failure, `result.value` is `never`-typed (i.e.
 * the failure branch carries no value at runtime).
 */
export function validateCustomerSafeAdvice(
  input: unknown,
): CustomerSafeValidationResult {
  const issues: CustomerSafeValidationIssue[] = [];

  // ---- Top-level shape ---------------------------------------------------
  if (!isPlainObject(input)) {
    pushIssue(
      issues,
      '',
      'not_object',
      'CustomerSafeAdvice input must be a plain object',
      'object',
      describe(input),
    );
    return { ok: false, issues };
  }

  // ---- Pass 1: forbidden customer keys ----------------------------------
  // Run BEFORE structural checks so the caller sees admin leaks regardless
  // of whether the rest of the shape is valid.
  walkForbiddenKeys(input, '', issues);

  // ---- Pass 2: structural validation ------------------------------------

  // schema_version literal
  const svField = requireField(
    input,
    'schema_version',
    '',
    `literal '${CONTRACT_VERSION_LITERAL}'`,
    issues,
  );
  if (svField.present && svField.value !== CONTRACT_VERSION_LITERAL) {
    pushIssue(
      issues,
      'schema_version',
      'invalid_contract_version',
      `schema_version must be the literal '${CONTRACT_VERSION_LITERAL}'`,
      `'${CONTRACT_VERSION_LITERAL}'`,
      describe(svField.value),
    );
  }

  // Identification
  checkNonEmptyString(input, 'advice_id', '', issues);
  checkNullableString(input, 'user_id', '', issues);
  checkNullableString(input, 'mission_id', '', issues);
  checkEnumField(
    input,
    'surface',
    '',
    SURFACE_VALUES,
    "'simple_search' | 'mission_scan' | 'manual_check'",
    issues,
  );

  // Temporal
  checkIsoDatetimeField(input, 'generated_at', '', issues);
  checkIsoDatetimeField(input, 'valid_until', '', issues);

  // Decision
  checkEnumField(
    input,
    'action',
    '',
    ACTION_VALUES,
    "'BUY_NOW' | 'WAIT' | 'ALERT' | 'MONITOR' | 'ABSTAIN'",
    issues,
  );
  checkEnumField(
    input,
    'confidence_label',
    '',
    CONFIDENCE_LABEL_VALUES,
    "'high' | 'moderate' | 'limited' | 'unavailable'",
    issues,
  );
  // numeric_value is admin-only; absent in the type and caught by the walker
  // if injected. No structural check needed here.

  // Product type
  checkEnumField(
    input,
    'product_type',
    '',
    PRODUCT_TYPE_VALUES,
    "'flight' | 'hotel' | 'car' | 'bundle'",
    issues,
  );

  // Product context
  const pcField = requireField(input, 'product_context', '', 'object', issues);
  if (pcField.present) {
    validateProductContext(pcField.value, 'product_context', issues);
  }

  // Product specific (FlightSpecific in Phase 1)
  const psField = requireField(input, 'product_specific', '', 'object', issues);
  if (psField.present) {
    validateFlightSpecific(psField.value, 'product_specific', issues);
  }

  // Price observation
  const poField = requireField(input, 'price_observation', '', 'object', issues);
  if (poField.present) {
    validatePriceObservation(poField.value, 'price_observation', issues);
  }

  // Provider info — CUSTOMER-SAFE shape (3 fields), not the LargoAdvice shape.
  const piField = requireField(input, 'provider_info', '', 'object', issues);
  if (piField.present) {
    validateCustomerSafeProviderInfo(piField.value, 'provider_info', issues);
  }

  // Reasons
  const rField = requireField(input, 'reasons', '', 'Reason[]', issues);
  if (rField.present) {
    validateReasonsArray(rField.value, 'reasons', issues);
  }

  // Comparison anchor (nullable)
  const caField = requireField(
    input,
    'comparison_anchor',
    '',
    'ComparisonAnchor | null',
    issues,
  );
  if (caField.present && caField.value !== null) {
    validateComparisonAnchor(caField.value, 'comparison_anchor', issues);
  }

  // Customer-facing message
  checkNonEmptyString(input, 'short_message', '', issues);

  // Capability flags
  checkBooleanField(input, 'can_autobuy', '', issues);
  checkBooleanField(input, 'ml_available', '', issues);

  // Bundle context (nullable)
  const bcField = requireField(
    input,
    'bundle_context',
    '',
    'BundleContext | null',
    issues,
  );
  if (bcField.present && bcField.value !== null) {
    validateBundleContext(bcField.value, 'bundle_context', issues);
  }

  // technical_details / audit_block / numeric_value are NOT structural fields
  // of CustomerSafeAdvice. If present, the forbidden walker has already
  // reported them.

  // ---- Phase 1 anchors --------------------------------------------------
  checkPhase1ProductType(input, issues);
  checkPhase1AutoBuy(input, issues);

  // ---- Result -----------------------------------------------------------
  if (issues.length > 0) {
    return { ok: false, issues };
  }
  // No issues → input matches CustomerSafeAdvice. Cast through `unknown`
  // to bridge the index-signature → named-fields gap (TS2352).
  return {
    ok: true,
    value: input as unknown as CustomerSafeAdvice,
    issues: [],
  };
}

// -----------------------------------------------------------------------------
// Internal-only re-exports for tests (do NOT import from customer code)
// -----------------------------------------------------------------------------

/**
 * Internal helpers exposed for unit testing only.
 *
 * @internal
 */
export const __internal = Object.freeze({
  CONTRACT_VERSION_LITERAL,
  FORBIDDEN_CUSTOMER_KEYS,
  ISO_DATETIME_RE,
  ISO_DATE_RE,
  isPlainObject,
  isFiniteNumber,
  isNonNegativeFiniteNumber,
  isPositiveFiniteNumber,
  isIsoDatetime,
  isIsoDate,
  describe,
  joinPath,
  walkForbiddenKeys,
});

// Lint-quiet imports kept for documentary consistency with the contract types
// referenced in this file's behavior.
export type {
  ComparisonAnchor,
  ContractVersion,
  FlightSpecific,
  LargoAdviceAction,
  LargoConfidenceLabel,
  LargoProductType,
  LargoReasonSeverity,
  LargoSurface,
  PriceObservation,
  ProductContext,
  Reason,
  BundleContext,
  CustomerSafeAdvice,
  CustomerSafeProviderInfo,
  ProviderDisagreementSummary,
};
