/**
 * BTS DB1B Ingester — auto-downloads and processes US DOT airline ticket data.
 *
 * Source: Bureau of Transportation Statistics DB1B Market databases
 * URL pattern: https://transtats.bts.gov/PREZIP/Origin_and_Destination_Survey_DB1BMarket_YYYY_Q.zip
 *
 * Downloads YYYY=2023..2024, Q=1..4 (8 files, ~4 GB total)
 * Streams unzip + csv-parse + batch insert 5000
 *
 * Usage: npx tsx scripts/ingest/bts-db1b.ts
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
const SOURCE = 'bts-db1b';
const BATCH_SIZE = 5000;
const SOURCE_QUALITY = 85;

// BTS PREZIP URL pattern
const URL_PATTERN =
  'https://transtats.bts.gov/PREZIP/Origin_and_Destination_Survey_DB1BMarket_{YEAR}_{Q}.zip';

// Years and quarters to download
const YEARS = [2023, 2024];
const QUARTERS = [1, 2, 3, 4];

interface DB1BRow {
  origin: string;
  destination: string;
  year: number;
  quarter: number;
  avgFare: number;
  passengers: number;
}

async function downloadFile(url: string, destPath: string): Promise<boolean> {
  console.log(`[bts-db1b] Downloading ${url} ...`);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) BudgetPilot-Research/1.0',
      },
    });
    if (!res.ok) {
      console.warn(`[bts-db1b] HTTP ${res.status} for ${url}`);
      return false;
    }
    const body = res.body;
    if (!body) return false;

    const writer = createWriteStream(destPath);
    const reader = Readable.fromWeb(body as any);
    await pipeline(reader, writer);
    const info = await stat(destPath);
    console.log(`[bts-db1b] Downloaded ${(info.size / 1e6).toFixed(1)} MB -> ${destPath}`);
    return true;
  } catch (err: any) {
    console.warn(`[bts-db1b] Download failed: ${err.message}`);
    return false;
  }
}

function unzipFile(zipPath: string, outDir: string): string[] {
  console.log(`[bts-db1b] Unzipping ${zipPath} ...`);
  try {
    execSync(`unzip -o "${zipPath}" -d "${outDir}" 2>/dev/null`, {
      timeout: 120_000,
    });
    // Find CSV files in output
    const result = execSync(`find "${outDir}" -name "*.csv" -type f`, {
      encoding: 'utf-8',
      timeout: 10_000,
    });
    return result
      .trim()
      .split('\n')
      .filter((f) => f.length > 0);
  } catch (err: any) {
    console.warn(`[bts-db1b] Unzip failed: ${err.message}`);
    return [];
  }
}

async function processCSV(
  csvPath: string,
  supabase: ReturnType<typeof createClient>,
  year: number,
  quarter: number
): Promise<{ inserted: number; skipped: number }> {
  console.log(`[bts-db1b] Processing ${csvPath} ...`);
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
          `[bts-db1b] Batch insert error: ${error.message} (${toInsert.length} rows)`
        );
        skipped += toInsert.length;
      } else {
        inserted += toInsert.length;
      }
    };

    parser.on('data', async (record: Record<string, string>) => {
      const origin = (
        record['ORIGIN'] ??
        record['Origin'] ??
        ''
      )
        .trim()
        .toUpperCase();
      const dest = (
        record['DEST'] ??
        record['Dest'] ??
        record['DESTINATION'] ??
        ''
      )
        .trim()
        .toUpperCase();
      const fare = parseFloat(
        record['MARKET_FARE'] ??
          record['MktFare'] ??
          record['AVG_MARKET_FARE'] ??
          record['AVERAGE_FARE'] ??
          '0'
      );
      const pax = parseInt(
        record['PASSENGERS'] ??
          record['Passengers'] ??
          record['PAX'] ??
          '0',
        10
      );

      if (
        !origin ||
        !dest ||
        origin.length !== 3 ||
        dest.length !== 3 ||
        fare <= 0 ||
        fare > 20000
      ) {
        skipped++;
        return;
      }

      batch.push({
        origin,
        destination: dest,
        year,
        quarter,
        avg_fare_usd: Math.round(fare * 100) / 100,
        sample_count: pax || 1,
        source: SOURCE,
      });

      if (batch.length >= BATCH_SIZE) {
        parser.pause();
        await flushBatch();
        if (inserted % 50000 < BATCH_SIZE) {
          console.log(
            `[bts-db1b] Progress: ${inserted.toLocaleString()} inserted, ${skipped.toLocaleString()} skipped`
          );
        }
        parser.resume();
      }
    });

    parser.on('end', async () => {
      await flushBatch();
      console.log(
        `[bts-db1b] File done: ${inserted.toLocaleString()} inserted, ${skipped.toLocaleString()} skipped`
      );
      resolve({ inserted, skipped });
    });

    parser.on('error', (err) => {
      console.warn(`[bts-db1b] CSV parse error: ${err.message}`);
      // Don't reject — resolve with what we have
      flushBatch().then(() => resolve({ inserted, skipped }));
    });
  });
}

export async function ingestBTSDB1B(): Promise<{
  inserted: number;
  skipped: number;
}> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  // Log start
  const { data: run } = await supabase
    .from('ingestion_runs')
    .insert({ source: SOURCE, status: 'running' })
    .select('id')
    .single();

  const tmpDir = join(process.cwd(), '.tmp-bts-db1b');
  await mkdir(tmpDir, { recursive: true });

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const year of YEARS) {
    for (const q of QUARTERS) {
      const url = URL_PATTERN.replace('{YEAR}', String(year)).replace(
        '{Q}',
        String(q)
      );
      const zipPath = join(tmpDir, `db1b_${year}_${q}.zip`);
      const csvDir = join(tmpDir, `db1b_${year}_${q}`);
      await mkdir(csvDir, { recursive: true });

      const downloaded = await downloadFile(url, zipPath);
      if (!downloaded) {
        console.warn(`[bts-db1b] Skipping ${year} Q${q} (download failed)`);
        continue;
      }

      const csvFiles = unzipFile(zipPath, csvDir);
      if (csvFiles.length === 0) {
        console.warn(`[bts-db1b] No CSV found in ${zipPath}`);
        continue;
      }

      for (const csvFile of csvFiles) {
        const result = await processCSV(csvFile, supabase, year, q);
        totalInserted += result.inserted;
        totalSkipped += result.skipped;
      }

      // Cleanup zip to save disk
      try {
        await unlink(zipPath);
      } catch {}
    }
  }

  // Log completion
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
    `[bts-db1b] TOTAL: ${totalInserted.toLocaleString()} inserted, ${totalSkipped.toLocaleString()} skipped`
  );
  return { inserted: totalInserted, skipped: totalSkipped };
}

// CLI entry
const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('bts-db1b.ts');

if (isMain) {
  ingestBTSDB1B()
    .then((r) => {
      console.log(`[bts-db1b] Done:`, r);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[bts-db1b] Fatal:', err);
      process.exit(1);
    });
}
