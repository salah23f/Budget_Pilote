import type { Offer, FlightSearchParams, CabinClass } from '../types';
import { searchFlightsAmadeus, isAmadeusConfigured } from './amadeus-real';
import { searchFlightsKiwi, isKiwiConfigured } from './kiwi';
import { findAirport } from './airports-db';

/**
 * Real flight search backed by Sky-Scrapper (RapidAPI).
 *
 * Flow:
 *  1. Resolve origin + destination free-text to { skyId, entityId } via
 *     /api/v1/flights/searchAirport
 *  2. Query /api/v1/flights/searchFlightsMultiStops with JSON legs.
 *     (v1/searchFlights and v2 are blocked by captcha on current plan;
 *      MultiStops is the only endpoint that returns real itineraries.)
 */

const BASE_URL = 'https://sky-scrapper.p.rapidapi.com';

// In-memory cache for flight searches (TTL 10 minutes).
// Sky-Scrapper's backend is flaky for cold routes so caching successful
// searches is critical for reliability.
type CacheEntry = { data: any; expires: number };
const flightCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function cacheGet(key: string): any | null {
  const e = flightCache.get(key);
  if (!e) return null;
  if (Date.now() > e.expires) {
    flightCache.delete(key);
    return null;
  }
  return e.data;
}

function cacheSet(key: string, data: any) {
  flightCache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
}

function headers() {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) throw new Error('RAPIDAPI_KEY not configured');
  return {
    'x-rapidapi-key': apiKey,
    'x-rapidapi-host': 'sky-scrapper.p.rapidapi.com',
  } as Record<string, string>;
}

async function skyFetch(
  path: string,
  params: Record<string, string | number | undefined>,
  retries = 6
): Promise<any> {
  // Build the URL as a raw template string, using encodeURIComponent for each
  // value — this matches EXACTLY what the sky-health debug endpoint does,
  // which reliably returns data when URLSearchParams-built URLs fail.
  const queryParts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    queryParts.push(`${k}=${encodeURIComponent(String(v))}`);
  }
  const urlString = `${BASE_URL}${path}?${queryParts.join('&')}`;

  let lastError: any;
  let lastBody: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Note: we deliberately do NOT pass cache: 'no-store' here. Sky-Scrapper's
      // upstream Skyscanner proxy is intermittently unavailable, and letting
      // Next.js / Node's HTTP cache serve a recent successful response is better
      // than a hard failure. Real-time freshness is enforced at the app level
      // via our 10-minute in-memory cache.
      const res = await fetch(urlString, { headers: headers() });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`sky-scrapper ${path} ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = await res.json();
      lastBody = data;
      if (data?.status === false) {
        const msg = typeof data.message === 'string' ? data.message : JSON.stringify(data.message || '');
        // Retry on proxy errors, captcha, timeouts — the Sky-Scrapper backend
        // poll to Skyscanner is flaky and needs multiple attempts.
        if (
          /ProxyError|Connection reset|Connection|captcha|timeout|5\d\d|unified-search|Something went wrong/i.test(msg) &&
          attempt < retries
        ) {
          // Gradual backoff: 2s, 3s, 4s, 5s, 6s, 7s
          await new Promise((r) => setTimeout(r, 2000 + attempt * 1000));
          continue;
        }
      }
      return data;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 2000 + attempt * 1000));
        continue;
      }
      throw err;
    }
  }
  return lastBody;
}

export interface AirportRef {
  skyId: string;
  entityId: string;
  name: string;
  city?: string;
  country?: string;
  iata?: string;
  type?: string;
}

/**
 * Resolve a free-text query ("Paris", "JFK", "Tokyo") into a Sky-Scrapper
 * airport/city reference. Returns up to `limit` results.
 */
export async function searchAirportsLive(query: string, limit = 10): Promise<AirportRef[]> {
  if (!query || query.length < 2) return [];
  const data = await skyFetch('/api/v1/flights/searchAirport', { query, locale: 'en-US' });
  const list: any[] = Array.isArray(data?.data) ? data.data : [];

  return list.slice(0, limit).map((item) => {
    const fp = item.navigation?.relevantFlightParams;
    const name = item.presentation?.title || item.presentation?.suggestionTitle || query;
    return {
      skyId: fp?.skyId || item.skyId || '',
      entityId: fp?.entityId || item.entityId || '',
      name,
      city: item.presentation?.subtitle?.split(',')[0] || fp?.localizedName,
      country: item.presentation?.subtitle || '',
      iata: fp?.skyId,
      type: fp?.flightPlaceType || 'AIRPORT',
    };
  }).filter((a) => a.skyId && a.entityId);
}

async function resolveOne(query: string): Promise<AirportRef | null> {
  const list = await searchAirportsLive(query, 1);
  return list[0] || null;
}

/**
 * Resolve a query to candidate references. Sky-Scrapper's flight-multistops
 * upstream has a cold-cache problem on CITY-level codes (LOND, PARI, NYCA)
 * — they hit the broken /g/radar/api/v2/unified-search/ backend.
 *
 * AIRPORT-level codes (LHR, CDG, JFK) go through a different, warmer cache
 * and reliably return data.
 *
 * So we always put **airports first**, and only fall back to city-level
 * as a last resort.
 */
async function resolveCandidates(query: string, n = 5): Promise<AirportRef[]> {
  const list = await searchAirportsLive(query, Math.max(n * 2, 10));
  if (list.length === 0) return [];

  const seen = new Set<string>();
  const airports: AirportRef[] = [];
  const cities: AirportRef[] = [];

  for (const r of list) {
    if (!r.entityId || seen.has(r.entityId)) continue;
    seen.add(r.entityId);
    const t = (r.type || '').toUpperCase();
    if (t.includes('AIRPORT')) airports.push(r);
    else cities.push(r);
  }

  // Airports first (reliable), then cities (last resort fallback)
  const out = [...airports, ...cities].slice(0, n);
  return out;
}

type Carrier = { name: string; logoUrl?: string; code?: string };

function pickCarrier(leg: any): Carrier {
  const m = leg?.carriers?.marketing?.[0];
  if (m) return { name: m.name, logoUrl: m.logoUrl, code: m.alternateId };
  const o = leg?.carriers?.operating?.[0];
  if (o) return { name: o.name, logoUrl: o.logoUrl, code: o.alternateId };
  return { name: 'Unknown' };
}

function pickFlightNumber(leg: any, carrier: Carrier): string {
  const seg = leg?.segments?.[0];
  if (seg?.flightNumber) return `${carrier.code || ''}${seg.flightNumber}`.trim();
  return carrier.code || '';
}

const CABIN_CARBON: Record<string, number> = {
  economy: 0.09,
  premium_economy: 0.15,
  business: 0.25,
  first: 0.35,
};

function estimateCarbon(durationMin: number, cabin: string, stops: number): number {
  // Rough estimate: avg speed 850 km/h, g per km scaled by cabin
  const km = (durationMin / 60) * 850;
  const perKm = CABIN_CARBON[cabin] || 0.09;
  return Math.round(km * perKm * (1 + stops * 0.15));
}

/** Single attempt against Sky-Scrapper with a specific origin/destination pair. */
async function tryFetchItineraries(
  originSkyId: string,
  originEntityId: string,
  destSkyId: string,
  destEntityId: string,
  departDate: string,
  returnDate: string | undefined,
  cabin: string,
  adults: number
): Promise<{ itineraries: any[]; upstreamError: boolean; rawMsg?: string }> {
  const legs: any[] = [
    { origin: originSkyId, originEntityId, destination: destSkyId, destinationEntityId: destEntityId, date: departDate },
  ];
  if (returnDate) {
    legs.push({
      origin: destSkyId,
      originEntityId: destEntityId,
      destination: originSkyId,
      destinationEntityId: originEntityId,
      date: returnDate,
    });
  }

  const data = await skyFetch('/api/v1/flights/searchFlightsMultiStops', {
    legs: JSON.stringify(legs),
    cabinClass: cabin,
    sortBy: 'best',
    adults: String(adults),
    currency: 'USD',
    market: 'en-US',
    countryCode: 'US',
  }, 1); // Single retry per pair — let the outer airport fallback do the heavy lifting

  const itins: any[] = data?.data?.itineraries || [];
  const rawMsg =
    typeof data?.message === 'string'
      ? data.message
      : JSON.stringify(data?.message || '').slice(0, 300);

  if (Array.isArray(itins) && itins.length > 0) {
    return { itineraries: itins, upstreamError: false };
  }
  const upstreamError = data?.status === false;
  return { itineraries: [], upstreamError, rawMsg };
}

export async function searchFlights(
  params: FlightSearchParams & {
    originSkyId?: string;
    originEntityId?: string;
    destSkyId?: string;
    destEntityId?: string;
  }
): Promise<Offer[]> {
  // Sky-Scrapper cabin class mapping — must be exact values the API accepts
  const CABIN_NORMALIZE: Record<string, string> = {
    economy: 'economy',
    premium_economy: 'premium_economy',
    business: 'business',
    first: 'first',
    // Common UI aliases
    'premium economy': 'premium_economy',
    'first class': 'first',
    'business class': 'business',
  };
  const cabin = CABIN_NORMALIZE[(params.cabinClass || 'economy').toLowerCase()] || 'economy';
  const adults = Math.max(1, Math.min(9, Number(params.adults) || 1));

  // Build candidate lists for origin and destination.
  // If the caller provided explicit skyId/entityId (from autocomplete), trust it as first choice.
  let originCandidates: AirportRef[] = [];
  let destCandidates: AirportRef[] = [];
  let skyScrapperResolveFailed = false;

  if (params.originSkyId && params.originEntityId) {
    originCandidates.push({
      skyId: params.originSkyId,
      entityId: params.originEntityId,
      name: params.origin,
    });
  } else {
    try {
      originCandidates = await resolveCandidates(params.origin, 4);
    } catch (e) {
      skyScrapperResolveFailed = true;
    }
    if (originCandidates.length === 0) skyScrapperResolveFailed = true;
  }

  await new Promise((r) => setTimeout(r, 400));

  if (params.destSkyId && params.destEntityId) {
    destCandidates.push({
      skyId: params.destSkyId,
      entityId: params.destEntityId,
      name: params.destination,
    });
  } else if (!skyScrapperResolveFailed) {
    try {
      destCandidates = await resolveCandidates(params.destination, 4);
    } catch (e) {
      skyScrapperResolveFailed = true;
    }
    if (destCandidates.length === 0) skyScrapperResolveFailed = true;
  }

  // LOCAL IATA FALLBACK — if Sky-Scrapper's resolver died, try resolving
  // directly from the local airports DB (Marrakech → RAK, Geneva → GVA,
  // etc.). This keeps the pipeline alive even when upstream autocomplete
  // is completely unreachable. Local candidates don't have real
  // Sky-Scrapper entityIds, so we mark the pipeline to skip straight to
  // Kiwi (which accepts raw IATA codes natively).
  if (originCandidates.length === 0) {
    const local = findAirport(params.origin);
    if (local) {
      console.log('[flights] local fallback resolved origin', params.origin, '→', local.iata);
      originCandidates.push({ skyId: local.iata, entityId: local.iata, name: `${local.city} ${local.name}`, iata: local.iata });
      skyScrapperResolveFailed = true; // use Kiwi directly — entityId isn't real
    }
  }
  if (destCandidates.length === 0) {
    const local = findAirport(params.destination);
    if (local) {
      console.log('[flights] local fallback resolved destination', params.destination, '→', local.iata);
      destCandidates.push({ skyId: local.iata, entityId: local.iata, name: `${local.city} ${local.name}`, iata: local.iata });
      skyScrapperResolveFailed = true; // use Kiwi directly — entityId isn't real
    }
  }

  await new Promise((r) => setTimeout(r, 400));

  // Cache key — prefer IATA codes (whether from Sky-Scrapper or local fallback)
  // since they're normalized. Only fall back to raw user input if BOTH
  // resolution paths failed entirely.
  const keyOrigin = originCandidates[0]?.skyId || params.origin;
  const keyDest = destCandidates[0]?.skyId || params.destination;
  const primaryKey = `${keyOrigin}|${keyDest}|${params.departDate}|${params.returnDate || ''}|${cabin}|${adults}`;
  const cached = cacheGet(primaryKey);
  if (cached) {
    console.log('[flights] cache hit:', primaryKey);
    return cached;
  }

  let itineraries: any[] = [];
  let lastError = '';

  if (!skyScrapperResolveFailed) {
    // Build airport-pair list. Airports are already sorted first by resolveCandidates.
    const pairs: Array<{ o: AirportRef; d: AirportRef; label: string }> = [];
    const maxO = Math.min(originCandidates.length, 4);
    const maxD = Math.min(destCandidates.length, 4);
    for (let i = 0; i < maxO; i++) {
      for (let j = 0; j < maxD; j++) {
        pairs.push({
          o: originCandidates[i],
          d: destCandidates[j],
          label: `${originCandidates[i].skyId}→${destCandidates[j].skyId}`,
        });
        if (pairs.length >= 9) break;
      }
      if (pairs.length >= 9) break;
    }

    // Time budget — on Hobby Vercel, total function maxDuration is 60s.
    // Reserve ~20s for V7a + Supabase + shadow-log downstream, give flight
    // lookup up to 40s. When Sky-Scrapper gets slow (7-10s per pair), 9
    // pairs × 10s = 90s → timeout. Bail out at 40s to keep the watcher
    // within budget.
    const pairLoopStart = Date.now();
    const PAIR_LOOP_BUDGET_MS = 40000;
    for (const pair of pairs) {
      const elapsed = Date.now() - pairLoopStart;
      if (elapsed > PAIR_LOOP_BUDGET_MS) {
        console.warn(
          '[flights] time budget exhausted after',
          elapsed,
          'ms on pair',
          pair.label,
          '— stopping iteration'
        );
        lastError = lastError || `time budget exhausted after ${elapsed}ms`;
        break;
      }
      console.log('[flights] trying', pair.label);
      try {
        const res = await tryFetchItineraries(
          pair.o.skyId,
          pair.o.entityId,
          pair.d.skyId,
          pair.d.entityId,
          params.departDate,
          params.returnDate,
          cabin,
          adults
        );
        if (res.itineraries.length > 0) {
          itineraries = res.itineraries;
          break;
        }
        if (res.upstreamError) {
          lastError = res.rawMsg || 'upstream error';
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
        lastError = 'No flights on this date.';
      } catch (err: any) {
        lastError = err.message || 'fetch failed';
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  } else {
    console.warn('[flights] Sky-Scrapper airport resolution unavailable — skipping straight to Kiwi');
    lastError = 'Sky-Scrapper resolve failed';
  }

  if (itineraries.length === 0) {
    console.warn('[flights] Sky-Scrapper failed. lastError:', lastError.slice(0, 200));

    // BACKUP 1: Kiwi.com Cheap Flights via RapidAPI (same key)
    if (isKiwiConfigured()) {
      try {
        // Use user's raw input if Sky-Scrapper resolution failed — Kiwi
        // can handle free-text city names and IATA codes directly.
        const kiwiOrigin = originCandidates[0]?.skyId || params.origin;
        const kiwiDest = destCandidates[0]?.skyId || params.destination;
        console.log('[flights] falling back to Kiwi.com', kiwiOrigin, '->', kiwiDest);
        const kiwiOffers = await searchFlightsKiwi({
          origin: kiwiOrigin,
          destination: kiwiDest,
          originIata: kiwiOrigin,
          destinationIata: kiwiDest,
          departDate: params.departDate,
          returnDate: params.returnDate,
          adults: adults,
          cabinClass: cabin as any,
          nonStop: params.nonStop,
          maxPrice: params.maxPrice,
        });
        if (kiwiOffers.length > 0) {
          console.log(`[flights] Kiwi returned ${kiwiOffers.length} offers`);
          cacheSet(primaryKey, kiwiOffers);
          return kiwiOffers;
        }
      } catch (kiwiErr: any) {
        console.warn('[flights] Kiwi also failed:', kiwiErr?.message);
      }
    }

    // BACKUP 1.5: If non-economy cabin returned nothing, retry Kiwi with economy
    // (many routes only have economy fares; show something rather than nothing)
    if (cabin !== 'economy' && isKiwiConfigured()) {
      try {
        const kiwiOrigin2 = originCandidates[0]?.skyId || params.origin;
        const kiwiDest2 = destCandidates[0]?.skyId || params.destination;
        console.log('[flights] retrying Kiwi with economy fallback');
        const fallbackOffers = await searchFlightsKiwi({
          origin: kiwiOrigin2,
          destination: kiwiDest2,
          originIata: kiwiOrigin2,
          destinationIata: kiwiDest2,
          departDate: params.departDate,
          returnDate: params.returnDate,
          adults: adults,
          cabinClass: 'economy',
          nonStop: params.nonStop,
          maxPrice: params.maxPrice,
        });
        if (fallbackOffers.length > 0) {
          console.log(`[flights] Kiwi economy fallback: ${fallbackOffers.length} offers`);
          // Mark them so user knows these are economy
          for (const o of fallbackOffers) {
            o.cabinClass = 'economy' as any;
            o.explanation = `No ${cabin} fares found — showing economy prices`;
          }
          cacheSet(primaryKey, fallbackOffers);
          return fallbackOffers;
        }
      } catch (_) {}
    }

    // BACKUP 2: Amadeus (if configured — optional second fallback)
    if (isAmadeusConfigured()) {
      try {
        const amOrigin = originCandidates[0]?.skyId || params.origin;
        const amDest = destCandidates[0]?.skyId || params.destination;
        console.log('[flights] falling back to Amadeus', amOrigin, '->', amDest);
        const amadeusOffers = await searchFlightsAmadeus({
          origin: amOrigin,
          destination: amDest,
          departDate: params.departDate,
          returnDate: params.returnDate,
          adults: adults,
          cabinClass: cabin as any,
          nonStop: params.nonStop,
          maxPrice: params.maxPrice,
        });
        if (amadeusOffers.length > 0) {
          console.log(`[flights] Amadeus returned ${amadeusOffers.length} offers`);
          cacheSet(primaryKey, amadeusOffers);
          return amadeusOffers;
        }
      } catch (amadeusErr: any) {
        console.warn('[flights] Amadeus also failed:', amadeusErr?.message);
      }
    }

    if (/ProxyError|Connection|unified-search|Something went wrong/i.test(lastError)) {
      throw new Error('UPSTREAM_UNAVAILABLE');
    }
    return [];
  }

  const offers: Offer[] = itineraries.slice(0, 40).map((it, i) => {
    const price = Number(it.price?.raw || 0);
    const firstLeg = it.legs?.[0];
    const lastLeg = it.legs?.[it.legs.length - 1];
    const carrier = pickCarrier(firstLeg);
    const flightNumber = pickFlightNumber(firstLeg, carrier);

    const totalDuration = (it.legs || []).reduce(
      (s: number, l: any) => s + (l.durationInMinutes || 0),
      0
    );
    const stops = Math.max(
      ...((it.legs || []).map((l: any) => l.stopCount || 0) as number[])
    );

    // Base bag inclusion: most full-service carriers include cabin bag; low-cost may not.
    const baggageIncluded = !/ryanair|easyjet|wizz|spirit|frontier/i.test(carrier.name);

    return {
      id: `sf_${it.id || i}`,
      missionId: '',
      source: 'amadeus' as const,
      externalId: String(it.id || i),
      airline: carrier.name,
      airlineCode: carrier.code,
      flightNumber,
      departureTime: firstLeg?.departure,
      arrivalTime: lastLeg?.arrival,
      durationMinutes: totalDuration,
      stops,
      cabinClass: cabin as CabinClass,
      baggageIncluded,
      priceUsd: price > 0 ? Math.round(price) : 0,
      originalCurrency: 'USD',
      originalPrice: price > 0 ? Math.round(price) : 0,
      carbonKg: estimateCarbon(totalDuration, cabin, stops),
      rawData: {
        provider: 'sky_scrapper',
        logoUrl: carrier.logoUrl,
        originName: firstLeg?.origin?.name,
        originIata: firstLeg?.origin?.displayCode,
        originCity: firstLeg?.origin?.city,
        destinationName: lastLeg?.destination?.name,
        destinationIata: lastLeg?.destination?.displayCode,
        destinationCity: lastLeg?.destination?.city,
        legs: (it.legs || []).map((l: any) => ({
          origin: l.origin?.displayCode,
          destination: l.destination?.displayCode,
          departure: l.departure,
          arrival: l.arrival,
          duration: l.durationInMinutes,
          stops: l.stopCount,
          airline: pickCarrier(l).name,
          logo: pickCarrier(l).logoUrl,
        })),
        tags: it.tags,
      },
      fetchedAt: new Date().toISOString(),
    };
  });

  let filtered = offers.filter((o) => o.priceUsd > 0);
  if (params.maxPrice) filtered = filtered.filter((o) => o.priceUsd <= params.maxPrice!);
  if (params.nonStop) filtered = filtered.filter((o) => o.stops === 0);
  filtered.sort((a, b) => a.priceUsd - b.priceUsd);

  // Cache successful results so flaky upstream doesn't ruin every refresh.
  if (filtered.length > 0) cacheSet(primaryKey, filtered);

  return filtered;
}

export async function searchFlightsDebug(params: FlightSearchParams): Promise<any> {
  return { debug: 'use /api/debug/search', params };
}
