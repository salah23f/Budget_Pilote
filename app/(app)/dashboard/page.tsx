'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getRecentSearches, type RecentSearch } from '@/lib/recent-searches';
import { useSavingsStore } from '@/lib/store/savings-store';
import { ReferralCard } from '@/components/referral-card';
import { StreakWidget } from '@/components/streak-widget';
import { DashboardSkeleton } from '@/components/skeletons';

export default function DashboardPage() {
  const [name, setName] = useState('Traveler');
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const [mounted, setMounted] = useState(false);
  const [pendingCity, setPendingCity] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem('sv_user');
      if (stored) {
        const user = JSON.parse(stored);
        if (user.firstName) setName(user.firstName);
      }
    } catch {}
    setRecent(getRecentSearches());
  }, []);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const actions = [
    {
      href: '/flights',
      title: 'Search Flights',
      desc: 'Real live prices from 400+ airlines',
      icon: (
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
        </svg>
      ),
      color: '#F59E0B',
    },
    {
      href: '/hotels',
      title: 'Search Hotels',
      desc: 'Real photos, addresses, guest ratings',
      icon: (
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
        </svg>
      ),
      color: '#F97316',
    },
    {
      href: '/missions/new',
      title: 'New AI Mission',
      desc: 'Monitor prices 24/7, auto-book at your price',
      icon: (
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.58-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
        </svg>
      ),
      color: '#10B981',
    },
  ];

  const trending = [
    { city: 'Paris', country: 'France' },
    { city: 'New York', country: 'USA' },
    { city: 'Tokyo', country: 'Japan' },
    { city: 'Barcelona', country: 'Spain' },
    { city: 'Dubai', country: 'UAE' },
    { city: 'Rome', country: 'Italy' },
  ];

  function rerunLink(r: RecentSearch): string {
    return r.kind === 'flight' ? '/flights' : '/hotels';
  }

  function timeAgo(ms: number): string {
    const diff = Date.now() - ms;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }

  if (!mounted) return <DashboardSkeleton />;

  return (
    <div className="py-2">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-2xl sm:text-3xl font-semibold">
            {greeting}, {name}
          </h1>
          <p className="mt-1 text-sm text-white/35">{today}</p>
        </div>

        {/* Stats Row — the investor-grade dashboard surface */}
        <DashboardStats />

        {/* Deal of the Day */}
        <DealOfTheDay />

        {/* Quick Actions */}
        <div className="mb-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {actions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="glass-premium rounded-2xl p-5 group card-interactive stagger-item"
            >
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl mb-4 transition-transform group-hover:scale-110"
                style={{ background: `${a.color}15`, color: a.color }}
              >
                {a.icon}
              </div>
              <p className="text-[15px] font-semibold text-white group-hover:text-amber-300 transition-colors">
                {a.title}
              </p>
              <p className="mt-1 text-xs text-white/35">{a.desc}</p>
            </Link>
          ))}
        </div>

        {/* Recent Searches — REAL data from the user's actual searches */}
        {mounted && recent.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Your Recent Searches</h2>
              <span className="text-[11px] text-white/30">Real prices you saw last time</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recent.slice(0, 6).map((r, i) => (
                <Link
                  key={i}
                  href={rerunLink(r)}
                  className="glass rounded-xl p-4 group hover:border-amber-500/30 transition-all"
                  style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          background: r.kind === 'flight' ? 'rgba(245,158,11,0.1)' : 'rgba(249,115,22,0.1)',
                          color: r.kind === 'flight' ? '#F59E0B' : '#F97316',
                        }}
                      >
                        {r.kind === 'flight' ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path
                              d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate group-hover:text-amber-300 transition-colors">
                          {r.kind === 'flight' ? `${r.origin} → ${r.destination}` : r.destination}
                        </p>
                        <p className="text-[11px] text-white/40 truncate">
                          {r.kind === 'flight'
                            ? `${r.departDate}${r.returnDate ? ` · return ${r.returnDate}` : ''}`
                            : `${r.checkIn} → ${r.checkOut}`}
                          {' · '}
                          {timeAgo(r.at)}
                        </p>
                      </div>
                    </div>
                    {r.cheapestPrice != null && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] text-white/35 uppercase tracking-wider">Was</p>
                        <p className="text-sm font-bold text-emerald-300">${r.cheapestPrice}</p>
                      </div>
                    )}
                  </div>
                  {(r.kind === 'flight' ? r.airline : r.hotelName) && (
                    <p className="mt-2 pl-12 text-[11px] text-white/30 truncate">
                      {r.kind === 'flight' ? r.airline : r.hotelName}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Smart recommendations based on search history */}
        <RecommendedRoutes recent={recent} />

        {/* Streak + Referral — engagement & viral loop */}
        <div className="mb-10 grid grid-cols-1 md:grid-cols-2 gap-4">
          <StreakWidget />
          <ReferralCard />
        </div>

        {/* Trending Destinations */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Trending Destinations</h2>
            <span className="text-[11px] text-white/30">Tap to search live prices</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {trending.map((t) => {
              const isPending = pendingCity === t.city;
              return (
                <Link
                  key={t.city}
                  href={`/hotels?q=${encodeURIComponent(t.city)}&auto=1`}
                  onClick={() => setPendingCity(t.city)}
                  aria-busy={isPending}
                  className="relative glass rounded-xl p-4 text-center group hover:border-amber-500/30 transition-all overflow-hidden"
                  style={{
                    border: isPending
                      ? '1px solid rgba(245,158,11,0.4)'
                      : '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <p
                    className={`text-sm font-semibold transition-colors ${
                      isPending ? 'text-amber-300' : 'text-white group-hover:text-amber-300'
                    }`}
                  >
                    {t.city}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/35">{t.country}</p>
                  {isPending && (
                    <>
                      <div className="flex items-center justify-center gap-1.5 mt-2">
                        <span className="h-1 w-1 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-[10px] text-amber-300/80 font-medium">
                          Loading live prices…
                        </span>
                      </div>
                      <div
                        className="absolute bottom-0 left-0 h-0.5 bg-amber-400/60"
                        style={{
                          animation: 'progressSlide 3s linear forwards',
                        }}
                      />
                      <style jsx>{`
                        @keyframes progressSlide {
                          from {
                            width: 0;
                          }
                          to {
                            width: 100%;
                          }
                        }
                      `}</style>
                    </>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Missions empty state */}
        <div className="glass rounded-2xl p-6 mb-6">
          <h2 className="text-base font-semibold mb-5">Your Missions</h2>
          <div className="flex flex-col items-center py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.03] mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            </div>
            <p className="text-sm text-white/35 max-w-xs">
              No active missions yet. Create a mission to start monitoring real prices with AI.
            </p>
            <Link
              href="/missions/new"
              className="premium-button mt-5 rounded-xl px-6 py-2.5 text-sm font-semibold inline-flex items-center gap-2"
            >
              Create your first mission
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Tip */}
        <div
          className="rounded-xl p-4 flex items-start gap-3"
          style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.08)' }}
        >
          <svg
            className="flex-shrink-0 mt-0.5"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#F59E0B"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <div>
            <p className="text-xs font-medium text-amber-200/80">Pro tip</p>
            <p className="text-xs text-white/35 mt-0.5">
              Use the AI Assistant (bottom right) or the trip planner on the home page — tell it your trip in one sentence and get real live prices instantly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Stats Row (hoisted outside main component per React best practices) ── */

/* ── Deal of the Day ── */

function DealOfTheDay() {
  const [deal, setDeal] = useState<any>(null);

  useEffect(() => {
    fetch('/api/deals')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.deals?.length > 0) {
          setDeal(data.deals[0]); // cheapest
        }
      })
      .catch(() => {});
  }, []);

  if (!deal) return null;

  return (
    <div className="mb-8">
      <div
        className="rounded-2xl p-5 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(16,185,129,0.05))',
          border: '1px solid rgba(245,158,11,0.15)',
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-300">
                Deal of the day
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <h3 className="text-lg font-semibold text-white">
              {deal.emoji} {deal.originCity} → {deal.destinationCity}
            </h3>
            <p className="text-xs text-white/40 mt-1">
              {deal.airline} · {deal.stops === 0 ? 'Non-stop' : `${deal.stops} stop${deal.stops > 1 ? 's' : ''}`}
              {deal.durationMinutes ? ` · ${Math.floor(deal.durationMinutes / 60)}h ${deal.durationMinutes % 60}m` : ''}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-3xl font-bold text-white">${deal.price}</p>
              <p className="text-[10px] text-white/30">one-way · live price</p>
            </div>
            {deal.deepLink && (
              <a
                href={deal.deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white flex-shrink-0"
                style={{
                  background: 'var(--flyeas-gradient, linear-gradient(135deg, #F59E0B, #EF4444))',
                  boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
                }}
              >
                Book now
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Recommended routes based on search history ── */

const ROUTE_SUGGESTIONS: Record<string, Array<{ dest: string; emoji: string; reason: string }>> = {
  paris: [
    { dest: 'Rome', emoji: '🇮🇹', reason: '2h direct, 30% cheaper than avg' },
    { dest: 'Barcelona', emoji: '🇪🇸', reason: 'Popular from Paris, deals daily' },
    { dest: 'Marrakech', emoji: '🇲🇦', reason: '3h direct, great value' },
  ],
  london: [
    { dest: 'Amsterdam', emoji: '🇳🇱', reason: '1h flight, weekend favorite' },
    { dest: 'Lisbon', emoji: '🇵🇹', reason: 'Trending destination 2026' },
    { dest: 'Dublin', emoji: '🇮🇪', reason: 'Quick getaway, lots of deals' },
  ],
  'new york': [
    { dest: 'Miami', emoji: '🇺🇸', reason: '3h domestic, beach escape' },
    { dest: 'Cancun', emoji: '🇲🇽', reason: 'Direct flights, resort deals' },
    { dest: 'London', emoji: '🇬🇧', reason: 'Transatlantic classic' },
  ],
  default: [
    { dest: 'Paris', emoji: '🇫🇷', reason: 'Most searched destination' },
    { dest: 'Tokyo', emoji: '🇯🇵', reason: 'Trending for 2026' },
    { dest: 'Bali', emoji: '🇮🇩', reason: 'Best value long-haul' },
  ],
};

function RecommendedRoutes({ recent }: { recent: RecentSearch[] }) {
  // Derive recommendations from search history
  const firstFlight = recent.find((r): r is import('@/lib/recent-searches').RecentFlight => r.kind === 'flight');
  const lastOrigin = firstFlight?.origin?.toLowerCase() || '';
  const key = Object.keys(ROUTE_SUGGESTIONS).find((k) => lastOrigin.includes(k)) || 'default';
  const suggestions = ROUTE_SUGGESTIONS[key];

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-white">
          {recent.length > 0 ? '✨ Recommended for you' : '✨ Popular routes'}
        </h2>
        <span className="text-[10px] text-white/30">Based on your searches</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {suggestions.map((s) => (
          <Link
            key={s.dest}
            href={`/flights?destination=${encodeURIComponent(s.dest)}`}
            className="rounded-xl p-4 transition-all hover:scale-[1.02] group"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{s.emoji}</span>
              <span className="text-sm font-semibold text-white group-hover:text-amber-300 transition-colors">
                {s.dest}
              </span>
            </div>
            <p className="text-[11px] text-white/40">{s.reason}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function DashboardStats() {
  const { totalSaved, searchesCount, dealsFound, events } = useSavingsStore();

  const stats = [
    {
      label: 'Total Saved',
      value: totalSaved > 0 ? `$${Math.round(totalSaved).toLocaleString()}` : '$0',
      sub: totalSaved > 0 ? `across ${events.length} bookings` : 'book to start saving',
      color: '#10B981',
      icon: (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 16l4-4 3 3 7-8" /><path d="M14 7h4v4" />
        </svg>
      ),
    },
    {
      label: 'Searches',
      value: searchesCount.toLocaleString(),
      sub: 'flight lookups',
      color: '#F59E0B',
      icon: (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="9" r="6" /><path d="M13.5 13.5L17 17" />
        </svg>
      ),
    },
    {
      label: 'Deals Found',
      value: dealsFound.toLocaleString(),
      sub: 'live offers seen',
      color: '#8B5CF6',
      icon: (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 2l2.5 5 5.5.8-4 3.9.9 5.3L10 14.5 5.1 17l.9-5.3-4-3.9 5.5-.8z" />
        </svg>
      ),
    },
    {
      label: 'Best Save',
      value: events.length > 0
        ? `$${Math.round(Math.max(...events.map((e) => e.amountSaved)))}`
        : '—',
      sub: events.length > 0
        ? events.reduce((best, e) => (e.amountSaved > best.amountSaved ? e : best), events[0]).route
        : 'no saves yet',
      color: '#EF4444',
      icon: (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2L3 14h7l-1 6 10-12h-7l1-6z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-2xl p-4 transition-colors"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `${s.color}15`, color: s.color }}
            >
              {s.icon}
            </div>
            <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
              {s.label}
            </span>
          </div>
          <p className="text-xl font-bold text-white">{s.value}</p>
          <p className="text-[11px] text-white/30 mt-0.5 truncate">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}
