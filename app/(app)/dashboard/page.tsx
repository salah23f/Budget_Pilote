'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { getRecentSearches, type RecentSearch } from '@/lib/recent-searches';
import { useSavingsStore } from '@/lib/store/savings-store';
import { useStreakStore } from '@/lib/store/streak-store';
import { useMissionStore } from '@/lib/store/mission-store';
import { DashboardSkeleton } from '@/components/skeletons';
import { useIdentity } from '@/lib/store/identity-store';
import { ResumeBanner } from '@/components/watch/resume-banner';
import { PriceDisplay } from '@/components/ui/price-display';
import { ArrowRight, Plane, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Dashboard — 4 calm modules, nothing more.
 *
 * 1. Greeting + one-sentence status + 2 CTAs
 * 2. Resume banner (conditional)
 * 3. "What you're watching" (compact list, 3 rows max)
 * 4. "This week for you" (one featured destination)
 * 5. Travel insights (collapsed by default, togglable)
 *
 * That's it. No radar, no gauge, no world map, no stats grid, no
 * quick actions tiles, no separate referral widget, no week strip on
 * the first screen. They still exist in the codebase — they belong
 * on dedicated pages, not the home view.
 */

/* ── Featured destinations (weekly rotation, not random) ── */

const FEATURES = [
  { city: 'Lisbon', country: 'Portugal', copy: 'Mild winters, golden light, pastéis de nata, and direct flights under $140.', initial: 'L' },
  { city: 'Kyoto', country: 'Japan', copy: 'Maple red and stone paths. Best booked 3+ months ahead.', initial: 'K' },
  { city: 'Marrakech', country: 'Morocco', copy: 'Orange blossom in the air. March and April are the sweet spot.', initial: 'M' },
  { city: 'Buenos Aires', country: 'Argentina', copy: 'Jazz, steak, and autumn colors in April. Fares from $380.', initial: 'B' },
];

export default function DashboardPage() {
  const { displayName } = useIdentity();
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const [mounted, setMounted] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);

  const missions = useMissionStore((s) => s.missions);
  const totalSaved = useSavingsStore((s) => s.totalSaved);
  const currentStreak = useStreakStore((s) => s.currentStreak);

  const activeMissions = useMemo(
    () => missions.filter((m) => m.status === 'monitoring' || m.status === 'proposal_pending'),
    [missions]
  );

  useEffect(() => {
    setMounted(true);
    setRecent(getRecentSearches());
    // Record daily open for streak
    useStreakStore.getState().recordDailyOpen();
  }, []);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Status line — one sentence about what's happening
  const statusLine = useMemo(() => {
    const parts: string[] = [];
    if (activeMissions.length > 0) {
      parts.push(`watching ${activeMissions.length} ${activeMissions.length === 1 ? 'trip' : 'trips'}`);
    }
    if (totalSaved > 0) {
      parts.push(`saved $${Math.round(totalSaved)} lifetime`);
    }
    if (currentStreak > 1) {
      parts.push(`${currentStreak}-day streak`);
    }
    if (parts.length === 0) return 'Your travel concierge is ready.';
    return parts.join(' · ') + '.';
  }, [activeMissions.length, totalSaved, currentStreak]);

  // Featured destination (stable per week)
  const weekIndex = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const featured = FEATURES[weekIndex % FEATURES.length];

  if (!mounted) return <DashboardSkeleton />;

  return (
    <div className="py-2">
      <div className="mx-auto max-w-content">
        {/* ─── Module 1: Greeting + status + CTAs ─── */}
        <section className="mb-10">
          <h1 className="editorial text-[36px] md:text-[48px] leading-[1.05] text-pen-1">
            {greeting}, <em className="italic text-accent">{displayName}</em>.
          </h1>
          <p className="mt-3 text-body text-pen-2">{statusLine}</p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/missions/new"
              className="premium-button inline-flex items-center gap-2 rounded-md px-5 py-3 text-body font-semibold"
            >
              Watch a new trip
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
            {activeMissions.length > 0 && (
              <Link
                href="/missions"
                className="inline-flex items-center gap-2 rounded-md border border-line-1 bg-ink-800 px-5 py-3 text-body text-pen-2 hover:text-pen-1 hover:border-line-2 transition"
              >
                What you're watching
              </Link>
            )}
          </div>
        </section>

        {/* ─── Module 2: Resume banner (conditional) ─── */}
        <ResumeBanner className="mb-8" />

        {/* ─── Module 3: Active watches (compact list) ─── */}
        {activeMissions.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <p className="text-micro uppercase text-pen-3">Active watches</p>
              <Link
                href="/missions"
                className="text-caption text-pen-2 hover:text-pen-1 transition inline-flex items-center gap-1"
              >
                See all
                <ArrowRight className="w-3 h-3" strokeWidth={1.8} />
              </Link>
            </div>
            <ul className="space-y-2">
              {activeMissions.slice(0, 3).map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/missions/${m.id}`}
                    className="flex items-center justify-between gap-4 rounded-lg border border-line-1 bg-ink-800 px-4 py-3 hover:border-line-2 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Plane className="w-4 h-4 text-pen-3 shrink-0" strokeWidth={1.8} />
                      <div className="min-w-0">
                        <p className="text-body text-pen-1 truncate">
                          {m.origin ?? '...'} → {m.destination ?? '...'}
                        </p>
                        <p className="text-caption text-pen-3 truncate">
                          {m.departDateFrom ? new Date(m.departDateFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                          {m.budgetCents ? ` · Target $${Math.round(m.budgetCents / 100)}` : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-caption text-accent shrink-0">Live</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ─── Module 4: Featured this week ─── */}
        <section className="mb-10">
          <article className="rounded-lg border border-line-1 overflow-hidden grid md:grid-cols-[0.4fr_0.6fr]">
            {/* Left: placeholder visual — big initial */}
            <div
              className="relative aspect-[3/2] md:aspect-auto flex items-center justify-center"
              style={{ background: 'var(--ink-900)' }}
            >
              <span
                className="editorial text-pen-3 select-none"
                style={{ fontSize: '120px', lineHeight: 1, letterSpacing: '-0.05em', opacity: 0.12, fontStyle: 'italic' }}
                aria-hidden="true"
              >
                {featured.initial}
              </span>
              <span className="absolute top-4 left-4 text-micro uppercase text-pen-3">Featured this week</span>
            </div>

            {/* Right: editorial copy */}
            <div className="p-6 md:p-8 flex flex-col justify-center bg-ink-800">
              <p className="text-micro uppercase text-pen-3">{featured.country}</p>
              <h2 className="editorial text-h1 text-pen-1 mt-2">{featured.city}</h2>
              <p className="mt-3 text-body text-pen-2 max-w-[380px] leading-relaxed">{featured.copy}</p>
              <div className="mt-5">
                <Link
                  href={`/flights?destination=${encodeURIComponent(featured.city)}`}
                  className="inline-flex items-center gap-2 text-body text-accent hover:text-pen-1 transition font-medium"
                >
                  Explore fares
                  <ArrowRight className="w-4 h-4" strokeWidth={1.8} />
                </Link>
              </div>
            </div>
          </article>
        </section>

        {/* ─── Recent searches (chips, compact) ─── */}
        {recent.length > 0 && (
          <section className="mb-10">
            <p className="text-micro uppercase text-pen-3 mb-3">Recent</p>
            <div className="flex flex-wrap gap-2">
              {recent.slice(0, 5).map((r, i) => (
                <Link
                  key={i}
                  href={r.kind === 'flight' ? '/flights' : '/hotels'}
                  className="inline-flex items-center gap-2 rounded-md border border-line-1 bg-ink-800 px-3 py-1.5 text-caption text-pen-2 hover:text-pen-1 hover:border-line-2 transition"
                >
                  {r.origin && <span className="font-mono text-pen-3">{r.origin}</span>}
                  {r.origin && <span className="text-pen-3">→</span>}
                  <span className="font-mono">{r.destination}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ─── Module 5: Travel insights (collapsed) ─── */}
        <section className="mb-10">
          <button
            type="button"
            onClick={() => setInsightsOpen(!insightsOpen)}
            className="w-full flex items-center justify-between gap-3 rounded-lg border border-line-1 bg-ink-800 px-4 py-3 text-left hover:border-line-2 transition"
          >
            <span className="text-body text-pen-2">Travel insights</span>
            {insightsOpen ? (
              <ChevronUp className="w-4 h-4 text-pen-3" strokeWidth={1.8} />
            ) : (
              <ChevronDown className="w-4 h-4 text-pen-3" strokeWidth={1.8} />
            )}
          </button>

          {insightsOpen && (
            <div className="mt-2 rounded-lg border border-line-1 bg-ink-800 p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <InsightItem label="Lifetime saved" value={totalSaved > 0 ? <PriceDisplay usd={totalSaved} size="lg" /> : <span className="text-pen-3">$0</span>} />
              <InsightItem label="Active watches" value={<span className="font-mono">{activeMissions.length}</span>} />
              <InsightItem label="Searches" value={<span className="font-mono">{recent.length}</span>} />
              <InsightItem label="Streak" value={<span className="font-mono">{currentStreak} {currentStreak === 1 ? 'day' : 'days'}</span>} />
            </div>
          )}
        </section>

        {/* ─── Footer CTA ─── */}
        <div className="pt-6 pb-8 border-t border-line-1 flex flex-wrap items-center gap-6">
          <Link href="/rewards" className="text-caption text-pen-2 hover:text-pen-1 transition">Rewards</Link>
          <Link href="/referral" className="text-caption text-pen-2 hover:text-pen-1 transition">Invite & earn</Link>
          <Link href="/settings" className="text-caption text-pen-2 hover:text-pen-1 transition">Settings</Link>
        </div>
      </div>
    </div>
  );
}

/* ── InsightItem: one stat in the collapsed panel ── */

function InsightItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-micro uppercase text-pen-3 mb-1">{label}</p>
      <div className="text-body-lg text-pen-1">{value}</div>
    </div>
  );
}
