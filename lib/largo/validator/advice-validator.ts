/**
 * Largo — `validateLargoAdvice` runtime validator (Sprint 1.3, B1).
 *
 * Pure, deterministic, dependency-free runtime validator for `LargoAdvice`
 * v0.1.0. Closes the produce → validate → strip vertical slice:
 *
 *   StubLargoAdviceInput
 *     → produceStubLargoAdvice (Sprint 1.2)
 *     → LargoAdvice
 *     → validateLargoAdvice (this file)
 *     → stripToCustomerSafe (Sprint 1.1)
 *     → CustomerSafeAdvice
 *
 * Behavior contract:
 *  - INPUT: `unknown`. The caller may pass anything.
 *  - OUTPUT: a discriminated union, never throws.
 *      • `{ ok: true,  value: LargoAdvice, issues: [] }` when the input
 *        matches the contract shape AND Phase 1 invariants.
 *      • `{ ok: false, value: null,        issues: LargoValidationIssue[] }`
 *        otherwise. ALL issues from a single pass are collected; the
 *        validator does not bail at the first error.
 *  - On success, `value` is the SAME REFERENCE as the input narrowed to
 *    `LargoAdvice`. The validator does NOT clone, does NOT freeze.
 *
 * Discipline (per `docs/b1/B1_IMPLEMENTATION_PLAN.md` §7, §13;
 * `docs/b1/CLAUDE_CODE_RULES.md` §17, §18):
 *  - PURE. No I/O, no async, no fetch, no DB, no env, no `Date.now()`,
 *    no `Math.random()`.
 *  - NON-MUTATING. Input is structurally unchanged on return.
 *  - NO COERCION. The validator does NOT "fix" bad input, does NOT
 *    default missing fields, does NOT convert types. It REPORTS, never
 *    repairs.
 *  - NULL-AWARE. Accepts valid `null` where the contract permits null;
 *    rejects `null` where the contract requires a value.
 *  - DEPENDENCY-FREE. No zod / valibot / yup / ajv / io-ts. Hand-written
 *    in plain TypeScript. Trivially auditable.
 *  - PHASE 1 ANCHORED. Enforces three Phase 1 invariants beyond shape:
 *      `product_type === 'flight'`,
 *      `can_autobuy === false`,
 *      `audit_block.audit_id === advice_id` (when `audit_block` populated).
 *  - SCOPE-LIMITED. Does NOT enforce business policy beyond structural
 *    invariants:
 *      • Expired advice (`valid_until` in the past) → still structurally valid.
 *      • Provider disagreement → still structurally valid.
 *      • `ml_available === false` → still structurally valid.
 *      • Action↔price/provider/ml coupling → NOT enforced here.
 *    Those concerns belong to backend gates (Sprint 3+) and to the
 *    producer's own discipline (already enforced by `produceStubLargoAdvice`).
 *
 * Sources of truth (read these before extending this file):
 *  - `docs/b0/LARGO_ADVICE_CONTRACT.md` §3 (enums), §4 (master interface),
 *    §6 (`can_autobuy`), §8–§17 (sub-shapes), §20 (forbidden patterns).
 *  - `docs/b0/LARGO_BACKEND_API_SPEC.md` §10 (strip rule consumed by tests).
 *  - `docs/b0/LARGO_MODEL_STRATEGY.md` §4, §21, §25.4, §37 (forbidden patterns;
 *    none enforceable at validator layer beyond structural checks).
 *  - `docs/b1/B1_IMPLEMENTATION_PLAN.md` §4 anchors, §7 (purity), §13
 *    (Sprint 2 deliverable — runtime validator).
 *  - `docs/b1/CLAUDE_CODE_RULES.md` §17 (no scope creep), §18 (no new deps).
 */

import type {
  AuditBlock,
  BundleContext,
  ComparisonAnchor,
  ContractVersion,
  FlightSpecific,
  LargoAdvice,
  LargoAdviceAction,
  LargoConfidenceLabel,
  LargoProductType,
  LargoReasonSeverity,
  LargoSurface,
  PriceObservation,
  ProductContext,
  ProviderInfo,
  Reason,
} from '@/types/largo/advice';

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

/**
 * The fixed set of issue codes the validator emits. Stable identifiers so
 * downstream code can switch on them, render localized messages, etc.
 */
export type LargoValidationIssueCode =
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
  | 'invalid_audit_phase1'
  | 'unexpected_internal_state';

/**
 * One structured validation issue. Path uses dot/bracket notation
 * (e.g. `product_context.origin`, `reasons[2].code`). `expected` and
 * `actual` are diagnostic strings, optional.
 */
export interface LargoValidationIssue {
  path: string;
  code: LargoValidationIssueCode;
  message: string;
  expected?: string;
  actual?: string;
}

/**
 * Discriminated union returned by `validateLargoAdvice`. The success branch
 * carries the input narrowed to `LargoAdvice`; the failure branch carries
 * the list of issues. Tests should always check `result.ok` first.
 */
export type LargoValidationResult =
  | { ok: true; value: LargoAdvice; issues: [] }
  | { ok: false; value: null; issues: LargoValidationIssue[] };

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

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
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

/** Render an arbitrary value as a short diagnostic string. */
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

/** Append a structured issue to the collector. */
function pushIssue(
  issues: LargoValidationIssue[],
  path: string,
  code: LargoValidationIssueCode,
  message: string,
  expected?: string,
  actual?: string,
): void {
  const issue: LargoValidationIssue = { path, code, message };
  if (expected !== undefined) issue.expected = expected;
  if (actual !== undefined) issue.actual = actual;
  issues.push(issue);
}

/** Build a path string using dot notation for keys, brackets for indices. */
function joinPath(prefix: string, segment: string | number): string {
  if (typeof segment === 'number') return `${prefix}[${segment}]`;
  return prefix === '' ? segment : `${prefix}.${segment}`;
}

// -----------------------------------------------------------------------------
// Generic field-level checks (each appends to issues, never throws)
// -----------------------------------------------------------------------------

function requireField(
  obj: Record<string, unknown>,
  field: string,
  pathPrefix: string,
  expected: string,
  issues: LargoValidationIssue[],
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
  issues: LargoValidationIssue[],
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
  issues: LargoValidationIssue[],
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
  issues: LargoValidationIssue[],
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
  issues: LargoValidationIssue[],
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
  issues: LargoValidationIssue[],
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
  issues: LargoValidationIssue[],
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

function checkNullableFiniteNumber(
  obj: Record<string, unknown>,
  field: string,
  pathPrefix: string,
  issues: LargoValidationIssue[],
): void {
  const { present, value } = requireField(
    obj,
    field,
    pathPrefix,
    'finite number | null',
    issues,
  );
  if (!present) return;
  if (value === null) return;
  if (!isFiniteNumber(value)) {
    pushIssue(
      issues,
      joinPath(pathPrefix, field),
      'invalid_number',
      `field "${field}" must be a finite number or null`,
      'finite number | null',
      describe(value),
    );
  }
}

function checkNullableNonNegativeInteger(
  obj: Record<string, unknown>,
  field: string,
  pathPrefix: string,
  issues: LargoValidationIssue[],
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
  issues: LargoValidationIssue[],
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
  issues: LargoValidationIssue[],
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
  issues: LargoValidationIssue[],
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
  issues: LargoValidationIssue[],
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
  issues: LargoValidationIssue[],
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
  issues: LargoValidationIssue[],
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
// Sub-shape validators
// -----------------------------------------------------------------------------

function validateProductContext(
  value: unknown,
  path: string,
  issues: LargoValidationIssue[],
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
  issues: LargoValidationIssue[],
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

function validateProviderInfo(
  value: unknown,
  path: string,
  issues: LargoValidationIssue[],
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
  checkNullableString(value, 'primary_provider_offer_id', path, issues);
  checkNullableString(value, 'cross_check_provider', path, issues);
  checkNullableString(value, 'cross_check_offer_id', path, issues);
  checkNullableFiniteNumber(value, 'cross_check_disagreement_pct', path, issues);
  checkNullableNonNegativeInteger(value, 'price_freshness_seconds', path, issues);
}

function validateFlightSpecific(
  value: unknown,
  path: string,
  issues: LargoValidationIssue[],
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

  // product_type literal: must be exactly 'flight' (Phase 1).
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

  // cabin: enum or null.
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
  issues: LargoValidationIssue[],
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
  issues: LargoValidationIssue[],
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
  issues: LargoValidationIssue[],
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
  // anchor_type enum.
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
  issues: LargoValidationIssue[],
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
  // component_role enum.
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

function validateAuditBlock(
  value: unknown,
  path: string,
  expectedAuditId: string | null,
  issues: LargoValidationIssue[],
): void {
  if (!isPlainObject(value)) {
    pushIssue(
      issues,
      path,
      'invalid_nested_object',
      'audit_block must be an object',
      'AuditBlock | null',
      describe(value),
    );
    return;
  }
  checkNonEmptyString(value, 'audit_id', path, issues);
  checkNullableString(value, 'parent_advice_id', path, issues);

  // Phase 1 invariant: audit_block.audit_id === advice_id.
  if (
    expectedAuditId !== null &&
    isString(value.audit_id) &&
    value.audit_id !== expectedAuditId
  ) {
    pushIssue(
      issues,
      joinPath(path, 'audit_id'),
      'invalid_audit_phase1',
      `audit_block.audit_id must equal advice_id in Phase 1`,
      `"${expectedAuditId}"`,
      describe(value.audit_id),
    );
  }
}

// -----------------------------------------------------------------------------
// Phase 1 anchor checks (applied at master level)
// -----------------------------------------------------------------------------

function checkPhase1ProductType(
  obj: Record<string, unknown>,
  issues: LargoValidationIssue[],
): void {
  // Only fires once the top-level product_type field is structurally a valid enum.
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
  issues: LargoValidationIssue[],
): void {
  // Only fires when can_autobuy is structurally a boolean and === true.
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
 * `LargoAdvice` v0.1.0 plus the three Phase 1 anchors.
 *
 * Pure, deterministic, non-mutating, never throws. Collects ALL issues from
 * a single pass; the caller can inspect `result.issues` to render the full
 * picture without re-validation.
 *
 * On success, `result.value` is the SAME REFERENCE as the input narrowed to
 * `LargoAdvice`. The validator does NOT clone; the caller is responsible for
 * not mutating the returned value if immutability is desired downstream.
 *
 * @param input Anything.
 * @returns Discriminated union: `{ ok: true, value, issues: [] }` or
 *          `{ ok: false, value: null, issues: [...] }`.
 */
export function validateLargoAdvice(input: unknown): LargoValidationResult {
  const issues: LargoValidationIssue[] = [];

  // ---- Top-level shape ---------------------------------------------------
  if (!isPlainObject(input)) {
    pushIssue(
      issues,
      '',
      'not_object',
      'LargoAdvice input must be a plain object',
      'object',
      describe(input),
    );
    return { ok: false, value: null, issues };
  }

  // ---- Schema literal ---------------------------------------------------
  const svField = requireField(
    input,
    'schema_version',
    '',
    `literal '${CONTRACT_VERSION_LITERAL}'`,
    issues,
  );
  if (svField.present) {
    if (svField.value !== CONTRACT_VERSION_LITERAL) {
      pushIssue(
        issues,
        'schema_version',
        'invalid_contract_version',
        `schema_version must be the literal '${CONTRACT_VERSION_LITERAL}'`,
        `'${CONTRACT_VERSION_LITERAL}'`,
        describe(svField.value),
      );
    }
  }

  // ---- Identification ----------------------------------------------------
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

  // ---- Temporal ----------------------------------------------------------
  checkIsoDatetimeField(input, 'generated_at', '', issues);
  checkIsoDatetimeField(input, 'valid_until', '', issues);

  // ---- Decision ----------------------------------------------------------
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
  checkNullableFiniteNumber(input, 'numeric_value', '', issues);

  // ---- Product type ------------------------------------------------------
  checkEnumField(
    input,
    'product_type',
    '',
    PRODUCT_TYPE_VALUES,
    "'flight' | 'hotel' | 'car' | 'bundle'",
    issues,
  );

  // ---- Product context (nested object) -----------------------------------
  const pcField = requireField(input, 'product_context', '', 'object', issues);
  if (pcField.present) {
    validateProductContext(pcField.value, 'product_context', issues);
  }

  // ---- Product specific (FlightSpecific in Phase 1) ----------------------
  const psField = requireField(input, 'product_specific', '', 'object', issues);
  if (psField.present) {
    validateFlightSpecific(psField.value, 'product_specific', issues);
  }

  // ---- Price observation (nested object) ---------------------------------
  const poField = requireField(input, 'price_observation', '', 'object', issues);
  if (poField.present) {
    validatePriceObservation(poField.value, 'price_observation', issues);
  }

  // ---- Provider info (nested object) -------------------------------------
  const piField = requireField(input, 'provider_info', '', 'object', issues);
  if (piField.present) {
    validateProviderInfo(piField.value, 'provider_info', issues);
  }

  // ---- Reasons (array) ---------------------------------------------------
  const rField = requireField(input, 'reasons', '', 'Reason[]', issues);
  if (rField.present) {
    validateReasonsArray(rField.value, 'reasons', issues);
  }

  // ---- Comparison anchor (nullable nested) -------------------------------
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

  // ---- Customer-facing message ------------------------------------------
  checkNonEmptyString(input, 'short_message', '', issues);

  // ---- Technical details (nullable record-of-anything) -------------------
  const tdField = requireField(
    input,
    'technical_details',
    '',
    'object | null',
    issues,
  );
  if (tdField.present && tdField.value !== null) {
    if (!isPlainObject(tdField.value)) {
      pushIssue(
        issues,
        'technical_details',
        'invalid_nested_object',
        'technical_details must be an object or null',
        'object | null',
        describe(tdField.value),
      );
    }
    // Inner shape is `Record<string, unknown>` per the contract — every key
    // points at `unknown`, so no per-field check is performed here.
  }

  // ---- Capability flags --------------------------------------------------
  checkBooleanField(input, 'can_autobuy', '', issues);
  checkBooleanField(input, 'ml_available', '', issues);

  // ---- Bundle context (nullable nested) ----------------------------------
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

  // ---- Audit block (OPTIONAL field, may be absent / null / object) -------
  // Per the contract, `audit_block?` may be missing entirely.
  if ('audit_block' in input) {
    const ab = input.audit_block;
    if (ab !== null && ab !== undefined) {
      const expectedAuditId = isString(input.advice_id) ? input.advice_id : null;
      validateAuditBlock(ab, 'audit_block', expectedAuditId, issues);
    }
    // `null` and `undefined` are explicitly allowed (matches `AuditBlock | null` type
    // plus the optional `?:` modifier).
  }

  // ---- Phase 1 anchors (after structural checks; only fire on well-formed
  //      values to avoid duplicate noise) ---------------------------------
  checkPhase1ProductType(input, issues);
  checkPhase1AutoBuy(input, issues);

  // ---- Result ------------------------------------------------------------
  if (issues.length > 0) {
    return { ok: false, value: null, issues };
  }
  // No issues → input matches the contract; narrow and return as LargoAdvice.
  // Cast through `unknown` to bridge the index-signature → named-fields gap
  // (same pattern as `strip.test.ts` after Sprint 1's TS2352 fix).
  return { ok: true, value: input as unknown as LargoAdvice, issues: [] };
}

// -----------------------------------------------------------------------------
// Internal-only re-exports for tests (do NOT import from customer code)
// -----------------------------------------------------------------------------

/**
 * Internal helpers exposed for unit testing only. Not part of the public API.
 *
 * @internal
 */
export const __internal = Object.freeze({
  CONTRACT_VERSION_LITERAL,
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
});

// Lint-quiet imports kept for documentary consistency with the contract types
// referenced in this file's behavior. Future endpoint code that consumes
// `validateLargoAdvice` may also import these directly from `@/types/largo/advice`.
export type {
  AuditBlock,
  BundleContext,
  ComparisonAnchor,
  ContractVersion,
  FlightSpecific,
  LargoAdvice,
  LargoAdviceAction,
  LargoConfidenceLabel,
  LargoProductType,
  LargoReasonSeverity,
  LargoSurface,
  PriceObservation,
  ProductContext,
  ProviderInfo,
  Reason,
};
