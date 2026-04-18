/**
 * Scraper Core — orchestrates price scraping across all routes + APIs.
 *
 * BUG FIX: Sky-Scrapper requires skyId/entityId, not raw IATA codes.
 * We lookup each airport via searchAirport API (cached) before searching flights.
 */

import { ROUTES, type ScraperRoute } from './routes';
import {
  selectApi,
  apiRequest,
  getQuotaStatus,
  lookupAirport,
  type NormalizedFlight,
  type ApiConfig,
} from './api-rotator';

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

function buildSearchDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

/**
 * Parse Sky-Scrapper searchFlights response into normalized flights.
 */
function parseSkyScrapperResponse(
  data: unknown,
  route: ScraperRoute,
  departDate: string
): NormalizedFlight[] {
  try {
    const d = data as any;

    // Sky-Scrapper v1 response structure:
    // data.itineraries[] — each has .price.raw, .legs[].carriers, .legs[].stopCount, .legs[].durationInMinutes
    const itineraries = d?.data?.itineraries ?? [];

    if (!Array.isArray(itineraries) || itineraries.length === 0) {
      // Try alternative response shapes
      const alt = d?.data?.flightOffers ?? d?.data?.results ?? d?.flights ?? [];
      if (Array.isArray(alt) && alt.length > 0) {
        return alt.slice(0, 15).map((it: any) => ({
          origin: route.origin,
          destination: route.destination,
          departDate,
          priceUsd: parseFloat(it?.price?.raw ?? it?.price?.amount ?? it?.price ?? '0'),
          airline: it?.legs?.[0]?.carriers?.marketing?.[0]?.name ?? it?.carrier ?? 'Unknown',
          stops: it?.legs?.[0]?.stopCount ?? it?.stops ?? 0,
          durationMinutes: it?.legs?.[0]?.durationInMinutes ?? it?.duration ?? 0,
          source: 'sky-scrapper',
          fetchedAt: new Date().toISOString(),
        })).filter((f: NormalizedFlight) => f.priceUsd > 0);
      }
      return [];
    }

    return itineraries.slice(0, 15).map((it: any) => {
      const leg = it?.legs?.[0];
      const price = parseFloat(it?.price?.raw ?? '0');
      const airline = leg?.carriers?.marketing?.[0]?.name ?? leg?.carriers?.operationType ?? 'Unknown';
      const stops = leg?.stopCount ?? 0;
      const duration = leg?.durationInMinutes ?? 0;

      return {
        origin: route.origin,
        destination: route.destination,
        departDate,
        priceUsd: price,
        airline,
        stops,
        durationMinutes: duration,
        source: 'sky-scrapper',
        fetchedAt: new Date().toISOString(),
      };
    }).filter((f: NormalizedFlight) => f.priceUsd > 0);
  } catch (err: unknown) {
    console.warn(`[scraper] parse error:`, (err as Error)?.message);
    return [];
  }
}

/**
 * Scrape a single route on a single date.
 */
async function scrapeRoute(
  route: ScraperRoute,
  departDate: string
): Promise<ScrapeResult> {
  const t0 = Date.now();
  const routeId = `${route.origin}-${route.destination}`;
  const api = selectApi();

  if (!api) {
    return { route, flights: [], cheapest: null, source: 'none', durationMs: Date.now() - t0, error: 'all_apis_exhausted' };
  }

  try {
    let flights: NormalizedFlight[] = [];

    if (api.id === 'sky-scrapper') {
      // Step 1: Lookup airport IDs (cached)
      const [originIds, destIds] = await Promise.all([
        lookupAirport(route.origin),
        lookupAirport(route.destination),
      ]);

      if (!originIds || !destIds) {
        console.warn(`[scraper ${routeId}] airport lookup failed — origin=${!!originIds} dest=${!!destIds}`);
        return { route, flights: [], cheapest: null, source: api.id, durationMs: Date.now() - t0, error: 'airport_lookup_failed' };
      }

      // Step 2: Compute a return date (7 days after depart — many APIs need round-trip)
      const depDate = new Date(departDate);
      const retDate = new Date(depDate);
      retDate.setDate(retDate.getDate() + 7);
      const returnDate = retDate.toISOString().split('T')[0];

      // Try v1 endpoint first, then v2 as fallback
      const endpoints = [
        '/api/v1/flights/searchFlights',
        '/api/v2/flights/searchFlightsComplete',
      ];

      for (const endpoint of endpoints) {
        const params: Record<string, string> = {
          originSkyId: originIds.skyId,
          destinationSkyId: destIds.skyId,
          originEntityId: originIds.entityId,
          destinationEntityId: destIds.entityId,
          date: departDate,
          returnDate,
          adults: '1',
          cabinClass: 'economy',
          currency: 'USD',
        };

        console.log(`[scraper ${routeId}] trying ${endpoint}: ${originIds.skyId}→${destIds.skyId} on ${departDate}`);

        try {
          const data = await apiRequest(api, endpoint, params);
          const d = data as any;

          // Check if API returned an error (status: false)
          if (d?.status === false || d?.message) {
            console.warn(`[scraper ${routeId}] API error on ${endpoint}: ${(d?.message ?? 'unknown').slice(0, 200)}`);
            continue; // Try next endpoint
          }

          flights = parseSkyScrapperResponse(data, route, departDate);

          if (flights.length > 0) {
            console.log(`[scraper ${routeId}] got ${flights.length} flights via ${endpoint}, cheapest $${Math.min(...flights.map((f) => f.priceUsd))}`);
            break; // Success — stop trying endpoints
          } else {
            console.warn(`[scraper ${routeId}] ${endpoint} returned data but 0 parsed flights. Keys: ${Object.keys(d?.data ?? d ?? {}).join(',')}`);
          }
        } catch (endpointErr: unknown) {
          console.warn(`[scraper ${routeId}] ${endpoint} failed: ${(endpointErr as Error)?.message}`);
        }
      }

      if (flights.length === 0) {
        console.warn(`[scraper ${routeId}] all Sky-Scrapper endpoints returned 0 flights`);
      }
    } else {
      // Generic API call for non-Sky-Scrapper APIs
      const params: Record<string, string> = {
        origin: route.origin,
        destination: route.destination,
        departDate,
        date: departDate,
        adults: '1',
        cabinClass: 'economy',
        currency: 'USD',
      };

      const data = await apiRequest(api, api.searchEndpoint, params);
      const d = data as any;
      const results = d?.data ?? d?.results ?? d?.flights ?? d?.offers ?? [];
      if (Array.isArray(results)) {
        flights = results.slice(0, 10).map((r: any) => ({
          origin: route.origin,
          destination: route.destination,
          departDate,
          priceUsd: parseFloat(r?.price?.amount ?? r?.price ?? r?.priceUsd ?? r?.fare ?? '0'),
          airline: r?.airline ?? r?.carrier ?? r?.airlineName ?? 'Unknown',
          stops: r?.stops ?? r?.stopCount ?? 0,
          durationMinutes: r?.duration ?? r?.durationMinutes ?? 0,
          source: api.id,
          fetchedAt: new Date().toISOString(),
        })).filter((f: NormalizedFlight) => f.priceUsd > 0);
      }
    }

    const cheapest = flights.length > 0 ? Math.min(...flights.map((f) => f.priceUsd)) : null;
    return { route, flights, cheapest, source: api.id, durationMs: Date.now() - t0 };
  } catch (err: unknown) {
    console.warn(`[scraper ${routeId}] error:`, (err as Error)?.message);
    return { route, flights: [], cheapest: null, source: api.id, durationMs: Date.now() - t0, error: (err as Error)?.message ?? 'unknown' };
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
  console.log(`[scraper] starting cycle: ${batchSize} routes, delay=${delayBetweenMs}ms`);

  const routes = selectRoutesForCycle(batchSize);
  // Pick a departure date 45 days out (sweet spot for data)
  const departDate = buildSearchDate(45);
  const results: ScrapeResult[] = [];

  for (const route of routes) {
    const result = await scrapeRoute(route, departDate);
    results.push(result);
    if (delayBetweenMs > 0) {
      await new Promise((r) => setTimeout(r, delayBetweenMs));
    }
  }

  const succeeded = results.filter((r) => !r.error);
  const allCheapest = results.map((r) => r.cheapest).filter((p): p is number => p !== null);

  const summary: ScrapeRunSummary = {
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

  console.log(`[scraper] cycle complete: ${summary.routesSucceeded}/${summary.routesAttempted} routes, ${summary.totalFlights} flights found`);

  return summary;
}
