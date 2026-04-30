'use client';

/**
 * Largo — `LargoSearchForm` (Sprint 3.4, B1, third UI component).
 *
 * Pure presentation form for entering basic flight search criteria. Emits
 * a `StubLargoAdviceInput`-shaped object to the parent via `onSearch` on
 * submit. The form does not call any upstream service, validator, strip
 * function, or producer runtime — it only collects input fields, normalizes
 * them, and hands the resulting object back to its caller.
 *
 * Discipline:
 *  - PRESENTATIONAL ONLY. The submit handler emits an input object via
 *    callback; the parent decides what to do with it.
 *  - SAFE BY TYPE. The only Largo type imported is `StubLargoAdviceInput`
 *    from `@/lib/largo/producer/stub` (type-only import — no runtime
 *    function reaches this file).
 *  - CLIENT COMPONENT. The form needs an `onSubmit` event handler; the
 *    'use client' directive at the top of the file is required.
 *  - DETERMINISTIC RENDER. Static rendering produces byte-equal markup for
 *    the same props. `new Date().toISOString()` is used only inside the
 *    submit handler, never during render — so `renderToStaticMarkup`
 *    output is stable.
 *  - NORMALIZATION on submit:
 *      • origin / destination: trimmed, uppercased
 *      • passengers: parseInt with safe fallback to 1
 *      • return_date: empty string → null (one-way)
 *      • surface: defaulted to 'simple_search'
 *      • observed_price_usd, primary_provider: null (not yet known)
 *      • route_known_to_model: false (not yet known)
 *      • now_iso: current ISO timestamp (event-time only)
 *  - NO PAYMENT SURFACE. No "Buy now" button. The literal disabled-booking
 *    notice "Automatic booking is not yet available" is displayed.
 *  - NO LEAK. Renders no operator-only field, no debug payload, no raw
 *    confidence value, no percent character. The companion test scans
 *    both the static rendering and the source for forbidden patterns.
 *
 * Sources of truth:
 *  - Sprint 1.2: `StubLargoAdviceInput` type contract (producer stub).
 *  - Sprint 3.1 + Impeccable hardening: customer-safe copy conventions
 *    (`Automatic booking is not yet available`).
 *  - Sprint 3.2 + 3.3: Tailwind / dark-mode style alignment.
 *
 * Out of scope (deferred):
 *  - i18n / localized labels (Phase 2+).
 *  - Live route validation (Phase 1 = no upstream calls).
 *  - Multi-leg / open-jaw search (Phase 1 = simple round-trip / one-way).
 *  - Skeleton / loading state (caller decides).
 *  - Form-level validation messages (kept minimal; HTML5 attributes only).
 */

import * as React from 'react';
import type { StubLargoAdviceInput } from '@/lib/largo/producer/stub';

// -----------------------------------------------------------------------------
// Public props
// -----------------------------------------------------------------------------

export interface LargoSearchFormProps {
  /** Called once on submit with the normalized input object. */
  onSearch: (input: StubLargoAdviceInput) => void;
  /** Optional class additions for layout integration. */
  className?: string;
  /** When true, every field and the submit button are disabled. */
  disabled?: boolean;
  /** Optional partial pre-fill applied as `defaultValue` on each field. */
  initialValues?: Partial<StubLargoAdviceInput>;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const DEFAULT_PASSENGERS = 1;
const DEFAULT_CABIN: StubLargoAdviceInput['cabin_class'] = 'economy';
const PHASE_1_BOOKING_NOTICE =
  'Preview only. Automatic booking is not yet available.';

const CABIN_OPTIONS: ReadonlyArray<{
  value: StubLargoAdviceInput['cabin_class'];
  label: string;
}> = [
  { value: 'economy', label: 'Economy' },
  { value: 'premium_economy', label: 'Premium Economy' },
  { value: 'business', label: 'Business' },
  { value: 'first', label: 'First' },
];

// -----------------------------------------------------------------------------
// Pure normalization helpers (no I/O, no state)
// -----------------------------------------------------------------------------

function normalizeAirportCode(raw: string): string {
  return raw.trim().toUpperCase();
}

function normalizePassengers(raw: string): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PASSENGERS;
}

function normalizeReturnDate(raw: string): string | null {
  return raw === '' ? null : raw;
}

function isCabinClass(
  value: string,
): value is StubLargoAdviceInput['cabin_class'] {
  return (
    value === 'economy' ||
    value === 'premium_economy' ||
    value === 'business' ||
    value === 'first'
  );
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function LargoSearchForm({
  onSearch,
  className,
  disabled = false,
  initialValues,
}: LargoSearchFormProps): JSX.Element {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (disabled) return;

    const formData = new FormData(event.currentTarget);
    const origin = normalizeAirportCode(String(formData.get('origin') ?? ''));
    const destination = normalizeAirportCode(
      String(formData.get('destination') ?? ''),
    );
    const departureDate = String(formData.get('departure_date') ?? '');
    const returnDateRaw = String(formData.get('return_date') ?? '');
    const passengersRaw = String(formData.get('passengers') ?? `${DEFAULT_PASSENGERS}`);
    const cabinRaw = String(formData.get('cabin_class') ?? DEFAULT_CABIN);
    const cabin = isCabinClass(cabinRaw) ? cabinRaw : DEFAULT_CABIN;

    const input: StubLargoAdviceInput = {
      surface: 'simple_search',
      origin_iata: origin,
      destination_iata: destination,
      departure_date: departureDate,
      return_date: normalizeReturnDate(returnDateRaw),
      passengers: normalizePassengers(passengersRaw),
      cabin_class: cabin,
      observed_price_usd: null,
      primary_provider: null,
      route_known_to_model: false,
      now_iso: new Date().toISOString(),
    };

    onSearch(input);
  };

  // Default values from initialValues (no fallback strings — empty strings
  // are valid for type=date and type=text inputs in HTML).
  const defaultOrigin = initialValues?.origin_iata ?? '';
  const defaultDestination = initialValues?.destination_iata ?? '';
  const defaultDeparture = initialValues?.departure_date ?? '';
  const defaultReturn = initialValues?.return_date ?? '';
  const defaultPassengers =
    initialValues?.passengers ?? DEFAULT_PASSENGERS;
  const defaultCabin = initialValues?.cabin_class ?? DEFAULT_CABIN;

  const baseClass =
    'block rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 sm:p-6 text-sm text-gray-900 dark:text-gray-100';
  const fullClass = className ? `${baseClass} ${className}` : baseClass;

  const inputBaseClass =
    'w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 disabled:opacity-50';
  const codeInputClass = `${inputBaseClass} font-mono uppercase`;

  return (
    <form
      onSubmit={handleSubmit}
      className={fullClass}
      data-section="largo-search-form"
      aria-label="Search travel advice"
      noValidate
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="largo-search-origin"
              className="block text-xs font-medium mb-1"
            >
              From
            </label>
            <input
              id="largo-search-origin"
              name="origin"
              type="text"
              defaultValue={defaultOrigin ?? ''}
              disabled={disabled}
              placeholder="JFK"
              maxLength={3}
              autoComplete="off"
              spellCheck={false}
              className={codeInputClass}
            />
          </div>
          <div>
            <label
              htmlFor="largo-search-destination"
              className="block text-xs font-medium mb-1"
            >
              To
            </label>
            <input
              id="largo-search-destination"
              name="destination"
              type="text"
              defaultValue={defaultDestination ?? ''}
              disabled={disabled}
              placeholder="NRT"
              maxLength={3}
              autoComplete="off"
              spellCheck={false}
              className={codeInputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="largo-search-departure"
              className="block text-xs font-medium mb-1"
            >
              Departure date
            </label>
            <input
              id="largo-search-departure"
              name="departure_date"
              type="date"
              defaultValue={defaultDeparture ?? ''}
              disabled={disabled}
              className={inputBaseClass}
            />
          </div>
          <div>
            <label
              htmlFor="largo-search-return"
              className="block text-xs font-medium mb-1"
            >
              Return date
            </label>
            <input
              id="largo-search-return"
              name="return_date"
              type="date"
              defaultValue={defaultReturn ?? ''}
              disabled={disabled}
              className={inputBaseClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="largo-search-passengers"
              className="block text-xs font-medium mb-1"
            >
              Passengers
            </label>
            <input
              id="largo-search-passengers"
              name="passengers"
              type="number"
              defaultValue={defaultPassengers}
              disabled={disabled}
              min={1}
              max={9}
              className={inputBaseClass}
            />
          </div>
          <div>
            <label
              htmlFor="largo-search-cabin"
              className="block text-xs font-medium mb-1"
            >
              Cabin class
            </label>
            <select
              id="largo-search-cabin"
              name="cabin_class"
              defaultValue={defaultCabin}
              disabled={disabled}
              className={inputBaseClass}
            >
              {CABIN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <p
            className="text-xs italic text-gray-500 dark:text-gray-400"
            data-section="largo-search-form-notice"
          >
            {PHASE_1_BOOKING_NOTICE}
          </p>
          <button
            type="submit"
            disabled={disabled}
            aria-label="Search"
            className="rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Search
          </button>
        </div>
      </div>
    </form>
  );
}

export default LargoSearchForm;
