'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { useStreakStore, ALL_BADGES, type Badge } from '@/lib/store/streak-store';
import { usePointsStore, formatPoints, pointsToUsd } from '@/lib/store/cashback-store';

/* ------------------------------------------------------------------ */
/*  SVG Badge Icons                                                    */
/* ------------------------------------------------------------------ */

function ExplorerIcon({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="13" cy="13" r="8" stroke="currentColor" strokeWidth="2" />
      <line x1="19" y1="19" x2="28" y2="28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function ScoutIcon({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M16 4L22 18H10L16 4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 18L6 28H26L22 18" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <line x1="16" y1="18" x2="16" y2="24" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function NavigatorIcon({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="2" />
      <polygon points="16,6 19,14 16,12 13,14" fill="currentColor" />
      <polygon points="16,26 13,18 16,20 19,18" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

function CaptainIcon({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M16 4L26 16L16 28L6 16L16 4Z" stroke="currentColor" strokeWidth="0" fill="none" />
      <path d="M2 14L12 8L16 2L20 8L30 14L24 16L28 28L16 22L4 28L8 16L2 14Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function AceIcon({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M16 6C12 6 4 12 4 18C4 20 5 22 8 22C10 22 12 20 14 18L16 14L18 18C20 20 22 22 24 22C27 22 28 20 28 18C28 12 20 6 16 6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 22L10 28M20 22L22 28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CrownIcon({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M4 24H28V27H4V24Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M4 24L2 10L10 16L16 6L22 16L30 10L28 24H4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="10" cy="19" r="1.5" fill="currentColor" />
      <circle cx="16" cy="17" r="1.5" fill="currentColor" />
      <circle cx="22" cy="19" r="1.5" fill="currentColor" />
    </svg>
  );
}

const BADGE_ICON_MAP: Record<string, React.FC<{ size?: number; className?: string }>> = {
  explorer: ExplorerIcon,
  scout: ScoutIcon,
  navigator: NavigatorIcon,
  captain: CaptainIcon,
  ace: AceIcon,
  legend: CrownIcon,
};

export function getBadgeIcon(badgeId: string, size = 32, className = '') {
  const Icon = BADGE_ICON_MAP[badgeId];
  if (!Icon) return null;
  return <Icon size={size} className={className} />;
}

/* ------------------------------------------------------------------ */
/*  Flame / Fire SVG Icon                                              */
/* ------------------------------------------------------------------ */

function FlameIcon({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
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

/* ------------------------------------------------------------------ */
/*  Star Icon for header                                               */
/* ------------------------------------------------------------------ */

function StarIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
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

/* ------------------------------------------------------------------ */
/*  Rewards list                                                       */
/* ------------------------------------------------------------------ */

interface Reward {
  id: string;
  name: string;
  description: string;
  cost: number;
}

const REWARDS: Reward[] = [
  { id: 'priority-search', name: 'Priority Search Queue', description: 'Your searches get processed first for faster results', cost: 100 },
  { id: 'extended-history', name: 'Extended Price History', description: 'Unlock 180 days of price history for smarter booking', cost: 250 },
  { id: 'pro-month', name: '1 Month Pro Free', description: 'Enjoy all Pro features for a full month at no cost', cost: 500 },
  { id: 'free-mission', name: 'Free Mission Creation', description: 'Create a price tracking mission without limits', cost: 1000 },
  { id: 'ai-agent', name: 'Dedicated AI Agent', description: 'Your own AI travel agent for 1 week of personalized help', cost: 2500 },
  { id: 'elite-month', name: 'Elite Upgrade (1 Month)', description: 'Full Elite tier access for one month', cost: 5000 },
];

/* ------------------------------------------------------------------ */
/*  Main Rewards Page                                                  */
/* ------------------------------------------------------------------ */

export default function RewardsPage() {
  const totalPoints = useStreakStore((s) => s.totalPoints);
  const currentStreak = useStreakStore((s) => s.currentStreak);
  const longestStreak = useStreakStore((s) => s.longestStreak);
  const earnedBadges = useStreakStore((s) => s.badges);
  const streakFreezes = useStreakStore((s) => s.streakFreezes);

  const cashbackBalance = usePointsStore((s) => s.balance);
  const cashbackEvents = usePointsStore((s) => s.events);
  const totalEarned = usePointsStore((s) => s.totalEarned);

  const combinedPoints = totalPoints + cashbackBalance;

  // Determine current level
  const sortedBadges = [...ALL_BADGES].sort((a, b) => a.requirement - b.requirement);
  const currentLevel = sortedBadges.filter((b) => combinedPoints >= b.requirement).pop();
  const nextLevel = sortedBadges.find((b) => combinedPoints < b.requirement);

  const progressToNext = nextLevel
    ? Math.min(100, Math.round(((combinedPoints - (currentLevel?.requirement || 0)) / (nextLevel.requirement - (currentLevel?.requirement || 0))) * 100))
    : 100;

  const earnedBadgeIds = new Set(earnedBadges.map((b) => b.id));

  // Merge activity history from both stores
  const pointsHistory = [
    ...cashbackEvents.map((e) => ({
      reason: e.description,
      points: e.points,
      date: e.date,
      source: 'cashback' as const,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);

  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  function handleRedeem(reward: Reward) {
    setRedeemingId(reward.id);
    // Simulate redemption
    setTimeout(() => setRedeemingId(null), 1500);
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #F97316)' }}
          >
            <StarIcon size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Rewards</h1>
            <p className="text-sm text-white/50">Earn points, unlock badges, redeem rewards</p>
          </div>
        </div>
      </div>

      {/* Current Level + Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Current Level Card */}
        <Card className="md:col-span-2">
          <div className="flex items-start gap-5">
            {/* Badge icon */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                background: currentLevel
                  ? 'linear-gradient(135deg, #F59E0B, #F97316, #EF4444)'
                  : 'rgba(255,255,255,0.05)',
              }}
            >
              {currentLevel ? (
                <span className="text-white">{getBadgeIcon(currentLevel.id, 32, 'text-white')}</span>
              ) : (
                <span className="text-white/30 text-2xl">
                  <StarIcon size={32} className="text-white/30" />
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg font-bold text-white">
                  {currentLevel?.name || 'Newcomer'}
                </span>
                {currentLevel && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                    style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}
                  >
                    Current Level
                  </span>
                )}
              </div>
              <p className="text-sm text-white/50 mb-3">
                {currentLevel?.description || 'Start earning points to unlock your first badge'}
              </p>

              {/* Progress bar */}
              {nextLevel && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-white/40">
                      Progress to {nextLevel.name}
                    </span>
                    <span className="text-xs font-mono text-amber-400/70">
                      {formatPoints(combinedPoints)} / {formatPoints(nextLevel.requirement)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${progressToNext}%`,
                        background: 'linear-gradient(90deg, #F59E0B, #F97316)',
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-white/30 mt-1">
                    {formatPoints(nextLevel.requirement - combinedPoints)} points to go
                  </p>
                </div>
              )}
              {!nextLevel && (
                <p className="text-xs text-amber-400/60">Maximum level reached</p>
              )}
            </div>
          </div>
        </Card>

        {/* Stats Card */}
        <Card>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-white/40 mb-1">Total Points</p>
              <p className="text-2xl font-bold text-white font-mono">{formatPoints(combinedPoints)}</p>
              <p className="text-[11px] text-white/30">Worth ~${pointsToUsd(combinedPoints)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-white/40 mb-0.5">Streak</p>
                <div className="flex items-center gap-1">
                  <FlameIcon size={16} className="text-orange-400" />
                  <span className="text-lg font-bold text-white">{currentStreak}</span>
                  <span className="text-[10px] text-white/30">days</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-white/40 mb-0.5">Best Streak</p>
                <p className="text-lg font-bold text-white">{longestStreak}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/40">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10 2C6 2 3 5 3 9C3 15 10 18 10 18C10 18 17 15 17 9C17 5 14 2 10 2Z" strokeLinejoin="round" />
                <circle cx="10" cy="9" r="2" />
              </svg>
              <span>{streakFreezes} streak freeze{streakFreezes !== 1 ? 's' : ''} available</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Badges Gallery */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="10" cy="8" r="6" />
            <path d="M6.5 13L5 19L10 17L15 19L13.5 13" />
          </svg>
          Badges Gallery
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {sortedBadges.map((badge) => {
            const isEarned = earnedBadgeIds.has(badge.id) || combinedPoints >= badge.requirement;
            return (
              <div
                key={badge.id}
                className="rounded-2xl p-4 flex flex-col items-center text-center transition-all"
                style={{
                  background: isEarned ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)',
                  border: isEarned ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.05)',
                  opacity: isEarned ? 1 : 0.45,
                }}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mb-2"
                  style={{
                    background: isEarned
                      ? 'linear-gradient(135deg, #F59E0B, #F97316)'
                      : 'rgba(255,255,255,0.04)',
                  }}
                >
                  <span className={isEarned ? 'text-white' : 'text-white/20'}>
                    {getBadgeIcon(badge.id, 28, isEarned ? 'text-white' : 'text-white/20')}
                  </span>
                </div>
                <span className={`text-xs font-semibold ${isEarned ? 'text-white' : 'text-white/30'}`}>
                  {badge.name}
                </span>
                <span className="text-[10px] text-white/30 mt-0.5">
                  {badge.description}
                </span>
                {isEarned ? (
                  <span
                    className="mt-2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
                    style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}
                  >
                    Unlocked
                  </span>
                ) : (
                  <span className="mt-2 text-[10px] text-white/25">
                    {formatPoints(badge.requirement)} pts
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Points History + Rewards to Redeem Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Points History */}
        <Card title="Points History">
          {pointsHistory.length === 0 ? (
            <div className="text-center py-8">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="mx-auto mb-3 text-white/15">
                <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="2" />
                <path d="M16 10V18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="16" cy="22" r="1.5" fill="currentColor" />
              </svg>
              <p className="text-sm text-white/30">No points activity yet</p>
              <p className="text-xs text-white/20 mt-1">Search flights and book trips to earn points</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {pointsHistory.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 px-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/80 truncate">{entry.reason}</p>
                    <p className="text-[11px] text-white/30">
                      {new Date(entry.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <span className="text-sm font-mono font-semibold text-amber-400 ml-3">
                    +{formatPoints(entry.points)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Rewards to Redeem */}
        <Card title="Rewards to Redeem">
          <div className="space-y-3">
            {REWARDS.map((reward) => {
              const canAfford = combinedPoints >= reward.cost;
              const isRedeeming = redeemingId === reward.id;
              return (
                <div
                  key={reward.id}
                  className="flex items-center gap-4 p-3 rounded-xl transition-all"
                  style={{
                    background: canAfford ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.02)',
                    border: canAfford ? '1px solid rgba(245,158,11,0.1)' : '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{reward.name}</span>
                      <span className="text-[10px] font-mono text-amber-400/60">
                        {formatPoints(reward.cost)} pts
                      </span>
                    </div>
                    <p className="text-xs text-white/40 mt-0.5">{reward.description}</p>
                  </div>
                  <button
                    onClick={() => handleRedeem(reward)}
                    disabled={!canAfford || isRedeeming}
                    className="flex-shrink-0 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: canAfford
                        ? 'linear-gradient(135deg, #F59E0B, #F97316)'
                        : 'rgba(255,255,255,0.04)',
                      color: canAfford ? 'white' : 'rgba(255,255,255,0.2)',
                      cursor: canAfford ? 'pointer' : 'not-allowed',
                      opacity: isRedeeming ? 0.6 : 1,
                    }}
                  >
                    {isRedeeming ? 'Redeeming...' : 'Redeem'}
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Back link */}
      <div className="mt-8 text-center">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12L6 8L10 4" />
          </svg>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
