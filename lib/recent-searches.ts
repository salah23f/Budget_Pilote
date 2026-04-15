/**
 * Lightweight localStorage layer for tracking the user's recent real searches.
 * Used by the dashboard to show personalized history.
 *
 * Data source is 100% real — it's just a record of queries the user actually
 * ran through our live flight/hotel APIs.
 */

export type SearchKind = 'flight' | 'hotel';

export interface RecentFlight {
  kind: 'flight';
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  cheapestPrice?: number;
  airline?: string;
  at: number; // ms timestamp
}

export interface RecentHotel {
  kind: 'hotel';
  destination: string;
  checkIn: string;
  checkOut: string;
  cheapestPrice?: number;
  hotelName?: string;
  at: number;
}

export type RecentSearch = RecentFlight | RecentHotel;

const KEY = 'flyeas_recent_searches';
const MAX = 8;

function read(): RecentSearch[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function write(items: RecentSearch[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch (_) {}
}

export function getRecentSearches(): RecentSearch[] {
  return read();
}

export function pushRecentSearch(item: RecentSearch) {
  const existing = read();
  // Dedupe by key
  const key = (r: RecentSearch) =>
    r.kind === 'flight'
      ? `f:${r.origin}:${r.destination}:${r.departDate}`
      : `h:${r.destination}:${r.checkIn}:${r.checkOut}`;
  const deduped = existing.filter((r) => key(r) !== key(item));
  write([{ ...item, at: Date.now() }, ...deduped]);
}

export function clearRecentSearches() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
  } catch (_) {}
}
