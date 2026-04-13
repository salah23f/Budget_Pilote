import { create } from 'zustand';

/* ------------------------------------------------------------------ */
/*  Subscription & coupon management                                    */
/* ------------------------------------------------------------------ */

export type PlanTier = 'free' | 'pro' | 'elite';

interface Coupon {
  code: string;
  discountPercent: number;
  description: string;
  expiresAt: string;
  usedAt?: string;
}

const VALID_COUPONS: Record<string, { discountPercent: number; description: string }> = {
  FLYEAS20: { discountPercent: 20, description: '20% off your first month' },
  WELCOME50: { discountPercent: 50, description: '50% off first month — Welcome offer' },
  EARLYBIRD: { discountPercent: 30, description: '30% off — Early adopter discount' },
  FRIEND10: { discountPercent: 10, description: '10% off — Referred by a friend' },
  SUMMER2026: { discountPercent: 25, description: '25% off — Summer 2026 special' },
};

interface SubscriptionState {
  plan: PlanTier;
  trialActive: boolean;
  trialStartDate: string | null;
  trialEndDate: string | null;
  appliedCoupon: Coupon | null;
  payments: { id: string; amount: number; date: string; plan: string; status: string }[];

  startTrial: () => void;
  isTrialExpired: () => boolean;
  getTrialDaysLeft: () => number;
  setPlan: (plan: PlanTier) => void;
  applyCoupon: (code: string) => { success: boolean; message: string };
  removeCoupon: () => void;
  addPayment: (payment: { amount: number; plan: string }) => void;
}

const STORAGE_KEY = 'flyeas_subscription';
const TRIAL_DAYS = 7;

function loadState() {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

function saveState(state: Partial<SubscriptionState>) {
  if (typeof window === 'undefined') return;
  try {
    const current = loadState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...current,
      plan: state.plan,
      trialActive: state.trialActive,
      trialStartDate: state.trialStartDate,
      trialEndDate: state.trialEndDate,
      appliedCoupon: state.appliedCoupon,
      payments: state.payments,
    }));
  } catch {}
}

const initial = loadState();

export const useSubscriptionStore = create<SubscriptionState>()((set, get) => ({
  plan: initial.plan || 'free',
  trialActive: initial.trialActive || false,
  trialStartDate: initial.trialStartDate || null,
  trialEndDate: initial.trialEndDate || null,
  appliedCoupon: initial.appliedCoupon || null,
  payments: initial.payments || [],

  startTrial: () => {
    const now = new Date();
    const end = new Date(now.getTime() + TRIAL_DAYS * 86400000);
    const state = {
      ...get(),
      plan: 'pro' as PlanTier,
      trialActive: true,
      trialStartDate: now.toISOString(),
      trialEndDate: end.toISOString(),
    };
    set(state);
    saveState(state);
  },

  isTrialExpired: () => {
    const s = get();
    if (!s.trialActive || !s.trialEndDate) return false;
    return new Date() > new Date(s.trialEndDate);
  },

  getTrialDaysLeft: () => {
    const s = get();
    if (!s.trialActive || !s.trialEndDate) return 0;
    const diff = new Date(s.trialEndDate).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86400000));
  },

  setPlan: (plan) => {
    const state = { ...get(), plan, trialActive: false };
    set(state);
    saveState(state);
  },

  applyCoupon: (code) => {
    const normalized = code.toUpperCase().trim();
    const couponDef = VALID_COUPONS[normalized];
    if (!couponDef) return { success: false, message: 'Invalid coupon code' };

    const coupon: Coupon = {
      code: normalized,
      discountPercent: couponDef.discountPercent,
      description: couponDef.description,
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      usedAt: new Date().toISOString(),
    };

    const state = { ...get(), appliedCoupon: coupon };
    set(state);
    saveState(state);
    return { success: true, message: `${couponDef.description}` };
  },

  removeCoupon: () => {
    const state = { ...get(), appliedCoupon: null };
    set(state);
    saveState(state);
  },

  addPayment: (payment) => {
    const p = {
      id: `pay_${Date.now()}`,
      amount: payment.amount,
      date: new Date().toISOString(),
      plan: payment.plan,
      status: 'succeeded',
    };
    const state = { ...get(), payments: [...get().payments, p] };
    set(state);
    saveState(state);
  },
}));
