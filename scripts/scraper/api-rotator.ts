/**
 * API Rotator — intelligent rotation across 6 RapidAPI flight data sources.
 *
 * Priority: Sky Scrapper (paid, best data) → Kiwi → Air Scraper → Google Flights2 → Booking
 * Weather: WeatherAPI (separate, 1M req/month)
 *
 * Features:
 *   - Quota tracking (estimated, resets monthly)
 *   - Circuit breaker (5 consecutive 5xx → skip 1h)
 *   - Response normalization to PriceSample schema
 *   - Automatic fallback cascade
 */

export interface ApiConfig {
  id: string;
  host: string;
  monthlyQuota: number;
  priority: number; // lower = higher priority
  searchEndpoint: string;
  enabled: boolean;
}

export const API_CONFIGS: ApiConfig[] = [
  {
    id: 'sky-scrapper',
    host: 'sky-scrapper.p.rapidapi.com',
    monthlyQuota: 10000,
    priority: 1,
    searchEndpoint: '/api/v2/flights/searchFlightsComplete',
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

interface ApiState {
  requestsThisMonth: number;
  consecutiveErrors: number;
  circuitBreakerUntil: number; // ms timestamp
  lastRequestAt: number;
  lastResetMonth: number; // 0-11
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
  // Monthly reset
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

/**
 * Select the best available API for a request.
 * Returns null if all APIs are exhausted or circuit-broken.
 */
export function selectApi(): ApiConfig | null {
  const now = Date.now();
  const sorted = [...API_CONFIGS]
    .filter((c) => c.enabled)
    .sort((a, b) => a.priority - b.priority);

  for (const config of sorted) {
    const s = getState(config.id);
    // Circuit breaker check
    if (s.circuitBreakerUntil > now) continue;
    // Quota check (leave 10% buffer)
    if (s.requestsThisMonth >= config.monthlyQuota * 0.9) continue;
    return config;
  }
  return null;
}

/**
 * Record a successful request.
 */
export function recordSuccess(apiId: string): void {
  const s = getState(apiId);
  s.requestsThisMonth++;
  s.consecutiveErrors = 0;
  s.lastRequestAt = Date.now();
}

/**
 * Record a failed request. After 5 consecutive failures, trip circuit breaker for 1 hour.
 */
export function recordFailure(apiId: string): void {
  const s = getState(apiId);
  s.requestsThisMonth++;
  s.consecutiveErrors++;
  s.lastRequestAt = Date.now();
  if (s.consecutiveErrors >= 5) {
    s.circuitBreakerUntil = Date.now() + 3600000; // 1 hour
    s.consecutiveErrors = 0;
  }
}

/**
 * Get quota status for all APIs.
 */
export function getQuotaStatus(): Array<{
  id: string;
  used: number;
  quota: number;
  available: boolean;
  circuitBroken: boolean;
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

/**
 * Make a RapidAPI request with the rotator.
 */
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

/**
 * Fetch weather data for a destination.
 */
export async function fetchWeather(
  city: string,
  date: string
): Promise<{ tempC: number; condition: string } | null> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://${WEATHER_CONFIG.host}/forecast.json?q=${encodeURIComponent(city)}&dt=${date}&days=1`;
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': WEATHER_CONFIG.host,
      },
    });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const forecast = (data as any)?.forecast?.forecastday?.[0]?.day;
    if (!forecast) return null;
    return { tempC: forecast.avgtemp_c, condition: forecast.condition?.text ?? 'Unknown' };
  } catch (_) {
    return null;
  }
}
