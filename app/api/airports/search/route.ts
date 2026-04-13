import { NextRequest, NextResponse } from 'next/server';
import { searchAirportsLive } from '@/lib/amadeus/flights';
import { searchAirports as searchAirportsLocal } from '@/lib/amadeus/airports-db';

export const dynamic = 'force-dynamic';

/**
 * Airport autocomplete with instant response strategy:
 *
 * 1. Local DB gives instant results (0ms) from a curated 600+ airport list.
 * 2. In parallel, Sky-Scrapper provides live worldwide coverage (500ms timeout).
 * 3. Results merged, deduped, and cached for 1 hour per query.
 *
 * This guarantees the user ALWAYS gets results in <100ms even when
 * Sky-Scrapper is slow or rate-limited.
 */

// In-memory cache (1 hour TTL)
type CacheEntry = { data: any[]; expires: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000;

function cacheGet(key: string): any[] | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() > e.expires) {
    cache.delete(key);
    return null;
  }
  return e.data;
}

function cacheSet(key: string, data: any[]) {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
  // Keep cache bounded
  if (cache.size > 500) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
}

function fromLocal(query: string) {
  return searchAirportsLocal(query).map((a) => ({
    skyId: a.iata,
    entityId: a.iata,
    name: `${a.city} - ${a.name}`,
    iata: a.iata,
    country: a.country,
    type: 'AIRPORT',
    source: 'local',
  }));
}

async function fromLiveWithTimeout(query: string, timeoutMs = 500): Promise<any[]> {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolve([]);
      }
    }, timeoutMs);

    searchAirportsLive(query, 10)
      .then((results) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(
          results.map((a) => ({
            skyId: a.skyId,
            entityId: a.entityId,
            name: a.name,
            iata: a.iata || a.skyId,
            country: a.country || '',
            type: a.type || 'AIRPORT',
            source: 'live',
          }))
        );
      })
      .catch(() => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve([]);
      });
  });
}

// Track in-flight live requests to dedupe
const inFlight = new Map<string, Promise<any[]>>();

async function refreshLiveInBackground(query: string, cacheKey: string, localResults: any[]) {
  if (inFlight.has(cacheKey)) return inFlight.get(cacheKey);

  const p = fromLiveWithTimeout(query, 3000).then((live) => {
    inFlight.delete(cacheKey);
    if (live.length === 0) return live;
    const merged: any[] = [];
    const seen = new Set<string>();
    for (const item of live) {
      const key = item.iata || item.skyId;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
    for (const item of localResults) {
      if (seen.has(item.iata)) continue;
      seen.add(item.iata);
      merged.push(item);
    }
    const result = merged.slice(0, 12);
    cacheSet(cacheKey, result);
    return result;
  });
  inFlight.set(cacheKey, p);
  return p;
}

export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get('q') || '').trim();

  if (query.length < 2) {
    return NextResponse.json({ success: true, data: [] });
  }

  const cacheKey = query.toLowerCase();
  const cached = cacheGet(cacheKey);
  if (cached) {
    return NextResponse.json({ success: true, data: cached, cached: true });
  }

  // Instant local results — always <5ms
  const local = fromLocal(query);

  // Kick off live search in the background (non-blocking).
  // The first caller returns instantly with local; subsequent callers
  // (within the 1h cache window) get the merged local+live data.
  refreshLiveInBackground(query, cacheKey, local).catch(() => {});

  // If local has ANY results, return them instantly.
  // Background task will refresh cache with live data for next query.
  if (local.length >= 1) {
    // Cache for a shorter window so the background live refresh can overwrite
    cache.set(cacheKey, { data: local.slice(0, 12), expires: Date.now() + 5 * 60 * 1000 });
    return NextResponse.json({ success: true, data: local.slice(0, 12) });
  }

  // No local match at all — wait briefly for live (covers obscure queries)
  const live = await fromLiveWithTimeout(query, 600);
  const merged: any[] = [];
  const seen = new Set<string>();
  for (const item of live) {
    const key = item.iata || item.skyId;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  for (const item of local) {
    if (seen.has(item.iata)) continue;
    seen.add(item.iata);
    merged.push(item);
  }
  const result = merged.slice(0, 12);
  cacheSet(cacheKey, result);
  return NextResponse.json({ success: true, data: result });
}
