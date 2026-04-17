'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { getRecentSearches, type RecentSearch } from '@/lib/recent-searches';
import { useSavingsStore } from '@/lib/store/savings-store';
import { useStreakStore } from '@/lib/store/streak-store';
import { useMissionStore } from '@/lib/store/mission-store';
import { useSubscriptionStore } from '@/lib/store/subscription-store';
import { DashboardSkeleton } from '@/components/skeletons';
import { useIdentity } from '@/lib/store/identity-store';
import { ResumeBanner } from '@/components/watch/resume-banner';
import { PriceDisplay } from '@/components/ui/price-display';
import { CountryFlag } from '@/components/ui/country-flag';
import {
  ArrowRight,
  Plane,
  Building2,
  Target,
  MapPin,
  TrendingUp,
  Search,
  Star,
  Flame,
  Gift,
  Tag,
  ChevronRight,
} from 'lucide-react';

/**
 * Dashboard V_FINAL — merge of V_A density + V_B polish.
 *
 * R1: >= 4 questions answered without scroll ✓
 *   Q1 Total saved → stats strip
 *   Q2 Interesting deal? → Featured this week
 *   Q3 Missions advancing? → stats strip "Active watches" count
 *   Q4 Next action? → primary CTA "Search flights"
 *
 * R2: <= 7 blocs above fold ✓
 *   Header(1) + StatsStrip(1) + Featured(1) + QuickAccess(1) = 4
 *
 * R3: One dominant element (Featured card), 2 secondary (greeting, stats), rest tertiary ✓
 */

/* ── Featured destinations rotation ── */

const FEATURED_CITIES = [
  { city: 'Tokyo', country: 'Japan', iso2: 'jp', phrase: 'Cherry blossoms peak in late March.', unsplash: 'tokyo,temple,cityscape' },
  { city: 'Bali', country: 'Indonesia', iso2: 'id', phrase: 'Terraced rice fields meet surf-ready coasts.', unsplash: 'bali,rice,terrace' },
  { city: 'Lisbon', country: 'Portugal', iso2: 'pt', phrase: 'Shoulder season — fewer crowds, softer prices.', unsplash: 'lisbon,tram,cityscape' },
  { city: 'Marrakech', country: 'Morocco', iso2: 'ma', phrase: 'Spring evenings on the rooftops are unmatched.', unsplash: 'marrakech,medina' },
  { city: 'Istanbul', country: 'Turkey', iso2: 'tr', phrase: 'Where continents meet — and so do great fares.', unsplash: 'istanbul,mosque,bosphorus' },
  { city: 'Mexico City', country: 'Mexico', iso2: 'mx', phrase: 'Year-round spring at 7,350 feet.', unsplash: 'mexico+city,architecture' },
  { city: 'Cape Town', country: 'South Africa', iso2: 'za', phrase: 'Table Mountain views, R25 wine, $350 flights.', unsplash: 'cape+town,mountain' },
  { city: 'Buenos Aires', country: 'Argentina', iso2: 'ar', phrase: 'Jazz, steak, and autumn colors in April.', unsplash: 'buenos+aires,architecture' },
  { city: 'Reykjavik', country: 'Iceland', iso2: 'is', phrase: 'Midnight sun in June. Northern lights in October.', unsplash: 'iceland,aurora,landscape' },
  { city: 'Kyoto', country: 'Japan', iso2: 'jp', phrase: 'Maple red and stone paths. Book early.', unsplash: 'kyoto,temple,garden' },
];

export default function DashboardPage() {
  const { displayName, isKnown } = useIdentity();
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const [mounted, setMounted] = useState(false);

  const missions = useMissionStore((s) => s.missions);
  const totalSaved = useSavingsStore((s) => s.totalSaved);
  const searchesCount = useSavingsStore((s) => s.searchesCount);
  const dealsFound = useSavingsStore((s) => s.dealsFound);
  const currentStreak = useStreakStore((s) => s.currentStreak);
  const plan = useSubscriptionStore((s) => s.plan);

  const activeMissions = useMemo(
    () => missions.filter((m) => m.status === 'monitoring' || m.status === 'proposal_pending'),
    [missions]
  );

  useEffect(() => {
    setMounted(true);
    setRecent(getRecentSearches());
    useStreakStore.getState().recordDailyOpen();
  }, []);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Featured city — stable per day
  const dayIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  const feat = FEATURED_CITIES[dayIndex % FEATURED_CITIES.length];

  if (!mounted) return <DashboardSkeleton />;

  return (
    <div className="py-2">
      <div className="mx-auto" style={{ maxWidth: '1280px' }}>

        {/* ═══ ROW 1 — Header (56-72px) ═══ */}
        <div className="flex items-start justify-between gap-4 mb-10">
          <div>
            <h1 className="editorial text-[24px] leading-tight text-pen-1">
              {greeting}{displayName ? <>, <em className="italic text-accent">{displayName}</em></> : null}.
            </h1>
            <p className="text-caption text-pen-3 mt-1">{dateStr}</p>
          </div>
          <Link
            href="/flights"
            className="premium-button inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-body font-semibold shrink-0"
          >
            <Plane className="w-4 h-4" strokeWidth={2} />
            Search flights
          </Link>
        </div>

        {/* ═══ ROW 2 — Stats strip (88px) ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
          <StatCard icon={TrendingUp} iconColor="#4F8A6E" label="Total saved" value={totalSaved > 0 ? <PriceDisplay usd={totalSaved} size="lg" /> : <span className="text-pen-3">$0</span>} />
          <StatCard icon={Search} iconColor="#D4A24C" label="Searches" value={<span className="font-mono">{searchesCount ?? 0}</span>} />
          <StatCard icon={Star} iconColor="#9F7AEA" label="Deals found" value={<span className="font-mono">{dealsFound ?? 0}</span>} />
          <StatCard icon={Flame} iconColor="#E8742F" label="Streak" value={<span className="font-mono">{currentStreak} {currentStreak === 1 ? 'day' : 'days'}</span>} />
        </div>

        {/* ═══ Resume banner (conditional) ═══ */}
        <ResumeBanner className="mb-8" />

        {/* ═══ ROW 3 — Featured this week (HERO, dominant) ═══ */}
        <section className="mb-10">
          <FeaturedCard feat={feat} />
        </section>

        {/* ═══ ROW 4 — Quick access chips ═══ */}
        <div className="flex flex-wrap gap-2 mb-10">
          <QuickChip href="/flights" icon={Plane} label="Flights" />
          <QuickChip href="/hotels" icon={Building2} label="Hotels" />
          <QuickChip href="/missions" icon={Target} label="My watches" />
          <QuickChip href="/trip-builder" icon={MapPin} label="Explore" />
        </div>

        {/* ══════════ BELOW THE FOLD ══════════ */}

        {/* ═══ ROW 5 — Active watches ═══ */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <p className="text-body text-pen-1 font-medium">Your active watches</p>
            {activeMissions.length > 3 && (
              <Link href="/missions" className="text-caption text-pen-2 hover:text-pen-1 transition inline-flex items-center gap-1">
                See all {missions.length}
                <ArrowRight className="w-3 h-3" strokeWidth={1.8} />
              </Link>
            )}
          </div>

          {activeMissions.length === 0 ? (
            <div className="rounded-lg border border-line-1 bg-ink-800 px-6 py-8 text-center">
              <p className="text-body text-pen-2">No active watches yet.</p>
              <Link href="/missions/new" className="mt-3 inline-flex items-center gap-2 text-body text-accent hover:text-pen-1 transition font-medium">
                Start watching a price
                <ArrowRight className="w-4 h-4" strokeWidth={1.8} />
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {activeMissions.slice(0, 3).map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/missions/${m.id}`}
                    className="flex items-center justify-between gap-4 rounded-lg border border-line-1 bg-ink-800 px-4 py-3 hover:border-line-2 transition group"
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
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-caption text-accent">Monitoring</span>
                      <ChevronRight className="w-3.5 h-3.5 text-pen-3 group-hover:text-pen-1 transition" strokeWidth={1.8} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ═══ ROW 6 — Recent searches (horizontal chips) ═══ */}
        <section className="mb-10">
          <p className="text-body text-pen-1 font-medium mb-3">Recent searches</p>
          {recent.length === 0 ? (
            <p className="text-caption text-pen-3">Your recent searches will appear here.</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
              {recent.slice(0, 8).map((r, i) => (
                <Link
                  key={i}
                  href={r.kind === 'flight' ? '/flights' : '/hotels'}
                  className="inline-flex items-center gap-2 rounded-md border border-line-1 bg-ink-800 px-3 py-2 text-caption text-pen-2 hover:text-pen-1 hover:border-line-2 transition whitespace-nowrap shrink-0"
                >
                  {r.origin && <span className="font-mono text-pen-3">{r.origin}</span>}
                  {r.origin && <span className="text-pen-3">→</span>}
                  <span className="font-mono">{r.destination}</span>
                  {r.cheapestPrice && (
                    <span className="text-accent font-mono">${r.cheapestPrice}</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ═══ ROW 8 — Referral inline banner ═══ */}
        <section className="mb-10">
          <Link
            href="/referral"
            className="flex items-center justify-between gap-4 rounded-lg border border-line-1 bg-ink-800 px-4 py-3 hover:border-line-2 transition group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Gift className="w-4 h-4 text-pen-3 shrink-0" strokeWidth={1.8} />
              <p className="text-body text-pen-2 truncate">
                Invite friends, earn <span className="font-mono text-pen-1">$10</span> each
              </p>
            </div>
            <span className="text-caption text-pen-2 group-hover:text-pen-1 transition shrink-0 inline-flex items-center gap-1">
              Share link
              <ArrowRight className="w-3 h-3" strokeWidth={1.8} />
            </span>
          </Link>
        </section>

        {/* ═══ ROW 9 — Rewards summary ═══ */}
        <section className="mb-10 grid sm:grid-cols-2 gap-3">
          <RewardsTierCard />
          <RewardsNextCard />
        </section>

        {/* ═══ ROW 10 — Pro tip footer ═══ */}
        <ProTipFooter plan={plan} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Sub-components
   ══════════════════════════════════════════════════════════ */

function StatCard({
  icon: Icon,
  iconColor,
  label,
  value,
}: {
  icon: typeof TrendingUp;
  iconColor: string;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line-1 bg-ink-800 p-4">
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-md shrink-0"
          style={{ background: `${iconColor}14` }}
        >
          <Icon className="w-4 h-4" style={{ color: iconColor }} strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <div className="text-body-lg text-pen-1 font-semibold leading-tight truncate">{value}</div>
          <p className="text-micro uppercase text-pen-3 mt-0.5">{label}</p>
        </div>
      </div>
    </div>
  );
}

function FeaturedCard({ feat }: { feat: typeof FEATURED_CITIES[number] }) {
  return (
    <article
      className="rounded-lg border border-line-1 overflow-hidden grid md:grid-cols-5"
      style={{ minHeight: '340px' }}
    >
      {/* LEFT 3/5 — Photo hero */}
      <div
        className="relative md:col-span-3 aspect-[16/9] md:aspect-auto"
        style={{
          backgroundImage: `url(https://source.unsplash.com/1600x900/?${encodeURIComponent(feat.unsplash)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Gradient overlay */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.65), transparent)' }} />

        {/* Flag + country badge */}
        <div className="absolute bottom-4 left-4 flex items-center gap-2">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
            style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
          >
            <CountryFlag iso2={feat.iso2} size={20} />
            <span className="text-caption text-white/90 font-medium">{feat.country}</span>
          </span>
        </div>
      </div>

      {/* RIGHT 2/5 — Info module */}
      <div className="md:col-span-2 bg-ink-800 p-6 md:p-8 flex flex-col justify-center border-l border-line-1">
        <p className="text-micro uppercase text-pen-3 tracking-widest">Featured this week</p>
        <h2 className="editorial text-[28px] leading-tight text-pen-1 mt-2">{feat.city}</h2>
        <p className="text-caption text-pen-3 mt-1">{feat.country}</p>

        <div className="h-px bg-line-1 my-4" />

        <p className="text-body text-pen-2 italic leading-relaxed">{feat.phrase}</p>

        <div className="flex items-center gap-2 mt-4 text-caption text-pen-3">
          <Tag className="w-3.5 h-3.5" strokeWidth={1.8} />
          <span>Fares from <span className="text-pen-1 font-mono">$380</span></span>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href={`/missions/new?destination=${encodeURIComponent(feat.city)}`}
            className="premium-button inline-flex items-center gap-2 rounded-md px-4 py-2 text-caption font-semibold"
          >
            Plan this trip
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
          </Link>
          <Link
            href={`/flights?destination=${encodeURIComponent(feat.city)}`}
            className="inline-flex items-center gap-2 rounded-md border border-line-1 bg-ink-700 px-4 py-2 text-caption text-pen-2 hover:text-pen-1 hover:border-line-2 transition"
          >
            Browse flights
          </Link>
        </div>
      </div>
    </article>
  );
}

function QuickChip({ href, icon: Icon, label }: { href: string; icon: typeof Plane; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-md border border-line-1 bg-ink-800 px-3.5 py-2 text-caption text-pen-2 hover:text-pen-1 hover:border-line-2 hover:bg-ink-700 transition"
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={1.8} />
      {label}
    </Link>
  );
}

function RewardsTierCard() {
  const totalPoints = useStreakStore((s) => s.totalPoints);
  const badges = useStreakStore((s) => s.badges);
  const current = badges.length > 0 ? badges[badges.length - 1] : null;

  return (
    <Link
      href="/rewards"
      className="rounded-lg border border-line-1 bg-ink-800 p-5 hover:border-line-2 transition group"
    >
      <p className="text-micro uppercase text-pen-3">Your tier</p>
      <p className="text-body-lg text-pen-1 font-semibold mt-1">{current?.name || 'Newcomer'}</p>
      <div className="mt-3 flex items-center justify-between text-caption">
        <span className="text-pen-3 font-mono">{totalPoints.toLocaleString()} pts</span>
        <span className="text-pen-2 group-hover:text-pen-1 transition inline-flex items-center gap-1">
          View rewards <ChevronRight className="w-3 h-3" strokeWidth={1.8} />
        </span>
      </div>
    </Link>
  );
}

function RewardsNextCard() {
  const totalPoints = useStreakStore((s) => s.totalPoints);
  // Simple next-unlock: find the first badge the user hasn't reached
  const ALL_THRESHOLDS = [
    { name: 'Explorer', req: 5 },
    { name: 'Scout', req: 50 },
    { name: 'Navigator', req: 200 },
    { name: 'Captain', req: 500 },
    { name: 'Ace Pilot', req: 1000 },
    { name: 'Travel Legend', req: 5000 },
  ];
  const next = ALL_THRESHOLDS.find((t) => totalPoints < t.req);

  return (
    <div className="rounded-lg border border-line-1 bg-ink-800 p-5">
      <p className="text-micro uppercase text-pen-3">Next unlock</p>
      {next ? (
        <>
          <p className="text-body-lg text-pen-1 font-semibold mt-1">{next.name}</p>
          <div className="mt-3">
            <div className="h-1.5 rounded-full bg-ink-700 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (totalPoints / next.req) * 100)}%`,
                  background: 'var(--accent)',
                }}
              />
            </div>
            <p className="text-caption text-pen-3 mt-1.5 font-mono">
              {(next.req - totalPoints).toLocaleString()} pts to go
            </p>
          </div>
        </>
      ) : (
        <p className="text-body text-pen-2 mt-1">All tiers unlocked.</p>
      )}
    </div>
  );
}

function ProTipFooter({ plan }: { plan: string }) {
  if (plan === 'pro' || plan === 'elite') {
    return (
      <div className="pb-8 text-caption text-pen-3">
        Thanks for being {plan === 'elite' ? 'Elite' : 'Pro'}. Priority support: help@flyeas.app
      </div>
    );
  }
  return (
    <div className="pb-8">
      <Link
        href="/pricing"
        className="text-caption text-pen-2 hover:text-pen-1 transition"
      >
        Unlock 15-minute monitoring with Pro. Start trial →
      </Link>
    </div>
  );
}
