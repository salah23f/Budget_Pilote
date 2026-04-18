/**
 * Wayback Machine Ingester — historical fare page snapshots.
 *
 * Queries Archive.org CDX API for cached Kayak/Google Flights pages,
 * downloads snapshots, and attempts to extract prices via regex.
 *
 * Quality score: 50 (parsing unreliable, but provides unique historical data).
 * Source: https://web.archive.org/cdx/search/cdx
 *
 * Usage: npx tsx scripts/ingest/wayback.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const SOURCE = 'wayback';

const SEARCH_URLS = [
  'kayak.com/flights/*',
  'google.com/flights*',
];

interface WaybackSnapshot {
  timestamp: string;
  url: string;
  statuscode: string;
}

/**
 * Query Wayback CDX API for archived pages.
 */
async function queryWaybackCDX(
  urlPattern: string,
  fromDate: string = '20150101',
  toDate: string = '20241231',
  limit: number = 100
): Promise<WaybackSnapshot[]> {
  const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(urlPattern)}&output=json&from=${fromDate}&to=${toDate}&limit=${limit}&filter=statuscode:200`;

  try {
    const res = await fetch(cdxUrl);
    if (!res.ok) return [];
    const data = await res.json() as string[][];
    if (!Array.isArray(data) || data.length < 2) return [];

    // First row is headers
    return data.slice(1).map((row) => ({
      timestamp: row[1] ?? '',
      url: row[2] ?? '',
      statuscode: row[4] ?? '',
    }));
  } catch (_) {
    return [];
  }
}

/**
 * Extract prices from a Wayback HTML page.
 * Very fragile — regex-based, quality=50.
 */
function extractPricesFromHTML(html: string): Array<{ price: number; currency: string }> {
  const prices: Array<{ price: number; currency: string }> = [];

  // Pattern: $XXX or $X,XXX
  const usdPattern = /\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;
  let match;
  while ((match = usdPattern.exec(html)) !== null) {
    const price = parseFloat(match[1].replace(/,/g, ''));
    if (price >= 50 && price <= 15000) {
      prices.push({ price, currency: 'USD' });
    }
  }

  // Pattern: €XXX or EUR XXX
  const eurPattern = /(?:€|EUR)\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/g;
  while ((match = eurPattern.exec(html)) !== null) {
    const price = parseFloat(match[1].replace(/[.,](?=\d{3})/g, '').replace(',', '.'));
    if (price >= 50 && price <= 15000) {
      prices.push({ price: price * 1.1, currency: 'EUR' }); // Approx EUR→USD
    }
  }

  return prices;
}

/**
 * Extract route info from URL (best effort).
 */
function extractRouteFromURL(url: string): { origin: string; destination: string } | null {
  // Kayak: /flights/CDG-JFK/...
  const kayakMatch = url.match(/flights\/([A-Z]{3})-([A-Z]{3})/);
  if (kayakMatch) return { origin: kayakMatch[1], destination: kayakMatch[2] };

  // Google: various formats
  const googleMatch = url.match(/([A-Z]{3}).*?([A-Z]{3})/);
  if (googleMatch && googleMatch[1] !== googleMatch[2]) {
    return { origin: googleMatch[1], destination: googleMatch[2] };
  }

  return null;
}

export async function ingestWayback(): Promise<{ inserted: number; errors: string[] }> {
  const errors: string[] = [];
  let inserted = 0;

  const supabase = SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
    : null;

  for (const urlPattern of SEARCH_URLS) {
    try {
      const snapshots = await queryWaybackCDX(urlPattern, '20200101', '20241231', 50);

      for (const snap of snapshots) {
        try {
          const waybackUrl = `https://web.archive.org/web/${snap.timestamp}/${snap.url}`;
          const res = await fetch(waybackUrl);
          if (!res.ok) continue;
          const html = await res.text();

          const route = extractRouteFromURL(snap.url);
          if (!route) continue;

          const prices = extractPricesFromHTML(html);
          if (prices.length === 0) continue;

          // Take the cheapest as representative
          const cheapest = Math.min(...prices.map((p) => p.price));
          const obsDate = `${snap.timestamp.slice(0, 4)}-${snap.timestamp.slice(4, 6)}-${snap.timestamp.slice(6, 8)}`;

          if (supabase) {
            const { error } = await supabase.from('real_aggregated_fares').insert({
              origin: route.origin,
              destination: route.destination,
              year: parseInt(snap.timestamp.slice(0, 4)),
              quarter: Math.ceil(parseInt(snap.timestamp.slice(4, 6)) / 3),
              avg_fare_usd: cheapest,
              min_fare_usd: cheapest,
              sample_count: prices.length,
              source: SOURCE,
            });
            if (!error) inserted++;
          }

          // Rate limit
          await new Promise((r) => setTimeout(r, 2000));
        } catch (snapErr: unknown) {
          errors.push(`Snapshot ${snap.timestamp}: ${(snapErr as Error)?.message?.slice(0, 100)}`);
        }
      }
    } catch (err: unknown) {
      errors.push(`CDX ${urlPattern}: ${(err as Error)?.message}`);
    }
  }

  return { inserted, errors };
}
