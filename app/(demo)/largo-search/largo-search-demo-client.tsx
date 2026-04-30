'use client';

/**
 * Largo — interactive search demo (client component, Sprint 3.5, B1).
 *
 * Pure React state machine that wires the merged Sprint 3.4 search form
 * to the merged customer-safe pipeline. On each form submission, the
 * emitted `StubLargoAdviceInput` is run through:
 *
 *   produceStubLargoAdvice
 *     → validateLargoAdvice
 *     → stripToCustomerSafe
 *     → validateCustomerSafeAdvice
 *     → CustomerSafeAdvice
 *     → <LargoAdviceList adviceItems={[result]} />
 *
 * Discipline:
 *  - CLIENT COMPONENT. Required because the form needs an `onSearch`
 *    callback bound to React state. The 'use client' directive at the
 *    top of the file is mandatory.
 *  - PURE STATE MACHINE. The component holds a tagged union state:
 *      { kind: 'idle' } | { kind: 'success'; advice } | { kind: 'error' }
 *    There is no I/O of any kind — no fetch, no upstream call, no
 *    side-effect outside React state.
 *  - DEFENSIVE. The pipeline is invoked inside a try/catch. If any stage
 *    rejects (validator returns ok:false) or throws, the state moves to
 *    'error' and the UI shows a generic customer-safe message. The
 *    underlying error message is NEVER rendered (it could carry
 *    operator-only details).
 *  - SAFE BY TYPE. Only `CustomerSafeAdvice` is passed to the list. The
 *    raw `LargoAdvice` produced by the stub is consumed locally and
 *    never escapes this component boundary.
 *  - NO COMMERCE SURFACE. No "Buy now" button. No purchase, reservation,
 *    or settlement flow. No live-data fetch. The form's literal
 *    disabled-booking notice (Sprint 3.1) is the only commerce-adjacent
 *    string visible in the UI.
 *
 * Sources of truth:
 *  - Sprint 1.1 strip: `stripToCustomerSafe`.
 *  - Sprint 1.2 producer: `produceStubLargoAdvice` (synchronous, pure).
 *  - Sprint 1.3 validator: `validateLargoAdvice`.
 *  - Sprint 2.3 customer-safe validator: `validateCustomerSafeAdvice`.
 *  - Sprint 3.1 + Impeccable: `LargoAdviceCard` (transitive, via list).
 *  - Sprint 3.2: `LargoAdviceList`.
 *  - Sprint 3.4: `LargoSearchForm`.
 *
 * Out of scope (deferred):
 *  - History of past searches (Sprint 4+).
 *  - Multi-result rendering (Phase 1 = single advice per search).
 *  - i18n / localized strings (Phase 2+).
 *  - Telemetry / analytics (denied — no upstream calls).
 */

import * as React from 'react';
import { LargoSearchForm } from '@/components/largo/search-form';
import { LargoAdviceList } from '@/components/largo/advice-list';
import {
  produceStubLargoAdvice,
  type StubLargoAdviceInput,
} from '@/lib/largo/producer/stub';
import { validateLargoAdvice } from '@/lib/largo/validator/advice-validator';
import { stripToCustomerSafe } from '@/lib/largo/safe-view/strip';
import { validateCustomerSafeAdvice } from '@/lib/largo/validator/customer-safe-validator';
import type { LargoAdvice } from '@/types/largo/advice';
import type { CustomerSafeAdvice } from '@/types/largo/customer-safe-advice';

// -----------------------------------------------------------------------------
// State machine
// -----------------------------------------------------------------------------

type DemoState =
  | { kind: 'idle' }
  | { kind: 'success'; advice: CustomerSafeAdvice }
  | { kind: 'error' };

const INITIAL_STATE: DemoState = { kind: 'idle' };

const IDLE_INSTRUCTION =
  'Enter a route above to preview a customer-safe Largo recommendation.';
const GENERIC_ERROR_MESSAGE =
  'We could not generate a preview right now.';

// -----------------------------------------------------------------------------
// Pipeline (pure, synchronous, never throws beyond return-typed result)
// -----------------------------------------------------------------------------

function runPipeline(
  input: StubLargoAdviceInput,
):
  | { kind: 'success'; advice: CustomerSafeAdvice }
  | { kind: 'error' } {
  let produced: LargoAdvice;
  try {
    produced = produceStubLargoAdvice(input);
  } catch {
    return { kind: 'error' };
  }
  const validated = validateLargoAdvice(produced);
  if (!validated.ok) return { kind: 'error' };
  const stripped = stripToCustomerSafe(validated.value);
  const validatedCs = validateCustomerSafeAdvice(stripped);
  if (!validatedCs.ok) return { kind: 'error' };
  return { kind: 'success', advice: validatedCs.value };
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function LargoSearchDemoClient(): JSX.Element {
  const [state, setState] = React.useState<DemoState>(INITIAL_STATE);

  const handleSearch = (input: StubLargoAdviceInput): void => {
    setState(runPipeline(input));
  };

  return (
    <div
      className="space-y-6"
      data-section="largo-search-demo-shell"
    >
      <LargoSearchForm onSearch={handleSearch} />

      {state.kind === 'idle' && (
        <p
          className="rounded-md border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 text-sm text-gray-600 dark:text-gray-400"
          data-section="largo-search-demo-idle"
          role="status"
          aria-live="polite"
        >
          {IDLE_INSTRUCTION}
        </p>
      )}

      {state.kind === 'error' && (
        <p
          className="rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 text-sm text-gray-600 dark:text-gray-400"
          data-section="largo-search-demo-error"
          role="status"
          aria-live="polite"
        >
          {GENERIC_ERROR_MESSAGE}
        </p>
      )}

      {state.kind === 'success' && (
        <div data-section="largo-search-demo-result">
          <LargoAdviceList
            adviceItems={[state.advice]}
            compactCards={false}
          />
        </div>
      )}
    </div>
  );
}

export default LargoSearchDemoClient;
