/**
 * Price history — append-only time-series store for every flight price
 * observation the agent has ever recorded.
 *
 * Schema: one JSON file on disk (`.data/price-history.json`), keyed by
 * a canonical route string ("CDG|JFK|economy|1"). Each key holds an
 * array of PriceSample objects.
 *
 * Design goals:
 *   - Append-only (never overwrite historical observations)
 *   - Cheap reads (in-memory after first load)
 *   - Survives dev hot-reloads + process restarts
 *   - Bounded size (prune samples older than 180 days to keep file small)
 *   - Zero external dependencies (swap for Postgres later without
 *     changing the interface)
 *
 * This store is what turns Flyeas from "a cron that searches" into
 * "an agent with statistical memory". Every sample is a data point that
 * compounds into a better baseline over time — the moat.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

export interface PriceSample {
  /** ISO timestamp when the observation was recorded */
  checkedAt: string;
  /** Target departure date of the flight that was priced */
  departDate: string;
  /** Optional return date for round-trip observations */
  returnDate?: string;
  /** Days between checkedAt and departDate — used for time-to-departure analysis */
  daysUntilDeparture: number;
  /** Lowest price seen in this scan for this route */
  priceUsd: number;
  /** Second-lowest and median for volatility analysis */
  secondPrice?: number;
  medianPrice?: number;
  /** How many offers were returned in the search */
  offerCount: number;
  /** Airline of the cheapest offer (for breakdown analytics) */
  airline?: string;
  /** Provider that returned the offer (kiwi, sky-scrapper, etc.) */
  source?: string;
}

export interface RouteKeyParts {
  origin: string;
  destination: string;
  cabinClass?: string;
  adults?: number;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'price-history.json');
const MAX_AGE_DAYS = 180;
const MAX_SAMPLES_PER_ROUTE = 2000;

interface Store {
  routes: Record<string, PriceSample[]>;
}

const g = globalThis as unknown as { __flyeasPriceHistory?: Store };
if (!g.__flyeasPriceHistory) {
  g.__flyeasPriceHistory = { routes: {} };
}
const store = g.__flyeasPriceHistory;

let loaded = false;
let saveTimer: NodeJS.Timeout | null = null;

async function ensureLoaded() {
  if (loaded) return;
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Store;
    if (parsed && typeof parsed === 'object' && parsed.routes) {
      Object.assign(store.routes, parsed.routes);
    }
  } catch (err: any) {
    if (err?.code !== 'ENOENT') {
      console.warn('[price-history] load failed:', err?.message);
    }
  }
  loaded = true;
}

async function persist() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(
      DATA_FILE,
      JSON.stringify({ routes: store.routes }, null, 2)
    );
  } catch (err: any) {
    console.warn('[price-history] persist failed:', err?.message);
  }
}

function schedulePersist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persist();
  }, 500);
}

// ------------------------------------------------------------------
// Public helpers
// ------------------------------------------------------------------

export function routeKey(parts: RouteKeyParts): string {
  return [
    parts.origin.toUpperCase(),
    parts.destination.toUpperCase(),
    (parts.cabinClass || 'economy').toLowerCase(),
    String(parts.adults || 1),
  ].join('|');
}

export async function recordSample(
  parts: RouteKeyParts,
  sample: PriceSample
): Promise<void> {
  await ensureLoaded();
  const key = routeKey(parts);
  if (!store.routes[key]) store.routes[key] = [];
  store.routes[key].push(sample);

  // Prune aggressively — we never need samples older than MAX_AGE_DAYS.
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  store.routes[key] = store.routes[key]
    .filter((s) => new Date(s.checkedAt).getTime() > cutoff)
    .slice(-MAX_SAMPLES_PER_ROUTE);

  schedulePersist();
}

export async function getSamples(
  parts: RouteKeyParts,
  opts?: { sinceDays?: number }
): Promise<PriceSample[]> {
  await ensureLoaded();
  const key = routeKey(parts);
  const all = store.routes[key] || [];
  if (!opts?.sinceDays) return all;
  const cutoff = Date.now() - opts.sinceDays * 24 * 60 * 60 * 1000;
  return all.filter((s) => new Date(s.checkedAt).getTime() > cutoff);
}

/**
 * Get samples matching a specific departure window. Useful for
 * building baselines relevant to the mission — comparing today's
 * price for a flight 45 days out against OTHER prices recorded when
 * the flight was ~45 days out, not against a flight that was 3 days
 * out (which is always much more expensive).
 */
export async function getSamplesForWindow(
  parts: RouteKeyParts,
  daysUntilDeparture: number,
  tolerance = 14
): Promise<PriceSample[]> {
  const samples = await getSamples(parts, { sinceDays: MAX_AGE_DAYS });
  return samples.filter(
    (s) =>
      Math.abs(s.daysUntilDeparture - daysUntilDeparture) <= tolerance
  );
}

/**
 * Estimate how "well-covered" a route is. Returns 0-1 confidence based
 * on sample count. Used by the predictor to attenuate recommendations
 * when the baseline is undertrained.
 */
export async function getCoverageScore(
  parts: RouteKeyParts
): Promise<{ samples: number; confidence: number }> {
  const all = await getSamples(parts, { sinceDays: 90 });
  const n = all.length;
  // Confidence scales logarithmically — 10 samples gives 0.5, 50 gives
  // 0.85, 100+ gives 0.95
  const confidence = Math.min(0.95, Math.log10(n + 1) / Math.log10(100));
  return { samples: n, confidence };
}

export async function listTrackedRoutes(): Promise<
  Array<{ key: string; sampleCount: number; lastCheckedAt?: string }>
> {
  await ensureLoaded();
  return Object.entries(store.routes).map(([key, samples]) => ({
    key,
    sampleCount: samples.length,
    lastCheckedAt: samples[samples.length - 1]?.checkedAt,
  }));
}
