/**
 * Largo — `validateLargoAdvice` unit tests (Sprint 1.3, B1).
 *
 * Verifies the runtime validator per:
 *  - `docs/b0/LARGO_ADVICE_CONTRACT.md` §3 (enums), §4 (master interface),
 *    §6 (`can_autobuy`), §8–§17 (sub-shapes), §20 (forbidden patterns).
 *  - `docs/b0/LARGO_BACKEND_API_SPEC.md` §10 (strip rule consumed in pipeline tests).
 *  - `docs/b0/LARGO_MODEL_STRATEGY.md` §4, §21, §25.4, §37 (forbidden patterns;
 *    only structurally enforceable subset is tested here).
 *  - `docs/b1/B1_IMPLEMENTATION_PLAN.md` §4 (Phase 1 anchors), §7 (purity),
 *    §13 (Sprint 2 deliverable), §19 (test-invariant style).
 *  - `docs/b1/CLAUDE_CODE_RULES.md` §17 (no scope creep), §18 (no new deps).
 *
 * Test runner: same self-running harness as `tests/largo/safe-view/strip.test.ts`
 * and `tests/largo/producer/stub.test.ts`. Runs via:
 *
 *   npx tsx tests/largo/validator/advice-validator.test.ts
 *
 * No dependency added; no `package.json` / `tsconfig.json` modified.
 */

import { strict as assert } from 'node:assert';
import {
  validateLargoAdvice,
  type LargoValidationIssue,
  type LargoValidationIssueCode,
  type LargoValidationResult,
} from '@/lib/largo/validator/advice-validator';
import {
  produceStubLargoAdvice,
  type StubLargoAdviceInput,
} from '@/lib/largo/producer/stub';
import { stripToCustomerSafe } from '@/lib/largo/safe-view/strip';

// -----------------------------------------------------------------------------
// Tiny test harness (no dependencies)
// -----------------------------------------------------------------------------

type TestFn = () => void;
type TestEntry = { name: string; fn: TestFn };
const tests: TestEntry[] = [];

function test(name: string, fn: TestFn): void {
  tests.push({ name, fn });
}

function runAll(): void {
  let passed = 0;
  let failed = 0;
  const failures: { name: string; error: unknown }[] = [];

  for (const entry of tests) {
    try {
      entry.fn();
      passed += 1;
      console.log(`  ok  — ${entry.name}`);
    } catch (error) {
      failed += 1;
      failures.push({ name: entry.name, error });
      console.error(`  FAIL — ${entry.name}`);
    }
  }

  console.log('');
  console.log(`Tests: ${tests.length}  Passed: ${passed}  Failed: ${failed}`);

  if (failed > 0) {
    console.error('');
    console.error('Failures:');
    for (const f of failures) {
      console.error(`  - ${f.name}`);
      console.error(`    ${(f.error as Error).message ?? String(f.error)}`);
    }
    process.exitCode = 1;
  }
}

// -----------------------------------------------------------------------------
// Builders mirroring `tests/largo/producer/stub.test.ts` for pipeline tests
// -----------------------------------------------------------------------------

const NOW_ISO = '2026-04-27T10:00:00.000Z';

function buildBuyNowInput(): StubLargoAdviceInput {
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

function buildWaitInput(): StubLargoAdviceInput {
  return {
    surface: 'mission',
    user_id: 'usr_test',
    mission_id: 'msn_test',
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

function buildAbstainRouteUnknownInput(): StubLargoAdviceInput {
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

function buildAbstainProviderUnavailableInput(): StubLargoAdviceInput {
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

function buildProviderDisagreementInput(): StubLargoAdviceInput {
  return {
    surface: 'simple_search',
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

function buildMlUnavailableInput(): StubLargoAdviceInput {
  return {
    surface: 'simple_search',
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

const allBuilders: Array<() => StubLargoAdviceInput> = [
  buildBuyNowInput,
  buildWaitInput,
  buildAbstainRouteUnknownInput,
  buildAbstainProviderUnavailableInput,
  buildProviderDisagreementInput,
  buildMlUnavailableInput,
];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Find the first issue with the given code. Returns undefined if absent. */
function firstIssue(
  result: LargoValidationResult,
  code: LargoValidationIssueCode,
): LargoValidationIssue | undefined {
  if (result.ok) return undefined;
  return result.issues.find((i) => i.code === code);
}

/** Assert a result is `ok: false` and emits an issue with the given code. */
function assertHasIssueCode(
  result: LargoValidationResult,
  code: LargoValidationIssueCode,
  message?: string,
): void {
  assert.strictEqual(result.ok, false, message ?? `expected validation to fail`);
  if (result.ok) return; // narrowing for TS
  assert.ok(
    result.issues.some((i) => i.code === code),
    `expected an issue with code "${code}"; got: ${result.issues
      .map((i) => i.code)
      .join(', ')}`,
  );
}

/** Build a known-good `LargoAdvice` from the BUY_NOW stub. */
function goodAdvice(): unknown {
  return produceStubLargoAdvice(buildBuyNowInput());
}

// -----------------------------------------------------------------------------
// Group A — Smoke / pipeline (validate + strip composition)
// -----------------------------------------------------------------------------

// A1. Each stub scenario validates successfully.
test('validates produceStubLargoAdvice output for every scenario', () => {
  for (const build of allBuilders) {
    const advice = produceStubLargoAdvice(build());
    const result = validateLargoAdvice(advice);
    if (!result.ok) {
      const codes = result.issues.map((i) => `${i.path}:${i.code}`).join('\n  ');
      assert.fail(`scenario must validate, got issues:\n  ${codes}`);
    }
  }
});

// A2. On success, value === input (same reference; no clone).
test('on success, returned value is the same reference as input', () => {
  const advice = produceStubLargoAdvice(buildBuyNowInput());
  const result = validateLargoAdvice(advice);
  assert.strictEqual(result.ok, true);
  if (result.ok) {
    assert.strictEqual(result.value, advice);
  }
});

// A3. On success, issues is exactly [].
test('on success, issues array is empty', () => {
  const result = validateLargoAdvice(goodAdvice());
  assert.strictEqual(result.ok, true);
  if (result.ok) {
    assert.deepStrictEqual(result.issues, []);
  }
});

// A4. produce → validate → strip pipeline runs on every scenario.
test('produce → validate → strip pipeline succeeds on every scenario', () => {
  for (const build of allBuilders) {
    const advice = produceStubLargoAdvice(build());
    const validated = validateLargoAdvice(advice);
    assert.strictEqual(validated.ok, true);
    if (!validated.ok) continue;
    const stripped = stripToCustomerSafe(validated.value);
    assert.strictEqual(stripped.schema_version, '0.1.0');
    assert.strictEqual(stripped.advice_id, advice.advice_id);
    assert.strictEqual(stripped.action, advice.action);
  }
});

// A5. Validator never throws, even for adversarial input.
test('validator never throws (adversarial inputs)', () => {
  const adversarial: unknown[] = [
    null,
    undefined,
    0,
    NaN,
    Infinity,
    -Infinity,
    '',
    'not an object',
    [],
    [1, 2, 3],
    true,
    false,
    () => 0,
    Symbol('x') as unknown,
    new Map(),
    new Set(),
    Object.create(null),
  ];
  for (const value of adversarial) {
    assert.doesNotThrow(() => validateLargoAdvice(value));
    const result = validateLargoAdvice(value);
    assert.ok(typeof result === 'object' && result !== null);
    assert.ok(result.ok === true || result.ok === false);
  }
});

// -----------------------------------------------------------------------------
// Group B — Top-level shape rejections
// -----------------------------------------------------------------------------

test('rejects null with not_object', () => {
  const result = validateLargoAdvice(null);
  assertHasIssueCode(result, 'not_object');
});

test('rejects undefined with not_object', () => {
  const result = validateLargoAdvice(undefined);
  assertHasIssueCode(result, 'not_object');
});

test('rejects array with not_object', () => {
  const result = validateLargoAdvice([1, 2, 3]);
  assertHasIssueCode(result, 'not_object');
});

test('rejects number with not_object', () => {
  const result = validateLargoAdvice(42);
  assertHasIssueCode(result, 'not_object');
});

test('rejects string with not_object', () => {
  const result = validateLargoAdvice('not an advice');
  assertHasIssueCode(result, 'not_object');
});

test('rejects boolean with not_object', () => {
  const result = validateLargoAdvice(true);
  assertHasIssueCode(result, 'not_object');
});

test('rejects {} with many missing_field issues', () => {
  const result = validateLargoAdvice({});
  assert.strictEqual(result.ok, false);
  if (result.ok) return;
  const missing = result.issues.filter((i) => i.code === 'missing_field');
  // At least 15 top-level required fields are missing.
  assert.ok(
    missing.length >= 15,
    `expected ≥15 missing_field issues on empty object, got ${missing.length}`,
  );
});

// -----------------------------------------------------------------------------
// Group C — Required fields missing
// -----------------------------------------------------------------------------

function withoutField(field: string): Record<string, unknown> {
  const advice = goodAdvice() as Record<string, unknown>;
  const copy = { ...advice };
  delete copy[field];
  return copy;
}

test('missing schema_version reported', () => {
  const result = validateLargoAdvice(withoutField('schema_version'));
  const issue = firstIssue(result, 'missing_field');
  assert.ok(issue);
  assert.strictEqual(issue!.path, 'schema_version');
});

test('missing advice_id reported', () => {
  const result = validateLargoAdvice(withoutField('advice_id'));
  assertHasIssueCode(result, 'missing_field');
});

test('missing surface reported', () => {
  const result = validateLargoAdvice(withoutField('surface'));
  assertHasIssueCode(result, 'missing_field');
});

test('missing action reported', () => {
  const result = validateLargoAdvice(withoutField('action'));
  assertHasIssueCode(result, 'missing_field');
});

test('missing product_context reported', () => {
  const result = validateLargoAdvice(withoutField('product_context'));
  assertHasIssueCode(result, 'missing_field');
});

test('missing reasons reported', () => {
  const result = validateLargoAdvice(withoutField('reasons'));
  assertHasIssueCode(result, 'missing_field');
});

test('missing can_autobuy reported', () => {
  const result = validateLargoAdvice(withoutField('can_autobuy'));
  assertHasIssueCode(result, 'missing_field');
});

// -----------------------------------------------------------------------------
// Group D — Type checks
// -----------------------------------------------------------------------------

function withFieldOverride(
  field: string,
  value: unknown,
): Record<string, unknown> {
  const advice = goodAdvice() as Record<string, unknown>;
  return { ...advice, [field]: value };
}

test('rejects non-string schema_version', () => {
  const result = validateLargoAdvice(withFieldOverride('schema_version', 123));
  // Either invalid_contract_version (because value !== '0.1.0') or invalid_type;
  // both are acceptable provided we report some failure.
  assert.strictEqual(result.ok, false);
});

test('rejects empty advice_id', () => {
  const result = validateLargoAdvice(withFieldOverride('advice_id', ''));
  assertHasIssueCode(result, 'invalid_type');
});

test('rejects user_id as number (must be string|null)', () => {
  const result = validateLargoAdvice(withFieldOverride('user_id', 42));
  assertHasIssueCode(result, 'invalid_nullable');
});

test('rejects unknown surface enum', () => {
  const result = validateLargoAdvice(withFieldOverride('surface', 'invalid_surface'));
  assertHasIssueCode(result, 'invalid_enum');
});

test('rejects unknown action enum', () => {
  const result = validateLargoAdvice(withFieldOverride('action', 'YOLO_BUY'));
  assertHasIssueCode(result, 'invalid_enum');
});

test('rejects unknown confidence_label enum', () => {
  const result = validateLargoAdvice(
    withFieldOverride('confidence_label', 'super_high'),
  );
  assertHasIssueCode(result, 'invalid_enum');
});

test('rejects numeric_value as string (must be number|null)', () => {
  const result = validateLargoAdvice(withFieldOverride('numeric_value', '0.78'));
  assertHasIssueCode(result, 'invalid_number');
});

test('rejects ml_available as string', () => {
  const result = validateLargoAdvice(withFieldOverride('ml_available', 'true'));
  assertHasIssueCode(result, 'invalid_type');
});

test('rejects can_autobuy as 0 (must be boolean)', () => {
  const result = validateLargoAdvice(withFieldOverride('can_autobuy', 0));
  assertHasIssueCode(result, 'invalid_type');
});

// -----------------------------------------------------------------------------
// Group E — Literals and Phase 1 anchors
// -----------------------------------------------------------------------------

test('rejects schema_version other than "0.1.0"', () => {
  const result = validateLargoAdvice(withFieldOverride('schema_version', '0.2.0'));
  assertHasIssueCode(result, 'invalid_contract_version');
});

test('rejects product_type === "hotel" (Phase 1 = flights only)', () => {
  const result = validateLargoAdvice(withFieldOverride('product_type', 'hotel'));
  assertHasIssueCode(result, 'invalid_phase1_product');
});

test('rejects product_type === "car" (Phase 1 = flights only)', () => {
  const result = validateLargoAdvice(withFieldOverride('product_type', 'car'));
  assertHasIssueCode(result, 'invalid_phase1_product');
});

test('rejects product_type === "bundle" (Phase 1 = flights only)', () => {
  const result = validateLargoAdvice(withFieldOverride('product_type', 'bundle'));
  assertHasIssueCode(result, 'invalid_phase1_product');
});

test('rejects can_autobuy === true (Phase 1 anchor)', () => {
  const result = validateLargoAdvice(withFieldOverride('can_autobuy', true));
  assertHasIssueCode(result, 'invalid_autobuy_phase1');
});

test('rejects audit_block.audit_id !== advice_id (Phase 1 invariant)', () => {
  const advice = goodAdvice() as Record<string, unknown>;
  const ab = (advice.audit_block as { audit_id: string }) ?? null;
  const tampered = {
    ...advice,
    audit_block: { ...ab, audit_id: 'TAMPERED-AUDIT-ID' },
  };
  const result = validateLargoAdvice(tampered);
  assertHasIssueCode(result, 'invalid_audit_phase1');
});

test('rejects product_specific.product_type !== "flight" (literal)', () => {
  const advice = goodAdvice() as Record<string, unknown>;
  const ps = advice.product_specific as Record<string, unknown>;
  const tampered = {
    ...advice,
    product_specific: { ...ps, product_type: 'hotel' },
  };
  const result = validateLargoAdvice(tampered);
  assertHasIssueCode(result, 'invalid_literal');
});

// -----------------------------------------------------------------------------
// Group F — ISO datetime / date checks
// -----------------------------------------------------------------------------

test('rejects non-ISO generated_at', () => {
  const result = validateLargoAdvice(
    withFieldOverride('generated_at', '2026/04/27 10:00:00'),
  );
  assertHasIssueCode(result, 'invalid_iso_datetime');
});

test('rejects ISO without Z suffix', () => {
  const result = validateLargoAdvice(
    withFieldOverride('generated_at', '2026-04-27T10:00:00'),
  );
  assertHasIssueCode(result, 'invalid_iso_datetime');
});

test('rejects valid_until as a non-ISO string', () => {
  const result = validateLargoAdvice(
    withFieldOverride('valid_until', 'soonish'),
  );
  assertHasIssueCode(result, 'invalid_iso_datetime');
});

test('rejects product_context.outbound_date as non-date string', () => {
  const advice = goodAdvice() as Record<string, unknown>;
  const pc = advice.product_context as Record<string, unknown>;
  const tampered = {
    ...advice,
    product_context: { ...pc, outbound_date: 'next Tuesday' },
  };
  const result = validateLargoAdvice(tampered);
  assertHasIssueCode(result, 'invalid_date');
});

// -----------------------------------------------------------------------------
// Group G — Numeric checks (price, rates, counts)
// -----------------------------------------------------------------------------

test('rejects negative observed_price_usd', () => {
  const advice = goodAdvice() as Record<string, unknown>;
  const po = advice.price_observation as Record<string, unknown>;
  const tampered = { ...advice, price_observation: { ...po, observed_price_usd: -10 } };
  const result = validateLargoAdvice(tampered);
  assertHasIssueCode(result, 'invalid_number');
});

test('rejects Infinity observed_price_usd', () => {
  const advice = goodAdvice() as Record<string, unknown>;
  const po = advice.price_observation as Record<string, unknown>;
  const tampered = {
    ...advice,
    price_observation: { ...po, observed_price_usd: Infinity },
  };
  const result = validateLargoAdvice(tampered);
  assertHasIssueCode(result, 'invalid_number');
});

test('rejects NaN observed_price_usd', () => {
  const advice = goodAdvice() as Record<string, unknown>;
  const po = advice.price_observation as Record<string, unknown>;
  const tampered = {
    ...advice,
    price_observation: { ...po, observed_price_usd: Number.NaN },
  };
  const result = validateLargoAdvice(tampered);
  assertHasIssueCode(result, 'invalid_number');
});

test('rejects negative passengers_adults', () => {
  const advice = goodAdvice() as Record<string, unknown>;
  const pc = advice.product_context as Record<string, unknown>;
  const tampered = {
    ...advice,
    product_context: { ...pc, passengers_adults: -1 },
  };
  const result = validateLargoAdvice(tampered);
  assertHasIssueCode(result, 'invalid_number');
});

test('rejects fx_rate_to_usd === 0 (must be strictly positive)', () => {
  const advice = goodAdvice() as Record<string, unknown>;
  const po = advice.price_observation as Record<string, unknown>;
  const tampered = { ...advice, price_observation: { ...po, fx_rate_to_usd: 0 } };
  const result = validateLargoAdvice(tampered);
  assertHasIssueCode(result, 'invalid_number');
});

test('accepts fx_rate_to_usd === null (matches PriceObservation contract)', () => {
  // ABSTAIN scenario already has fx_rate_to_usd: null; should pass.
  const advice = produceStubLargoAdvice(buildAbstainProviderUnavailableInput());
  const result = validateLargoAdvice(advice);
  assert.strictEqual(result.ok, true);
});

test('rejects non-integer passengers_adults (float)', () => {
  const advice = goodAdvice() as Record<string, unknown>;
  const pc = advice.product_context as Record<string, unknown>;
  const tampered = {
    ...advice,
    product_context: { ...pc, passengers_adults: 1.5 },
  };
  const result = validateLargoAdvice(tampered);
  assertHasIssueCode(result, 'invalid_number');
});

// -----------------------------------------------------------------------------
// Group H — Arrays
// -----------------------------------------------------------------------------

test('rejects non-array reasons', () => {
  const result = validateLargoAdvice(withFieldOverride('reasons', 'not-an-array'));
  assertHasIssueCode(result, 'invalid_array');
});

test('rejects reason without code', () => {
  const advice = goodAdvice() as Record<string, unknown>;
  const tampered = {
    ...advice,
    reasons: [{ message: 'no code', severity: 'info' }],
  };
  const result = validateLargoAdvice(tampered);
  const issue = firstIssue(result, 'missing_field');
  assert.ok(issue);
  assert.strictEqual(issue!.path, 'reasons[0].code');
});

test('rejects reason with invalid severity', () => {
  const advice = goodAdvice() as Record<string, unknown>;
  const tampered = {
    ...advice,
    reasons: [{ code: 'x', message: 'm', severity: 'critical' }],
  };
  const result = validateLargoAdvice(tampered);
  const issue = firstIssue(result, 'invalid_enum');
  assert.ok(issue);
  assert.strictEqual(issue!.path, 'reasons[0].severity');
});

test('accepts empty reasons array (zero reasons is structurally valid)', () => {
  const advice = goodAdvice() as Record<string, unknown>;
  const tampered = { ...advice, reasons: [] };
  const result = validateLargoAdvice(tampered);
  assert.strictEqual(result.ok, true);
});

// -----------------------------------------------------------------------------
// Group I — Nullable fields accepted
// -----------------------------------------------------------------------------

test('accepts user_id === null', () => {
  const result = validateLargoAdvice(withFieldOverride('user_id', null));
  assert.strictEqual(result.ok, true);
});

test('accepts mission_id === null', () => {
  const result = validateLargoAdvice(withFieldOverride('mission_id', null));
  assert.strictEqual(result.ok, true);
});

test('accepts observed_price_usd === null in price_observation', () => {
  const advice = produceStubLargoAdvice(buildAbstainProviderUnavailableInput());
  const result = validateLargoAdvice(advice);
  assert.strictEqual(result.ok, true);
});

test('accepts primary_provider === null in provider_info', () => {
  const advice = produceStubLargoAdvice(buildAbstainProviderUnavailableInput());
  const result = validateLargoAdvice(advice);
  assert.strictEqual(result.ok, true);
});

test('accepts comparison_anchor === null', () => {
  const result = validateLargoAdvice(withFieldOverride('comparison_anchor', null));
  assert.strictEqual(result.ok, true);
});

test('accepts bundle_context === null', () => {
  const result = validateLargoAdvice(withFieldOverride('bundle_context', null));
  assert.strictEqual(result.ok, true);
});

test('accepts audit_block === null', () => {
  const result = validateLargoAdvice(withFieldOverride('audit_block', null));
  assert.strictEqual(result.ok, true);
});

test('accepts audit_block field absent (optional in master interface)', () => {
  const advice = goodAdvice() as Record<string, unknown>;
  const copy = { ...advice };
  delete copy.audit_block;
  const result = validateLargoAdvice(copy);
  assert.strictEqual(result.ok, true);
});

// -----------------------------------------------------------------------------
// Group J — Multiple issues collected in one pass
// -----------------------------------------------------------------------------

test('collects multiple issues in a single pass (no early bail)', () => {
  const advice = goodAdvice() as Record<string, unknown>;
  const broken = {
    ...advice,
    schema_version: '0.2.0', // invalid_contract_version
    action: 'YOLO_BUY', //         invalid_enum
    can_autobuy: true, //          invalid_autobuy_phase1
    product_type: 'hotel', //      invalid_phase1_product
  };
  const result = validateLargoAdvice(broken);
  assert.strictEqual(result.ok, false);
  if (result.ok) return;
  const codes = new Set(result.issues.map((i) => i.code));
  assert.ok(codes.has('invalid_contract_version'));
  assert.ok(codes.has('invalid_enum'));
  assert.ok(codes.has('invalid_autobuy_phase1'));
  assert.ok(codes.has('invalid_phase1_product'));
  assert.ok(result.issues.length >= 4);
});

// -----------------------------------------------------------------------------
// Group K — Purity / determinism
// -----------------------------------------------------------------------------

test('does not mutate the input on success', () => {
  const advice = goodAdvice();
  const snapshot = JSON.parse(JSON.stringify(advice));
  validateLargoAdvice(advice);
  assert.deepStrictEqual(advice, snapshot);
});

test('does not mutate the input on failure', () => {
  const broken = withFieldOverride('action', 'YOLO_BUY');
  const snapshot = JSON.parse(JSON.stringify(broken));
  validateLargoAdvice(broken);
  assert.deepStrictEqual(broken, snapshot);
});

test('is deterministic for same input (issues array deep-equal)', () => {
  const advice = goodAdvice();
  const a = validateLargoAdvice(advice);
  const b = validateLargoAdvice(advice);
  assert.deepStrictEqual(a, b);
});

test('is deterministic for failure too (same issues, same order)', () => {
  const broken = withFieldOverride('action', 'YOLO_BUY');
  const a = validateLargoAdvice(broken);
  const b = validateLargoAdvice(broken);
  assert.deepStrictEqual(a, b);
});

// -----------------------------------------------------------------------------
// Group L — Issue path & shape
// -----------------------------------------------------------------------------

test('issue path uses dot notation for product_context.origin', () => {
  const advice = goodAdvice() as Record<string, unknown>;
  const pc = advice.product_context as Record<string, unknown>;
  const tampered = { ...advice, product_context: { ...pc, origin: 42 } };
  const result = validateLargoAdvice(tampered);
  const issue = firstIssue(result, 'invalid_nullable');
  assert.ok(issue);
  assert.strictEqual(issue!.path, 'product_context.origin');
});

test('issue path uses bracket notation for reasons[0].code', () => {
  const advice = goodAdvice() as Record<string, unknown>;
  const tampered = {
    ...advice,
    reasons: [{ message: 'm', severity: 'info' }],
  };
  const result = validateLargoAdvice(tampered);
  const issue = firstIssue(result, 'missing_field');
  assert.ok(issue);
  assert.strictEqual(issue!.path, 'reasons[0].code');
});

test('issue path is empty string for top-level not_object', () => {
  const result = validateLargoAdvice(null);
  const issue = firstIssue(result, 'not_object');
  assert.ok(issue);
  assert.strictEqual(issue!.path, '');
});

test('issue includes expected and actual diagnostic strings', () => {
  const result = validateLargoAdvice(withFieldOverride('action', 'YOLO_BUY'));
  const issue = firstIssue(result, 'invalid_enum');
  assert.ok(issue);
  assert.ok(typeof issue!.expected === 'string' && issue!.expected.length > 0);
  assert.ok(typeof issue!.actual === 'string' && issue!.actual.length > 0);
});

// -----------------------------------------------------------------------------
// Group M — Out-of-scope conditions are STILL structurally valid
// -----------------------------------------------------------------------------

test('expired advice (valid_until in the past) is still structurally valid', () => {
  const advice = goodAdvice() as Record<string, unknown>;
  const pastIso = '2020-01-01T00:00:00.000Z';
  const tampered = { ...advice, valid_until: pastIso };
  const result = validateLargoAdvice(tampered);
  // Validator does NOT enforce expiry. Backend gate handles it.
  assert.strictEqual(result.ok, true);
});

test('provider_disagreement scenario validates (no policy enforcement here)', () => {
  const advice = produceStubLargoAdvice(buildProviderDisagreementInput());
  const result = validateLargoAdvice(advice);
  assert.strictEqual(result.ok, true);
});

test('ml_available === false scenario validates (structural-only)', () => {
  const advice = produceStubLargoAdvice(buildMlUnavailableInput());
  const result = validateLargoAdvice(advice);
  assert.strictEqual(result.ok, true);
});

test('ABSTAIN with action=ABSTAIN and null price/provider validates', () => {
  const advice = produceStubLargoAdvice(buildAbstainProviderUnavailableInput());
  const result = validateLargoAdvice(advice);
  assert.strictEqual(result.ok, true);
});

// -----------------------------------------------------------------------------
// Group N — Nested object rejections
// -----------------------------------------------------------------------------

test('rejects product_context as non-object', () => {
  const result = validateLargoAdvice(withFieldOverride('product_context', 'oops'));
  assertHasIssueCode(result, 'invalid_nested_object');
});

test('rejects price_observation as null (must be object, not null)', () => {
  const result = validateLargoAdvice(withFieldOverride('price_observation', null));
  // price_observation is non-nullable on the contract; null fails as "not an object".
  assertHasIssueCode(result, 'invalid_nested_object');
});

test('rejects provider_info as array', () => {
  const result = validateLargoAdvice(withFieldOverride('provider_info', []));
  assertHasIssueCode(result, 'invalid_nested_object');
});

test('rejects technical_details as string', () => {
  const result = validateLargoAdvice(withFieldOverride('technical_details', 'x'));
  assertHasIssueCode(result, 'invalid_nested_object');
});

test('accepts technical_details === null', () => {
  const result = validateLargoAdvice(withFieldOverride('technical_details', null));
  assert.strictEqual(result.ok, true);
});

test('accepts technical_details === {} (empty record)', () => {
  const result = validateLargoAdvice(withFieldOverride('technical_details', {}));
  assert.strictEqual(result.ok, true);
});

// -----------------------------------------------------------------------------
// Group O — Bundle context (rare path; not typically exercised by stub)
// -----------------------------------------------------------------------------

test('accepts a structurally valid bundle_context object', () => {
  const result = validateLargoAdvice(
    withFieldOverride('bundle_context', {
      bundle_id: 'BNDL-001',
      component_role: 'flight',
      total_components: 3,
    }),
  );
  assert.strictEqual(result.ok, true);
});

test('rejects bundle_context with invalid component_role', () => {
  const result = validateLargoAdvice(
    withFieldOverride('bundle_context', {
      bundle_id: 'BNDL-001',
      component_role: 'spaceship',
      total_components: 3,
    }),
  );
  assertHasIssueCode(result, 'invalid_enum');
});

test('rejects bundle_context with non-positive total_components', () => {
  const result = validateLargoAdvice(
    withFieldOverride('bundle_context', {
      bundle_id: 'BNDL-001',
      component_role: 'flight',
      total_components: 0,
    }),
  );
  assertHasIssueCode(result, 'invalid_number');
});

// -----------------------------------------------------------------------------
// Group P — Comparison anchor edge cases
// -----------------------------------------------------------------------------

test('rejects comparison_anchor with unknown anchor_type', () => {
  const result = validateLargoAdvice(
    withFieldOverride('comparison_anchor', {
      anchor_type: 'made_up_anchor',
      anchor_value_usd: 100,
      description: 'd',
    }),
  );
  assertHasIssueCode(result, 'invalid_enum');
});

test('accepts comparison_anchor with anchor_value_usd === null', () => {
  const result = validateLargoAdvice(
    withFieldOverride('comparison_anchor', {
      anchor_type: 'training_quantile',
      anchor_value_usd: null,
      description: 'd',
    }),
  );
  assert.strictEqual(result.ok, true);
});

// -----------------------------------------------------------------------------
// Self-running entry point (no test runner installed; see file header)
// -----------------------------------------------------------------------------

runAll();
