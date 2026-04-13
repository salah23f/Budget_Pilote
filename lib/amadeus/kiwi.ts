import type { Offer, FlightSearchParams, CabinClass } from '../types';

/**
 * Kiwi.com Cheap Flights integration (via RapidAPI).
 *
 * Kiwi.com is a real European OTA with worldwide GDS integration — prices
 * are live from airline systems, never synthetic. Used as the primary
 * backup when Sky-Scrapper's flight upstream is down.
 *
 * To enable:
 *   1. Go to https://rapidapi.com/emir12/api/kiwi-com-cheap-flights
 *   2. Click "Subscribe to Test" (free tier)
 *   3. The same RAPIDAPI_KEY env var is used — no new key needed.
 */

const KIWI_HOST = 'kiwi-com-cheap-flights.p.rapidapi.com';
const KIWI_BASE = `https://${KIWI_HOST}`;

export function isKiwiConfigured(): boolean {
  return !!process.env.RAPIDAPI_KEY;
}

function headers() {
  return {
    'x-rapidapi-key': process.env.RAPIDAPI_KEY!,
    'x-rapidapi-host': KIWI_HOST,
  };
}

const CABIN_MAP: Record<string, string> = {
  economy: 'ECONOMY',
  premium_economy: 'PREMIUM_ECONOMY',
  business: 'BUSINESS',
  first: 'FIRST',
};

/**
 * Search flights via Kiwi.com. Supports one-way and round-trip.
 * Query must use IATA airport codes (3-letter), city codes ("City:paris_fr"),
 * or the Kiwi location slug. We pass raw uppercased codes.
 */
export async function searchFlightsKiwi(
  params: FlightSearchParams & { originIata?: string; destinationIata?: string }
): Promise<Offer[]> {
  if (!isKiwiConfigured()) throw new Error('NO_KIWI');

  const originCode = (params.originIata || params.origin || '').toUpperCase();
  const destCode = (params.destinationIata || params.destination || '').toUpperCase();

  if (!originCode || !destCode) {
    throw new Error('Kiwi: missing origin/destination IATA');
  }

  // Build Kiwi "location" format: "Airport:LHR" for airport, "City:lon" for city
  // Kiwi accepts raw IATA in most cases; prefix with "Airport:" for explicit airport.
  const src = originCode.length === 3 ? `Airport:${originCode}` : originCode;
  const dst = destCode.length === 3 ? `Airport:${destCode}` : destCode;

  const endpoint = params.returnDate ? '/round-trip' : '/one-way';
  const url = new URL(`${KIWI_BASE}${endpoint}`);

  // Kiwi param names: source, destination, currency, locale, adults,
  // children, infants, handbags, holdbags, cabinClass, sortBy,
  // applyMixedClasses, allowReturnFromDifferentCity, allowChangeInboundDestination,
  // allowChangeInboundSource, allowDifferentStationConnection, enableSelfTransfer,
  // allowOvernightStopover, enableTrueHiddenCity, enableThrowAwayTicketing,
  // outbound ... inboundDepartureDateStart/End
  url.searchParams.set('source', src);
  url.searchParams.set('destination', dst);
  url.searchParams.set('currency', 'usd');
  url.searchParams.set('locale', 'en');
  url.searchParams.set('adults', String(params.adults || 1));
  url.searchParams.set('children', '0');
  url.searchParams.set('infants', '0');
  url.searchParams.set('handbags', String((params as any).handBags ?? 1));
  url.searchParams.set('holdbags', String((params as any).holdBags ?? 0));
  url.searchParams.set('cabinClass', CABIN_MAP[params.cabinClass || 'economy']);
  url.searchParams.set('sortBy', 'PRICE');
  url.searchParams.set('sortOrder', 'ASCENDING');
  url.searchParams.set('applyMixedClasses', 'true');
  url.searchParams.set('allowChangeInboundDestination', 'false');
  url.searchParams.set('allowChangeInboundSource', 'false');
  url.searchParams.set('allowDifferentStationConnection', 'true');
  url.searchParams.set('enableSelfTransfer', 'true');
  url.searchParams.set('allowOvernightStopover', 'true');
  url.searchParams.set('enableTrueHiddenCity', 'true');
  url.searchParams.set('allowReturnFromDifferentCity', 'true');
  url.searchParams.set('enableThrowAwayTicketing', 'true');
  url.searchParams.set('outboundDepartureDateStart', `${params.departDate}T00:00:00`);
  url.searchParams.set('outboundDepartureDateEnd', `${params.departDate}T23:59:59`);
  if (params.returnDate) {
    url.searchParams.set('inboundDepartureDateStart', `${params.returnDate}T00:00:00`);
    url.searchParams.set('inboundDepartureDateEnd', `${params.returnDate}T23:59:59`);
  }
  url.searchParams.set('limit', '20');
  if (params.nonStop) {
    url.searchParams.set('transportTypes', 'FLIGHT');
    url.searchParams.set('contentProviders', 'KIWI');
  }

  const res = await fetch(url.toString(), { headers: headers() });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Kiwi ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();

  // Kiwi response shape (GraphQL-style):
  // { itineraries: [ { id, price:{amount}, provider:{name}, sector:{ duration, sectorSegments:[
  //   { segment: { source, destination, duration, code, carrier:{name,code}, operatingCarrier } }
  // ]}}]}
  const itinList: any[] =
    (Array.isArray(data?.itineraries) && data.itineraries) ||
    (Array.isArray(data?.data) && data.data) ||
    (Array.isArray(data?.data?.itineraries) && data.data.itineraries) ||
    [];

  if (itinList.length === 0) {
    console.warn('[kiwi] no itineraries. keys:', Object.keys(data || {}));
    return [];
  }

  const offers: Offer[] = itinList.slice(0, 30).map((it: any, i: number): Offer => {
    // Price (amount is a STRING in Kiwi's response)
    const price = Number(it.price?.amount || it.price?.raw || it.price || 0);

    // Extract segments from sector.sectorSegments
    const sector = it.sector || it.outboundSector || it.outbound || {};
    const segmentWraps: any[] = Array.isArray(sector.sectorSegments) ? sector.sectorSegments : [];
    const segments: any[] = segmentWraps.map((w: any) => w?.segment).filter(Boolean);

    const first = segments[0] || {};
    const last = segments[segments.length - 1] || first;

    // Airline info comes from segment.carrier (or operatingCarrier)
    const carrier = first.carrier || first.operatingCarrier || {};
    const airlineName = carrier.name || 'Unknown';
    const airlineCode = carrier.code || '';
    const flightNum = `${airlineCode}${first.code || ''}`.trim();

    // Times: station-level localTime / utcTime
    const dep = first.source?.localTime || first.source?.utcTime;
    const arr = last.destination?.localTime || last.destination?.utcTime;

    // IATA codes from station objects
    const originIata = first.source?.station?.code || '';
    const destIata = last.destination?.station?.code || '';
    const originCity = first.source?.station?.city?.name;
    const destCity = last.destination?.station?.city?.name;

    // Duration in seconds at sector level
    let durationMinutes = 0;
    if (typeof sector.duration === 'number') durationMinutes = Math.round(sector.duration / 60);
    else if (dep && arr) {
      durationMinutes = Math.round((new Date(arr).getTime() - new Date(dep).getTime()) / 60000);
    }

    const stops = Math.max(0, segments.length - 1);
    const cabin = (params.cabinClass || 'economy') as CabinClass;

    // Baggage from bagsInfo
    const handBags = Number(it.bagsInfo?.includedHandBags || 0);
    const checkedBags = Number(it.bagsInfo?.includedCheckedBags || 0);
    const baggageIncluded = handBags > 0 || checkedBags > 0;

    return {
      id: `kw_${it.legacyId || it.id || i}`,
      missionId: '',
      source: 'amadeus' as const,
      externalId: String(it.legacyId || it.id || i),
      airline: airlineName,
      airlineCode,
      flightNumber: flightNum,
      departureTime: dep,
      arrivalTime: arr,
      durationMinutes,
      stops,
      cabinClass: cabin,
      baggageIncluded,
      priceUsd: price > 0 ? Math.round(price) : 0,
      originalCurrency: 'USD',
      originalPrice: price > 0 ? Math.round(price) : 0,
      carbonKg: Math.round((durationMinutes / 60) * 850 * 0.09 * (1 + stops * 0.15)),
      rawData: {
        provider: 'kiwi',
        logoUrl: airlineCode ? `https://images.kiwi.com/airlines/64/${airlineCode}.png` : undefined,
        originIata,
        destinationIata: destIata,
        originCity,
        destinationCity: destCity,
        deepLink: it.bookingOptions?.edges?.[0]?.node?.bookingUrl
          ? `https://www.kiwi.com${it.bookingOptions.edges[0].node.bookingUrl}`
          : undefined,
      },
      fetchedAt: new Date().toISOString(),
    };
  });

  const valid = offers.filter((o) => o.priceUsd > 0);
  valid.sort((a, b) => a.priceUsd - b.priceUsd);
  return valid;
}
