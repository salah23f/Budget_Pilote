'use client';

import { useEffect, useState } from 'react';

/**
 * LiveDeals — horizontal strip of real flight prices for popular routes.
 * Fetches /api/deals on mount; the server caches 30 min so the strip is
 * essentially instant on repeat visits.
 *
 * This is the "instant wow" — investors land on the page and immediately
 * see real prices without typing anything.
 */

interface Deal {
  id: string;
  origin: string;
  destination: string;
  originCity: string;
  destinationCity: string;
  originCountry: string;
  destinationCountry: string;
  emoji: string;
  price: number;
  airline: string;
  airlineCode: string;
  logoUrl?: string;
  durationMinutes: number;
  stops: number;
  departDate: string;
  deepLink?: string;
}

function formatDuration(min: number): string {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export default function LiveDeals() {
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/deals')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success && Array.isArray(data.deals) && data.deals.length > 0) {
          setDeals(data.deals);
        } else {
          setError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hide the strip entirely if we couldn't get any deals — never show fake data
  if (!loading && (error || !deals || deals.length === 0)) return null;

  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-12 md:px-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
            Live deals right now
          </h3>
        </div>
        <p className="text-[10px] text-white/35">
          Real prices · Kiwi.com · updated every 30 min
        </p>
      </div>

      <div className="overflow-x-auto scrollbar-none -mx-6 px-6 md:mx-0 md:px-0">
        <div className="flex gap-3 md:grid md:grid-cols-3 md:gap-4 min-w-max md:min-w-0">
          {loading
            ? [...Array(6)].map((_, i) => <DealSkeleton key={i} />)
            : deals!.map((d) => <DealCard key={d.id} deal={d} />)}
        </div>
      </div>
    </section>
  );
}

function DealCard({ deal }: { deal: Deal }) {
  const content = (
    <div
      className="relative w-[260px] md:w-auto rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 group overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Top row: emoji + route */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">{deal.emoji}</span>
          <div className="min-w-0">
            <p className="text-[10px] text-white/35 uppercase tracking-wider font-semibold">
              {deal.originCity} → {deal.destinationCity}
            </p>
            <p className="text-[9px] text-white/25 truncate">
              {deal.origin} → {deal.destination}
            </p>
          </div>
        </div>
        <div className="w-7 h-7 rounded-md bg-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
          {deal.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={deal.logoUrl}
              alt={deal.airline}
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <span className="text-[9px] font-bold text-amber-300">
              {deal.airlineCode}
            </span>
          )}
        </div>
      </div>

      {/* Airline + flight info */}
      <p className="text-xs text-white/55 truncate mb-1">{deal.airline}</p>
      <div className="flex items-center gap-2 text-[10px] text-white/35 mb-4">
        <span>{formatDate(deal.departDate)}</span>
        <span className="text-white/15">·</span>
        <span>{formatDuration(deal.durationMinutes)}</span>
        <span className="text-white/15">·</span>
        <span>{deal.stops === 0 ? 'Nonstop' : `${deal.stops} stop`}</span>
      </div>

      {/* Price */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[9px] text-white/35 uppercase tracking-wider">From</p>
          <p
            className="text-2xl font-bold leading-none"
            style={{
              background: 'var(--flyeas-gradient, linear-gradient(135deg, #F59E0B, #F97316))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            ${deal.price}
          </p>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-300/80 group-hover:text-amber-300 transition-colors">
          <span>Book</span>
          <svg
            width="11"
            height="11"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 3h7v7" />
            <path d="M13 3L6 10" />
          </svg>
        </div>
      </div>

      {/* Subtle gradient glow on hover */}
      <div
        className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background:
            'radial-gradient(circle at top left, color-mix(in srgb, var(--flyeas-accent, #F59E0B) 8%, transparent), transparent 60%)',
        }}
      />
    </div>
  );

  if (deal.deepLink) {
    return (
      <a
        href={deal.deepLink}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
        title={`Book ${deal.originCity} → ${deal.destinationCity} on Kiwi.com`}
      >
        {content}
      </a>
    );
  }
  return content;
}

function DealSkeleton() {
  return (
    <div
      className="w-[260px] md:w-auto rounded-2xl p-4 animate-pulse"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-white/5" />
          <div className="space-y-1">
            <div className="h-2.5 w-24 rounded bg-white/5" />
            <div className="h-2 w-16 rounded bg-white/5" />
          </div>
        </div>
        <div className="w-7 h-7 rounded-md bg-white/5" />
      </div>
      <div className="h-3 w-20 rounded bg-white/5 mb-2" />
      <div className="h-2 w-32 rounded bg-white/5 mb-4" />
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <div className="h-2 w-8 rounded bg-white/5" />
          <div className="h-7 w-20 rounded bg-white/10" />
        </div>
        <div className="h-3 w-12 rounded bg-white/5" />
      </div>
    </div>
  );
}
