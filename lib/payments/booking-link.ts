/**
 * Booking deep-link resolver.
 *
 * After the AI agent commits to an offer (either auto-buy or
 * user-confirmed), we hand the user a deep-link that lands them
 * directly on Kiwi's checkout with the exact flight pre-selected. Kiwi
 * is IATA-accredited and completes the actual purchase — we stay
 * legally clean (no IATA license required) while giving the user a
 * one-click finish.
 *
 * If the offer already has a Kiwi bookingUrl (it does whenever it was
 * sourced from the Kiwi provider in lib/amadeus/kiwi.ts), we use that
 * as-is. Otherwise we fall back to a Kiwi search URL that reproduces
 * the exact route + date so the user can confirm in one step.
 */

import type { Offer } from '../types';

export interface BookingDeepLink {
  url: string;
  provider: 'kiwi-direct' | 'kiwi-search';
  confidence: 'exact' | 'route-only';
}

function formatDmy(iso: string): string {
  // Kiwi search URLs use DD/MM/YYYY
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function buildBookingDeepLink(
  offer: Offer,
  params: {
    origin: string;
    destination: string;
    departDate: string;
    returnDate?: string;
    adults: number;
    cabinClass?: string;
  }
): BookingDeepLink {
  const raw: any = offer.rawData || {};

  // Preferred: provider returned a signed deep-link (Kiwi's /en/booking/?token=...)
  if (typeof raw.deepLink === 'string' && raw.deepLink.startsWith('https://www.kiwi.com')) {
    return {
      url: raw.deepLink,
      provider: 'kiwi-direct',
      confidence: 'exact',
    };
  }

  // Fallback: search URL that reproduces the same route/date
  const origin = (raw.originIata || params.origin || '').toUpperCase();
  const dest = (raw.destinationIata || params.destination || '').toUpperCase();
  const cabin = (params.cabinClass || 'M').toUpperCase().startsWith('BUS')
    ? 'C'
    : (params.cabinClass || 'M').toUpperCase().startsWith('FIRST')
    ? 'F'
    : (params.cabinClass || 'M').toUpperCase().startsWith('PREM')
    ? 'W'
    : 'M';

  const dep = formatDmy(params.departDate);
  const ret = params.returnDate ? formatDmy(params.returnDate) : '';

  const url = new URL('https://www.kiwi.com/en/search/results/');
  url.pathname += `${origin}/${dest}/${dep}${ret ? `/${ret}` : ''}`;
  url.searchParams.set('adults', String(params.adults || 1));
  url.searchParams.set('cabinClass', cabin);
  url.searchParams.set('sortBy', 'price');

  return {
    url: url.toString(),
    provider: 'kiwi-search',
    confidence: 'route-only',
  };
}
