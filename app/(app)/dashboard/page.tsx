'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import type { Mission } from '@/lib/types';
import { useIdentity } from '@/lib/store/identity-store';
import { useStreakStore } from '@/lib/store/streak-store';
import { useLocale } from '@/lib/i18n';
import { DashboardSkeleton } from '@/components/skeletons';
import { MissionCard } from '@/components/missions/mission-card';
import { ResumeBanner } from '@/components/watch/resume-banner';
import { CountryFlag } from '@/components/ui/country-flag';
import { ArrowRight, Plus, Tag } from 'lucide-react';

/**
 * Home — missions-first.
 *
 * Answers ONE question the moment it opens: "is Flyeas working for me?"
 *   1. Greeting — human, editorial.
 *   2. Your missions — the product, front and center. Empty state is the
 *      single most important screen for a new user: an invitation, not a void.
 *   3. Inspiration — one featured destination that starts a mission.
 *
 * Search boxes, quick links to flights/hotels, gamification widgets:
 * intentionally gone. The Home has one job.
 */

const FEATURED_CITIES = [
  { city: 'Tokyo', country: 'Japan', iso2: 'jp', phrase: 'Cherry blossoms peak in late March.', unsplash: 'tokyo,temple,cityscape', from: 720 },
  { city: 'Bali', country: 'Indonesia', iso2: 'id', phrase: 'Terraced rice fields meet surf-ready coasts.', unsplash: 'bali,rice,terrace', from: 640 },
  { city: 'Lisbon', country: 'Portugal', iso2: 'pt', phrase: 'Shoulder season — fewer crowds, softer prices.', unsplash: 'lisbon,tram,cityscape', from: 320 },
  { city: 'Marrakech', country: 'Morocco', iso2: 'ma', phrase: 'Spring evenings on the rooftops are unmatched.', unsplash: 'marrakech,medina', from: 210 },
  { city: 'Istanbul', country: 'Turkey', iso2: 'tr', phrase: 'Where continents meet — and so do great fares.', unsplash: 'istanbul,mosque,bosphorus', from: 280 },
  { city: 'Mexico City', country: 'Mexico', iso2: 'mx', phrase: 'Year-round spring at 7,350 feet.', unsplash: 'mexico+city,architecture', from: 420 },
  { city: 'Cape Town', country: 'South Africa', iso2: 'za', phrase: 'Table Mountain views and winter-sun fares.', unsplash: 'cape+town,mountain', from: 550 },
  { city: 'Buenos Aires', country: 'Argentina', iso2: 'ar', phrase: 'Jazz, steak, and autumn colors in April.', unsplash: 'buenos+aires,architecture', from: 690 },
  { city: 'Reykjavik', country: 'Iceland', iso2: 'is', phrase: 'Midnight sun in June. Northern lights in October.', unsplash: 'iceland,aurora,landscape', from: 380 },
  { city: 'Kyoto', country: 'Japan', iso2: 'jp', phrase: 'Maple red and stone paths. Book early.', unsplash: 'kyoto,temple,garden', from: 740 },
];

const ACTIVE_STATUSES = new Set(['monitoring', 'proposal_pending', 'awaiting_payment', 'booked']);

export default function HomePage() {
  const { displayName } = useIdentity();
  const { t } = useLocale();
  const [mounted, setMounted] = useState(false);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loadingMissions, setLoadingMissions] = useState(true);

  const fetchMissions = useCallback(async () => {
    try {
      const res = await fetch('/api/missions/list', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.missions)) {
          setMissions(data.missions);
        }
      }
    } catch {
      // Missions block silently degrades to the empty state
    } finally {
      setLoadingMissions(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchMissions();
    useStreakStore.getState().recordDailyOpen();
  }, [fetchMissions]);

  const active = missions.filter((m) => ACTIVE_STATUSES.has(m.status));

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const dayIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  const feat = FEATURED_CITIES[dayIndex % FEATURED_CITIES.length];

  if (!mounted) return <DashboardSkeleton />;

  return (
    <div className="py-2">
      <div className="mx-auto max-w-content">

        {/* ═══ Greeting ═══ */}
        <div className="mb-8 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="editorial text-[24px] sm:text-[28px] leading-tight text-pen-1 truncate">
              {greeting}
              {displayName ? <>, <em className="italic text-accent">{displayName}</em></> : null}.
            </h1>
            <p className="text-caption text-pen-3 mt-1">{dateStr}</p>
          </div>
          <Link
            href="/missions/new"
            className="premium-button inline-flex items-center gap-2 rounded-md px-3 sm:px-4 py-2 sm:py-2.5 text-caption sm:text-body font-semibold shrink-0 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" strokeWidth={2.2} />
            {t('nav.newMission')}
          </Link>
        </div>

        {/* ═══ Resume an unfinished draft ═══ */}
        <ResumeBanner className="mb-8" />

        {/* ═══ Your missions — the product ═══ */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-body-lg font-semibold text-pen-1">{t('home.missions.title')}</h2>
            {active.length > 0 && (
              <Link
                href="/missions"
                className="text-caption text-pen-2 hover:text-pen-1 transition inline-flex items-center gap-1"
              >
                {t('home.missions.all')}
                <ArrowRight className="w-3 h-3" strokeWidth={1.8} />
              </Link>
            )}
          </div>

          {loadingMissions ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-48 rounded-lg flyeas-shimmer border border-line-1" />
              ))}
            </div>
          ) : active.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {active.slice(0, 4).map((m) => (
                <MissionCard key={m.id} mission={m} />
              ))}
            </div>
          ) : (
            <EmptyMissions t={t} />
          )}
        </section>

        {/* ═══ Inspiration — one idea, not a catalog ═══ */}
        <section className="mb-12">
          <h2 className="text-body-lg font-semibold text-pen-1 mb-4">{t('home.inspiration')}</h2>
          <FeaturedCard feat={feat} />
        </section>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Sub-components
   ══════════════════════════════════════════════════════════ */

function EmptyMissions({ t }: { t: (k: string) => string }) {
  return (
    <div className="rounded-lg border border-line-1 bg-ink-800 px-6 py-12 sm:py-16 text-center shadow-elev-1">
      <h3 className="editorial text-[26px] sm:text-[30px] text-pen-1 leading-tight">
        {t('home.missions.emptyTitle')}
      </h3>
      <p className="text-body text-pen-2 mt-3 max-w-md mx-auto leading-relaxed">
        {t('home.missions.emptyBody')}
      </p>
      <Link
        href="/missions/new"
        className="premium-button inline-flex items-center gap-2 rounded-md px-6 py-3 text-body font-semibold mt-7"
      >
        {t('home.missions.emptyCta')}
        <ArrowRight className="w-4 h-4" strokeWidth={2} />
      </Link>
    </div>
  );
}

function FeaturedCard({ feat }: { feat: (typeof FEATURED_CITIES)[number] }) {
  return (
    <article className="rounded-lg border border-line-1 overflow-hidden grid md:grid-cols-5 shadow-elev-1">
      {/* Editorial panel — typographic, no external image dependency */}
      <div className="relative md:col-span-3 aspect-[16/9] md:aspect-auto md:min-h-[300px] bg-ink-600 overflow-hidden flex items-center justify-center">
        <span
          aria-hidden
          className="editorial select-none text-pen-3 leading-none text-[120px] md:text-[180px] tracking-tight"
          style={{ opacity: 0.3 }}
        >
          {feat.city.slice(0, 2)}
        </span>
        <div className="absolute bottom-4 left-4">
          <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 bg-ink-950/80 border border-line-1">
            <CountryFlag iso2={feat.iso2} size={18} />
            <span className="text-caption text-pen-1 font-medium">{feat.country}</span>
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="md:col-span-2 bg-ink-800 p-5 md:p-8 flex flex-col justify-center md:border-l border-t md:border-t-0 border-line-1">
        <p className="text-micro uppercase text-pen-3 tracking-widest">Featured this week</p>
        <h3 className="editorial text-[28px] leading-tight text-pen-1 mt-2">{feat.city}</h3>
        <p className="text-caption text-pen-3 mt-1">{feat.country}</p>

        <div className="h-px bg-line-1 my-4" />

        <p className="text-body text-pen-2 italic leading-relaxed">{feat.phrase}</p>

        <div className="flex items-center gap-2 mt-4 text-caption text-pen-3">
          <Tag className="w-3.5 h-3.5" strokeWidth={1.8} />
          <span>
            Fares from <span className="num text-pen-1">${feat.from}</span>
          </span>
        </div>

        <div className="mt-6">
          <Link
            href={`/missions/new?destination=${encodeURIComponent(feat.city)}`}
            className="premium-button inline-flex items-center gap-2 rounded-md px-4 py-2 text-caption font-semibold"
          >
            Start a mission to {feat.city}
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
          </Link>
        </div>
      </div>
    </article>
  );
}
