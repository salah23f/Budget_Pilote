import { create } from 'zustand';

/**
 * Savings & activity tracker.
 *
 * IMPORTANT: totalSaved and events are ONLY incremented when a REAL
 * booking happens (Stripe capture or USDC release). Showing fake
 * savings from search results is misleading and unprofessional.
 *
 * What IS tracked from searches: searchesCount and dealsFound — those
 * are real metrics (the user actually performed those searches).
 *
 * The addSaving() function should ONLY be called from:
 *   - /api/missions/[id]/propose (auto-buy path)
 *   - /api/missions/[id]/confirm (user-confirmed booking)
 * Never from flight search results.
 *
 * Persisted in localStorage. Client-side only.
 */

export interface SavingEvent {
  id: string;
  route: string; // "CDG → JFK"
  amountSaved: number; // positive = user saved money
  cheapestPrice: number;
  averagePrice: number;
  airline?: string;
  date: string; // ISO
}

interface SavingsState {
  totalSaved: number;
  events: SavingEvent[];
  dealsFound: number;
  searchesCount: number;

  addSaving: (event: Omit<SavingEvent, 'id' | 'date'>) => void;
  incrementSearches: () => void;
  incrementDeals: (count: number) => void;
  reset: () => void;
}

// Manual persist to localStorage (zustand/middleware persist has issues
// with SSR in Next.js 14 — safer to do it ourselves)
const STORAGE_KEY = 'flyeas_savings';
// Bump this version whenever the savings logic changes to force a
// reset of stale/fake data in users' browsers.
const STORAGE_VERSION = 2;

function loadFromStorage(): Partial<SavingsState> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // If the version doesn't match, the old data was computed with
    // fake savings from search results — wipe it clean.
    if (parsed._version !== STORAGE_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      return {};
    }
    return {
      totalSaved: parsed.totalSaved || 0,
      events: parsed.events || [],
      dealsFound: parsed.dealsFound || 0,
      searchesCount: parsed.searchesCount || 0,
    };
  } catch {
    return {};
  }
}

function saveToStorage(state: {
  totalSaved: number;
  events: SavingEvent[];
  dealsFound: number;
  searchesCount: number;
}) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        _version: STORAGE_VERSION,
        totalSaved: state.totalSaved,
        events: state.events.slice(-50), // keep last 50 events max
        dealsFound: state.dealsFound,
        searchesCount: state.searchesCount,
      })
    );
  } catch {}
}

const initial = loadFromStorage();

export const useSavingsStore = create<SavingsState>()((set, get) => ({
  totalSaved: initial.totalSaved || 0,
  events: initial.events || [],
  dealsFound: initial.dealsFound || 0,
  searchesCount: initial.searchesCount || 0,

  addSaving: (event) => {
    const id = `sav_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const full: SavingEvent = {
      ...event,
      id,
      date: new Date().toISOString(),
    };
    const state = get();
    const updated = {
      totalSaved: state.totalSaved + Math.max(0, event.amountSaved),
      events: [...state.events, full],
      dealsFound: state.dealsFound,
      searchesCount: state.searchesCount,
    };
    set(updated);
    saveToStorage(updated);
  },

  incrementSearches: () => {
    const state = get();
    const updated = { ...state, searchesCount: state.searchesCount + 1 };
    set({ searchesCount: updated.searchesCount });
    saveToStorage(updated);
  },

  incrementDeals: (count) => {
    const state = get();
    const updated = { ...state, dealsFound: state.dealsFound + count };
    set({ dealsFound: updated.dealsFound });
    saveToStorage(updated);
  },

  reset: () => {
    const cleared = {
      totalSaved: 0,
      events: [],
      dealsFound: 0,
      searchesCount: 0,
    };
    set(cleared);
    saveToStorage(cleared as any);
  },
}));
