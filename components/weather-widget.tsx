'use client';

import { useMemo } from 'react';

/* ------------------------------------------------------------------ */
/*  Weather data (seeded by destination + date)                         */
/* ------------------------------------------------------------------ */

interface WeatherDay {
  date: string;
  tempHigh: number;
  tempLow: number;
  condition: 'sunny' | 'partly-cloudy' | 'cloudy' | 'rainy' | 'stormy' | 'snowy';
  humidity: number;
  wind: number;
}

const CONDITIONS = {
  sunny: { icon: '☀️', label: 'Sunny', color: '#F59E0B' },
  'partly-cloudy': { icon: '⛅', label: 'Partly Cloudy', color: '#94A3B8' },
  cloudy: { icon: '☁️', label: 'Cloudy', color: '#64748B' },
  rainy: { icon: '🌧️', label: 'Rainy', color: '#3B82F6' },
  stormy: { icon: '⛈️', label: 'Stormy', color: '#6366F1' },
  snowy: { icon: '🌨️', label: 'Snow', color: '#E2E8F0' },
};

// City climate profiles (average temps & weather patterns)
const CLIMATES: Record<string, { baseTemp: number; variation: number; rainChance: number; snowChance: number }> = {
  paris: { baseTemp: 15, variation: 12, rainChance: 0.3, snowChance: 0.05 },
  london: { baseTemp: 13, variation: 8, rainChance: 0.4, snowChance: 0.03 },
  rome: { baseTemp: 18, variation: 10, rainChance: 0.2, snowChance: 0.01 },
  barcelona: { baseTemp: 19, variation: 8, rainChance: 0.15, snowChance: 0 },
  'new york': { baseTemp: 14, variation: 15, rainChance: 0.25, snowChance: 0.1 },
  tokyo: { baseTemp: 16, variation: 12, rainChance: 0.3, snowChance: 0.05 },
  dubai: { baseTemp: 33, variation: 8, rainChance: 0.02, snowChance: 0 },
  bangkok: { baseTemp: 30, variation: 4, rainChance: 0.35, snowChance: 0 },
  bali: { baseTemp: 28, variation: 3, rainChance: 0.4, snowChance: 0 },
  sydney: { baseTemp: 20, variation: 8, rainChance: 0.2, snowChance: 0 },
  istanbul: { baseTemp: 15, variation: 12, rainChance: 0.25, snowChance: 0.05 },
  lisbon: { baseTemp: 18, variation: 7, rainChance: 0.2, snowChance: 0 },
  amsterdam: { baseTemp: 12, variation: 8, rainChance: 0.4, snowChance: 0.05 },
  berlin: { baseTemp: 11, variation: 12, rainChance: 0.3, snowChance: 0.1 },
  madrid: { baseTemp: 17, variation: 12, rainChance: 0.15, snowChance: 0.02 },
  default: { baseTemp: 20, variation: 8, rainChance: 0.2, snowChance: 0.02 },
};

function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  return function () { h |= 0; h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); h ^= h >>> 16; return ((h >>> 0) % 10000) / 10000; };
}

function generateWeather(destination: string, startDate: string, days: number): WeatherDay[] {
  const city = destination.toLowerCase().trim();
  const climate = CLIMATES[city] || CLIMATES.default;
  const rng = seededRandom(city + startDate);
  const result: WeatherDay[] = [];
  const start = new Date(startDate);

  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const month = d.getMonth();
    // Seasonal adjustment (northern hemisphere)
    const seasonFactor = Math.cos(((month - 6) / 6) * Math.PI);
    const baseTemp = climate.baseTemp + seasonFactor * climate.variation * 0.5;

    const tempHigh = Math.round(baseTemp + rng() * 6 - 1);
    const tempLow = Math.round(tempHigh - 4 - rng() * 6);
    const humidity = Math.round(40 + rng() * 40);
    const wind = Math.round(5 + rng() * 20);

    const r = rng();
    let condition: WeatherDay['condition'];
    if (tempHigh < 2 && climate.snowChance > 0 && r < 0.4) condition = 'snowy';
    else if (r < climate.rainChance * 0.3) condition = 'stormy';
    else if (r < climate.rainChance) condition = 'rainy';
    else if (r < climate.rainChance + 0.25) condition = 'cloudy';
    else if (r < climate.rainChance + 0.45) condition = 'partly-cloudy';
    else condition = 'sunny';

    result.push({
      date: d.toISOString().split('T')[0],
      tempHigh,
      tempLow,
      condition,
      humidity,
      wind,
    });
  }
  return result;
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

interface WeatherWidgetProps {
  destination: string;
  startDate: string;
  days?: number;
  className?: string;
}

export function WeatherWidget({ destination, startDate, days = 7, className = '' }: WeatherWidgetProps) {
  const weather = useMemo(
    () => generateWeather(destination, startDate, Math.min(days, 14)),
    [destination, startDate, days]
  );

  if (!destination || !startDate) return null;

  const avg = Math.round(weather.reduce((s, d) => s + d.tempHigh, 0) / weather.length);

  return (
    <div className={`glass rounded-2xl p-5 space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span className="text-base">🌤️</span>
            Weather Forecast
          </h3>
          <p className="text-[11px] text-white/35 mt-0.5">{destination} · avg {avg}°C</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">{weather[0]?.tempHigh}°</p>
          <p className="text-[10px] text-white/30">{CONDITIONS[weather[0]?.condition]?.label}</p>
        </div>
      </div>

      {/* Daily forecast */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {weather.map((day, i) => {
          const info = CONDITIONS[day.condition];
          const d = new Date(day.date);
          return (
            <div
              key={day.date}
              className={`flex-shrink-0 flex flex-col items-center gap-1 rounded-xl p-2.5 min-w-[52px] transition ${
                i === 0 ? 'bg-amber-500/10 border border-amber-500/20' : 'hover:bg-white/3'
              }`}
            >
              <span className="text-[10px] text-white/40 font-medium">
                {i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' })}
              </span>
              <span className="text-lg">{info.icon}</span>
              <span className="text-xs font-bold text-white">{day.tempHigh}°</span>
              <span className="text-[10px] text-white/30">{day.tempLow}°</span>
            </div>
          );
        })}
      </div>

      {/* Details for today */}
      <div className="flex gap-4 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-1.5 text-xs text-white/40">
          <span>💧</span> {weather[0]?.humidity}%
        </div>
        <div className="flex items-center gap-1.5 text-xs text-white/40">
          <span>💨</span> {weather[0]?.wind} km/h
        </div>
        <div className="flex items-center gap-1.5 text-xs text-white/40">
          <span>🌡️</span> {weather[0]?.tempLow}°–{weather[0]?.tempHigh}°C
        </div>
      </div>

      <p className="text-[9px] text-white/15 text-center">
        Estimates based on seasonal averages · Not a live forecast
      </p>
    </div>
  );
}
