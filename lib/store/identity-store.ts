'use client';

import { create } from 'zustand';

/**
 * Identity store — the single source of truth for "who is this user".
 *
 * Hydration order:
 *   1. localStorage cache (fast, offline-safe)        ← hydrate()
 *   2. server /api/me     (authoritative, on mount)   ← reconcile()
 *
 * Every form that asks for name / email / identity data must read from
 * this store and prefill. Forms should never request data that's already
 * known unless the user explicitly clicks "edit".
 */

const STORAGE_KEY = 'flyeas_identity';
/** Legacy localStorage key used by the onboarding flow. We read it once and migrate. */
const LEGACY_SV_USER_KEY = 'sv_user';

export interface Identity {
  userId?: string;
  firstName: string;
  lastName?: string;
  email?: string;
  avatarUrl?: string;
  locale?: string;
  currency?: string;
  createdAt?: number;
  updatedAt: number;
  /** True when the server has confirmed this data (vs localStorage-only). */
  verified: boolean;
}

interface IdentityState {
  identity: Identity | null;
  hydrated: boolean;
  /** Whether we've already tried a server reconcile this session. */
  reconciled: boolean;

  hydrate: () => void;
  reconcile: () => Promise<void>;
  update: (patch: Partial<Identity>, opts?: { persist?: boolean; sync?: boolean }) => void;
  clear: () => void;
  /** Convenience for forms — true if we know enough to prefill. */
  isKnown: () => boolean;
}

function readCache(): Identity | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Identity;

    // Legacy migration: earlier onboarding stored { firstName, email, ... } in sv_user
    const legacy = localStorage.getItem(LEGACY_SV_USER_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      const migrated: Identity = {
        firstName: parsed.firstName ?? '',
        lastName: parsed.lastName,
        email: parsed.email,
        createdAt: parsed.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        verified: false,
      };
      if (migrated.firstName) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch (_) {}
  return null;
}

function writeCache(identity: Identity) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
    // Keep sv_user in sync so any legacy reader (onboarding, etc.) still works.
    localStorage.setItem(
      LEGACY_SV_USER_KEY,
      JSON.stringify({
        firstName: identity.firstName,
        lastName: identity.lastName,
        email: identity.email,
      })
    );
  } catch (_) {}
}

export const useIdentityStore = create<IdentityState>()((set, get) => ({
  identity: null,
  hydrated: false,
  reconciled: false,

  hydrate: () => {
    if (get().hydrated) return;
    const cached = readCache();
    set({ identity: cached, hydrated: true });
  },

  reconcile: async () => {
    if (get().reconciled) return;
    set({ reconciled: true });
    try {
      const res = await fetch('/api/me', { credentials: 'include' });
      if (!res.ok) return;
      const server = (await res.json()) as Partial<Identity>;
      if (!server || !server.firstName) return;
      const prev = get().identity;
      const merged: Identity = {
        ...(prev ?? { firstName: '', updatedAt: Date.now(), verified: false }),
        ...server,
        updatedAt: Date.now(),
        verified: true,
      };
      writeCache(merged);
      set({ identity: merged });
    } catch (_) {
      // Offline or no server identity — keep localStorage as-is.
    }
  },

  update: (patch, opts = {}) => {
    const { persist = true, sync = true } = opts;
    const prev = get().identity ?? {
      firstName: '',
      updatedAt: Date.now(),
      verified: false,
    };
    const next: Identity = { ...prev, ...patch, updatedAt: Date.now() };
    set({ identity: next });
    if (persist) writeCache(next);

    if (sync && typeof window !== 'undefined') {
      // Fire-and-forget write-back
      void fetch('/api/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }).catch(() => {});
    }
  },

  clear: () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(LEGACY_SV_USER_KEY);
      } catch (_) {}
    }
    set({ identity: null });
  },

  isKnown: () => {
    const id = get().identity;
    return !!(id && id.firstName && id.firstName.length > 0);
  },
}));

/**
 * Convenience hook for components. Returns a stable object with the most
 * commonly needed fields and prefill helpers.
 */
export function useIdentity() {
  const identity = useIdentityStore((s) => s.identity);
  const isKnown = useIdentityStore((s) => s.isKnown)();
  return {
    identity,
    firstName: identity?.firstName ?? '',
    lastName: identity?.lastName ?? '',
    email: identity?.email ?? '',
    displayName: identity?.firstName?.trim() || 'there',
    initials: getInitials(identity?.firstName, identity?.lastName),
    isKnown,
  };
}

function getInitials(first?: string, last?: string): string {
  const a = (first ?? '').trim().charAt(0).toUpperCase();
  const b = (last ?? '').trim().charAt(0).toUpperCase();
  return a + b || a || 'U';
}
