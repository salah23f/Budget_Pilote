import type { Offer, FlightSearchParams, CabinClass } from '../types';

/**
 * Amadeus Self-Service API integration — provides a second real flight
 * data source. Used as automatic backup when Sky-Scrapper's upstream is
 * unavailable for a given route.
 *
 * Get free credentials (2,000 calls/month) at:
 *   https://developers.amadeus.com/self-service
 *
 * Required env vars:
 *   AMADEUS_CLIENT_ID
 *   AMADEUS_CLIENT_SECRET
 *   AMADEUS_ENV=test|production  (defaults to test)
 */

const ENV = process.env.AMADEUS_ENV === 'production' ? 'production' : 'test';
const BASE = ENV === 'production' ? 'https://api.amadeus.com' : 'https://test.api.amadeus.com';

export function isAmadeusConfigured(): boolean {
  return !!(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET);
}

type Token = { accessToken: string; expiresAt: number };
let cachedToken: Token | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.accessToken;
  }
  const id = process.env.AMADEUS_CLIENT_ID!;
  const secret = process.env.AMADEUS_CLIENT_SECRET!;
  const res = await fetch(`${BASE}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: id,
      client_secret: secret,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Amadeus auth ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.accessToken;
}

/** Amadeus uses ISO city/airport codes. Resolve free-text to an IATA code. */
async function resolveIata(query: string): Promise<string | null> {
  const token = await getToken();
  const url = new URL(`${BASE}/v1/reference-data/locations`);
  url.searchParams.set('subType', 'CITY,AIRPORT');
  url.searchParams.set('keyword', query);
  url.searchParams.set('page[limit]', '5');
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const first = data?.data?.[0];
  return first?.iataCode || null;
}

const CABIN_MAP: Record<string, string> = {
  economy: 'ECONOMY',
  premium_economy: 'PREMIUM_ECONOMY',
  business: 'BUSINESS',
  first: 'FIRST',
};

/**
 * Search flights via Amadeus. Used as a **backup** when Sky-Scrapper's
 * upstream is down for a given route.
 */
export async function searchFlightsAmadeus(
  params: FlightSearchParams & { originIata?: string; destinationIata?: string }
): Promise<Offer[]> {
  if (!isAmadeusConfigured()) throw new Error('NO_AMADEUS');

  // Resolve IATA codes
  let originIata = params.originIata || (params.origin.length === 3 ? params.origin.toUpperCase() : null);
  let destIata = params.destinationIata || (params.destination.length === 3 ? params.destination.toUpperCase() : null);
  if (!originIata) originIata = await resolveIata(params.origin);
  if (!destIata) destIata = await resolveIata(params.destination);
  if (!originIata || !destIata) {
    throw new Error(`Amadeus could not resolve ${params.origin} → ${params.destination}`);
  }

  const token = await getToken();
  const url = new URL(`${BASE}/v2/shopping/flight-offers`);
  url.searchParams.set('originLocationCode', originIata);
  url.searchParams.set('destinationLocationCode', destIata);
  url.searchParams.set('departureDate', params.departDate);
  if (params.returnDate) url.searchParams.set('returnDate', params.returnDate);
  url.searchParams.set('adults', String(params.adults || 1));
  url.searchParams.set('travelClass', CABIN_MAP[params.cabinClass || 'economy']);
  url.searchParams.set('currencyCode', 'USD');
  url.searchParams.set('max', '30');
  if (params.nonStop) url.searchParams.set('nonStop', 'true');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Amadeus search ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();

  const rawOffers = data?.data || [];
  const carriers = data?.dictionaries?.carriers || {};

  const offers: Offer[] = rawOffers.map((it: any, i: number) => {
    const firstItinerary = it.itineraries?.[0];
    const firstSegment = firstItinerary?.segments?.[0];
    const lastSegment = firstItinerary?.segments?.[firstItinerary.segments.length - 1];
    const airlineCode = firstSegment?.carrierCode || '';
    const airlineName = carriers[airlineCode] || airlineCode;

    const durationStr: string = firstItinerary?.duration || 'PT0M';
    const durMatch = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    const durationMinutes =
      (parseInt(durMatch?.[1] || '0', 10) * 60) + parseInt(durMatch?.[2] || '0', 10);

    const stops = (firstItinerary?.segments?.length || 1) - 1;
    const price = Number(it.price?.grandTotal || it.price?.total || 0);

    return {
      id: `am_${it.id || i}`,
      missionId: '',
      source: 'amadeus' as const,
      externalId: String(it.id || i),
      airline: airlineName,
      airlineCode,
      flightNumber: `${airlineCode}${firstSegment?.number || ''}`,
      departureTime: firstSegment?.departure?.at,
      arrivalTime: lastSegment?.arrival?.at,
      durationMinutes,
      stops,
      cabinClass: (params.cabinClass || 'economy') as CabinClass,
      baggageIncluded: true, // Amadeus baggage info requires additional calls; assume yes
      priceUsd: Math.round(price),
      originalCurrency: it.price?.currency || 'USD',
      originalPrice: Math.round(price),
      carbonKg: Math.round(durationMinutes * 0.15),
      rawData: {
        provider: 'amadeus',
        logoUrl: `https://content.airhex.com/content/logos/airlines_${airlineCode}_100_100_s.png`,
        originIata: firstSegment?.departure?.iataCode,
        destinationIata: lastSegment?.arrival?.iataCode,
        originCity: firstSegment?.departure?.iataCode,
        destinationCity: lastSegment?.arrival?.iataCode,
      },
      fetchedAt: new Date().toISOString(),
    };
  });

  const valid = offers.filter((o) => o.priceUsd > 0);
  valid.sort((a, b) => a.priceUsd - b.priceUsd);
  return valid;
}
