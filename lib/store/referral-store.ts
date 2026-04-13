import { create } from 'zustand';

/**
 * Referral system — each user gets a unique code. Sharing it earns
 * credits when friends sign up. This is the viral coefficient engine.
 */

export interface ReferralState {
  referralCode: string;
  referralsCount: number;
  creditsEarned: number;
  referredBy: string | null;

  generateCode: (name?: string) => void;
  setReferredBy: (code: string) => void;
  addReferral: () => void;
}

const STORAGE_KEY = 'flyeas_referral';

function loadFromStorage(): Partial<ReferralState> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch { return {}; }
}

function saveToStorage(state: Partial<ReferralState>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function makeCode(name?: string): string {
  const base = (name || 'FLY').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || 'FLY';
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}-${suffix}`;
}

const initial = loadFromStorage();

export const useReferralStore = create<ReferralState>()((set, get) => ({
  referralCode: initial.referralCode || '',
  referralsCount: initial.referralsCount || 0,
  creditsEarned: initial.creditsEarned || 0,
  referredBy: initial.referredBy || null,

  generateCode: (name) => {
    if (get().referralCode) return; // already has one
    const code = makeCode(name);
    set({ referralCode: code });
    saveToStorage({ ...get(), referralCode: code });
  },

  setReferredBy: (code) => {
    set({ referredBy: code });
    saveToStorage({ ...get(), referredBy: code });
  },

  addReferral: () => {
    const state = get();
    const updated = {
      referralsCount: state.referralsCount + 1,
      creditsEarned: state.creditsEarned + 10,
    };
    set(updated);
    saveToStorage({ ...state, ...updated });
  },
}));
