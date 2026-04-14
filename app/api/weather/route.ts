import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/weather?city=Paris&days=7
 *
 * Returns real weather forecast from OpenWeatherMap.
 * Free tier: 1000 calls/day, 5-day forecast.
 */

const OPENWEATHER_KEY = process.env.OPENWEATHER_API_KEY;
const BASE = 'https://api.openweathermap.org/data/2.5';

// Cache for 30 minutes
type CacheEntry = { data: any; expires: number };
const cache = new Map<string, CacheEntry>();

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get('city');
  if (!city) {
    return NextResponse.json({ error: 'Missing city parameter' }, { status: 400 });
  }

  if (!OPENWEATHER_KEY) {
    return NextResponse.json({ error: 'Weather API not configured' }, { status: 503 });
  }

  // Check cache
  const cacheKey = city.toLowerCase().trim();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expires) {
    return NextResponse.json(cached.data);
  }

  try {
    // Get 5-day / 3-hour forecast (free tier)
    const res = await fetch(
      `${BASE}/forecast?q=${encodeURIComponent(city)}&units=metric&appid=${OPENWEATHER_KEY}`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: errData.message || `Weather API error: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    // Transform into daily forecasts
    const dailyMap = new Map<string, any>();

    for (const item of data.list || []) {
      const date = item.dt_txt?.split(' ')[0];
      if (!date) continue;

      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          date,
          temps: [],
          conditions: [],
          humidity: [],
          wind: [],
          icons: [],
        });
      }

      const day = dailyMap.get(date)!;
      day.temps.push(item.main?.temp || 0);
      day.conditions.push(item.weather?.[0]?.main || 'Clear');
      day.humidity.push(item.main?.humidity || 0);
      day.wind.push(item.wind?.speed || 0);
      day.icons.push(item.weather?.[0]?.icon || '01d');
    }

    const forecast = Array.from(dailyMap.values()).map((day) => ({
      date: day.date,
      tempHigh: Math.round(Math.max(...day.temps)),
      tempLow: Math.round(Math.min(...day.temps)),
      condition: mapCondition(mostFrequent(day.conditions)),
      humidity: Math.round(day.humidity.reduce((s: number, v: number) => s + v, 0) / day.humidity.length),
      wind: Math.round(day.wind.reduce((s: number, v: number) => s + v, 0) / day.wind.length * 3.6), // m/s to km/h
      icon: mostFrequent(day.icons),
    }));

    const result = {
      city: data.city?.name || city,
      country: data.city?.country || '',
      forecast: forecast.slice(0, 7),
    };

    // Cache 30 min
    cache.set(cacheKey, { data: result, expires: Date.now() + 30 * 60 * 1000 });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Weather fetch failed' },
      { status: 500 }
    );
  }
}

function mostFrequent(arr: string[]): string {
  const counts: Record<string, number> = {};
  for (const v of arr) counts[v] = (counts[v] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || arr[0];
}

function mapCondition(owm: string): string {
  switch (owm) {
    case 'Clear': return 'sunny';
    case 'Clouds': return 'cloudy';
    case 'Rain':
    case 'Drizzle': return 'rainy';
    case 'Thunderstorm': return 'stormy';
    case 'Snow': return 'snowy';
    case 'Mist':
    case 'Fog':
    case 'Haze': return 'partly-cloudy';
    default: return 'partly-cloudy';
  }
}
