/**
 * Largo — `LargoAdviceCard` (Sprint 3.1, B1, first UI component).
 *
 * Pure presentational React component for the customer-safe Largo advice
 * surface. Consumes `CustomerSafeAdvice` (Sprint 1.1) and renders only
 * customer-renderable fields per `docs/b0/LARGO_FRONTEND_UX_SPEC.md` §4.
 *
 * Discipline:
 *  - PURE / DETERMINISTIC. No state, no effects, no hooks, no `Date.now()`,
 *    no `Math.random()`. Same props → byte-equal HTML.
 *  - SAFE BY TYPE. The only type imported is `CustomerSafeAdvice` from
 *    `@/types/largo/customer-safe-advice`. Operator-only fields enumerated
 *    in `LARGO_BACKEND_API_SPEC.md` §10 are NOT in that type, so the
 *    TypeScript compiler refuses to access them — they cannot leak by
 *    construction. The list of forbidden customer-side identifiers is
 *    audited from the test side (see `customer-safe-validator.ts`'s
 *    `FORBIDDEN_CUSTOMER_KEYS` set and the K1/K2 source-scan tests in
 *    `advice-card.test.tsx`); this source file mentions none of them by
 *    name on purpose so the K1 word-boundary scan stays clean.
 *  - SERVER-RENDERABLE. No `'use client'` directive; no DOM-only API.
 *    Renders via `renderToStaticMarkup` for tests and via Server
 *    Components in app code.
 *  - NEVER COERCE. `observed_price_usd === null` → "Price unavailable"
 *    (never "$0"). `primary_provider === null` → "Provider unavailable"
 *    (never invented).
 *  - NEVER NUMERIC CONFIDENCE. Only the semantic `confidence_label` is
 *    rendered (per `LARGO_BACKEND_API_SPEC.md` §10 + `CLAUDE_CODE_RULES.md`
 *    §11).
 *  - PHASE 1 LITERAL. The auto-buy notice is hard-coded
 *    "Auto-buy disabled in Phase 1" — the component never reads
 *    `can_autobuy` to decide whether to enable a button (per
 *    `CLAUDE_CODE_RULES.md` §10).
 *
 * Sources of truth:
 *  - `docs/b0/LARGO_ADVICE_CONTRACT.md` §3, §6 (`can_autobuy`), §8–§17.
 *  - `docs/b0/LARGO_BACKEND_API_SPEC.md` §10 (strip rule — the
 *    `CustomerSafeAdvice` type is its run-time projection).
 *  - `docs/b0/LARGO_FRONTEND_UX_SPEC.md` §4 (customer-safe view fields),
 *    §41 rows 1, 6, 7 (forbidden customer-side fields).
 *  - `docs/b1/B1_IMPLEMENTATION_PLAN.md` §4 anchors (Phase 1 = flights only,
 *    no auto-buy).
 *  - `docs/b1/CLAUDE_CODE_RULES.md` §10, §11, §15, §17, §18.
 *  - `docs/b1/FILE_ALLOW_DENY.md` §1.4 (`components/largo/**`).
 *
 * Out of scope (deferred):
 *  - Animations, color palette, dark mode (Sprint 4+).
 *  - i18n / localized strings (Phase 2+).
 *  - Click handlers, navigation, ticket booking (Phase 1 forbids).
 *  - Skeleton / loading state (caller decides when to render).
 */

// React must be in scope for JSX when this file is consumed via the
// `tsx` runner (see tests/largo/components/advice-card.test.tsx). The
// JSX transform configured in this repo does NOT auto-inject the React
// import for `.tsx` files run through `npx tsx`; an explicit namespace
// import keeps the component runnable in both Next.js and `tsx`.
import * as React from 'react';
import type { CustomerSafeAdvice } from '@/types/largo/customer-safe-advice';

// -----------------------------------------------------------------------------
// Public props
// -----------------------------------------------------------------------------

export interface LargoAdviceCardProps {
  /** The validated customer-safe advice payload. */
  advice: CustomerSafeAdvice;
  /** Optional class additions for layout integration. */
  className?: string;
  /**
   * Compact mode keeps the core (action, confidence, route, price/provider,
   * disagreement summary, auto-buy notice) and drops the secondary detail
   * (reasons list, anchor, footer with ids and validity). Useful for list
   * rendering.
   */
  compact?: boolean;
}

// -----------------------------------------------------------------------------
// Static text mappings (semantic only — never numeric)
// -----------------------------------------------------------------------------

const ACTION_HEADERS: Record<CustomerSafeAdvice['action'], string> = {
  BUY_NOW: 'Good time to buy',
  WAIT: 'Wait for now',
  MONITOR: 'Monitoring',
  ALERT: 'Price alert',
  ABSTAIN: 'Not enough reliable data',
};

const CONFIDENCE_PHRASES: Record<CustomerSafeAdvice['confidence_label'], string> = {
  high: 'high confidence',
  moderate: 'moderate confidence',
  limited: 'limited data',
  unavailable: 'data unavailable',
};

const DISAGREEMENT_PHRASES: Record<
  CustomerSafeAdvice['provider_info']['disagreement_summary'],
  string
> = {
  agree: 'Provider checks agree',
  disagree: 'Provider checks disagree',
  unknown: 'Provider checks unavailable',
};

type ReasonSeverity = CustomerSafeAdvice['reasons'][number]['severity'];

const SEVERITY_TAGS: Record<ReasonSeverity, string> = {
  positive: '[positive]',
  cautionary: '[cautionary]',
  blocking: '[blocking]',
  info: '[info]',
};

const PHASE_1_AUTOBUY_NOTICE = 'Auto-buy disabled in Phase 1';

// -----------------------------------------------------------------------------
// Pure formatting helpers (no state, no I/O)
// -----------------------------------------------------------------------------

/**
 * Render observed USD price. `null` → "Price unavailable" (never "$0",
 * never "0 USD" — the contract forbids fake-zero per
 * `LARGO_ADVICE_CONTRACT.md` §20 row 1).
 */
function formatPrice(price: number | null): string {
  if (price === null) return 'Price unavailable';
  return `${Math.round(price)} USD`;
}

/**
 * Render primary provider name. `null` → "Provider unavailable" (never
 * an invented placeholder per `LARGO_ADVICE_CONTRACT.md` §10).
 */
function formatProvider(name: string | null): string {
  if (name === null) return 'Provider unavailable';
  return name;
}

/** Render passenger count summary. Empty parts (count 0) are skipped. */
function formatPassengers(adults: number, children: number, infants: number): string {
  const parts: string[] = [];
  if (adults > 0) parts.push(`${adults} ${adults === 1 ? 'adult' : 'adults'}`);
  if (children > 0)
    parts.push(`${children} ${children === 1 ? 'child' : 'children'}`);
  if (infants > 0)
    parts.push(`${infants} ${infants === 1 ? 'infant' : 'infants'}`);
  return parts.length === 0 ? '0 passengers' : parts.join(', ');
}

/** Render anchor value when present. */
function formatAnchorValue(value: number | null): string | null {
  if (value === null) return null;
  return `${Math.round(value)} USD`;
}

/**
 * Strip any literal "%" character from customer-facing prose. The UI
 * never displays raw percentages — disagreement is conveyed via the
 * semantic `disagreement_summary` phrase, and anchor comparisons are
 * rendered as USD values. Any "%" appearing in upstream reason or
 * anchor prose is collapsed so the customer view stays free of
 * calibration-shaped tokens.
 *
 * Defense-in-depth on top of the `CustomerSafeAdvice` type, which
 * already drops the operator-only raw disagreement percentage and
 * calibrated confidence value at the type boundary.
 */
function customerSafeText(s: string): string {
  return s.replace(/%/g, '');
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * The Largo advice card. Pure, deterministic, server-renderable. Renders
 * only customer-safe fields. The component does not include any clickable
 * action ("Buy now" / "Reserve") because Phase 1 forbids live auto-buy and
 * provider-side execution from the UI layer.
 */
export function LargoAdviceCard({
  advice,
  className,
  compact = false,
}: LargoAdviceCardProps): JSX.Element {
  const actionHeader = ACTION_HEADERS[advice.action];
  const confidencePhrase = CONFIDENCE_PHRASES[advice.confidence_label];
  const disagreementPhrase =
    DISAGREEMENT_PHRASES[advice.provider_info.disagreement_summary];

  const isOneWay =
    advice.product_specific.is_round_trip === false ||
    advice.product_context.inbound_date === null;

  const passengerSummary = formatPassengers(
    advice.product_context.passengers_adults,
    advice.product_context.passengers_children,
    advice.product_context.passengers_infants,
  );

  const priceText = formatPrice(advice.price_observation.observed_price_usd);
  const providerText = formatProvider(advice.provider_info.primary_provider);

  const baseClass = 'block rounded-md border border-gray-200 bg-white p-4 text-sm';
  const fullClass = className ? `${baseClass} ${className}` : baseClass;

  return (
    <article
      role="article"
      aria-label={`Travel advice ${advice.advice_id}`}
      data-section="largo-advice-card"
      className={fullClass}
    >
      <header className="mb-3">
        <h2 className="text-lg font-semibold">{actionHeader}</h2>
        <p className="text-xs text-gray-500">
          <span aria-label={`confidence ${advice.confidence_label}`}>
            {confidencePhrase}
          </span>
          <span aria-hidden="true"> · </span>
          <span aria-label={`surface ${advice.surface}`}>{advice.surface}</span>
        </p>
      </header>

      <section data-section="route" className="mb-2">
        <p>
          <span className="font-mono">
            {advice.product_context.origin ?? 'Origin unknown'}
          </span>
          <span aria-hidden="true"> → </span>
          <span className="font-mono">
            {advice.product_context.destination ?? 'Destination unknown'}
          </span>
        </p>
        <p className="text-xs text-gray-500">
          <span>
            {advice.product_context.outbound_date ?? 'Date unavailable'}
          </span>
          {isOneWay ? (
            <span> · One-way</span>
          ) : (
            <>
              <span aria-hidden="true"> → </span>
              <span>{advice.product_context.inbound_date}</span>
            </>
          )}
          <span aria-hidden="true"> · </span>
          <span aria-label={`passengers ${passengerSummary}`}>
            {passengerSummary}
          </span>
        </p>
      </section>

      <section data-section="price-provider" className="mb-2">
        <dl>
          <dt className="sr-only">Price</dt>
          <dd>{priceText}</dd>
          <dt className="sr-only">Provider</dt>
          <dd className="text-xs text-gray-500">{providerText}</dd>
          {!compact && advice.provider_info.price_freshness_seconds !== null && (
            <>
              <dt className="sr-only">Price freshness</dt>
              <dd className="text-xs text-gray-500">
                Freshness: {advice.provider_info.price_freshness_seconds}s
              </dd>
            </>
          )}
        </dl>
      </section>

      <section data-section="disagreement" className="mb-2 text-xs text-gray-500">
        <span
          aria-label={`provider checks ${advice.provider_info.disagreement_summary}`}
        >
          {disagreementPhrase}
        </span>
      </section>

      {advice.short_message.length > 0 && (
        <section data-section="message" className="mb-2">
          <p>{customerSafeText(advice.short_message)}</p>
        </section>
      )}

      {!compact && advice.reasons.length > 0 && (
        <section data-section="reasons" className="mb-2">
          <ul className="list-disc pl-5">
            {advice.reasons.map((reason, idx) => (
              <li key={`${reason.code}-${idx}`} className="text-xs">
                <span aria-label={`severity ${reason.severity}`}>
                  {SEVERITY_TAGS[reason.severity]}
                </span>
                <span> {customerSafeText(reason.message)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!compact &&
        (() => {
          // Bind once after narrowing — avoids TS strict-mode narrowing churn
          // through nested closures on property paths.
          const anchor = advice.comparison_anchor;
          if (anchor === null) return null;
          const value = formatAnchorValue(anchor.anchor_value_usd);
          return (
            <section data-section="anchor" className="mb-2 text-xs text-gray-500">
              <span>{customerSafeText(anchor.description)}</span>
              {value !== null && <span> ({value})</span>}
            </section>
          );
        })()}

      <section data-section="autobuy" className="mb-2 text-xs italic">
        <span aria-label="auto-buy notice">{PHASE_1_AUTOBUY_NOTICE}</span>
      </section>

      {!compact && (
        <footer className="mt-3 border-t border-gray-200 pt-2 text-xs text-gray-500">
          <dl>
            <dt className="sr-only">Schema version</dt>
            <dd>v{advice.schema_version}</dd>
            <dt className="sr-only">Advice id</dt>
            <dd className="font-mono break-all">{advice.advice_id}</dd>
            <dt className="sr-only">Generated at</dt>
            <dd>
              <time dateTime={advice.generated_at}>
                Generated {advice.generated_at}
              </time>
            </dd>
            <dt className="sr-only">Valid until</dt>
            <dd>
              <time dateTime={advice.valid_until}>
                Valid until {advice.valid_until}
              </time>
            </dd>
            {advice.user_id !== null && (
              <>
                <dt className="sr-only">User</dt>
                <dd>User: {advice.user_id}</dd>
              </>
            )}
            {advice.mission_id !== null && (
              <>
                <dt className="sr-only">Mission</dt>
                <dd>Mission: {advice.mission_id}</dd>
              </>
            )}
            {advice.ml_available === false && (
              <>
                <dt className="sr-only">ML status</dt>
                <dd>Deep analysis unavailable</dd>
              </>
            )}
            {advice.bundle_context !== null && (
              <>
                <dt className="sr-only">Bundle</dt>
                <dd>
                  Part of bundle{' '}
                  <span className="font-mono">{advice.bundle_context.bundle_id}</span>{' '}
                  ({advice.bundle_context.component_role})
                </dd>
              </>
            )}
          </dl>
        </footer>
      )}
    </article>
  );
}

export default LargoAdviceCard;
