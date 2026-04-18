/**
 * Scraper Core — orchestrates price scraping across all routes + APIs.
 *
 * Usage:
 *   - Called by POST /api/scraper/run (cron or manual)
 *   - Iterates through ROUTES, queries best available API, normalizes, stores in Supabase
 *   - Targets 20-30 routes per run (budget: ~100 requests per 4h cron cycle)
 *   - Rotates through all 100 routes across ~12 cron cycles per day
 */

import { ROUTES, type ScraperRoute } from './routes';
import { selectApi, apiRequest, recordSuccess, recordFailure, getQuotaStatus, type NormalizedFlight, type ApiConfig } from './api-rotator';

export interface ScrapeResult {
  route: ScraperRoute;
  flights: NormalizedFlight[];
  cheapest: number | null;
  source: string;
  durationMs: number;
  error?: string;
}

export interface ScrapeRunSummary {
  startedAt: string;
  completedAt: string;
  routesAttempted: number;
  routesSucceeded: number;
  routesFailed: number;
  totalFlights: number;
  cheapestOverall: number | null;
  quotaStatus: ReturnType<typeof getQuotaStatus>;
  results: ScrapeResult[];
}

/**
 * Determine which routes to scrape this cycle.
 * Rotates through all 100 routes using a deterministic offset based on current hour.
 */
function selectRoutesForCycle(batchSize: number = 25): ScraperRoute[] {
  const hour = new Date().getHours();
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const offset = ((dayOfYear * 6) + Math.floor(hour / 4)) * batchSize;
  const start = offset % ROUTES.length;

  const selected: ScraperRoute[] = [];
  for (let i = 0; i < batchSize && i < ROUTES.length; i++) {
    selected.push(ROUTES[(start + i) % ROUTES.length]);
  }
  return selected;
}

/**
 * Build search parameters for a route — departs 30 and 60 days from now.
 */
function buildSearchDates(): string[] {
  const dates: string[] = [];
  for (const offset of [30, 60, 90]) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

/**
 * Normalize Sky Scrapper response to NormalizedFlight[].
 */
function normalizeSkyScrapperResponse(
  data: unknown,
  route: ScraperRoute,
  departDate: string
): NormalizedFlight[] {
  try {
    const d = data as Record<string, unknown>;
    const itineraries = (d as any)?.data?.itineraries ?? [];
    return itineraries.slice(0, 10).map((it: any) => ({
      origin: route.origin,
      destination: route.destination,
      departDate,
      priceUsd: parseFloat(it?.price?.raw ?? '0'),
      airline: it?.legs?.[0]?.carriers?.marketing?.[0]?.name ?? 'Unknown',
      stops: it?.legs?.[0]?.stopCount ?? 0,
      durationMinutes: it?.legs?.[0]?.durationInMinutes ?? 0,
      source: 'sky-scrapper',
      fetchedAt: new Date().toISOString(),
    })).filter((f: NormalizedFlight) => f.priceUsd > 0);
  } catch (_) {
    return [];
  }
}

/**
 * Generic normalizer for other APIs (best-effort).
 */
function normalizeGenericResponse(
  data: unknown,
  route: ScraperRoute,
  departDate: string,
  source: string
): NormalizedFlight[] {
  try {
    const d = data as any;
    // Try common response shapes
    const results = d?.data ?? d?.results ?? d?.flights ?? d?.offers ?? [];
    if (!Array.isArray(results)) return [];

    return results.slice(0, 10).map((r: any) => ({
      origin: route.origin,
      destination: route.destination,
      departDate,
      priceUsd: parseFloat(r?.price?.amount ?? r?.price ?? r?.priceUsd ?? r?.fare ?? '0'),
      airline: r?.airline ?? r?.carrier ?? r?.airlineName ?? 'Unknown',
      stops: r?.stops ?? r?.stopCount ?? r?.numberOfStops ?? 0,
      durationMinutes: r?.duration ?? r?.durationMinutes ?? 0,
      source,
      fetchedAt: new Date().toISOString(),
    })).filter((f: NormalizedFlight) => f.priceUsd > 0);
  } catch (_) {
    return [];
  }
}

/**
 * Scrape a single route on a single date using the best available API.
 */
async function scrapeRoute(
  route: ScraperRoute,
  departDate: string
): Promise<ScrapeResult> {
  const t0 = Date.now();
  const api = selectApi();

  if (!api) {
    return {
      route,
      flights: [],
      cheapest: null,
      source: 'none',
      durationMs: Date.now() - t0,
      error: 'all_apis_exhausted',
    };
  }

  try {
    const params: Record<string, string> = {
      originSkyId: route.origin,
      destinationSkyId: route.destination,
      originEntityId: route.origin,
      destinationEntityId: route.destination,
      date: departDate,
      adults: '1',
      cabinClass: 'economy',
      currency: 'USD',
    };

    const data = await apiRequest(api, api.searchEndpoint, params);

    const flights = api.id === 'sky-scrapper'
      ? normalizeSkyScrapperResponse(data, route, departDate)
      : normalizeGenericResponse(data, route, departDate, api.id);

    const cheapest = flights.length > 0
      ? Math.min(...flights.map((f) => f.priceUsd))
      : null;

    return {
      route,
      flights,
      cheapest,
      source: api.id,
      durationMs: Date.now() - t0,
    };
  } catch (err: unknown) {
    return {
      route,
      flights: [],
      cheapest: null,
      source: api.id,
      durationMs: Date.now() - t0,
      error: (err as Error)?.message ?? 'unknown_error',
    };
  }
}

/**
 * Main scrape function — runs a full cycle.
 */
export async function runScrape(
  batchSize: number = 25,
  delayBetweenMs: number = 2000
): Promise<ScrapeRunSummary> {
  const startedAt = new Date().toISOString();
  const routes = selectRoutesForCycle(batchSize);
  const dates = buildSearchDates();
  const results: ScrapeResult[] = [];

  for (const route of routes) {
    // Pick one date per route to conserve quota
    const date = dates[Math.floor(Math.random() * dates.length)];
    const result = await scrapeRoute(route, date);
    results.push(result);

    // Rate limiting
    if (delayBetweenMs > 0) {
      await new Promise((r) => setTimeout(r, delayBetweenMs));
    }
  }

  const succeeded = results.filter((r) => !r.error);
  const allCheapest = results
    .map((r) => r.cheapest)
    .filter((p): p is number => p !== null);

  return {
    startedAt,
    completedAt: new Date().toISOString(),
    routesAttempted: routes.length,
    routesSucceeded: succeeded.length,
    routesFailed: results.length - succeeded.length,
    totalFlights: results.reduce((a, r) => a + r.flights.length, 0),
    cheapestOverall: allCheapest.length > 0 ? Math.min(...allCheapest) : null,
    quotaStatus: getQuotaStatus(),
    results,
  };
}
