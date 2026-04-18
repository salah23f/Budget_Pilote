/**
 * Kaggle Ingester — downloads and processes 7 public flight fare datasets.
 *
 * Targets (extended):
 *   1. nikhilmittal/flight-fare-prediction-mh (~11k rows, Indian domestic)
 *   2. usdot/flight-delays (~5.8M rows, US domestic with delays)
 *   3. dilwong/flightprices (~5M rows, US 2022-2023 WITH TTD — CRITICAL)
 *   4. priyanshu594/flights-data-cleaned (US fares)
 *   5. iqra2021/flights-dataset (varied)
 *   6. andrewmvd/sp-flights (Brazil flights)
 *   7. tsiaras/american-airlines-delay-and-fare (AA fares+delays)
 *
 * Prerequisites: `pip install kaggle` + ~/.kaggle/kaggle.json configured.
 * Usage: npx tsx scripts/ingest/kaggle.ts
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const SOURCE = 'kaggle';
const DATA_DIR = path.resolve(process.cwd(), 'data/kaggle');

interface KaggleDataset {
  slug: string;
  priceCol: string[];
  originCol: string[];
  destCol: string[];
  ttdCol: string[];
  currencyFactor: number;
  maxRows: number;
}

const DATASETS: KaggleDataset[] = [
  {
    slug: 'dilwong/flightprices',
    priceCol: ['totalFare', 'baseFare', 'price'],
    originCol: ['startingAirport', 'origin', 'ORIGIN'],
    destCol: ['destinationAirport', 'destination', 'DEST'],
    ttdCol: ['daysUntilFlight', 'advance_purchase', 'searchDate'],
    currencyFactor: 1,
    maxRows: 500000,
  },
  {
    slug: 'nikhilmittal/flight-fare-prediction-mh',
    priceCol: ['Price', 'price', 'fare'],
    originCol: ['Source', 'origin'],
    destCol: ['Destination', 'destination'],
    ttdCol: [],
    currencyFactor: 1 / 83, // INR → USD
    maxRows: 50000,
  },
  {
    slug: 'priyanshu594/flights-data-cleaned',
    priceCol: ['price', 'fare', 'Price'],
    originCol: ['source', 'origin', 'Source'],
    destCol: ['destination', 'Destination'],
    ttdCol: [],
    currencyFactor: 1,
    maxRows: 200000,
  },
  {
    slug: 'iqra2021/flights-dataset',
    priceCol: ['price', 'fare', 'Price', 'Fare'],
    originCol: ['origin', 'source', 'from', 'Origin'],
    destCol: ['destination', 'dest', 'to', 'Destination'],
    ttdCol: [],
    currencyFactor: 1,
    maxRows: 200000,
  },
  {
    slug: 'andrewmvd/sp-flights',
    priceCol: ['Tarifa', 'tarifa', 'price', 'fare'],
    originCol: ['Origem', 'origem', 'origin'],
    destCol: ['Destino', 'destino', 'destination'],
    ttdCol: [],
    currencyFactor: 1 / 5, // BRL → USD approx
    maxRows: 200000,
  },
  {
    slug: 'tsiaras/american-airlines-delay-and-fare',
    priceCol: ['fare', 'price', 'avg_fare'],
    originCol: ['origin', 'Origin', 'ORIGIN'],
    destCol: ['dest', 'destination', 'DEST'],
    ttdCol: [],
    currencyFactor: 1,
    maxRows: 200000,
  },
];

function findCol(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.findIndex((h) => h.toLowerCase().trim() === c.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

async function streamParseCSV(
  filePath: string,
  ds: KaggleDataset
): Promise<Array<{ origin: string; destination: string; priceUsd: number; ttd: number | null }>> {
  const rows: Array<{ origin: string; destination: string; priceUsd: number; ttd: number | null }> = [];

  const rl = createInterface({ input: createReadStream(filePath, 'utf-8'), crlfDelay: Infinity });
  let headers: string[] = [];
  let lineNum = 0;

  for await (const line of rl) {
    lineNum++;
    if (lineNum === 1) {
      headers = line.split(',').map((h) => h.trim().replace(/"/g, ''));
      continue;
    }
    if (rows.length >= ds.maxRows) break;

    const cols = line.split(',').map((c) => c.trim().replace(/"/g, ''));

    const priceIdx = findCol(headers, ds.priceCol);
    const originIdx = findCol(headers, ds.originCol);
    const destIdx = findCol(headers, ds.destCol);
    const ttdIdx = ds.ttdCol.length > 0 ? findCol(headers, ds.ttdCol) : -1;

    if (priceIdx < 0 || originIdx < 0 || destIdx < 0) continue;

    const rawPrice = parseFloat(cols[priceIdx] ?? '0');
    if (rawPrice <= 0 || rawPrice > 50000) continue;

    const priceUsd = rawPrice * ds.currencyFactor;
    const origin = (cols[originIdx] ?? '').slice(0, 3).toUpperCase();
    const dest = (cols[destIdx] ?? '').slice(0, 3).toUpperCase();

    if (origin.length < 2 || dest.length < 2) continue;

    const ttd = ttdIdx >= 0 ? parseInt(cols[ttdIdx] ?? '') || null : null;

    rows.push({ origin, destination: dest, priceUsd: Math.round(priceUsd * 100) / 100, ttd });
  }

  return rows;
}

export async function ingestKaggle(): Promise<{
  inserted: number;
  skipped: number;
  errors: string[];
  perDataset: Record<string, number>;
}> {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing Supabase credentials');

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const errors: string[] = [];
  let totalInserted = 0;
  let totalSkipped = 0;
  const perDataset: Record<string, number> = {};

  const { data: run } = await supabase
    .from('ingestion_runs')
    .insert({ source: SOURCE, status: 'running' })
    .select('id')
    .single();

  for (const ds of DATASETS) {
    const dsDir = path.join(DATA_DIR, ds.slug.replace('/', '_'));
    perDataset[ds.slug] = 0;

    try {
      fs.mkdirSync(dsDir, { recursive: true });

      // Download
      try {
        execSync(`kaggle datasets download -d ${ds.slug} -p ${dsDir} --unzip --force`, {
          stdio: 'pipe', timeout: 300000,
        });
      } catch (dlErr: unknown) {
        errors.push(`Download ${ds.slug}: ${(dlErr as Error)?.message?.slice(0, 200)}`);
        continue;
      }

      // Find CSV files
      const files = fs.readdirSync(dsDir).filter((f) => f.endsWith('.csv'));
      if (files.length === 0) {
        errors.push(`No CSV in ${ds.slug}`);
        continue;
      }

      for (const csvFile of files) {
        const rows = await streamParseCSV(path.join(dsDir, csvFile), ds);

        if (rows.length === 0) continue;

        // Batch insert into real_price_samples (for rows WITH TTD) or real_aggregated_fares
        const withTTD = rows.filter((r) => r.ttd !== null && r.ttd > 0);
        const withoutTTD = rows.filter((r) => r.ttd === null || r.ttd <= 0);

        // Insert rows with TTD into real_price_samples
        for (let j = 0; j < withTTD.length; j += 500) {
          const chunk = withTTD.slice(j, j + 500).map((r) => ({
            origin: r.origin,
            destination: r.destination,
            depart_date: new Date(Date.now() + (r.ttd ?? 30) * 86400000).toISOString().split('T')[0],
            price_usd: r.priceUsd,
            airline: 'Unknown',
            stops: 0,
            source: `${SOURCE}/${ds.slug}`,
            fetched_at: new Date().toISOString(),
          }));

          const { error } = await supabase.from('real_price_samples').insert(chunk);
          if (!error) {
            totalInserted += chunk.length;
            perDataset[ds.slug] = (perDataset[ds.slug] ?? 0) + chunk.length;
          } else {
            totalSkipped += chunk.length;
          }
        }

        // Insert rows without TTD into real_aggregated_fares
        // Aggregate by route first
        const routeAgg = new Map<string, number[]>();
        for (const r of withoutTTD) {
          const key = `${r.origin}-${r.destination}`;
          if (!routeAgg.has(key)) routeAgg.set(key, []);
          routeAgg.get(key)!.push(r.priceUsd);
        }

        const aggBatch = Array.from(routeAgg.entries()).map(([key, prices]) => {
          const [origin, dest] = key.split('-');
          const sorted = [...prices].sort((a, b) => a - b);
          return {
            origin,
            destination: dest,
            year: 2023,
            quarter: 1,
            avg_fare_usd: prices.reduce((a, b) => a + b, 0) / prices.length,
            median_fare_usd: sorted[Math.floor(sorted.length / 2)],
            min_fare_usd: sorted[0],
            max_fare_usd: sorted[sorted.length - 1],
            sample_count: prices.length,
            source: `${SOURCE}/${ds.slug}`,
          };
        });

        for (let j = 0; j < aggBatch.length; j += 500) {
          const chunk = aggBatch.slice(j, j + 500);
          const { error } = await supabase.from('real_aggregated_fares').insert(chunk);
          if (!error) {
            totalInserted += chunk.length;
            perDataset[ds.slug] = (perDataset[ds.slug] ?? 0) + chunk.length;
          } else {
            totalSkipped += chunk.length;
          }
        }
      }
    } catch (err: unknown) {
      errors.push(`${ds.slug}: ${(err as Error)?.message?.slice(0, 200)}`);
    }
  }

  if (run?.id) {
    await supabase.from('ingestion_runs').update({
      completed_at: new Date().toISOString(),
      rows_ingested: totalInserted,
      rows_skipped: totalSkipped,
      status: 'completed',
    }).eq('id', run.id);
  }

  return { inserted: totalInserted, skipped: totalSkipped, errors, perDataset };
}
