'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function formatDuration(minutes: number): string {
  if (!minutes) return '--';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function BookingContent() {
  const searchParams = useSearchParams();

  const price = searchParams.get('price') || '0';
  const airline = searchParams.get('airline') || 'Unknown Airline';
  const route = searchParams.get('route') || '';
  const flightNumber = searchParams.get('flight') || '';
  const departure = searchParams.get('departure') || '';
  const arrival = searchParams.get('arrival') || '';
  const duration = searchParams.get('duration') || '0';
  const stops = searchParams.get('stops') || '0';

  const [originCode, destCode] = route.split('-');

  function formatTime(isoOrTime: string): string {
    if (!isoOrTime) return '--:--';
    if (isoOrTime.includes('T')) {
      const d = new Date(isoOrTime);
      return d.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return isoOrTime;
  }

  const stopsNum = Number(stops);
  const stopsLabel =
    stopsNum === 0 ? 'Nonstop' : stopsNum === 1 ? '1 Stop' : `${stopsNum} Stops`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:px-8 md:py-16 fade-in">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/flights"
          className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors mb-6"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 12L6 8l4-4" />
          </svg>
          Back to results
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
          Booking Review
        </h1>
        <p className="text-sm text-white/50 mt-1">
          Review your flight details before confirming
        </p>
      </div>

      {/* Flight Card */}
      <div className="glass rounded-2xl overflow-hidden border border-white/[0.06]">
        {/* Airline header */}
        <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl glass flex items-center justify-center text-sm font-bold text-amber-300">
              {airline
                .split(' ')
                .map((w: string) => w[0])
                .join('')}
            </div>
            <div>
              <p className="text-base font-semibold text-white">{airline}</p>
              {flightNumber && (
                <p className="text-xs text-white/45">{flightNumber}</p>
              )}
            </div>
          </div>
          <div className="px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
            {stopsLabel}
          </div>
        </div>

        {/* Route details */}
        <div className="px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">
                {formatTime(departure)}
              </p>
              <p className="text-sm text-white/50 mt-1">
                {originCode?.toUpperCase() || '---'}
              </p>
            </div>

            <div className="flex-1 flex flex-col items-center gap-1.5 px-6">
              <p className="text-xs text-white/40">
                {formatDuration(Number(duration))}
              </p>
              <div className="w-full h-px bg-white/10 relative">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-400" />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-400" />
                {stopsNum > 0 && (
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-[#1C1917]" />
                )}
              </div>
            </div>

            <div className="text-center">
              <p className="text-2xl font-bold text-white">
                {formatTime(arrival)}
              </p>
              <p className="text-sm text-white/50 mt-1">
                {destCode?.toUpperCase() || '---'}
              </p>
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-white/40 mb-1">Route</p>
              <p className="text-sm font-semibold text-white">
                {originCode?.toUpperCase() || '---'} &rarr;{' '}
                {destCode?.toUpperCase() || '---'}
              </p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-white/40 mb-1">Duration</p>
              <p className="text-sm font-semibold text-white">
                {formatDuration(Number(duration))}
              </p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-white/40 mb-1">Stops</p>
              <p className="text-sm font-semibold text-white">{stopsLabel}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-white/40 mb-1">Flight</p>
              <p className="text-sm font-semibold text-white">
                {flightNumber || 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Price section */}
        <div className="px-6 py-5 border-t border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-white/60">Total price</p>
            <p className="text-3xl font-bold text-white">${price}</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/35">per person, taxes included</p>
          </div>
        </div>

        {/* Action section */}
        <div className="px-6 py-5 border-t border-white/[0.06] space-y-4">
          <button
            disabled
            className="w-full py-3.5 rounded-xl text-sm font-semibold text-white/40 bg-white/[0.04] border border-white/[0.06] cursor-not-allowed"
          >
            Confirm &amp; Pay -- Coming Soon
          </button>
          <p className="text-center text-xs text-white/25">
            Secure payment powered by Stripe
          </p>
        </div>
      </div>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 py-10 md:px-8 md:py-16 fade-in">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 bg-white/10 rounded" />
            <div className="glass rounded-2xl h-96 bg-white/[0.02]" />
          </div>
        </div>
      }
    >
      <BookingContent />
    </Suspense>
  );
}
