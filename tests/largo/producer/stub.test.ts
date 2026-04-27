/**
 * Largo — `produceStubLargoAdvice` unit tests (Sprint 1, B1, second code task).
 *
 * Verifies the deterministic stub producer per:
 *  - `docs/b0/LARGO_ADVICE_CONTRACT.md` §3, §4, §6 (`can_autobuy`),
 *    §12 (reasons), §17 (audit envelope), §20 (forbidden patterns).
 *  - `docs/b0/LARGO_BACKEND_API_SPEC.md` §10 (strip rule consumption).
 *  - `docs/b0/LARGO_MODEL_STRATEGY.md` §4 (forbidden), §21 (ABSTAIN as
 *    first-class), §25.4 (never default to BUY_NOW under failure),
 *    §37 rows 12, 17 (no fake confidence, no default BUY_NOW).
 *  - `docs/b1/B1_IMPLEMENTATION_PLAN.md` §4 (Phase 1 anchors), §7 (purity),
 *    §19 (test invariants) — adapted for a producer rather than a stripper.
 *  - `docs/b1/CLAUDE_CODE_RULES.md` §10, §11, §17.
 *
 * Test runner: this file uses `node:assert/strict` and the same self-running
 * harness as `tests/largo/safe-view/strip.test.ts`, so it executes via
 * `npx tsx tests/largo/producer/stub.test.ts` without adding any dependency
 * or modifying `package.json` / `tsconfig.json`. Trivially portable to
 * vitest/jest by replacing the local `test()` / `runAll()` helpers.
 */

import { strict as assert } from 'node:assert';
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
// Helpers — deep object inspection (mirrors strip.test.ts)
// -----------------------------------------------------------------------------

/** Recursively walk an object and assert no key with the given name appears. */
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

// -----------------------------------------------------------------------------
// Deterministic input builders — one per scenario
// -----------------------------------------------------------------------------

/** Fixed clock anchor used by all builders for deterministic timestamps. */
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
    surface: 'simple_search', // StubSurface narrows LargoSurface to two values
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

/** Returns a new fresh input for every builder call. */
const allBuilders: Array<() => StubLargoAdviceInput> = [
  buildBuyNowInput,
  buildWaitInput,
  buildAbstainRouteUnknownInput,
  buildAbstainProviderUnavailableInput,
  buildProviderDisagreementInput,
  buildMlUnavailableInput,
];

// -----------------------------------------------------------------------------
// Test cases (numbered to match the prompt's TEST REQUIREMENTS section)
// -----------------------------------------------------------------------------

// 1. produces a LargoAdvice with schema_version "0.1.0".
test('produces a LargoAdvice with schema_version "0.1.0"', () => {
  for (const build of allBuilders) {
    const advice = produceStubLargoAdvice(build());
    assert.strictEqual(advice.schema_version, '0.1.0');
  }
});

// 2. produces deterministic output for same input.
test('is deterministic for same input (deep equality)', () => {
  for (const build of allBuilders) {
    const input = build();
    const a = produceStubLargoAdvice(input);
    const b = produceStubLargoAdvice(input);
    assert.deepStrictEqual(a, b);
    // Output is a fresh object (no shared reference).
    assert.notStrictEqual(a, b);
  }
});

// 3. does not mutate input.
test('does not mutate the input', () => {
  for (const build of allBuilders) {
    const input = build();
    const snapshot = JSON.parse(JSON.stringify(input));
    produceStubLargoAdvice(input);
    assert.deepStrictEqual(input, snapshot);
  }
});

// 4. produces BUY_NOW scenario when safe input says good price.
test('produces BUY_NOW for safe good-price scenario', () => {
  const advice = produceStubLargoAdvice(buildBuyNowInput());
  assert.strictEqual(advice.action, 'BUY_NOW');
});

// 5. BUY_NOW scenario still has can_autobuy false.
test('BUY_NOW scenario keeps can_autobuy false', () => {
  const advice = produceStubLargoAdvice(buildBuyNowInput());
  assert.strictEqual(advice.action, 'BUY_NOW');
  assert.strictEqual(advice.can_autobuy, false);
});

// 6. produces WAIT scenario for high price.
test('produces WAIT for high-price scenario', () => {
  const advice = produceStubLargoAdvice(buildWaitInput());
  assert.strictEqual(advice.action, 'WAIT');
});

// 7. route unknown produces ABSTAIN.
test('route unknown produces ABSTAIN', () => {
  const advice = produceStubLargoAdvice(buildAbstainRouteUnknownInput());
  assert.strictEqual(advice.action, 'ABSTAIN');
});

// 8. provider unavailable produces ABSTAIN.
test('provider unavailable produces ABSTAIN', () => {
  const advice = produceStubLargoAdvice(buildAbstainProviderUnavailableInput());
  assert.strictEqual(advice.action, 'ABSTAIN');
});

// 9. null observed_price_usd remains null.
test('null observed_price_usd remains null', () => {
  const advice = produceStubLargoAdvice(buildAbstainProviderUnavailableInput());
  assert.strictEqual(advice.price_observation.observed_price_usd, null);
});

// 10. null provider remains null.
test('null primary_provider remains null', () => {
  const advice = produceStubLargoAdvice(buildAbstainProviderUnavailableInput());
  assert.strictEqual(advice.provider_info.primary_provider, null);
});

// 11. null price is never coerced to 0.
test('null price is never coerced to 0 (defense in depth)', () => {
  const advice = produceStubLargoAdvice(buildAbstainProviderUnavailableInput());
  const price = advice.price_observation;
  assert.strictEqual(price.observed_price_usd, null);
  assert.notStrictEqual(price.observed_price_usd, 0);
  assert.strictEqual(price.observed_price_original, null);
  assert.strictEqual(price.fx_rate_to_usd, null);
  assert.strictEqual(price.fx_observed_at, null);
  assert.notStrictEqual(typeof price.observed_price_usd, 'number');
});

// 12. provider null is never invented.
test('null provider is never invented as a placeholder string', () => {
  const advice = produceStubLargoAdvice(buildAbstainProviderUnavailableInput());
  assert.strictEqual(advice.provider_info.primary_provider, null);
  assert.notStrictEqual(advice.provider_info.primary_provider, '');
  assert.notStrictEqual(advice.provider_info.primary_provider, 'unknown');
  assert.notStrictEqual(typeof advice.provider_info.primary_provider, 'string');
});

// 13. provider disagreement never produces BUY_NOW.
test('provider disagreement never produces BUY_NOW', () => {
  const advice = produceStubLargoAdvice(buildProviderDisagreementInput());
  assert.notStrictEqual(advice.action, 'BUY_NOW');
  assert.ok(
    advice.action === 'WAIT' || advice.action === 'ABSTAIN',
    `expected WAIT or ABSTAIN under provider disagreement, got ${advice.action}`,
  );
});

// 14. provider disagreement strips to semantic disagreement summary only.
test('provider disagreement strips to semantic summary only (no raw %)', () => {
  const advice = produceStubLargoAdvice(buildProviderDisagreementInput());
  const stripped = stripToCustomerSafe(advice);
  assert.strictEqual(
    stripped.provider_info.disagreement_summary,
    'disagree',
    'disagreement_summary must be "disagree" when provider_disagreement is true',
  );
  assertNoKeyAnywhere(stripped, 'cross_check_disagreement_pct');
  assertNoKeyAnywhere(stripped, 'cross_check_provider');
  assertNoKeyAnywhere(stripped, 'cross_check_offer_id');
  assertNoKeyAnywhere(stripped, 'primary_provider_offer_id');
});

// 15. ml unavailable does not fake high calibrated confidence.
test('ml unavailable does not fake high calibrated confidence', () => {
  const advice = produceStubLargoAdvice(buildMlUnavailableInput());
  assert.strictEqual(advice.ml_available, false);
  assert.strictEqual(
    advice.numeric_value,
    null,
    'numeric_value must be null when ml_available is false',
  );
  assert.notStrictEqual(
    advice.confidence_label,
    'high',
    'confidence_label must not be "high" when ml is unavailable',
  );
});

// 16. expired advice preserves valid_until exactly.
test('expired advice preserves valid_until exactly', () => {
  const past = '2026-04-20T16:00:00.000Z';
  const input = buildBuyNowInput();
  input.valid_until_iso = past;
  const advice = produceStubLargoAdvice(input);
  assert.strictEqual(advice.valid_until, past);
  // Producer must NOT silently change action because of expiration.
  assert.strictEqual(advice.action, 'BUY_NOW');
});

// 17. output can be passed to stripToCustomerSafe.
test('output is accepted by stripToCustomerSafe (every scenario)', () => {
  for (const build of allBuilders) {
    const advice = produceStubLargoAdvice(build());
    const stripped = stripToCustomerSafe(advice);
    assert.strictEqual(stripped.schema_version, '0.1.0');
    assert.strictEqual(stripped.advice_id, advice.advice_id);
  }
});

// 18. stripped output never exposes numeric_value.
test('stripped output never exposes numeric_value (every scenario)', () => {
  for (const build of allBuilders) {
    const advice = produceStubLargoAdvice(build());
    const stripped = stripToCustomerSafe(advice) as unknown as Record<
      string,
      unknown
    >;
    assert.strictEqual('numeric_value' in stripped, false);
    assertNoKeyAnywhere(stripped, 'numeric_value');
  }
});

// 19. stripped output never exposes technical_details.
test('stripped output never exposes technical_details (every scenario)', () => {
  for (const build of allBuilders) {
    const advice = produceStubLargoAdvice(build());
    const stripped = stripToCustomerSafe(advice) as unknown as Record<
      string,
      unknown
    >;
    assert.strictEqual('technical_details' in stripped, false);
    assertNoKeyAnywhere(stripped, 'technical_details');
    assertNoKeyAnywhere(stripped, 'model_version');
    assertNoKeyAnywhere(stripped, 'q10');
    assertNoKeyAnywhere(stripped, 'q50');
    assertNoKeyAnywhere(stripped, 'q90');
    assertNoKeyAnywhere(stripped, 'fallback_reason');
    assertNoKeyAnywhere(stripped, 'cross_check_price');
  }
});

// 20. stripped output never exposes audit_block.
test('stripped output never exposes audit_block (every scenario)', () => {
  for (const build of allBuilders) {
    const advice = produceStubLargoAdvice(build());
    const stripped = stripToCustomerSafe(advice) as unknown as Record<
      string,
      unknown
    >;
    assert.strictEqual('audit_block' in stripped, false);
    assertNoKeyAnywhere(stripped, 'audit_block');
    assertNoKeyAnywhere(stripped, 'audit_id');
    assertNoKeyAnywhere(stripped, 'parent_advice_id');
  }
});

// 21. stripped output preserves action.
test('stripped output preserves action (every scenario)', () => {
  for (const build of allBuilders) {
    const advice = produceStubLargoAdvice(build());
    const stripped = stripToCustomerSafe(advice);
    assert.strictEqual(stripped.action, advice.action);
  }
});

// 22. stripped output preserves ABSTAIN.
test('stripped output preserves ABSTAIN as a first-class action', () => {
  const abstainBuilders = [
    buildAbstainRouteUnknownInput,
    buildAbstainProviderUnavailableInput,
  ];
  for (const build of abstainBuilders) {
    const stripped = stripToCustomerSafe(produceStubLargoAdvice(build()));
    assert.strictEqual(stripped.action, 'ABSTAIN');
    assert.strictEqual(stripped.confidence_label, 'unavailable');
  }
});

// 23. stripped output preserves null observed_price_usd.
test('stripped output preserves null observed_price_usd', () => {
  const stripped = stripToCustomerSafe(
    produceStubLargoAdvice(buildAbstainProviderUnavailableInput()),
  );
  assert.strictEqual(stripped.price_observation.observed_price_usd, null);
});

// 24. stripped output preserves null primary_provider.
test('stripped output preserves null primary_provider', () => {
  const stripped = stripToCustomerSafe(
    produceStubLargoAdvice(buildAbstainProviderUnavailableInput()),
  );
  assert.strictEqual(stripped.provider_info.primary_provider, null);
});

// 25. no scenario returns can_autobuy true.
test('can_autobuy is always false (Phase 1 anchor) — every scenario', () => {
  for (const build of allBuilders) {
    const advice = produceStubLargoAdvice(build());
    assert.strictEqual(
      advice.can_autobuy,
      false,
      `scenario ${build().scenario ?? 'default'} must keep can_autobuy=false`,
    );
  }
});

// -----------------------------------------------------------------------------
// Bonus tests — additional invariants and sanity checks
// -----------------------------------------------------------------------------

// (B1) — generated_at exactly mirrors input.now_iso.
test('generated_at exactly mirrors input.now_iso', () => {
  for (const build of allBuilders) {
    const input = build();
    const advice = produceStubLargoAdvice(input);
    assert.strictEqual(advice.generated_at, input.now_iso);
  }
});

// (B2) — valid_until defaults to now_iso + 6h when not pinned.
test('valid_until defaults to now_iso + 6h when not pinned', () => {
  const input = buildBuyNowInput();
  // buildBuyNowInput() does not pin valid_until_iso.
  const advice = produceStubLargoAdvice(input);
  const expected = new Date(
    new Date(NOW_ISO).getTime() + 6 * 60 * 60 * 1000,
  ).toISOString();
  assert.strictEqual(advice.valid_until, expected);
});

// (B3) — advice_id passes through when supplied.
test('advice_id passes through when supplied by caller', () => {
  const input = buildBuyNowInput();
  input.advice_id = 'STUB-explicit-id-12345';
  const advice = produceStubLargoAdvice(input);
  assert.strictEqual(advice.advice_id, 'STUB-explicit-id-12345');
  // Phase 1 invariant: audit_id === advice_id.
  assert.strictEqual(advice.audit_block?.audit_id, advice.advice_id);
});

// (B4) — derived advice_id is deterministic and tagged.
test('derived advice_id is deterministic and tagged "STUB-"', () => {
  const a = produceStubLargoAdvice(buildBuyNowInput());
  const b = produceStubLargoAdvice(buildBuyNowInput());
  assert.strictEqual(a.advice_id, b.advice_id);
  assert.ok(
    a.advice_id.startsWith('STUB-'),
    `advice_id must be tagged STUB-, got ${a.advice_id}`,
  );
});

// (B5) — surface mapping: 'mission' → 'mission_scan'.
test('surface "mission" maps to "mission_scan"', () => {
  const advice = produceStubLargoAdvice(buildWaitInput());
  assert.strictEqual(advice.surface, 'mission_scan');
});

// (B6) — surface mapping: 'simple_search' stays 'simple_search'.
test('surface "simple_search" stays "simple_search"', () => {
  const advice = produceStubLargoAdvice(buildBuyNowInput());
  assert.strictEqual(advice.surface, 'simple_search');
});

// (B7) — confidence_label semantic mapping is consistent.
test('confidence_label semantic mapping per scenario', () => {
  assert.strictEqual(
    produceStubLargoAdvice(buildBuyNowInput()).confidence_label,
    'high',
  );
  assert.strictEqual(
    produceStubLargoAdvice(buildWaitInput()).confidence_label,
    'moderate',
  );
  assert.strictEqual(
    produceStubLargoAdvice(buildAbstainRouteUnknownInput()).confidence_label,
    'unavailable',
  );
  assert.strictEqual(
    produceStubLargoAdvice(buildAbstainProviderUnavailableInput())
      .confidence_label,
    'unavailable',
  );
  assert.strictEqual(
    produceStubLargoAdvice(buildProviderDisagreementInput()).confidence_label,
    'limited',
  );
  assert.strictEqual(
    produceStubLargoAdvice(buildMlUnavailableInput()).confidence_label,
    'limited',
  );
});

// (B8) — product_type === 'flight' (Phase 1 = flights only).
test('product_type is always "flight" (Phase 1 = flights only)', () => {
  for (const build of allBuilders) {
    const advice = produceStubLargoAdvice(build());
    assert.strictEqual(advice.product_type, 'flight');
    assert.strictEqual(advice.product_specific.product_type, 'flight');
  }
});

// (B9) — bundle_context is null in flight stub.
test('bundle_context is null for flight stub', () => {
  for (const build of allBuilders) {
    const advice = produceStubLargoAdvice(build());
    assert.strictEqual(advice.bundle_context, null);
  }
});

// (B10) — audit_block.audit_id === advice_id (Phase 1 invariant).
test('audit_block.audit_id equals advice_id (Phase 1 invariant)', () => {
  for (const build of allBuilders) {
    const advice = produceStubLargoAdvice(build());
    assert.ok(advice.audit_block, 'audit_block must be present in stub output');
    assert.strictEqual(advice.audit_block!.audit_id, advice.advice_id);
    assert.strictEqual(advice.audit_block!.parent_advice_id, null);
  }
});

// (B11) — disagreement_summary is "agree" / "unknown" / "disagree" per signal.
test('disagreement_summary distinguishes agree / unknown / disagree', () => {
  // BUY_NOW: provider info has no cross_check_disagreement_pct? In the stub,
  // disagreement is false, so cross_check_disagreement_pct is null → 'unknown'.
  // (The strip rule maps null cross_check_disagreement_pct to 'unknown'.)
  const buyNowStripped = stripToCustomerSafe(
    produceStubLargoAdvice(buildBuyNowInput()),
  );
  assert.strictEqual(
    buyNowStripped.provider_info.disagreement_summary,
    'unknown',
  );

  const disagreeStripped = stripToCustomerSafe(
    produceStubLargoAdvice(buildProviderDisagreementInput()),
  );
  assert.strictEqual(
    disagreeStripped.provider_info.disagreement_summary,
    'disagree',
  );
});

// (B12) — short_message is non-empty for every scenario.
test('short_message is non-empty for every scenario', () => {
  for (const build of allBuilders) {
    const advice = produceStubLargoAdvice(build());
    assert.ok(
      typeof advice.short_message === 'string' &&
        advice.short_message.length > 0,
      `scenario ${build().scenario ?? 'default'} must produce a non-empty short_message`,
    );
  }
});

// (B13) — reasons[] is non-empty for every scenario.
test('reasons[] is non-empty for every scenario', () => {
  for (const build of allBuilders) {
    const advice = produceStubLargoAdvice(build());
    assert.ok(
      Array.isArray(advice.reasons) && advice.reasons.length >= 1,
      `scenario ${build().scenario ?? 'default'} must produce at least one reason`,
    );
    for (const reason of advice.reasons) {
      assert.ok(typeof reason.code === 'string' && reason.code.length > 0);
      assert.ok(typeof reason.message === 'string' && reason.message.length > 0);
    }
  }
});

// (B14) — comparison_anchor is null for ABSTAIN; populated otherwise (when price exists).
test('comparison_anchor is null for ABSTAIN; populated for BUY_NOW/WAIT', () => {
  const abstain1 = produceStubLargoAdvice(buildAbstainRouteUnknownInput());
  const abstain2 = produceStubLargoAdvice(buildAbstainProviderUnavailableInput());
  assert.strictEqual(abstain1.comparison_anchor, null);
  assert.strictEqual(abstain2.comparison_anchor, null);

  const buyNow = produceStubLargoAdvice(buildBuyNowInput());
  const wait = produceStubLargoAdvice(buildWaitInput());
  assert.notStrictEqual(buyNow.comparison_anchor, null);
  assert.notStrictEqual(wait.comparison_anchor, null);
});

// (B15) — ml_available defaults to true when omitted.
test('ml_available defaults to true when not specified', () => {
  const input = buildBuyNowInput();
  delete input.ml_available;
  const advice = produceStubLargoAdvice(input);
  assert.strictEqual(advice.ml_available, true);
});

// (B16) — provider_disagreement defaults to false when omitted.
test('provider_disagreement defaults to false (no fake disagreement)', () => {
  const input = buildBuyNowInput();
  delete input.provider_disagreement;
  const advice = produceStubLargoAdvice(input);
  assert.strictEqual(advice.provider_info.cross_check_provider, null);
  assert.strictEqual(advice.provider_info.cross_check_offer_id, null);
  assert.strictEqual(advice.provider_info.cross_check_disagreement_pct, null);
});

// -----------------------------------------------------------------------------
// Self-running entry point (no test runner installed; see file header)
// -----------------------------------------------------------------------------

runAll();
