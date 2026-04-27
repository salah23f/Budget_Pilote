/**
 * Largo — extended fixtures unit tests (Sprint 2.1, B1).
 *
 * Validates the 13 fixtures in `largo-advice-extended.fixture.ts`:
 *  - each passes `validateLargoAdvice` (Sprint 1.3),
 *  - each survives `stripToCustomerSafe` (Sprint 1.1),
 *  - each respects every Phase 1 anchor,
 *  - per-fixture invariants (null price preserved, no fake provider,
 *    disagreement → 'disagree' summary, no fake confidence on ML unavailable,
 *    expired `valid_until` preserved through strip, etc.).
 *
 * Test runner: same self-running harness as `tests/largo/safe-view/strip.test.ts`,
 * `tests/largo/producer/stub.test.ts`, `tests/largo/validator/advice-validator.test.ts`.
 * Runs via:
 *
 *   npx tsx tests/largo/fixtures/largo-advice-extended.fixture.test.ts
 *
 * No dependency added; no `package.json` / `tsconfig.json` modified.
 */

import { strict as assert } from 'node:assert';
import { stripToCustomerSafe } from '@/lib/largo/safe-view/strip';
import { validateLargoAdvice } from '@/lib/largo/validator/advice-validator';
import {
  __internal,
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
// Helpers (mirrors strip.test.ts and stub.test.ts)
// -----------------------------------------------------------------------------

/** Recursively walk and assert no key with the given name appears. */
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
// Group A — Catalog sanity
// -----------------------------------------------------------------------------

test('exports exactly 13 extended fixtures (11 required + 2 bonus)', () => {
  assert.strictEqual(extendedLargoAdviceFixtures.length, 13);
});

test('extendedLargoAdviceFixtureByName has 13 entries with unique values', () => {
  const entries = Object.entries(extendedLargoAdviceFixtureByName);
  assert.strictEqual(entries.length, 13);
  // Every named fixture is also in the array.
  for (const [, fixture] of entries) {
    assert.ok(extendedLargoAdviceFixtures.includes(fixture));
  }
});

test('every fixture has a unique advice_id', () => {
  const ids = new Set<string>();
  for (const fixture of extendedLargoAdviceFixtures) {
    assert.ok(fixture.advice_id.length > 0);
    assert.ok(
      !ids.has(fixture.advice_id),
      `duplicate advice_id: ${fixture.advice_id}`,
    );
    ids.add(fixture.advice_id);
  }
});

// -----------------------------------------------------------------------------
// Group B — Universal invariants per fixture
// -----------------------------------------------------------------------------

test('every fixture has schema_version === "0.1.0"', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    assert.strictEqual(fixture.schema_version, '0.1.0');
  }
});

test('every fixture has product_type === "flight" (Phase 1)', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    assert.strictEqual(fixture.product_type, 'flight');
    assert.strictEqual(fixture.product_specific.product_type, 'flight');
  }
});

test('every fixture has can_autobuy === false (Phase 1)', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    assert.strictEqual(fixture.can_autobuy, false);
  }
});

test('every fixture has audit_block.audit_id === advice_id (Phase 1)', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    assert.ok(
      fixture.audit_block,
      `fixture ${fixture.advice_id} must include audit_block`,
    );
    assert.strictEqual(fixture.audit_block!.audit_id, fixture.advice_id);
    assert.strictEqual(fixture.audit_block!.parent_advice_id, null);
  }
});

test('every fixture passes validateLargoAdvice (ok=true, issues=[])', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const result = validateLargoAdvice(fixture);
    if (!result.ok) {
      const codes = result.issues
        .map((i) => `${i.path || '<root>'}:${i.code}`)
        .join('\n  ');
      assert.fail(
        `fixture ${fixture.advice_id} failed validation:\n  ${codes}`,
      );
    }
    assert.deepStrictEqual(result.issues, []);
  }
});

test('every fixture survives stripToCustomerSafe (no throw, schema preserved)', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const stripped = stripToCustomerSafe(fixture);
    assert.strictEqual(stripped.schema_version, '0.1.0');
    assert.strictEqual(stripped.advice_id, fixture.advice_id);
  }
});

// -----------------------------------------------------------------------------
// Group C — Stripped output never exposes admin fields (regression check)
// -----------------------------------------------------------------------------

test('stripped output never exposes numeric_value (every fixture)', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const stripped = stripToCustomerSafe(fixture) as unknown as Record<
      string,
      unknown
    >;
    assert.strictEqual('numeric_value' in stripped, false);
    assertNoKeyAnywhere(stripped, 'numeric_value');
  }
});

test('stripped output never exposes technical_details (every fixture)', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const stripped = stripToCustomerSafe(fixture) as unknown as Record<
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

test('stripped output never exposes audit_block (every fixture)', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const stripped = stripToCustomerSafe(fixture) as unknown as Record<
      string,
      unknown
    >;
    assert.strictEqual('audit_block' in stripped, false);
    assertNoKeyAnywhere(stripped, 'audit_block');
    assertNoKeyAnywhere(stripped, 'audit_id');
    assertNoKeyAnywhere(stripped, 'parent_advice_id');
  }
});

test('stripped provider_info never exposes raw cross_check_disagreement_pct', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const stripped = stripToCustomerSafe(fixture);
    assertNoKeyAnywhere(stripped, 'cross_check_disagreement_pct');
    assertNoKeyAnywhere(stripped, 'cross_check_provider');
    assertNoKeyAnywhere(stripped, 'cross_check_offer_id');
    assertNoKeyAnywhere(stripped, 'primary_provider_offer_id');
  }
});

// -----------------------------------------------------------------------------
// Group D — Action / confidence enum coverage
// -----------------------------------------------------------------------------

test('action enum coverage: BUY_NOW, WAIT, MONITOR, ALERT, ABSTAIN all represented', () => {
  const actions = new Set(extendedLargoAdviceFixtures.map((f) => f.action));
  assert.ok(actions.has('BUY_NOW'));
  assert.ok(actions.has('WAIT'));
  assert.ok(actions.has('MONITOR'));
  assert.ok(actions.has('ALERT'));
  assert.ok(actions.has('ABSTAIN'));
});

test('confidence_label coverage: high, moderate, limited, unavailable all represented', () => {
  const labels = new Set(
    extendedLargoAdviceFixtures.map((f) => f.confidence_label),
  );
  assert.ok(labels.has('high'));
  assert.ok(labels.has('moderate'));
  assert.ok(labels.has('limited'));
  assert.ok(labels.has('unavailable'));
});

test('surface coverage: simple_search, mission_scan, manual_check all represented', () => {
  const surfaces = new Set(extendedLargoAdviceFixtures.map((f) => f.surface));
  assert.ok(surfaces.has('simple_search'));
  assert.ok(surfaces.has('mission_scan'));
  assert.ok(surfaces.has('manual_check'));
});

// -----------------------------------------------------------------------------
// Group E — Per-fixture invariants
// -----------------------------------------------------------------------------

// 1. BUY_NOW high
test('fixtureExtendedBuyNowHigh: BUY_NOW + high + price/provider present', () => {
  const f = fixtureExtendedBuyNowHigh;
  assert.strictEqual(f.action, 'BUY_NOW');
  assert.strictEqual(f.confidence_label, 'high');
  assert.notStrictEqual(f.price_observation.observed_price_usd, null);
  assert.notStrictEqual(f.provider_info.primary_provider, null);
});

// 2. BUY_NOW moderate
test('fixtureExtendedBuyNowModerate: BUY_NOW + moderate + numeric_value 0.55', () => {
  const f = fixtureExtendedBuyNowModerate;
  assert.strictEqual(f.action, 'BUY_NOW');
  assert.strictEqual(f.confidence_label, 'moderate');
  assert.strictEqual(f.numeric_value, 0.55);
});

// 3. WAIT high price
test('fixtureExtendedWaitHighPrice: WAIT', () => {
  assert.strictEqual(fixtureExtendedWaitHighPrice.action, 'WAIT');
});

// 4. MONITOR
test('fixtureExtendedMonitor: MONITOR + awaiting_change_signal reason', () => {
  const f = fixtureExtendedMonitor;
  assert.strictEqual(f.action, 'MONITOR');
  assert.strictEqual(f.confidence_label, 'moderate');
  assert.ok(f.reasons.some((r) => r.code === 'awaiting_change_signal'));
});

// 5. ALERT
test('fixtureExtendedAlert: ALERT + meaningful_price_drop reason (positive)', () => {
  const f = fixtureExtendedAlert;
  assert.strictEqual(f.action, 'ALERT');
  const alertReason = f.reasons.find((r) => r.code === 'meaningful_price_drop');
  assert.ok(alertReason);
  assert.strictEqual(alertReason!.severity, 'positive');
});

// 6. ABSTAIN route unknown
test('fixtureExtendedAbstainRouteUnknown: ABSTAIN + unavailable + route_unknown reason', () => {
  const f = fixtureExtendedAbstainRouteUnknown;
  assert.strictEqual(f.action, 'ABSTAIN');
  assert.strictEqual(f.confidence_label, 'unavailable');
  assert.ok(f.reasons.some((r) => r.code === 'route_unknown_to_model'));
});

// 7. ABSTAIN provider unavailable — null price + null provider preserved
test('fixtureExtendedAbstainProviderUnavailable: null price + null provider preserved (no fake-zero, no fake-provider)', () => {
  const f = fixtureExtendedAbstainProviderUnavailable;
  assert.strictEqual(f.action, 'ABSTAIN');
  assert.strictEqual(f.price_observation.observed_price_usd, null);
  assert.notStrictEqual(f.price_observation.observed_price_usd, 0);
  assert.strictEqual(f.provider_info.primary_provider, null);
  assert.notStrictEqual(f.provider_info.primary_provider, '');
  assert.notStrictEqual(f.provider_info.primary_provider, 'unknown');
});

test('fixtureExtendedAbstainProviderUnavailable strips with null price preserved', () => {
  const stripped = stripToCustomerSafe(
    fixtureExtendedAbstainProviderUnavailable,
  );
  assert.strictEqual(stripped.price_observation.observed_price_usd, null);
  assert.strictEqual(stripped.provider_info.primary_provider, null);
});

// 8. Provider disagreement
test('fixtureExtendedProviderDisagreement: action != BUY_NOW + provider_disagreement reason', () => {
  const f = fixtureExtendedProviderDisagreement;
  assert.notStrictEqual(f.action, 'BUY_NOW');
  assert.ok(f.reasons.some((r) => r.code === 'provider_disagreement'));
});

test('fixtureExtendedProviderDisagreement strips to disagreement_summary === "disagree"', () => {
  const stripped = stripToCustomerSafe(fixtureExtendedProviderDisagreement);
  assert.strictEqual(stripped.provider_info.disagreement_summary, 'disagree');
  assertNoKeyAnywhere(stripped, 'cross_check_disagreement_pct');
});

// 9. Expired advice
test('fixtureExtendedExpiredAdvice: valid_until in the past, action preserved', () => {
  const f = fixtureExtendedExpiredAdvice;
  assert.strictEqual(f.valid_until, __internal.PAST_ISO);
  // Producer must NOT silently change action because of expiration.
  assert.strictEqual(f.action, 'BUY_NOW');
});

test('fixtureExtendedExpiredAdvice strips with valid_until preserved exactly', () => {
  const stripped = stripToCustomerSafe(fixtureExtendedExpiredAdvice);
  assert.strictEqual(stripped.valid_until, __internal.PAST_ISO);
});

// 10. ML unavailable
test('fixtureExtendedMlUnavailable: ml_available=false + numeric_value=null + label!=high', () => {
  const f = fixtureExtendedMlUnavailable;
  assert.strictEqual(f.ml_available, false);
  assert.strictEqual(f.numeric_value, null);
  assert.notStrictEqual(f.confidence_label, 'high');
});

test('fixtureExtendedMlUnavailable strips with no fake calibration leaked', () => {
  const stripped = stripToCustomerSafe(fixtureExtendedMlUnavailable) as unknown as Record<string, unknown>;
  assertNoKeyAnywhere(stripped, 'numeric_value');
  assertNoKeyAnywhere(stripped, 'fallback_reason');
  // Customer-facing reason must remain.
  const customerReasons = stripped.reasons as Array<{ code: string }>;
  assert.ok(customerReasons.some((r) => r.code === 'ml_layer_unavailable'));
});

// 11. Anonymous quota exceeded placeholder
test('fixtureExtendedAnonymousQuotaExceededPlaceholder: anonymous + simple_search + ABSTAIN + quota reason', () => {
  const f = fixtureExtendedAnonymousQuotaExceededPlaceholder;
  assert.strictEqual(f.user_id, null);
  assert.strictEqual(f.surface, 'simple_search');
  assert.strictEqual(f.action, 'ABSTAIN');
  assert.ok(f.reasons.some((r) => r.code === 'anonymous_quota_exceeded'));
  // Customer-facing prompt mentions sign-in.
  assert.ok(/sign in/i.test(f.short_message));
});

test('fixtureExtendedAnonymousQuotaExceededPlaceholder strips safely', () => {
  const stripped = stripToCustomerSafe(
    fixtureExtendedAnonymousQuotaExceededPlaceholder,
  );
  assert.strictEqual(stripped.action, 'ABSTAIN');
  assert.ok(
    stripped.reasons.some((r) => r.code === 'anonymous_quota_exceeded'),
  );
});

// 12. Manual check surface
test('fixtureExtendedManualCheck: surface === "manual_check"', () => {
  assert.strictEqual(fixtureExtendedManualCheck.surface, 'manual_check');
});

// 13. One-way flight
test('fixtureExtendedOneWayFlight: return_date null, is_round_trip false', () => {
  const f = fixtureExtendedOneWayFlight;
  assert.strictEqual(f.product_context.inbound_date, null);
  assert.strictEqual(f.product_specific.is_round_trip, false);
  assert.strictEqual(f.product_specific.inbound_duration_minutes, null);
});

// -----------------------------------------------------------------------------
// Group F — Constancy / non-mutation
// -----------------------------------------------------------------------------

test('every fixture is referentially identical when imported twice (module-level constants)', () => {
  // Re-importing in the same process should yield the same reference.
  // We can verify by re-reading from the by-name map and comparing.
  assert.strictEqual(
    extendedLargoAdviceFixtureByName.buyNowHigh,
    fixtureExtendedBuyNowHigh,
  );
  assert.strictEqual(
    extendedLargoAdviceFixtureByName.alert,
    fixtureExtendedAlert,
  );
});

test('validateLargoAdvice does not mutate fixtures', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const snapshot = JSON.parse(JSON.stringify(fixture));
    validateLargoAdvice(fixture);
    assert.deepStrictEqual(fixture, snapshot);
  }
});

test('stripToCustomerSafe does not mutate fixtures', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const snapshot = JSON.parse(JSON.stringify(fixture));
    stripToCustomerSafe(fixture);
    assert.deepStrictEqual(fixture, snapshot);
  }
});

// -----------------------------------------------------------------------------
// Group G — Round-trip pipeline (produce → validate → strip)
// -----------------------------------------------------------------------------

test('every fixture round-trips: validate(fixture).ok && strip(validated.value) succeeds', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const validated = validateLargoAdvice(fixture);
    assert.strictEqual(validated.ok, true);
    if (!validated.ok) continue;
    const stripped = stripToCustomerSafe(validated.value);
    // Sanity on the customer-safe shape.
    assert.strictEqual(stripped.schema_version, '0.1.0');
    assert.strictEqual(stripped.advice_id, fixture.advice_id);
    assert.strictEqual(stripped.action, fixture.action);
    assert.strictEqual(stripped.confidence_label, fixture.confidence_label);
  }
});

test('validate returns same-reference value (no clone) on every fixture', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const validated = validateLargoAdvice(fixture);
    assert.strictEqual(validated.ok, true);
    if (validated.ok) {
      assert.strictEqual(validated.value, fixture);
    }
  }
});

// -----------------------------------------------------------------------------
// Group H — Internal helper sanity
// -----------------------------------------------------------------------------

test('__internal.deepCloneAdvice produces a structurally equal but referentially distinct copy', () => {
  const cloned = __internal.deepCloneAdvice(fixtureExtendedBuyNowHigh);
  assert.notStrictEqual(cloned, fixtureExtendedBuyNowHigh);
  assert.deepStrictEqual(cloned, fixtureExtendedBuyNowHigh);
});

test('__internal.withOverrides keeps audit_block.audit_id === advice_id when advice_id is overridden', () => {
  const result = __internal.withOverrides(fixtureExtendedBuyNowHigh, {
    advice_id: 'STUB-test-overrides-sync-1',
  });
  assert.strictEqual(result.advice_id, 'STUB-test-overrides-sync-1');
  assert.ok(result.audit_block);
  assert.strictEqual(result.audit_block!.audit_id, 'STUB-test-overrides-sync-1');
});

test('__internal.withOverrides does not mutate the base', () => {
  const baseId = fixtureExtendedBuyNowHigh.advice_id;
  __internal.withOverrides(fixtureExtendedBuyNowHigh, {
    advice_id: 'STUB-test-mutation-check',
  });
  assert.strictEqual(fixtureExtendedBuyNowHigh.advice_id, baseId);
});

// -----------------------------------------------------------------------------
// Self-running entry point (no test runner installed; see file header)
// -----------------------------------------------------------------------------

runAll();
