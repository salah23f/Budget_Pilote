'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { useStreakStore, ALL_BADGES } from '@/lib/store/streak-store';
import { usePointsStore, formatPoints } from '@/lib/store/cashback-store';

/* ------------------------------------------------------------------ */
/*  Inline SVG icons                                                   */
/* ------------------------------------------------------------------ */

function FlameIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path
        d="M10 2C10 2 6 7 6 11C6 14 8 16 10 17C12 16 14 14 14 11C14 7 10 2 10 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.15"
      />
      <path
        d="M10 10C10 10 8.5 12 8.5 13.5C8.5 14.5 9.2 15.5 10 16C10.8 15.5 11.5 14.5 11.5 13.5C11.5 12 10 10 10 10Z"
        fill="currentColor"
        fillOpacity="0.4"
      />
    </svg>
  );
}

function StarBadgeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2L14.9 8.6L22 9.3L16.8 14L18.2 21L12 17.5L5.8 21L7.2 14L2 9.3L9.1 8.6L12 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.15"
      />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4L10 8L6 12" />
    </svg>
  );
}

/* Badge-specific mini icons for the widget */
const BADGE_MINI_ICONS: Record<string, React.FC<{ size?: number }>> = {
  explorer: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="13" cy="13" r="8" stroke="currentColor" strokeWidth="2.5" />
      <line x1="19" y1="19" x2="27" y2="27" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
  scout: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M16 4L22 18H10L16 4Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M10 18L6 28H26L22 18" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  ),
  navigator: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="2.5" />
      <polygon points="16,6 19,14 16,12 13,14" fill="currentColor" />
      <polygon points="16,26 13,18 16,20 19,18" fill="currentColor" opacity="0.5" />
    </svg>
  ),
  captain: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M2 14L12 8L16 2L20 8L30 14L24 16L28 28L16 22L4 28L8 16L2 14Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  ),
  ace: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M16 6C12 6 4 12 4 18C4 20 5 22 8 22C10 22 12 20 14 18L16 14L18 18C20 20 22 22 24 22C27 22 28 20 28 18C28 12 20 6 16 6Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  ),
  legend: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M4 24L2 10L10 16L16 6L22 16L30 10L28 24H4Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M4 24H28V27H4V24Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  ),
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function RewardsWidget() {
  const totalPoints = useStreakStore((s) => s.totalPoints);
  const currentStreak = useStreakStore((s) => s.currentStreak);
  const cashbackBalance = usePointsStore((s) => s.balance);

  const combinedPoints = totalPoints + cashbackBalance;

  const sortedBadges = [...ALL_BADGES].sort((a, b) => a.requirement - b.requirement);
  const currentLevel = sortedBadges.filter((b) => combinedPoints >= b.requirement).pop();
  const nextLevel = sortedBadges.find((b) => combinedPoints < b.requirement);

  const progressToNext = nextLevel
    ? Math.min(100, Math.round(((combinedPoints - (currentLevel?.requirement || 0)) / (nextLevel.requirement - (currentLevel?.requirement || 0))) * 100))
    : 100;

  const BadgeMiniIcon = currentLevel ? BADGE_MINI_ICONS[currentLevel.id] : null;

  return (
    <Card hoverable className="relative overflow-hidden">
      {/* Subtle gradient accent */}
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.08), transparent)' }}
      />

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: currentLevel
                ? 'linear-gradient(135deg, #D4A24C, #F97316)'
                : 'rgba(255,255,255,0.06)',
            }}
          >
            {BadgeMiniIcon ? (
              <BadgeMiniIcon size={18} />
            ) : (
              <StarBadgeIcon size={18} />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{currentLevel?.name || 'Newcomer'}</p>
            <p className="text-[11px] text-white/40">
              {formatPoints(combinedPoints)} points
            </p>
          </div>
        </div>

        {/* Streak pill */}
        {currentStreak > 0 && (
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.15)' }}
          >
            <FlameIcon size={13} />
            <span className="text-xs font-semibold text-orange-400">{currentStreak}</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {nextLevel && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-white/30">Next: {nextLevel.name}</span>
            <span className="text-[10px] font-mono text-white/30">{progressToNext}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressToNext}%`,
                background: 'linear-gradient(90deg, #D4A24C, #F97316)',
              }}
            />
          </div>
        </div>
      )}

      {/* View Rewards link */}
      <Link
        href="/rewards"
        className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-medium transition-colors"
        style={{
          background: 'rgba(245,158,11,0.08)',
          color: '#D4A24C',
          border: '1px solid rgba(245,158,11,0.12)',
        }}
      >
        View Rewards
        <ArrowRightIcon />
      </Link>
    </Card>
  );
}
