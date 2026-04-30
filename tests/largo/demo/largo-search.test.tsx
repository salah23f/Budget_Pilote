/**
 * Largo — interactive search demo page tests (Sprint 3.5, B1).
 *
 * Verifies the search demo page composes the merged primitives correctly
 * AND keeps the customer-safe boundary intact:
 *  - server page renders without throwing;
 *  - title, subtitle, form labels, idle-state instruction, and the form's
 *    Phase 1 booking notice are all visible in the static HTML;
 *  - client component source references the 4 pipeline functions and the
 *    2 sibling components by name (positive scan);
 *  - rendered HTML and source files contain none of the 25 forbidden
 *    customer-side keys, no `%`, no raw disagreement values, no
 *    Impeccable-hardened-away labels;
 *  - server page + client component sources do not import from
 *    `scripts/`, `contracts/`, `app/api/`, `.github/`, `.claude/`,
 *    `docs/`;
 *  - source files do not contain forbidden backend/product tokens
 *    (`fetch(`, `app/api`, `api/`, `database`, `prisma`, `auth`,
 *    `provider`, `ML`, `checkout`, `payment`, `escrow`, `auto-buy`,
 *    `autobuy`);
 *  - initial server render is deterministic (byte-equal HTML on repeat).
 *
 * Test runner: same self-running harness as the rest of `tests/largo/**`.
 *
 *   npx tsx tests/largo/demo/largo-search.test.tsx
 *
 * No new dependency; no `package.json` / `tsconfig.json` modified. Uses
 * `react-dom/server.renderToStaticMarkup` (already a runtime dep) and
 * `node:fs.readFileSync` (node built-in) for the source-scan invariants.
 *
 * Submit-behavior limitation: this file does NOT simulate browser form
 * submission (no jsdom, no @testing-library). The interactive submit →
 * pipeline path is verified by composition: the source-scan tests assert
 * the client component imports + uses every pipeline function, and the
 * form's emitted-shape contract is already covered by Sprint 3.4 tests.
 */

import { strict as assert } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LargoSearchDemoPage from '@/app/(demo)/largo-search/page';

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

function renderPage(): string {
  return renderToStaticMarkup(<LargoSearchDemoPage />);
}

const PAGE_SOURCE = readFileSync(
  'app/(demo)/largo-search/page.tsx',
  'utf-8',
);
const CLIENT_SOURCE = readFileSync(
  'app/(demo)/largo-search/largo-search-demo-client.tsx',
  'utf-8',
);

// =============================================================================
// Tests (a–l + B1–B5 bonus)
// =============================================================================

// a. Page renders without throwing.
test('a: page renders without throwing', () => {
  assert.doesNotThrow(() => renderPage());
  const html = renderPage();
  assert.ok(html.length > 0);
  assert.ok(html.startsWith('<main'));
});

// b. Title visible.
test('b: rendered HTML contains "Largo — Search demo"', () => {
  const html = renderPage();
  assert.ok(html.includes('Largo — Search demo'));
});

// c. 6 form labels visible.
test('c: rendered HTML contains all 6 form labels', () => {
  const html = renderPage();
  for (const label of [
    'From',
    'To',
    'Departure date',
    'Return date',
    'Passengers',
    'Cabin class',
  ]) {
    assert.ok(html.includes(label), `expected label "${label}" in HTML`);
  }
});

// d. Idle-state instruction visible.
test('d: rendered HTML contains the idle-state instruction', () => {
  const html = renderPage();
  assert.ok(
    html.includes(
      'Enter a route above to preview a customer-safe Largo recommendation.',
    ),
    'expected idle instruction text',
  );
  // The idle block carries its dedicated data-section attribute.
  assert.ok(html.includes('data-section="largo-search-demo-idle"'));
});

// e. Form's Phase 1 booking notice is visible (delegated from Sprint 3.4).
test('e: rendered HTML contains the form\'s Phase 1 booking notice', () => {
  const html = renderPage();
  assert.ok(
    html.includes('Automatic booking is not yet available'),
    'expected the form\'s disabled-booking notice in HTML',
  );
});

// f. Source scan: client component uses the 4 pipeline functions.
test('f: client component source references the 4 pipeline functions', () => {
  for (const fn of [
    'produceStubLargoAdvice',
    'validateLargoAdvice',
    'stripToCustomerSafe',
    'validateCustomerSafeAdvice',
  ]) {
    assert.ok(
      CLIENT_SOURCE.includes(fn),
      `client component must reference "${fn}"`,
    );
  }
});

// g. Source scan: client component renders LargoSearchForm + LargoAdviceList.
test('g: client component source renders LargoSearchForm and LargoAdviceList', () => {
  assert.ok(CLIENT_SOURCE.includes('LargoSearchForm'));
  assert.ok(CLIENT_SOURCE.includes('LargoAdviceList'));
});

// h. No 25 forbidden customer-side keys (rendered HTML and both source files).
test('h: rendered HTML and sources contain none of the 25 forbidden customer-side keys', () => {
  const html = renderPage();
  for (const key of FORBIDDEN_KEYS) {
    const re = makeKeyRegex(key);
    assert.ok(
      !re.test(html),
      `forbidden token "${key}" found in rendered HTML`,
    );
    assert.ok(
      !re.test(PAGE_SOURCE),
      `forbidden token "${key}" found in page source`,
    );
    assert.ok(
      !re.test(CLIENT_SOURCE),
      `forbidden token "${key}" found in client source`,
    );
  }
});

// i. Rendered HTML never contains certain hardened-away or raw-value markers.
test('i: rendered HTML never contains forbidden surface strings', () => {
  const html = renderPage();
  assert.ok(!html.includes('%'), 'rendered HTML must not contain "%"');
  assert.ok(!html.includes('0.142'));
  assert.ok(!html.includes('14.2'));
  for (const marker of [
    'User:',
    'Mission:',
    'Schema version',
    'Part of bundle',
    'Freshness:',
  ]) {
    assert.ok(
      !html.includes(marker),
      `hardened-away marker "${marker}" must not appear in HTML`,
    );
  }
});

// j. Source-token scan: no forbidden backend/product tokens in either source file.
test('j: page + client source files contain no forbidden backend/product tokens', () => {
  const FORBIDDEN_SOURCE_TOKENS = [
    'fetch(',
    'app/api',
    'api/',
    'database',
    'prisma',
    'auth',
    'provider',
    'ML',
    'checkout',
    'payment',
    'escrow',
    'auto-buy',
    'autobuy',
  ] as const;
  for (const token of FORBIDDEN_SOURCE_TOKENS) {
    assert.ok(
      !PAGE_SOURCE.includes(token),
      `forbidden source token "${token}" found in page source`,
    );
    assert.ok(
      !CLIENT_SOURCE.includes(token),
      `forbidden source token "${token}" found in client source`,
    );
  }
});

// k. Source-import scan: no imports from denied path-prefixes.
test('k: page + client source files do not import from denied path-prefixes', () => {
  // Extract every `from "..."` path in both source files.
  const PAGE_IMPORT_PATHS = (PAGE_SOURCE.match(/from\s+['"][^'"]+['"]/g) ?? [])
    .map((stmt) => {
      const m = stmt.match(/from\s+['"]([^'"]+)['"]/);
      return m ? m[1] : '';
    })
    .filter((p) => p.length > 0);
  const CLIENT_IMPORT_PATHS = (
    CLIENT_SOURCE.match(/from\s+['"][^'"]+['"]/g) ?? []
  )
    .map((stmt) => {
      const m = stmt.match(/from\s+['"]([^'"]+)['"]/);
      return m ? m[1] : '';
    })
    .filter((p) => p.length > 0);

  const FORBIDDEN_IMPORT_PREFIXES = [
    'scripts/',
    'contracts/',
    'app/api/',
    '.github/',
    '.claude/',
    'docs/',
    '@/app/api/',
    '@/scripts/',
    '@/contracts/',
  ] as const;

  for (const prefix of FORBIDDEN_IMPORT_PREFIXES) {
    for (const path of PAGE_IMPORT_PATHS) {
      assert.ok(
        !path.includes(prefix),
        `page imports forbidden prefix "${prefix}" via path "${path}"`,
      );
    }
    for (const path of CLIENT_IMPORT_PATHS) {
      assert.ok(
        !path.includes(prefix),
        `client imports forbidden prefix "${prefix}" via path "${path}"`,
      );
    }
  }
});

// l. Determinism on initial server/static render.
test('l: rendering the page twice returns byte-equal initial HTML', () => {
  const a = renderPage();
  const b = renderPage();
  assert.strictEqual(a, b);
});

// =============================================================================
// Bonus invariants (defense in depth)
// =============================================================================

// B1. Server page imports the sibling client child correctly.
test('B1: page source imports LargoSearchDemoClient from the local client file', () => {
  const re = /from\s+['"]\.\/largo-search-demo-client['"]/;
  assert.ok(re.test(PAGE_SOURCE), 'expected local import of the client child');
  assert.ok(PAGE_SOURCE.includes('LargoSearchDemoClient'));
});

// B2. Client component has the 'use client' directive at the top.
test('B2: client component carries the "use client" directive at the top', () => {
  const firstNonEmpty = CLIENT_SOURCE.split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)[0];
  // The first non-empty line of the file must be exactly the directive.
  assert.ok(
    firstNonEmpty === "'use client';" || firstNonEmpty === '"use client";',
    `expected first non-empty line to be the use-client directive, got: ${firstNonEmpty}`,
  );
});

// B3. No Buy / Reserve / Book CTA anywhere in the rendered HTML.
test('B3: rendered HTML contains no Buy / Reserve / Book CTA', () => {
  const html = renderPage();
  assert.ok(!/<button[^>]*>(\s*)?Buy now/i.test(html));
  assert.ok(!/<button[^>]*>(\s*)?Reserve/i.test(html));
  assert.ok(!/<button[^>]*>(\s*)?Book/i.test(html));
  assert.ok(!/<a[^>]+href[^>]*>(\s*)?Buy now/i.test(html));
});

// B4. Title and subtitle both present in HTML (hierarchy sanity).
test('B4: both title and subtitle appear in rendered HTML', () => {
  const html = renderPage();
  assert.ok(html.includes('Largo — Search demo'));
  assert.ok(
    html.includes(
      'Use the form below to see a customer-safe Largo',
    ),
    'expected the page subtitle text',
  );
});

// B5. Initial state renders no advice cards (no <article> from AdviceCard).
test('B5: initial render does not include any AdviceCard <article> markup', () => {
  const html = renderPage();
  // The form is a <form>, the empty-state is a <p>. No <article> from
  // a card should appear in the idle state.
  assert.ok(!/<article\b/.test(html));
  // Also: the result wrapper data-section must NOT appear in idle.
  assert.ok(!html.includes('data-section="largo-search-demo-result"'));
});

// B6. Idle-state element has accessible role="status".
test('B6: idle-state element has role="status" and aria-live', () => {
  const html = renderPage();
  // The idle <p> carries role="status" and aria-live="polite".
  // Match in any attribute order.
  const idleSection =
    html.match(/<p[^>]*data-section="largo-search-demo-idle"[^>]*>/) ??
    html.match(/<p[^>]*role="status"[^>]*data-section="largo-search-demo-idle"[^>]*>/);
  assert.ok(
    idleSection !== null,
    'expected idle <p> element with data-section="largo-search-demo-idle"',
  );
  // Verify role and aria-live present (anywhere on the idle element).
  // Pull the matched tag and check inside.
  const fullIdleTagMatch = html.match(
    /<p[^>]*data-section="largo-search-demo-idle"[^>]*>/,
  );
  assert.ok(fullIdleTagMatch);
  const idleTag = fullIdleTagMatch![0];
  assert.ok(
    idleTag.includes('role="status"'),
    'idle element must carry role="status"',
  );
  assert.ok(
    idleTag.includes('aria-live="polite"'),
    'idle element must carry aria-live="polite"',
  );
});

// B7. Page subtitle does not contain forbidden words, even as text.
test('B7: page subtitle text contains no forbidden surface words', () => {
  // Targeted check on the subtitle string only — broader scan in test (j).
  const subtitleMatch = PAGE_SOURCE.match(
    /Preview only\. Use the form below[\s\S]+?<\/p>/,
  );
  assert.ok(subtitleMatch, 'expected the subtitle <p> in page source');
  const subtitleBlock = subtitleMatch![0];
  for (const forbidden of [
    'fetch',
    'database',
    'prisma',
    'provider',
    'checkout',
    'payment',
    'escrow',
    'auto-buy',
    'autobuy',
  ]) {
    assert.ok(
      !subtitleBlock.includes(forbidden),
      `subtitle contains forbidden word "${forbidden}"`,
    );
  }
});

// =============================================================================
// Self-running entry point
// =============================================================================

runAll();
