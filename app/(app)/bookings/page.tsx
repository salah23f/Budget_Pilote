'use client';

import Link from 'next/link';

export default function BookingsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8 space-y-6 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Bookings</h1>
      </div>

      {/* Empty State */}
      <div className="flex flex-col items-center justify-center text-center max-w-sm mx-auto py-16">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full mb-6"
          style={{ background: 'rgba(255,255,255,0.03)' }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="6" y="10" width="36" height="28" rx="4" />
            <path d="M6 18h36" />
            <path d="M16 10V6" />
            <path d="M32 10V6" />
            <path d="M14 26h8" />
            <path d="M14 32h12" />
            <circle cx="34" cy="30" r="4" />
            <path d="M34 28v4l2 1" />
          </svg>
        </div>

        <h2 className="text-lg font-semibold text-white/70 mb-2">No bookings yet</h2>
        <p className="text-sm text-white/40 mb-8">
          Your confirmed flight and hotel bookings will appear here.
        </p>

        <Link
          href="/flights"
          className="premium-button rounded-xl px-6 py-3 text-sm font-semibold text-white no-underline"
          style={{
            background: 'var(--flyeas-gradient, linear-gradient(135deg, #D4A24C, #F97316, #EF4444))',
            boxShadow: '0 6px 20px color-mix(in srgb, var(--flyeas-accent, #D4A24C) 25%, transparent)',
          }}
        >
          Search flights
        </Link>
      </div>
    </div>
  );
}
