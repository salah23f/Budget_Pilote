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
}

/* ------------------------------------------------------------------ */
/*  Persistence                                                         */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'flyeas_favorites';

function load(): FavoriteItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(items: FavoriteItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-100)));
  } catch {}
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
}));
