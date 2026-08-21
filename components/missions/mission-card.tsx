'use client';

import Link from 'next/link';
import { useLocale } from '@/lib/i18n';
import type { Mission } from '@/lib/types';

/**
 * MissionCard — the product's core surface.
 *
 * Anatomy (top → bottom, descending importance):
 *   [status pill]                          — semantic, 3 tones max
 *   Destination                            — Fraunces, the emotional hook
 *   dates · travelers · budget             — context, muted
 *   ─────────
 *   Best fare (hero) + delta vs budget     — the number that matters
 *   advice line                            — what we think you should do
 *   ─────────
 *   heartbeat                              — proof we're working
 *
 * A card at rest ("Watching") carries NO call-to-action: that calm is
 * the product promise. Only opportunity/action states earn a visual pull.
 */

type StatusTone = 'neutral' | 'success' | 'warning' | 'muted';

const STATUS_TONE: Record<string, StatusTone> = {
  monitoring: 'neutral',
  proposal_pending: 'success',
  awaiting_payment: 'warning',
  booked: 'success',
  completed: 'muted',
  cancelled: 'muted',
  expired: 'muted',
  draft: 'muted',
};

const TONE_CLASSES: Record<StatusTone, { pill: string; dot: string }> = {
  neutral: { pill: 'bg-ink-600 text-pen-2', dot: 'bg-pen-3 pulse-live' },
  success: { pill: 'bg-success-soft text-success', dot: 'bg-success' },
  warning: { pill: 'bg-warning-soft text-warning', dot: 'bg-warning' },
  muted: { pill: 'bg-ink-600 text-pen-3', dot: 'bg-line-3' },
};

function formatUsd(n: number | undefined | null): string {
  if (!n && n !== 0) return '—';
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function timeAgoDuration(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '<1 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

export function MissionCard({ mission: m }: { mission: Mission }) {
  const { t } = useLocale();
  const tone = STATUS_TONE[m.status] ?? 'muted';
  const toneCls = TONE_CLASSES[tone];
  const isRestful = tone === 'muted';

  const best = m.bestSeenPrice;
  const budget = m.maxBudgetUsd;
  const delta = best != null && budget ? budget - best : null;

  const adviceKey = `mission.advice.${m.status}`;
  const advice = t(adviceKey);
  const hasAdvice = advice !== adviceKey; // t() falls back to the key itself

  return (
    <Link
      href={`/missions/${m.id}/cockpit`}
      className={`block rounded-lg border bg-ink-800 p-5 transition-all duration-default hover:border-line-2 hover:shadow-elev-2 ${
        tone === 'success' ? 'border-success/25' : tone === 'warning' ? 'border-warning/25' : 'border-line-1'
      } ${isRestful ? 'opacity-70' : ''}`}
    >
      {/* Status pill */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${toneCls.pill}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${toneCls.dot}`} />
          {t(`mission.status.${m.status}`)}
        </span>
        {m.type && m.type !== 'flight' && (
          <span className="text-[11px] text-pen-3 capitalize">{m.type}</span>
        )}
      </div>

      {/* Destination — the emotional hook */}
      <h3 className="editorial text-[22px] leading-tight text-pen-1">
        {m.destinationCity || m.destination}
        <span className="text-pen-3 text-body-lg font-sans ml-2">
          {(m.originCity || m.origin) ? `${t('mission.from')} ${m.originCity || m.origin}` : ''}
        </span>
      </h3>

      {/* Context line */}
      <p className="text-caption text-pen-3 mt-1">
        {m.departDate}
        {m.returnDate ? ` → ${m.returnDate}` : ''}
        {m.passengers ? ` · ${m.passengers} ${m.passengers > 1 ? t('mission.travelers') : t('mission.traveler')}` : ''}
        {budget ? ` · ${t('mission.budget')} ${formatUsd(budget)}` : ''}
      </p>

      <div className="h-px bg-line-1 my-3.5" />

      {/* Price hero + delta */}
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="num text-[26px] font-semibold text-pen-1 leading-none">
          {formatUsd(best)}
        </span>
        {delta != null && (
          <span className={`num text-body font-medium ${delta >= 0 ? 'text-success' : 'text-warning'}`}>
            {`${delta >= 0 ? '−' : '+'}$${Math.round(Math.abs(delta)).toLocaleString('en-US')} `}
            {delta >= 0 ? t('mission.underBudget') : t('mission.overBudget')}
          </span>
        )}
      </div>

      {/* Advice */}
      {hasAdvice && (
        <p className="text-body text-pen-2 mt-2 leading-relaxed">{advice}</p>
      )}

      {/* Heartbeat */}
      <p className="text-caption text-pen-3 mt-3.5">
        {m.lastCheckedAt
          ? t('mission.checkedAgo').replace('{t}', timeAgoDuration(m.lastCheckedAt))
          : t('mission.checkedNever')}
      </p>
    </Link>
  );
}
