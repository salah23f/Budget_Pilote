/**
 * Largo — full customer-safe pipeline integration tests (Sprint 2.4, B1).
 *
 * Closes the FULL pure pipeline end-to-end:
 *
 *   Fixture (LargoAdvice) ─┐
 *                          ├─→ validateLargoAdvice (Sprint 1.3)
 *                          │   → stripToCustomerSafe (Sprint 1.1)
 *                          │   → validateCustomerSafeAdvice (Sprint 2.3)
 *                          │   → CustomerSafeAdvice (validated, stripped, gated)
 *
 *   StubLargoAdviceInput ──→ produceStubLargoAdvice (Sprint 1.2)
 *                          → (same chain as above)
 *
 * Two distinct integration concerns:
 *
 *  (1) Every entry point (13 fixtures + 6 producer scenarios) survives the
 *      complete pipeline. The customer-safe boundary at the end accepts
 *      every legitimate input.
 *  (2) Any admin-only field that survives strip would be CAUGHT by the
 *      customer-safe validator (the final gate). Negative tests inject
 *      forbidden fields after strip and confirm the gate fires.
 *
 * Discipline:
 *  - PURE / DETERMINISTIC. No I/O, no async, no fetch, no DB, no env,
 *    no `Date.now()`, no `Math.random()`.
 *  - NO NEW DEPENDENCY. `node:assert/strict` + tiny local harness.
 *  - SCOPE-LIMITED. Test-only branch; no producer/validator/strip/fixture
 *    files modified. Helpers live in this file only.
 *
 * Out of scope:
 *  - No reverse pipeline (`CustomerSafeAdvice → LargoAdvice`); the strip is
 *    a one-way projection.
 *  - No expiration / action policy / cross-field coupling — deferred to
 *    backend gates (Sprint 3+).
 *
 * Sources of truth:
 *  - `docs/b0/LARGO_ADVICE_CONTRACT.md` §3, §4, §6, §8–§17, §20.
 *  - `docs/b0/LARGO_BACKEND_API_SPEC.md` §10 (admin-only fields enumerated).
 *  - `docs/b0/LARGO_FRONTEND_UX_SPEC.md` §4, §41.
 *  - `docs/b1/B1_IMPLEMENTATION_PLAN.md` §4 anchors, §13 (Sprint 2 deliverables).
 *  - `docs/b1/CLAUDE_CODE_RULES.md` §11, §15, §17, §18.
 *
 * Run via:
 *
 *   npx tsx tests/largo/roundtrip/customer-safe-roundtrip.test.ts
 */

import { strict as assert } from 'node:assert';
import type { LargoAdvice } from '@/types/largo/advice';
import type { CustomerSafeAdvice } from '@/types/largo/customer-safe-advice';
import { produceStubLargoAdvice } from '@/lib/largo/producer/stub';
import { validateLargoAdvice } from '@/lib/largo/validator/advice-validator';
import { stripToCustomerSafe } from '@/lib/largo/safe-view/strip';
import { validateCustomerSafeAdvice } from '@/lib/largo/validator/customer-safe-validator';
import {
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

/**
 * `StubLargoAdviceInput` derived in-file via type extraction to honor the
 * strict import allow-list (no extra symbols imported from the producer).
 */
type StubLargoAdviceInput = Parameters<typeof produceStubLargoAdvice>[0];

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

/**
 * Happy-path full pipeline: validate-largo → strip → validate-customer-safe.
 * Asserts every stage succeeds; throws via `assert.fail` on any rejection.
 * Returns the final validated `CustomerSafeAdvice`.
 */
function fullRoundtripFromAdvice(advice: LargoAdvice): CustomerSafeAdvice {
  const validatedLargo = validateLargoAdvice(advice);
  if (!validatedLargo.ok) {
    const codes = validatedLargo.issues
      .map((i) => `${i.path || '<root>'}:${i.code}`)
      .join(', ');
    assert.fail(`expected LargoAdvice to validate, got: ${codes}`);
  }
  const stripped = stripToCustomerSafe(validatedLargo.value);
  const validatedCs = validateCustomerSafeAdvice(stripped);
  if (!validatedCs.ok) {
    const codes = validatedCs.issues
      .map((i) => `${i.path || '<root>'}:${i.code}`)
      .join(', ');
    assert.fail(
      `expected stripped output to pass customer-safe validation, got: ${codes}`,
    );
  }
  return validatedCs.value;
}

/** Same as `fullRoundtripFromAdvice` but starting from a producer input. */
function fullRoundtripFromProducerInput(
  input: StubLargoAdviceInput,
): CustomerSafeAdvice {
  return fullRoundtripFromAdvice(produceStubLargoAdvice(input));
}

/**
 * Non-throwing pipeline. Reports the stage at which validation failed:
 *  - `validate_largo` for top-level shape / Phase 1 anchor / etc.
 *  - `validate_customer_safe` for forbidden customer-side fields, etc.
 * Never invokes a downstream stage when an upstream stage rejects.
 */
function tryFullRoundtripFromUnknown(input: unknown) {
  const validatedLargo = validateLargoAdvice(input);
  if (!validatedLargo.ok) {
    return {
      ok: false as const,
      stage: 'validate_largo' as const,
      issues: validatedLargo.issues,
    };
  }
  const stripped = stripToCustomerSafe(validatedLargo.value);
  const validatedCs = validateCustomerSafeAdvice(stripped);
  if (!validatedCs.ok) {
    return {
      ok: false as const,
      stage: 'validate_customer_safe' as const,
      issues: validatedCs.issues,
    };
  }
  return { ok: true as const, value: validatedCs.value };
}

/**
 * Recursively walk and assert that none of the forbidden customer-side keys
 * appears anywhere in the value. Mirrors the `FORBIDDEN_CUSTOMER_KEYS` set
 * inside `lib/largo/validator/customer-safe-validator.ts` — kept in sync by
 * design so a regression in either place gets caught.
 */
const FORBIDDEN_KEYS_FOR_INTEGRATION: ReadonlySet<string> = new Set<string>([
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
  'debug',
  'admin',
  'internal',
]);

function assertNoForbiddenCustomerKeys(value: unknown): void {
  function walk(node: unknown, path: string): void {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i += 1) {
        walk(node[i], `${path}[${i}]`);
      }
      return;
    }
    const obj = node as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      const childPath = path === '' ? key : `${path}.${key}`;
      assert.ok(
        !FORBIDDEN_KEYS_FOR_INTEGRATION.has(key),
        `forbidden customer-side key "${key}" found at path "${childPath}"`,
      );
      walk(obj[key], childPath);
    }
  }
  walk(value, '');
}

/** Deep-clone via JSON. Plain LargoAdvice / CustomerSafeAdvice are JSON-safe. */
function cloneForCorruption<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Reach the post-strip stage on a fixture, asserting validation succeeded. */
function stripFromFixture(fixture: LargoAdvice): CustomerSafeAdvice {
  const validated = validateLargoAdvice(fixture);
  if (!validated.ok) assert.fail('fixture must validate');
  return stripToCustomerSafe(validated.value);
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
    user_id: 'usr_24',
    mission_id: 'msn_24',
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
  expectedAction: LargoAdvice['action'];
}> = [
  { name: 'buy_now_good_price', build: buyNowGoodPriceInput, expectedAction: 'BUY_NOW' },
  { name: 'wait_high_price', build: waitHighPriceInput, expectedAction: 'WAIT' },
  { name: 'route_unknown', build: abstainRouteUnknownInput, expectedAction: 'ABSTAIN' },
  { name: 'provider_unavailable', build: abstainProviderUnavailableInput, expectedAction: 'ABSTAIN' },
  { name: 'provider_disagreement', build: providerDisagreementInput, expectedAction: 'WAIT' },
  { name: 'ml_unavailable', build: mlUnavailableInput, expectedAction: 'WAIT' },
];

// =============================================================================
// Group A — Full roundtrip from extended fixtures
// =============================================================================

// 1.
test('A: every extended fixture completes validate-largo → strip → validate-customer-safe', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const cs = fullRoundtripFromAdvice(fixture);
    assert.strictEqual(cs.schema_version, '0.1.0');
  }
});

// 2.
test('A: full pipeline preserves schema_version on every fixture', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const cs = fullRoundtripFromAdvice(fixture);
    assert.strictEqual(cs.schema_version, fixture.schema_version);
  }
});

// 3.
test('A: full pipeline preserves advice_id on every fixture', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const cs = fullRoundtripFromAdvice(fixture);
    assert.strictEqual(cs.advice_id, fixture.advice_id);
  }
});

// 4.
test('A: full pipeline preserves action on every fixture', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const cs = fullRoundtripFromAdvice(fixture);
    assert.strictEqual(cs.action, fixture.action);
  }
});

// 5.
test('A: full pipeline preserves confidence_label on every fixture', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const cs = fullRoundtripFromAdvice(fixture);
    assert.strictEqual(cs.confidence_label, fixture.confidence_label);
  }
});

// 6.
test('A: full pipeline preserves valid_until exactly on every fixture', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const cs = fullRoundtripFromAdvice(fixture);
    assert.strictEqual(cs.valid_until, fixture.valid_until);
  }
});

// 7.
test('A: full pipeline preserves product_type on every fixture', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const cs = fullRoundtripFromAdvice(fixture);
    assert.strictEqual(cs.product_type, fixture.product_type);
  }
});

// 8.
test('A: full pipeline preserves product_context (deep equality)', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const cs = fullRoundtripFromAdvice(fixture);
    assert.deepStrictEqual(cs.product_context, fixture.product_context);
  }
});

// 9.
test('A: full pipeline preserves product_specific (deep equality)', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const cs = fullRoundtripFromAdvice(fixture);
    assert.deepStrictEqual(cs.product_specific, fixture.product_specific);
  }
});

// 10.
test('A: full pipeline preserves price_observation incl. nulls (deep equality)', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const cs = fullRoundtripFromAdvice(fixture);
    assert.deepStrictEqual(cs.price_observation, fixture.price_observation);
  }
});

// 11.
test('A: full pipeline preserves provider_info.primary_provider including null', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const cs = fullRoundtripFromAdvice(fixture);
    assert.strictEqual(
      cs.provider_info.primary_provider,
      fixture.provider_info.primary_provider,
    );
  }
});

// 12.
test('A: full pipeline preserves provider_info.price_freshness_seconds', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const cs = fullRoundtripFromAdvice(fixture);
    assert.strictEqual(
      cs.provider_info.price_freshness_seconds,
      fixture.provider_info.price_freshness_seconds,
    );
  }
});

// 13.
test('A: full pipeline emits disagreement_summary in {agree, disagree, unknown}', () => {
  const allowed = new Set(['agree', 'disagree', 'unknown']);
  for (const fixture of extendedLargoAdviceFixtures) {
    const cs = fullRoundtripFromAdvice(fixture);
    assert.ok(
      allowed.has(cs.provider_info.disagreement_summary),
      `unexpected disagreement_summary on ${fixture.advice_id}: ${cs.provider_info.disagreement_summary}`,
    );
  }
});

// 14.
test('A: full pipeline preserves reasons (deep equality)', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const cs = fullRoundtripFromAdvice(fixture);
    assert.deepStrictEqual(cs.reasons, fixture.reasons);
  }
});

// 15.
test('A: full pipeline preserves short_message', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const cs = fullRoundtripFromAdvice(fixture);
    assert.strictEqual(cs.short_message, fixture.short_message);
  }
});

// 16.
test('A: full pipeline preserves can_autobuy === false on every fixture', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const cs = fullRoundtripFromAdvice(fixture);
    assert.strictEqual(cs.can_autobuy, fixture.can_autobuy);
    assert.strictEqual(cs.can_autobuy, false);
  }
});

// 17.
test('A: full pipeline preserves ml_available', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const cs = fullRoundtripFromAdvice(fixture);
    assert.strictEqual(cs.ml_available, fixture.ml_available);
  }
});

// 18.
test('A: full pipeline output passes assertNoForbiddenCustomerKeys', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const cs = fullRoundtripFromAdvice(fixture);
    assertNoForbiddenCustomerKeys(cs);
  }
});

// 19.
test('A: full pipeline output is JSON-serializable (no functions/Dates/Maps)', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const cs = fullRoundtripFromAdvice(fixture);
    const serialized = JSON.stringify(cs);
    const parsed = JSON.parse(serialized) as CustomerSafeAdvice;
    assert.deepStrictEqual(parsed, cs);
  }
});

// 20.
test('A: fullRoundtripFromAdvice does not mutate the input fixtures', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const snapshot = JSON.parse(JSON.stringify(fixture));
    fullRoundtripFromAdvice(fixture);
    assert.deepStrictEqual(fixture, snapshot);
  }
});

// =============================================================================
// Group B — Full roundtrip from producer scenarios
// =============================================================================

// 21.
test('B: every producer scenario completes the full pipeline', () => {
  for (const scenario of producerScenarios) {
    const cs = fullRoundtripFromProducerInput(scenario.build());
    assert.strictEqual(cs.schema_version, '0.1.0');
  }
});

// 22-27. Per-scenario action preservation.
for (const scenario of producerScenarios) {
  test(`B: scenario "${scenario.name}" preserves action ${scenario.expectedAction} through the full pipeline`, () => {
    const cs = fullRoundtripFromProducerInput(scenario.build());
    assert.strictEqual(cs.action, scenario.expectedAction);
  });
}

// Specific signal preservation per scenario.

// 28.
test('B: provider_disagreement scenario emits disagreement_summary === "disagree"', () => {
  const cs = fullRoundtripFromProducerInput(providerDisagreementInput());
  assert.strictEqual(cs.provider_info.disagreement_summary, 'disagree');
});

// 29.
test('B: ml_unavailable scenario preserves ml_available === false', () => {
  const cs = fullRoundtripFromProducerInput(mlUnavailableInput());
  assert.strictEqual(cs.ml_available, false);
});

// 30.
test('B: provider_unavailable preserves observed_price_usd === null end-to-end', () => {
  const cs = fullRoundtripFromProducerInput(abstainProviderUnavailableInput());
  assert.strictEqual(cs.price_observation.observed_price_usd, null);
  assert.notStrictEqual(cs.price_observation.observed_price_usd, 0);
});

// 31.
test('B: provider_unavailable preserves primary_provider === null end-to-end', () => {
  const cs = fullRoundtripFromProducerInput(abstainProviderUnavailableInput());
  assert.strictEqual(cs.provider_info.primary_provider, null);
  assert.notStrictEqual(cs.provider_info.primary_provider, '');
  assert.notStrictEqual(cs.provider_info.primary_provider, 'unknown');
});

// 32.
test('B: every producer scenario keeps can_autobuy === false', () => {
  for (const scenario of producerScenarios) {
    const cs = fullRoundtripFromProducerInput(scenario.build());
    assert.strictEqual(cs.can_autobuy, false);
  }
});

// 33.
test('B: every producer scenario passes assertNoForbiddenCustomerKeys', () => {
  for (const scenario of producerScenarios) {
    const cs = fullRoundtripFromProducerInput(scenario.build());
    assertNoForbiddenCustomerKeys(cs);
  }
});

// 34.
test('B: repeated full producer roundtrip with same input is deterministic', () => {
  for (const scenario of producerScenarios) {
    const a = fullRoundtripFromProducerInput(scenario.build());
    const b = fullRoundtripFromProducerInput(scenario.build());
    assert.deepStrictEqual(a, b);
  }
});

// =============================================================================
// Group C — Customer-safe validator as final gate (post-strip injections)
// =============================================================================

function injectAfterStrip(
  fixture: LargoAdvice,
  injectedKey: string,
  injectedValue: unknown,
): unknown {
  const stripped = stripFromFixture(fixture);
  const corrupted = cloneForCorruption(stripped);
  (corrupted as unknown as Record<string, unknown>)[injectedKey] = injectedValue;
  return corrupted;
}

// 35.
test('C: post-strip injection of numeric_value triggers validateCustomerSafeAdvice failure', () => {
  const corrupted = injectAfterStrip(fixtureExtendedBuyNowHigh, 'numeric_value', 0.78);
  const result = validateCustomerSafeAdvice(corrupted);
  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((i) => i.code === 'forbidden_customer_field'));
    assert.ok(result.issues.some((i) => i.path === 'numeric_value'));
  }
});

// 36.
test('C: post-strip injection of technical_details triggers failure (incl. nested model_version)', () => {
  const corrupted = injectAfterStrip(
    fixtureExtendedBuyNowHigh,
    'technical_details',
    { model_version: 'X', q10: 1, q50: 2, q90: 3 },
  );
  const result = validateCustomerSafeAdvice(corrupted);
  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    const paths = new Set(result.issues.map((i) => i.path));
    assert.ok(paths.has('technical_details'));
    assert.ok(paths.has('technical_details.model_version'));
    assert.ok(paths.has('technical_details.q10'));
    assert.ok(paths.has('technical_details.q50'));
    assert.ok(paths.has('technical_details.q90'));
  }
});

// 37.
test('C: post-strip injection of audit_block triggers failure with nested paths', () => {
  const corrupted = injectAfterStrip(fixtureExtendedBuyNowHigh, 'audit_block', {
    audit_id: 'AUD-leak',
    parent_advice_id: null,
  });
  const result = validateCustomerSafeAdvice(corrupted);
  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    const paths = new Set(result.issues.map((i) => i.path));
    assert.ok(paths.has('audit_block'));
    assert.ok(paths.has('audit_block.audit_id'));
    assert.ok(paths.has('audit_block.parent_advice_id'));
  }
});

// 38.
test('C: post-strip injection of provider_info.cross_check_disagreement_pct triggers failure', () => {
  const stripped = stripFromFixture(fixtureExtendedBuyNowHigh);
  const corrupted = cloneForCorruption(stripped);
  const pi = (corrupted as unknown as Record<string, unknown>).provider_info as Record<
    string,
    unknown
  >;
  pi.cross_check_disagreement_pct = 0.142;
  const result = validateCustomerSafeAdvice(corrupted);
  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.ok(
      result.issues.some(
        (i) =>
          i.code === 'forbidden_customer_field' &&
          i.path === 'provider_info.cross_check_disagreement_pct',
      ),
    );
  }
});

// 39.
test('C: post-strip injection of nested model_version under any object triggers failure', () => {
  const corrupted = injectAfterStrip(
    fixtureExtendedBuyNowHigh,
    'internal',
    { model_version: 'leaked' },
  );
  const result = validateCustomerSafeAdvice(corrupted);
  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    const paths = new Set(result.issues.map((i) => i.path));
    assert.ok(paths.has('internal'));
    assert.ok(paths.has('internal.model_version'));
  }
});

// 40.
test('C: every forbidden injection emits issue code "forbidden_customer_field"', () => {
  const cases: Array<[string, unknown]> = [
    ['numeric_value', 0.78],
    ['technical_details', { model_version: 'x' }],
    ['audit_block', { audit_id: 'A', parent_advice_id: null }],
    ['debug', { foo: 'bar' }],
    ['admin', { foo: 'bar' }],
    ['internal', { foo: 'bar' }],
  ];
  for (const [key, value] of cases) {
    const corrupted = injectAfterStrip(fixtureExtendedBuyNowHigh, key, value);
    const result = validateCustomerSafeAdvice(corrupted);
    assert.strictEqual(result.ok, false, `injection of "${key}" should fail`);
    if (!result.ok) {
      assert.ok(
        result.issues.some((i) => i.code === 'forbidden_customer_field'),
      );
    }
  }
});

// 41.
test('C: tryFullRoundtripFromUnknown never silently passes a corrupted customer-safe payload', () => {
  // A tampered LargoAdvice that — even if valid as LargoAdvice — would carry
  // forbidden fields after strip would be caught by validate_customer_safe.
  // Here we simulate by using `tryFullRoundtripFromUnknown` on an obviously
  // broken LargoAdvice; the failure is at the first stage, never passed
  // through silently.
  const broken = { not: 'a LargoAdvice' };
  const result = tryFullRoundtripFromUnknown(broken);
  assert.strictEqual(result.ok, false);
});

// 42.
test('C: forbidden field issue includes path/code/message and helpful expected/actual', () => {
  const corrupted = injectAfterStrip(fixtureExtendedBuyNowHigh, 'numeric_value', 0.78);
  const result = validateCustomerSafeAdvice(corrupted);
  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    const issue = result.issues.find(
      (i) => i.code === 'forbidden_customer_field' && i.path === 'numeric_value',
    );
    assert.ok(issue);
    assert.ok(issue!.message.length > 0);
    assert.ok(typeof issue!.expected === 'string');
    assert.ok(typeof issue!.actual === 'string');
  }
});

// =============================================================================
// Group D — Negative pipeline-stage detection
// =============================================================================

// 43.
test('D: tryFullRoundtripFromUnknown rejects non-object at validate_largo stage', () => {
  const result = tryFullRoundtripFromUnknown(null);
  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.strictEqual(result.stage, 'validate_largo');
  }
});

// 44.
test('D: tryFullRoundtripFromUnknown rejects array at validate_largo stage', () => {
  const result = tryFullRoundtripFromUnknown([1, 2, 3]);
  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.strictEqual(result.stage, 'validate_largo');
  }
});

// 45.
test('D: tryFullRoundtripFromUnknown rejects corrupted LargoAdvice at validate_largo', () => {
  const broken = cloneForCorruption(fixtureExtendedBuyNowHigh);
  (broken as unknown as Record<string, unknown>).action = 'YOLO_BUY';
  const result = tryFullRoundtripFromUnknown(broken);
  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.strictEqual(result.stage, 'validate_largo');
    assert.ok(result.issues.length > 0);
  }
});

// 46.
test('D: direct validateCustomerSafeAdvice rejects corrupted customer-safe at the gate', () => {
  const corrupted = injectAfterStrip(fixtureExtendedBuyNowHigh, 'audit_block', {
    audit_id: 'X',
    parent_advice_id: null,
  });
  const result = validateCustomerSafeAdvice(corrupted);
  assert.strictEqual(result.ok, false);
});

// 47.
test('D: negative tests do not mutate original valid customer-safe object', () => {
  const stripped = stripFromFixture(fixtureExtendedBuyNowHigh);
  const snapshot = JSON.parse(JSON.stringify(stripped));
  const corrupted = cloneForCorruption(stripped);
  (corrupted as unknown as Record<string, unknown>).numeric_value = 0.78;
  validateCustomerSafeAdvice(corrupted);
  // Original `stripped` must be untouched.
  assert.deepStrictEqual(stripped, snapshot);
});

// =============================================================================
// Group E — Coverage sanity
// =============================================================================

// 48.
test('E: full customer-safe pipeline covers all 5 actions across the catalog', () => {
  const actions = new Set<string>();
  for (const fixture of extendedLargoAdviceFixtures) {
    const cs = fullRoundtripFromAdvice(fixture);
    actions.add(cs.action);
  }
  for (const expected of ['BUY_NOW', 'WAIT', 'MONITOR', 'ALERT', 'ABSTAIN']) {
    assert.ok(actions.has(expected), `missing action ${expected}`);
  }
});

// 49.
test('E: full pipeline covers all 4 confidence labels across the catalog', () => {
  const labels = new Set<string>();
  for (const fixture of extendedLargoAdviceFixtures) {
    const cs = fullRoundtripFromAdvice(fixture);
    labels.add(cs.confidence_label);
  }
  for (const expected of ['high', 'moderate', 'limited', 'unavailable']) {
    assert.ok(labels.has(expected), `missing confidence_label ${expected}`);
  }
});

// 50.
test('E: full pipeline covers all 3 surfaces across the catalog', () => {
  const surfaces = new Set<string>();
  for (const fixture of extendedLargoAdviceFixtures) {
    const cs = fullRoundtripFromAdvice(fixture);
    surfaces.add(cs.surface);
  }
  for (const expected of ['simple_search', 'mission_scan', 'manual_check']) {
    assert.ok(surfaces.has(expected), `missing surface ${expected}`);
  }
});

// 51.
test('E: catalog count is 13', () => {
  assert.strictEqual(extendedLargoAdviceFixtures.length, 13);
});

// 52.
test('E: advice_id set after full roundtrip equals advice_id set before', () => {
  const before = new Set(extendedLargoAdviceFixtures.map((f) => f.advice_id));
  const after = new Set(
    extendedLargoAdviceFixtures.map((f) => fullRoundtripFromAdvice(f).advice_id),
  );
  assert.deepStrictEqual([...after].sort(), [...before].sort());
});

// 53.
test('E: every ABSTAIN fixture remains ABSTAIN after full roundtrip', () => {
  const abstainFixtures = extendedLargoAdviceFixtures.filter(
    (f) => f.action === 'ABSTAIN',
  );
  assert.ok(abstainFixtures.length >= 3);
  for (const fixture of abstainFixtures) {
    const cs = fullRoundtripFromAdvice(fixture);
    assert.strictEqual(cs.action, 'ABSTAIN');
  }
});

// 54.
test('E: null observed_price_usd remains null after full roundtrip', () => {
  const cs = fullRoundtripFromAdvice(fixtureExtendedAbstainProviderUnavailable);
  assert.strictEqual(cs.price_observation.observed_price_usd, null);
});

// 55.
test('E: null primary_provider remains null after full roundtrip', () => {
  const cs = fullRoundtripFromAdvice(fixtureExtendedAbstainProviderUnavailable);
  assert.strictEqual(cs.provider_info.primary_provider, null);
});

// 56.
test('E: expired advice valid_until is preserved exactly through full roundtrip', () => {
  const cs = fullRoundtripFromAdvice(fixtureExtendedExpiredAdvice);
  assert.strictEqual(cs.valid_until, fixtureExtendedExpiredAdvice.valid_until);
});

// 57.
test('E: anonymous quota placeholder reason is preserved through full roundtrip', () => {
  const cs = fullRoundtripFromAdvice(
    fixtureExtendedAnonymousQuotaExceededPlaceholder,
  );
  assert.ok(cs.reasons.some((r) => r.code === 'anonymous_quota_exceeded'));
  assert.ok(/sign in/i.test(cs.short_message));
});

// 58.
test('E: one-way flight remains one-way after full roundtrip', () => {
  const cs = fullRoundtripFromAdvice(fixtureExtendedOneWayFlight);
  assert.strictEqual(cs.product_context.inbound_date, null);
  assert.strictEqual(cs.product_specific.is_round_trip, false);
});

// 59.
test('E: manual_check surface remains manual_check after full roundtrip', () => {
  const cs = fullRoundtripFromAdvice(fixtureExtendedManualCheck);
  assert.strictEqual(cs.surface, 'manual_check');
});

// =============================================================================
// Group F — Determinism / purity
// =============================================================================

// 60.
test('F: fullRoundtripFromAdvice same fixture twice returns deep-equal outputs', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const a = fullRoundtripFromAdvice(fixture);
    const b = fullRoundtripFromAdvice(fixture);
    assert.deepStrictEqual(a, b);
  }
});

// 61.
test('F: fullRoundtripFromAdvice returns a fresh object distinct from the input LargoAdvice', () => {
  const cs = fullRoundtripFromAdvice(fixtureExtendedBuyNowHigh);
  // Different reference from the LargoAdvice (strip creates a new object).
  assert.notStrictEqual(cs as unknown, fixtureExtendedBuyNowHigh as unknown);
});

// 62.
test('F: validateCustomerSafeAdvice success branch returns same customer-safe reference', () => {
  const stripped = stripFromFixture(fixtureExtendedBuyNowHigh);
  const result = validateCustomerSafeAdvice(stripped);
  assert.strictEqual(result.ok, true);
  if (result.ok) {
    assert.strictEqual(result.value, stripped);
  }
});

// 63.
test('F: tryFullRoundtripFromUnknown valid result is deterministic', () => {
  const a = tryFullRoundtripFromUnknown(fixtureExtendedBuyNowHigh);
  const b = tryFullRoundtripFromUnknown(fixtureExtendedBuyNowHigh);
  assert.deepStrictEqual(a, b);
});

// 64.
test('F: tryFullRoundtripFromUnknown invalid result is deterministic', () => {
  const broken = cloneForCorruption(fixtureExtendedBuyNowHigh);
  (broken as unknown as Record<string, unknown>).action = 'YOLO_BUY';
  const a = tryFullRoundtripFromUnknown(broken);
  const b = tryFullRoundtripFromUnknown(broken);
  assert.deepStrictEqual(a, b);
});

// 65.
test('F: full pipeline result has no functions / Dates / Maps / Sets (JSON round-trip)', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const cs = fullRoundtripFromAdvice(fixture);
    const serialized = JSON.stringify(cs);
    const parsed = JSON.parse(serialized);
    assert.deepStrictEqual(parsed, cs);
  }
});

// 66.
test('F: helpers never throw on the valid fixture catalog', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    // Helpers operating on the LargoAdvice domain must not throw on valid
    // fixtures.
    assert.doesNotThrow(() => fullRoundtripFromAdvice(fixture));
    assert.doesNotThrow(() => tryFullRoundtripFromUnknown(fixture));
    assert.doesNotThrow(() => stripFromFixture(fixture));

    // `assertNoForbiddenCustomerKeys` may ONLY run on a CustomerSafeAdvice
    // (post-strip). A raw LargoAdvice legitimately carries admin-only fields
    // (numeric_value, technical_details, audit_block) before stripping —
    // calling the walker on the raw fixture would correctly throw, which is
    // the wrong assertion at this stage of the pipeline.
    const customerSafe = fullRoundtripFromAdvice(fixture);
    assert.doesNotThrow(() => assertNoForbiddenCustomerKeys(customerSafe));
  }
});

// 67.
test('F: tryFullRoundtripFromUnknown does not throw on adversarial unknown values', () => {
  const adversarial: unknown[] = [
    null,
    undefined,
    0,
    Number.NaN,
    Infinity,
    -Infinity,
    '',
    'not advice',
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
    assert.doesNotThrow(() => tryFullRoundtripFromUnknown(value));
    const result = tryFullRoundtripFromUnknown(value);
    assert.ok(result.ok === true || result.ok === false);
  }
});

// =============================================================================
// Self-running entry point
// =============================================================================

runAll();
