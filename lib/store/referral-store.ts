import { create } from 'zustand';

/**
 * Referral system — Revolut-style progressive rewards.
 * Each user gets a unique code. Sharing earns credits when friends sign up
 * AND complete a trigger action (first search). Six reward tiers unlock
 * increasing benefits — badges, cash credits, Pro/Elite months, VIP status.
 */

export type InviteStatus = 'pending' | 'signed_up' | 'searched' | 'booked';

export interface InvitedFriend {
  id: string;
  email?: string;
  name?: string;
  status: InviteStatus;
  invitedAt: string;
  completedAt?: string;
  creditEarned: number;
}

export interface RewardTier {
  id: string;
  threshold: number;
  title: string;
  description: string;
  creditUsd: number;
  proMonthsBonus?: number;
  eliteMonthsBonus?: number;
  badgeName?: string;
  vipLifetime?: boolean;
}

export const REWARD_TIERS: RewardTier[] = [
  { id: 'tier-1', threshold: 1, title: 'Explorer', description: 'Your first invite', creditUsd: 10, badgeName: 'Explorer' },
  { id: 'tier-2', threshold: 3, title: 'Ambassador', description: '3 friends joined', creditUsd: 40, badgeName: 'Ambassador' },
  { id: 'tier-3', threshold: 5, title: 'Pro Advocate', description: '5 friends joined', creditUsd: 80, proMonthsBonus: 1 },
  { id: 'tier-4', threshold: 10, title: 'Legend', description: '10 friends joined', creditUsd: 200, proMonthsBonus: 3, badgeName: 'Legend' },
  { id: 'tier-5', threshold: 25, title: 'Flyeas Royalty', description: '25 friends joined', creditUsd: 500, eliteMonthsBonus: 12 },
  { id: 'tier-6', threshold: 50, title: 'Lifetime VIP', description: '50 friends joined', creditUsd: 1500, vipLifetime: true, badgeName: 'VIP' },
];

export const CREDIT_PER_REFERRAL = 10;

export interface ReferralState {
  referralCode: string;
  referredBy: string | null;
  friends: InvitedFriend[];
  unlockedTiers: string[]; // tier ids

  generateCode: (name?: string) => void;
  setReferredBy: (code: string) => void;
  inviteFriend: (input: { email?: string; name?: string }) => string; // returns friend id
  markFriendSignedUp: (id: string) => void;
  markFriendSearched: (id: string) => void;
  markFriendBooked: (id: string) => void;
  checkAndUnlockTiers: () => RewardTier[];
}

const STORAGE_KEY = 'flyeas_referral_v2';

function loadFromStorage(): Partial<ReferralState> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

function saveToStorage(state: Partial<ReferralState>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        referralCode: state.referralCode,
        referredBy: state.referredBy,
        friends: state.friends,
        unlockedTiers: state.unlockedTiers,
      })
    );
  } catch (_) {}
}

function makeCode(name?: string): string {
  const base = (name || 'FLY').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5) || 'FLY';
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${base}${suffix}`;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const initial = loadFromStorage();

export const useReferralStore = create<ReferralState>()((set, get) => ({
  referralCode: initial.referralCode || '',
  referredBy: initial.referredBy || null,
  friends: (initial.friends as InvitedFriend[]) || [],
  unlockedTiers: (initial.unlockedTiers as string[]) || [],

  generateCode: (name) => {
    if (get().referralCode) return;
    const code = makeCode(name);
    set({ referralCode: code });
    saveToStorage({ ...get(), referralCode: code });
  },

  setReferredBy: (code) => {
    set({ referredBy: code });
    saveToStorage({ ...get(), referredBy: code });
  },

  inviteFriend: ({ email, name }) => {
    const id = uid();
    const friend: InvitedFriend = {
      id,
      email,
      name,
      status: 'pending',
      invitedAt: new Date().toISOString(),
      creditEarned: 0,
    };
    const next = [...get().friends, friend];
    set({ friends: next });
    saveToStorage({ ...get(), friends: next });
    return id;
  },

  markFriendSignedUp: (id) => {
    const next = get().friends.map((f) => (f.id === id ? { ...f, status: 'signed_up' as InviteStatus } : f));
    set({ friends: next });
    saveToStorage({ ...get(), friends: next });
  },

  markFriendSearched: (id) => {
    const next = get().friends.map((f) =>
      f.id === id
        ? {
            ...f,
            status: 'searched' as InviteStatus,
            completedAt: f.completedAt || new Date().toISOString(),
            creditEarned: CREDIT_PER_REFERRAL,
          }
        : f
    );
    set({ friends: next });
    saveToStorage({ ...get(), friends: next });
    get().checkAndUnlockTiers();
  },

  markFriendBooked: (id) => {
    const next = get().friends.map((f) => (f.id === id ? { ...f, status: 'booked' as InviteStatus } : f));
    set({ friends: next });
    saveToStorage({ ...get(), friends: next });
  },

  checkAndUnlockTiers: () => {
    const completed = get().friends.filter((f) => f.status === 'searched' || f.status === 'booked').length;
    const alreadyUnlocked = new Set(get().unlockedTiers);
    const newlyUnlocked: RewardTier[] = [];
    for (const tier of REWARD_TIERS) {
      if (completed >= tier.threshold && !alreadyUnlocked.has(tier.id)) {
        newlyUnlocked.push(tier);
      }
    }
    if (newlyUnlocked.length > 0) {
      const next = [...get().unlockedTiers, ...newlyUnlocked.map((t) => t.id)];
      set({ unlockedTiers: next });
      saveToStorage({ ...get(), unlockedTiers: next });
    }
    return newlyUnlocked;
  },
}));

// Derived selectors
export function selectCompletedReferrals(state: ReferralState): number {
  return state.friends.filter((f) => f.status === 'searched' || f.status === 'booked').length;
}

export function selectTotalCreditsEarned(state: ReferralState): number {
  return state.friends.reduce((sum, f) => sum + (f.creditEarned || 0), 0);
}

export function selectNextTier(state: ReferralState): RewardTier | null {
  const completed = selectCompletedReferrals(state);
  return REWARD_TIERS.find((t) => completed < t.threshold) || null;
}

export function selectCurrentTier(state: ReferralState): RewardTier | null {
  const completed = selectCompletedReferrals(state);
  const found = [...REWARD_TIERS].reverse().find((t) => completed >= t.threshold);
  return found || null;
}
