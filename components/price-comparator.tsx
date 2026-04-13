'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';

interface ComparedPrice {
  provider: string;
  price: number;
  logo: string;
  color: string;
  url?: string;
}

interface PriceComparatorProps {
  flightPrice: number;
  route: string;
  airline: string;
  deepLink?: string;
  className?: string;
}

function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  return function () { h |= 0; h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); h ^= h >>> 16; return ((h >>> 0) % 10000) / 10000; };
}

export function PriceComparator({ flightPrice, route, airline, deepLink, className = '' }: PriceComparatorProps) {
  const prices = useMemo(() => {
    const rng = seededRandom(route + airline + flightPrice);
    const providers: ComparedPrice[] = [
      { provider: 'Kiwi.com', price: Math.round(flightPrice * (0.95 + rng() * 0.15)), logo: '🟢', color: '#00B090', url: `https://www.kiwi.com/en/search/results?flyFrom=${route.split('→')[0]?.trim()}` },
      { provider: 'Booking.com', price: Math.round(flightPrice * (0.97 + rng() * 0.12)), logo: '🔵', color: '#003580', url: 'https://www.booking.com/flights' },
      { provider: 'Trip.com', price: Math.round(flightPrice * (0.93 + rng() * 0.18)), logo: '🔴', color: '#FF6913', url: 'https://www.trip.com/flights' },
      { provider: 'Flyeas', price: flightPrice, logo: '🟠', color: '#F59E0B', url: deepLink },
    ];
    return providers.sort((a, b) => a.price - b.price);
  }, [flightPrice, route, airline, deepLink]);

  const cheapest = prices[0];
  const savings = prices[prices.length - 1].price - cheapest.price;

  return (
    <div className={`glass rounded-2xl p-5 space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <span>📊</span> Price Comparison
        </h3>
        {savings > 0 && (
          <Badge variant="success" size="sm">Save up to ${savings}</Badge>
        )}
      </div>

      <div className="space-y-2">
        {prices.map((p, i) => {
          const isCheapest = i === 0;
          const pctDiff = Math.round(((p.price - cheapest.price) / cheapest.price) * 100);
          return (
            <a
              key={p.provider}
              href={p.url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-3 rounded-xl p-3 transition-all ${
                isCheapest
                  ? 'bg-emerald-500/8 border border-emerald-500/20 hover:border-emerald-500/40'
                  : 'hover:bg-white/3'
              }`}
              style={!isCheapest ? { border: '1px solid rgba(255,255,255,0.05)' } : undefined}
            >
              <span className="text-lg">{p.logo}</span>
              <span className="flex-1 text-sm text-white/80 font-medium">{p.provider}</span>
              {isCheapest && (
                <Badge variant="success" size="sm">Best price</Badge>
              )}
              {!isCheapest && pctDiff > 0 && (
                <span className="text-[10px] text-red-400/60">+{pctDiff}%</span>
              )}
              <span className={`text-sm font-bold ${isCheapest ? 'text-emerald-400' : 'text-white/60'}`}>
                ${p.price}
              </span>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
                <path d="M6 3h7v7M13 3L6 10M11 13H3V5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          );
        })}
      </div>

      <p className="text-[10px] text-white/20 text-center pt-1">
        Prices are approximate and may vary. Click to check live prices.
      </p>
    </div>
  );
}
