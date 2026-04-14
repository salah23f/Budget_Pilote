'use client';

import { useState, useEffect } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface WeatherDay {
  date: string;
  tempHigh: number;
  tempLow: number;
  condition: string;
  humidity: number;
  wind: number;
  icon?: string;
}

const CONDITIONS: Record<string, { icon: string; label: string }> = {
  sunny: { icon: '☀️', label: 'Sunny' },
  'partly-cloudy': { icon: '⛅', label: 'Partly Cloudy' },
  cloudy: { icon: '☁️', label: 'Cloudy' },
  rainy: { icon: '🌧️', label: 'Rainy' },
  stormy: { icon: '⛈️', label: 'Stormy' },
  snowy: { icon: '🌨️', label: 'Snow' },
};

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
  const [weather, setWeather] = useState<WeatherDay[]>([]);
  const [cityName, setCityName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isReal, setIsReal] = useState(false);

  useEffect(() => {
    if (!destination) return;

    let cancelled = false;
    setLoading(true);

    // Try real API first
    fetch(`/api/weather?city=${encodeURIComponent(destination)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.forecast && data.forecast.length > 0) {
          setWeather(data.forecast);
          setCityName(data.city || destination);
          setIsReal(true);
        } else {
          // Fallback to estimates
          setWeather(generateFallback(destination, startDate, days));
          setCityName(destination);
          setIsReal(false);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setWeather(generateFallback(destination, startDate, days));
        setCityName(destination);
        setIsReal(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [destination, startDate, days]);

  if (!destination || !startDate) return null;
  if (loading) {
    return (
      <div className={`glass rounded-2xl p-5 ${className}`}>
        <div className="flex items-center gap-2 text-sm text-white/40">
          <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          Loading weather...
        </div>
      </div>
    );
  }
  if (weather.length === 0) return null;

  const avg = Math.round(weather.reduce((s, d) => s + d.tempHigh, 0) / weather.length);

  return (
    <div className={`glass rounded-2xl p-5 space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span className="text-base">🌤️</span>
            Weather {isReal ? 'Forecast' : 'Estimate'}
          </h3>
          <p className="text-[11px] text-white/35 mt-0.5">{cityName} · avg {avg}°C</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">{weather[0]?.tempHigh}°</p>
          <p className="text-[10px] text-white/30">{CONDITIONS[weather[0]?.condition]?.label || weather[0]?.condition}</p>
        </div>
      </div>

      {/* Daily forecast */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {weather.map((day, i) => {
          const info = CONDITIONS[day.condition] || { icon: '⛅', label: day.condition };
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
        {isReal ? 'Live forecast via OpenWeatherMap' : 'Estimates based on seasonal averages'}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Fallback: seasonal estimates if API unavailable                      */
/* ------------------------------------------------------------------ */

function generateFallback(destination: string, startDate: string, days: number): WeatherDay[] {
  const CLIMATES: Record<string, { baseTemp: number; variation: number; rainChance: number }> = {
    paris: { baseTemp: 15, variation: 12, rainChance: 0.3 },
    london: { baseTemp: 13, variation: 8, rainChance: 0.4 },
    rome: { baseTemp: 18, variation: 10, rainChance: 0.2 },
    barcelona: { baseTemp: 19, variation: 8, rainChance: 0.15 },
    'new york': { baseTemp: 14, variation: 15, rainChance: 0.25 },
    tokyo: { baseTemp: 16, variation: 12, rainChance: 0.3 },
    dubai: { baseTemp: 33, variation: 8, rainChance: 0.02 },
    bangkok: { baseTemp: 30, variation: 4, rainChance: 0.35 },
    default: { baseTemp: 20, variation: 8, rainChance: 0.2 },
  };

  const city = destination.toLowerCase().trim();
  const climate = CLIMATES[city] || CLIMATES.default;
  const result: WeatherDay[] = [];
  const start = new Date(startDate);

  let seed = 0;
  for (let i = 0; i < city.length; i++) seed += city.charCodeAt(i);

  for (let i = 0; i < Math.min(days, 7); i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const month = d.getMonth();
    const seasonFactor = Math.cos(((month - 6) / 6) * Math.PI);
    const baseTemp = climate.baseTemp + seasonFactor * climate.variation * 0.5;
    const r = ((seed * (i + 1) * 7) % 100) / 100;

    result.push({
      date: d.toISOString().split('T')[0],
      tempHigh: Math.round(baseTemp + r * 6 - 1),
      tempLow: Math.round(baseTemp - 4 - r * 6),
      condition: r < climate.rainChance ? 'rainy' : r < climate.rainChance + 0.3 ? 'partly-cloudy' : 'sunny',
      humidity: Math.round(40 + r * 40),
      wind: Math.round(5 + r * 20),
    });
  }
  return result;
}
