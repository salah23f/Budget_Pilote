/**
 * Largo — roundtrip pipeline tests (Sprint 2.2, B1).
 *
 * Locks the pure pipeline end-to-end on the 13 extended fixtures and on
 * 7 producer scenarios:
 *
 *   LargoAdvice fixture
 *     → validateLargoAdvice (Sprint 1.3)
 *     → stripToCustomerSafe (Sprint 1.1)
 *     → CustomerSafeAdvice
 *
 *   StubLargoAdviceInput
 *     → produceStubLargoAdvice (Sprint 1.2)
 *     → validateLargoAdvice
 *     → stripToCustomerSafe
 *     → CustomerSafeAdvice
 *
 * Goals (per `docs/b1/B1_IMPLEMENTATION_PLAN.md` §13 deliverable 3):
 *  - Verify every preserved field is preserved structurally and by value.
 *  - Detect any leak of admin-only fields (`numeric_value`, `technical_details`,
 *    `audit_block`, `cross_check_*`, model/debug internals) into the customer view.
 *  - Verify the action/confidence/surface enum coverage of the fixture catalog.
 *  - Negative-sanity: corrupted advice rejected by validator and never passed
 *    to strip; original fixtures never mutated by the corruption test.
 *  - Determinism: repeated roundtrip → deep-equal output.
 *
 * Discipline (per `docs/b1/CLAUDE_CODE_RULES.md` §17, §18):
 *  - PURE / DETERMINISTIC. No I/O, no async, no fetch, no DB, no env.
 *  - NO NEW DEPENDENCY. `node:assert/strict` + tiny local harness.
 *  - SCOPE-LIMITED. Test-only branch; no producer/validator/strip/fixture
 *    code modified. Helpers live inside this file.
 *
 * Sources of truth:
 *  - `docs/b0/LARGO_ADVICE_CONTRACT.md` §3 (enums), §4 (master interface),
 *    §6 (`can_autobuy`), §8–§17 (sub-shapes), §20 (forbidden patterns).
 *  - `docs/b0/LARGO_BACKEND_API_SPEC.md` §10 (strip rule).
 *  - `docs/b0/LARGO_FRONTEND_UX_SPEC.md` §4, §41.
 *  - `docs/b0/LARGO_MODEL_STRATEGY.md` §21, §25.4, §37 (forbidden patterns;
 *    only structurally enforceable subset is testable here).
 *  - `docs/b1/B1_IMPLEMENTATION_PLAN.md` §4 anchors, §13 (Sprint 2 deliverable 3).
 *
 * Run via:
 *
 *   npx tsx tests/largo/roundtrip/largo-roundtrip.test.ts
 */

import { strict as assert } from 'node:assert';
import type { LargoAdvice } from '@/types/largo/advice';
import type { CustomerSafeAdvice } from '@/types/largo/customer-safe-advice';
import {
  produceStubLargoAdvice,
  type StubLargoAdviceInput,
} from '@/lib/largo/producer/stub';
import {
  validateLargoAdvice,
  type LargoValidationIssue,
} from '@/lib/largo/validator/advice-validator';
import { stripToCustomerSafe } from '@/lib/largo/safe-view/strip';
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
 * Happy-path roundtrip. Asserts the validator accepts the advice, then strips.
 * Throws (via assert) if the validator rejects — used only on inputs we expect
 * to be valid.
 */
function roundtripAdvice(advice: LargoAdvice): CustomerSafeAdvice {
  const validated = validateLargoAdvice(advice);
  if (!validated.ok) {
    const codes = validated.issues
      .map((i) => `${i.path || '<root>'}:${i.code}`)
      .join(', ');
    assert.fail(`expected advice to validate, got issues: ${codes}`);
  }
  return stripToCustomerSafe(validated.value);
}

/** Result of the non-throwing roundtrip helper used in negative tests. */
type TryRoundtripResult =
  | { ok: true; value: CustomerSafeAdvice }
  | { ok: false; issues: LargoValidationIssue[] };

/**
 * Non-throwing roundtrip. Returns `{ ok: false, issues }` if validation fails;
 * never invokes `stripToCustomerSafe` on invalid input. Used in negative tests
 * to verify the helper short-circuits before strip.
 */
function tryRoundtripAdvice(advice: unknown): TryRoundtripResult {
  const validated = validateLargoAdvice(advice);
  if (!validated.ok) {
    return { ok: false, issues: validated.issues };
  }
  return { ok: true, value: stripToCustomerSafe(validated.value) };
}

/** Recursive walker — assert that no key with the given name appears anywhere. */
function assertNoKeyAnywhere(value: unknown, forbiddenKey: string): void {
  function walk(node: unknown): void {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    const obj = node as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      assert.notStrictEqual(
        key,
        forbiddenKey,
        `forbidden key "${forbiddenKey}" found in stripped output`,
      );
      walk(obj[key]);
    }
  }
  walk(value);
}

/**
 * Deep-clone an advice via JSON round-trip. Safe because `LargoAdvice` is
 * plain JSON. Used only in negative tests so the corruption never mutates
 * the shared module-level fixture.
 */
function cloneAdviceForCorruption(advice: LargoAdvice): LargoAdvice {
  return JSON.parse(JSON.stringify(advice)) as LargoAdvice;
}

// -----------------------------------------------------------------------------
// Producer scenario builders (private, deterministic)
// -----------------------------------------------------------------------------

const NOW_ISO = '2026-04-27T10:00:00.000Z';

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
    user_id: 'usr_round',
    mission_id: 'msn_round',
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

const producerScenarioBuilders: Array<{
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
// Group A — Roundtrip on extended fixtures
// =============================================================================

// 1. Every extended fixture validates successfully.
test('A: every extended fixture validates successfully', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const validated = validateLargoAdvice(fixture);
    if (!validated.ok) {
      const codes = validated.issues
        .map((i) => `${i.path || '<root>'}:${i.code}`)
        .join(', ');
      assert.fail(
        `fixture ${fixture.advice_id} did not validate: ${codes}`,
      );
    }
  }
});

// 2. Every validated fixture can be stripped (no throw, schema preserved).
test('A: every validated fixture can be stripped (no throw)', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const stripped = roundtripAdvice(fixture);
    assert.strictEqual(stripped.schema_version, '0.1.0');
  }
});

// 3. schema_version preserved.
test('A: stripped output preserves schema_version === "0.1.0"', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const stripped = roundtripAdvice(fixture);
    assert.strictEqual(stripped.schema_version, fixture.schema_version);
  }
});

// 4. advice_id preserved.
test('A: stripped output preserves advice_id', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const stripped = roundtripAdvice(fixture);
    assert.strictEqual(stripped.advice_id, fixture.advice_id);
  }
});

// 5. action preserved.
test('A: stripped output preserves action', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const stripped = roundtripAdvice(fixture);
    assert.strictEqual(stripped.action, fixture.action);
  }
});

// 6. confidence_label preserved.
test('A: stripped output preserves confidence_label', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const stripped = roundtripAdvice(fixture);
    assert.strictEqual(stripped.confidence_label, fixture.confidence_label);
  }
});

// 7. valid_until preserved exactly.
test('A: stripped output preserves valid_until exactly', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const stripped = roundtripAdvice(fixture);
    assert.strictEqual(stripped.valid_until, fixture.valid_until);
  }
});

// 8. product_type preserved.
test('A: stripped output preserves product_type', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const stripped = roundtripAdvice(fixture);
    assert.strictEqual(stripped.product_type, fixture.product_type);
  }
});

// 9. product_context preserved (deep equality).
test('A: stripped output preserves product_context (deep equality)', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const stripped = roundtripAdvice(fixture);
    assert.deepStrictEqual(stripped.product_context, fixture.product_context);
  }
});

// 10. product_specific preserved (deep equality).
test('A: stripped output preserves product_specific (deep equality)', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const stripped = roundtripAdvice(fixture);
    assert.deepStrictEqual(stripped.product_specific, fixture.product_specific);
  }
});

// 11. price_observation preserved (deep equality), including nulls.
test('A: stripped output preserves price_observation (deep equality, nulls included)', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const stripped = roundtripAdvice(fixture);
    assert.deepStrictEqual(
      stripped.price_observation,
      fixture.price_observation,
    );
  }
});

// 12. provider summary present and correctly shaped.
test('A: stripped output exposes provider summary (primary_provider + freshness + disagreement_summary)', () => {
  const allowedSummaries = new Set(['agree', 'disagree', 'unknown']);
  for (const fixture of extendedLargoAdviceFixtures) {
    const stripped = roundtripAdvice(fixture);
    assert.strictEqual(
      stripped.provider_info.primary_provider,
      fixture.provider_info.primary_provider,
    );
    assert.strictEqual(
      stripped.provider_info.price_freshness_seconds,
      fixture.provider_info.price_freshness_seconds,
    );
    assert.ok(
      allowedSummaries.has(stripped.provider_info.disagreement_summary),
      `disagreement_summary must be one of agree/disagree/unknown, got ${stripped.provider_info.disagreement_summary}`,
    );
  }
});

// 13. reasons preserved (deep equality).
test('A: stripped output preserves reasons (deep equality)', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const stripped = roundtripAdvice(fixture);
    assert.deepStrictEqual(stripped.reasons, fixture.reasons);
  }
});

// 14. short_message preserved.
test('A: stripped output preserves short_message', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const stripped = roundtripAdvice(fixture);
    assert.strictEqual(stripped.short_message, fixture.short_message);
  }
});

// 15. can_autobuy preserved (always false in Phase 1).
test('A: stripped output preserves can_autobuy (false on every fixture)', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const stripped = roundtripAdvice(fixture);
    assert.strictEqual(stripped.can_autobuy, fixture.can_autobuy);
    assert.strictEqual(stripped.can_autobuy, false);
  }
});

// 16. ml_available preserved.
test('A: stripped output preserves ml_available', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const stripped = roundtripAdvice(fixture);
    assert.strictEqual(stripped.ml_available, fixture.ml_available);
  }
});

// 17. No numeric_value anywhere.
test('A: stripped output never exposes numeric_value (every fixture)', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const stripped = roundtripAdvice(fixture);
    assertNoKeyAnywhere(stripped, 'numeric_value');
  }
});

// 18. No technical_details anywhere.
test('A: stripped output never exposes technical_details (every fixture)', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const stripped = roundtripAdvice(fixture);
    assertNoKeyAnywhere(stripped, 'technical_details');
  }
});

// 19. No audit_block anywhere.
test('A: stripped output never exposes audit_block / audit_id / parent_advice_id', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const stripped = roundtripAdvice(fixture);
    assertNoKeyAnywhere(stripped, 'audit_block');
    assertNoKeyAnywhere(stripped, 'audit_id');
    assertNoKeyAnywhere(stripped, 'parent_advice_id');
  }
});

// 20. No raw provider cross-check internals anywhere.
test('A: stripped output never exposes raw cross-check provider internals', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const stripped = roundtripAdvice(fixture);
    assertNoKeyAnywhere(stripped, 'cross_check_disagreement_pct');
    assertNoKeyAnywhere(stripped, 'cross_check_provider');
    assertNoKeyAnywhere(stripped, 'cross_check_offer_id');
    assertNoKeyAnywhere(stripped, 'primary_provider_offer_id');
  }
});

// 21. No model / debug internals anywhere.
test('A: stripped output never exposes model/debug internals', () => {
  const debugKeys = [
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
  ];
  for (const fixture of extendedLargoAdviceFixtures) {
    const stripped = roundtripAdvice(fixture);
    for (const key of debugKeys) {
      assertNoKeyAnywhere(stripped, key);
    }
  }
});

// 22. Action survives roundtrip, byName form.
test('A: action survives roundtrip on each named fixture (sanity)', () => {
  for (const [name, fixture] of Object.entries(
    extendedLargoAdviceFixtureByName,
  )) {
    const stripped = roundtripAdvice(fixture);
    assert.strictEqual(
      stripped.action,
      fixture.action,
      `action mismatch on ${name}`,
    );
  }
});

// 23. Stripped advice_ids remain unique after roundtrip on the whole catalog.
test('A: stripped advice_ids remain unique across the catalog', () => {
  const ids = new Set<string>();
  for (const fixture of extendedLargoAdviceFixtures) {
    const stripped = roundtripAdvice(fixture);
    assert.ok(
      !ids.has(stripped.advice_id),
      `duplicate stripped advice_id: ${stripped.advice_id}`,
    );
    ids.add(stripped.advice_id);
  }
  assert.strictEqual(ids.size, extendedLargoAdviceFixtures.length);
});

// 24. Every ABSTAIN fixture stays ABSTAIN after roundtrip.
test('A: every ABSTAIN fixture stays ABSTAIN after roundtrip', () => {
  const abstainFixtures = extendedLargoAdviceFixtures.filter(
    (f) => f.action === 'ABSTAIN',
  );
  assert.ok(
    abstainFixtures.length >= 3,
    'expected at least 3 ABSTAIN fixtures (route unknown, provider unavailable, quota)',
  );
  for (const fixture of abstainFixtures) {
    const stripped = roundtripAdvice(fixture);
    assert.strictEqual(stripped.action, 'ABSTAIN');
  }
});

// 25. Every null observed_price_usd stays null after roundtrip.
test('A: every null observed_price_usd stays null after roundtrip', () => {
  const nullPriceFixtures = extendedLargoAdviceFixtures.filter(
    (f) => f.price_observation.observed_price_usd === null,
  );
  assert.ok(
    nullPriceFixtures.length >= 1,
    'expected at least 1 null-price fixture',
  );
  for (const fixture of nullPriceFixtures) {
    const stripped = roundtripAdvice(fixture);
    assert.strictEqual(stripped.price_observation.observed_price_usd, null);
    assert.notStrictEqual(stripped.price_observation.observed_price_usd, 0);
  }
});

// 26. Every null primary_provider stays null after roundtrip.
test('A: every null primary_provider stays null after roundtrip', () => {
  const nullProviderFixtures = extendedLargoAdviceFixtures.filter(
    (f) => f.provider_info.primary_provider === null,
  );
  assert.ok(
    nullProviderFixtures.length >= 1,
    'expected at least 1 null-provider fixture',
  );
  for (const fixture of nullProviderFixtures) {
    const stripped = roundtripAdvice(fixture);
    assert.strictEqual(stripped.provider_info.primary_provider, null);
    assert.notStrictEqual(stripped.provider_info.primary_provider, '');
    assert.notStrictEqual(stripped.provider_info.primary_provider, 'unknown');
  }
});

// =============================================================================
// Group B — Producer → validate → strip roundtrip
// =============================================================================

// 27-32. One test per scenario: validates and strips successfully.
for (const scenario of producerScenarioBuilders) {
  test(`B: producer scenario "${scenario.name}" validates and strips`, () => {
    const advice = produceStubLargoAdvice(scenario.build());
    assert.strictEqual(advice.action, scenario.expectedAction);
    const stripped = roundtripAdvice(advice);
    assert.strictEqual(stripped.schema_version, '0.1.0');
    assert.strictEqual(stripped.advice_id, advice.advice_id);
    assert.strictEqual(stripped.action, scenario.expectedAction);
  });
}

// 33. Producer roundtrip never leaks numeric_value after strip.
test('B: producer roundtrip never leaks numeric_value (every scenario)', () => {
  for (const scenario of producerScenarioBuilders) {
    const advice = produceStubLargoAdvice(scenario.build());
    const stripped = roundtripAdvice(advice);
    assertNoKeyAnywhere(stripped, 'numeric_value');
  }
});

// 34. Producer roundtrip never leaks technical_details after strip.
test('B: producer roundtrip never leaks technical_details (every scenario)', () => {
  for (const scenario of producerScenarioBuilders) {
    const advice = produceStubLargoAdvice(scenario.build());
    const stripped = roundtripAdvice(advice);
    assertNoKeyAnywhere(stripped, 'technical_details');
    assertNoKeyAnywhere(stripped, 'model_version');
    assertNoKeyAnywhere(stripped, 'q10');
    assertNoKeyAnywhere(stripped, 'q50');
    assertNoKeyAnywhere(stripped, 'q90');
    assertNoKeyAnywhere(stripped, 'fallback_reason');
    assertNoKeyAnywhere(stripped, 'cross_check_price');
  }
});

// 35. Producer roundtrip never leaks audit_block after strip.
test('B: producer roundtrip never leaks audit_block (every scenario)', () => {
  for (const scenario of producerScenarioBuilders) {
    const advice = produceStubLargoAdvice(scenario.build());
    const stripped = roundtripAdvice(advice);
    assertNoKeyAnywhere(stripped, 'audit_block');
    assertNoKeyAnywhere(stripped, 'audit_id');
    assertNoKeyAnywhere(stripped, 'parent_advice_id');
  }
});

// 36. Producer roundtrip preserves ABSTAIN.
test('B: producer roundtrip preserves ABSTAIN (route_unknown + provider_unavailable)', () => {
  for (const name of ['route_unknown', 'provider_unavailable']) {
    const scenario = producerScenarioBuilders.find((s) => s.name === name);
    assert.ok(scenario);
    const advice = produceStubLargoAdvice(scenario!.build());
    const stripped = roundtripAdvice(advice);
    assert.strictEqual(advice.action, 'ABSTAIN');
    assert.strictEqual(stripped.action, 'ABSTAIN');
    assert.strictEqual(stripped.confidence_label, 'unavailable');
  }
});

// 37. Producer roundtrip preserves null price.
test('B: producer roundtrip preserves null observed_price_usd', () => {
  const scenario = producerScenarioBuilders.find(
    (s) => s.name === 'provider_unavailable',
  );
  assert.ok(scenario);
  const advice = produceStubLargoAdvice(scenario!.build());
  const stripped = roundtripAdvice(advice);
  assert.strictEqual(advice.price_observation.observed_price_usd, null);
  assert.strictEqual(stripped.price_observation.observed_price_usd, null);
  assert.notStrictEqual(stripped.price_observation.observed_price_usd, 0);
});

// 38. Producer roundtrip preserves null provider.
test('B: producer roundtrip preserves null primary_provider', () => {
  const scenario = producerScenarioBuilders.find(
    (s) => s.name === 'provider_unavailable',
  );
  assert.ok(scenario);
  const advice = produceStubLargoAdvice(scenario!.build());
  const stripped = roundtripAdvice(advice);
  assert.strictEqual(advice.provider_info.primary_provider, null);
  assert.strictEqual(stripped.provider_info.primary_provider, null);
  assert.notStrictEqual(stripped.provider_info.primary_provider, '');
});

// 39. Producer roundtrip preserves can_autobuy: false.
test('B: producer roundtrip keeps can_autobuy === false (every scenario)', () => {
  for (const scenario of producerScenarioBuilders) {
    const advice = produceStubLargoAdvice(scenario.build());
    const stripped = roundtripAdvice(advice);
    assert.strictEqual(advice.can_autobuy, false);
    assert.strictEqual(stripped.can_autobuy, false);
  }
});

// 40. Validator returns same-reference value (Sprint 1.3 contract).
test('B: validator returns same-reference value on producer output', () => {
  for (const scenario of producerScenarioBuilders) {
    const advice = produceStubLargoAdvice(scenario.build());
    const validated = validateLargoAdvice(advice);
    assert.strictEqual(validated.ok, true);
    if (validated.ok) {
      assert.strictEqual(validated.value, advice);
    }
  }
});

// =============================================================================
// Group C — Cross-fixture UI coverage
// =============================================================================

// 41. action enum coverage.
test('C: action enum coverage = {BUY_NOW, WAIT, MONITOR, ALERT, ABSTAIN}', () => {
  const actions = new Set(extendedLargoAdviceFixtures.map((f) => f.action));
  assert.ok(actions.has('BUY_NOW'));
  assert.ok(actions.has('WAIT'));
  assert.ok(actions.has('MONITOR'));
  assert.ok(actions.has('ALERT'));
  assert.ok(actions.has('ABSTAIN'));
});

// 42. confidence_label coverage.
test('C: confidence_label coverage = {high, moderate, limited, unavailable}', () => {
  const labels = new Set(
    extendedLargoAdviceFixtures.map((f) => f.confidence_label),
  );
  assert.ok(labels.has('high'));
  assert.ok(labels.has('moderate'));
  assert.ok(labels.has('limited'));
  assert.ok(labels.has('unavailable'));
});

// 43. surface coverage.
test('C: surface coverage = {simple_search, mission_scan, manual_check}', () => {
  const surfaces = new Set(extendedLargoAdviceFixtures.map((f) => f.surface));
  assert.ok(surfaces.has('simple_search'));
  assert.ok(surfaces.has('mission_scan'));
  assert.ok(surfaces.has('manual_check'));
});

// 44. Anonymous quota placeholder present.
test('C: catalog includes anonymous quota placeholder', () => {
  assert.ok(
    extendedLargoAdviceFixtures.includes(
      fixtureExtendedAnonymousQuotaExceededPlaceholder,
    ),
  );
  assert.strictEqual(
    fixtureExtendedAnonymousQuotaExceededPlaceholder.user_id,
    null,
  );
  assert.ok(
    fixtureExtendedAnonymousQuotaExceededPlaceholder.reasons.some(
      (r) => r.code === 'anonymous_quota_exceeded',
    ),
  );
});

// 45. Expired advice present.
test('C: catalog includes expired advice', () => {
  assert.ok(
    extendedLargoAdviceFixtures.includes(fixtureExtendedExpiredAdvice),
  );
  // valid_until is clearly in the past relative to a reference now.
  assert.ok(
    Date.parse(fixtureExtendedExpiredAdvice.valid_until) <
      Date.parse('2026-04-25T00:00:00.000Z'),
  );
});

// 46. ML unavailable present.
test('C: catalog includes ML unavailable', () => {
  assert.ok(
    extendedLargoAdviceFixtures.includes(fixtureExtendedMlUnavailable),
  );
  assert.strictEqual(fixtureExtendedMlUnavailable.ml_available, false);
  assert.strictEqual(fixtureExtendedMlUnavailable.numeric_value, null);
});

// 47. Provider disagreement present.
test('C: catalog includes provider disagreement', () => {
  assert.ok(
    extendedLargoAdviceFixtures.includes(fixtureExtendedProviderDisagreement),
  );
  assert.notStrictEqual(fixtureExtendedProviderDisagreement.action, 'BUY_NOW');
  assert.ok(
    fixtureExtendedProviderDisagreement.reasons.some(
      (r) => r.code === 'provider_disagreement',
    ),
  );
  // Stripped form: disagreement_summary === 'disagree'.
  const stripped = roundtripAdvice(fixtureExtendedProviderDisagreement);
  assert.strictEqual(stripped.provider_info.disagreement_summary, 'disagree');
});

// 48. One-way flight present.
test('C: catalog includes one-way flight', () => {
  assert.ok(extendedLargoAdviceFixtures.includes(fixtureExtendedOneWayFlight));
  assert.strictEqual(fixtureExtendedOneWayFlight.product_context.inbound_date, null);
  assert.strictEqual(fixtureExtendedOneWayFlight.product_specific.is_round_trip, false);
});

// 49. manual_check fixture present.
test('C: catalog includes manual_check surface fixture', () => {
  assert.ok(extendedLargoAdviceFixtures.includes(fixtureExtendedManualCheck));
  assert.strictEqual(fixtureExtendedManualCheck.surface, 'manual_check');
});

// 50. Catalog has exactly 13 fixtures.
test('C: catalog has exactly 13 fixtures', () => {
  assert.strictEqual(extendedLargoAdviceFixtures.length, 13);
  assert.strictEqual(
    Object.keys(extendedLargoAdviceFixtureByName).length,
    13,
  );
});

// =============================================================================
// Group D — Negative sanity
// =============================================================================

// 51. Validator rejects a deliberately corrupted fixture before strip.
test('D: validator rejects a deliberately corrupted fixture', () => {
  const corrupted = cloneAdviceForCorruption(fixtureExtendedBuyNowHigh);
  // Force an invalid Phase 1 anchor: hotel is in the type enum, but Phase 1 forbids it.
  (corrupted as unknown as Record<string, unknown>).product_type = 'hotel';
  const result = validateLargoAdvice(corrupted);
  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((i) => i.code === 'invalid_phase1_product'));
  }
});

// 52. Corrupted fixture is not passed to strip in the helper.
test('D: tryRoundtripAdvice short-circuits on invalid input (no strip call)', () => {
  const corrupted = cloneAdviceForCorruption(fixtureExtendedBuyNowHigh);
  (corrupted as unknown as Record<string, unknown>).action = 'YOLO_BUY';
  const result = tryRoundtripAdvice(corrupted);
  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.length > 0);
    assert.ok(result.issues.some((i) => i.code === 'invalid_enum'));
  }
});

// 53. Strip is only reachable through the helper after validate ok.
test('D: tryRoundtripAdvice on a valid fixture returns ok=true with a CustomerSafeAdvice', () => {
  const result = tryRoundtripAdvice(fixtureExtendedBuyNowHigh);
  assert.strictEqual(result.ok, true);
  if (result.ok) {
    assert.strictEqual(result.value.schema_version, '0.1.0');
    assert.strictEqual(result.value.action, fixtureExtendedBuyNowHigh.action);
  }
});

// 54. Helper does not throw on totally bogus input (string, number, null, etc.).
test('D: tryRoundtripAdvice does not throw on adversarial inputs', () => {
  const adversarial: unknown[] = [
    null,
    undefined,
    'not an advice',
    42,
    true,
    [],
    [1, 2, 3],
    Object.create(null),
  ];
  for (const value of adversarial) {
    assert.doesNotThrow(() => tryRoundtripAdvice(value));
    const result = tryRoundtripAdvice(value);
    assert.strictEqual(result.ok, false);
  }
});

// 55. The corruption test does not mutate the original fixture.
test('D: corruption tests do not mutate the original module-level fixtures', () => {
  const snapshot = JSON.parse(JSON.stringify(fixtureExtendedBuyNowHigh));
  const corrupted = cloneAdviceForCorruption(fixtureExtendedBuyNowHigh);
  (corrupted as unknown as Record<string, unknown>).action = 'YOLO_BUY';
  (corrupted as unknown as Record<string, unknown>).product_type = 'hotel';
  // Run validator + helper on the corrupted clone.
  validateLargoAdvice(corrupted);
  tryRoundtripAdvice(corrupted);
  // Original fixture must be untouched.
  assert.deepStrictEqual(fixtureExtendedBuyNowHigh, snapshot);
});

// =============================================================================
// Group E — Determinism
// =============================================================================

// 56. Repeated roundtrip of same fixture yields deep-equal CustomerSafeAdvice.
test('E: repeated roundtrip of same fixture yields deep-equal output', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const a = roundtripAdvice(fixture);
    const b = roundtripAdvice(fixture);
    assert.deepStrictEqual(a, b);
    // Output is a fresh object on each call (no shared reference).
    assert.notStrictEqual(a, b);
  }
});

// 57. Repeated producer roundtrip with same input yields deep-equal output.
test('E: repeated producer roundtrip with same input yields deep-equal output', () => {
  for (const scenario of producerScenarioBuilders) {
    const adviceA = produceStubLargoAdvice(scenario.build());
    const adviceB = produceStubLargoAdvice(scenario.build());
    const strippedA = roundtripAdvice(adviceA);
    const strippedB = roundtripAdvice(adviceB);
    assert.deepStrictEqual(strippedA, strippedB);
  }
});

// 58. Extended fixture array order is stable.
test('E: extendedLargoAdviceFixtures order is stable across reads', () => {
  const ids1 = extendedLargoAdviceFixtures.map((f) => f.advice_id);
  const ids2 = extendedLargoAdviceFixtures.map((f) => f.advice_id);
  assert.deepStrictEqual(ids1, ids2);
});

// 59. byName map keys are stable.
test('E: extendedLargoAdviceFixtureByName keys are stable', () => {
  const expectedKeys = [
    'buyNowHigh',
    'buyNowModerate',
    'waitHighPrice',
    'monitor',
    'alert',
    'abstainRouteUnknown',
    'abstainProviderUnavailable',
    'providerDisagreement',
    'expiredAdvice',
    'mlUnavailable',
    'anonymousQuotaExceeded',
    'manualCheck',
    'oneWayFlight',
  ];
  const actualKeys = Object.keys(extendedLargoAdviceFixtureByName).sort();
  assert.deepStrictEqual(actualKeys, [...expectedKeys].sort());
});

// 60. Outputs are JSON-serializable (round-trip through JSON without loss).
test('E: roundtrip outputs are JSON-serializable (no functions, no Dates, no Maps)', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const stripped = roundtripAdvice(fixture);
    const serialized = JSON.stringify(stripped);
    const parsed = JSON.parse(serialized) as CustomerSafeAdvice;
    assert.deepStrictEqual(parsed, stripped);
  }
});

// =============================================================================
// Group F — Bonus invariants (additional safety nets)
// =============================================================================

// F1. The set of stripped advice_ids equals the set of fixture advice_ids.
test('F: set of stripped advice_ids equals the set of fixture advice_ids', () => {
  const fixtureIds = new Set(
    extendedLargoAdviceFixtures.map((f) => f.advice_id),
  );
  const strippedIds = new Set(
    extendedLargoAdviceFixtures.map((f) => roundtripAdvice(f).advice_id),
  );
  assert.deepStrictEqual([...strippedIds].sort(), [...fixtureIds].sort());
});

// F2. Anonymous quota placeholder roundtrips to ABSTAIN with the right reason code.
test('F: anonymous quota placeholder roundtrips with reason "anonymous_quota_exceeded"', () => {
  const stripped = roundtripAdvice(
    fixtureExtendedAnonymousQuotaExceededPlaceholder,
  );
  assert.strictEqual(stripped.action, 'ABSTAIN');
  assert.ok(
    stripped.reasons.some((r) => r.code === 'anonymous_quota_exceeded'),
  );
  // Sign-in prompt preserved verbatim.
  assert.ok(/sign in/i.test(stripped.short_message));
});

// F3. Expired advice roundtrips with valid_until preserved exactly.
test('F: expired advice roundtrips with valid_until preserved exactly', () => {
  const stripped = roundtripAdvice(fixtureExtendedExpiredAdvice);
  assert.strictEqual(
    stripped.valid_until,
    fixtureExtendedExpiredAdvice.valid_until,
  );
});

// F4. Roundtrip helper does not mutate the input advice.
test('F: roundtripAdvice does not mutate the input advice', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const snapshot = JSON.parse(JSON.stringify(fixture));
    roundtripAdvice(fixture);
    assert.deepStrictEqual(fixture, snapshot);
  }
});

// F5. Producer roundtrip on every scenario keeps action consistent with expected.
test('F: producer roundtrip action matches the scenario expectation', () => {
  for (const scenario of producerScenarioBuilders) {
    const advice = produceStubLargoAdvice(scenario.build());
    const stripped = roundtripAdvice(advice);
    assert.strictEqual(stripped.action, scenario.expectedAction);
  }
});

// =============================================================================
// Self-running entry point
// =============================================================================

runAll();
