/**
 * Largo — `LargoSearchForm` unit tests (Sprint 3.4, B1).
 *
 * Verifies the customer-safe presentational search form:
 *  - renders without throwing for default and custom props;
 *  - exposes the 6 customer-facing labels;
 *  - shows an accessible submit button;
 *  - propagates `disabled` to all inputs and the submit;
 *  - preserves `className` and surfaces `initialValues` as `defaultValue`;
 *  - shows the literal Phase 1 booking-disabled notice;
 *  - never renders `%`, raw model/provider values, or operator-only labels;
 *  - imports only React and the StubLargoAdviceInput type (allow-list scan);
 *  - calls no validator / strip / producer / fetch runtime;
 *  - is deterministic: same props → byte-equal static markup.
 *
 * Test runner: same self-running harness as the rest of `tests/largo/**`.
 *
 *   npx tsx tests/largo/components/search-form.test.tsx
 *
 * No new dependency; no `package.json` / `tsconfig.json` modified. Uses
 * `react-dom/server.renderToStaticMarkup` (already a runtime dep) and
 * `node:fs.readFileSync` (node built-in) for the source-scan invariants.
 */

import { strict as assert } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  LargoSearchForm,
  type LargoSearchFormProps,
} from '@/components/largo/search-form';
import type { StubLargoAdviceInput } from '@/lib/largo/producer/stub';

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
// Local helpers
// -----------------------------------------------------------------------------

const noopOnSearch: (input: StubLargoAdviceInput) => void = () => {
  /* presentation tests don't observe the callback */
};

function renderForm(props?: Partial<LargoSearchFormProps>): string {
  return renderToStaticMarkup(
    <LargoSearchForm onSearch={noopOnSearch} {...props} />,
  );
}

const FORM_SOURCE = readFileSync(
  'components/largo/search-form.tsx',
  'utf-8',
);

// =============================================================================
// Tests (a–n + B1–B4 bonus)
// =============================================================================

// a. renders without throwing
test('a: renders without throwing with a no-op onSearch', () => {
  assert.doesNotThrow(() => renderForm());
  const html = renderForm();
  assert.ok(html.length > 0);
  assert.ok(html.startsWith('<form'));
});

// b. all 6 labels present
test('b: rendered HTML includes all 6 customer-facing labels', () => {
  const html = renderForm();
  for (const label of [
    'From',
    'To',
    'Departure date',
    'Return date',
    'Passengers',
    'Cabin class',
  ]) {
    assert.ok(html.includes(label), `expected label "${label}" in rendered HTML`);
  }
});

// c. accessible submit button
test('c: rendered HTML includes an accessible submit button', () => {
  const html = renderForm();
  assert.ok(
    /<button[^>]*type="submit"/.test(html),
    'expected <button type="submit"> in rendered HTML',
  );
  // The button has visible text "Search" plus an aria-label.
  assert.ok(html.includes('Search'));
  assert.ok(html.includes('aria-label="Search"'));
});

// d. disabled={true} adds disabled attribute to inputs/select/button.
test('d: disabled={true} renders ≥7 disabled="" attributes', () => {
  const htmlDisabled = renderForm({ disabled: true });
  const disabledAttrCount = (htmlDisabled.match(/disabled=""/g) ?? []).length;
  // 2 text + 2 date + 1 number + 1 select + 1 button = 7 elements.
  assert.ok(
    disabledAttrCount >= 7,
    `expected ≥7 disabled="" attributes when disabled=true, got ${disabledAttrCount}`,
  );
});

// d2. default mode renders no disabled="" attribute.
test('d2: disabled={false} (default) renders 0 disabled="" attributes', () => {
  const htmlDefault = renderForm();
  const disabledAttrCount = (htmlDefault.match(/disabled=""/g) ?? []).length;
  assert.strictEqual(
    disabledAttrCount,
    0,
    `expected 0 disabled="" attributes by default, got ${disabledAttrCount}`,
  );
});

// e. className preserved on root.
test('e: className is preserved on the root form element', () => {
  const html = renderForm({ className: 'custom-largo-form-class' });
  assert.ok(html.includes('custom-largo-form-class'));
  // Sanity: the root is <form>, not a wrapper div.
  assert.ok(/<form[^>]*custom-largo-form-class/.test(html));
});

// f. initialValues appear as defaultValue.
test('f: initialValues appear as defaultValue on rendered inputs', () => {
  const html = renderForm({
    initialValues: {
      origin_iata: 'JFK',
      destination_iata: 'NRT',
      departure_date: '2026-06-12',
      return_date: '2026-06-26',
      passengers: 2,
      cabin_class: 'business',
    },
  });
  assert.ok(html.includes('JFK'), 'expected origin "JFK" in rendered HTML');
  assert.ok(html.includes('NRT'), 'expected destination "NRT" in rendered HTML');
  assert.ok(
    html.includes('2026-06-12'),
    'expected departure date "2026-06-12" in rendered HTML',
  );
  assert.ok(
    html.includes('2026-06-26'),
    'expected return date "2026-06-26" in rendered HTML',
  );
  // For the select, the "selected" attribute lands on the matching option.
  // Verify the cabin label appears (it always does — all 4 options render).
  assert.ok(html.includes('Business'));
});

// g. Phase 1 booking-disabled notice present.
test('g: rendered HTML contains the customer-safe preview-only booking notice', () => {
  const html = renderForm();
  assert.ok(
    html.includes('Preview only. Automatic booking is not yet available.'),
    'expected the literal Phase 1 booking-disabled notice',
  );
});

// h. no `%` character.
test('h: rendered HTML never contains a "%" character', () => {
  const html = renderForm();
  const htmlDisabled = renderForm({ disabled: true });
  const htmlInitial = renderForm({
    initialValues: { origin_iata: 'CDG', destination_iata: 'JFK' },
  });
  assert.ok(!html.includes('%'));
  assert.ok(!htmlDisabled.includes('%'));
  assert.ok(!htmlInitial.includes('%'));
});

// i. no raw model/provider/admin/debug values.
test('i: rendered HTML never contains raw model/provider/admin/debug tokens', () => {
  const html = renderForm({
    initialValues: { origin_iata: 'CDG', destination_iata: 'JFK', passengers: 2 },
  });
  const FORBIDDEN_RENDERED = [
    '0.142',
    '14.2',
    'q10',
    'q50',
    'q90',
    'model_version',
    'technical_details',
    'audit_block',
    'audit_id',
    'debug',
    'admin',
    'internal',
  ];
  for (const token of FORBIDDEN_RENDERED) {
    const re = new RegExp(`\\b${token}\\b`);
    assert.ok(
      !re.test(html),
      `forbidden token "${token}" appears in rendered HTML`,
    );
  }
});

// j. import allow-list (precise, not substring).
test('j: form source imports only the allowed modules', () => {
  // Extract every `from "..."` path in the source.
  const importStatements = FORM_SOURCE.match(/from\s+['"][^'"]+['"]/g) ?? [];
  const importedPaths = importStatements
    .map((stmt) => {
      const m = stmt.match(/from\s+['"]([^'"]+)['"]/);
      return m ? m[1] : '';
    })
    .filter((p) => p.length > 0);

  // Allow-list: only React (runtime) and StubLargoAdviceInput (type-only).
  const ALLOWED_IMPORTS = ['react', '@/lib/largo/producer/stub'];

  for (const path of importedPaths) {
    assert.ok(
      ALLOWED_IMPORTS.includes(path),
      `unexpected import path "${path}". Only allowed: ${ALLOWED_IMPORTS.join(', ')}`,
    );
  }
  // Sanity: at least 2 imports (React + the type).
  assert.ok(
    importedPaths.length >= 2,
    `expected ≥2 imports, got ${importedPaths.length}`,
  );
});

// j2. The producer-stub import is type-only (no runtime symbol).
test('j2: form source imports `StubLargoAdviceInput` as a type, not a runtime symbol', () => {
  // The type-only import statement uses `import type { ... }` syntax.
  const re = /import\s+type\s+\{\s*StubLargoAdviceInput\s*\}\s+from\s+['"]@\/lib\/largo\/producer\/stub['"]/;
  assert.ok(
    re.test(FORM_SOURCE),
    'expected `import type { StubLargoAdviceInput } from "@/lib/largo/producer/stub"`',
  );
});

// k. no forbidden function calls.
test('k: form source does not call forbidden runtime functions', () => {
  const FORBIDDEN_CALLS = [
    'fetch(',
    'produceStubLargoAdvice(',
    'validateLargoAdvice(',
    'validateCustomerSafeAdvice(',
    'stripToCustomerSafe(',
  ];
  for (const call of FORBIDDEN_CALLS) {
    assert.ok(
      !FORM_SOURCE.includes(call),
      `forbidden function call "${call}" found in form source`,
    );
  }
});

// l. props type with required onSearch only.
test('l: LargoSearchFormProps is exported and assignable with required onSearch only', () => {
  const props: LargoSearchFormProps = { onSearch: noopOnSearch };
  assert.strictEqual(typeof props.onSearch, 'function');
  assert.strictEqual(props.className, undefined);
  assert.strictEqual(props.disabled, undefined);
  assert.strictEqual(props.initialValues, undefined);
  // Render with required-only props.
  assert.doesNotThrow(() => renderForm());
});

// m. props type accepts all optional props.
test('m: LargoSearchFormProps accepts className, disabled, initialValues', () => {
  const props: LargoSearchFormProps = {
    onSearch: noopOnSearch,
    className: 'x',
    disabled: true,
    initialValues: {
      origin_iata: 'JFK',
      destination_iata: 'NRT',
      passengers: 2,
      cabin_class: 'first',
    },
  };
  assert.doesNotThrow(() => renderForm(props));
});

// n. determinism.
test('n: same props render to byte-equal static markup', () => {
  const a = renderForm({ initialValues: { origin_iata: 'JFK', passengers: 1 } });
  const b = renderForm({ initialValues: { origin_iata: 'JFK', passengers: 1 } });
  assert.strictEqual(a, b);
});

test('n2: determinism holds with disabled=true and full initialValues', () => {
  const props: LargoSearchFormProps = {
    onSearch: noopOnSearch,
    disabled: true,
    initialValues: {
      origin_iata: 'JFK',
      destination_iata: 'NRT',
      departure_date: '2026-06-12',
      return_date: '2026-06-26',
      passengers: 2,
      cabin_class: 'business',
    },
  };
  const a = renderToStaticMarkup(<LargoSearchForm {...props} />);
  const b = renderToStaticMarkup(<LargoSearchForm {...props} />);
  assert.strictEqual(a, b);
});

// =============================================================================
// Bonus invariants (defense in depth)
// =============================================================================

// B1. Hardened-away labels never appear (parity with AdviceCard hardening).
test('B1: rendered HTML never contains "User:", "Mission:", "Schema version", "Part of bundle", "Freshness:"', () => {
  const html = renderForm();
  for (const marker of [
    'User:',
    'Mission:',
    'Schema version',
    'Part of bundle',
    'Freshness:',
  ]) {
    assert.ok(
      !html.includes(marker),
      `forbidden label "${marker}" in rendered HTML`,
    );
  }
});

// B2. No Buy / Reserve / Book CTA (button or link).
test('B2: rendered HTML contains no Buy / Reserve / Book CTA', () => {
  const html = renderForm();
  assert.ok(!/<button[^>]*>(\s*)?Buy now/i.test(html));
  assert.ok(!/<button[^>]*>(\s*)?Reserve/i.test(html));
  assert.ok(!/<button[^>]*>(\s*)?Book/i.test(html));
  assert.ok(!/<a[^>]+href[^>]*>(\s*)?Buy now/i.test(html));
  assert.ok(!/<a[^>]+href[^>]*>(\s*)?Reserve/i.test(html));
});

// B3. Each input has an associated <label for=...>.
test('B3: rendered HTML uses semantic <label> with htmlFor (for) attribute, ≥6', () => {
  const html = renderForm();
  // React renders htmlFor as for=.
  const labelCount = (html.match(/<label[^>]*\bfor=/g) ?? []).length;
  assert.ok(
    labelCount >= 6,
    `expected ≥6 <label for=...> elements, got ${labelCount}`,
  );
});

// B4. Cabin class select renders all 4 valid options.
test('B4: cabin_class select renders all 4 valid cabin labels', () => {
  const html = renderForm();
  assert.ok(html.includes('Economy'));
  assert.ok(html.includes('Premium Economy'));
  assert.ok(html.includes('Business'));
  assert.ok(html.includes('First'));
});

// B5. The form root carries the largo-search-form data-section attribute.
test('B5: rendered HTML root form carries data-section="largo-search-form"', () => {
  const html = renderForm();
  assert.ok(html.includes('data-section="largo-search-form"'));
});

// B6. Form has aria-label and noValidate (no native bubble validation).
test('B6: form root has aria-label and noValidate=""', () => {
  const html = renderForm();
  assert.ok(html.includes('aria-label="Search travel advice"'));
  // React renders noValidate as novalidate (lowercase).
  assert.ok(/<form[^>]*\bnovalidate/i.test(html));
});

// B7. Non-mutation: the initialValues object reference is not mutated.
test('B7: rendering does not mutate the initialValues object', () => {
  const initialValues: Partial<StubLargoAdviceInput> = {
    origin_iata: 'JFK',
    destination_iata: 'NRT',
    passengers: 2,
    cabin_class: 'economy',
  };
  const snapshot = JSON.parse(JSON.stringify(initialValues));
  renderForm({ initialValues });
  renderForm({ initialValues, disabled: true });
  assert.deepStrictEqual(initialValues, snapshot);
});

// =============================================================================
// Self-running entry point
// =============================================================================

runAll();
