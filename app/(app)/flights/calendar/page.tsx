'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AirportInput, type AirportSelection } from '@/components/ui/airport-input';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 0 = Monday ... 6 = Sunday (ISO week) */
function dayOfWeekMon(year: number, month: number, day: number): number {
  const d = new Date(year, month - 1, day).getDay(); // 0=Sun
  return d === 0 ? 6 : d - 1;
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* ------------------------------------------------------------------ */
/*  Price tier classification                                          */
/* ------------------------------------------------------------------ */

function classifyPrices(prices: Record<string, number>) {
  const vals = Object.values(prices).filter((p) => p > 0).sort((a, b) => a - b);
  if (vals.length === 0) return { low: 0, high: Infinity };
  const q1 = vals[Math.floor(vals.length * 0.25)] ?? vals[0];
  const q3 = vals[Math.floor(vals.length * 0.75)] ?? vals[vals.length - 1];
  return { low: q1, high: q3 };
}

type PriceTier = 'cheap' | 'mid' | 'expensive' | 'none';

function getTier(price: number | undefined, thresholds: { low: number; high: number }): PriceTier {
  if (!price || price <= 0) return 'none';
  if (price <= thresholds.low) return 'cheap';
  if (price >= thresholds.high) return 'expensive';
  return 'mid';
}

const tierStyles: Record<PriceTier, string> = {
  cheap: 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/30',
  mid: 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/25',
  expensive: 'bg-red-500/15 hover:bg-red-500/25 border-red-500/25',
  none: 'bg-white/[0.03] border-white/[0.06]',
};

const tierPriceColor: Record<PriceTier, string> = {
  cheap: 'text-emerald-400 font-bold',
  mid: 'text-amber-300',
  expensive: 'text-red-400',
  none: 'text-white/20',
};

/* ------------------------------------------------------------------ */
/*  SVG Icons                                                          */
/* ------------------------------------------------------------------ */

function ChevronLeft({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 4l-6 6 6 6" />
    </svg>
  );
}

function ChevronRight({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4l6 6-6 6" />
    </svg>
  );
}

function CalendarIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="14" height="14" rx="2" />
      <path d="M3 8h14M7 2v4M13 2v4" />
    </svg>
  );
}

function ArrowLeftIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 10H5M5 10l4-4M5 10l4 4" />
    </svg>
  );
}

function PlaneIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 10l-5-7v4H3v6h9v4l5-7z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function CalendarSkeleton() {
  return (
    <div className="grid grid-cols-7 gap-2">
      {Array.from({ length: 35 }).map((_, i) => (
        <div
          key={i}
          className="aspect-square rounded-lg bg-white/[0.04] animate-pulse"
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function FlightCalendarPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-4 py-8"><div className="h-8 w-48 bg-white/5 rounded animate-pulse mb-6" /><div className="h-96 bg-white/5 rounded-2xl animate-pulse" /></div>}>
      <FlightCalendarContent />
    </Suspense>
  );
}

function FlightCalendarContent() {
  const searchParams = useSearchParams();

  /* -- Route inputs -- */
  const [origin, setOrigin] = useState(searchParams.get('origin') || '');
  const [originSkyId, setOriginSkyId] = useState('');
  const [destination, setDestination] = useState(searchParams.get('destination') || '');
  const [destSkyId, setDestSkyId] = useState('');

  /* -- Month navigation -- */
  const now = new Date();
  const initMonth = searchParams.get('month');
  const [year, setYear] = useState(() => {
    if (initMonth) return Number(initMonth.split('-')[0]);
    return now.getFullYear();
  });
  const [month, setMonth] = useState(() => {
    if (initMonth) return Number(initMonth.split('-')[1]);
    return now.getMonth() + 1; // 1-indexed
  });

  /* -- Data -- */
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const totalDays = daysInMonth(year, month);
  const startDow = dayOfWeekMon(year, month, 1);
  const todayStr = now.toISOString().split('T')[0];

  /* -- Fetch prices -- */
  const fetchPrices = useCallback(async () => {
    if (!origin || !destination) return;
    setLoading(true);
    try {
      const o = originSkyId || origin;
      const d = destSkyId || destination;
      const res = await fetch(
        `/api/flights/calendar?origin=${encodeURIComponent(o)}&destination=${encodeURIComponent(d)}&month=${monthStr}&cabin=economy&adults=1`
      );
      const data = await res.json();
      if (data.success) {
        setPrices(data.prices || {});
      } else {
        setPrices({});
      }
      setFetched(true);
    } catch (_) {
      setPrices({});
      setFetched(true);
    } finally {
      setLoading(false);
    }
  }, [origin, destination, originSkyId, destSkyId, monthStr]);

  // Auto-fetch when origin, destination, and month are all set
  useEffect(() => {
    if (origin && destination) {
      fetchPrices();
    }
  }, [fetchPrices]); // eslint-disable-line react-hooks/exhaustive-deps

  /* -- Month navigation -- */
  function prevMonth() {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  /* -- Price tiers -- */
  const thresholds = useMemo(() => classifyPrices(prices), [prices]);

  /* -- Build calendar cells -- */
  const cells: Array<{ day: number | null; dateStr: string; price?: number; tier: PriceTier; isPast: boolean; isToday: boolean }> = useMemo(() => {
    const arr: typeof cells = [];
    // Empty leading cells
    for (let i = 0; i < startDow; i++) {
      arr.push({ day: null, dateStr: '', tier: 'none', isPast: false, isToday: false });
    }
    // Day cells
    for (let d = 1; d <= totalDays; d++) {
      const ds = toDateStr(year, month, d);
      const price = prices[ds];
      const isPast = ds < todayStr;
      const isToday = ds === todayStr;
      arr.push({
        day: d,
        dateStr: ds,
        price,
        tier: isPast ? 'none' : getTier(price, thresholds),
        isPast,
        isToday,
      });
    }
    return arr;
  }, [startDow, totalDays, year, month, prices, todayStr, thresholds]);

  /* -- Stats -- */
  const stats = useMemo(() => {
    const vals = Object.values(prices).filter((p) => p > 0);
    if (vals.length === 0) return null;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
    const cheapestDate = Object.entries(prices).find(([, p]) => p === min)?.[0] || '';
    return { min, max, avg, cheapestDate };
  }, [prices]);

  /* -- Can go to previous month? -- */
  const canGoPrev = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8 space-y-6 fade-in">
      {/* ---- Back link ---- */}
      <Link
        href="/flights"
        className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Back to flight search
      </Link>

      {/* ---- Header ---- */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'color-mix(in srgb, var(--flyeas-accent, #E8A317) 15%, transparent)' }}
        >
          <CalendarIcon className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Price Calendar</h1>
          <p className="text-sm text-white/40">Find the cheapest days to fly</p>
        </div>
      </div>

      {/* ---- Route Inputs ---- */}
      <div
        className="rounded-2xl p-5 space-y-4"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AirportInput
            label="From"
            placeholder="City or airport..."
            value={origin}
            onChange={(sel: AirportSelection) => {
              setOrigin(sel.code);
              setOriginSkyId(sel.skyId);
            }}
          />
          <AirportInput
            label="To"
            placeholder="City or airport..."
            value={destination}
            onChange={(sel: AirportSelection) => {
              setDestination(sel.code);
              setDestSkyId(sel.skyId);
            }}
          />
        </div>

        {origin && destination && (
          <div className="flex items-center gap-2 text-sm text-white/50">
            <PlaneIcon className="w-4 h-4" />
            <span>{origin}</span>
            <span className="text-white/20">-&gt;</span>
            <span>{destination}</span>
          </div>
        )}
      </div>

      {/* ---- Month Navigation + Calendar ---- */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Month header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <button
            onClick={prevMonth}
            disabled={!canGoPrev}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
            aria-label="Previous month"
          >
            <ChevronLeft />
          </button>
          <h2 className="text-lg font-semibold text-white">{monthLabel(year, month)}</h2>
          <button
            onClick={nextMonth}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Next month"
          >
            <ChevronRight />
          </button>
        </div>

        {/* Stats bar */}
        {stats && !loading && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 border-b border-white/[0.06] text-xs text-white/50">
            <span>
              Cheapest: <strong className="text-emerald-400">${stats.min}</strong>
              {stats.cheapestDate && (
                <span className="ml-1 text-white/30">
                  ({new Date(stats.cheapestDate + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                </span>
              )}
            </span>
            <span>Avg: <strong className="text-white/70">${stats.avg}</strong></span>
            <span>Most expensive: <strong className="text-red-400">${stats.max}</strong></span>
          </div>
        )}

        {/* Calendar grid */}
        <div className="p-4 md:p-5">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="text-center text-xs font-medium text-white/30 py-1">
                {wd}
              </div>
            ))}
          </div>

          {/* Day cells */}
          {loading ? (
            <CalendarSkeleton />
          ) : (
            <div className="grid grid-cols-7 gap-1.5 md:gap-2">
              {cells.map((cell, i) => {
                if (cell.day === null) {
                  return <div key={`empty-${i}`} className="aspect-square" />;
                }

                const hasPrice = cell.price != null && cell.price > 0 && !cell.isPast;
                const clickable = hasPrice;

                const inner = (
                  <div
                    className={`
                      aspect-square rounded-lg border flex flex-col items-center justify-center transition-all duration-150
                      ${cell.isPast ? 'opacity-30 cursor-default bg-white/[0.02] border-white/[0.04]' : tierStyles[cell.tier]}
                      ${clickable ? 'cursor-pointer' : 'cursor-default'}
                      ${cell.isToday ? 'ring-2 ring-amber-400/60' : ''}
                    `}
                  >
                    <span className={`text-xs md:text-sm ${cell.isToday ? 'text-amber-300 font-semibold' : 'text-white/60'}`}>
                      {cell.day}
                    </span>
                    {hasPrice ? (
                      <span className={`text-[10px] md:text-xs mt-0.5 ${tierPriceColor[cell.tier]}`}>
                        ${cell.price}
                      </span>
                    ) : (
                      <span className="text-[10px] md:text-xs mt-0.5 text-white/15">--</span>
                    )}
                  </div>
                );

                if (clickable) {
                  return (
                    <Link
                      key={cell.dateStr}
                      href={`/flights?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&date=${cell.dateStr}`}
                    >
                      {inner}
                    </Link>
                  );
                }

                return <div key={cell.dateStr || `day-${i}`}>{inner}</div>;
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 px-5 py-3 border-t border-white/[0.06] text-xs text-white/40">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-emerald-500/30 border border-emerald-500/40" />
            <span>Good deal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-amber-500/25 border border-amber-500/30" />
            <span>Average</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-red-500/25 border border-red-500/30" />
            <span>Expensive</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-white/[0.04] border border-white/[0.08]" />
            <span>No data</span>
          </div>
        </div>
      </div>

      {/* ---- Empty state ---- */}
      {!origin && !destination && (
        <div className="text-center py-16">
          <CalendarIcon className="w-12 h-12 mx-auto text-white/10 mb-4" />
          <p className="text-white/30 text-sm">Enter an origin and destination to see prices</p>
        </div>
      )}

      {origin && destination && fetched && !loading && Object.keys(prices).length === 0 && (
        <div className="text-center py-12">
          <p className="text-white/30 text-sm">No price data available for this month.</p>
          <p className="text-white/20 text-xs mt-1">Try a different month or route.</p>
        </div>
      )}
    </div>
  );
}
