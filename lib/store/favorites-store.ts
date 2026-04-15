import { create } from 'zustand';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export interface FavoriteFlight {
  kind: 'flight';
  id: string;
  airline: string;
  airlineCode: string;
  origin: string;
  destination: string;
  originCity?: string;
  destinationCity?: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  stops: number;
  price: number;
  cabin: string;
  dealQuality: string;
  deepLink?: string;
  logoUrl?: string;
  savedAt: number;
}

export interface FavoriteHotel {
  kind: 'hotel';
  id: string;
  name: string;
  stars: number;
  address: string;
  pricePerNight: number;
  totalPrice: number;
  nights: number;
  rating: number;
  reviewCount: number;
  amenities: string[];
  photo?: string;
  lat: number;
  lng: number;
  partner?: string;
  savedAt: number;
}

export type FavoriteItem = FavoriteFlight | FavoriteHotel;

interface FavoritesState {
  items: FavoriteItem[];
  add: (item: FavoriteItem) => void;
  remove: (id: string) => void;
  isFavorite: (id: string) => boolean;
  toggle: (item: FavoriteItem) => void;
  clear: () => void;

  /* Supabase sync --------------------------------------------------- */
  syncToSupabase: (userId: string) => Promise<void>;
  loadFromSupabase: (userId: string) => Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  localStorage persistence (unchanged)                                */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'flyeas_favorites';

function load(): FavoriteItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function save(items: FavoriteItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-100)));
  } catch (_) {}
}

/* ------------------------------------------------------------------ */
/*  Store                                                               */
/* ------------------------------------------------------------------ */

const initial = load();

export const useFavoritesStore = create<FavoritesState>()((set, get) => ({
  items: initial,

  add: (item) => {
    const state = get();
    if (state.items.some((i) => i.id === item.id)) return;
    const updated = [...state.items, item];
    set({ items: updated });
    save(updated);
  },

  remove: (id) => {
    const updated = get().items.filter((i) => i.id !== id);
    set({ items: updated });
    save(updated);
  },

  isFavorite: (id) => get().items.some((i) => i.id === id),

  toggle: (item) => {
    const state = get();
    if (state.items.some((i) => i.id === item.id)) {
      const updated = state.items.filter((i) => i.id !== item.id);
      set({ items: updated });
      save(updated);
    } else {
      const updated = [...state.items, item];
      set({ items: updated });
      save(updated);
    }
  },

  clear: () => {
    set({ items: [] });
    save([]);
  },

  /* ---------------------------------------------------------------- */
  /*  Supabase sync                                                     */
  /* ---------------------------------------------------------------- */

  /**
   * Push the current local favorites to Supabase. This is a full sync
   * that upserts every local item so the remote state matches local.
   * Gracefully no-ops if the API is unreachable or Supabase is not
   * configured.
   */
  syncToSupabase: async (userId: string) => {
    const { items } = get();
    try {
      const res = await fetch('/api/user/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, items }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.warn('[favorites] sync to Supabase failed:', err);
      }
    } catch (err) {
      // Network error or Supabase not configured -- silent fallback
      console.warn('[favorites] sync to Supabase failed:', err);
    }
  },

  /**
   * Fetch favorites from Supabase and merge them with the current
   * localStorage items. Remote items that are not present locally are
   * added; local items that are not present remotely are kept. The
   * merged set is saved back to localStorage.
   */
  loadFromSupabase: async (userId: string) => {
    try {
      const res = await fetch(
        `/api/user/favorites?userId=${encodeURIComponent(userId)}`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.warn('[favorites] load from Supabase failed:', err);
        return;
      }
      const { favorites } = (await res.json()) as {
        favorites: { id: string; item_data: FavoriteItem }[];
      };
      if (!Array.isArray(favorites)) return;

      const remoteItems: FavoriteItem[] = favorites.map((row) => row.item_data);

      // Merge: use a map keyed by id so we keep the most recent version
      const localItems = get().items;
      const merged = new Map<string, FavoriteItem>();

      // Start with remote items
      for (const item of remoteItems) {
        merged.set(item.id, item);
      }
      // Layer local items on top (local wins on conflict by savedAt)
      for (const item of localItems) {
        const existing = merged.get(item.id);
        if (!existing || item.savedAt > existing.savedAt) {
          merged.set(item.id, item);
        }
      }

      const mergedArray = Array.from(merged.values()).sort(
        (a, b) => a.savedAt - b.savedAt
      );

      set({ items: mergedArray });
      save(mergedArray);
    } catch (err) {
      // Network error or Supabase not configured -- silent fallback
      console.warn('[favorites] load from Supabase failed:', err);
    }
  },
}));
