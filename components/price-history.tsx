'use client';

import { useState, useEffect, useMemo } from 'react';
import { PriceChart, type PriceDataPoint } from '@/components/ui/price-chart';
import { Badge } from '@/components/ui/badge';

interface PriceHistoryProps {
  currentPrice: number;
  route: string;
  origin?: string;
  destination?: string;
  color?: string;
}

export function PriceHistory({ currentPrice, route, origin, destination, color = '#D4A24C' }: PriceHistoryProps) {
  const [period, setPeriod] = useState<7 | 14 | 30>(30);
  const [realData, setRealData] = useState<PriceDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [isReal, setIsReal] = useState(false);

  // Try to fetch real price history from the agent store
  useEffect(() => {
    if (!origin || !destination) return;
    setLoading(true);

    fetch(`/api/price-history?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.length > 0) {
          setRealData(data.data.map((d: any) => ({ date: d.date, price: d.price })));
          setIsReal(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [origin, destination]);

  const data = useMemo(() => {
    if (realData.length > 0) {
      return realData.slice(-period);
    }
    // No real data — show current price as the only data point
    const today = new Date().toISOString().split('T')[0];
    return [{ date: today, price: currentPrice }];
  }, [realData, period, currentPrice]);

  const stats = useMemo(() => {
    if (data.length === 0) return null;
    const prices = data.map((d) => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    const trend = data.length > 1 ? data[data.length - 1].price - data[0].price : 0;
    const trendPct = data.length > 1 && data[0].price > 0 ? Math.round((trend / data[0].price) * 100) : 0;
    return { min, max, avg, trend, trendPct };
  }, [data]);

  if (loading) {
    return (
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2 text-sm text-white/40">
          <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          Loading price history...
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 13l4-4 3 3 5-6" /><path d="M10 6h4v4" />
            </svg>
            Price History
          </h3>
          <p className="text-[11px] text-white/35 mt-0.5">{route}</p>
        </div>

        {realData.length > 1 && (
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
        )}
      </div>

      {/* Chart — only show if we have 2+ data points */}
      {data.length > 1 && (
        <PriceChart data={data} width={440} height={160} color={color} className="w-full" />
      )}

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

      {/* Trend */}
      {data.length > 1 && stats.trend !== 0 && (
        <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-[11px] text-white/40">{period}-day trend</span>
          <Badge variant={stats.trend <= 0 ? 'success' : 'danger'} size="sm">
            {stats.trend <= 0 ? '↓' : '↑'} {Math.abs(stats.trendPct)}%
          </Badge>
        </div>
      )}

      <p className="text-[9px] text-white/15 text-center">
        {isReal ? `Based on ${realData.length} real price checks` : 'Price history builds as the agent monitors this route'}
      </p>
    </div>
  );
}
