import { NextRequest, NextResponse } from 'next/server';
import { searchFlights } from '@/lib/amadeus/flights';

/* ------------------------------------------------------------------ */
/*  In-memory cache (30 min TTL)                                       */
/* ------------------------------------------------------------------ */

type CacheEntry = { data: any; expires: number };
const exploreCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function cacheGet(key: string): any | null {
  const e = exploreCache.get(key);
  if (!e) return null;
  if (Date.now() > e.expires) {
    exploreCache.delete(key);
    return null;
  }
  return e.data;
}

function cacheSet(key: string, data: any) {
  exploreCache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
}

/* ------------------------------------------------------------------ */
/*  Popular destinations pool                                          */
/* ------------------------------------------------------------------ */

const DESTINATIONS: { iata: string; city: string }[] = [
  { iata: 'FCO', city: 'Rome' },
  { iata: 'BCN', city: 'Barcelona' },
  { iata: 'IST', city: 'Istanbul' },
  { iata: 'DXB', city: 'Dubai' },
  { iata: 'ATH', city: 'Athens' },
  { iata: 'LIS', city: 'Lisbon' },
  { iata: 'RAK', city: 'Marrakech' },
  { iata: 'BKK', city: 'Bangkok' },
  { iata: 'JFK', city: 'New York' },
  { iata: 'NRT', city: 'Tokyo' },
  { iata: 'AMS', city: 'Amsterdam' },
  { iata: 'LHR', city: 'London' },
  { iata: 'CDG', city: 'Paris' },
];

/* ------------------------------------------------------------------ */
/*  POST handler                                                       */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { origin, departDate } = body;

    if (!origin || !departDate) {
      return NextResponse.json(
        { success: false, error: 'origin and departDate are required' },
        { status: 400 }
      );
    }

    // Cache check
    const cacheKey = `explore:${origin}:${departDate}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      return NextResponse.json({ success: true, destinations: cached });
    }

    // Filter out destinations that match the origin
    const originUpper = origin.toUpperCase();
    const targets = DESTINATIONS.filter((d) => d.iata !== originUpper);

    // Pick up to 10 destinations
    const selected = targets.slice(0, 10);

    // Search all in parallel
    const results = await Promise.allSettled(
      selected.map(async (dest) => {
        const offers = await searchFlights({
          origin,
          destination: dest.iata,
          departDate,
          cabinClass: 'economy' as any,
          adults: 1,
        });

        if (!offers || offers.length === 0) return null;

        // Get the cheapest offer
        const cheapest = offers.reduce(
          (min, o) => ((o.priceUsd || 0) < (min.priceUsd || Infinity) ? o : min),
          offers[0]
        );

        return {
          destination: dest.iata,
          destinationCity: dest.city,
          price: cheapest.priceUsd || 0,
          airline: cheapest.airline || cheapest.airlineCode || 'Unknown',
          deepLink: cheapest.rawData?.deepLink || null,
        };
      })
    );

    // Filter successes, remove nulls, sort by price
    const destinations = results
      .filter(
        (r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof searchFlights>>[0] & { destination: string; destinationCity: string; price: number; airline: string; deepLink: string | null }>> =>
          r.status === 'fulfilled' && r.value !== null && (r.value as any).price > 0
      )
      .map((r) => r.value)
      .sort((a: any, b: any) => a.price - b.price);

    // Cache the result
    if (destinations.length > 0) {
      cacheSet(cacheKey, destinations);
    }

    return NextResponse.json({ success: true, destinations });
  } catch (err: any) {
    console.error('[explore] error:', err?.message);
    return NextResponse.json(
      { success: false, error: err?.message || 'Explore search failed' },
      { status: 500 }
    );
  }
}
