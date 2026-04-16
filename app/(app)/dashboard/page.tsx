'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getRecentSearches, type RecentSearch } from '@/lib/recent-searches';
import { useSavingsStore } from '@/lib/store/savings-store';
import { useStreakStore } from '@/lib/store/streak-store';
import { ReferralCard } from '@/components/referral-card';
import { StreakWidget } from '@/components/streak-widget';
import { DashboardSkeleton } from '@/components/skeletons';
import { Card } from '@/components/ui/card';
import {
  Plane,
  Building2,
  Rocket,
  TrendingUp,
  Search,
  Star,
  Zap,
  Target,
  MapPin,
  BarChart3,
  ArrowRight,
  Info,
  Clock,
} from 'lucide-react';

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
    } catch (_) {}
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
      desc: 'Live prices from 400+ airlines worldwide',
      icon: Plane,
      color: '#E8A317',
    },
    {
      href: '/hotels',
      title: 'Search Hotels',
      desc: 'Photos, ratings & verified guest reviews',
      icon: Building2,
      color: '#F97316',
    },
    {
      href: '/missions/new',
      title: 'New AI Mission',
      desc: 'Set a target price — we monitor and book for you',
      icon: Rocket,
      color: '#10B981',
    },
  ];

  // Build personalized trending destinations from user behavior
  const trending = (() => {
    const DEFAULT_TRENDING = [
      { city: 'Paris', country: 'France' },
      { city: 'New York', country: 'USA' },
      { city: 'Tokyo', country: 'Japan' },
      { city: 'Barcelona', country: 'Spain' },
      { city: 'Dubai', country: 'UAE' },
      { city: 'Rome', country: 'Italy' },
    ];

    if (!recent || recent.length === 0) return DEFAULT_TRENDING;

    const destCount = new Map<string, { city: string; country: string; count: number; price?: number }>();
    for (const r of recent) {
      const city = r.destination;
      if (!city) continue;
      const existing = destCount.get(city);
      if (existing) {
        existing.count++;
        if (r.cheapestPrice && (!existing.price || r.cheapestPrice < existing.price)) {
          existing.price = r.cheapestPrice;
        }
      } else {
        destCount.set(city, { city, country: '', count: 1, price: r.cheapestPrice });
      }
    }

    try {
      const raw = localStorage.getItem('flyeas_favorites');
      if (raw) {
        const items = JSON.parse(raw);
        if (Array.isArray(items)) {
          for (const item of items) {
            if (item.kind === 'flight' && item.destinationCity) {
              const city = item.destinationCity;
              const existing = destCount.get(city);
              if (existing) existing.count += 2;
              else destCount.set(city, { city, country: '', count: 2, price: item.price });
            }
          }
        }
      }
    } catch (_) {}

    const sorted = [...destCount.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map((d) => ({ city: d.city, country: d.country || '' }));

    const seen = new Set(sorted.map((d) => d.city.toLowerCase()));
    for (const d of DEFAULT_TRENDING) {
      if (sorted.length >= 6) break;
      if (!seen.has(d.city.toLowerCase())) {
        sorted.push(d);
        seen.add(d.city.toLowerCase());
      }
    }

    return sorted.slice(0, 6);
  })();

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
          <h1 className="text-2xl sm:text-3xl font-semibold font-display text-text-primary tracking-tight">
            {greeting}, {name}
          </h1>
          <p className="mt-1.5 text-sm text-text-muted">{today}</p>
        </div>

        {/* Stats Row */}
        <DashboardStats />

        {/* Deal of the Day */}
        <DealOfTheDay />

        {/* Quick Actions */}
        <div className="mb-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.href}
                href={a.href}
                className="bg-surface-card border border-border-subtle rounded-2xl p-5 group hover:border-border-default transition-all hover:-translate-y-0.5"
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl mb-4 transition-transform group-hover:scale-105"
                  style={{ background: `${a.color}12`, color: a.color }}
                >
                  <Icon className="w-5 h-5" strokeWidth={1.6} />
                </div>
                <p className="text-[15px] font-semibold text-text-primary group-hover:text-accent transition-colors">
                  {a.title}
                </p>
                <p className="mt-1 text-xs text-text-muted leading-relaxed">{a.desc}</p>
              </Link>
            );
          })}
        </div>

        {/* Referral widget — compact Revolut-style */}
        <Link
          href="/referral"
          className="group mb-10 flex items-center justify-between gap-4 rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:bg-white/[0.04]"
          style={{
            background: 'linear-gradient(135deg, rgba(232,163,23,0.08) 0%, rgba(249,115,22,0.04) 100%)',
            border: '1px solid rgba(232,163,23,0.2)',
          }}
        >
          <div className="flex items-center gap-4 min-w-0">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
              style={{ background: 'linear-gradient(135deg, #E8A317, #F97316)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 12 20 22 4 22 4 12" />
                <rect x="2" y="7" width="20" height="5" />
                <line x1="12" y1="22" x2="12" y2="7" />
                <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-white flex items-center gap-2">
                Invite friends, earn $10 each
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#E8A317]/20 text-[#E8A317] font-bold uppercase tracking-wider">New</span>
              </p>
              <p className="mt-0.5 text-xs text-white/50 truncate">
                Unlock Pro, Elite & lifetime VIP as your network grows
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[#E8A317] group-hover:translate-x-0.5 transition-transform shrink-0">
            <span className="text-xs font-semibold hidden sm:inline">Get started</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </Link>

        {/* Recent Searches */}
        {mounted && recent.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold font-display text-text-primary">Recent Searches</h2>
              <span className="text-[11px] text-text-muted flex items-center gap-1">
                <Clock className="w-3 h-3" strokeWidth={1.5} />
                Live prices from your last searches
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {recent.slice(0, 6).map((r, i) => (
                <Link
                  key={i}
                  href={rerunLink(r)}
                  className="bg-surface-card border border-border-subtle rounded-xl p-4 group hover:border-border-default transition-all"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          background: r.kind === 'flight' ? 'rgba(232,163,23,0.08)' : 'rgba(249,115,22,0.08)',
                          color: r.kind === 'flight' ? '#E8A317' : '#F97316',
                        }}
                      >
                        {r.kind === 'flight' ? (
                          <Plane className="w-4 h-4" strokeWidth={1.6} />
                        ) : (
                          <Building2 className="w-4 h-4" strokeWidth={1.6} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-primary truncate group-hover:text-accent transition-colors">
                          {r.kind === 'flight' ? `${r.origin} → ${r.destination}` : r.destination}
                        </p>
                        <p className="text-[11px] text-text-muted truncate">
                          {r.kind === 'flight'
                            ? `${r.departDate}${r.returnDate ? ` · return ${r.returnDate}` : ''}`
                            : `${r.checkIn} → ${r.checkOut}`}
                          {' · '}
                          {timeAgo(r.at)}
                        </p>
                      </div>
                    </div>
                    {r.cheapestPrice != null && (
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-text-muted uppercase tracking-wider">From</p>
                        <p className="text-sm font-bold text-emerald-400">${r.cheapestPrice}</p>
                      </div>
                    )}
                  </div>
                  {(r.kind === 'flight' ? r.airline : r.hotelName) && (
                    <p className="mt-2 pl-12 text-[11px] text-text-muted/60 truncate">
                      {r.kind === 'flight' ? r.airline : r.hotelName}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Smart recommendations */}
        <RecommendedRoutes recent={recent} />

        {/* Streak + Referral */}
        <div className="mb-10 grid grid-cols-1 md:grid-cols-2 gap-4">
          <StreakWidget />
          <ReferralCard />
        </div>

        {/* Trending Destinations */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold font-display text-text-primary">Trending Destinations</h2>
            <span className="text-[11px] text-text-muted">Tap to search live prices</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {trending.map((t) => {
              const isPending = pendingCity === t.city;
              return (
                <Link
                  key={t.city}
                  href={`/hotels?q=${encodeURIComponent(t.city)}&auto=1`}
                  onClick={() => setPendingCity(t.city)}
                  aria-busy={isPending}
                  className={`relative bg-surface-card border rounded-xl p-4 text-center group transition-all overflow-hidden ${
                    isPending ? 'border-accent/30' : 'border-border-subtle hover:border-border-default'
                  }`}
                >
                  <p className={`text-sm font-medium transition-colors ${isPending ? 'text-accent' : 'text-text-primary group-hover:text-accent'}`}>
                    {t.city}
                  </p>
                  <p className="mt-0.5 text-[11px] text-text-muted">{t.country}</p>
                  {isPending && (
                    <div className="flex items-center justify-center gap-1.5 mt-2">
                      <span className="h-1 w-1 rounded-full bg-accent animate-pulse" />
                      <span className="text-[10px] text-accent/70 font-medium">Loading live prices</span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Missions */}
        <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 mb-8">
          <h2 className="text-base font-semibold font-display text-text-primary mb-5">Your Missions</h2>
          <div className="flex flex-col items-center py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.03] mb-4">
              <Target className="w-6 h-6 text-text-muted/30" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-text-secondary max-w-xs leading-relaxed">
              No active missions yet. Set a target price and let AI monitor 24/7 — it books automatically when the price is right.
            </p>
            <Link
              href="/missions/new"
              className="mt-6 inline-flex items-center gap-2 bg-gradient-to-r from-accent-light to-accent-dark text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:shadow-glow transition-all"
            >
              Create your first mission
              <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </Link>
          </div>
        </div>

        {/* Travel Stats */}
        <TravelStats recent={recent} />

        {/* Pro tip */}
        <div className="rounded-xl p-4 flex items-start gap-3 bg-accent/[0.04] border border-accent/[0.08]">
          <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" strokeWidth={1.5} />
          <div>
            <p className="text-xs font-medium text-accent/80">Pro tip</p>
            <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
              Use the AI Assistant or the trip planner on the home page — describe your trip in one sentence and get live prices instantly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Deal of the Day ── */

function DealOfTheDay() {
  const [deal, setDeal] = useState<any>(null);
  const [label, setLabel] = useState('Deal of the day');

  useEffect(() => {
    let url = '/api/deals';
    let isPersonalized = false;
    try {
      const recentRaw = localStorage.getItem('flyeas_recent_searches');
      const favsRaw = localStorage.getItem('flyeas_favorites');
      const origins = new Set<string>();
      const destinations = new Set<string>();

      if (recentRaw) {
        const items = JSON.parse(recentRaw);
        if (Array.isArray(items)) {
          for (const r of items) {
            if (r.kind === 'flight') {
              if (r.origin && r.origin.length <= 4) origins.add(r.origin.toUpperCase());
              if (r.destination && r.destination.length <= 4) destinations.add(r.destination.toUpperCase());
            }
          }
        }
      }
      if (favsRaw) {
        const items = JSON.parse(favsRaw);
        if (Array.isArray(items)) {
          for (const f of items) {
            if (f.kind === 'flight') {
              if (f.origin && f.origin.length <= 4) origins.add(f.origin.toUpperCase());
              if (f.destination && f.destination.length <= 4) destinations.add(f.destination.toUpperCase());
            }
          }
        }
      }

      if (origins.size > 0 && destinations.size > 0) {
        const params = new URLSearchParams();
        params.set('origins', [...origins].slice(0, 5).join(','));
        params.set('destinations', [...destinations].slice(0, 5).join(','));
        url = `/api/deals?${params.toString()}`;
        isPersonalized = true;
      }
    } catch (_) {}

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.deals?.length > 0) {
          const deals = data.deals;
          const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
          const idx = dayOfYear % deals.length;
          setDeal(deals[idx]);
          setLabel(isPersonalized ? 'Recommended for you' : 'Deal of the day');
        }
      })
      .catch(() => {});
  }, []);

  if (!deal) return null;

  return (
    <div className="mb-8">
      <div className="rounded-2xl p-5 relative overflow-hidden bg-emerald-500/[0.04] border border-emerald-500/10">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] uppercase tracking-[0.1em] font-semibold text-accent">
                {label}
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <h3 className="text-lg font-semibold font-display text-text-primary">
              {deal.originCity} → {deal.destinationCity}
            </h3>
            <p className="text-xs text-text-muted mt-1">
              {deal.airline} · {deal.stops === 0 ? 'Non-stop' : `${deal.stops} stop${deal.stops > 1 ? 's' : ''}`}
              {deal.durationMinutes ? ` · ${Math.floor(deal.durationMinutes / 60)}h ${deal.durationMinutes % 60}m` : ''}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-3xl font-bold font-display text-text-primary">${deal.price}</p>
              <p className="text-[10px] text-text-muted">one-way · live price</p>
            </div>
            {deal.deepLink && (
              <a
                href={deal.deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white shrink-0 bg-gradient-to-r from-accent-light to-accent-dark shadow-glow hover:shadow-glow-lg transition-all"
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

/* ── Recommended Routes ── */

function RecommendedRoutes({ recent }: { recent: RecentSearch[] }) {
  const flightSearches = recent.filter((r): r is import('@/lib/recent-searches').RecentFlight => r.kind === 'flight');

  if (flightSearches.length === 0) {
    return (
      <div className="mb-8">
        <h2 className="text-base font-semibold font-display text-text-primary mb-3">Your Routes</h2>
        <div className="rounded-xl p-8 text-center bg-surface-card border border-border-subtle">
          <Plane className="w-6 h-6 text-text-muted/20 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-text-muted leading-relaxed max-w-xs mx-auto">
            Start searching flights to see personalized route suggestions here.
          </p>
        </div>
      </div>
    );
  }

  const seen = new Set<string>();
  const routes = flightSearches
    .filter((f) => {
      const key = `${f.origin}-${f.destination}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold font-display text-text-primary">Your Recent Routes</h2>
        <span className="text-[10px] text-text-muted">From your searches</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {routes.map((r) => (
          <Link
            key={`${r.origin}-${r.destination}`}
            href="/flights"
            className="bg-surface-card border border-border-subtle rounded-xl p-4 transition-all hover:border-border-default group"
          >
            <div className="flex items-center gap-2 mb-1">
              <Plane className="w-4 h-4 text-accent shrink-0" strokeWidth={1.6} />
              <span className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">
                {r.origin} → {r.destination}
              </span>
            </div>
            {r.cheapestPrice ? (
              <p className="text-[11px] text-text-muted">From ${r.cheapestPrice}</p>
            ) : (
              <p className="text-[11px] text-text-muted">Searched {new Date(r.at).toLocaleDateString()}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Dashboard Stats ── */

function DashboardStats() {
  const { totalSaved, searchesCount, dealsFound, events } = useSavingsStore();

  const stats = [
    {
      label: 'Total Saved',
      value: totalSaved > 0 ? `$${Math.round(totalSaved).toLocaleString()}` : '$0',
      sub: totalSaved > 0 ? `across ${events.length} bookings` : 'Book to start saving',
      color: '#10B981',
      icon: TrendingUp,
    },
    {
      label: 'Searches',
      value: searchesCount.toLocaleString(),
      sub: 'Flight lookups',
      color: '#E8A317',
      icon: Search,
    },
    {
      label: 'Deals Found',
      value: dealsFound.toLocaleString(),
      sub: 'Live offers seen',
      color: '#8B5CF6',
      icon: Star,
    },
    {
      label: 'Best Save',
      value: events.length > 0
        ? `$${Math.round(Math.max(...events.map((e) => e.amountSaved)))}`
        : '--',
      sub: events.length > 0
        ? events.reduce((best, e) => (e.amountSaved > best.amountSaved ? e : best), events[0]).route
        : 'No saves yet',
      color: '#EF4444',
      icon: Zap,
    },
  ];

  return (
    <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-2">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            className="bg-surface-card border border-border-subtle rounded-2xl p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${s.color}10`, color: s.color }}
              >
                <Icon className="w-[14px] h-[14px]" strokeWidth={2} />
              </div>
              <span className="text-[10px] uppercase tracking-[0.08em] text-text-muted font-medium">
                {s.label}
              </span>
            </div>
            <p className="text-xl font-bold font-display text-text-primary">{s.value}</p>
            <p className="text-[11px] text-text-muted mt-0.5 truncate">{s.sub}</p>
          </div>
        );
      })}
    </div>
  );
}

/* ── Travel Stats ── */

function getWeekLabel(weeksAgo: number): string {
  if (weeksAgo === 0) return 'This week';
  if (weeksAgo === 1) return 'Last week';
  return `${weeksAgo}w ago`;
}

function TravelStats({ recent }: { recent: RecentSearch[] }) {
  const { searchesCount, dealsFound, totalSaved } = useSavingsStore();
  const { currentStreak } = useStreakStore();

  const now = Date.now();
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const weekBuckets = [0, 0, 0, 0];
  for (const r of recent) {
    const weeksAgo = Math.floor((now - r.at) / WEEK_MS);
    if (weeksAgo >= 0 && weeksAgo < 4) {
      weekBuckets[3 - weeksAgo] += 1;
    }
  }
  const maxBucket = Math.max(...weekBuckets, 1);

  const destCounts: Record<string, number> = {};
  for (const r of recent) {
    const dest = r.destination;
    if (dest) destCounts[dest] = (destCounts[dest] || 0) + 1;
  }
  const topDests = Object.entries(destCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const prices = recent
    .filter((r) => r.cheapestPrice != null)
    .map((r) => r.cheapestPrice as number);
  const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;
  const bestDeal = prices.length > 0 ? Math.min(...prices) : null;

  if (recent.length === 0) return null;

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold font-display text-text-primary">Your Travel Insights</h2>
        <span className="text-[11px] text-text-muted">Based on your activity</span>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {[
          { label: 'Total Searches', value: searchesCount.toLocaleString(), color: '#E8A317', icon: Search },
          { label: 'Deals Found', value: dealsFound.toLocaleString(), color: '#8B5CF6', icon: Star },
          { label: 'Total Saved', value: totalSaved > 0 ? `$${Math.round(totalSaved).toLocaleString()}` : '$0', color: '#10B981', icon: TrendingUp },
          { label: 'Current Streak', value: `${currentStreak} day${currentStreak !== 1 ? 's' : ''}`, color: '#EF4444', icon: Zap },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} padding="sm" className="!p-4">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${s.color}10`, color: s.color }}
                >
                  <Icon className="w-[14px] h-[14px]" strokeWidth={2} />
                </div>
                <span className="text-[10px] uppercase tracking-[0.08em] text-text-muted font-medium">
                  {s.label}
                </span>
              </div>
              <p className="text-xl font-bold font-display text-text-primary">{s.value}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Search Activity */}
        <Card padding="md">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-accent/10 text-accent">
              <BarChart3 className="w-[14px] h-[14px]" strokeWidth={2} />
            </div>
            <h3 className="text-sm font-semibold text-text-primary">Search Activity</h3>
          </div>
          <div className="flex items-end gap-2 h-28">
            {weekBuckets.map((count, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-text-muted font-medium">{count}</span>
                <div
                  className="w-full rounded-t-md transition-all"
                  style={{
                    height: `${Math.max((count / maxBucket) * 100, 4)}%`,
                    background: `linear-gradient(to top, var(--flyeas-accent), var(--flyeas-accent-light))`,
                    opacity: count > 0 ? 1 : 0.15,
                  }}
                />
                <span className="text-[9px] text-text-muted/60">{getWeekLabel(3 - i)}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Top Destinations */}
        <Card padding="md">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-500">
              <MapPin className="w-[14px] h-[14px]" strokeWidth={2} />
            </div>
            <h3 className="text-sm font-semibold text-text-primary">Top Destinations</h3>
          </div>

          {topDests.length > 0 ? (
            <div className="space-y-2.5 mb-4">
              {topDests.map(([dest, count], i) => (
                <div key={dest} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded"
                      style={{
                        background: i === 0 ? 'rgba(232,163,23,0.12)' : 'rgba(255,255,255,0.04)',
                        color: i === 0 ? '#E8A317' : 'rgba(255,255,255,0.35)',
                      }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-sm text-text-secondary">{dest}</span>
                  </div>
                  <span className="text-[11px] text-text-muted">{count} search{count !== 1 ? 'es' : ''}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted mb-4">Start exploring to see your top destinations here</p>
          )}

          <div className="flex gap-4 pt-3 border-t border-border-subtle">
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-[0.08em] text-text-muted mb-0.5">Avg Price</p>
              <p className="text-sm font-semibold text-text-primary">
                {avgPrice != null ? `$${avgPrice}` : '--'}
              </p>
            </div>
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-[0.08em] text-text-muted mb-0.5">Best Deal</p>
              <p className="text-sm font-semibold text-emerald-400">
                {bestDeal != null ? `$${bestDeal}` : '--'}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
