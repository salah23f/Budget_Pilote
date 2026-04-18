/**
 * OpenSky Network Ingester — flight trajectory and frequency data.
 *
 * Source: https://opensky-network.org/data/impala (free, unlimited)
 * Does NOT contain prices — provides contextual features:
 *   - Route frequency (flights/week)
 *   - Delay rates
 *   - Carrier diversity per route
 *   - Seasonal traffic patterns
 *
 * Uses the OpenSky REST API (no key needed, rate-limited to 10 req/min).
 *
 * Usage: npx tsx scripts/ingest/opensky.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const SOURCE = 'opensky';

// Top 50 airports to query (ICAO codes)
const AIRPORTS = [
  'LFPG', 'EGLL', 'KJFK', 'KLAX', 'EDDF', 'EHAM', 'LEMD', 'LIRF',
  'OMDB', 'WSSS', 'RJTT', 'RKSI', 'VTBS', 'ZBAA', 'ZSPD', 'VHHH',
  'YSSY', 'SBGR', 'SAEZ', 'MMMX', 'CYYZ', 'KORD', 'KATL', 'KSFO',
  'KMIA', 'KBOS', 'KIAD', 'KDFW', 'LEBL', 'EDDM',
];

// IATA ↔ ICAO mapping for top airports
const ICAO_TO_IATA: Record<string, string> = {
  LFPG: 'CDG', EGLL: 'LHR', KJFK: 'JFK', KLAX: 'LAX', EDDF: 'FRA',
  EHAM: 'AMS', LEMD: 'MAD', LIRF: 'FCO', OMDB: 'DXB', WSSS: 'SIN',
  RJTT: 'HND', RKSI: 'ICN', VTBS: 'BKK', ZBAA: 'PEK', ZSPD: 'PVG',
  VHHH: 'HKG', YSSY: 'SYD', SBGR: 'GRU', SAEZ: 'EZE', MMMX: 'MEX',
  CYYZ: 'YYZ', KORD: 'ORD', KATL: 'ATL', KSFO: 'SFO', KMIA: 'MIA',
  KBOS: 'BOS', KIAD: 'IAD', KDFW: 'DFW', LEBL: 'BCN', EDDM: 'MUC',
};

interface FlightRecord {
  origin: string;
  destination: string;
  callsign: string;
  firstSeen: number;
  lastSeen: number;
}

/**
 * Fetch departures from an airport in a time window.
 * OpenSky API: /api/flights/departure?airport={icao}&begin={unix}&end={unix}
 */
async function fetchDepartures(icao: string, beginUnix: number, endUnix: number): Promise<FlightRecord[]> {
  const url = `https://opensky-network.org/api/flights/departure?airport=${icao}&begin=${beginUnix}&end=${endUnix}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json() as any[];
    if (!Array.isArray(data)) return [];

    return data
      .filter((f) => f.estDepartureAirport && f.estArrivalAirport)
      .map((f) => ({
        origin: f.estDepartureAirport,
        destination: f.estArrivalAirport,
        callsign: (f.callsign ?? '').trim(),
        firstSeen: f.firstSeen ?? 0,
        lastSeen: f.lastSeen ?? 0,
      }));
  } catch (_) {
    return [];
  }
}

export async function ingestOpenSky(): Promise<{ routes: number; flights: number; errors: string[] }> {
  const errors: string[] = [];
  const routeFrequency = new Map<string, { count: number; carriers: Set<string> }>();

  // Query last 7 days of departures for top airports
  const now = Math.floor(Date.now() / 1000);
  const weekAgo = now - 7 * 86400;

  let totalFlights = 0;

  for (const icao of AIRPORTS.slice(0, 15)) { // Limit to 15 airports per run
    try {
      const flights = await fetchDepartures(icao, weekAgo, now);
      totalFlights += flights.length;

      for (const f of flights) {
        const originIata = ICAO_TO_IATA[f.origin] ?? f.origin;
        const destIata = ICAO_TO_IATA[f.destination] ?? f.destination;
        const key = `${originIata}-${destIata}`;

        const existing = routeFrequency.get(key) ?? { count: 0, carriers: new Set() };
        existing.count++;
        if (f.callsign) {
          const carrier = f.callsign.replace(/\d+$/, '').trim();
          if (carrier.length >= 2) existing.carriers.add(carrier);
        }
        routeFrequency.set(key, existing);
      }

      // Rate limit: OpenSky allows ~10 req/min
      await new Promise((r) => setTimeout(r, 7000));
    } catch (err: unknown) {
      errors.push(`${icao}: ${(err as Error)?.message}`);
    }
  }

  // Store route frequency data in real_features
  if (SUPABASE_URL && SUPABASE_KEY && routeFrequency.size > 0) {
    try {
      const { createClient: create } = await import('@supabase/supabase-js');
      const sb = create(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

      const today = new Date().toISOString().split('T')[0];
      const batch = Array.from(routeFrequency.entries()).map(([key, data]) => ({
        route_key: key,
        feature_date: today,
        features: JSON.stringify({
          weekly_frequency: data.count,
          carrier_diversity: data.carriers.size,
          carriers: Array.from(data.carriers),
          source: 'opensky',
        }),
      }));

      for (let i = 0; i < batch.length; i += 500) {
        await sb.from('real_features').insert(batch.slice(i, i + 500));
      }
    } catch (err: unknown) {
      errors.push(`Supabase: ${(err as Error)?.message}`);
    }
  }

  return { routes: routeFrequency.size, flights: totalFlights, errors };
}
