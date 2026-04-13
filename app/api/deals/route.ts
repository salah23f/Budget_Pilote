import { NextResponse } from 'next/server';
import { searchFlights } from '@/lib/amadeus/flights';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Live Deals endpoint — returns pre-warmed real flight prices for a
 * rotating set of popular routes. The landing page uses this to show
 * investors real prices BEFORE the user types anything.
 *
 * Strategy:
 * - Maintain an in-memory cache (30 min TTL) so repeat visits are instant
 * - On cache miss, fire all 6 searches in parallel and return whatever
 *   succeeds before the 45s soft deadline
 * - Never return synthetic prices — if a route fails, omit it entirely
 */

interface DealRoute {
  id: string;
  origin: string;
  destination: string;
  originCity: string;
  destinationCity: string;
  originCountry: string;
  destinationCountry: string;
  emoji: string;
}

const POPULAR_ROUTES: DealRoute[] = [
  { id: 'cdg-fco', origin: 'CDG', destination: 'FCO', originCity: 'Paris', destinationCity: 'Rome', originCountry: 'France', destinationCountry: 'Italy', emoji: '🇮🇹' },
  { id: 'lhr-jfk', origin: 'LHR', destination: 'JFK', originCity: 'London', destinationCity: 'New York', originCountry: 'UK', destinationCountry: 'USA', emoji: '🗽' },
  { id: 'mad-bcn', origin: 'MAD', destination: 'BCN', originCity: 'Madrid', destinationCity: 'Barcelona', originCountry: 'Spain', destinationCountry: 'Spain', emoji: '🏛️' },
  { id: 'cdg-tun', origin: 'CDG', destination: 'TUN', originCity: 'Paris', destinationCity: 'Tunis', originCountry: 'France', destinationCountry: 'Tunisia', emoji: '🌅' },
  { id: 'ams-cdg', origin: 'AMS', destination: 'CDG', originCity: 'Amsterdam', destinationCity: 'Paris', originCountry: 'Netherlands', destinationCountry: 'France', emoji: '🗼' },
  { id: 'lgw-cdg', origin: 'LGW', destination: 'CDG', originCity: 'London', destinationCity: 'Paris', originCountry: 'UK', destinationCountry: 'France', emoji: '🥐' },
];

interface Deal {
  id: string;
  origin: string;
  destination: string;
  originCity: string;
  destinationCity: string;
  originCountry: string;
  destinationCountry: string;
  emoji: string;
  price: number;
  airline: string;
  airlineCode: string;
  logoUrl?: string;
  durationMinutes: number;
  stops: number;
  departDate: string;
  deepLink?: string;
}

type CacheEntry = { deals: Deal[]; expires: number };
const cache: { current: CacheEntry | null } = { current: null };
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function defaultDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
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
    const cheapest = offers[0]; // already sorted by price asc
    return {
      id: route.id,
      origin: route.origin,
      destination: route.destination,
      originCity: route.originCity,
      destinationCity: route.destinationCity,
      originCountry: route.originCountry,
      destinationCountry: route.destinationCountry,
      emoji: route.emoji,
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

export async function GET() {
  const started = Date.now();
  try {
    // Serve from cache if fresh
    if (cache.current && Date.now() < cache.current.expires) {
      console.log('[deals] cache hit', { ms: Date.now() - started, count: cache.current.deals.length });
      return NextResponse.json({
        success: true,
        deals: cache.current.deals,
        cached: true,
        ts: new Date().toISOString(),
      });
    }

    const departDate = defaultDate(30);

    // Fire all routes in parallel. Promise.allSettled so one failure
    // never takes the whole endpoint down.
    const settled = await Promise.allSettled(
      POPULAR_ROUTES.map((route) => fetchDealForRoute(route, departDate))
    );
    const deals: Deal[] = settled
      .map((r) => (r.status === 'fulfilled' ? r.value : null))
      .filter((d): d is Deal => d !== null)
      .sort((a, b) => a.price - b.price);

    if (deals.length > 0) {
      cache.current = { deals, expires: Date.now() + CACHE_TTL_MS };
    }

    console.log('[deals] refresh', {
      ms: Date.now() - started,
      fetched: deals.length,
      attempted: POPULAR_ROUTES.length,
      failed: POPULAR_ROUTES.length - deals.length,
    });

    return NextResponse.json({
      success: true,
      deals,
      cached: false,
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
