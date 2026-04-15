'use client';

import React, { useState, useEffect } from 'react';

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

const CONDITIONS: Record<string, { icon: React.ReactNode; label: string }> = {
  sunny: { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E8A317" strokeWidth="1.8"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round"/></svg>, label: 'Sunny' },
  'partly-cloudy': { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M17.66 17.66l1.41 1.41M2 12h2M6.34 17.66l-1.41 1.41M17.07 4.93l1.41-1.41"/><circle cx="12" cy="12" r="4"/><path d="M16 18a4 4 0 00-8 0"/></svg>, label: 'Partly Cloudy' },
  cloudy: { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/></svg>, label: 'Cloudy' },
  rainy: { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 13v8M8 13v8M12 15v8"/><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" stroke="#64748B"/></svg>, label: 'Rainy' },
  stormy: { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 16.9A5 5 0 0018 7h-1.26a8 8 0 10-11.62 9"/><path d="M13 11l-4 6h6l-4 6"/></svg>, label: 'Stormy' },
  snowy: { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" stroke="#94A3B8"/><path d="M8 15h.01M8 19h.01M12 17h.01M12 21h.01M16 15h.01M16 19h.01"/></svg>, label: 'Snow' },
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8A317" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
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
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v6M12 18v4M6 8a6 6 0 0112 0c0 4-6 10-6 10S6 12 6 8z"/></svg>
          {weather[0]?.humidity}%
        </div>
        <div className="flex items-center gap-1.5 text-xs text-white/40">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9.59 4.59A2 2 0 1111 8H2M12.59 19.41A2 2 0 1014 16H2M17.73 7.73A2.5 2.5 0 1119.5 12H2"/></svg>
          {weather[0]?.wind} km/h
        </div>
        <div className="flex items-center gap-1.5 text-xs text-white/40">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 4v10.54a4 4 0 11-4 0V4a2 2 0 014 0z"/></svg>
          {weather[0]?.tempLow}°–{weather[0]?.tempHigh}°C
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
