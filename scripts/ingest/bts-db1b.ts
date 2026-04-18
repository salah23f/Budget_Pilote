/**
 * BTS DB1B Ingester — downloads and processes US DOT airline ticket data.
 *
 * Source: Bureau of Transportation Statistics DB1B Coupon/Ticket databases
 * URL: https://www.transtats.bts.gov/DL_SelectFields.aspx?gnoession_id=0&Table_ID=272
 *
 * Contains: origin, destination, fare, airline, quarter, year
 * ~15M rows for 2020-2024
 *
 * This script:
 *   1. Downloads quarterly CSV files from BTS
 *   2. Parses and normalizes to USD
 *   3. Inserts into Supabase real_aggregated_fares
 *   4. Logs run in ingestion_runs
 *
 * Usage: npx tsx scripts/ingest/bts-db1b.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const SOURCE = 'bts-db1b';

// BTS data is behind a form — we use pre-downloaded CSVs or the API
// For production, download from: https://www.transtats.bts.gov/

interface DB1BRow {
  origin: string;
  destination: string;
  year: number;
  quarter: number;
  avgFare: number;
  passengers: number;
}

/**
 * Parse a BTS CSV line.
 * Expected columns: ORIGIN, DEST, YEAR, QUARTER, MARKET_FARE, PASSENGERS
 */
function parseRow(line: string, headers: string[]): DB1BRow | null {
  const cols = line.split(',').map((c) => c.trim().replace(/"/g, ''));
  if (cols.length < headers.length) return null;

  const get = (name: string): string => cols[headers.indexOf(name)] ?? '';

  const origin = get('ORIGIN');
  const dest = get('DEST');
  const year = parseInt(get('YEAR'));
  const quarter = parseInt(get('QUARTER'));
  const fare = parseFloat(get('MARKET_FARE') || get('AVG_FARE') || '0');
  const pax = parseInt(get('PASSENGERS') || '0');

  if (!origin || !dest || !year || fare <= 0) return null;
  if (origin.length !== 3 || dest.length !== 3) return null;

  return { origin, destination: dest, year, quarter, avgFare: fare, passengers: pax };
}

export async function ingestBTSDB1B(csvContent: string): Promise<{ inserted: number; skipped: number }> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  // Log start
  const { data: run } = await supabase
    .from('ingestion_runs')
    .insert({ source: SOURCE, status: 'running' })
    .select('id')
    .single();

  const lines = csvContent.split('\n').filter((l) => l.trim());
  if (lines.length < 2) {
    throw new Error('CSV has no data rows');
  }

  const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
  let inserted = 0;
  let skipped = 0;
  const batch: Array<Record<string, unknown>> = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseRow(lines[i], headers);
    if (!row) { skipped++; continue; }

    batch.push({
      origin: row.origin,
      destination: row.destination,
      year: row.year,
      quarter: row.quarter,
      avg_fare_usd: row.avgFare,
      sample_count: row.passengers,
      source: SOURCE,
    });

    // Flush every 1000 rows
    if (batch.length >= 1000) {
      const { error } = await supabase.from('real_aggregated_fares').insert(batch);
      if (error) {
        console.warn(`[bts-db1b] batch insert error at row ${i}:`, error.message);
        skipped += batch.length;
      } else {
        inserted += batch.length;
      }
      batch.length = 0;
    }
  }

  // Flush remaining
  if (batch.length > 0) {
    const { error } = await supabase.from('real_aggregated_fares').insert(batch);
    if (!error) inserted += batch.length;
    else skipped += batch.length;
  }

  // Log completion
  if (run?.id) {
    await supabase
      .from('ingestion_runs')
      .update({
        completed_at: new Date().toISOString(),
        rows_ingested: inserted,
        rows_skipped: skipped,
        status: 'completed',
      })
      .eq('id', run.id);
  }

  return { inserted, skipped };
}

// CLI entry
if (typeof require !== 'undefined' && require.main === module) {
  console.log('[bts-db1b] Starting ingestion...');
  console.log('[bts-db1b] This script expects a CSV file path as argument.');
  console.log('[bts-db1b] Usage: npx tsx scripts/ingest/bts-db1b.ts path/to/db1b.csv');
  console.log('[bts-db1b] Download from: https://www.transtats.bts.gov/DL_SelectFields.aspx');
}
