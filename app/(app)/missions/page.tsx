'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Mission } from '@/lib/types';
import { useLocale } from '@/lib/i18n';
import { MissionCard } from '@/components/missions/mission-card';
import { ArrowRight, Plus } from 'lucide-react';

/**
 * Missions — every mandate the user has handed us, active first.
 * Active missions get full cards; settled ones (completed/cancelled/
 * expired) collapse into a quiet history section below.
 */

const ACTIVE = new Set(['monitoring', 'proposal_pending', 'awaiting_payment', 'booked', 'draft']);

export default function MissionsPage() {
  const { t } = useLocale();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMissions = useCallback(async () => {
    try {
      const res = await fetch('/api/missions/list', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.missions)) {
          setMissions(data.missions);
          setError(null);
          return;
        }
      }
      setMissions([]);
    } catch (err: any) {
      setError(err?.message || 'Failed to load missions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMissions();
  }, [fetchMissions]);

  const { active, settled } = useMemo(() => {
    const a: Mission[] = [];
    const s: Mission[] = [];
    for (const m of missions) (ACTIVE.has(m.status) ? a : s).push(m);
    return { active: a, settled: s };
  }, [missions]);

  return (
    <div className="py-2">
      <div className="mx-auto max-w-content">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="editorial text-[28px] leading-tight text-pen-1">{t('sidebar.missions')}</h1>
            <p className="text-body text-pen-2 mt-1">{t('missions.tagline')}</p>
          </div>
          <Link
            href="/missions/new"
            className="premium-button inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-body font-semibold shrink-0"
          >
            <Plus className="w-4 h-4" strokeWidth={2.2} />
            {t('nav.newMission')}
          </Link>
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 rounded-lg flyeas-shimmer border border-line-1" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg p-4 bg-danger-soft border border-danger/25 text-body text-danger">
            {error}
          </div>
        )}

        {/* Active missions */}
        {!loading && active.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {active.map((m) => (
              <MissionCard key={m.id} mission={m} />
            ))}
          </div>
        )}

        {/* Settled history */}
        {!loading && settled.length > 0 && (
          <section className="mt-10">
            <h2 className="text-body font-medium text-pen-2 mb-3">{t('missions.history')}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {settled.map((m) => (
                <MissionCard key={m.id} mission={m} />
              ))}
            </div>
          </section>
        )}

        {/* Empty state — an invitation, not a void */}
        {!loading && missions.length === 0 && !error && (
          <div className="rounded-lg border border-line-1 bg-ink-800 px-6 py-14 sm:py-20 text-center shadow-elev-1 max-w-xl mx-auto">
            <h2 className="editorial text-[26px] text-pen-1 leading-tight">
              {t('home.missions.emptyTitle')}
            </h2>
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
        )}
      </div>
    </div>
  );
}
