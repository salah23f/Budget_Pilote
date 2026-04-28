/**
 * Largo — `validateCustomerSafeAdvice` unit tests (Sprint 2.3, B1).
 *
 * Verifies the customer-safe runtime validator per:
 *  - `docs/b0/LARGO_ADVICE_CONTRACT.md` §3, §4, §6, §8–§17, §20.
 *  - `docs/b0/LARGO_BACKEND_API_SPEC.md` §10 (admin-only fields enumerated).
 *  - `docs/b0/LARGO_FRONTEND_UX_SPEC.md` §4, §41.
 *  - `docs/b1/B1_IMPLEMENTATION_PLAN.md` §4 anchors, §13 (Sprint 2 deliverable).
 *  - `docs/b1/CLAUDE_CODE_RULES.md` §11, §15, §17, §18.
 *
 * Test runner: same self-running harness as the other Largo test files.
 * Runs via:
 *
 *   npx tsx tests/largo/validator/customer-safe-validator.test.ts
 *
 * No new dependency; no `package.json` / `tsconfig.json` modified.
 */

import { strict as assert } from 'node:assert';
import {
  __internal,
  validateCustomerSafeAdvice,
  type CustomerSafeValidationIssue,
  type CustomerSafeValidationIssueCode,
  type CustomerSafeValidationResult,
} from '@/lib/largo/validator/customer-safe-validator';
import { stripToCustomerSafe } from '@/lib/largo/safe-view/strip';
import { validateLargoAdvice } from '@/lib/largo/validator/advice-validator';
import {
  produceStubLargoAdvice,
  type StubLargoAdviceInput,
} from '@/lib/largo/producer/stub';
import {
  extendedLargoAdviceFixtureByName,
  extendedLargoAdviceFixtures,
  fixtureExtendedAbstainProviderUnavailable,
  fixtureExtendedAbstainRouteUnknown,
  fixtureExtendedAlert,
  fixtureExtendedAnonymousQuotaExceededPlaceholder,
  fixtureExtendedBuyNowHigh,
  fixtureExtendedBuyNowModerate,
  fixtureExtendedExpiredAdvice,
  fixtureExtendedManualCheck,
  fixtureExtendedMlUnavailable,
  fixtureExtendedMonitor,
  fixtureExtendedOneWayFlight,
  fixtureExtendedProviderDisagreement,
  fixtureExtendedWaitHighPrice,
} from '@/tests/largo/fixtures/largo-advice-extended.fixture';
import type { LargoAdvice } from '@/types/largo/advice';
import type { CustomerSafeAdvice } from '@/types/largo/customer-safe-advice';

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
// Local helpers (test-only; never exported)
// -----------------------------------------------------------------------------

/** Pipeline: validate-largo → assert ok → strip. */
function toCustomerSafe(advice: LargoAdvice): CustomerSafeAdvice {
  const validated = validateLargoAdvice(advice);
  if (!validated.ok) {
    const codes = validated.issues
      .map((i) => `${i.path || '<root>'}:${i.code}`)
      .join(', ');
    assert.fail(`expected LargoAdvice to validate, got: ${codes}`);
  }
  return stripToCustomerSafe(validated.value);
}

/** Full pipeline: produce-or-fixture → validate-largo → strip → validate-customer-safe. */
function validateCustomerSafeFromAdvice(
  advice: LargoAdvice,
): CustomerSafeValidationResult {
  return validateCustomerSafeAdvice(toCustomerSafe(advice));
}

/** Deep-clone a CustomerSafeAdvice via JSON for negative tests. */
function cloneCustomerSafeForCorruption(
  value: CustomerSafeAdvice,
): CustomerSafeAdvice {
  return JSON.parse(JSON.stringify(value)) as CustomerSafeAdvice;
}

/**
 * Inject a forbidden field at a nested path of a customer-safe payload.
 * Path is dot-notated (e.g. `provider_info`, `comparison_anchor`).
 * Returns a corrupted copy; original is never mutated.
 */
function withForbiddenField(
  base: CustomerSafeAdvice,
  containerPath: string,
  forbiddenKey: string,
  injectedValue: unknown,
): unknown {
  const cloned = cloneCustomerSafeForCorruption(base);
  if (containerPath === '') {
    (cloned as unknown as Record<string, unknown>)[forbiddenKey] = injectedValue;
    return cloned;
  }
  const segments = containerPath.split('.');
  let cursor: unknown = cloned;
  for (const seg of segments) {
    if (!cursor || typeof cursor !== 'object') {
      assert.fail(`withForbiddenField path ${containerPath} not navigable`);
    }
    cursor = (cursor as Record<string, unknown>)[seg];
  }
  if (!cursor || typeof cursor !== 'object') {
    assert.fail(`withForbiddenField path ${containerPath} did not resolve to an object`);
  }
  (cursor as Record<string, unknown>)[forbiddenKey] = injectedValue;
  return cloned;
}

/** Assert the validator failed with at least one issue of the given code. */
function assertIssueCode(
  result: CustomerSafeValidationResult,
  code: CustomerSafeValidationIssueCode,
  message?: string,
): void {
  assert.strictEqual(result.ok, false, message ?? 'expected validation to fail');
  if (result.ok) return;
  assert.ok(
    result.issues.some((i) => i.code === code),
    `expected an issue with code "${code}"; got: ${result.issues
      .map((i) => i.code)
      .join(', ')}`,
  );
}

/** Assert the validator failed with at least one issue at the given path. */
function assertIssuePath(
  result: CustomerSafeValidationResult,
  path: string,
): void {
  assert.strictEqual(result.ok, false);
  if (result.ok) return;
  assert.ok(
    result.issues.some((i) => i.path === path),
    `expected an issue at path "${path}"; got paths: ${result.issues
      .map((i) => i.path)
      .join(', ')}`,
  );
}

// -----------------------------------------------------------------------------
// Producer scenario builders (private, deterministic)
// -----------------------------------------------------------------------------

const NOW_ISO = '2026-04-28T10:00:00.000Z';

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
    user_id: 'usr_csv',
    mission_id: 'msn_csv',
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

const producerScenarios: Array<{
  name: string;
  build: () => StubLargoAdviceInput;
}> = [
  { name: 'buy_now_good_price', build: buyNowGoodPriceInput },
  { name: 'wait_high_price', build: waitHighPriceInput },
  { name: 'route_unknown', build: abstainRouteUnknownInput },
  { name: 'provider_unavailable', build: abstainProviderUnavailableInput },
  { name: 'provider_disagreement', build: providerDisagreementInput },
  { name: 'ml_unavailable', build: mlUnavailableInput },
];

// =============================================================================
// Group A — Happy path from extended fixtures
// =============================================================================

test('A: every extended fixture strips then validates as CustomerSafeAdvice', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const result = validateCustomerSafeFromAdvice(fixture);
    if (!result.ok) {
      const codes = result.issues
        .map((i) => `${i.path || '<root>'}:${i.code}`)
        .join('\n  ');
      assert.fail(
        `fixture ${fixture.advice_id} failed customer-safe validation:\n  ${codes}`,
      );
    }
  }
});

test('A: validator returns same-reference value on success', () => {
  const cs = toCustomerSafe(fixtureExtendedBuyNowHigh);
  const result = validateCustomerSafeAdvice(cs);
  assert.strictEqual(result.ok, true);
  if (result.ok) {
    assert.strictEqual(result.value, cs);
  }
});

test('A: success issues array is empty', () => {
  const cs = toCustomerSafe(fixtureExtendedBuyNowHigh);
  const result = validateCustomerSafeAdvice(cs);
  assert.strictEqual(result.ok, true);
  if (result.ok) {
    assert.deepStrictEqual(result.issues, []);
  }
});

test('A: repeated validation is deterministic (same result deeply equal)', () => {
  const cs = toCustomerSafe(fixtureExtendedBuyNowHigh);
  const a = validateCustomerSafeAdvice(cs);
  const b = validateCustomerSafeAdvice(cs);
  assert.deepStrictEqual(a, b);
});

test('A: validator does not mutate customer-safe input', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const cs = toCustomerSafe(fixture);
    const snapshot = JSON.parse(JSON.stringify(cs));
    validateCustomerSafeAdvice(cs);
    assert.deepStrictEqual(cs, snapshot);
  }
});

// =============================================================================
// Group B — Happy path from producer
// =============================================================================

test('B: every producer scenario validates → strips → validates as CustomerSafe', () => {
  for (const scenario of producerScenarios) {
    const advice = produceStubLargoAdvice(scenario.build());
    const result = validateCustomerSafeFromAdvice(advice);
    if (!result.ok) {
      const codes = result.issues
        .map((i) => `${i.path || '<root>'}:${i.code}`)
        .join('\n  ');
      assert.fail(
        `producer scenario "${scenario.name}" failed:\n  ${codes}`,
      );
    }
  }
});

for (const scenario of producerScenarios) {
  test(`B: producer scenario "${scenario.name}" passes customer-safe validation`, () => {
    const advice = produceStubLargoAdvice(scenario.build());
    const result = validateCustomerSafeFromAdvice(advice);
    assert.strictEqual(result.ok, true);
  });
}

// =============================================================================
// Group C — Required fields and basic shape rejection
// =============================================================================

test('C: rejects null with not_object', () => {
  const result = validateCustomerSafeAdvice(null);
  assertIssueCode(result, 'not_object');
});

test('C: rejects undefined with not_object', () => {
  const result = validateCustomerSafeAdvice(undefined);
  assertIssueCode(result, 'not_object');
});

test('C: rejects array with not_object', () => {
  const result = validateCustomerSafeAdvice([1, 2, 3]);
  assertIssueCode(result, 'not_object');
});

test('C: rejects primitive (number) with not_object', () => {
  const result = validateCustomerSafeAdvice(42);
  assertIssueCode(result, 'not_object');
});

test('C: rejects primitive (string) with not_object', () => {
  const result = validateCustomerSafeAdvice('not customer-safe');
  assertIssueCode(result, 'not_object');
});

function withoutField(base: CustomerSafeAdvice, field: string): unknown {
  const cs = cloneCustomerSafeForCorruption(base);
  delete (cs as unknown as Record<string, unknown>)[field];
  return cs;
}

const baseGood = (): CustomerSafeAdvice => toCustomerSafe(fixtureExtendedBuyNowHigh);

test('C: rejects missing schema_version', () => {
  const result = validateCustomerSafeAdvice(withoutField(baseGood(), 'schema_version'));
  assertIssueCode(result, 'missing_field');
  assertIssuePath(result, 'schema_version');
});

test('C: rejects missing advice_id', () => {
  const result = validateCustomerSafeAdvice(withoutField(baseGood(), 'advice_id'));
  assertIssueCode(result, 'missing_field');
});

test('C: rejects missing action', () => {
  const result = validateCustomerSafeAdvice(withoutField(baseGood(), 'action'));
  assertIssueCode(result, 'missing_field');
});

test('C: rejects missing confidence_label', () => {
  const result = validateCustomerSafeAdvice(
    withoutField(baseGood(), 'confidence_label'),
  );
  assertIssueCode(result, 'missing_field');
});

test('C: rejects missing product_context', () => {
  const result = validateCustomerSafeAdvice(
    withoutField(baseGood(), 'product_context'),
  );
  assertIssueCode(result, 'missing_field');
});

test('C: rejects missing price_observation', () => {
  const result = validateCustomerSafeAdvice(
    withoutField(baseGood(), 'price_observation'),
  );
  assertIssueCode(result, 'missing_field');
});

test('C: rejects missing provider_info', () => {
  const result = validateCustomerSafeAdvice(
    withoutField(baseGood(), 'provider_info'),
  );
  assertIssueCode(result, 'missing_field');
});

test('C: rejects missing reasons', () => {
  const result = validateCustomerSafeAdvice(withoutField(baseGood(), 'reasons'));
  assertIssueCode(result, 'missing_field');
});

test('C: rejects missing short_message', () => {
  const result = validateCustomerSafeAdvice(
    withoutField(baseGood(), 'short_message'),
  );
  assertIssueCode(result, 'missing_field');
});

test('C: rejects missing can_autobuy', () => {
  const result = validateCustomerSafeAdvice(
    withoutField(baseGood(), 'can_autobuy'),
  );
  assertIssueCode(result, 'missing_field');
});

test('C: rejects missing ml_available', () => {
  const result = validateCustomerSafeAdvice(
    withoutField(baseGood(), 'ml_available'),
  );
  assertIssueCode(result, 'missing_field');
});

// =============================================================================
// Group D — Enums / literals / Phase 1 anchors
// =============================================================================

function withFieldOverride(
  base: CustomerSafeAdvice,
  field: string,
  value: unknown,
): unknown {
  const cs = cloneCustomerSafeForCorruption(base);
  (cs as unknown as Record<string, unknown>)[field] = value;
  return cs;
}

test('D: rejects schema_version other than "0.1.0"', () => {
  const result = validateCustomerSafeAdvice(
    withFieldOverride(baseGood(), 'schema_version', '0.2.0'),
  );
  assertIssueCode(result, 'invalid_contract_version');
});

test('D: rejects unknown action enum', () => {
  const result = validateCustomerSafeAdvice(
    withFieldOverride(baseGood(), 'action', 'YOLO_BUY'),
  );
  assertIssueCode(result, 'invalid_enum');
});

test('D: rejects unknown confidence_label enum', () => {
  const result = validateCustomerSafeAdvice(
    withFieldOverride(baseGood(), 'confidence_label', 'super_high'),
  );
  assertIssueCode(result, 'invalid_enum');
});

test('D: rejects product_type !== "flight" (Phase 1)', () => {
  const result = validateCustomerSafeAdvice(
    withFieldOverride(baseGood(), 'product_type', 'hotel'),
  );
  assertIssueCode(result, 'invalid_phase1_product');
});

test('D: rejects product_specific.product_type !== "flight"', () => {
  const cs = baseGood();
  const ps = (cs as unknown as Record<string, unknown>).product_specific as Record<
    string,
    unknown
  >;
  const tampered = withFieldOverride(cs, 'product_specific', {
    ...ps,
    product_type: 'hotel',
  });
  const result = validateCustomerSafeAdvice(tampered);
  assertIssueCode(result, 'invalid_literal');
});

test('D: rejects can_autobuy === true (Phase 1)', () => {
  const result = validateCustomerSafeAdvice(
    withFieldOverride(baseGood(), 'can_autobuy', true),
  );
  assertIssueCode(result, 'invalid_autobuy_phase1');
});

test('D: accepts all five actions across the fixture catalog', () => {
  const actionsSeen = new Set<string>();
  for (const fixture of extendedLargoAdviceFixtures) {
    const result = validateCustomerSafeFromAdvice(fixture);
    assert.strictEqual(result.ok, true);
    actionsSeen.add(fixture.action);
  }
  assert.ok(actionsSeen.has('BUY_NOW'));
  assert.ok(actionsSeen.has('WAIT'));
  assert.ok(actionsSeen.has('MONITOR'));
  assert.ok(actionsSeen.has('ALERT'));
  assert.ok(actionsSeen.has('ABSTAIN'));
});

test('D: accepts all four confidence labels across the fixture catalog', () => {
  const labels = new Set<string>();
  for (const fixture of extendedLargoAdviceFixtures) {
    const result = validateCustomerSafeFromAdvice(fixture);
    assert.strictEqual(result.ok, true);
    labels.add(fixture.confidence_label);
  }
  assert.ok(labels.has('high'));
  assert.ok(labels.has('moderate'));
  assert.ok(labels.has('limited'));
  assert.ok(labels.has('unavailable'));
});

test('D: rejects invalid disagreement_summary value', () => {
  const cs = baseGood();
  const pi = (cs as unknown as Record<string, unknown>).provider_info as Record<
    string,
    unknown
  >;
  const tampered = withFieldOverride(cs, 'provider_info', {
    ...pi,
    disagreement_summary: 'maybe',
  });
  const result = validateCustomerSafeAdvice(tampered);
  assertIssueCode(result, 'invalid_enum');
});

// =============================================================================
// Group E — Null preservation (accepts valid nulls)
// =============================================================================

test('E: accepts observed_price_usd === null (ABSTAIN provider unavailable)', () => {
  const result = validateCustomerSafeFromAdvice(
    fixtureExtendedAbstainProviderUnavailable,
  );
  assert.strictEqual(result.ok, true);
  if (result.ok) {
    assert.strictEqual(
      result.value.price_observation.observed_price_usd,
      null,
    );
  }
});

test('E: accepts primary_provider === null', () => {
  const result = validateCustomerSafeFromAdvice(
    fixtureExtendedAbstainProviderUnavailable,
  );
  assert.strictEqual(result.ok, true);
  if (result.ok) {
    assert.strictEqual(result.value.provider_info.primary_provider, null);
  }
});

test('E: does not coerce null observed_price_usd to 0', () => {
  const result = validateCustomerSafeFromAdvice(
    fixtureExtendedAbstainProviderUnavailable,
  );
  assert.strictEqual(result.ok, true);
  if (result.ok) {
    assert.notStrictEqual(
      result.value.price_observation.observed_price_usd,
      0,
    );
    assert.strictEqual(
      result.value.price_observation.observed_price_usd,
      null,
    );
  }
});

test('E: does not invent a provider when primary_provider is null', () => {
  const result = validateCustomerSafeFromAdvice(
    fixtureExtendedAbstainProviderUnavailable,
  );
  assert.strictEqual(result.ok, true);
  if (result.ok) {
    assert.strictEqual(result.value.provider_info.primary_provider, null);
    assert.notStrictEqual(result.value.provider_info.primary_provider, '');
    assert.notStrictEqual(result.value.provider_info.primary_provider, 'unknown');
  }
});

test('E: accepts comparison_anchor === null', () => {
  const result = validateCustomerSafeAdvice(
    withFieldOverride(baseGood(), 'comparison_anchor', null),
  );
  assert.strictEqual(result.ok, true);
});

test('E: accepts bundle_context === null', () => {
  const result = validateCustomerSafeAdvice(
    withFieldOverride(baseGood(), 'bundle_context', null),
  );
  assert.strictEqual(result.ok, true);
});

// =============================================================================
// Group F — Forbidden customer-key rejection
// =============================================================================

test('F: rejects top-level numeric_value (admin-only)', () => {
  const result = validateCustomerSafeAdvice(
    withForbiddenField(baseGood(), '', 'numeric_value', 0.78),
  );
  assertIssueCode(result, 'forbidden_customer_field');
  assertIssuePath(result, 'numeric_value');
});

test('F: rejects top-level technical_details (admin-only)', () => {
  const result = validateCustomerSafeAdvice(
    withForbiddenField(baseGood(), '', 'technical_details', { model_version: 'x' }),
  );
  assertIssueCode(result, 'forbidden_customer_field');
  // Both the parent and the nested model_version should be flagged.
  assertIssuePath(result, 'technical_details');
  assertIssuePath(result, 'technical_details.model_version');
});

test('F: rejects top-level audit_block (admin-only)', () => {
  const result = validateCustomerSafeAdvice(
    withForbiddenField(baseGood(), '', 'audit_block', {
      audit_id: 'A',
      parent_advice_id: null,
    }),
  );
  assertIssueCode(result, 'forbidden_customer_field');
  assertIssuePath(result, 'audit_block');
  assertIssuePath(result, 'audit_block.audit_id');
  assertIssuePath(result, 'audit_block.parent_advice_id');
});

test('F: rejects top-level audit_id', () => {
  const result = validateCustomerSafeAdvice(
    withForbiddenField(baseGood(), '', 'audit_id', 'AUD-1'),
  );
  assertIssueCode(result, 'forbidden_customer_field');
  assertIssuePath(result, 'audit_id');
});

test('F: rejects top-level parent_advice_id', () => {
  const result = validateCustomerSafeAdvice(
    withForbiddenField(baseGood(), '', 'parent_advice_id', null),
  );
  assertIssueCode(result, 'forbidden_customer_field');
  assertIssuePath(result, 'parent_advice_id');
});

test('F: rejects provider_info.cross_check_disagreement_pct', () => {
  const result = validateCustomerSafeAdvice(
    withForbiddenField(
      baseGood(),
      'provider_info',
      'cross_check_disagreement_pct',
      0.142,
    ),
  );
  assertIssueCode(result, 'forbidden_customer_field');
  assertIssuePath(result, 'provider_info.cross_check_disagreement_pct');
});

test('F: rejects provider_info.cross_check_provider', () => {
  const result = validateCustomerSafeAdvice(
    withForbiddenField(baseGood(), 'provider_info', 'cross_check_provider', 'x'),
  );
  assertIssuePath(result, 'provider_info.cross_check_provider');
});

test('F: rejects provider_info.cross_check_offer_id', () => {
  const result = validateCustomerSafeAdvice(
    withForbiddenField(baseGood(), 'provider_info', 'cross_check_offer_id', 'x'),
  );
  assertIssuePath(result, 'provider_info.cross_check_offer_id');
});

test('F: rejects provider_info.primary_provider_offer_id', () => {
  const result = validateCustomerSafeAdvice(
    withForbiddenField(
      baseGood(),
      'provider_info',
      'primary_provider_offer_id',
      'sk-x',
    ),
  );
  assertIssuePath(result, 'provider_info.primary_provider_offer_id');
});

test('F: rejects nested model_version inside an injected admin block', () => {
  // Inject a `debug` field (forbidden namespace) containing model_version.
  const result = validateCustomerSafeAdvice(
    withForbiddenField(baseGood(), '', 'debug', { model_version: 'X' }),
  );
  assertIssuePath(result, 'debug');
  assertIssuePath(result, 'debug.model_version');
});

test('F: rejects nested q10/q50/q90 keys', () => {
  const result = validateCustomerSafeAdvice(
    withForbiddenField(baseGood(), '', 'internal', {
      q10: 1,
      q50: 2,
      q90: 3,
    }),
  );
  assertIssuePath(result, 'internal');
  assertIssuePath(result, 'internal.q10');
  assertIssuePath(result, 'internal.q50');
  assertIssuePath(result, 'internal.q90');
});

test('F: rejects nested debug/admin/internal keys at the top level', () => {
  for (const key of ['debug', 'admin', 'internal']) {
    const result = validateCustomerSafeAdvice(
      withForbiddenField(baseGood(), '', key, { foo: 'bar' }),
    );
    assertIssueCode(result, 'forbidden_customer_field');
    assertIssuePath(result, key);
  }
});

test('F: forbidden field issue includes path/code/message and helpful expected/actual', () => {
  const result = validateCustomerSafeAdvice(
    withForbiddenField(baseGood(), '', 'numeric_value', 0.78),
  );
  assert.strictEqual(result.ok, false);
  if (result.ok) return;
  const issue = result.issues.find(
    (i) => i.code === 'forbidden_customer_field' && i.path === 'numeric_value',
  );
  assert.ok(issue);
  assert.ok(issue!.message.length > 0);
  assert.strictEqual(issue!.expected, '<absent>');
  assert.ok(issue!.actual && issue!.actual.length > 0);
});

// =============================================================================
// Group G — Numeric / date validation
// =============================================================================

function withPriceObservationOverride(
  base: CustomerSafeAdvice,
  override: Record<string, unknown>,
): unknown {
  const cs = cloneCustomerSafeForCorruption(base);
  const po = (cs as unknown as Record<string, unknown>).price_observation as Record<
    string,
    unknown
  >;
  (cs as unknown as Record<string, unknown>).price_observation = {
    ...po,
    ...override,
  };
  return cs;
}

test('G: rejects negative observed_price_usd', () => {
  const result = validateCustomerSafeAdvice(
    withPriceObservationOverride(baseGood(), { observed_price_usd: -10 }),
  );
  assertIssueCode(result, 'invalid_number');
});

test('G: rejects Infinity observed_price_usd', () => {
  const result = validateCustomerSafeAdvice(
    withPriceObservationOverride(baseGood(), {
      observed_price_usd: Infinity,
    }),
  );
  assertIssueCode(result, 'invalid_number');
});

test('G: rejects NaN observed_price_usd', () => {
  const result = validateCustomerSafeAdvice(
    withPriceObservationOverride(baseGood(), {
      observed_price_usd: Number.NaN,
    }),
  );
  assertIssueCode(result, 'invalid_number');
});

test('G: rejects fx_rate_to_usd === 0 (must be strictly positive)', () => {
  const result = validateCustomerSafeAdvice(
    withPriceObservationOverride(baseGood(), { fx_rate_to_usd: 0 }),
  );
  assertIssueCode(result, 'invalid_number');
});

test('G: rejects non-ISO generated_at', () => {
  const result = validateCustomerSafeAdvice(
    withFieldOverride(baseGood(), 'generated_at', '2026/04/28 10:00'),
  );
  assertIssueCode(result, 'invalid_iso_datetime');
});

test('G: rejects valid_until without Z suffix', () => {
  const result = validateCustomerSafeAdvice(
    withFieldOverride(baseGood(), 'valid_until', '2026-04-28T10:00:00'),
  );
  assertIssueCode(result, 'invalid_iso_datetime');
});

test('G: rejects invalid product_context.outbound_date', () => {
  const cs = baseGood();
  const pc = (cs as unknown as Record<string, unknown>).product_context as Record<
    string,
    unknown
  >;
  const tampered = withFieldOverride(cs, 'product_context', {
    ...pc,
    outbound_date: 'next Tuesday',
  });
  const result = validateCustomerSafeAdvice(tampered);
  assertIssueCode(result, 'invalid_date');
});

test('G: rejects negative passengers_adults', () => {
  const cs = baseGood();
  const pc = (cs as unknown as Record<string, unknown>).product_context as Record<
    string,
    unknown
  >;
  const tampered = withFieldOverride(cs, 'product_context', {
    ...pc,
    passengers_adults: -1,
  });
  const result = validateCustomerSafeAdvice(tampered);
  assertIssueCode(result, 'invalid_number');
});

test('G: rejects non-integer passengers_adults (1.5)', () => {
  const cs = baseGood();
  const pc = (cs as unknown as Record<string, unknown>).product_context as Record<
    string,
    unknown
  >;
  const tampered = withFieldOverride(cs, 'product_context', {
    ...pc,
    passengers_adults: 1.5,
  });
  const result = validateCustomerSafeAdvice(tampered);
  assertIssueCode(result, 'invalid_number');
});

// =============================================================================
// Group H — Reasons and nested structures
// =============================================================================

test('H: rejects reasons as non-array', () => {
  const result = validateCustomerSafeAdvice(
    withFieldOverride(baseGood(), 'reasons', 'oops'),
  );
  assertIssueCode(result, 'invalid_array');
});

test('H: rejects reason missing code', () => {
  const result = validateCustomerSafeAdvice(
    withFieldOverride(baseGood(), 'reasons', [
      { message: 'no code', severity: 'info' },
    ]),
  );
  assertIssueCode(result, 'missing_field');
  assertIssuePath(result, 'reasons[0].code');
});

test('H: rejects reason missing message', () => {
  const result = validateCustomerSafeAdvice(
    withFieldOverride(baseGood(), 'reasons', [
      { code: 'x', severity: 'info' },
    ]),
  );
  assertIssueCode(result, 'missing_field');
  assertIssuePath(result, 'reasons[0].message');
});

test('H: rejects reason invalid severity', () => {
  const result = validateCustomerSafeAdvice(
    withFieldOverride(baseGood(), 'reasons', [
      { code: 'x', message: 'm', severity: 'critical' },
    ]),
  );
  assertIssueCode(result, 'invalid_enum');
  assertIssuePath(result, 'reasons[0].severity');
});

test('H: accepts empty reasons array (zero reasons is structurally valid)', () => {
  const result = validateCustomerSafeAdvice(
    withFieldOverride(baseGood(), 'reasons', []),
  );
  assert.strictEqual(result.ok, true);
});

test('H: rejects provider_info as array', () => {
  const result = validateCustomerSafeAdvice(
    withFieldOverride(baseGood(), 'provider_info', []),
  );
  assertIssueCode(result, 'invalid_nested_object');
});

test('H: rejects price_observation === null (must be an object)', () => {
  const result = validateCustomerSafeAdvice(
    withFieldOverride(baseGood(), 'price_observation', null),
  );
  assertIssueCode(result, 'invalid_nested_object');
});

test('H: rejects product_context as string', () => {
  const result = validateCustomerSafeAdvice(
    withFieldOverride(baseGood(), 'product_context', 'oops'),
  );
  assertIssueCode(result, 'invalid_nested_object');
});

test('H: rejects product_specific === null (must be an object)', () => {
  const result = validateCustomerSafeAdvice(
    withFieldOverride(baseGood(), 'product_specific', null),
  );
  assertIssueCode(result, 'invalid_nested_object');
});

// =============================================================================
// Group I — Multi-issue / determinism / no-mutation / serializability
// =============================================================================

test('I: collects multiple issues in a single pass (no early bail)', () => {
  const cs = baseGood();
  const broken = {
    ...(cs as unknown as Record<string, unknown>),
    schema_version: '0.2.0', // invalid_contract_version
    action: 'YOLO_BUY', //         invalid_enum
    can_autobuy: true, //          invalid_autobuy_phase1
    product_type: 'hotel', //      invalid_phase1_product
    numeric_value: 0.78, //        forbidden_customer_field (top-level)
  };
  const result = validateCustomerSafeAdvice(broken);
  assert.strictEqual(result.ok, false);
  if (result.ok) return;
  const codes = new Set(result.issues.map((i) => i.code));
  assert.ok(codes.has('invalid_contract_version'));
  assert.ok(codes.has('invalid_enum'));
  assert.ok(codes.has('invalid_autobuy_phase1'));
  assert.ok(codes.has('invalid_phase1_product'));
  assert.ok(codes.has('forbidden_customer_field'));
  assert.ok(result.issues.length >= 5);
});

test('I: never throws on adversarial inputs', () => {
  const adversarial: unknown[] = [
    null,
    undefined,
    0,
    Number.NaN,
    Infinity,
    -Infinity,
    '',
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
    assert.doesNotThrow(() => validateCustomerSafeAdvice(value));
    const result = validateCustomerSafeAdvice(value);
    assert.ok(typeof result === 'object' && result !== null);
    assert.ok(result.ok === true || result.ok === false);
  }
});

test('I: deterministic issue order for same invalid input', () => {
  const cs = baseGood();
  const broken = withFieldOverride(cs, 'action', 'YOLO_BUY');
  const a = validateCustomerSafeAdvice(broken);
  const b = validateCustomerSafeAdvice(broken);
  assert.deepStrictEqual(a, b);
});

test('I: does not mutate invalid input', () => {
  const broken = withFieldOverride(baseGood(), 'action', 'YOLO_BUY');
  const snapshot = JSON.parse(JSON.stringify(broken));
  validateCustomerSafeAdvice(broken);
  assert.deepStrictEqual(broken, snapshot);
});

test('I: does not mutate valid input', () => {
  const cs = toCustomerSafe(fixtureExtendedAlert);
  const snapshot = JSON.parse(JSON.stringify(cs));
  validateCustomerSafeAdvice(cs);
  assert.deepStrictEqual(cs, snapshot);
});

test('I: validation result is JSON-serializable (success branch)', () => {
  const result = validateCustomerSafeFromAdvice(fixtureExtendedBuyNowHigh);
  const json = JSON.stringify(result);
  const parsed = JSON.parse(json) as { ok: boolean };
  assert.strictEqual(parsed.ok, true);
});

test('I: validation result is JSON-serializable (failure branch)', () => {
  const result = validateCustomerSafeAdvice(null);
  const json = JSON.stringify(result);
  const parsed = JSON.parse(json) as {
    ok: boolean;
    issues: CustomerSafeValidationIssue[];
  };
  assert.strictEqual(parsed.ok, false);
  assert.ok(parsed.issues.length >= 1);
});

test('I: issue includes path, code, and message; expected/actual present where useful', () => {
  const result = validateCustomerSafeAdvice(
    withFieldOverride(baseGood(), 'action', 'YOLO_BUY'),
  );
  assert.strictEqual(result.ok, false);
  if (result.ok) return;
  const issue = result.issues.find((i) => i.code === 'invalid_enum');
  assert.ok(issue);
  assert.ok(typeof issue!.path === 'string');
  assert.ok(typeof issue!.code === 'string');
  assert.ok(typeof issue!.message === 'string' && issue!.message.length > 0);
  assert.ok(typeof issue!.expected === 'string');
  assert.ok(typeof issue!.actual === 'string');
});

// =============================================================================
// Group J — Internal helper sanity (small)
// =============================================================================

test('J: __internal.FORBIDDEN_CUSTOMER_KEYS contains all expected admin keys', () => {
  const expected = [
    'numeric_value',
    'technical_details',
    'audit_block',
    'audit_id',
    'parent_advice_id',
    'primary_provider_offer_id',
    'cross_check_provider',
    'cross_check_offer_id',
    'cross_check_disagreement_pct',
    'model_version',
    'q10',
    'q50',
    'q90',
    'fallback_reason',
    'debug',
    'admin',
    'internal',
  ];
  for (const key of expected) {
    assert.ok(
      __internal.FORBIDDEN_CUSTOMER_KEYS.has(key),
      `expected forbidden key "${key}" in FORBIDDEN_CUSTOMER_KEYS`,
    );
  }
});

test('J: __internal.walkForbiddenKeys flags nested forbidden key in arrays', () => {
  const issues: CustomerSafeValidationIssue[] = [];
  __internal.walkForbiddenKeys(
    [{ harmless: 1 }, { numeric_value: 0.5 }, { ok: true }],
    'reasons',
    issues,
  );
  assert.strictEqual(issues.length, 1);
  assert.strictEqual(issues[0].code, 'forbidden_customer_field');
  assert.strictEqual(issues[0].path, 'reasons[1].numeric_value');
});

test('J: __internal.walkForbiddenKeys does not throw on null/primitive inputs', () => {
  const issues: CustomerSafeValidationIssue[] = [];
  assert.doesNotThrow(() => {
    __internal.walkForbiddenKeys(null, '', issues);
    __internal.walkForbiddenKeys(undefined, '', issues);
    __internal.walkForbiddenKeys(42, '', issues);
    __internal.walkForbiddenKeys('x', '', issues);
  });
  assert.strictEqual(issues.length, 0);
});

// -----------------------------------------------------------------------------
// Self-running entry point
// -----------------------------------------------------------------------------

runAll();
