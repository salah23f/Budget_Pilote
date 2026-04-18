/**
 * Kaggle Ingester — downloads and processes public flight fare datasets.
 *
 * Targets:
 *   1. flight-fare-prediction-mh (~11k rows, Indian domestic fares)
 *   2. usdot/flight-delays (~5.8M rows, US domestic with delays)
 *
 * Prerequisites: `pip install kaggle` + ~/.kaggle/kaggle.json configured.
 *
 * Usage: npx tsx scripts/ingest/kaggle.ts
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const SOURCE = 'kaggle';
const DATA_DIR = path.resolve(process.cwd(), 'data/kaggle');

const DATASETS = [
  {
    slug: 'nikhilmittal/flight-fare-prediction-mh',
    file: 'Data_Train.xlsx',
    parser: 'fare-prediction',
  },
  {
    slug: 'usdot/flight-delays',
    file: 'flights.csv',
    parser: 'usdot-delays',
  },
];

interface NormalizedRow {
  origin: string;
  destination: string;
  year: number;
  quarter: number;
  avgFareUsd: number | null;
  sampleCount: number;
}

function parseFlightFarePrediction(csvContent: string): NormalizedRow[] {
  const lines = csvContent.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];
  const rows: NormalizedRow[] = [];
  for (let i = 1; i < Math.min(lines.length, 50000); i++) {
    const cols = lines[i].split(',');
    if (cols.length < 10) continue;
    const origin = cols[2]?.trim().slice(0, 3).toUpperCase();
    const dest = cols[4]?.trim().slice(0, 3).toUpperCase();
    const price = parseFloat(cols[cols.length - 1] ?? '0');
    if (!origin || !dest || price <= 0) continue;
    // Indian Rupees → USD (approximate: 1 USD ≈ 83 INR)
    const priceUsd = price / 83;
    rows.push({ origin, destination: dest, year: 2019, quarter: 1, avgFareUsd: priceUsd, sampleCount: 1 });
  }
  return rows;
}

function parseUSDOTDelays(csvContent: string): NormalizedRow[] {
  const lines = csvContent.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
  const rows: NormalizedRow[] = [];
  const routeAgg = new Map<string, { total: number; count: number; year: number; month: number }>();

  for (let i = 1; i < Math.min(lines.length, 200000); i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/"/g, ''));
    const origIdx = headers.indexOf('ORIGIN_AIRPORT');
    const destIdx = headers.indexOf('DESTINATION_AIRPORT');
    const yearIdx = headers.indexOf('YEAR');
    const monthIdx = headers.indexOf('MONTH');

    if (origIdx < 0 || destIdx < 0) continue;
    const origin = cols[origIdx]?.slice(0, 3).toUpperCase();
    const dest = cols[destIdx]?.slice(0, 3).toUpperCase();
    const year = parseInt(cols[yearIdx] ?? '2015');
    const month = parseInt(cols[monthIdx] ?? '1');

    if (!origin || !dest || origin.length !== 3 || dest.length !== 3) continue;

    const key = `${origin}-${dest}-${year}-${Math.ceil(month / 3)}`;
    const existing = routeAgg.get(key) ?? { total: 0, count: 0, year, month };
    existing.count++;
    routeAgg.set(key, existing);
  }

  for (const [key, agg] of routeAgg) {
    const [origin, dest, yearStr, qStr] = key.split('-');
    rows.push({
      origin,
      destination: dest,
      year: parseInt(yearStr),
      quarter: parseInt(qStr),
      avgFareUsd: null, // No fare data in this dataset — only traffic
      sampleCount: agg.count,
    });
  }

  return rows;
}

export async function ingestKaggle(): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Missing Supabase credentials');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const errors: string[] = [];
  let totalInserted = 0;
  let totalSkipped = 0;

  for (const ds of DATASETS) {
    const dsDir = path.join(DATA_DIR, ds.slug.replace('/', '_'));

    try {
      // Download via Kaggle CLI
      fs.mkdirSync(dsDir, { recursive: true });
      try {
        execSync(`kaggle datasets download -d ${ds.slug} -p ${dsDir} --unzip --force`, {
          stdio: 'pipe',
          timeout: 120000,
        });
      } catch (dlErr: unknown) {
        errors.push(`Download failed for ${ds.slug}: ${(dlErr as Error)?.message}`);
        continue;
      }

      // Find the CSV file
      const files = fs.readdirSync(dsDir);
      const csvFile = files.find((f) => f.endsWith('.csv') || f.endsWith('.xlsx'));
      if (!csvFile) {
        errors.push(`No CSV found in ${dsDir}`);
        continue;
      }

      const content = fs.readFileSync(path.join(dsDir, csvFile), 'utf-8');

      let rows: NormalizedRow[];
      if (ds.parser === 'fare-prediction') {
        rows = parseFlightFarePrediction(content);
      } else {
        rows = parseUSDOTDelays(content);
      }

      // Insert
      const batch = rows
        .filter((r) => r.avgFareUsd !== null && r.avgFareUsd > 0)
        .map((r) => ({
          origin: r.origin,
          destination: r.destination,
          year: r.year,
          quarter: r.quarter,
          avg_fare_usd: r.avgFareUsd,
          sample_count: r.sampleCount,
          source: `${SOURCE}/${ds.slug}`,
        }));

      if (batch.length > 0) {
        for (let j = 0; j < batch.length; j += 1000) {
          const chunk = batch.slice(j, j + 1000);
          const { error } = await supabase.from('real_aggregated_fares').insert(chunk);
          if (!error) totalInserted += chunk.length;
          else totalSkipped += chunk.length;
        }
      }
    } catch (err: unknown) {
      errors.push(`${ds.slug}: ${(err as Error)?.message}`);
    }
  }

  return { inserted: totalInserted, skipped: totalSkipped, errors };
}
