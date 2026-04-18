/**
 * HuggingFace Ingester — auto-discovery of airfare datasets.
 *
 * Uses HuggingFace Datasets API to search for flight/airfare datasets,
 * downloads the most relevant ones, and ingests into Supabase.
 *
 * No API key needed — HuggingFace datasets API is public.
 *
 * Usage: npx tsx scripts/ingest/huggingface.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const SOURCE = 'huggingface';

const SEARCH_QUERIES = ['flight price', 'airfare', 'airline ticket price', 'flight fare prediction'];
const HF_API = 'https://huggingface.co/api/datasets';

interface HFDataset {
  id: string;
  downloads: number;
  tags: string[];
  lastModified: string;
}

/**
 * Search HuggingFace for relevant datasets.
 */
async function discoverDatasets(): Promise<HFDataset[]> {
  const results: HFDataset[] = [];
  const seen = new Set<string>();

  for (const query of SEARCH_QUERIES) {
    try {
      const res = await fetch(`${HF_API}?search=${encodeURIComponent(query)}&limit=5&sort=downloads`);
      if (!res.ok) continue;
      const data = await res.json() as unknown[];
      for (const ds of data as any[]) {
        if (seen.has(ds.id)) continue;
        seen.add(ds.id);
        results.push({
          id: ds.id,
          downloads: ds.downloads ?? 0,
          tags: ds.tags ?? [],
          lastModified: ds.lastModified ?? '',
        });
      }
    } catch (_) {
      continue;
    }
  }

  // Sort by downloads (most popular first)
  return results.sort((a, b) => b.downloads - a.downloads).slice(0, 10);
}

/**
 * Attempt to download and parse a HuggingFace dataset.
 * Returns normalized rows or empty array if parsing fails.
 */
async function fetchAndParse(
  datasetId: string
): Promise<Array<{ origin: string; destination: string; priceUsd: number; year: number }>> {
  try {
    // Try the Parquet viewer API (works for most datasets)
    const url = `https://datasets-server.huggingface.co/first-rows?dataset=${encodeURIComponent(datasetId)}&config=default&split=train`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json() as Record<string, unknown>;
    const rows = (data as any)?.rows ?? [];
    if (!Array.isArray(rows) || rows.length === 0) return [];

    const results: Array<{ origin: string; destination: string; priceUsd: number; year: number }> = [];

    for (const row of rows) {
      const r = row?.row ?? row;
      if (!r || typeof r !== 'object') continue;

      // Try to extract origin, destination, price from common column names
      const origin =
        r.origin ?? r.Origin ?? r.ORIGIN ?? r.source ?? r.Source ?? r.departure_airport ?? '';
      const dest =
        r.destination ?? r.Destination ?? r.DEST ?? r.dest ?? r.arrival_airport ?? '';
      const price =
        parseFloat(r.price ?? r.Price ?? r.fare ?? r.Fare ?? r.price_usd ?? r.total_fare ?? '0');

      if (typeof origin !== 'string' || typeof dest !== 'string') continue;
      if (origin.length < 2 || dest.length < 2 || price <= 0 || price > 50000) continue;

      results.push({
        origin: origin.slice(0, 3).toUpperCase(),
        destination: dest.slice(0, 3).toUpperCase(),
        priceUsd: price,
        year: 2023,
      });
    }

    return results;
  } catch (_) {
    return [];
  }
}

export async function ingestHuggingFace(): Promise<{
  datasetsFound: number;
  datasetsIngested: number;
  rowsInserted: number;
  errors: string[];
}> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Missing Supabase credentials');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  const { data: run } = await supabase
    .from('ingestion_runs')
    .insert({ source: SOURCE, status: 'running' })
    .select('id')
    .single();

  const datasets = await discoverDatasets();
  const errors: string[] = [];
  let datasetsIngested = 0;
  let totalRows = 0;

  for (const ds of datasets) {
    try {
      const rows = await fetchAndParse(ds.id);
      if (rows.length === 0) continue;

      const batch = rows.map((r) => ({
        origin: r.origin,
        destination: r.destination,
        year: r.year,
        quarter: 1,
        avg_fare_usd: r.priceUsd,
        sample_count: 1,
        source: `${SOURCE}/${ds.id}`,
      }));

      const { error } = await supabase.from('real_aggregated_fares').insert(batch);
      if (!error) {
        totalRows += batch.length;
        datasetsIngested++;
      }
    } catch (err: unknown) {
      errors.push(`${ds.id}: ${(err as Error)?.message}`);
    }
  }

  if (run?.id) {
    await supabase.from('ingestion_runs').update({
      completed_at: new Date().toISOString(),
      rows_ingested: totalRows,
      status: 'completed',
    }).eq('id', run.id);
  }

  return { datasetsFound: datasets.length, datasetsIngested, rowsInserted: totalRows, errors };
}
