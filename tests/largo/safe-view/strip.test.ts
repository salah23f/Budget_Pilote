/**
 * Largo — `stripToCustomerSafe` unit tests (Sprint 1, B1).
 *
 * Verifies the customer-safe view strip rule per:
 *  - `docs/b0/LARGO_BACKEND_API_SPEC.md` §10 (canonical strip table).
 *  - `docs/b0/LARGO_ADVICE_CONTRACT.md` §3, §4, §10, §17, §20 (forbidden patterns).
 *  - `docs/b0/LARGO_FRONTEND_UX_SPEC.md` §4, §41 row 1, 6, 7 (forbidden UI patterns).
 *  - `docs/b1/B1_IMPLEMENTATION_PLAN.md` §19 (the 15 required test cases).
 *  - `docs/b1/CLAUDE_CODE_RULES.md` §11, §12 (no numeric/technical_details
 *    in customer UI).
 *
 * Test runner: this file uses `node:assert/strict` and a tiny self-running
 * harness so it executes via `npx tsx tests/largo/safe-view/strip.test.ts`
 * without adding any dependency or modifying `package.json` / `tsconfig.json`.
 * It is also trivially portable to vitest/jest by replacing the `test()` and
 * `runAll()` helpers with the runner's `test`/`it` and removing `runAll()`.
 */

import { strict as assert } from 'node:assert';
import { stripToCustomerSafe, __internal } from '@/lib/largo/safe-view/strip';
import type {
  LargoAdvice,
  LargoAdviceAction,
  LargoConfidenceLabel,
} from '@/types/largo/advice';
import type { CustomerSafeAdvice } from '@/types/largo/customer-safe-advice';
import {
  fixtureBuyNowHighConfidence,
  fixtureWaitModerate,
  fixtureAbstainRouteUnknown,
  fixtureAbstainProviderUnavailable,
  fixtureProviderDisagreement,
  fixtureExpiredAdvice,
  fixtureMlUnavailable,
  allFixtures,
} from '@/tests/largo/fixtures/largo-advice.fixture';

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
// Helpers — deep object inspection without relying on a specific runner
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

/** Type-level assertion: the strip output is not assignable to LargoAdvice. */
function assertCustomerSafeStructure(
  output: CustomerSafeAdvice,
): void {
  // Compile-time guard: each field below must exist on CustomerSafeAdvice.
  // (Runtime presence is asserted by individual tests; these reads ensure the
  // type still resolves.)
  void output.schema_version;
  void output.advice_id;
  void output.action;
  void output.confidence_label;
  void output.product_type;
  void output.price_observation;
  void output.provider_info;
  void output.reasons;
  void output.short_message;
  void output.can_autobuy;
  void output.ml_available;
}

// -----------------------------------------------------------------------------
// Test cases — covering `B1_IMPLEMENTATION_PLAN.md` §19 + Sprint 1 prompt §"TESTS"
// -----------------------------------------------------------------------------

// 1. Strips numeric_value (= confidence.numeric_value in API spec prose).
test('strips numeric_value (admin-only confidence)', () => {
  const stripped = stripToCustomerSafe(fixtureBuyNowHighConfidence) as unknown as Record<
    string,
    unknown
  >;
  assert.strictEqual(
    'numeric_value' in stripped,
    false,
    'numeric_value must not be present in customer-safe output',
  );
  assertNoKeyAnywhere(stripped, 'numeric_value');
});

// 2. Strips technical_details (= messages.technical_details in API spec prose).
test('strips technical_details (admin-only)', () => {
  const stripped = stripToCustomerSafe(fixtureBuyNowHighConfidence) as unknown as Record<
    string,
    unknown
  >;
  assert.strictEqual(
    'technical_details' in stripped,
    false,
    'technical_details must not be present in customer-safe output',
  );
  assertNoKeyAnywhere(stripped, 'technical_details');
});

// 3. Strips model_version (lives inside technical_details — covered by #2).
test('strips model_version (lives inside technical_details)', () => {
  const stripped = stripToCustomerSafe(fixtureBuyNowHighConfidence);
  assertNoKeyAnywhere(stripped, 'model_version');
});

// 4. Strips internal audit fields (audit_block envelope).
test('strips audit_block (internal audit envelope)', () => {
  const stripped = stripToCustomerSafe(fixtureBuyNowHighConfidence) as unknown as Record<
    string,
    unknown
  >;
  assert.strictEqual(
    'audit_block' in stripped,
    false,
    'audit_block must not be present in customer-safe output',
  );
  assertNoKeyAnywhere(stripped, 'audit_block');
  assertNoKeyAnywhere(stripped, 'audit_id');
  assertNoKeyAnywhere(stripped, 'parent_advice_id');
});

// 5. Preserves action.
test('preserves action field', () => {
  const stripped = stripToCustomerSafe(fixtureBuyNowHighConfidence);
  assert.strictEqual(stripped.action, 'BUY_NOW');
  const wait = stripToCustomerSafe(fixtureWaitModerate);
  assert.strictEqual(wait.action, 'WAIT');
});

// 6. Preserves ABSTAIN as a first-class action.
test('preserves ABSTAIN as a first-class action', () => {
  const strippedRouteUnknown = stripToCustomerSafe(fixtureAbstainRouteUnknown);
  assert.strictEqual(strippedRouteUnknown.action, 'ABSTAIN');
  const strippedNoPrice = stripToCustomerSafe(fixtureAbstainProviderUnavailable);
  assert.strictEqual(strippedNoPrice.action, 'ABSTAIN');
});

// 7. Preserves valid_until (drives the expiry indicator on AdviceCard).
test('preserves valid_until exactly', () => {
  for (const advice of Object.values(allFixtures)) {
    const stripped = stripToCustomerSafe(advice);
    assert.strictEqual(stripped.valid_until, advice.valid_until);
  }
});

// 8. Preserves semantic confidence_label (HIGH / MODERATE / LIMITED / UNAVAILABLE).
test('preserves semantic confidence_label', () => {
  const labels: Record<string, LargoConfidenceLabel> = {
    buyNow: stripToCustomerSafe(fixtureBuyNowHighConfidence).confidence_label,
    wait: stripToCustomerSafe(fixtureWaitModerate).confidence_label,
    abstainRoute: stripToCustomerSafe(fixtureAbstainRouteUnknown).confidence_label,
    abstainNoPrice: stripToCustomerSafe(fixtureAbstainProviderUnavailable)
      .confidence_label,
    disagreement: stripToCustomerSafe(fixtureProviderDisagreement).confidence_label,
    mlUnavailable: stripToCustomerSafe(fixtureMlUnavailable).confidence_label,
  };
  assert.strictEqual(labels.buyNow, 'high');
  assert.strictEqual(labels.wait, 'moderate');
  assert.strictEqual(labels.abstainRoute, 'unavailable');
  assert.strictEqual(labels.abstainNoPrice, 'unavailable');
  assert.strictEqual(labels.disagreement, 'limited');
  assert.strictEqual(labels.mlUnavailable, 'limited');
});

// 9. Preserves observed_price_usd === null exactly (no coercion to 0).
test('preserves observed_price_usd: null (forbidden to coerce to 0)', () => {
  const stripped = stripToCustomerSafe(fixtureAbstainProviderUnavailable);
  assert.strictEqual(stripped.price_observation.observed_price_usd, null);
  // Defense in depth: also check we did not write 0 or ''.
  assert.notStrictEqual(stripped.price_observation.observed_price_usd, 0);
  assert.notStrictEqual(
    typeof stripped.price_observation.observed_price_usd,
    'undefined',
  );
});

// 10. Does not convert null price to 0 anywhere in the price observation.
test('does not convert any null price field to 0', () => {
  const stripped = stripToCustomerSafe(fixtureAbstainProviderUnavailable);
  const price = stripped.price_observation;
  assert.strictEqual(price.observed_price_usd, null);
  assert.strictEqual(price.observed_currency_original, null);
  assert.strictEqual(price.observed_price_original, null);
  assert.strictEqual(price.fx_rate_to_usd, null);
  assert.strictEqual(price.fx_observed_at, null);
  assert.strictEqual(price.price_missing_reason, 'provider_timeout');
});

// 11. Preserves nullable provider as null (never coerces).
test('preserves provider_info.primary_provider: null', () => {
  const stripped = stripToCustomerSafe(fixtureAbstainProviderUnavailable);
  assert.strictEqual(stripped.provider_info.primary_provider, null);
});

// 12. Does not invent a provider when the source is null.
test('does not invent a provider when null', () => {
  const stripped = stripToCustomerSafe(fixtureAbstainProviderUnavailable);
  assert.notStrictEqual(stripped.provider_info.primary_provider, 'unknown');
  assert.notStrictEqual(stripped.provider_info.primary_provider, '');
  assert.notStrictEqual(typeof stripped.provider_info.primary_provider, 'string');
});

// 13. Handles provider disagreement safely (semantic summary, no raw %).
test('summarizes provider disagreement, never exposes raw cross_check_disagreement_pct', () => {
  const strippedDisagree = stripToCustomerSafe(fixtureProviderDisagreement);
  assert.strictEqual(
    strippedDisagree.provider_info.disagreement_summary,
    'disagree',
  );
  assertNoKeyAnywhere(strippedDisagree, 'cross_check_disagreement_pct');
  assertNoKeyAnywhere(strippedDisagree, 'cross_check_provider');
  assertNoKeyAnywhere(strippedDisagree, 'cross_check_offer_id');
  assertNoKeyAnywhere(strippedDisagree, 'primary_provider_offer_id');

  const strippedAgree = stripToCustomerSafe(fixtureBuyNowHighConfidence);
  assert.strictEqual(
    strippedAgree.provider_info.disagreement_summary,
    'agree',
  );

  const strippedUnknown = stripToCustomerSafe(fixtureWaitModerate);
  assert.strictEqual(
    strippedUnknown.provider_info.disagreement_summary,
    'unknown',
    'cross_check_disagreement_pct === null must summarize as "unknown"',
  );
});

// 14. Does not mutate the input advice (purity).
test('does not mutate the input advice', () => {
  const snapshot = JSON.parse(
    JSON.stringify(fixtureBuyNowHighConfidence),
  ) as LargoAdvice;
  stripToCustomerSafe(fixtureBuyNowHighConfidence);
  assert.deepStrictEqual(
    fixtureBuyNowHighConfidence,
    snapshot,
    'stripToCustomerSafe must not mutate its input',
  );
});

// 15. Deterministic: same input → equal outputs (deep equality).
test('is deterministic for same input (deep equality)', () => {
  const a = stripToCustomerSafe(fixtureBuyNowHighConfidence);
  const b = stripToCustomerSafe(fixtureBuyNowHighConfidence);
  assert.deepStrictEqual(a, b);
  // Output is also a fresh object (no shared reference).
  assert.notStrictEqual(a, b);
  assert.notStrictEqual(a.price_observation, b.price_observation);
});

// 16. Does not expose raw model/conformal internals (q10/q50/q90, conformal_*).
test('does not expose raw model or conformal internals', () => {
  for (const advice of Object.values(allFixtures)) {
    const stripped = stripToCustomerSafe(advice);
    assertNoKeyAnywhere(stripped, 'q10');
    assertNoKeyAnywhere(stripped, 'q50');
    assertNoKeyAnywhere(stripped, 'q90');
    assertNoKeyAnywhere(stripped, 'conformal_half_width');
    assertNoKeyAnywhere(stripped, 'gates_passed');
    assertNoKeyAnywhere(stripped, 'fallback_reason');
    assertNoKeyAnywhere(stripped, 'attempted_providers');
    assertNoKeyAnywhere(stripped, 'last_error');
  }
});

// 17. Does not expose debug/admin fields (numeric_value, technical_details, audit_block).
test('does not expose any debug/admin field across all fixtures', () => {
  const adminOnlyKeys = [
    'numeric_value',
    'technical_details',
    'audit_block',
    'audit_id',
    'parent_advice_id',
    'cross_check_disagreement_pct',
    'cross_check_provider',
    'cross_check_offer_id',
    'primary_provider_offer_id',
  ];
  for (const advice of Object.values(allFixtures)) {
    const stripped = stripToCustomerSafe(advice);
    for (const key of adminOnlyKeys) {
      assertNoKeyAnywhere(stripped, key);
    }
  }
});

// 18. Keeps customer-facing messages (short_message + reasons[].message).
test('keeps customer-facing short_message and reasons array', () => {
  const stripped = stripToCustomerSafe(fixtureBuyNowHighConfidence);
  assert.strictEqual(
    stripped.short_message,
    fixtureBuyNowHighConfidence.short_message,
  );
  assert.strictEqual(stripped.reasons.length, 2);
  assert.strictEqual(stripped.reasons[0].code, 'price_below_p10');
  assert.strictEqual(stripped.reasons[0].severity, 'positive');
  assert.ok(stripped.reasons[0].message.length > 0);
});

// 19. Handles expired advice without changing action (the renderer handles expiry, not strip).
test('handles expired advice without changing action', () => {
  const stripped = stripToCustomerSafe(fixtureExpiredAdvice);
  assert.strictEqual(stripped.action, fixtureExpiredAdvice.action);
  assert.strictEqual(stripped.valid_until, fixtureExpiredAdvice.valid_until);
  // Expiry detection is a render-time concern; strip must not alter it.
  assertNoKeyAnywhere(stripped, 'expired');
  assertNoKeyAnywhere(stripped, 'is_expired');
});

// 20. Handles ML-unavailable advice without exposing internals.
test('handles ML unavailable without exposing internals', () => {
  const stripped = stripToCustomerSafe(fixtureMlUnavailable);
  assert.strictEqual(stripped.ml_available, false);
  assert.strictEqual(stripped.action, 'WAIT');
  assert.strictEqual(stripped.confidence_label, 'limited');
  assert.strictEqual(
    stripped.reasons[0].code,
    'ml_layer_unavailable',
    'customer-facing reason code preserved',
  );
  assertNoKeyAnywhere(stripped, 'fallback_reason');
  assertNoKeyAnywhere(stripped, 'numeric_value');
  assertNoKeyAnywhere(stripped, 'technical_details');
});

// -----------------------------------------------------------------------------
// Bonus tests — additional invariants from B1 plan §19 (cases 11, 12, 14, 15)
// -----------------------------------------------------------------------------

// (11) Preserves schema_version === '0.1.0'.
test('preserves schema_version === "0.1.0"', () => {
  for (const advice of Object.values(allFixtures)) {
    const stripped = stripToCustomerSafe(advice);
    assert.strictEqual(stripped.schema_version, '0.1.0');
  }
});

// (12) Idempotency on output domain — semantic equivalence under re-stripping.
//      `CustomerSafeAdvice.provider_info` is shaped differently from
//      `LargoAdvice.provider_info`, so we cannot literally feed the output
//      back; instead we verify that stripping the same input twice produces
//      structurally identical outputs.
test('semantic idempotency: strip(x) deep-equals strip(x) on every fixture', () => {
  for (const advice of Object.values(allFixtures)) {
    const a = stripToCustomerSafe(advice);
    const b = stripToCustomerSafe(advice);
    assert.deepStrictEqual(a, b);
  }
});

// (15) ABSTAIN fixtures preserve the action under all strip operations.
test('ABSTAIN survives stripping across all ABSTAIN fixtures', () => {
  const abstainFixtures = [
    fixtureAbstainRouteUnknown,
    fixtureAbstainProviderUnavailable,
  ];
  for (const advice of abstainFixtures) {
    const stripped = stripToCustomerSafe(advice);
    const action: LargoAdviceAction = stripped.action;
    assert.strictEqual(action, 'ABSTAIN');
    assert.strictEqual(stripped.confidence_label, 'unavailable');
  }
});

// Type-shape sanity: the strip output is structurally a CustomerSafeAdvice
// and not a LargoAdvice (admin fields cannot type-leak).
test('strip output is structurally a CustomerSafeAdvice', () => {
  const stripped = stripToCustomerSafe(fixtureBuyNowHighConfidence);
  assertCustomerSafeStructure(stripped);
  // No `numeric_value` property at compile time on the inferred type:
  // (this is verified by the type system at compile time; at runtime we
  // re-check that the property is absent.)
  assert.strictEqual(
    Object.prototype.hasOwnProperty.call(stripped, 'numeric_value'),
    false,
  );
  assert.strictEqual(
    Object.prototype.hasOwnProperty.call(stripped, 'technical_details'),
    false,
  );
  assert.strictEqual(
    Object.prototype.hasOwnProperty.call(stripped, 'audit_block'),
    false,
  );
});

// Internal helper exposure — `summarizeDisagreement` is exported under
// `__internal` for unit testing only.
test('__internal.summarizeDisagreement is consistent with the public strip', () => {
  const advice = fixtureProviderDisagreement;
  const direct = __internal.summarizeDisagreement(
    advice.provider_info,
    advice.reasons,
  );
  const viaStrip = stripToCustomerSafe(advice).provider_info.disagreement_summary;
  assert.strictEqual(direct, viaStrip);
});

// -----------------------------------------------------------------------------
// Self-running entry point (no test runner installed; see file header)
// -----------------------------------------------------------------------------

runAll();
