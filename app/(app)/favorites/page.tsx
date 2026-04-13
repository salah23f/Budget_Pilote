'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFavoritesStore, type FavoriteItem, type FavoriteFlight, type FavoriteHotel } from '@/lib/store/favorites-store';

export default function FavoritesPage() {
  const items = useFavoritesStore((s) => s.items);
  const remove = useFavoritesStore((s) => s.remove);
  const [filter, setFilter] = useState<'all' | 'flight' | 'hotel'>('all');

  const filtered = filter === 'all' ? items : items.filter((i) => i.kind === filter);
  const flights = items.filter((i) => i.kind === 'flight');
  const hotels = items.filter((i) => i.kind === 'hotel');

  function formatDuration(mins: number) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  function timeAgo(ms: number) {
    const diff = Date.now() - ms;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Favorites</h1>
          <p className="text-sm text-white/40 mt-1">
            {items.length} saved {items.length === 1 ? 'item' : 'items'}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[
          { key: 'all' as const, label: 'All', count: items.length },
          { key: 'flight' as const, label: 'Flights', count: flights.length },
          { key: 'hotel' as const, label: 'Hotels', count: hotels.length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === tab.key
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'glass text-white/50 hover:text-white/70'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 text-xs opacity-60">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <Card padding="lg" className="text-center py-16">
          <div className="text-4xl mb-4">
            {filter === 'flight' ? '✈️' : filter === 'hotel' ? '🏨' : '❤️'}
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No favorites yet</h3>
          <p className="text-sm text-white/40 max-w-sm mx-auto mb-6">
            Save flights and hotels you love by tapping the heart icon. They&apos;ll appear here so you can compare and book later.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/flights">
              <Button variant="primary" size="md">Search Flights</Button>
            </Link>
            <Link href="/hotels">
              <Button variant="secondary" size="md">Search Hotels</Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Items */}
      <div className="space-y-3">
        {[...filtered].reverse().map((item) =>
          item.kind === 'flight' ? (
            <FlightFavoriteCard key={item.id} item={item} onRemove={remove} timeAgo={timeAgo} formatDuration={formatDuration} />
          ) : (
            <HotelFavoriteCard key={item.id} item={item} onRemove={remove} timeAgo={timeAgo} />
          )
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Flight Card                                                         */
/* ------------------------------------------------------------------ */

function FlightFavoriteCard({
  item,
  onRemove,
  timeAgo,
  formatDuration,
}: {
  item: FavoriteFlight;
  onRemove: (id: string) => void;
  timeAgo: (ms: number) => string;
  formatDuration: (mins: number) => string;
}) {
  return (
    <Card hoverable padding="none" className="overflow-hidden stagger-item">
      <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Airline logo */}
        <div className="w-10 h-10 rounded-xl glass flex items-center justify-center flex-shrink-0">
          {item.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.logoUrl} alt={item.airline} className="w-full h-full object-contain rounded-xl" />
          ) : (
            <span className="text-xs font-bold text-amber-400">{item.airlineCode}</span>
          )}
        </div>

        {/* Flight info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-white">
              {item.originCity || item.origin} → {item.destinationCity || item.destination}
            </span>
            <Badge variant="default" size="sm">✈️ Flight</Badge>
          </div>
          <p className="text-xs text-white/50">
            {item.airline} · {item.stops === 0 ? 'Nonstop' : `${item.stops} stop${item.stops > 1 ? 's' : ''}`} · {formatDuration(item.durationMinutes)} · {item.cabin}
          </p>
          <p className="text-[10px] text-white/30 mt-1">Saved {timeAgo(item.savedAt)}</p>
        </div>

        {/* Price + actions */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xl font-bold text-white">${item.price}</p>
            <p className="text-[10px] text-white/40">per person</p>
          </div>

          {item.deepLink && (
            <a href={item.deepLink} target="_blank" rel="noopener noreferrer">
              <Button variant="primary" size="sm">Book</Button>
            </a>
          )}

          <button
            onClick={() => onRemove(item.id)}
            className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition"
            title="Remove from favorites"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Hotel Card                                                          */
/* ------------------------------------------------------------------ */

function HotelFavoriteCard({
  item,
  onRemove,
  timeAgo,
}: {
  item: FavoriteHotel;
  onRemove: (id: string) => void;
  timeAgo: (ms: number) => string;
}) {
  return (
    <Card hoverable padding="none" className="overflow-hidden stagger-item">
      <div className="flex flex-col sm:flex-row">
        {/* Photo */}
        <div className="sm:w-36 h-32 sm:h-auto relative overflow-hidden bg-white/5 flex-shrink-0">
          {item.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.photo} alt={item.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 48 48" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5">
                <path d="M8 40V14a4 4 0 014-4h24a4 4 0 014 4v26" strokeLinecap="round" />
                <path d="M4 40h40" strokeLinecap="round" />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-white truncate">{item.name}</span>
              <Badge variant="default" size="sm">🏨 Hotel</Badge>
            </div>
            <p className="text-xs text-white/50">
              {'★'.repeat(item.stars)}{'☆'.repeat(5 - item.stars)} · {item.rating.toFixed(1)} ({item.reviewCount} reviews)
            </p>
            {item.address && (
              <p className="text-xs text-white/35 mt-0.5 truncate">{item.address}</p>
            )}
            {item.amenities.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {item.amenities.slice(0, 4).map((a) => (
                  <span key={a} className="px-1.5 py-0.5 rounded text-[9px] bg-white/5 text-white/40 border border-white/8">{a}</span>
                ))}
              </div>
            )}
            <p className="text-[10px] text-white/30 mt-1.5">Saved {timeAgo(item.savedAt)}</p>
          </div>

          {/* Price + actions */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xl font-bold text-white">${item.pricePerNight}</p>
              <p className="text-[10px] text-white/40">per night</p>
              <p className="text-[10px] text-white/30">${item.totalPrice} total</p>
            </div>

            <button
              onClick={() => onRemove(item.id)}
              className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition"
              title="Remove from favorites"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
