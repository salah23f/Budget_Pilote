/**
 * Largo — `LargoAdviceList` unit tests (Sprint 3.2, B1).
 *
 * Verifies the customer-safe presentational list:
 *  - renders the empty state for an empty input (with default + custom
 *    title/message);
 *  - renders every extended fixture through the full pipeline
 *    (validate-largo → strip → validate-customer-safe → list render);
 *  - delegates per-item rendering to `LargoAdviceCard` and surfaces
 *    its action header text;
 *  - preserves input order and does not mutate input;
 *  - applies `maxItems` truncation deterministically (including
 *    `maxItems === 0` and `maxItems` larger than length);
 *  - passes `compactCards` through to the card (verified by an
 *    observable difference in HTML between full and compact modes);
 *  - never leaks any of the 25 admin-only field names in the rendered
 *    HTML or the component source file (defense in depth);
 *  - never renders any of these customer-list-mode forbidden surface
 *    strings: "User:", "Mission:", "Schema version", "Bundle",
 *    "Freshness" — the card-level footer is suppressed by default;
 *  - does not import validators / strip / fixtures / producer / admin
 *    LargoAdvice type (regex source-scan).
 *
 * Test runner: same self-running harness as the rest of `tests/largo/**`.
 *
 *   npx tsx tests/largo/components/advice-list.test.tsx
 *
 * No new dependency; no `package.json` / `tsconfig.json` modified. Uses
 * `react-dom/server.renderToStaticMarkup` (already a runtime dep) and
 * `node:fs.readFileSync` (node built-in) for the source-scan invariants.
 */

import { strict as assert } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripToCustomerSafe } from '@/lib/largo/safe-view/strip';
import { validateLargoAdvice } from '@/lib/largo/validator/advice-validator';
import { validateCustomerSafeAdvice } from '@/lib/largo/validator/customer-safe-validator';
import {
  LargoAdviceList,
  type LargoAdviceListProps,
} from '@/components/largo/advice-list';
import {
  extendedLargoAdviceFixtures,
  fixtureExtendedAbstainProviderUnavailable,
  fixtureExtendedAlert,
  fixtureExtendedBuyNowHigh,
  fixtureExtendedMonitor,
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
// Local helpers (test-only)
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

function allFixturesAsCustomerSafe(): CustomerSafeAdvice[] {
  return extendedLargoAdviceFixtures.map(fullPipelineToCustomerSafe);
}

/** Render the list to a static HTML string. */
function renderList(
  props: Omit<LargoAdviceListProps, 'adviceItems'> & {
    adviceItems: ReadonlyArray<CustomerSafeAdvice>;
  },
): string {
  return renderToStaticMarkup(<LargoAdviceList {...props} />);
}

/** Read the component source file as text for source-scan invariants. */
const COMPONENT_SOURCE = readFileSync(
  'components/largo/advice-list.tsx',
  'utf-8',
);

// -----------------------------------------------------------------------------
// Group A — Empty state
// -----------------------------------------------------------------------------

test('A1: empty list renders safely (no throw)', () => {
  assert.doesNotThrow(() => {
    renderList({ adviceItems: [] });
  });
  const html = renderList({ adviceItems: [] });
  assert.ok(html.length > 0);
});

test('A2: empty state uses default title and message when none provided', () => {
  const html = renderList({ adviceItems: [] });
  assert.ok(html.includes('No advice available'));
  assert.ok(html.includes('There is nothing to show right now.'));
});

test('A3: empty state honors custom emptyTitle and emptyMessage props', () => {
  const html = renderList({
    adviceItems: [],
    emptyTitle: 'Nothing to see here',
    emptyMessage: 'Try expanding your search radius.',
  });
  assert.ok(html.includes('Nothing to see here'));
  assert.ok(html.includes('Try expanding your search radius.'));
  // Defaults must NOT also be in the HTML (no fallback double-render).
  assert.ok(!html.includes('No advice available'));
});

test('A4: empty state has accessibility role="status" and aria-live', () => {
  const html = renderList({ adviceItems: [] });
  assert.ok(html.includes('role="status"'));
  assert.ok(html.includes('aria-live="polite"'));
});

test('A5: empty state HTML does not render any list <li> items', () => {
  const html = renderList({ adviceItems: [] });
  assert.ok(!html.includes('<li'));
  // The empty-state block uses the dedicated data-section.
  assert.ok(html.includes('data-section="largo-advice-list-empty"'));
});

// -----------------------------------------------------------------------------
// Group B — Renders 13 fixtures + delegation + order
// -----------------------------------------------------------------------------

test('B1: renders all 13 extended fixtures without throwing', () => {
  const safeFixtures = allFixturesAsCustomerSafe();
  assert.doesNotThrow(() => {
    renderList({ adviceItems: safeFixtures });
  });
  const html = renderList({ adviceItems: safeFixtures });
  assert.ok(html.startsWith('<section'));
});

test('B2: list HTML surfaces all five action headers from LargoAdviceCard', () => {
  const safeFixtures = allFixturesAsCustomerSafe();
  const html = renderList({ adviceItems: safeFixtures });
  // Each action header text from AdviceCard must appear at least once.
  assert.ok(html.includes('Good time to buy'));
  assert.ok(html.includes('Wait for now'));
  assert.ok(html.includes('Monitoring'));
  assert.ok(html.includes('Price alert'));
  assert.ok(html.includes('Not enough reliable data'));
});

test('B3: input order is preserved in the rendered HTML', () => {
  const safeFixtures = allFixturesAsCustomerSafe();
  const html = renderList({ adviceItems: safeFixtures });
  // The Impeccable-hardened card no longer renders the full advice_id
  // visibly (it shows a truncated "Ref: last6" instead), so we cannot
  // anchor order on advice_id. Instead, anchor on stable customer-facing
  // action header text from the catalog. The fixture catalog ordering is:
  //   BUY_NOW (fixture 1)   → "Good time to buy"
  //   WAIT    (fixture 3)   → "Wait for now"
  //   MONITOR (fixture 4)   → "Monitoring"
  //   ALERT   (fixture 5)   → "Price alert"
  //   ABSTAIN (fixture 6)   → "Not enough reliable data"
  // Each header's FIRST occurrence in the HTML must therefore appear in
  // this order.
  const orderedHeaders = [
    'Good time to buy',
    'Wait for now',
    'Monitoring',
    'Price alert',
    'Not enough reliable data',
  ];
  let lastIndex = -1;
  for (const header of orderedHeaders) {
    const idx = html.indexOf(header);
    assert.ok(idx > -1, `expected header "${header}" in rendered HTML`);
    assert.ok(
      idx > lastIndex,
      `expected "${header}" to appear after the previous header (idx=${idx}, lastIndex=${lastIndex})`,
    );
    lastIndex = idx;
  }
});

test('B4: each fixture renders inside its own <li> wrapper', () => {
  const safeFixtures = allFixturesAsCustomerSafe();
  const html = renderList({ adviceItems: safeFixtures });
  // Each card is wrapped in a <li>. Count <li> occurrences.
  const liCount = (html.match(/<li\b[^>]*>/g) ?? []).length;
  assert.strictEqual(liCount, safeFixtures.length);
});

// -----------------------------------------------------------------------------
// Group C — maxItems
// -----------------------------------------------------------------------------

test('C1: maxItems truncates the rendered list to the prefix', () => {
  const safeFixtures = allFixturesAsCustomerSafe();
  const html = renderList({ adviceItems: safeFixtures, maxItems: 3 });
  const liCount = (html.match(/<li\b[^>]*>/g) ?? []).length;
  assert.strictEqual(liCount, 3);
  // The Impeccable-hardened card no longer renders the full advice_id,
  // so anchor truncation on stable customer-facing action header text.
  // First three catalog fixtures: BuyNowHigh (BUY_NOW), BuyNowModerate
  // (BUY_NOW), WaitHighPrice (WAIT). Their unique action headers must
  // be visible:
  assert.ok(
    html.includes('Good time to buy'),
    'fixtures 1-2 (BUY_NOW) action header should be visible at maxItems=3',
  );
  assert.ok(
    html.includes('Wait for now'),
    'fixture 3 (WAIT) action header should be visible at maxItems=3',
  );
  // Fixture 4 (Monitor) and beyond are truncated → their unique action
  // headers must NOT appear.
  assert.ok(
    !html.includes('Monitoring'),
    'fixture 4 (MONITOR) header must not appear when maxItems=3',
  );
  assert.ok(
    !html.includes('Price alert'),
    'fixture 5 (ALERT) header must not appear when maxItems=3',
  );
  assert.ok(
    !html.includes('Not enough reliable data'),
    'fixture 6 (ABSTAIN) header must not appear when maxItems=3',
  );
});

test('C2: maxItems === 0 with non-empty input renders zero <li> items inside the section (NOT the empty-state block)', () => {
  const safeFixtures = allFixturesAsCustomerSafe();
  const html = renderList({ adviceItems: safeFixtures, maxItems: 0 });
  const liCount = (html.match(/<li\b[^>]*>/g) ?? []).length;
  assert.strictEqual(liCount, 0);
  // The empty-state block is NOT rendered (because input was non-empty).
  assert.ok(!html.includes('data-section="largo-advice-list-empty"'));
  assert.ok(!html.includes('No advice available'));
  // The list section IS rendered (empty <ul> inside).
  assert.ok(html.includes('data-section="largo-advice-list"'));
  assert.ok(html.includes('data-section="largo-advice-list-items"'));
});

test('C3: maxItems undefined renders every item', () => {
  const safeFixtures = allFixturesAsCustomerSafe();
  const html = renderList({ adviceItems: safeFixtures }); // maxItems omitted
  const liCount = (html.match(/<li\b[^>]*>/g) ?? []).length;
  assert.strictEqual(liCount, safeFixtures.length);
});

test('C4: maxItems greater than length renders every item', () => {
  const safeFixtures = allFixturesAsCustomerSafe();
  const html = renderList({ adviceItems: safeFixtures, maxItems: 9999 });
  const liCount = (html.match(/<li\b[^>]*>/g) ?? []).length;
  assert.strictEqual(liCount, safeFixtures.length);
});

test('C5: negative maxItems is treated as undefined (renders every item)', () => {
  const safeFixtures = allFixturesAsCustomerSafe();
  const html = renderList({ adviceItems: safeFixtures, maxItems: -3 });
  const liCount = (html.match(/<li\b[^>]*>/g) ?? []).length;
  assert.strictEqual(liCount, safeFixtures.length);
});

// -----------------------------------------------------------------------------
// Group D — compactCards passthrough
// -----------------------------------------------------------------------------

test('D1: compactCards default (true) suppresses the card footer (no "User:" / "Mission:" / "Schema version" / "Bundle" / "Freshness")', () => {
  const safeFixtures = allFixturesAsCustomerSafe();
  const html = renderList({ adviceItems: safeFixtures }); // default
  for (const marker of [
    'User:',
    'Mission:',
    'Schema version',
    'Part of bundle',
    'Freshness:',
  ]) {
    assert.ok(
      !html.includes(marker),
      `default-compact mode should NOT contain "${marker}"`,
    );
  }
});

test('D2: compactCards=true explicitly suppresses the card footer (same as default)', () => {
  const safeFixtures = allFixturesAsCustomerSafe();
  const html = renderList({ adviceItems: safeFixtures, compactCards: true });
  for (const marker of ['User:', 'Mission:', 'Schema version', 'Part of bundle']) {
    assert.ok(!html.includes(marker));
  }
});

test('D3: compactCards=false EXPOSES the customer-safe footer (passthrough verification)', () => {
  const safe = fullPipelineToCustomerSafe(fixtureExtendedWaitHighPrice);
  const fullHtml = renderList({ adviceItems: [safe], compactCards: false });
  // After Impeccable hardening, the card no longer renders User:,
  // Mission:, Schema version, Part of bundle, or Freshness — those have
  // been removed from the customer-safe view even in full mode. The
  // remaining customer-safe footer markers that still appear in full
  // mode include "Ref:" (truncated advice_id reference), "Generated"
  // (timestamp label), and "Valid until" (expiry label). Passthrough is
  // verified by asserting at least one of these is present in
  // compactCards=false output. (The companion test D4 also verifies
  // passthrough by checking that compact and full mode produce different
  // HTML.)
  const fullModeMarkers = ['Ref:', 'Generated', 'Valid until'];
  const presentInFull = fullModeMarkers.some((m) => fullHtml.includes(m));
  assert.ok(
    presentInFull,
    `compactCards=false should expose at least one customer-safe footer marker; expected at least one of: ${fullModeMarkers.join(', ')}`,
  );
});

test('D4: compactCards toggles produce DIFFERENT HTML (passthrough is observable)', () => {
  const safeFixtures = allFixturesAsCustomerSafe();
  const compactHtml = renderList({ adviceItems: safeFixtures, compactCards: true });
  const fullHtml = renderList({ adviceItems: safeFixtures, compactCards: false });
  assert.notStrictEqual(compactHtml, fullHtml);
  // Full mode is strictly larger (footer adds content).
  assert.ok(fullHtml.length > compactHtml.length);
});

// -----------------------------------------------------------------------------
// Group E — className passthrough
// -----------------------------------------------------------------------------

test('E1: className is preserved on the section root', () => {
  const safeFixtures = allFixturesAsCustomerSafe();
  const html = renderList({
    adviceItems: safeFixtures,
    className: 'custom-largo-list-class',
  });
  assert.ok(html.includes('custom-largo-list-class'));
});

test('E2: className is preserved on the empty-state root', () => {
  const html = renderList({
    adviceItems: [],
    className: 'custom-largo-list-empty-class',
  });
  assert.ok(html.includes('custom-largo-list-empty-class'));
});

// -----------------------------------------------------------------------------
// Group F — Non-mutation
// -----------------------------------------------------------------------------

test('F1: rendering does not mutate the adviceItems array reference', () => {
  const safeFixtures = allFixturesAsCustomerSafe();
  const beforeLength = safeFixtures.length;
  const beforeRefs = safeFixtures.slice(); // shallow snapshot of refs
  renderList({ adviceItems: safeFixtures });
  renderList({ adviceItems: safeFixtures, maxItems: 3 });
  renderList({ adviceItems: safeFixtures, compactCards: false });
  assert.strictEqual(safeFixtures.length, beforeLength);
  for (let i = 0; i < safeFixtures.length; i += 1) {
    assert.strictEqual(safeFixtures[i], beforeRefs[i]);
  }
});

test('F2: rendering does not mutate per-item CustomerSafeAdvice objects', () => {
  const safeFixtures = allFixturesAsCustomerSafe();
  const snapshots = safeFixtures.map((s) => JSON.parse(JSON.stringify(s)));
  renderList({ adviceItems: safeFixtures });
  renderList({ adviceItems: safeFixtures, maxItems: 5, compactCards: false });
  for (let i = 0; i < safeFixtures.length; i += 1) {
    assert.deepStrictEqual(safeFixtures[i], snapshots[i]);
  }
});

// -----------------------------------------------------------------------------
// Group G — Determinism
// -----------------------------------------------------------------------------

test('G1: same props produce byte-equal HTML (default compact)', () => {
  const safeFixtures = allFixturesAsCustomerSafe();
  const a = renderList({ adviceItems: safeFixtures });
  const b = renderList({ adviceItems: safeFixtures });
  assert.strictEqual(a, b);
});

test('G2: same props produce byte-equal HTML (full mode)', () => {
  const safeFixtures = allFixturesAsCustomerSafe();
  const a = renderList({ adviceItems: safeFixtures, compactCards: false });
  const b = renderList({ adviceItems: safeFixtures, compactCards: false });
  assert.strictEqual(a, b);
});

test('G3: same props produce byte-equal HTML (truncated)', () => {
  const safeFixtures = allFixturesAsCustomerSafe();
  const a = renderList({ adviceItems: safeFixtures, maxItems: 4 });
  const b = renderList({ adviceItems: safeFixtures, maxItems: 4 });
  assert.strictEqual(a, b);
});

test('G4: same props produce byte-equal HTML (empty state)', () => {
  const a = renderList({ adviceItems: [] });
  const b = renderList({ adviceItems: [] });
  assert.strictEqual(a, b);
});

// -----------------------------------------------------------------------------
// Group H — Forbidden-key + numeric-confidence + percent + footer-string scans
//          (all under default compactCards=true for the list-mode contract)
// -----------------------------------------------------------------------------

test('H1: rendered HTML never contains any of the 25 forbidden customer-side keys', () => {
  const safeFixtures = allFixturesAsCustomerSafe();
  const html = renderList({ adviceItems: safeFixtures });
  for (const key of FORBIDDEN_KEYS) {
    const re = makeKeyRegex(key);
    assert.ok(!re.test(html), `forbidden token "${key}" found in list HTML`);
  }
});

test('H2: rendered HTML never contains numeric confidence values', () => {
  const safeFixtures = allFixturesAsCustomerSafe();
  const html = renderList({ adviceItems: safeFixtures });
  // Stub confidence values: 0.78, 0.55, 0.41, 0.32 — none must appear.
  assert.ok(!html.includes('0.78'));
  assert.ok(!html.includes('0.55'));
  assert.ok(!html.includes('0.41'));
  assert.ok(!html.includes('0.32'));
});

test('H3: rendered HTML never contains a "%" character (default mode)', () => {
  const safeFixtures = allFixturesAsCustomerSafe();
  const html = renderList({ adviceItems: safeFixtures });
  assert.ok(!html.includes('%'));
});

test('H4: rendered HTML never contains raw provider disagreement values (0.142, 14.2)', () => {
  const safeFixtures = allFixturesAsCustomerSafe();
  const html = renderList({ adviceItems: safeFixtures });
  assert.ok(!html.includes('0.142'));
  assert.ok(!html.includes('14.2'));
});

test('H5: rendered HTML never contains "User:", "Mission:", "Schema version", "Part of bundle", "Freshness" (default compact mode)', () => {
  const safeFixtures = allFixturesAsCustomerSafe();
  const html = renderList({ adviceItems: safeFixtures }); // default compactCards=true
  for (const marker of [
    'User:',
    'Mission:',
    'Schema version',
    'Part of bundle',
    'Freshness',
  ]) {
    assert.ok(!html.includes(marker), `default-list-mode HTML must not contain "${marker}"`);
  }
});

test('H6: rendered HTML never contains forbidden keys for any individual fixture rendered solo', () => {
  // Per-fixture isolated render — defense in depth on top of H1 above.
  for (const fixture of extendedLargoAdviceFixtures) {
    const safe = fullPipelineToCustomerSafe(fixture);
    const html = renderList({ adviceItems: [safe] });
    for (const key of FORBIDDEN_KEYS) {
      const re = makeKeyRegex(key);
      assert.ok(
        !re.test(html),
        `forbidden token "${key}" found rendering ${fixture.advice_id} solo`,
      );
    }
  }
});

// -----------------------------------------------------------------------------
// Group I — No payment / booking CTA
// -----------------------------------------------------------------------------

test('I1: rendered HTML never contains a Buy / Reserve / Book button or link', () => {
  const safeFixtures = allFixturesAsCustomerSafe();
  const html = renderList({ adviceItems: safeFixtures });
  assert.ok(!/<button[^>]*>(\s*)?Buy now/i.test(html));
  assert.ok(!/<button[^>]*>(\s*)?Reserve/i.test(html));
  assert.ok(!/<button[^>]*>(\s*)?Book/i.test(html));
  assert.ok(!/<a[^>]+href[^>]*>(\s*)?Buy now/i.test(html));
  assert.ok(!/<a[^>]+href[^>]*>(\s*)?Reserve/i.test(html));
  assert.ok(!/<a[^>]+href[^>]*>(\s*)?Book/i.test(html));
});

test('I2: rendered HTML never contains an enabled auto-buy button', () => {
  const safeFixtures = allFixturesAsCustomerSafe();
  const html = renderList({ adviceItems: safeFixtures });
  // The booking notice text from the card is a literal disabled string.
  // After Impeccable hardening, the card uses the customer-friendly
  // phrasing "Automatic booking is not yet available" instead of the
  // engineering-style "Auto-buy disabled in Phase 1". Verify the
  // disabled phrase is present.
  assert.ok(
    html.includes('Automatic booking is not yet available'),
    'expected disabled-booking notice to be present',
  );
  // No <button> wrapping the auto-buy / booking text.
  assert.ok(!/<button[^>]*>(\s*)?Auto-buy/i.test(html));
  assert.ok(!/<button[^>]*>(\s*)?Automatic booking/i.test(html));
});

// -----------------------------------------------------------------------------
// Group J — Null price / null provider behavior delegated safely from the card
// -----------------------------------------------------------------------------

test('J1: null observed_price_usd renders "Price unavailable" via the card', () => {
  const safe = fullPipelineToCustomerSafe(fixtureExtendedAbstainProviderUnavailable);
  assert.strictEqual(safe.price_observation.observed_price_usd, null);
  const html = renderList({ adviceItems: [safe] });
  assert.ok(html.includes('Price unavailable'));
  assert.ok(!html.includes('$0'));
  assert.ok(!/\b0 USD\b/.test(html));
});

test('J2: null primary_provider renders "Provider unavailable" via the card', () => {
  const safe = fullPipelineToCustomerSafe(fixtureExtendedAbstainProviderUnavailable);
  assert.strictEqual(safe.provider_info.primary_provider, null);
  const html = renderList({ adviceItems: [safe] });
  assert.ok(html.includes('Provider unavailable'));
});

// -----------------------------------------------------------------------------
// Group S — Source-file scans (defense in depth)
// -----------------------------------------------------------------------------

test('S1: source file does not contain any of the 25 forbidden keys as identifiers', () => {
  for (const key of FORBIDDEN_KEYS) {
    const re = makeKeyRegex(key);
    assert.ok(
      !re.test(COMPONENT_SOURCE),
      `forbidden token "${key}" found in advice-list source — refactor required`,
    );
  }
});

test('S2: source file does not import validators, strip, fixtures, or producer', () => {
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
      `advice-list source imports a forbidden module: ${re}`,
    );
  }
});

test('S3: source file does not import @/types/largo/advice (admin LargoAdvice type)', () => {
  const adviceModuleImport = /from\s+['"]@\/types\/largo\/advice['"]/;
  assert.ok(
    !adviceModuleImport.test(COMPONENT_SOURCE),
    'advice-list must NOT import from @/types/largo/advice (operator shape)',
  );
});

test('S4: source file imports CustomerSafeAdvice from the customer-safe-advice module', () => {
  const allowedImport = /from\s+['"]@\/types\/largo\/customer-safe-advice['"]/;
  assert.ok(
    allowedImport.test(COMPONENT_SOURCE),
    'advice-list must import CustomerSafeAdvice from @/types/largo/customer-safe-advice',
  );
});

test('S5: source file imports LargoAdviceCard from the advice-card module', () => {
  const cardImport = /from\s+['"]@\/components\/largo\/advice-card['"]/;
  assert.ok(
    cardImport.test(COMPONENT_SOURCE),
    'advice-list must import LargoAdviceCard from @/components/largo/advice-card',
  );
});

test('S6: source file imports React (required for JSX through tsx)', () => {
  // Either `import React from 'react'` or `import * as React from 'react'`.
  const reactImport = /import\s+(?:\*\s+as\s+)?React\s+from\s+['"]react['"]/;
  assert.ok(reactImport.test(COMPONENT_SOURCE));
});

// -----------------------------------------------------------------------------
// Group P — Props sanity
// -----------------------------------------------------------------------------

test('P1: LargoAdviceListProps is exported and assignable with required prop only', () => {
  const props: LargoAdviceListProps = { adviceItems: [] };
  assert.ok(Array.isArray(props.adviceItems));
  assert.strictEqual(props.adviceItems.length, 0);
});

test('P2: LargoAdviceListProps accepts all optional props (compile-time check)', () => {
  const safeFixtures = allFixturesAsCustomerSafe();
  const props: LargoAdviceListProps = {
    adviceItems: safeFixtures,
    className: 'x',
    compactCards: false,
    emptyTitle: 't',
    emptyMessage: 'm',
    maxItems: 2,
  };
  // Sanity: render with all opts.
  assert.doesNotThrow(() => renderList(props));
});

// -----------------------------------------------------------------------------
// Group K — Cross-fixture sanity (a few more representative checks)
// -----------------------------------------------------------------------------

test('K1: BUY_NOW high-confidence fixture surfaces "Good time to buy" via the list', () => {
  const safe = fullPipelineToCustomerSafe(fixtureExtendedBuyNowHigh);
  const html = renderList({ adviceItems: [safe] });
  assert.ok(html.includes('Good time to buy'));
});

test('K2: ALERT fixture surfaces "Price alert" via the list', () => {
  const safe = fullPipelineToCustomerSafe(fixtureExtendedAlert);
  const html = renderList({ adviceItems: [safe] });
  assert.ok(html.includes('Price alert'));
});

test('K3: MONITOR fixture surfaces "Monitoring" via the list', () => {
  const safe = fullPipelineToCustomerSafe(fixtureExtendedMonitor);
  const html = renderList({ adviceItems: [safe] });
  assert.ok(html.includes('Monitoring'));
});

test('K4: every list render preserves the disabled-booking notice once per item', () => {
  const safeFixtures = allFixturesAsCustomerSafe();
  const html = renderList({ adviceItems: safeFixtures });
  // After Impeccable hardening, the card renders the customer-friendly
  // disabled phrase "Automatic booking is not yet available" — one
  // occurrence per rendered card.
  const noticeCount = (
    html.match(/Automatic booking is not yet available/g) ?? []
  ).length;
  assert.strictEqual(noticeCount, safeFixtures.length);
});

// -----------------------------------------------------------------------------
// Self-running entry point
// -----------------------------------------------------------------------------

runAll();
