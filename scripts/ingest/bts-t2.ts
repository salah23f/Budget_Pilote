/**
 * BTS T-2 Traffic Segment Ingester — DOT Air Carrier Summary data.
 *
 * Source: https://transtats.bts.gov/Tables.asp?DB_ID=110
 * Contains: load factor, capacity, RPM by carrier and route segment.
 * Excellent contextual features for the V7 model.
 *
 * Usage: npx tsx scripts/ingest/bts-t2.ts path/to/t2-segment.csv
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const SOURCE = 'bts-t2';

interface T2Row {
  carrier: string;
  origin: string;
  destination: string;
  year: number;
  month: number;
  passengers: number;
  seats: number;
  loadFactor: number;
  departures: number;
}

function parseRow(line: string, headers: string[]): T2Row | null {
  const cols = line.split(',').map((c) => c.trim().replace(/"/g, ''));
  if (cols.length < headers.length) return null;

  const get = (name: string): string => {
    const idx = headers.indexOf(name);
    return idx >= 0 ? cols[idx] : '';
  };

  const carrier = get('UNIQUE_CARRIER') || get('CARRIER');
  const origin = get('ORIGIN');
  const dest = get('DEST');
  const year = parseInt(get('YEAR'));
  const month = parseInt(get('MONTH'));
  const pax = parseInt(get('PASSENGERS') || '0');
  const seats = parseInt(get('SEATS') || '0');
  const deps = parseInt(get('DEPARTURES_PERFORMED') || get('DEPARTURES') || '0');

  if (!origin || !dest || origin.length !== 3 || dest.length !== 3) return null;
  if (!year || year < 2010) return null;

  const loadFactor = seats > 0 ? pax / seats : 0;

  return { carrier, origin, destination: dest, year, month, passengers: pax, seats, loadFactor, departures: deps };
}

export async function ingestBTST2(csvContent: string): Promise<{ inserted: number; skipped: number }> {
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
  let inserted = 0;
  let skipped = 0;

  // Aggregate by route + year + quarter
  const routeAgg = new Map<string, { pax: number; seats: number; deps: number; carriers: Set<string> }>();

  for (let i = 1; i < lines.length; i++) {
    const row = parseRow(lines[i], headers);
    if (!row) { skipped++; continue; }

    const quarter = Math.ceil(row.month / 3);
    const key = `${row.origin}-${row.destination}-${row.year}-${quarter}`;

    const existing = routeAgg.get(key) ?? { pax: 0, seats: 0, deps: 0, carriers: new Set() };
    existing.pax += row.passengers;
    existing.seats += row.seats;
    existing.deps += row.departures;
    if (row.carrier) existing.carriers.add(row.carrier);
    routeAgg.set(key, existing);
  }

  // Insert into real_features as contextual data
  const batch: Array<Record<string, unknown>> = [];
  for (const [key, data] of routeAgg) {
    const [origin, dest, yearStr, qStr] = key.split('-');
    const loadFactor = data.seats > 0 ? data.pax / data.seats : 0;

    batch.push({
      route_key: `${origin}-${dest}`,
      feature_date: `${yearStr}-${String((parseInt(qStr) - 1) * 3 + 2).padStart(2, '0')}-15`,
      features: JSON.stringify({
        quarterly_passengers: data.pax,
        quarterly_seats: data.seats,
        quarterly_departures: data.deps,
        load_factor: Math.round(loadFactor * 1000) / 1000,
        carrier_count: data.carriers.size,
        carriers: Array.from(data.carriers),
        year: parseInt(yearStr),
        quarter: parseInt(qStr),
        source: SOURCE,
      }),
    });

    if (batch.length >= 500) {
      const { error } = await supabase.from('real_features').insert(batch);
      if (!error) inserted += batch.length;
      else skipped += batch.length;
      batch.length = 0;
    }
  }

  if (batch.length > 0) {
    const { error } = await supabase.from('real_features').insert(batch);
    if (!error) inserted += batch.length;
    else skipped += batch.length;
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
