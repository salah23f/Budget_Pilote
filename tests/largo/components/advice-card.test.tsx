/**
 * Largo — `LargoAdviceCard` unit tests (Sprint 3.1, B1).
 *
 * Verifies the customer-safe presentational component:
 *  - renders every extended fixture through the full pipeline
 *    (validate-largo → strip → validate-customer-safe → render),
 *  - produces deterministic HTML,
 *  - never leaks any of the 25 admin-only field names in either the
 *    rendered HTML or the component source file (defense in depth),
 *  - covers all 5 actions, 4 confidence labels, and 3 surfaces,
 *  - handles null price and null provider without coercion or invention,
 *  - preserves expired-advice action text unchanged,
 *  - keeps `compact` mode coherent (core action / route / price / provider
 *    / confidence / autobuy notice all present).
 *
 * Test runner: same self-running harness as the rest of `tests/largo/**`.
 *
 *   npx tsx tests/largo/components/advice-card.test.tsx
 *
 * No new dependency; no `package.json` / `tsconfig.json` modified. Uses
 * `react-dom/server.renderToStaticMarkup` (already a runtime dep) and
 * `node:fs.readFileSync` (node built-in) for the source-scan invariant.
 */

import { strict as assert } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// React must be in scope for JSX when this test runs via `npx tsx`.
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripToCustomerSafe } from '@/lib/largo/safe-view/strip';
import { validateLargoAdvice } from '@/lib/largo/validator/advice-validator';
import { validateCustomerSafeAdvice } from '@/lib/largo/validator/customer-safe-validator';
import {
  LargoAdviceCard,
  type LargoAdviceCardProps,
} from '@/components/largo/advice-card';
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

const FORBIDDEN_KEYS = [
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
] as const;

/**
 * Word-boundary regex per forbidden key. `\b` resolves the
 * "admin"-inside-"administrator" false-positive: regex word boundary
 * requires a transition between a `\w` (alphanumeric or underscore) and a
 * non-`\w` character, so `\binternal\b` does NOT match within
 * `internalize` or `internationalization`.
 */
function makeKeyRegex(key: string): RegExp {
  return new RegExp(`\\b${key}\\b`);
}

/** Run the full pipeline from a `LargoAdvice` fixture to `CustomerSafeAdvice`. */
function fullPipelineToCustomerSafe(advice: LargoAdvice): CustomerSafeAdvice {
  const validated = validateLargoAdvice(advice);
  if (!validated.ok) {
    const codes = validated.issues
      .map((i) => `${i.path || '<root>'}:${i.code}`)
      .join(', ');
    assert.fail(`fixture ${advice.advice_id} failed validateLargoAdvice: ${codes}`);
  }
  const stripped = stripToCustomerSafe(validated.value);
  const validatedCs = validateCustomerSafeAdvice(stripped);
  if (!validatedCs.ok) {
    const codes = validatedCs.issues
      .map((i) => `${i.path || '<root>'}:${i.code}`)
      .join(', ');
    assert.fail(
      `fixture ${advice.advice_id} failed validateCustomerSafeAdvice: ${codes}`,
    );
  }
  return validatedCs.value;
}

/** Render the component to a static HTML string. */
function renderCard(advice: CustomerSafeAdvice, compact = false): string {
  return renderToStaticMarkup(
    <LargoAdviceCard advice={advice} compact={compact} />,
  );
}

/**
 * Build a `CustomerSafeAdvice` from a fixture, ready to render.
 * Combines the pipeline + a legibility check.
 */
function safeFromFixture(fixture: LargoAdvice): CustomerSafeAdvice {
  return fullPipelineToCustomerSafe(fixture);
}

/** Read the component source file as text for the source-scan invariant. */
const COMPONENT_SOURCE = readFileSync(
  'components/largo/advice-card.tsx',
  'utf-8',
);

// -----------------------------------------------------------------------------
// Group A — Renders every fixture through the full pipeline
// -----------------------------------------------------------------------------

test('A1: renders all 13 extended fixtures without throwing', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const safe = safeFromFixture(fixture);
    assert.doesNotThrow(() => renderCard(safe));
    const html = renderCard(safe);
    assert.ok(html.length > 0);
    // Sanity: HTML starts with the component root tag.
    assert.ok(html.startsWith('<article'), `expected <article> root, got: ${html.slice(0, 60)}`);
  }
});

test('A1b: renders all 13 fixtures in compact mode without throwing', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const safe = safeFromFixture(fixture);
    assert.doesNotThrow(() => renderCard(safe, true));
  }
});

// -----------------------------------------------------------------------------
// Group B — Action / confidence / surface coverage
// -----------------------------------------------------------------------------

test('A2: BUY_NOW renders header "Good time to buy"', () => {
  const html = renderCard(safeFromFixture(fixtureExtendedBuyNowHigh));
  assert.ok(html.includes('Good time to buy'), html);
});

test('A2: WAIT renders header "Wait for now"', () => {
  const html = renderCard(safeFromFixture(fixtureExtendedWaitHighPrice));
  assert.ok(html.includes('Wait for now'), html);
});

test('A2: MONITOR renders header "Monitoring"', () => {
  const html = renderCard(safeFromFixture(fixtureExtendedMonitor));
  assert.ok(html.includes('Monitoring'), html);
});

test('A2: ALERT renders header "Price alert"', () => {
  const html = renderCard(safeFromFixture(fixtureExtendedAlert));
  assert.ok(html.includes('Price alert'), html);
});

test('A2: ABSTAIN renders header "Not enough reliable data"', () => {
  const html = renderCard(safeFromFixture(fixtureExtendedAbstainRouteUnknown));
  assert.ok(html.includes('Not enough reliable data'), html);
});

test('A3: confidence "high" renders semantic phrase only (no number)', () => {
  const html = renderCard(safeFromFixture(fixtureExtendedBuyNowHigh));
  assert.ok(html.includes('high confidence'));
  // No "0.78", no "78%", no "(0.78)" anywhere.
  assert.ok(!/0\.78/.test(html));
  assert.ok(!/78\s*%/.test(html));
});

test('A3: confidence "moderate" renders semantic phrase only', () => {
  const html = renderCard(safeFromFixture(fixtureExtendedBuyNowModerate));
  assert.ok(html.includes('moderate confidence'));
  assert.ok(!/0\.55/.test(html));
});

test('A3: confidence "limited" renders semantic phrase only', () => {
  const html = renderCard(safeFromFixture(fixtureExtendedMlUnavailable));
  assert.ok(html.includes('limited data'));
});

test('A3: confidence "unavailable" renders semantic phrase only', () => {
  const html = renderCard(safeFromFixture(fixtureExtendedAbstainRouteUnknown));
  assert.ok(html.includes('data unavailable'));
});

test('A4: surface "simple_search" appears in the header', () => {
  const html = renderCard(safeFromFixture(fixtureExtendedBuyNowHigh));
  assert.ok(html.includes('simple_search'));
});

test('A4: surface "mission_scan" appears in the header', () => {
  const html = renderCard(safeFromFixture(fixtureExtendedWaitHighPrice));
  assert.ok(html.includes('mission_scan'));
});

test('A4: surface "manual_check" appears in the header', () => {
  const html = renderCard(safeFromFixture(fixtureExtendedManualCheck));
  assert.ok(html.includes('manual_check'));
});

// -----------------------------------------------------------------------------
// Group C — Null preservation (no fake-zero, no fake-provider)
// -----------------------------------------------------------------------------

test('A5: null price renders "Price unavailable" and never "$0" / "0 USD"', () => {
  const html = renderCard(
    safeFromFixture(fixtureExtendedAbstainProviderUnavailable),
  );
  assert.ok(html.includes('Price unavailable'));
  assert.ok(!html.includes('$0'));
  assert.ok(!/\b0 USD\b/.test(html));
});

test('A6: null provider renders "Provider unavailable" and never invents a name', () => {
  const html = renderCard(
    safeFromFixture(fixtureExtendedAbstainProviderUnavailable),
  );
  assert.ok(html.includes('Provider unavailable'));
  // Common invented placeholders that must never appear.
  for (const invented of ['unknown provider', 'sky-scrapper', 'google-flights']) {
    assert.ok(
      !html.toLowerCase().includes(invented),
      `null-provider fixture must not invent "${invented}"`,
    );
  }
});

// -----------------------------------------------------------------------------
// Group D — Provider disagreement renders semantically (never raw %)
// -----------------------------------------------------------------------------

test('A7: provider disagreement renders "Provider checks disagree"', () => {
  const html = renderCard(safeFromFixture(fixtureExtendedProviderDisagreement));
  assert.ok(html.includes('Provider checks disagree'));
});

test('A7: provider disagreement HTML never renders a "%" character', () => {
  const html = renderCard(safeFromFixture(fixtureExtendedProviderDisagreement));
  // Conservative: no percent symbol anywhere in the rendered output.
  assert.ok(!html.includes('%'));
});

test('A7: provider disagreement HTML does not contain raw 0.142 / 14.2', () => {
  const html = renderCard(safeFromFixture(fixtureExtendedProviderDisagreement));
  assert.ok(!html.includes('0.142'));
  assert.ok(!html.includes('14.2'));
});

// -----------------------------------------------------------------------------
// Group E — ML unavailable: no numeric confidence, no model internals
// -----------------------------------------------------------------------------

test('A8: ML unavailable HTML does not include numeric confidence or model internals', () => {
  const html = renderCard(safeFromFixture(fixtureExtendedMlUnavailable));
  // No raw numeric calibration.
  assert.ok(!/0\.32/.test(html));
  assert.ok(!/0\.78/.test(html));
  // No model attribution leaked.
  for (const key of ['model_version', 'q10', 'q50', 'q90', 'fallback_reason']) {
    const re = makeKeyRegex(key);
    assert.ok(!re.test(html), `forbidden token "${key}" leaked in ML-unavailable HTML`);
  }
  // Customer-facing semantic phrase is present.
  assert.ok(html.includes('limited data'));
});

// -----------------------------------------------------------------------------
// Group F — Expired advice: action text preserved unchanged
// -----------------------------------------------------------------------------

test('A9: expired advice action text equals the original (component does not re-derive)', () => {
  const safe = safeFromFixture(fixtureExtendedExpiredAdvice);
  const html = renderCard(safe);
  // Expired BUY_NOW fixture should render the BUY_NOW header text.
  assert.strictEqual(safe.action, 'BUY_NOW');
  assert.ok(html.includes('Good time to buy'));
});

test('A9: expired advice valid_until ISO string is preserved verbatim', () => {
  const safe = safeFromFixture(fixtureExtendedExpiredAdvice);
  const html = renderCard(safe);
  assert.ok(html.includes(safe.valid_until));
});

// -----------------------------------------------------------------------------
// Group G — Anonymous quota placeholder
// -----------------------------------------------------------------------------

test('A10: anonymous quota fixture renders sign-in prompt text safely', () => {
  const safe = safeFromFixture(fixtureExtendedAnonymousQuotaExceededPlaceholder);
  const html = renderCard(safe);
  // Sign-in prompt comes from the fixture's short_message.
  assert.ok(/sign in/i.test(html), 'expected "Sign in" prompt text');
  // Reason code or its message is rendered.
  assert.ok(html.includes('quota'), 'expected "quota" word from the reason');
});

// -----------------------------------------------------------------------------
// Group H — One-way / round-trip layouts
// -----------------------------------------------------------------------------

test('A11: one-way flight renders "One-way" and not a return-date arrow on the date line', () => {
  const safe = safeFromFixture(fixtureExtendedOneWayFlight);
  const html = renderCard(safe);
  assert.ok(html.includes('One-way'));
  // Exactly one " → " arrow in the rendered HTML (the route line). The
  // round-trip layout would add a second arrow on the date line.
  const arrowCount = (html.match(/ → /g) ?? []).length;
  assert.strictEqual(
    arrowCount,
    1,
    `expected exactly one " → " for one-way, got ${arrowCount}`,
  );
});

test('A11: round-trip flight renders TWO arrows (route line + date line)', () => {
  const safe = safeFromFixture(fixtureExtendedBuyNowHigh);
  const html = renderCard(safe);
  const arrowCount = (html.match(/ → /g) ?? []).length;
  assert.strictEqual(arrowCount, 2);
});

// -----------------------------------------------------------------------------
// Group I — manual_check fixture renders without crash
// -----------------------------------------------------------------------------

test('A12: manual_check fixture renders without throwing', () => {
  assert.doesNotThrow(() => {
    renderCard(safeFromFixture(fixtureExtendedManualCheck));
  });
});

// -----------------------------------------------------------------------------
// Group J — Forbidden-key scan on RENDERED HTML (every fixture)
// -----------------------------------------------------------------------------

test('A13: rendered HTML never contains any of the 25 forbidden keys (every fixture)', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const html = renderCard(safeFromFixture(fixture));
    for (const key of FORBIDDEN_KEYS) {
      const re = makeKeyRegex(key);
      assert.ok(
        !re.test(html),
        `forbidden token "${key}" found in HTML for fixture ${fixture.advice_id}`,
      );
    }
  }
});

test('A13b: rendered HTML never contains any of the 25 forbidden keys (compact mode)', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const html = renderCard(safeFromFixture(fixture), true);
    for (const key of FORBIDDEN_KEYS) {
      const re = makeKeyRegex(key);
      assert.ok(
        !re.test(html),
        `forbidden token "${key}" found in compact HTML for fixture ${fixture.advice_id}`,
      );
    }
  }
});

// -----------------------------------------------------------------------------
// Group K — Forbidden-key scan on the COMPONENT SOURCE FILE (defense in depth)
// -----------------------------------------------------------------------------

test('K1: component source file does not contain any of the 25 forbidden keys as identifiers', () => {
  for (const key of FORBIDDEN_KEYS) {
    const re = makeKeyRegex(key);
    assert.ok(
      !re.test(COMPONENT_SOURCE),
      `forbidden token "${key}" found in component source — refactor required`,
    );
  }
});

test('K2: component source file does not import validators, strip, fixtures, or producer', () => {
  // Forbidden modules: validators, strip, fixtures, producer.
  const forbiddenImportPatterns = [
    /from\s+['"]@\/lib\/largo\/safe-view\/strip['"]/,
    /from\s+['"]@\/lib\/largo\/validator\/advice-validator['"]/,
    /from\s+['"]@\/lib\/largo\/validator\/customer-safe-validator['"]/,
    /from\s+['"]@\/lib\/largo\/producer\/stub['"]/,
    /from\s+['"]@\/tests\/largo\/fixtures\/[^'"]+['"]/,
  ];
  for (const re of forbiddenImportPatterns) {
    assert.ok(
      !re.test(COMPONENT_SOURCE),
      `component source imports forbidden module: ${re}`,
    );
  }
});

test('K3: component source file imports CustomerSafeAdvice from the customer-safe-advice module', () => {
  // Positive check: the only allowed Largo type import.
  const allowedImport = /from\s+['"]@\/types\/largo\/customer-safe-advice['"]/;
  assert.ok(
    allowedImport.test(COMPONENT_SOURCE),
    'component must import CustomerSafeAdvice from @/types/largo/customer-safe-advice',
  );
});

test('K4: component source does not import LargoAdvice (admin type) directly', () => {
  // The admin LargoAdvice type lives in @/types/largo/advice. The
  // component file MUST NOT import it (would risk indirect access to admin
  // fields). Type-only imports of utility types from advice are also out
  // of scope for Sprint 3.1.
  const adviceModuleImport = /from\s+['"]@\/types\/largo\/advice['"]/;
  assert.ok(
    !adviceModuleImport.test(COMPONENT_SOURCE),
    'component must NOT import from @/types/largo/advice (admin shape)',
  );
});

// -----------------------------------------------------------------------------
// Group L — Non-mutation
// -----------------------------------------------------------------------------

test('A14: rendering does not mutate the CustomerSafeAdvice input (every fixture)', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const safe = safeFromFixture(fixture);
    const snapshot = JSON.parse(JSON.stringify(safe));
    renderCard(safe);
    renderCard(safe, true);
    assert.deepStrictEqual(safe, snapshot);
  }
});

// -----------------------------------------------------------------------------
// Group M — Determinism
// -----------------------------------------------------------------------------

test('A15: same input renders deterministic HTML (full mode)', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const safe = safeFromFixture(fixture);
    const a = renderCard(safe);
    const b = renderCard(safe);
    assert.strictEqual(a, b);
  }
});

test('A15: same input renders deterministic HTML (compact mode)', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const safe = safeFromFixture(fixture);
    const a = renderCard(safe, true);
    const b = renderCard(safe, true);
    assert.strictEqual(a, b);
  }
});

// -----------------------------------------------------------------------------
// Group N — Compact mode preserves the core
// -----------------------------------------------------------------------------

test('A16: compact mode preserves the action header', () => {
  const html = renderCard(safeFromFixture(fixtureExtendedBuyNowHigh), true);
  assert.ok(html.includes('Good time to buy'));
});

test('A16: compact mode preserves the confidence semantic phrase', () => {
  const html = renderCard(safeFromFixture(fixtureExtendedBuyNowHigh), true);
  assert.ok(html.includes('high confidence'));
});

test('A16: compact mode preserves the route summary (origin → destination)', () => {
  const html = renderCard(safeFromFixture(fixtureExtendedBuyNowHigh), true);
  assert.ok(html.includes('JFK'));
  assert.ok(html.includes('NRT'));
});

test('A16: compact mode preserves the price', () => {
  const html = renderCard(safeFromFixture(fixtureExtendedBuyNowHigh), true);
  assert.ok(/\$\d+/.test(html) || html.includes('Price unavailable'));
});

test('A16: compact mode preserves the provider', () => {
  const html = renderCard(safeFromFixture(fixtureExtendedBuyNowHigh), true);
  assert.ok(
    html.includes('sky-scrapper') || html.includes('Provider unavailable'),
  );
});

test('A16: compact mode keeps the booking notice (Phase 1 contractual constant)', () => {
  const html = renderCard(safeFromFixture(fixtureExtendedBuyNowHigh), true);
  assert.ok(html.includes('Automatic booking is not yet available'));
});

test('A16: compact mode drops the reasons list', () => {
  const fullHtml = renderCard(safeFromFixture(fixtureExtendedBuyNowHigh), false);
  const compactHtml = renderCard(safeFromFixture(fixtureExtendedBuyNowHigh), true);
  // The full mode has data-section="reasons"; compact mode does not.
  assert.ok(fullHtml.includes('data-section="reasons"'));
  assert.ok(!compactHtml.includes('data-section="reasons"'));
});

test('A16: compact mode drops the footer (advice_id, validity, etc.)', () => {
  const compactHtml = renderCard(safeFromFixture(fixtureExtendedBuyNowHigh), true);
  // No <footer> element in compact mode.
  assert.ok(!compactHtml.includes('<footer'));
});

// -----------------------------------------------------------------------------
// Group O — Auto-buy notice is contractual constant in BOTH modes
// -----------------------------------------------------------------------------

test('O1: every fixture renders the literal "Automatic booking is not yet available" notice', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const safe = safeFromFixture(fixture);
    assert.ok(
      renderCard(safe).includes('Automatic booking is not yet available'),
      `full-mode fixture ${fixture.advice_id} missing autobuy notice`,
    );
    assert.ok(
      renderCard(safe, true).includes('Automatic booking is not yet available'),
      `compact-mode fixture ${fixture.advice_id} missing autobuy notice`,
    );
  }
});

test('O2: rendered HTML never contains an enabled "Buy now" button (no payment surface)', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const html = renderCard(safeFromFixture(fixture));
    // No <button> element rendering execution / payment / booking.
    assert.ok(!/<button[^>]*>(\s*)?Buy now/i.test(html));
    assert.ok(!/<button[^>]*>(\s*)?Reserve/i.test(html));
    assert.ok(!/<a[^>]+href[^>]*>(\s*)?Buy now/i.test(html));
  }
});

// -----------------------------------------------------------------------------
// Group P — Props sanity
// -----------------------------------------------------------------------------

test('P1: LargoAdviceCardProps type is exported and usable', () => {
  // Type-only sanity: assignability check.
  const props: LargoAdviceCardProps = {
    advice: safeFromFixture(fixtureExtendedBuyNowHigh),
  };
  assert.ok(props.advice);
  assert.strictEqual(props.compact, undefined);
  assert.strictEqual(props.className, undefined);
});

test('P2: className prop is preserved on the rendered article tag', () => {
  const safe = safeFromFixture(fixtureExtendedBuyNowHigh);
  const html = renderToStaticMarkup(
    <LargoAdviceCard advice={safe} className="custom-largo-class" />,
  );
  assert.ok(html.includes('custom-largo-class'));
});

// -----------------------------------------------------------------------------
// Group Q — Audit-fix verifications (customer-facing quality)
// -----------------------------------------------------------------------------

test('Q1: rendered HTML never contains "User:" or "Mission:" labels', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const html = renderCard(safeFromFixture(fixture));
    assert.ok(!html.includes('User:'), `"User:" found in HTML for ${fixture.advice_id}`);
    assert.ok(!html.includes('Mission:'), `"Mission:" found in HTML for ${fixture.advice_id}`);
  }
});

test('Q2: rendered HTML never contains raw schema_version label', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const html = renderCard(safeFromFixture(fixture));
    assert.ok(!html.includes('Schema version'));
  }
});

test('Q3: rendered HTML never contains bundle_context labels', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const html = renderCard(safeFromFixture(fixture));
    assert.ok(!html.includes('Part of bundle'));
    assert.ok(!html.includes('Bundle'));
  }
});

test('Q4: price renders with $ prefix for non-null prices', () => {
  const html = renderCard(safeFromFixture(fixtureExtendedBuyNowHigh));
  assert.ok(/\$\d+/.test(html), `expected $NNN format, got: ${html.slice(0, 200)}`);
  // Old format must not appear.
  assert.ok(!/\d+ USD/.test(html), 'old "NNN USD" format must not appear');
});

test('Q5: severity labels use customer-friendly words, not bracket tags', () => {
  const html = renderCard(safeFromFixture(fixtureExtendedBuyNowHigh));
  // Bracket tags must not appear.
  assert.ok(!html.includes('[positive]'));
  assert.ok(!html.includes('[cautionary]'));
  assert.ok(!html.includes('[blocking]'));
  assert.ok(!html.includes('[info]'));
  // Customer-friendly labels must appear (at least one reason renders).
  assert.ok(
    html.includes('Good') || html.includes('Note') ||
    html.includes('Important') || html.includes('Info'),
    'expected at least one customer-friendly severity label',
  );
});

test('Q6: no role="article" redundancy on the article element', () => {
  const html = renderCard(safeFromFixture(fixtureExtendedBuyNowHigh));
  assert.ok(!html.includes('role="article"'));
});

test('Q7: aria-label uses action and route, not raw advice_id', () => {
  const safe = safeFromFixture(fixtureExtendedBuyNowHigh);
  const html = renderCard(safe);
  assert.ok(html.includes('aria-label="Travel advice: Good time to buy'));
  // Raw ULID must not appear in aria-label.
  assert.ok(!html.includes(`aria-label="Travel advice ${safe.advice_id}"`));
});

test('Q8: footer shows truncated ref (6 chars), not full ULID', () => {
  const safe = safeFromFixture(fixtureExtendedBuyNowHigh);
  const html = renderCard(safe);
  const last6 = safe.advice_id.slice(-6);
  assert.ok(html.includes(`Ref: ${last6}`));
  // Full ULID (26 chars) must not appear as visible text.
  assert.ok(!html.includes(`>${safe.advice_id}<`));
});

test('Q9: price_freshness_seconds is not rendered in the customer view', () => {
  for (const fixture of extendedLargoAdviceFixtures) {
    const html = renderCard(safeFromFixture(fixture));
    assert.ok(!html.includes('Freshness:'));
    assert.ok(!/\d+s</.test(html), 'raw seconds value must not appear');
  }
});

// -----------------------------------------------------------------------------
// Self-running entry point
// -----------------------------------------------------------------------------

runAll();
