'use client';

import { useEffect } from 'react';
import { useStreakStore, ALL_BADGES } from '@/lib/store/streak-store';
import { Flame, Snowflake } from 'lucide-react';

/**
 * Streak widget — shows the user's current streak, points, badges,
 * and weekly activity heatmap. Designed for the dashboard sidebar or
 * as a card in the main grid.
 */
export function StreakWidget() {
  const {
    totalPoints,
    currentStreak,
    longestStreak,
    badges,
    weekActivity,
    streakFreezes,
    recordDailyOpen,
  } = useStreakStore();

  // Record daily open on mount
  useEffect(() => {
    recordDailyOpen();
  }, [recordDailyOpen]);

  const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  // Next badge
  const nextBadge = ALL_BADGES.find((b) => b.requirement > totalPoints);
  const progressToNext = nextBadge
    ? Math.min(100, (totalPoints / nextBadge.requirement) * 100)
    : 100;

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Top row: streak + points */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Flame icon */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
            style={{
              background: currentStreak > 0
                ? 'linear-gradient(135deg, color-mix(in srgb, var(--flyeas-accent) 15%, transparent), color-mix(in srgb, var(--flyeas-accent) 8%, transparent))'
                : 'rgba(255,255,255,0.03)',
            }}
          >
            {currentStreak > 0 ? <Flame className="w-5 h-5 text-accent" strokeWidth={1.8} /> : <Snowflake className="w-5 h-5 text-text-muted" strokeWidth={1.8} />}
          </div>
          <div>
            <p className="text-xl font-bold text-white">
              {currentStreak} day{currentStreak !== 1 ? 's' : ''}
            </p>
            <p className="text-[10px] text-white/30">
              {currentStreak > 0 ? 'streak' : 'no streak'} · best: {longestStreak}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-amber-300">{totalPoints.toLocaleString()}</p>
          <p className="text-[10px] text-white/30">points</p>
        </div>
      </div>

      {/* Weekly activity heatmap */}
      <div className="flex gap-1.5 mb-4">
        {DAYS.map((day, i) => (
          <div key={`${day}-${i}`} className="flex-1 text-center">
            <div
              className={`w-full aspect-square rounded-lg mb-1 transition-colors ${
                weekActivity[i]
                  ? 'bg-emerald-400/30 border border-emerald-400/40'
                  : 'bg-white/[0.03] border border-white/5'
              }`}
            />
            <span className="text-[9px] text-white/30">{day}</span>
          </div>
        ))}
      </div>

      {/* Progress to next badge */}
      {nextBadge && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-[10px] text-white/40 mb-1.5">
            <span>Next: {nextBadge.emoji} {nextBadge.name}</span>
            <span>{totalPoints}/{nextBadge.requirement} pts</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-500"
              style={{ width: `${progressToNext}%` }}
            />
          </div>
        </div>
      )}

      {/* Badges row */}
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {badges.map((b) => (
            <div
              key={b.id}
              className="px-2 py-1 rounded-lg text-[10px] flex items-center gap-1"
              style={{
                background: 'color-mix(in srgb, var(--flyeas-accent) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--flyeas-accent) 15%, transparent)',
              }}
              title={b.description}
            >
              <span>{b.emoji}</span>
              <span className="text-amber-300 font-medium">{b.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Streak freeze indicator */}
      {streakFreezes > 0 && (
        <p className="text-[10px] text-white/25 mt-3">
          🧊 {streakFreezes} streak freeze{streakFreezes > 1 ? 's' : ''} available
        </p>
      )}
    </div>
  );
}
