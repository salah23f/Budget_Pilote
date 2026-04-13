import { NextRequest, NextResponse } from 'next/server';
import { searchLocations } from '@/lib/amadeus/hotels';

export const dynamic = 'force-dynamic';

/**
 * Autocomplete endpoint for hotel destinations.
 * Uses an in-memory cache (1h TTL) and a short timeout so slow upstream
 * calls never block the user.
 */

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
  if (cache.size > 500) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolve(fallback);
      }
    }, timeoutMs);
    promise
      .then((v) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(v);
      })
      .catch(() => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(fallback);
      });
  });
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

  try {
    const results = await withTimeout(searchLocations(query), 1500, []);
    if (results.length > 0) {
      cacheSet(cacheKey, results);
    }
    return NextResponse.json({ success: true, data: results });
  } catch (error: any) {
    console.error('[hotels/destinations] error:', error?.message);
    return NextResponse.json(
      { success: false, error: error?.message || 'Search failed', data: [] },
      { status: 500 }
    );
  }
}
