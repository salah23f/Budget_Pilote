/**
 * BTS T-100 Ingester — auto-downloads US DOT air carrier traffic statistics.
 *
 * Source: https://transtats.bts.gov/PREZIP/T_T100_MARKET_ALL_CARRIER_YYYY_M.zip
 * Contains: carrier, origin, dest, passengers, departures, seats, distance, year, month
 *
 * Downloads YYYY=2023..2024, all months.
 * Derives demand signals: load factor, estimated fare from distance.
 *
 * Usage: npx tsx scripts/ingest/bts-t100.ts
 */

import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse';
import { createWriteStream, createReadStream } from 'fs';
import { mkdir, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { execSync } from 'child_process';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
// IMPORTANT: T-100 n'observe PAS de prix, il observe du trafic (passengers,
// seats, departures, distance). Le "avg_fare_usd" inséré ci-dessous est
// reconstruit par régression linéaire (50 + distance*0.12). Ce n'est donc
// pas un prix réel. Marqué explicitement comme `synthetic_regression` pour
// que V7a puisse le filtrer en amont (voir docs/V7A_SCOPE.md et
// scripts/train/v7a/build_dataset.py).
const SOURCE = 'bts-t100-synthetic-regression';
const BATCH_SIZE = 5000;

// T-100 PREZIP URL pattern — one file per year
// Alternate patterns BTS has used:
const URL_PATTERNS = [
  'https://transtats.bts.gov/PREZIP/T_T100_MARKET_ALL_CARRIER_{YEAR}.zip',
  'https://transtats.bts.gov/PREZIP/T_T100D_MARKET_ALL_CARRIER_{YEAR}.zip',
];

const YEARS = [2023, 2024];

async function downloadFile(url: string, destPath: string): Promise<boolean> {
  console.log(`[bts-t100] Downloading ${url} ...`);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) BudgetPilot-Research/1.0',
      },
    });
    if (!res.ok) {
      console.warn(`[bts-t100] HTTP ${res.status} for ${url}`);
      return false;
    }
    const body = res.body;
    if (!body) return false;

    const writer = createWriteStream(destPath);
    const reader = Readable.fromWeb(body as any);
    await pipeline(reader, writer);
    const info = await stat(destPath);
    console.log(
      `[bts-t100] Downloaded ${(info.size / 1e6).toFixed(1)} MB -> ${destPath}`
    );
    return true;
  } catch (err: any) {
    console.warn(`[bts-t100] Download failed: ${err.message}`);
    return false;
  }
}

function unzipFile(zipPath: string, outDir: string): string[] {
  console.log(`[bts-t100] Unzipping ${zipPath} ...`);
  try {
    execSync(`unzip -o "${zipPath}" -d "${outDir}" 2>/dev/null`, {
      timeout: 120_000,
    });
    const result = execSync(`find "${outDir}" -name "*.csv" -type f`, {
      encoding: 'utf-8',
      timeout: 10_000,
    });
    return result
      .trim()
      .split('\n')
      .filter((f) => f.length > 0);
  } catch (err: any) {
    console.warn(`[bts-t100] Unzip failed: ${err.message}`);
    return [];
  }
}

async function processCSV(
  csvPath: string,
  supabase: ReturnType<typeof createClient>,
  year: number
): Promise<{ inserted: number; skipped: number }> {
  console.log(`[bts-t100] Processing ${csvPath} ...`);
  let inserted = 0;
  let skipped = 0;
  let batch: Array<Record<string, unknown>> = [];

  return new Promise((resolve, reject) => {
    const parser = createReadStream(csvPath).pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      })
    );

    const flushBatch = async () => {
      if (batch.length === 0) return;
      const toInsert = [...batch];
      batch = [];
      const { error } = await supabase
        .from('real_aggregated_fares')
        .insert(toInsert);
      if (error) {
        console.warn(
          `[bts-t100] Batch insert error: ${error.message} (${toInsert.length} rows)`
        );
        skipped += toInsert.length;
      } else {
        inserted += toInsert.length;
      }
    };

    parser.on('data', async (record: Record<string, string>) => {
      const origin = (
        record['ORIGIN'] ?? record['Origin'] ?? ''
      )
        .trim()
        .toUpperCase();
      const dest = (
        record['DEST'] ?? record['Dest'] ?? record['DESTINATION'] ?? ''
      )
        .trim()
        .toUpperCase();
      const month = parseInt(record['MONTH'] ?? record['Month'] ?? '0', 10);
      const pax = parseInt(
        record['PASSENGERS'] ?? record['Passengers'] ?? '0',
        10
      );
      const distance = parseInt(
        record['DISTANCE'] ?? record['Distance'] ?? '0',
        10
      );
      const seats = parseInt(record['SEATS'] ?? record['Seats'] ?? '0', 10);

      if (
        !origin ||
        !dest ||
        origin.length !== 3 ||
        dest.length !== 3 ||
        distance <= 0
      ) {
        skipped++;
        return;
      }

      const quarter = month > 0 ? Math.ceil(month / 3) : 1;
      // BLS regression estimate: ~$0.12/mile + $50 base
      const estimatedFare =
        distance > 0 ? Math.round((50 + distance * 0.12) * 100) / 100 : null;

      if (!estimatedFare || estimatedFare > 5000) {
        skipped++;
        return;
      }

      batch.push({
        origin,
        destination: dest,
        year: year,
        quarter,
        avg_fare_usd: estimatedFare,
        sample_count: pax || 1,
        source: SOURCE,
      });

      if (batch.length >= BATCH_SIZE) {
        parser.pause();
        await flushBatch();
        if (inserted % 50000 < BATCH_SIZE) {
          console.log(
            `[bts-t100] Progress: ${inserted.toLocaleString()} inserted, ${skipped.toLocaleString()} skipped`
          );
        }
        parser.resume();
      }
    });

    parser.on('end', async () => {
      await flushBatch();
      console.log(
        `[bts-t100] File done: ${inserted.toLocaleString()} inserted, ${skipped.toLocaleString()} skipped`
      );
      resolve({ inserted, skipped });
    });

    parser.on('error', (err) => {
      console.warn(`[bts-t100] CSV parse error: ${err.message}`);
      flushBatch().then(() => resolve({ inserted, skipped }));
    });
  });
}

export async function ingestBTST100(): Promise<{
  inserted: number;
  skipped: number;
}> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Missing Supabase credentials');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  const { data: run } = await supabase
    .from('ingestion_runs')
    .insert({ source: SOURCE, status: 'running' })
    .select('id')
    .single();

  const tmpDir = join(process.cwd(), '.tmp-bts-t100');
  await mkdir(tmpDir, { recursive: true });

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const year of YEARS) {
    let downloaded = false;
    const zipPath = join(tmpDir, `t100_${year}.zip`);
    const csvDir = join(tmpDir, `t100_${year}`);
    await mkdir(csvDir, { recursive: true });

    // Try multiple URL patterns
    for (const pattern of URL_PATTERNS) {
      const url = pattern.replace('{YEAR}', String(year));
      downloaded = await downloadFile(url, zipPath);
      if (downloaded) break;
    }

    if (!downloaded) {
      console.warn(`[bts-t100] Skipping ${year} (all download patterns failed)`);
      continue;
    }

    const csvFiles = unzipFile(zipPath, csvDir);
    if (csvFiles.length === 0) {
      console.warn(`[bts-t100] No CSV found in zip for ${year}`);
      continue;
    }

    for (const csvFile of csvFiles) {
      const result = await processCSV(csvFile, supabase, year);
      totalInserted += result.inserted;
      totalSkipped += result.skipped;
    }

    // Cleanup zip
    try {
      await unlink(zipPath);
    } catch {}
  }

  if (run?.id) {
    await supabase
      .from('ingestion_runs')
      .update({
        completed_at: new Date().toISOString(),
        rows_ingested: totalInserted,
        rows_skipped: totalSkipped,
        status: totalInserted > 0 ? 'completed' : 'failed',
      })
      .eq('id', run.id);
  }

  console.log(
    `[bts-t100] TOTAL: ${totalInserted.toLocaleString()} inserted, ${totalSkipped.toLocaleString()} skipped`
  );
  return { inserted: totalInserted, skipped: totalSkipped };
}

// CLI entry
const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('bts-t100.ts');

if (isMain) {
  ingestBTST100()
    .then((r) => {
      console.log('[bts-t100] Done:', r);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[bts-t100] Fatal:', err);
      process.exit(1);
    });
}
