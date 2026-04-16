'use client';

import Link from 'next/link';
import { useStreakStore, ALL_BADGES } from '@/lib/store/streak-store';
import { usePointsStore, formatPoints } from '@/lib/store/cashback-store';
import { Trophy, ChevronRight } from 'lucide-react';

/**
 * Compact level widget for dashboard.
 * Shows current level + progress to next tier with a thin horizontal bar.
 */
export function LevelWidget() {
  const totalPoints = useStreakStore((s) => s.totalPoints);
  const cashbackBalance = usePointsStore((s) => s.balance);
  const combined = totalPoints + cashbackBalance;

  const sortedBadges = [...ALL_BADGES].sort((a, b) => a.requirement - b.requirement);
  const currentLevel = sortedBadges.filter((b) => combined >= b.requirement).pop();
  const nextLevel = sortedBadges.find((b) => combined < b.requirement);

  const progress = nextLevel
    ? Math.min(
        100,
        Math.round(
          ((combined - (currentLevel?.requirement || 0)) /
            (nextLevel.requirement - (currentLevel?.requirement || 0))) *
            100
        )
      )
    : 100;

  return (
    <Link
      href="/rewards"
      className="group flex flex-col gap-3 rounded-2xl p-5 transition hover:-translate-y-0.5 hover:bg-white/[0.04]"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, #E8A317, #F97316)' }}
          >
            <Trophy className="w-4 h-4 text-white" strokeWidth={2} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/30 font-medium">
              Your level
            </p>
            <p className="text-base font-bold text-white">
              {currentLevel?.name || 'Newcomer'}
            </p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 transition" strokeWidth={1.8} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-white/40 font-mono">
            {formatPoints(combined)}
            {nextLevel && <span className="text-white/20"> / {formatPoints(nextLevel.requirement)}</span>}
          </span>
          {nextLevel && (
            <span className="text-[10px] text-[#E8A317]/80 font-medium">
              Next: {nextLevel.name}
            </span>
          )}
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #E8A317, #F97316)',
            }}
          />
        </div>
      </div>
    </Link>
  );
}
