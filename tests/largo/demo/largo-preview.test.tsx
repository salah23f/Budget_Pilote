/**
 * Largo — demo preview page tests (Sprint 3.3, B1).
 *
 * Verifies the customer-safe demo preview page:
 *  - title is present;
 *  - all 13 fixture-derived cards render (≥ 13 <li>);
 *  - all 5 action header strings appear;
 *  - none of the 25 forbidden customer-side keys appear in the rendered HTML;
 *  - no "%" character anywhere in the rendered HTML;
 *  - no raw provider disagreement values (0.142, 14.2);
 *  - none of the Impeccable-hardened-away labels (User:, Mission:,
 *    Schema version, Part of bundle, Freshness:) appear;
 *  - the page source itself does not contain forbidden backend/product
 *    calls or imports (fetch, app/api, database, prisma, auth, provider,
 *    ML, model, checkout, booking, auto-buy, autobuy);
 *  - rendering is deterministic.
 *
 * Test runner: same self-running harness as the rest of `tests/largo/**`.
 *
 *   npx tsx tests/largo/demo/largo-preview.test.tsx
 *
 * No new dependency; no `package.json` / `tsconfig.json` modified. Uses
 * `react-dom/server.renderToStaticMarkup` (already a runtime dep) and
 * `node:fs.readFileSync` (node built-in) for the page-source scan.
 */

import { strict as assert } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LargoDemoPreviewPage from '@/app/(demo)/largo-preview/page';

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
// Local helpers and constants
// -----------------------------------------------------------------------------

/**
 * Re-declared locally to keep this file self-contained and to mirror the
 * pattern used in `tests/largo/components/advice-list.test.tsx` and
 * `tests/largo/components/advice-card.test.tsx`. These 25 tokens must
 * never appear at the customer-safe boundary; the page renders only via
 * the merged AdviceList/AdviceCard which already strip them at the type
 * level — this scan is defense in depth.
 */
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
 * requires a transition between a `\w` (alphanumeric or underscore) and
 * a non-`\w` character.
 */
function makeKeyRegex(key: string): RegExp {
  return new RegExp(`\\b${key}\\b`);
}

/** Render the demo page to a static HTML string. */
function renderPage(): string {
  return renderToStaticMarkup(<LargoDemoPreviewPage />);
}

/** Read the page source for the source-scan invariants. */
const PAGE_SOURCE = readFileSync(
  'app/(demo)/largo-preview/page.tsx',
  'utf-8',
);

// =============================================================================
// Test cases (a–i, mapping to the prompt's required invariants)
// =============================================================================

// a. Title present.
test('a: rendered HTML contains the demo title "Largo — Demo preview"', () => {
  const html = renderPage();
  assert.ok(
    html.includes('Largo — Demo preview'),
    'expected demo title to be present in rendered HTML',
  );
});

// b. ≥ 13 list items.
test('b: rendered HTML contains at least 13 <li> items', () => {
  const html = renderPage();
  const liCount = (html.match(/<li\b[^>]*>/g) ?? []).length;
  assert.ok(
    liCount >= 13,
    `expected at least 13 <li> items in rendered HTML, got ${liCount}`,
  );
});

// c. 5 action headers.
test('c: rendered HTML contains all 5 customer-facing action headers', () => {
  const html = renderPage();
  const headers = [
    'Good time to buy',
    'Wait for now',
    'Monitoring',
    'Price alert',
    'Not enough reliable data',
  ];
  for (const header of headers) {
    assert.ok(
      html.includes(header),
      `expected action header "${header}" in rendered HTML`,
    );
  }
});

// d. No 25 forbidden keys (word boundary).
test('d: rendered HTML contains none of the 25 forbidden customer-side keys', () => {
  const html = renderPage();
  for (const key of FORBIDDEN_KEYS) {
    const re = makeKeyRegex(key);
    assert.ok(
      !re.test(html),
      `forbidden token "${key}" found in rendered HTML`,
    );
  }
});

// e. No "%".
test('e: rendered HTML never contains a "%" character', () => {
  const html = renderPage();
  assert.ok(
    !html.includes('%'),
    'rendered HTML must not contain "%" anywhere',
  );
});

// f. No raw disagreement values.
test('f: rendered HTML never contains raw disagreement values (0.142, 14.2)', () => {
  const html = renderPage();
  assert.ok(!html.includes('0.142'), 'rendered HTML must not contain "0.142"');
  assert.ok(!html.includes('14.2'), 'rendered HTML must not contain "14.2"');
});

// g. No Impeccable-hardened-away labels.
test('g: rendered HTML never contains Impeccable-hardened-away internal labels', () => {
  const html = renderPage();
  for (const marker of [
    'User:',
    'Mission:',
    'Schema version',
    'Part of bundle',
    'Freshness:',
  ]) {
    assert.ok(
      !html.includes(marker),
      `hardened-away label "${marker}" must not appear in rendered HTML`,
    );
  }
});

// h. Page source does not contain forbidden backend/product calls or imports.
test('h: page source does not contain forbidden backend/product tokens', () => {
  // Practical substring scan for backend/product wiring tokens. The
  // allowed Largo imports do not contain any of these as substrings;
  // this scan would catch accidental drift toward fetch / API routes /
  // database / payment surface / model wiring.
  const FORBIDDEN_SOURCE_TOKENS = [
    'fetch(',
    'app/api',
    'api/',
    'database',
    'prisma',
    'auth',
    'provider',
    'ML',
    'model',
    'checkout',
    'booking',
    'auto-buy',
    'autobuy',
  ] as const;
  for (const token of FORBIDDEN_SOURCE_TOKENS) {
    assert.ok(
      !PAGE_SOURCE.includes(token),
      `forbidden source token "${token}" found in page source — this page must compose only the merged Largo pipeline + AdviceList`,
    );
  }
});

// i. Determinism.
test('i: rendering the page twice returns byte-equal HTML', () => {
  const a = renderPage();
  const b = renderPage();
  assert.strictEqual(a, b);
});

// =============================================================================
// Bonus invariants (defense in depth on top of a–i)
// =============================================================================

// J1. Demo page <main> wrapper carries the dedicated data-section attribute.
test('J1: rendered HTML contains the largo-demo-preview data-section', () => {
  const html = renderPage();
  assert.ok(html.includes('data-section="largo-demo-preview"'));
});

// J2. AdviceList wrapper is composed (delegation check).
test('J2: rendered HTML contains the largo-advice-list data-section (delegation)', () => {
  const html = renderPage();
  assert.ok(html.includes('data-section="largo-advice-list"'));
});

// J3. The Phase 1 booking notice literal appears once per fixture.
test('J3: "Automatic booking is not yet available" notice appears 13 times', () => {
  const html = renderPage();
  const noticeCount = (
    html.match(/Automatic booking is not yet available/g) ?? []
  ).length;
  assert.strictEqual(
    noticeCount,
    13,
    `expected exactly 13 booking-disabled notices, got ${noticeCount}`,
  );
});

// J4. No <button> wrapping a Buy / Reserve / Book CTA (delegation check).
test('J4: rendered HTML contains no Buy / Reserve / Book CTA button or link', () => {
  const html = renderPage();
  assert.ok(!/<button[^>]*>(\s*)?Buy now/i.test(html));
  assert.ok(!/<button[^>]*>(\s*)?Reserve/i.test(html));
  assert.ok(!/<button[^>]*>(\s*)?Book/i.test(html));
  assert.ok(!/<a[^>]+href[^>]*>(\s*)?Buy now/i.test(html));
});

// J5. Page source imports CustomerSafeAdvice from the customer-safe-advice path.
test('J5: page source imports CustomerSafeAdvice from @/types/largo/customer-safe-advice', () => {
  const re = /from\s+['"]@\/types\/largo\/customer-safe-advice['"]/;
  assert.ok(re.test(PAGE_SOURCE));
});

// J6. Page source imports LargoAdviceList from @/components/largo/advice-list.
test('J6: page source imports LargoAdviceList from @/components/largo/advice-list', () => {
  const re = /from\s+['"]@\/components\/largo\/advice-list['"]/;
  assert.ok(re.test(PAGE_SOURCE));
});

// J7. Page source imports the three pipeline functions.
test('J7: page source imports the three pipeline functions (validateLargoAdvice, stripToCustomerSafe, validateCustomerSafeAdvice)', () => {
  assert.ok(/validateLargoAdvice/.test(PAGE_SOURCE));
  assert.ok(/stripToCustomerSafe/.test(PAGE_SOURCE));
  assert.ok(/validateCustomerSafeAdvice/.test(PAGE_SOURCE));
});

// J8. Page source imports the existing extended fixtures (no new fixtures).
test('J8: page source imports extendedLargoAdviceFixtures from the existing fixture file', () => {
  const re =
    /from\s+['"]@\/tests\/largo\/fixtures\/largo-advice-extended\.fixture['"]/;
  assert.ok(re.test(PAGE_SOURCE));
});

// J9. Page source does not contain a "use client" directive.
test('J9: page source does not contain a "use client" directive', () => {
  assert.ok(!/['"]use client['"]/.test(PAGE_SOURCE));
});

// -----------------------------------------------------------------------------
// Self-running entry point
// -----------------------------------------------------------------------------

runAll();
