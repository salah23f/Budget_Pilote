/**
 * Largo — interactive search demo page (server component, Sprint 3.5, B1).
 *
 * Thin Next.js App Router server component that wraps the interactive
 * client child (`LargoSearchDemoClient`). The split keeps the page
 * shell renderable as a Server Component (fast, SEO-friendly title)
 * while delegating React state and event handling to the client child.
 *
 * Discipline:
 *  - SERVER COMPONENT. Synchronous, returns JSX. No async, no fetch,
 *    no upstream call. No data dependency.
 *  - DEMO-ONLY. This page is a bridge between the merged search form
 *    and the merged customer-safe rendering pipeline. It is never wired
 *    to a real flight pipeline, never persists anything, never exposes
 *    operator-only fields.
 *  - SCOPED. This file imports only its sibling client component. The
 *    pipeline + UI imports live in the client child.
 *
 * Sources of truth:
 *  - Sprint 3.4: `LargoSearchForm` (used by the client child).
 *  - Sprint 3.2: `LargoAdviceList` (used by the client child).
 *  - Sprint 1.x + 2.3: customer-safe pipeline (used by the client child).
 *  - Sprint 3.3: demo preview page chrome conventions.
 *
 * Out of scope (deferred):
 *  - i18n / localized strings (Phase 2+).
 *  - Saved searches, history, persistence (Phase 2+).
 *  - Live data of any kind (Phase 2+ after the cohort gate; absolutely
 *    denied in B1).
 */

import * as React from 'react';
import { LargoSearchDemoClient } from './largo-search-demo-client';

export default function LargoSearchDemoPage(): JSX.Element {
  return (
    <main
      className="mx-auto max-w-3xl px-4 py-8"
      data-section="largo-search-demo"
    >
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Largo — Search demo</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Preview only. Use the form below to see a customer-safe Largo
          recommendation rendered through the merged pure pipeline.
        </p>
      </header>

      <LargoSearchDemoClient />
    </main>
  );
}
