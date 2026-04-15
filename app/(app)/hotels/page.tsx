'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HotelDestinationInput, type HotelDestination } from '@/components/ui/hotel-destination-input';
import { pushRecentSearch } from '@/lib/recent-searches';
import { FavoriteButton } from '@/components/ui/favorite-button';
import { type FavoriteHotel } from '@/lib/store/favorites-store';
import { HotelMap } from '@/components/hotel-map';
import { HotelDetailModal } from '@/components/hotel-detail-modal';
import { Breadcrumb } from '@/components/ui/breadcrumb';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface Hotel {
  id: string;
  name: string;
  stars: number;
  address: string;
  distance?: string;
  pricePerNight: number;
  totalPrice: number;
  nights: number;
  amenities: string[];
  rating: number;
  reviewCount: number;
  ratingLabel?: string;
  roomType?: string;
  photos: string[];
  lat: number;
  lng: number;
  partner?: string;
  source?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

const AMENITY_LIST = ['WiFi', 'Pool', 'Breakfast', 'Gym', 'Spa', 'Bar'];

function normalizeHotels(
  data: any[],
  checkIn: string,
  checkOut: string
): Hotel[] {
  const ciDate = new Date(checkIn);
  const coDate = new Date(checkOut);
  const nights = Math.max(
    1,
    Math.ceil(
      (coDate.getTime() - ciDate.getTime()) / (1000 * 60 * 60 * 24)
    )
  );

  return data.map((h) => {
    const totalPrice = h.priceUsd ?? h.totalPrice ?? 0;
    const raw = h.rawData || {};
    return {
      id: h.id,
      name: h.hotelName || h.name || 'Unknown Hotel',
      stars: h.hotelRating ?? h.stars ?? 0,
      address: raw.address || '',
      distance: raw.distance,
      pricePerNight: raw.pricePerNight || Math.round(totalPrice / nights),
      totalPrice: Math.round(totalPrice),
      nights,
      amenities: h.amenities || [],
      rating: raw.guestRating ?? (h.hotelRating ? h.hotelRating * 2 : 0),
      reviewCount: raw.reviewCount ?? 0,
      ratingLabel: raw.guestRatingLabel,
      roomType: h.roomType || '',
      photos: Array.isArray(h.photos) ? h.photos.filter(Boolean) : [],
      lat: h.locationLat || 0,
      lng: h.locationLng || 0,
      partner: raw.cheapestOfferPartnerName,
      source: h.source,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Skeleton loader                                                    */
/* ------------------------------------------------------------------ */

function HotelSkeleton() {
  return (
    <Card padding="none" className="overflow-hidden animate-pulse">
      <div
        className="h-40 flex items-center justify-center"
        style={{
          background:
            'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(239,68,68,0.08) 100%)',
        }}
      />
      <div className="p-5 space-y-3">
        <div className="h-5 w-3/4 bg-white/10 rounded" />
        <div className="h-3 w-1/2 bg-white/5 rounded" />
        <div className="flex gap-1.5">
          <div className="h-5 w-12 bg-white/5 rounded" />
          <div className="h-5 w-14 bg-white/5 rounded" />
          <div className="h-5 w-10 bg-white/5 rounded" />
        </div>
        <div className="flex justify-between items-end pt-2">
          <div className="h-7 w-16 bg-white/10 rounded" />
          <div className="h-8 w-16 bg-amber-500/20 rounded" />
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function HotelsPage() {
  /* Search form */
  const [destinationLabel, setDestinationLabel] = useState('');
  const [destinationEntityId, setDestinationEntityId] = useState('');
  const [checkIn, setCheckIn] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [checkOut, setCheckOut] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 35);
    return d.toISOString().split('T')[0];
  });
  const [guests, setGuests] = useState(2);
  const [rooms, setRooms] = useState(1);

  /* Data state */
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  /* Selected hotel for detail modal */
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);

  /* View toggle */
  const [view, setView] = useState<'grid' | 'list' | 'map'>('grid');

  /* Filters */
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [starsFilter, setStarsFilter] = useState<Set<number>>(new Set());
  const [amenitiesFilter, setAmenitiesFilter] = useState<Set<string>>(
    new Set()
  );
  const [ratingMin, setRatingMin] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'price-low' | 'price-high' | 'stars'>('rating');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Stable ref to the latest handleSearch — lets the prefill useEffect fire
  // the search without adding handleSearch as a dep (advanced-event-handler-refs).
  const handleSearchRef = useRef<(() => void) | null>(null);

  // Pick up a pre-filled destination from the dashboard trending tiles.
  // Accepts ?q=Paris (prefill only) or ?q=Paris&auto=1 (prefill + auto-search).
  // Using window.location.search avoids pulling in useSearchParams which would
  // force a CSR Suspense bailout on this page.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('q');
      const auto = params.get('auto');
      if (q) {
        setDestinationLabel(q);
        // Clean the URL so a refresh doesn't keep auto-searching.
        const url = new URL(window.location.href);
        url.searchParams.delete('q');
        url.searchParams.delete('auto');
        window.history.replaceState({}, '', url.toString());

        if (auto === '1') {
          // Kick off search after state settles. The backend accepts a raw
          // query string ("Paris") and will resolve it to an entityId.
          setTimeout(() => {
            handleSearchRef.current?.();
          }, 150);
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleSet<T>(set: Set<T>, value: T, setter: (s: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  }

  /* -- Search handler -- */
  const handleSearch = useCallback(async () => {
    if (!destinationEntityId && !destinationLabel) {
      setError('Please pick a destination from the suggestions.');
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const res = await fetch('/api/hotels/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId: destinationEntityId || undefined,
          query: destinationLabel || undefined,
          cityCode: destinationLabel || undefined,
          checkIn,
          checkOut,
          adults: guests,
          rooms,
        }),
      });

      const data = await res.json();

      if (data.success) {
        const normalized = normalizeHotels(data.data || [], checkIn, checkOut);
        setHotels(normalized);
        if (normalized.length > 0) {
          const cheapest = normalized.reduce((m, h) => (h.totalPrice < m.totalPrice ? h : m), normalized[0]);
          pushRecentSearch({
            kind: 'hotel',
            destination: destinationLabel || '',
            checkIn,
            checkOut,
            cheapestPrice: cheapest.totalPrice,
            hotelName: cheapest.name,
            at: Date.now(),
          });
        }
      } else {
        setError(data.error || 'Search failed');
        setHotels([]);
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
      setHotels([]);
    }

    setLoading(false);
  }, [destinationEntityId, destinationLabel, checkIn, checkOut, guests, rooms]);

  // Keep the ref pointed at the latest closure so the prefill effect can fire it.
  useEffect(() => {
    handleSearchRef.current = handleSearch;
  }, [handleSearch]);

  const results = useMemo(() => {
    if (!searched || hotels.length === 0) return [];
    let list = [...hotels];

    if (priceMin)
      list = list.filter((h) => h.pricePerNight >= Number(priceMin));
    if (priceMax)
      list = list.filter((h) => h.pricePerNight <= Number(priceMax));
    if (starsFilter.size > 0)
      list = list.filter((h) => starsFilter.has(h.stars));
    if (amenitiesFilter.size > 0) {
      list = list.filter((h) =>
        [...amenitiesFilter].every((a) => h.amenities.includes(a))
      );
    }
    if (ratingMin) list = list.filter((h) => h.rating >= Number(ratingMin));

    switch (sortBy) {
      case 'price-low':
        list.sort((a, b) => a.pricePerNight - b.pricePerNight);
        break;
      case 'price-high':
        list.sort((a, b) => b.pricePerNight - a.pricePerNight);
        break;
      case 'stars':
        list.sort((a, b) => b.stars - a.stars || b.rating - a.rating);
        break;
      case 'rating':
      default:
        list.sort((a, b) => b.rating - a.rating);
    }
    return list;
  }, [searched, hotels, priceMin, priceMax, starsFilter, amenitiesFilter, ratingMin, sortBy]);

  function renderStars(n: number) {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < n ? 'text-amber-400' : 'text-white/15'}>
        &#9733;
      </span>
    ));
  }

  function ratingColor(r: number) {
    if (r >= 9) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    if (r >= 8) return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
    return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8 space-y-6 fade-in">
      <Breadcrumb items={[{ label: 'Home', href: '/dashboard' }, { label: 'Hotels' }]} />
      {/* Search Form */}
      <Card padding="lg">
        <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Search Hotels
          </h1>
          {searched && !loading && hotels.length > 0 && (
            <Badge variant="success" size="sm">
              Live prices
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-4">
            <HotelDestinationInput
              label="Destination"
              placeholder="City, neighborhood, hotel..."
              value={destinationLabel}
              onChange={(sel: HotelDestination) => {
                setDestinationLabel(sel.name);
                setDestinationEntityId(sel.entityId);
              }}
            />
          </div>
          <div className="md:col-span-2">
            <Input
              label="Check-in"
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Input
              label="Check-out"
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
            />
          </div>
          <div className="md:col-span-1">
            <Input
              label="Guests"
              type="number"
              min={1}
              max={10}
              value={guests}
              onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <div className="md:col-span-1">
            <Input
              label="Rooms"
              type="number"
              min={1}
              max={5}
              value={rooms}
              onChange={(e) => setRooms(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <div className="md:col-span-2 flex items-end">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={loading}
            >
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </div>
        </form>
      </Card>

      {/* ---- Error State ---- */}
      {error && (
        <Card padding="lg" className="border border-amber-500/30">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(245,158,11,0.12)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-300">Couldn't load hotels</p>
              <p className="text-xs text-white/60 mt-1">{error}</p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="primary" onClick={handleSearch}>
                  Try again
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setError(null); setSearched(false); }}>
                  New search
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ---- Loading State ---- */}
      {loading && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-white/60">
              Searching live hotel prices...
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <HotelSkeleton key={i} />
            ))}
          </div>
        </div>
      )}

      {searched && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          {/* Sidebar Filters */}
          <div>
            <button
              className="lg:hidden w-full glass rounded-xl px-4 py-3 text-sm text-white/80 flex items-center justify-between mb-4"
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <span>Filters</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  d={filtersOpen ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <div
              className={`${filtersOpen ? 'block' : 'hidden'} lg:block space-y-5`}
            >
              <Card padding="md">
                <h3 className="text-sm font-semibold text-white/80 mb-3">
                  Price per Night (USD)
                </h3>
                <div className="flex gap-2">
                  <Input
                    placeholder="Min"
                    type="number"
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                  />
                  <Input
                    placeholder="Max"
                    type="number"
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                  />
                </div>
              </Card>

              <Card padding="md">
                <h3 className="text-sm font-semibold text-white/80 mb-3">
                  Star Rating
                </h3>
                <div className="space-y-2">
                  {[5, 4, 3].map((s) => (
                    <label
                      key={s}
                      className="flex items-center gap-2.5 text-sm text-white/70 cursor-pointer hover:text-white/90 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={starsFilter.has(s)}
                        onChange={() =>
                          toggleSet(starsFilter, s, setStarsFilter)
                        }
                        className="w-4 h-4 rounded accent-amber-400"
                      />
                      <span className="flex gap-0.5">{renderStars(s)}</span>
                    </label>
                  ))}
                </div>
              </Card>

              <Card padding="md">
                <h3 className="text-sm font-semibold text-white/80 mb-3">
                  Amenities
                </h3>
                <div className="space-y-2">
                  {AMENITY_LIST.map((a) => (
                    <label
                      key={a}
                      className="flex items-center gap-2.5 text-sm text-white/70 cursor-pointer hover:text-white/90 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={amenitiesFilter.has(a)}
                        onChange={() =>
                          toggleSet(amenitiesFilter, a, setAmenitiesFilter)
                        }
                        className="w-4 h-4 rounded accent-amber-400"
                      />
                      {a}
                    </label>
                  ))}
                </div>
              </Card>

              <Card padding="md">
                <h3 className="text-sm font-semibold text-white/80 mb-3">
                  Guest Rating (min)
                </h3>
                <Input
                  placeholder="e.g. 8.0"
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={ratingMin}
                  onChange={(e) => setRatingMin(e.target.value)}
                />
              </Card>

              <Card padding="md">
                <h3 className="text-sm font-semibold text-white/80 mb-3">
                  Sort By
                </h3>
                <div className="space-y-1.5">
                  {([
                    { key: 'rating' as const, label: 'Best Rating' },
                    { key: 'price-low' as const, label: 'Price: Low to High' },
                    { key: 'price-high' as const, label: 'Price: High to Low' },
                    { key: 'stars' as const, label: 'Star Rating' },
                  ]).map((opt) => (
                    <label
                      key={opt.key}
                      className="flex items-center gap-2.5 text-sm text-white/70 cursor-pointer hover:text-white/90 transition-colors"
                    >
                      <input
                        type="radio"
                        name="sort"
                        checked={sortBy === opt.key}
                        onChange={() => setSortBy(opt.key)}
                        className="w-4 h-4 accent-amber-400"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </Card>

              {/* Clear all */}
              {(priceMin || priceMax || starsFilter.size > 0 || amenitiesFilter.size > 0 || ratingMin) && (
                <button
                  onClick={() => {
                    setPriceMin('');
                    setPriceMax('');
                    setStarsFilter(new Set());
                    setAmenitiesFilter(new Set());
                    setRatingMin('');
                    setSortBy('rating');
                  }}
                  className="w-full text-center text-xs text-white/30 hover:text-amber-300 transition-colors py-2"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-white/60">
                <span className="text-white font-semibold">
                  {results.length}
                </span>{' '}
                hotels found
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setView('grid')}
                  className={`p-2 rounded-lg transition-colors ${view === 'grid' ? 'glass text-amber-300' : 'text-white/40 hover:text-white/70'}`}
                  title="Grid view"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 18 18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <rect x="2" y="2" width="5" height="5" rx="1" />
                    <rect x="11" y="2" width="5" height="5" rx="1" />
                    <rect x="2" y="11" width="5" height="5" rx="1" />
                    <rect x="11" y="11" width="5" height="5" rx="1" />
                  </svg>
                </button>
                <button
                  onClick={() => setView('list')}
                  className={`p-2 rounded-lg transition-colors ${view === 'list' ? 'glass text-amber-300' : 'text-white/40 hover:text-white/70'}`}
                  title="List view"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 18 18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      d="M3 4h12M3 9h12M3 14h12"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => setView('map')}
                  className={`p-2 rounded-lg transition-colors ${view === 'map' ? 'glass text-amber-300' : 'text-white/40 hover:text-white/70'}`}
                  title="Map view"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 4.5l5-2.5 5 2.5 5-2.5v11l-5 2.5-5-2.5-5 2.5z" />
                    <path d="M6 2v11M11 4.5v11" />
                  </svg>
                </button>
              </div>
            </div>

            {results.length === 0 && (
              <Card padding="lg" className="text-center">
                <p className="text-white/50 text-sm">
                  {hotels.length === 0
                    ? 'No hotels found for this destination and dates. Try different dates or another city.'
                    : 'No hotels match your filters.'}
                </p>
              </Card>
            )}

            {/* Grid view */}
            {view === 'grid' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.map((h) => {
                  const mapsUrl = h.lat && h.lng
                    ? `https://www.google.com/maps/search/?api=1&query=${h.lat},${h.lng}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name + ' ' + (h.address || ''))}`;
                  return (
                  <Card
                    key={h.id}
                    hoverable
                    padding="none"
                    className="overflow-hidden card-interactive stagger-item cursor-pointer"
                    onClick={() => setSelectedHotel(h)}
                  >
                    {/* Real photo */}
                    <div
                      className="h-48 relative overflow-hidden bg-white/5"
                      style={{
                        background:
                          'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(239,68,68,0.12) 100%)',
                      }}
                    >
                      {h.photos.length > 0 ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={h.photos[0]}
                          alt={h.name}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5">
                            <path d="M8 40V14a4 4 0 014-4h24a4 4 0 014 4v26" strokeLinecap="round" />
                            <path d="M4 40h40" strokeLinecap="round" />
                            <rect x="16" y="16" width="6" height="6" rx="1" />
                            <rect x="26" y="16" width="6" height="6" rx="1" />
                            <rect x="16" y="26" width="6" height="6" rx="1" />
                            <rect x="26" y="26" width="6" height="6" rx="1" />
                          </svg>
                        </div>
                      )}
                      {h.photos.length > 1 && (
                        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/60 text-[10px] text-white/80 backdrop-blur">
                          +{h.photos.length - 1} photos
                        </div>
                      )}
                      {/* Favorite heart */}
                      <div className="absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
                        <FavoriteButton
                          item={{
                            kind: 'hotel',
                            id: h.id,
                            name: h.name,
                            stars: h.stars,
                            address: h.address,
                            pricePerNight: h.pricePerNight,
                            totalPrice: h.totalPrice,
                            nights: h.nights,
                            rating: h.rating,
                            reviewCount: h.reviewCount,
                            amenities: h.amenities,
                            photo: h.photos[0] || undefined,
                            lat: h.lat,
                            lng: h.lng,
                            partner: h.partner,
                            savedAt: Date.now(),
                          } satisfies FavoriteHotel}
                          className="!bg-black/40 !backdrop-blur-sm hover:!bg-black/60"
                        />
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold text-white truncate">
                            {h.name}
                          </h3>
                          {h.stars > 0 && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-sm">{renderStars(h.stars)}</span>
                            </div>
                          )}
                        </div>
                        {h.rating > 0 && (
                          <div
                            className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-sm font-bold border ${ratingColor(h.rating)}`}
                          >
                            {h.rating.toFixed(1)}
                            {h.reviewCount > 0 && (
                              <span className="block text-[9px] font-normal opacity-70">
                                {h.reviewCount} reviews
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {(h.address || h.distance) && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-1.5 text-xs text-white/50 hover:text-amber-300 transition-colors mb-3"
                        >
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-0.5 flex-shrink-0">
                            <path d="M8 14s5-4.5 5-9a5 5 0 00-10 0c0 4.5 5 9 5 9z" strokeLinejoin="round" />
                            <circle cx="8" cy="5" r="2" />
                          </svg>
                          <span className="truncate">{h.address || h.distance}</span>
                        </a>
                      )}
                      {h.roomType && (
                        <p className="text-xs text-white/40 mb-2">{h.roomType}</p>
                      )}

                      {h.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {h.amenities.slice(0, 5).map((a) => (
                            <Badge key={a} variant="default" size="sm">
                              {a}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-xl font-bold text-white">
                            ${h.pricePerNight}
                          </p>
                          <p className="text-xs text-white/40">per night</p>
                          <p className="text-xs text-white/30 mt-0.5">
                            ${h.totalPrice} total ({h.nights} nights)
                          </p>
                          {h.partner && (
                            <p className="text-[10px] text-white/30 mt-0.5">
                              via {h.partner}
                            </p>
                          )}
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <Button variant="primary" size="sm">
                            Book
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
                })}
              </div>
            )}

            {/* List view */}
            {view === 'list' && (
              <div className="space-y-3">
                {results.map((h) => {
                  const mapsUrl = h.lat && h.lng
                    ? `https://www.google.com/maps/search/?api=1&query=${h.lat},${h.lng}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name + ' ' + (h.address || ''))}`;
                  return (
                  <Card
                    key={h.id}
                    hoverable
                    padding="none"
                    className="overflow-hidden cursor-pointer"
                    onClick={() => setSelectedHotel(h)}
                  >
                    <div className="flex flex-col md:flex-row">
                      {/* Real photo */}
                      <div
                        className="w-full md:w-56 h-40 md:h-auto flex-shrink-0 relative overflow-hidden"
                        style={{
                          background:
                            'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(239,68,68,0.12) 100%)',
                        }}
                      >
                        {h.photos.length > 0 ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={h.photos[0]}
                            alt={h.name}
                            className="absolute inset-0 w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <svg width="40" height="40" viewBox="0 0 48 48" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5">
                              <path d="M8 40V14a4 4 0 014-4h24a4 4 0 014 4v26" strokeLinecap="round" />
                              <path d="M4 40h40" strokeLinecap="round" />
                              <rect x="16" y="16" width="6" height="6" rx="1" />
                              <rect x="26" y="16" width="6" height="6" rx="1" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 p-5 flex flex-col md:flex-row md:items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-base font-semibold text-white truncate">
                              {h.name}
                            </h3>
                            {h.rating > 0 && (
                              <div
                                className={`flex-shrink-0 px-2 py-0.5 rounded-md text-xs font-bold border ${ratingColor(h.rating)}`}
                              >
                                {h.rating.toFixed(1)}
                              </div>
                            )}
                          </div>
                          {h.stars > 0 && (
                            <div className="flex items-center gap-1 mb-1">
                              <span className="text-xs">{renderStars(h.stars)}</span>
                            </div>
                          )}
                          {(h.address || h.distance) && (
                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-start gap-1.5 text-xs text-white/50 hover:text-amber-300 transition-colors mb-1"
                            >
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-0.5 flex-shrink-0">
                                <path d="M8 14s5-4.5 5-9a5 5 0 00-10 0c0 4.5 5 9 5 9z" strokeLinejoin="round" />
                                <circle cx="8" cy="5" r="2" />
                              </svg>
                              <span className="truncate">{h.address || h.distance}</span>
                            </a>
                          )}
                          {h.amenities.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {h.amenities.slice(0, 6).map((a) => (
                                <Badge key={a} variant="default" size="sm">
                                  {a}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-xl font-bold text-white">
                              ${h.pricePerNight}
                            </p>
                            <p className="text-xs text-white/40">per night</p>
                            <p className="text-xs text-white/30">
                              ${h.totalPrice} total
                            </p>
                            {h.partner && (
                              <p className="text-[10px] text-white/30">via {h.partner}</p>
                            )}
                          </div>
                          <div onClick={(e) => e.stopPropagation()}>
                            <Button variant="primary" size="sm">
                              Book
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
                })}
              </div>
            )}

            {/* Map view */}
            {view === 'map' && results.length > 0 && (
              <HotelMap
                hotels={results.map((h) => ({
                  id: h.id,
                  name: h.name,
                  lat: h.lat,
                  lng: h.lng,
                  pricePerNight: h.pricePerNight,
                  stars: h.stars,
                  rating: h.rating,
                  photo: h.photos[0],
                }))}
                className="border border-white/5"
              />
            )}
          </div>
        </div>
      )}
      {/* Hotel Detail Modal */}
      {selectedHotel && (
        <HotelDetailModal
          hotel={selectedHotel}
          onClose={() => setSelectedHotel(null)}
          checkIn={checkIn}
          checkOut={checkOut}
        />
      )}
    </div>
  );
}
