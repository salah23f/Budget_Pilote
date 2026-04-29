/**
 * Largo — `LargoAdviceList` (Sprint 3.2, B1, second UI component).
 *
 * Customer-facing list that renders a sequence of `LargoAdviceCard`s. Pure
 * presentational, server-renderable, accessible. Wraps the Sprint 3.1 card
 * with:
 *
 *  - empty-state rendering (with customizable title and message),
 *  - optional `maxItems` truncation (renders a stable prefix),
 *  - container-level accessibility (`role="region"`, list semantics),
 *  - `className` passthrough for layout integration.
 *
 * Discipline:
 *  - PURE / DETERMINISTIC. No state, no effects, no hooks, no `Date.now()`,
 *    no `Math.random()`. Same props → byte-equal HTML.
 *  - SAFE BY TYPE. The only Largo type imported is `CustomerSafeAdvice`
 *    from `@/types/largo/customer-safe-advice`. Operator-only fields
 *    enumerated in `LARGO_BACKEND_API_SPEC.md` §10 are NOT in that type.
 *    The list never reads them, by construction.
 *  - SERVER-RENDERABLE. No `'use client'`, no DOM-only API.
 *  - NON-MUTATING. The input `adviceItems` array is never reordered,
 *    spliced, or written to. Truncation uses `Array.prototype.slice`,
 *    which returns a fresh array. The original input reference is
 *    preserved for the no-`maxItems` path.
 *  - NO PAYMENT. No "Buy now" button, no booking link, no payment surface.
 *  - DELEGATING. Every advice field is rendered via `LargoAdviceCard`.
 *    This list does not access advice fields itself except `advice_id`
 *    for the React reconciler key (which is not rendered to HTML output).
 *  - DEFAULT COMPACT. `compactCards` defaults to `true` so the customer-
 *    facing list shape stays dense by default. The card's expanded
 *    footer (which would render `user_id`, `mission_id`, `schema_version`,
 *    `bundle_context`, `price_freshness_seconds`) is suppressed at the
 *    list level by default. Callers may override to `false` for
 *    operator-only contexts where those fields are wanted.
 *
 * `maxItems` semantics:
 *  - `maxItems` undefined  → renders every item.
 *  - `maxItems` >= length  → renders every item.
 *  - `maxItems` < length   → renders the first `maxItems` items in input
 *    order; the remainder is dropped.
 *  - `maxItems` === 0      → renders an empty list (`<ul>` with no `<li>`)
 *    inside the section. The empty STATE (the customizable title + message
 *    block) only fires when `adviceItems` itself is empty — that
 *    separation lets callers distinguish "no input" from "explicitly
 *    truncated to zero". Both are deterministic.
 *  - Negative `maxItems` is ignored (treated as undefined).
 *
 * Sources of truth:
 *  - `docs/b0/LARGO_FRONTEND_UX_SPEC.md` §4 (customer-safe view fields).
 *  - `docs/b1/CLAUDE_CODE_RULES.md` §10, §11, §15, §17, §18.
 *  - `docs/b1/FILE_ALLOW_DENY.md` §1.4 (`components/largo/**`).
 *  - Sprint 3.1's `LargoAdviceCard` — the rendering primitive composed
 *    here. Customer-safe invariants (no numeric confidence, no raw
 *    disagreement %, null price → "Price unavailable", null provider →
 *    "Provider unavailable", auto-buy notice literal) are enforced inside
 *    that primitive; the list preserves them by not introducing any new
 *    rendering path that touches advice fields.
 *
 * Out of scope (deferred):
 *  - Sorting / filtering controls (Sprint 4+).
 *  - Pagination UI (Sprint 4+).
 *  - i18n / localized strings (Phase 2+).
 *  - Click handlers, navigation, ticket booking (Phase 1 forbids).
 *  - Skeleton / loading state (caller decides when to render).
 */

// React must be in scope for JSX when this file is consumed via the
// `tsx` runner (see tests/largo/components/advice-list.test.tsx). The
// JSX transform configured in this repo does NOT auto-inject the React
// import for `.tsx` files run through `npx tsx`; an explicit namespace
// import keeps the component runnable in both Next.js and `tsx`.
import * as React from 'react';
import type { CustomerSafeAdvice } from '@/types/largo/customer-safe-advice';
import { LargoAdviceCard } from '@/components/largo/advice-card';

// -----------------------------------------------------------------------------
// Public props
// -----------------------------------------------------------------------------

export interface LargoAdviceListProps {
  /** The validated customer-safe advice payloads to render, in input order. */
  adviceItems: ReadonlyArray<CustomerSafeAdvice>;
  /** Optional class additions for layout integration. */
  className?: string;
  /**
   * Compact rendering for each card. Defaults to `true` so the list shape
   * stays dense for customer-facing surfaces. Set `false` to expose the
   * card's expanded footer (schema, ids, validity, bundle, freshness).
   */
  compactCards?: boolean;
  /** Heading text shown when `adviceItems` is empty. */
  emptyTitle?: string;
  /** Message text shown when `adviceItems` is empty. */
  emptyMessage?: string;
  /**
   * Maximum number of items to render. Negative or undefined → render
   * everything. `0` → render an empty list inside the section (distinct
   * from the empty-state block, which only fires when `adviceItems`
   * itself is empty).
   */
  maxItems?: number;
}

// -----------------------------------------------------------------------------
// Constants (defaults; safe for `node:assert` deep-equality)
// -----------------------------------------------------------------------------

const DEFAULT_EMPTY_TITLE = 'No advice available';
const DEFAULT_EMPTY_MESSAGE = 'There is nothing to show right now.';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Render a list of customer-safe advice cards. Pure, deterministic,
 * server-renderable. Delegates per-item rendering to `LargoAdviceCard`.
 */
export function LargoAdviceList({
  adviceItems,
  className,
  compactCards = true,
  emptyTitle = DEFAULT_EMPTY_TITLE,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  maxItems,
}: LargoAdviceListProps): JSX.Element {
  // Compute a stable visible prefix without mutating the input. When
  // `maxItems` is provided and non-negative, take a slice; otherwise the
  // original input array is used directly (read-only — `.map` does not
  // mutate it).
  const visibleItems =
    maxItems !== undefined && maxItems >= 0
      ? adviceItems.slice(0, maxItems)
      : adviceItems;

  const baseClass = 'flex flex-col gap-4';
  const fullClass = className ? `${baseClass} ${className}` : baseClass;

  // Empty-state block: only when the original input is itself empty.
  // `maxItems === 0` with non-empty input intentionally does NOT show
  // the empty-state title/message — the caller asked to render zero
  // items, not "input is empty".
  if (adviceItems.length === 0) {
    return (
      <section
        role="region"
        aria-label="Travel advice list"
        data-section="largo-advice-list"
        className={fullClass}
      >
        <div
          role="status"
          aria-live="polite"
          data-section="largo-advice-list-empty"
          className="rounded-md border border-gray-200 bg-white p-6 text-center"
        >
          <h2 className="text-base font-semibold">{emptyTitle}</h2>
          <p className="mt-1 text-sm text-gray-500">{emptyMessage}</p>
        </div>
      </section>
    );
  }

  // Non-empty input → render the (possibly truncated) list. When
  // `visibleItems.length === 0` (i.e. `maxItems === 0`), this renders an
  // empty `<ul>` inside the section — deterministic and distinct from
  // the empty-state block above.
  return (
    <section
      role="region"
      aria-label="Travel advice list"
      data-section="largo-advice-list"
      className={fullClass}
    >
      <ul
        data-section="largo-advice-list-items"
        className="flex flex-col gap-4 list-none p-0 m-0"
      >
        {visibleItems.map((advice) => (
          <li
            key={advice.advice_id}
            data-section="largo-advice-list-item"
            className="block"
          >
            <LargoAdviceCard advice={advice} compact={compactCards} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default LargoAdviceList;
