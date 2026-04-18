/**
 * Expedia ICDM 2013 Ingester — academic hotel/flight pricing dataset.
 *
 * Source: Expedia Personalized Sort (ICDM 2013 competition)
 * URL: https://www.kaggle.com/c/expedia-personalized-sort/data
 *
 * Contains: search queries with prices, dates, star ratings, user actions.
 * ~10M rows with price_usd, position, booking_bool, etc.
 *
 * We extract: price distributions by route+advance_purchase_days.
 *
 * Usage: npx tsx scripts/ingest/expedia-icdm.ts path/to/train.csv
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const SOURCE = 'expedia-icdm';

interface ExpediaRow {
  searchDest: string;
  priceUsd: number;
  advancePurchaseDays: number;
  starRating: number;
  isBooked: boolean;
}

function parseExpediaRow(line: string, headers: string[]): ExpediaRow | null {
  const cols = line.split(',');
  if (cols.length < headers.length) return null;

  const get = (name: string): string => {
    const idx = headers.indexOf(name);
    return idx >= 0 ? cols[idx]?.trim() ?? '' : '';
  };

  const dest = get('prop_country_id') || get('srch_destination_id');
  const price = parseFloat(get('price_usd') || get('gross_bookings_usd') || '0');
  const apd = parseInt(get('srch_booking_window') || get('advance_purchase_days') || '0');
  const stars = parseFloat(get('prop_starrating') || '0');
  const booked = get('booking_bool') === '1' || get('click_bool') === '1';

  if (price <= 0 || price > 10000) return null;

  return {
    searchDest: dest || 'UNKNOWN',
    priceUsd: price,
    advancePurchaseDays: apd,
    starRating: stars,
    isBooked: booked,
  };
}

export async function ingestExpediaICDM(csvContent: string): Promise<{ inserted: number; skipped: number }> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Missing Supabase credentials');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  const { data: run } = await supabase
    .from('ingestion_runs')
    .insert({ source: SOURCE, status: 'running' })
    .select('id')
    .single();

  const lines = csvContent.split('\n').filter((l) => l.trim());
  if (lines.length < 2) throw new Error('CSV empty');

  const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));

  // Aggregate by destination + booking window bucket
  const agg = new Map<string, { prices: number[]; count: number }>();

  let skipped = 0;
  const maxLines = Math.min(lines.length, 500000); // Cap for memory

  for (let i = 1; i < maxLines; i++) {
    const row = parseExpediaRow(lines[i], headers);
    if (!row) { skipped++; continue; }

    const bucket = Math.floor(row.advancePurchaseDays / 30); // monthly buckets
    const key = `${row.searchDest}-B${bucket}`;

    const existing = agg.get(key) ?? { prices: [], count: 0 };
    existing.prices.push(row.priceUsd);
    existing.count++;
    if (existing.prices.length > 1000) {
      existing.prices = existing.prices.slice(-500); // Keep last 500 for memory
    }
    agg.set(key, existing);
  }

  // Insert aggregated data
  let inserted = 0;
  const batch: Array<Record<string, unknown>> = [];

  for (const [key, data] of agg) {
    if (data.prices.length < 3) continue;
    const sorted = [...data.prices].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const avg = data.prices.reduce((a, b) => a + b, 0) / data.prices.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    batch.push({
      origin: 'EXP', // Expedia doesn't have IATA origins in this dataset
      destination: key.split('-')[0] ?? 'UNK',
      year: 2013,
      quarter: 1,
      avg_fare_usd: avg,
      median_fare_usd: median,
      min_fare_usd: min,
      max_fare_usd: max,
      sample_count: data.count,
      source: SOURCE,
    });
  }

  for (let j = 0; j < batch.length; j += 500) {
    const chunk = batch.slice(j, j + 500);
    const { error } = await supabase.from('real_aggregated_fares').insert(chunk);
    if (!error) inserted += chunk.length;
    else skipped += chunk.length;
  }

  if (run?.id) {
    await supabase.from('ingestion_runs').update({
      completed_at: new Date().toISOString(),
      rows_ingested: inserted,
      rows_skipped: skipped,
      status: 'completed',
    }).eq('id', run.id);
  }

  return { inserted, skipped };
}
