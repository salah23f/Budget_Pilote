/**
 * Largo — demo preview page (Sprint 3.3, B1).
 *
 * Server Component composing the merged customer-safe pipeline:
 *   13 LargoAdvice fixtures → validateLargoAdvice → stripToCustomerSafe →
 *   validateCustomerSafeAdvice → CustomerSafeAdvice[] → LargoAdviceList.
 *
 * Static preview of the customer-safe advice surface. Each card below is
 * produced by the merged pure pipeline on a hand-built fixture, then
 * rendered via the LargoAdviceList component. This page makes no upstream
 * calls, runs no business logic, and exists solely to inspect rendering.
 *
 * Discipline:
 *  - PURE / DETERMINISTIC. No state, no effects, no hooks, no Date.now(),
 *    no Math.random(). Same module evaluation produces the same output.
 *  - SAFE BY TYPE. The only Largo types in scope are LargoAdvice (input
 *    to the pipeline) and CustomerSafeAdvice (output, rendered).
 *  - SERVER-RENDERABLE. Server Component only; no DOM-only API.
 *    The client-side hydration directive is intentionally absent so this
 *    file stays renderable through the static markup pipeline.
 *  - NON-WIRED. This file imports zero runtime modules outside of React,
 *    the merged Largo pipeline functions, the LargoAdviceList component,
 *    and the existing fixtures. The companion source-scan test enforces
 *    this.
 *  - DELEGATING. All advice-field rendering happens inside the merged
 *    LargoAdviceList; this page is composition only.
 *
 * Sources of truth:
 *  - Sprint 1.1: stripToCustomerSafe
 *  - Sprint 1.2: produceStubLargoAdvice (transitively, via fixtures)
 *  - Sprint 1.3: validateLargoAdvice
 *  - Sprint 2.1: 13 extended LargoAdvice fixtures
 *  - Sprint 2.3: validateCustomerSafeAdvice
 *  - Sprint 3.1 + Impeccable hardening: LargoAdviceCard
 *  - Sprint 3.2: LargoAdviceList
 */

import * as React from 'react';
import { LargoAdviceList } from '@/components/largo/advice-list';
import { stripToCustomerSafe } from '@/lib/largo/safe-view/strip';
import { validateLargoAdvice } from '@/lib/largo/validator/advice-validator';
import { validateCustomerSafeAdvice } from '@/lib/largo/validator/customer-safe-validator';
import { extendedLargoAdviceFixtures } from '@/tests/largo/fixtures/largo-advice-extended.fixture';
import type { LargoAdvice } from '@/types/largo/advice';
import type { CustomerSafeAdvice } from '@/types/largo/customer-safe-advice';

// -----------------------------------------------------------------------------
// Pipeline composition (pure, run once at module evaluation)
// -----------------------------------------------------------------------------

/**
 * Take a hand-built LargoAdvice fixture through the full merged pipeline:
 * shape-validate → strip to customer-safe view → re-validate at the
 * customer-safe boundary → return the typed CustomerSafeAdvice.
 *
 * Throws (via `Error`) if any stage rejects. The 13 catalog fixtures are
 * known-valid per Sprint 2.1 tests, so this never throws in practice on
 * the existing input set; the throws exist to surface fixture drift
 * loudly during preview rendering rather than silently displaying an
 * empty card list.
 */
function pipelineLargoToCustomerSafe(advice: LargoAdvice): CustomerSafeAdvice {
  const validatedLargo = validateLargoAdvice(advice);
  if (!validatedLargo.ok) {
    throw new Error(
      `pipelineLargoToCustomerSafe: validateLargoAdvice rejected fixture ${advice.advice_id}`,
    );
  }
  const stripped = stripToCustomerSafe(validatedLargo.value);
  const validatedCs = validateCustomerSafeAdvice(stripped);
  if (!validatedCs.ok) {
    throw new Error(
      `pipelineLargoToCustomerSafe: validateCustomerSafeAdvice rejected stripped fixture ${advice.advice_id}`,
    );
  }
  return validatedCs.value;
}

/**
 * Module-level constant: all 13 fixtures, taken end-to-end through the
 * pipeline. Computed once when the module loads, frozen at the type
 * level via `ReadonlyArray`.
 */
const customerSafeAdvices: ReadonlyArray<CustomerSafeAdvice> =
  extendedLargoAdviceFixtures.map(pipelineLargoToCustomerSafe);

// -----------------------------------------------------------------------------
// Page (default export — Next.js App Router convention)
// -----------------------------------------------------------------------------

export default function LargoDemoPreviewPage(): JSX.Element {
  return (
    <main
      className="mx-auto max-w-3xl px-4 py-8"
      data-section="largo-demo-preview"
    >
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Largo — Demo preview</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Static preview of the customer-safe advice surface. Each card
          below is produced by the merged pure pipeline on a hand-built
          fixture, then rendered via the LargoAdviceList component. This
          page makes no upstream calls, runs no business logic, and exists
          solely to inspect rendering.
        </p>
      </header>

      <LargoAdviceList
        adviceItems={customerSafeAdvices}
        compactCards={false}
      />
    </main>
  );
}
