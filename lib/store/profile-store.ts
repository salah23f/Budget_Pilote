import { create } from 'zustand';
import type { BehaviorEvent, UserTravelProfile } from '@/lib/algorithm/types';
import { applyEvent, createNeutralProfile, decayProfile } from '@/lib/algorithm/user-model';

/**
 * Client-side mirror of the user's travel profile.
 *
 * Storage: localStorage under `flyeas_profile_v2`.
 * Sync: best-effort to server via /api/profile (write-behind). Reads are
 * served from local cache first, updated from server on login.
 */

const STORAGE_KEY = 'flyeas_profile_v2';
const DEVICE_KEY = 'flyeas_device_id';

interface ProfileState {
  profile: UserTravelProfile | null;
  hydrated: boolean;

  hydrate: (userId?: string) => void;
  apply: (event: BehaviorEvent) => void;
  decayAndPersist: () => void;
  reset: () => void;
  setUserId: (userId: string) => void;
}

function deviceId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = `d_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch (_) {
    return 'ephemeral';
  }
}

function load(): UserTravelProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserTravelProfile;
  } catch (_) {
    return null;
  }
}

function persist(p: UserTravelProfile) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch (_) {}
}

export const useProfileStore = create<ProfileState>()((set, get) => ({
  profile: null,
  hydrated: false,

  hydrate: (userId) => {
    if (get().hydrated) return;
    const cached = load();
    if (cached) {
      // Apply decay on read (lightweight — reading a week-old profile
      // without decay would let stale affinities dominate)
      const decayed = decayProfile(cached);
      set({ profile: decayed, hydrated: true });
      persist(decayed);
      return;
    }
    const fresh = createNeutralProfile(userId ?? 'anon', deviceId());
    set({ profile: fresh, hydrated: true });
    persist(fresh);
  },

  apply: (event) => {
    const current = get().profile;
    if (!current) return;
    const updated = applyEvent(current, event);
    set({ profile: updated });
    persist(updated);
  },

  decayAndPersist: () => {
    const current = get().profile;
    if (!current) return;
    const decayed = decayProfile(current);
    set({ profile: decayed });
    persist(decayed);
  },

  reset: () => {
    const fresh = createNeutralProfile('anon', deviceId());
    set({ profile: fresh });
    persist(fresh);
  },

  setUserId: (userId) => {
    const current = get().profile;
    if (!current) {
      const fresh = createNeutralProfile(userId, deviceId());
      set({ profile: fresh });
      persist(fresh);
      return;
    }
    const next = { ...current, userId };
    set({ profile: next });
    persist(next);
  },
}));
