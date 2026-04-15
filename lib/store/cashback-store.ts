import { create } from 'zustand';

/**
 * Flyeas Points — Revolut-style tiered loyalty system.
 *
 * Higher plan = earn points faster = incentive to upgrade.
 *
 * Base rate: 2 points per $1 spent
 * Multipliers:
 *   Free  (1×) :  2 pts / $1  → $380 flight =   760 pts
 *   Pro   (3×) :  6 pts / $1  → $380 flight = 2,280 pts
 *   Elite (5×) : 10 pts / $1  → $380 flight = 3,800 pts
 *
 * Redemption: 10,000 points = $5 credit
 *
 * Effective cashback rate:
 *   Free:   0.10%  → costs Flyeas $0.38 on $380  → keeps $11.02
 *   Pro:    0.30%  → costs Flyeas $1.14 on $380  → keeps $10.26 + $9.99 sub = $20.25
 *   Elite:  0.50%  → costs Flyeas $1.90 on $380  → keeps $9.50 + $29.99 sub = $39.49
 *
 * With 30% breakage (never redeemed):
 *   Free: keeps $11.13 | Pro: keeps $20.59 | Elite: keeps $40.06
 *
 * The client sees "3,800 points!" and feels rewarded.
 * Flyeas keeps 90%+ of the commission. Everyone wins.
 */

const BASE_POINTS_PER_DOLLAR = 2;
const POINTS_PER_REWARD = 10000;
const REWARD_VALUE_USD = 5;

const TIER_MULTIPLIERS: Record<string, number> = {
  free: 1,
  pro: 3,
  elite: 5,
};

type UserTier = 'free' | 'pro' | 'elite';

export interface PointsEvent {
  id: string;
  type: 'booking' | 'referral' | 'search' | 'streak';
  points: number;
  description: string;
  date: string;
}

interface PointsState {
  balance: number;
  totalEarned: number;
  totalRedeemed: number;
  tier: UserTier;
  events: PointsEvent[];

  addPoints: (event: Omit<PointsEvent, 'id' | 'date'>) => void;
  redeemReward: () => boolean;
  setTier: (tier: UserTier) => void;
}

const STORAGE_KEY = 'flyeas_points';

function loadFromStorage(): Partial<PointsState> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (_) { return {}; }
}

function saveToStorage(state: Partial<PointsState>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      balance: state.balance,
      totalEarned: state.totalEarned,
      totalRedeemed: state.totalRedeemed,
      events: (state.events || []).slice(-50),
    }));
  } catch (_) {}
}

const initial = loadFromStorage();

export const usePointsStore = create<PointsState>()((set, get) => ({
  balance: initial.balance || 0,
  totalEarned: initial.totalEarned || 0,
  totalRedeemed: initial.totalRedeemed || 0,
  tier: (initial.tier as UserTier) || 'free',
  events: (initial.events as PointsEvent[]) || [],

  addPoints: (event) => {
    const state = get();
    const full: PointsEvent = {
      ...event,
      id: `pts_${Date.now()}`,
      date: new Date().toISOString(),
    };
    const updated = {
      balance: state.balance + event.points,
      totalEarned: state.totalEarned + event.points,
      totalRedeemed: state.totalRedeemed,
      events: [...state.events, full],
    };
    set(updated);
    saveToStorage(updated);
  },

  redeemReward: () => {
    const state = get();
    if (state.balance < POINTS_PER_REWARD) return false;
    const updated = {
      ...state,
      balance: state.balance - POINTS_PER_REWARD,
      totalRedeemed: state.totalRedeemed + REWARD_VALUE_USD,
    };
    set(updated);
    saveToStorage(updated);
    return true;
  },

  setTier: (tier) => {
    const state = get();
    set({ tier });
    saveToStorage({ ...state, tier });
  },
}));

/**
 * Calculate points earned for a booking based on tier.
 *
 *   Free  (1×) : 2 pts/$1 → $380 =   760 pts
 *   Pro   (3×) : 6 pts/$1 → $380 = 2,280 pts
 *   Elite (5×) : 10 pts/$1 → $380 = 3,800 pts
 */
export function calculatePoints(priceUsd: number, tier: UserTier = 'free'): number {
  const multiplier = TIER_MULTIPLIERS[tier] || 1;
  return Math.round(priceUsd * BASE_POINTS_PER_DOLLAR * multiplier);
}

/**
 * Format points with separator for display.
 */
export function formatPoints(points: number): string {
  return points.toLocaleString();
}

/**
 * Get the multiplier label for display.
 */
export function tierMultiplierLabel(tier: UserTier): string {
  const m = TIER_MULTIPLIERS[tier] || 1;
  return `${m}×`;
}

/**
 * Calculate how much a point balance is worth in USD.
 */
export function pointsToUsd(points: number): number {
  return Math.round((points / POINTS_PER_REWARD) * REWARD_VALUE_USD * 100) / 100;
}

export { BASE_POINTS_PER_DOLLAR, POINTS_PER_REWARD, REWARD_VALUE_USD, TIER_MULTIPLIERS };
export type { UserTier };
