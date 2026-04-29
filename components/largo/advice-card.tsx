/**
 * Largo — `LargoAdviceCard` (Sprint 3.1, B1).
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
 *  - NEVER COERCE. `observed_price_usd === null` → "Price unavailable"
 *    (never "$0"). `primary_provider === null` → "Provider unavailable"
 *    (never invented).
 *  - NEVER NUMERIC CONFIDENCE. Only the semantic `confidence_label` is
 *    rendered.
 *  - PHASE 1 LITERAL. The booking notice is a hard-coded customer-friendly
 *    string — the component never reads `can_autobuy` to enable a button.
 *  - CUSTOMER-FACING ONLY. Fields useful only for operators (user_id,
 *    mission_id, schema_version, bundle_context, price_freshness_seconds)
 *    are intentionally not rendered even though the type permits them.
 */

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
   * disagreement summary, booking notice) and drops the secondary detail
   * (reasons list, anchor, footer with ref and validity). Useful for list
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

const SEVERITY_STYLES: Record<ReasonSeverity, { label: string; className: string }> = {
  positive: { label: 'Good', className: 'text-green-700 dark:text-green-400' },
  cautionary: { label: 'Note', className: 'text-amber-700 dark:text-amber-400' },
  blocking: { label: 'Important', className: 'text-red-700 dark:text-red-400' },
  info: { label: 'Info', className: 'text-gray-600 dark:text-gray-400' },
};

const PHASE_1_AUTOBUY_NOTICE = 'Automatic booking is not yet available';

// -----------------------------------------------------------------------------
// Pure formatting helpers (no state, no I/O)
// -----------------------------------------------------------------------------

/**
 * Render observed USD price. `null` → "Price unavailable" (never "$0",
 * never "0 USD" — the contract forbids fake-zero).
 */
function formatPrice(price: number | null): string {
  if (price === null) return 'Price unavailable';
  return `$${Math.round(price)}`;
}

/**
 * Render primary provider name. `null` → "Provider unavailable" (never
 * an invented placeholder).
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
  return `$${Math.round(value)}`;
}

/**
 * Strip any literal "%" character from customer-facing prose. The UI
 * never displays raw percentages — disagreement is conveyed via the
 * semantic `disagreement_summary` phrase, and anchor comparisons are
 * rendered as USD values.
 */
function customerSafeText(s: string): string {
  return s.replace(/%/g, '');
}

/** Show ISO timestamp as "YYYY-MM-DD at HH:MM" — pure, deterministic. */
function humanizeTimestamp(iso: string): string {
  return iso.slice(0, 16).replace('T', ' at ');
}

/** Truncate an ID to its last 6 characters for customer-facing display. */
function truncateId(id: string): string {
  return id.length > 6 ? id.slice(-6) : id;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function LargoAdviceCard({
  advice,
  className,
  compact = false,
}: LargoAdviceCardProps): JSX.Element {
  const actionHeader = ACTION_HEADERS[advice.action];
  const confidencePhrase = CONFIDENCE_PHRASES[advice.confidence_label];
  const disagreementPhrase =
    DISAGREEMENT_PHRASES[advice.provider_info.disagreement_summary];

  const origin = advice.product_context.origin ?? 'Origin unknown';
  const destination = advice.product_context.destination ?? 'Destination unknown';

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

  const baseClass =
    'block rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 sm:p-4 text-sm text-gray-900 dark:text-gray-100';
  const fullClass = className ? `${baseClass} ${className}` : baseClass;

  return (
    <article
      aria-label={`Travel advice: ${actionHeader}, ${origin} to ${destination}`}
      data-section="largo-advice-card"
      className={fullClass}
    >
      <header className="mb-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {actionHeader}
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <span aria-label={`confidence ${advice.confidence_label}`}>
            {confidencePhrase}
          </span>
          <span aria-hidden="true"> · </span>
          <span aria-label={`surface ${advice.surface}`}>{advice.surface}</span>
        </p>
      </header>

      <section data-section="route" className="mb-2">
        <p>
          <span className="font-mono">{origin}</span>
          <span aria-hidden="true"> → </span>
          <span className="font-mono">{destination}</span>
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
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

      <section data-section="price-provider" className="mb-3">
        <p
          className="text-xl font-bold text-gray-900 dark:text-gray-100"
          aria-label={`Price: ${priceText}`}
        >
          {priceText}
        </p>
        <p
          className="text-xs text-gray-500 dark:text-gray-400"
          aria-label={`Provider: ${providerText}`}
        >
          {providerText}
        </p>
      </section>

      <section data-section="disagreement" className="mb-2 text-xs text-gray-500 dark:text-gray-400">
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
          <ul className="list-none pl-0 space-y-1 sm:pl-2">
            {advice.reasons.map((reason, idx) => {
              const sev = SEVERITY_STYLES[reason.severity];
              return (
                <li key={`${reason.code}-${idx}`} className="text-xs leading-relaxed">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-[0.65rem] font-medium ${sev.className}`}
                    aria-label={`severity ${reason.severity}`}
                  >
                    {sev.label}
                  </span>
                  <span className="ml-1.5">{customerSafeText(reason.message)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!compact && advice.comparison_anchor !== null && (
        <section data-section="anchor" className="mb-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{customerSafeText(advice.comparison_anchor.description)}</span>
          {formatAnchorValue(advice.comparison_anchor.anchor_value_usd) !== null && (
            <span> ({formatAnchorValue(advice.comparison_anchor.anchor_value_usd)})</span>
          )}
        </section>
      )}

      <section data-section="autobuy" className="mb-2 text-xs italic text-gray-500 dark:text-gray-400">
        <span aria-label="booking notice">{PHASE_1_AUTOBUY_NOTICE}</span>
      </section>

      {!compact && (
        <footer className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-2 text-xs text-gray-500 dark:text-gray-400">
          <p className="font-mono">Ref: {truncateId(advice.advice_id)}</p>
          <p>
            <time dateTime={advice.generated_at}>
              Generated {humanizeTimestamp(advice.generated_at)}
            </time>
          </p>
          <p>
            <time dateTime={advice.valid_until}>
              Valid until {humanizeTimestamp(advice.valid_until)}
            </time>
          </p>
          {advice.ml_available === false && (
            <p>Deep analysis unavailable</p>
          )}
        </footer>
      )}
    </article>
  );
}

export default LargoAdviceCard;
