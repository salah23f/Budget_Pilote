'use client';

import { useMemo } from 'react';

/**
 * Price comparator — shows direct links to real booking sites.
 * No fake prices. Links go to the actual search results page
 * on each provider so users can compare real prices.
 */

interface PriceComparatorProps {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  passengers?: number;
  cabin?: string;
  flightPrice: number;
  airline: string;
  deepLink?: string;
  route: string;
  className?: string;
}

interface Provider {
  name: string;
  color: string;
  buildUrl: (p: PriceComparatorProps) => string;
}

const PROVIDERS: Provider[] = [
  {
    name: 'Kiwi.com',
    color: '#00B090',
    buildUrl: (p) => {
      if (p.deepLink) return p.deepLink;
      const dep = p.departDate?.replace(/-/g, '/') || '';
      return `https://www.kiwi.com/en/search/results/${p.origin}/${p.destination}/${dep}?adults=${p.passengers || 1}`;
    },
  },
  {
    name: 'Google Flights',
    color: '#4285F4',
    buildUrl: (p) => {
      return `https://www.google.com/travel/flights?q=flights+from+${p.origin}+to+${p.destination}+on+${p.departDate}&curr=USD&passengers=${p.passengers || 1}`;
    },
  },
  {
    name: 'Skyscanner',
    color: '#0770E3',
    buildUrl: (p) => {
      const dep = p.departDate?.replace(/-/g, '') || '';
      return `https://www.skyscanner.com/transport/flights/${p.origin.toLowerCase()}/${p.destination.toLowerCase()}/${dep.slice(2)}/?adults=${p.passengers || 1}&adultsv2=${p.passengers || 1}`;
    },
  },
  {
    name: 'Kayak',
    color: '#FF690F',
    buildUrl: (p) => {
      return `https://www.kayak.com/flights/${p.origin}-${p.destination}/${p.departDate}?sort=price_a&fs=cabin=${p.cabin || 'e'}&adults=${p.passengers || 1}`;
    },
  },
];

export function PriceComparator({ className = '', ...props }: PriceComparatorProps) {
  return (
    <div className={`glass rounded-2xl p-5 space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" /><path d="M7 16l4-8 4 4 4-8" />
          </svg>
          Compare Prices
        </h3>
        <span className="text-[10px] text-white/25">Live links to real providers</span>
      </div>

      <p className="text-xs text-white/40">
        Our best price: <span className="text-amber-400 font-bold">${props.flightPrice}</span> via {props.airline}
      </p>

      <div className="space-y-2">
        {PROVIDERS.map((provider) => {
          const url = provider.buildUrl(props);
          return (
            <a
              key={provider.name}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl p-3 transition-all hover:bg-white/3"
              style={{ border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: provider.color }}
              />
              <span className="flex-1 text-sm text-white/70 font-medium">{provider.name}</span>
              <span className="text-xs text-white/30">Compare price</span>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
                <path d="M6 3h7v7M13 3L6 10M11 13H3V5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          );
        })}
      </div>

      <p className="text-[9px] text-white/15 text-center pt-1">
        Links open real search results on each provider
      </p>
    </div>
  );
}
