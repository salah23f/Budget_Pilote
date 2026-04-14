import { NextRequest, NextResponse } from 'next/server';
import { searchFlights } from '@/lib/amadeus/flights';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Live Deals endpoint — returns real flight prices personalized to the
 * user's search history and favorites.
 *
 * Personalization strategy:
 * 1. User passes recent origins/destinations via query params
 * 2. We build routes from their history (up to 4 personalized slots)
 * 3. Remaining slots filled from a daily-rotating pool of popular routes
 * 4. Cache is keyed per route combination (different users = different cache)
 *
 * Fallback: users with no history get 6 routes from the rotating pool,
 * which changes every day so the landing page always feels fresh.
 */

interface DealRoute {
  id: string;
  origin: string;
  destination: string;
  originCity: string;
  destinationCity: string;
  originCountry: string;
  destinationCountry: string;
}

/* ── Large pool of popular routes — rotated daily ─────────── */
const ALL_ROUTES: DealRoute[] = [
  { id: 'cdg-fco', origin: 'CDG', destination: 'FCO', originCity: 'Paris', destinationCity: 'Rome', originCountry: 'France', destinationCountry: 'Italy' },
  { id: 'lhr-jfk', origin: 'LHR', destination: 'JFK', originCity: 'London', destinationCity: 'New York', originCountry: 'UK', destinationCountry: 'USA' },
  { id: 'cdg-ist', origin: 'CDG', destination: 'IST', originCity: 'Paris', destinationCity: 'Istanbul', originCountry: 'France', destinationCountry: 'Turkey' },
  { id: 'lhr-dxb', origin: 'LHR', destination: 'DXB', originCity: 'London', destinationCity: 'Dubai', originCountry: 'UK', destinationCountry: 'UAE' },
  { id: 'cdg-tun', origin: 'CDG', destination: 'TUN', originCity: 'Paris', destinationCity: 'Tunis', originCountry: 'France', destinationCountry: 'Tunisia' },
  { id: 'ams-lis', origin: 'AMS', destination: 'LIS', originCity: 'Amsterdam', destinationCity: 'Lisbon', originCountry: 'Netherlands', destinationCountry: 'Portugal' },
  { id: 'fco-ath', origin: 'FCO', destination: 'ATH', originCity: 'Rome', destinationCity: 'Athens', originCountry: 'Italy', destinationCountry: 'Greece' },
  { id: 'cdg-mar', origin: 'CDG', destination: 'RAK', originCity: 'Paris', destinationCity: 'Marrakech', originCountry: 'France', destinationCountry: 'Morocco' },
  { id: 'lgw-bcn', origin: 'LGW', destination: 'BCN', originCity: 'London', destinationCity: 'Barcelona', originCountry: 'UK', destinationCountry: 'Spain' },
  { id: 'ber-bcn', origin: 'BER', destination: 'BCN', originCity: 'Berlin', destinationCity: 'Barcelona', originCountry: 'Germany', destinationCountry: 'Spain' },
  { id: 'muc-bkk', origin: 'MUC', destination: 'BKK', originCity: 'Munich', destinationCity: 'Bangkok', originCountry: 'Germany', destinationCountry: 'Thailand' },
  { id: 'zrh-jfk', origin: 'ZRH', destination: 'JFK', originCity: 'Zurich', destinationCity: 'New York', originCountry: 'Switzerland', destinationCountry: 'USA' },
  { id: 'vie-ist', origin: 'VIE', destination: 'IST', originCity: 'Vienna', destinationCity: 'Istanbul', originCountry: 'Austria', destinationCountry: 'Turkey' },
  { id: 'osl-lhr', origin: 'OSL', destination: 'LHR', originCity: 'Oslo', destinationCity: 'London', originCountry: 'Norway', destinationCountry: 'UK' },
  { id: 'mad-cdg', origin: 'MAD', destination: 'CDG', originCity: 'Madrid', destinationCity: 'Paris', originCountry: 'Spain', destinationCountry: 'France' },
  { id: 'ams-cdg', origin: 'AMS', destination: 'CDG', originCity: 'Amsterdam', destinationCity: 'Paris', originCountry: 'Netherlands', destinationCountry: 'France' },
  { id: 'cdg-nrt', origin: 'CDG', destination: 'NRT', originCity: 'Paris', destinationCity: 'Tokyo', originCountry: 'France', destinationCountry: 'Japan' },
  { id: 'lhr-bkk', origin: 'LHR', destination: 'BKK', originCity: 'London', destinationCity: 'Bangkok', originCountry: 'UK', destinationCountry: 'Thailand' },
];

/* ── City name lookup for building personalized routes ─────── */
const CITY_BY_IATA: Record<string, { city: string; country: string }> = {
  CDG: { city: 'Paris', country: 'France' }, ORY: { city: 'Paris', country: 'France' },
  LHR: { city: 'London', country: 'UK' }, LGW: { city: 'London', country: 'UK' }, STN: { city: 'London', country: 'UK' },
  JFK: { city: 'New York', country: 'USA' }, EWR: { city: 'New York', country: 'USA' },
  FCO: { city: 'Rome', country: 'Italy' }, MXP: { city: 'Milan', country: 'Italy' },
  BCN: { city: 'Barcelona', country: 'Spain' }, MAD: { city: 'Madrid', country: 'Spain' },
  IST: { city: 'Istanbul', country: 'Turkey' }, SAW: { city: 'Istanbul', country: 'Turkey' },
  DXB: { city: 'Dubai', country: 'UAE' },
  TUN: { city: 'Tunis', country: 'Tunisia' },
  AMS: { city: 'Amsterdam', country: 'Netherlands' },
  LIS: { city: 'Lisbon', country: 'Portugal' },
  ATH: { city: 'Athens', country: 'Greece' },
  RAK: { city: 'Marrakech', country: 'Morocco' },
  BER: { city: 'Berlin', country: 'Germany' }, MUC: { city: 'Munich', country: 'Germany' }, FRA: { city: 'Frankfurt', country: 'Germany' },
  BKK: { city: 'Bangkok', country: 'Thailand' },
  ZRH: { city: 'Zurich', country: 'Switzerland' }, GVA: { city: 'Geneva', country: 'Switzerland' },
  VIE: { city: 'Vienna', country: 'Austria' },
  OSL: { city: 'Oslo', country: 'Norway' },
  NRT: { city: 'Tokyo', country: 'Japan' }, HND: { city: 'Tokyo', country: 'Japan' },
  SIN: { city: 'Singapore', country: 'Singapore' },
  LAX: { city: 'Los Angeles', country: 'USA' }, MIA: { city: 'Miami', country: 'USA' },
  DPS: { city: 'Bali', country: 'Indonesia' },
  CMN: { city: 'Casablanca', country: 'Morocco' },
};

interface Deal {
  id: string;
  origin: string;
  destination: string;
  originCity: string;
  destinationCity: string;
  originCountry: string;
  destinationCountry: string;
  price: number;
  airline: string;
  airlineCode: string;
  logoUrl?: string;
  durationMinutes: number;
  stops: number;
  departDate: string;
  deepLink?: string;
}

/* ── Cache: keyed per route combination ─────────── */
type CacheEntry = { deals: Deal[]; expires: number };
const routeCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_CACHE_ENTRIES = 50;

function cacheKey(routes: DealRoute[]): string {
  return routes.map((r) => `${r.origin}-${r.destination}`).sort().join('|');
}

function pruneCache() {
  if (routeCache.size > MAX_CACHE_ENTRIES) {
    const oldest = [...routeCache.entries()]
      .sort((a, b) => a[1].expires - b[1].expires)
      .slice(0, routeCache.size - MAX_CACHE_ENTRIES + 10);
    for (const [key] of oldest) routeCache.delete(key);
  }
}

function defaultDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

function dayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/** Pick 6 routes from the pool, rotated daily */
function getRotatingRoutes(count: number): DealRoute[] {
  const day = dayOfYear();
  const pool = [...ALL_ROUTES];
  const result: DealRoute[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = (day * 7 + i * 13) % pool.length;
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

/** Build personalized routes from user's search/favorite IATA codes */
function buildPersonalizedRoutes(
  origins: string[],
  destinations: string[],
  maxSlots: number
): DealRoute[] {
  const routes: DealRoute[] = [];
  const seen = new Set<string>();

  for (const orig of origins) {
    for (const dest of destinations) {
      if (orig === dest) continue;
      const key = `${orig}-${dest}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const origInfo = CITY_BY_IATA[orig.toUpperCase()];
      const destInfo = CITY_BY_IATA[dest.toUpperCase()];

      routes.push({
        id: key.toLowerCase(),
        origin: orig.toUpperCase(),
        destination: dest.toUpperCase(),
        originCity: origInfo?.city || orig,
        destinationCity: destInfo?.city || dest,
        originCountry: origInfo?.country || '',
        destinationCountry: destInfo?.country || '',
      });

      if (routes.length >= maxSlots) return routes;
    }
  }
  return routes;
}

async function fetchDealForRoute(route: DealRoute, departDate: string): Promise<Deal | null> {
  try {
    const offers = await searchFlights({
      origin: route.origin,
      destination: route.destination,
      departDate,
      adults: 1,
      cabinClass: 'economy',
    });
    if (!offers || offers.length === 0) return null;
    const cheapest = offers[0];
    return {
      id: route.id,
      origin: route.origin,
      destination: route.destination,
      originCity: route.originCity,
      destinationCity: route.destinationCity,
      originCountry: route.originCountry,
      destinationCountry: route.destinationCountry,
      price: cheapest.priceUsd,
      airline: cheapest.airline || 'Unknown',
      airlineCode: cheapest.airlineCode || '',
      logoUrl: (cheapest.rawData as any)?.logoUrl,
      durationMinutes: cheapest.durationMinutes || 0,
      stops: cheapest.stops || 0,
      departDate,
      deepLink: (cheapest.rawData as any)?.deepLink,
    };
  } catch (err: any) {
    console.warn('[deals] route failed', route.id, err?.message);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const started = Date.now();
  try {
    const url = new URL(req.url);
    const originsParam = url.searchParams.get('origins');
    const destinationsParam = url.searchParams.get('destinations');

    const userOrigins = originsParam ? originsParam.split(',').filter(Boolean) : [];
    const userDestinations = destinationsParam ? destinationsParam.split(',').filter(Boolean) : [];
    const hasUserContext = userOrigins.length > 0 && userDestinations.length > 0;

    /* ── Build the route list ─────────────── */
    let selectedRoutes: DealRoute[] = [];

    if (hasUserContext) {
      // Personalized routes from user history (up to 4)
      const personalized = buildPersonalizedRoutes(userOrigins, userDestinations, 4);
      selectedRoutes.push(...personalized);
    }

    // Fill remaining slots with rotating popular routes
    const remaining = 6 - selectedRoutes.length;
    if (remaining > 0) {
      const existingKeys = new Set(selectedRoutes.map((r) => `${r.origin}-${r.destination}`));
      const rotating = getRotatingRoutes(remaining + 4) // get extra to account for dupes
        .filter((r) => !existingKeys.has(`${r.origin}-${r.destination}`))
        .slice(0, remaining);
      selectedRoutes.push(...rotating);
    }

    selectedRoutes = selectedRoutes.slice(0, 6);

    /* ── Check cache ─────────────── */
    const key = cacheKey(selectedRoutes);
    const cached = routeCache.get(key);
    if (cached && Date.now() < cached.expires) {
      console.log('[deals] cache hit', { ms: Date.now() - started, count: cached.deals.length, personalized: hasUserContext });
      return NextResponse.json({
        success: true,
        deals: cached.deals,
        cached: true,
        personalized: hasUserContext,
        ts: new Date().toISOString(),
      });
    }

    /* ── Fetch deals ─────────────── */
    const departDate = defaultDate(30);
    const settled = await Promise.allSettled(
      selectedRoutes.map((route) => fetchDealForRoute(route, departDate))
    );
    const deals: Deal[] = settled
      .map((r) => (r.status === 'fulfilled' ? r.value : null))
      .filter((d): d is Deal => d !== null)
      .sort((a, b) => a.price - b.price);

    if (deals.length > 0) {
      pruneCache();
      routeCache.set(key, { deals, expires: Date.now() + CACHE_TTL_MS });
    }

    console.log('[deals] refresh', {
      ms: Date.now() - started,
      fetched: deals.length,
      attempted: selectedRoutes.length,
      personalized: hasUserContext,
      routes: selectedRoutes.map((r) => r.id).join(', '),
    });

    return NextResponse.json({
      success: true,
      deals,
      cached: false,
      personalized: hasUserContext,
      ts: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[deals] error', { ms: Date.now() - started, msg: err?.message });
    return NextResponse.json(
      { success: false, error: err?.message || 'Deals fetch failed', deals: [] },
      { status: 500 }
    );
  }
}
