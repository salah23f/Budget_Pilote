import { NextRequest, NextResponse } from 'next/server';
import { searchFlights } from '@/lib/amadeus/flights';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/flights/calendar?origin=CDG&destination=JFK&month=2026-06&cabin=economy&adults=1
 *
 * Returns a price map for a full month: { "2026-06-01": 342, "2026-06-04": 298, ... }
 * Samples ~7 dates across the month in parallel, then interpolates between them
 * so every day has an estimated price. Cached 1 hour per route+month.
 */

type CacheEntry = { prices: Record<string, number>; expires: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function daysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function dateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export async function GET(req: NextRequest) {
  const started = Date.now();
  try { return await handleCalendar(req, started); } catch (err: any) {
    console.error('[flights/calendar] unhandled', { ms: Date.now() - started, error: err?.message });
    return NextResponse.json({ success: false, error: err?.message || 'Calendar failed' }, { status: 500 });
  }
}

async function handleCalendar(req: NextRequest, started: number) {
  const sp = req.nextUrl.searchParams;
  const origin = sp.get('origin') || '';
  const destination = sp.get('destination') || '';
  const month = sp.get('month') || '';
  const cabin = sp.get('cabin') || 'economy';
  const adults = Number(sp.get('adults') || 1);

  if (!origin || !destination || !month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { success: false, error: 'Required: origin, destination, month (YYYY-MM)' },
      { status: 400 }
    );
  }

  const cacheKey = `${origin}|${destination}|${month}|${cabin}|${adults}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expires) {
    console.log('[flights/calendar] cache hit', { cacheKey, ms: Date.now() - started });
    return NextResponse.json({ success: true, prices: cached.prices, cached: true });
  }

  const [year, mo] = month.split('-').map(Number);
  const totalDays = daysInMonth(month);
  const today = new Date().toISOString().split('T')[0];

  // Sample ~7 dates evenly across the month
  const sampleDays: number[] = [];
  const step = Math.max(1, Math.floor(totalDays / 7));
  for (let d = 1; d <= totalDays; d += step) {
    sampleDays.push(d);
  }
  // Always include the last day
  if (sampleDays[sampleDays.length - 1] !== totalDays) {
    sampleDays.push(totalDays);
  }

  // Filter out past dates
  const sampleDates = sampleDays
    .map((d) => dateStr(year, mo, d))
    .filter((d) => d >= today);

  if (sampleDates.length === 0) {
    return NextResponse.json({ success: true, prices: {}, message: 'All dates in the past' });
  }

  // Parallel flight searches for each sampled date
  const results = await Promise.allSettled(
    sampleDates.map(async (departDate) => {
      try {
        const offers = await searchFlights({
          origin,
          destination,
          departDate,
          adults,
          cabinClass: cabin as any,
        });
        if (offers.length === 0) return { date: departDate, price: 0 };
        const cheapest = Math.min(...offers.map((o) => o.priceUsd).filter((p) => p > 0));
        return { date: departDate, price: cheapest };
      } catch (_) {
        return { date: departDate, price: 0 };
      }
    })
  );

  // Build the raw price map from successful samples
  const rawPrices: Record<string, number> = {};
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.price > 0) {
      rawPrices[r.value.date] = Math.round(r.value.price);
    }
  }

  // Interpolate between samples so every day has a price estimate
  const allPrices: Record<string, number> = {};
  const sortedDates = Object.keys(rawPrices).sort();

  if (sortedDates.length >= 2) {
    // Linear interpolation between adjacent known prices
    for (let d = 1; d <= totalDays; d++) {
      const ds = dateStr(year, mo, d);
      if (ds < today) continue;

      if (rawPrices[ds] != null) {
        allPrices[ds] = rawPrices[ds];
        continue;
      }

      // Find the nearest known dates before and after
      let before: string | null = null;
      let after: string | null = null;
      for (const sd of sortedDates) {
        if (sd <= ds) before = sd;
        if (sd > ds && !after) after = sd;
      }

      if (before && after) {
        const pBefore = rawPrices[before];
        const pAfter = rawPrices[after];
        const dBefore = new Date(ds).getTime() - new Date(before).getTime();
        const dTotal = new Date(after).getTime() - new Date(before).getTime();
        const ratio = dTotal > 0 ? dBefore / dTotal : 0;
        allPrices[ds] = Math.round(pBefore + (pAfter - pBefore) * ratio);
      } else if (before) {
        allPrices[ds] = rawPrices[before];
      } else if (after) {
        allPrices[ds] = rawPrices[after];
      }
    }
  } else {
    // Only one or zero samples — use what we have
    Object.assign(allPrices, rawPrices);
  }

  // Cache result
  if (Object.keys(allPrices).length > 0) {
    cache.set(cacheKey, { prices: allPrices, expires: Date.now() + CACHE_TTL });
    // Bound cache size
    if (cache.size > 200) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
  }

  console.log('[flights/calendar] ok', {
    cacheKey,
    sampled: sampleDates.length,
    filled: Object.keys(allPrices).length,
    ms: Date.now() - started,
  });

  return NextResponse.json({
    success: true,
    prices: allPrices,
    sampled: sampleDates.length,
    interpolated: Object.keys(allPrices).length - Object.keys(rawPrices).length,
    cached: false,
  });
}
