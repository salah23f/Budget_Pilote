'use client';

import { useState, useMemo } from 'react';
import { PriceChart, type PriceDataPoint } from '@/components/ui/price-chart';
import { Badge } from '@/components/ui/badge';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface PriceHistoryProps {
  /** Current price for the route */
  currentPrice: number;
  /** Route label, e.g. "CDG → JFK" */
  route: string;
  /** Optional accent color */
  color?: string;
}

/* ------------------------------------------------------------------ */
/*  Seeded random — deterministic per route                             */
/* ------------------------------------------------------------------ */

function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return function () {
    h |= 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 13), 0x45d9f3b);
    h ^= h >>> 16;
    return ((h >>> 0) % 10000) / 10000;
  };
}

/* ------------------------------------------------------------------ */
/*  Generate 30-day price history                                       */
/* ------------------------------------------------------------------ */

function generateHistory(currentPrice: number, route: string, days: number): PriceDataPoint[] {
  const rng = seededRandom(route);
  const points: PriceDataPoint[] = [];
  const today = new Date();
  const variance = currentPrice * 0.15; // ±15% price fluctuation

  // Work backwards from today
  let price = currentPrice;
  const raw: number[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Random walk with mean-reversion to current price
    const drift = (currentPrice - price) * 0.08;
    const noise = (rng() - 0.5) * variance * 0.3;
    price = Math.max(currentPrice * 0.6, Math.min(currentPrice * 1.4, price + drift + noise));
    raw.push(price);
  }

  // Make sure last point is the current price
  raw[raw.length - 1] = currentPrice;

  for (let i = 0; i < raw.length; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - (raw.length - 1 - i));
    points.push({
      date: date.toISOString().split('T')[0],
      price: Math.round(raw[i]),
    });
  }

  return points;
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export function PriceHistory({ currentPrice, route, color = '#F59E0B' }: PriceHistoryProps) {
  const [period, setPeriod] = useState<7 | 14 | 30>(30);

  const allData = useMemo(() => generateHistory(currentPrice, route, 30), [currentPrice, route]);
  const data = useMemo(() => allData.slice(-period), [allData, period]);

  const stats = useMemo(() => {
    if (data.length === 0) return null;
    const prices = data.map((d) => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    const trend = data[data.length - 1].price - data[0].price;
    const trendPct = data[0].price > 0 ? Math.round((trend / data[0].price) * 100) : 0;
    return { min, max, avg, trend, trendPct };
  }, [data]);

  if (!stats) return null;

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 13l4-4 3 3 5-6" />
              <path d="M10 6h4v4" />
            </svg>
            Price Trend (Estimated)
          </h3>
          <p className="text-[11px] text-white/35 mt-0.5">{route}</p>
        </div>

        {/* Period selector */}
        <div className="flex gap-1">
          {([7, 14, 30] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition ${
                period === p
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-white/30 hover:text-white/50'
              }`}
            >
              {p}D
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <PriceChart data={data} width={440} height={160} color={color} className="w-full" />

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        <div className="text-center">
          <p className="text-[10px] text-white/30 mb-0.5">Current</p>
          <p className="text-sm font-bold text-white">${currentPrice}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-white/30 mb-0.5">Average</p>
          <p className="text-sm font-semibold text-white/70">${stats.avg}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-white/30 mb-0.5">Low</p>
          <p className="text-sm font-semibold text-emerald-400">${stats.min}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-white/30 mb-0.5">High</p>
          <p className="text-sm font-semibold text-red-400">${stats.max}</p>
        </div>
      </div>

      {/* Trend indicator */}
      <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-[11px] text-white/40">
          {period}-day trend
        </span>
        <Badge
          variant={stats.trend <= 0 ? 'success' : 'danger'}
          size="sm"
        >
          {stats.trend <= 0 ? '↓' : '↑'} {Math.abs(stats.trendPct)}%
          {stats.trend <= 0 ? ' — Good time to buy' : ' — Prices rising'}
        </Badge>
      </div>

      <p className="text-[9px] text-white/15 text-center">
        Estimated trend based on historical patterns · Actual prices may vary
      </p>
    </div>
  );
}
