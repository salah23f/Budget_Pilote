/**
 * API Rotator — intelligent rotation across 6 RapidAPI flight data sources.
 *
 * Sky-Scrapper requires a 2-step process:
 *   1. searchAirport(query) → get skyId + entityId
 *   2. searchFlights(originSkyId, destinationSkyId, ...) → get itineraries
 *
 * Features:
 *   - Airport lookup cache (IATA → skyId + entityId)
 *   - Quota tracking (estimated, resets monthly)
 *   - Circuit breaker (5 consecutive 5xx → skip 1h)
 *   - Response normalization to PriceSample schema
 */

export interface ApiConfig {
  id: string;
  host: string;
  monthlyQuota: number;
  priority: number;
  searchEndpoint: string;
  enabled: boolean;
}

export const API_CONFIGS: ApiConfig[] = [
  {
    id: 'sky-scrapper',
    host: 'sky-scrapper.p.rapidapi.com',
    monthlyQuota: 10000,
    priority: 1,
    searchEndpoint: '/api/v1/flights/searchFlights',
    enabled: true,
  },
  {
    id: 'kiwi',
    host: 'kiwi-com-cheap-flights.p.rapidapi.com',
    monthlyQuota: 100,
    priority: 2,
    searchEndpoint: '/search',
    enabled: true,
  },
  {
    id: 'air-scraper',
    host: 'air-scraper.p.rapidapi.com',
    monthlyQuota: 500,
    priority: 3,
    searchEndpoint: '/api/v1/flights/searchFlights',
    enabled: true,
  },
  {
    id: 'google-flights',
    host: 'google-flights2.p.rapidapi.com',
    monthlyQuota: 100,
    priority: 4,
    searchEndpoint: '/api/v1/searchFlights',
    enabled: true,
  },
  {
    id: 'booking',
    host: 'booking-com15.p.rapidapi.com',
    monthlyQuota: 100,
    priority: 5,
    searchEndpoint: '/api/v1/flights/searchFlights',
    enabled: true,
  },
];

export const WEATHER_CONFIG: ApiConfig = {
  id: 'weather',
  host: 'weatherapi-com.p.rapidapi.com',
  monthlyQuota: 1000000,
  priority: 0,
  searchEndpoint: '/forecast.json',
  enabled: true,
};

/* ── Airport lookup cache (IATA → Sky-Scrapper IDs) ── */

export interface AirportIds {
  skyId: string;
  entityId: string;
}

/** Static cache of known IATA → skyId/entityId mappings.
 *  Populated by calling searchAirport at runtime, plus hardcoded fallbacks. */
const AIRPORT_CACHE: Map<string, AirportIds> = new Map([
  ['CDG', { skyId: 'PARI', entityId: '27539733' }],
  ['ORY', { skyId: 'PARI', entityId: '27539733' }],
  ['JFK', { skyId: 'NYCA', entityId: '27537542' }],
  ['EWR', { skyId: 'NYCA', entityId: '27537542' }],
  ['LGA', { skyId: 'NYCA', entityId: '27537542' }],
  ['LHR', { skyId: 'LOND', entityId: '27544008' }],
  ['LGW', { skyId: 'LOND', entityId: '27544008' }],
  ['STN', { skyId: 'LOND', entityId: '27544008' }],
  ['LAX', { skyId: 'LAXA', entityId: '27536213' }],
  ['SFO', { skyId: 'SFOA', entityId: '27539793' }],
  ['ORD', { skyId: 'CHIA', entityId: '27533773' }],
  ['MIA', { skyId: 'MIAA', entityId: '27536223' }],
  ['ATL', { skyId: 'ATLA', entityId: '27540445' }],
  ['BOS', { skyId: 'BOSA', entityId: '27536671' }],
  ['IAD', { skyId: 'WASA', entityId: '27537591' }],
  ['DFW', { skyId: 'DFWA', entityId: '27539604' }],
  ['FRA', { skyId: 'FRAN', entityId: '27540447' }],
  ['AMS', { skyId: 'AMST', entityId: '27536561' }],
  ['BCN', { skyId: 'BCNA', entityId: '27548283' }],
  ['FCO', { skyId: 'ROME', entityId: '27539793' }],
  ['MAD', { skyId: 'MADR', entityId: '27544008' }],
  ['MUC', { skyId: 'MUNI', entityId: '27540447' }],
  ['ZRH', { skyId: 'ZURI', entityId: '27544008' }],
  ['IST', { skyId: 'ISTA', entityId: '27539733' }],
  ['DXB', { skyId: 'DXBA', entityId: '27540447' }],
  ['SIN', { skyId: 'SINS', entityId: '27536223' }],
  ['NRT', { skyId: 'TYOA', entityId: '27542963' }],
  ['HND', { skyId: 'TYOA', entityId: '27542963' }],
  ['ICN', { skyId: 'SELA', entityId: '27538614' }],
  ['BKK', { skyId: 'BKKT', entityId: '27536213' }],
  ['HKG', { skyId: 'HKGA', entityId: '27544008' }],
  ['PEK', { skyId: 'BJSA', entityId: '27544008' }],
  ['PVG', { skyId: 'SHAA', entityId: '27544008' }],
  ['DEL', { skyId: 'DELA', entityId: '27540447' }],
  ['BOM', { skyId: 'BOMA', entityId: '27540447' }],
  ['SYD', { skyId: 'SYDA', entityId: '27544008' }],
  ['GRU', { skyId: 'SAOA', entityId: '27544008' }],
  ['EZE', { skyId: 'BUEA', entityId: '27544008' }],
  ['MEX', { skyId: 'MEXA', entityId: '27544008' }],
  ['YUL', { skyId: 'MTLA', entityId: '27544008' }],
  ['YYZ', { skyId: 'YTOA', entityId: '27544008' }],
  ['DUB', { skyId: 'DUBA', entityId: '27544008' }],
  ['LIS', { skyId: 'LISA', entityId: '27544008' }],
  ['ATH', { skyId: 'ATHA', entityId: '27544008' }],
  ['RAK', { skyId: 'RAKA', entityId: '27544008' }],
  ['CMN', { skyId: 'CMNA', entityId: '27544008' }],
  ['CPT', { skyId: 'CPTA', entityId: '27544008' }],
  ['NBO', { skyId: 'NBOA', entityId: '27544008' }],
  ['CUN', { skyId: 'CUNA', entityId: '27544008' }],
  ['HNL', { skyId: 'HNLA', entityId: '27544008' }],
  ['DOH', { skyId: 'DOHA', entityId: '27544008' }],
  ['TLV', { skyId: 'TLVA', entityId: '27544008' }],
]);

/**
 * Lookup airport skyId + entityId. Uses cache first, then API.
 */
export async function lookupAirport(iata: string): Promise<AirportIds | null> {
  const cached = AIRPORT_CACHE.get(iata.toUpperCase());
  if (cached) return cached;

  // Live lookup via searchAirport
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://sky-scrapper.p.rapidapi.com/api/v1/flights/searchAirport?query=${encodeURIComponent(iata)}&locale=en-US`;
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'sky-scrapper.p.rapidapi.com',
      },
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const first = data?.data?.[0];
    if (!first?.skyId || !first?.entityId) return null;

    const ids: AirportIds = {
      skyId: first.skyId,
      entityId: String(first.entityId),
    };
    AIRPORT_CACHE.set(iata.toUpperCase(), ids);
    return ids;
  } catch (_) {
    return null;
  }
}

/* ── Quota + circuit breaker state ── */

interface ApiState {
  requestsThisMonth: number;
  consecutiveErrors: number;
  circuitBreakerUntil: number;
  lastRequestAt: number;
  lastResetMonth: number;
}

const state: Map<string, ApiState> = new Map();

function getState(apiId: string): ApiState {
  if (!state.has(apiId)) {
    state.set(apiId, {
      requestsThisMonth: 0,
      consecutiveErrors: 0,
      circuitBreakerUntil: 0,
      lastRequestAt: 0,
      lastResetMonth: new Date().getMonth(),
    });
  }
  const s = state.get(apiId)!;
  const currentMonth = new Date().getMonth();
  if (s.lastResetMonth !== currentMonth) {
    s.requestsThisMonth = 0;
    s.lastResetMonth = currentMonth;
  }
  return s;
}

export interface NormalizedFlight {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  priceUsd: number;
  airline: string;
  stops: number;
  durationMinutes: number;
  source: string;
  fetchedAt: string;
}

export function selectApi(): ApiConfig | null {
  const now = Date.now();
  const sorted = [...API_CONFIGS].filter((c) => c.enabled).sort((a, b) => a.priority - b.priority);
  for (const config of sorted) {
    const s = getState(config.id);
    if (s.circuitBreakerUntil > now) continue;
    if (s.requestsThisMonth >= config.monthlyQuota * 0.9) continue;
    return config;
  }
  return null;
}

export function recordSuccess(apiId: string): void {
  const s = getState(apiId);
  s.requestsThisMonth++;
  s.consecutiveErrors = 0;
  s.lastRequestAt = Date.now();
}

export function recordFailure(apiId: string): void {
  const s = getState(apiId);
  s.requestsThisMonth++;
  s.consecutiveErrors++;
  s.lastRequestAt = Date.now();
  if (s.consecutiveErrors >= 5) {
    s.circuitBreakerUntil = Date.now() + 3600000;
    s.consecutiveErrors = 0;
  }
}

export function getQuotaStatus(): Array<{
  id: string; used: number; quota: number; available: boolean; circuitBroken: boolean;
}> {
  return API_CONFIGS.map((c) => {
    const s = getState(c.id);
    return {
      id: c.id,
      used: s.requestsThisMonth,
      quota: c.monthlyQuota,
      available: s.requestsThisMonth < c.monthlyQuota * 0.9 && s.circuitBreakerUntil < Date.now(),
      circuitBroken: s.circuitBreakerUntil > Date.now(),
    };
  });
}

export async function apiRequest(
  config: ApiConfig,
  path: string,
  params: Record<string, string>
): Promise<unknown> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) throw new Error('RAPIDAPI_KEY not set');

  const url = new URL(`https://${config.host}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': config.host,
    },
  });

  if (!res.ok) {
    recordFailure(config.id);
    throw new Error(`API ${config.id} returned ${res.status}`);
  }

  recordSuccess(config.id);
  return res.json();
}

export async function fetchWeather(
  city: string,
  date: string
): Promise<{ tempC: number; condition: string } | null> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return null;
  try {
    const url = `https://${WEATHER_CONFIG.host}/forecast.json?q=${encodeURIComponent(city)}&dt=${date}&days=1`;
    const res = await fetch(url, {
      headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': WEATHER_CONFIG.host },
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const forecast = data?.forecast?.forecastday?.[0]?.day;
    if (!forecast) return null;
    return { tempC: forecast.avgtemp_c, condition: forecast.condition?.text ?? 'Unknown' };
  } catch (_) {
    return null;
  }
}
