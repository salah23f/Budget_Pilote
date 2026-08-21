/**
 * Price history — append-only time-series store for every flight price
 * observation the agent has ever recorded.
 *
 * Storage: Postgres (Supabase, table `price_history_samples`) when the
 * service credentials are present, otherwise a JSON file under `.data/`
 * for local development.
 *
 * Why it moved off the filesystem
 * -------------------------------
 * This module used to write only to `.data/price-history.json`. On Vercel
 * that filesystem is ephemeral, and the failed write was swallowed by a
 * console.warn — so the store silently emptied on every lambda recycle.
 * The predictor needs 5 samples to leave its cold-start branch and 30 to
 * report confidence, thresholds it could therefore almost never reach:
 * in production the "prediction engine" collapsed to a single rule, buy
 * if departure is under 14 days away. Persisting properly is what lets
 * the statistical layer actually run.
 *
 * Design goals (unchanged):
 *   - Append-only (never overwrite historical observations)
 *   - Cheap reads (per-route memory cache within an invocation)
 *   - Survives dev hot-reloads, process restarts AND deploys
 *   - Same public interface as the file-backed version
 *
 * This store is what turns Flyeas from "a cron that searches" into
 * "an agent with statistical memory". Every sample is a data point that
 * compounds into a better baseline over time — the moat.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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

/**
 * Read horizon. Older observations stay in Postgres — pruning them is a
 * retention job's business, not the read path's. On the JSON backend this
 * doubles as the prune cutoff, because there the file size is the limit.
 */
const MAX_AGE_DAYS = 180;

/**
 * Only the JSON backend caps rows per route: it exists to keep a file
 * small. Postgres has no such need, and the cap was quietly discarding
 * the long history the baselines are built from.
 */
const MAX_SAMPLES_PER_ROUTE_JSON = 2000;

// ------------------------------------------------------------------
// Backend contract
// ------------------------------------------------------------------

interface Backend {
  readonly kind: 'supabase' | 'json';
  append(key: string, sample: PriceSample): Promise<void>;
  read(key: string, sinceDays?: number): Promise<PriceSample[]>;
  listRoutes(): Promise<
    Array<{ key: string; sampleCount: number; lastCheckedAt?: string }>
  >;
}

function sinceIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// ------------------------------------------------------------------
// Postgres backend
// ------------------------------------------------------------------

interface Row {
  route_key: string;
  checked_at: string;
  depart_date: string;
  return_date: string | null;
  days_until_departure: number;
  price_usd: number | string;
  second_price: number | string | null;
  median_price: number | string | null;
  offer_count: number;
  airline: string | null;
  source: string | null;
}

/** Postgres numerics arrive as strings through PostgREST. */
function num(v: number | string | null | undefined): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function rowToSample(r: Row): PriceSample {
  return {
    checkedAt: r.checked_at,
    departDate: r.depart_date,
    returnDate: r.return_date ?? undefined,
    daysUntilDeparture: r.days_until_departure,
    priceUsd: num(r.price_usd) ?? 0,
    secondPrice: num(r.second_price),
    medianPrice: num(r.median_price),
    offerCount: r.offer_count ?? 0,
    airline: r.airline ?? undefined,
    source: r.source ?? undefined,
  };
}

class SupabaseBackend implements Backend {
  readonly kind = 'supabase' as const;
  private sb: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.sb = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async append(key: string, s: PriceSample): Promise<void> {
    const { error } = await this.sb.from('price_history_samples').insert({
      route_key: key,
      checked_at: s.checkedAt,
      depart_date: s.departDate,
      return_date: s.returnDate ?? null,
      days_until_departure: s.daysUntilDeparture,
      price_usd: s.priceUsd,
      second_price: s.secondPrice ?? null,
      median_price: s.medianPrice ?? null,
      offer_count: s.offerCount ?? 0,
      airline: s.airline ?? null,
      source: s.source ?? null,
    });
    // Loud on failure: a silent warn is exactly how the previous store
    // emptied itself for months without anyone noticing.
    if (error) {
      console.error('[price-history] insert failed', {
        route: key,
        error: error.message,
      });
    }
  }

  async read(key: string, sinceDays?: number): Promise<PriceSample[]> {
    let q = this.sb
      .from('price_history_samples')
      .select(
        'route_key,checked_at,depart_date,return_date,days_until_departure,price_usd,second_price,median_price,offer_count,airline,source'
      )
      .eq('route_key', key)
      .order('checked_at', { ascending: true });

    q = q.gte('checked_at', sinceIso(sinceDays ?? MAX_AGE_DAYS));

    const { data, error } = await q;
    if (error) {
      console.error('[price-history] read failed', {
        route: key,
        error: error.message,
      });
      return [];
    }
    return (data as Row[] | null)?.map(rowToSample) ?? [];
  }

  async listRoutes() {
    const { data, error } = await this.sb
      .from('price_history_samples')
      .select('route_key,checked_at')
      .gte('checked_at', sinceIso(MAX_AGE_DAYS))
      .order('checked_at', { ascending: true });

    if (error) {
      console.error('[price-history] listRoutes failed', error.message);
      return [];
    }
    const acc = new Map<string, { sampleCount: number; lastCheckedAt?: string }>();
    for (const r of (data as Array<{ route_key: string; checked_at: string }> | null) ?? []) {
      const cur = acc.get(r.route_key) ?? { sampleCount: 0 };
      cur.sampleCount += 1;
      cur.lastCheckedAt = r.checked_at; // ascending order — last wins
      acc.set(r.route_key, cur);
    }
    return [...acc.entries()].map(([key, v]) => ({ key, ...v }));
  }
}

// ------------------------------------------------------------------
// JSON backend (local development only)
// ------------------------------------------------------------------

interface Store {
  routes: Record<string, PriceSample[]>;
}

const g = globalThis as unknown as { __flyeasPriceHistory?: Store };
if (!g.__flyeasPriceHistory) {
  g.__flyeasPriceHistory = { routes: {} };
}
const store = g.__flyeasPriceHistory;

class JsonBackend implements Backend {
  readonly kind = 'json' as const;
  private loaded = false;
  private saveTimer: NodeJS.Timeout | null = null;

  private async ensureLoaded() {
    if (this.loaded) return;
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
    this.loaded = true;
  }

  private schedulePersist() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(async () => {
      this.saveTimer = null;
      try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(
          DATA_FILE,
          JSON.stringify({ routes: store.routes }, null, 2)
        );
      } catch (err: any) {
        console.warn('[price-history] persist failed:', err?.message);
      }
    }, 500);
  }

  async append(key: string, sample: PriceSample): Promise<void> {
    await this.ensureLoaded();
    if (!store.routes[key]) store.routes[key] = [];
    store.routes[key].push(sample);

    const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    store.routes[key] = store.routes[key]
      .filter((s) => new Date(s.checkedAt).getTime() > cutoff)
      .slice(-MAX_SAMPLES_PER_ROUTE_JSON);

    this.schedulePersist();
  }

  async read(key: string, sinceDays?: number): Promise<PriceSample[]> {
    await this.ensureLoaded();
    const all = store.routes[key] || [];
    if (!sinceDays) return all;
    const cutoff = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
    return all.filter((s) => new Date(s.checkedAt).getTime() > cutoff);
  }

  async listRoutes() {
    await this.ensureLoaded();
    return Object.entries(store.routes).map(([key, samples]) => ({
      key,
      sampleCount: samples.length,
      lastCheckedAt: samples[samples.length - 1]?.checkedAt,
    }));
  }
}

function pickBackend(): Backend {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    console.log('[price-history] backend=supabase');
    return new SupabaseBackend(url, key);
  }
  console.warn(
    '[price-history] backend=json (dev fallback) — samples will NOT survive a deploy'
  );
  return new JsonBackend();
}

const backend: Backend = pickBackend();

/**
 * Per-invocation read cache. A single sweep asks for the same route
 * several times (predictor, baselines, coverage); without this we would
 * issue three identical queries. Cleared naturally when the lambda dies.
 */
const readCache = new Map<string, { at: number; samples: PriceSample[] }>();
const READ_CACHE_MS = 30_000;

function cacheKey(key: string, sinceDays?: number) {
  return `${key}::${sinceDays ?? MAX_AGE_DAYS}`;
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
  const key = routeKey(parts);
  await backend.append(key, sample);
  // The route just changed; drop its cached reads so the predictor sees
  // the observation it was just handed.
  for (const k of readCache.keys()) {
    if (k.startsWith(`${key}::`)) readCache.delete(k);
  }
}

export async function getSamples(
  parts: RouteKeyParts,
  opts?: { sinceDays?: number }
): Promise<PriceSample[]> {
  const key = routeKey(parts);
  const ck = cacheKey(key, opts?.sinceDays);
  const hit = readCache.get(ck);
  if (hit && Date.now() - hit.at < READ_CACHE_MS) return hit.samples;

  const samples = await backend.read(key, opts?.sinceDays);
  readCache.set(ck, { at: Date.now(), samples });
  return samples;
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
  return backend.listRoutes();
}

/** Which store is live. Exposed for the diagnostic endpoints. */
export function priceHistoryBackend(): 'supabase' | 'json' {
  return backend.kind;
}
