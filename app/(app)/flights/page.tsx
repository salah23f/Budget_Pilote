'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { PriceCalendar } from '@/components/ui/price-calendar';
import { AirportInput, type AirportSelection } from '@/components/ui/airport-input';
import { pushRecentSearch } from '@/lib/recent-searches';
import { useSavingsStore } from '@/lib/store/savings-store';
import { shareDeal } from '@/lib/share';
import { pushNotification } from '@/components/notifications/notification-bell';
import { useStreakStore } from '@/lib/store/streak-store';
import { calculatePoints, formatPoints } from '@/lib/store/cashback-store';
import { FavoriteButton } from '@/components/ui/favorite-button';
import { type FavoriteFlight } from '@/lib/store/favorites-store';
import { PriceHistory } from '@/components/price-history';
import { PriceComparator } from '@/components/price-comparator';
import { WeatherWidget } from '@/components/weather-widget';
import { FlightDetailModal } from '@/components/flight-detail-modal';
import { FlightComparisonModal } from '@/components/flight-comparison-modal';
import { DestinationGuide } from '@/components/destination-guide';
import { CurrencyConverter } from '@/components/currency-converter';
import { Breadcrumb } from '@/components/ui/breadcrumb';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface Flight {
  id: string;
  airline: string;
  airlineCode: string;
  flightNumber?: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  stops: number;
  price: number;
  priceUsd?: number;
  carbonKg: number;
  dealQuality: string;
  score: number;
  cabin: string;
  cabinClass?: string;
  baggageIncluded?: boolean;
  label?: string;
  source?: string;
  logoUrl?: string;
  originIata?: string;
  destinationIata?: string;
  originCity?: string;
  destinationCity?: string;
  deepLink?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatTime(isoOrTime: string): string {
  if (!isoOrTime) return '--:--';
  // If it's an ISO date string, extract hours:minutes
  if (isoOrTime.includes('T')) {
    const d = new Date(isoOrTime);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  return isoOrTime;
}

function formatDuration(minutes: number): string {
  if (!minutes) return '--';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function getDepartureSlot(time: string): string {
  let h: number;
  if (time.includes('T')) {
    h = new Date(time).getHours();
  } else {
    h = parseInt(time.split(':')[0]);
  }
  if (h >= 5 && h < 12) return 'Morning';
  if (h >= 12 && h < 17) return 'Afternoon';
  if (h >= 17 && h < 21) return 'Evening';
  return 'Night';
}

function getCarbonLevel(kg: number): string {
  if (kg < 500) return 'Low';
  if (kg < 650) return 'Medium';
  return 'High';
}

function normalizeFlights(data: any[]): Flight[] {
  return data.map((f) => {
    const raw = f.rawData || {};
    return {
      id: f.id,
      airline: f.airline || f.airlineCode || 'Unknown',
      airlineCode: f.airlineCode || f.flightNumber?.slice(0, 2) || '',
      flightNumber: f.flightNumber || f.airlineCode || '',
      departureTime: f.departureTime || '',
      arrivalTime: f.arrivalTime || '',
      durationMinutes: f.durationMinutes || 0,
      stops: f.stops ?? 0,
      price: f.priceUsd ?? f.price ?? 0,
      carbonKg: f.carbonKg ?? 0,
      dealQuality: capitalize(f.dealQuality || 'Fair'),
      score: f.score ?? 50,
      cabin: capitalize(f.cabinClass || f.cabin || 'economy'),
      baggageIncluded: f.baggageIncluded ?? true,
      label: f.label,
      source: f.source,
      logoUrl: raw.logoUrl,
      originIata: raw.originIata,
      destinationIata: raw.destinationIata,
      originCity: raw.originCity,
      destinationCity: raw.destinationCity,
      deepLink: raw.deepLink,
    };
  });
}

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

/* ------------------------------------------------------------------ */
/*  Skeleton loader                                                    */
/* ------------------------------------------------------------------ */

function FlightSkeleton() {
  return (
    <Card padding="none" className="overflow-hidden animate-pulse">
      <div className="p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-white/5" />
              <div>
                <div className="h-4 w-28 bg-white/10 rounded mb-1" />
                <div className="h-3 w-16 bg-white/5 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-6 w-14 bg-white/10 rounded" />
              <div className="flex-1 h-px bg-white/10" />
              <div className="h-6 w-14 bg-white/10 rounded" />
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="h-5 w-16 bg-white/10 rounded" />
            <div className="h-5 w-20 bg-white/5 rounded" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="h-8 w-20 bg-white/10 rounded" />
            <div className="h-3 w-16 bg-white/5 rounded" />
            <div className="h-8 w-20 bg-amber-500/20 rounded" />
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function FlightsPage() {
  /* -- Search form state -- */
  const [origin, setOrigin] = useState('');
  const [originSkyId, setOriginSkyId] = useState('');
  const [originEntityId, setOriginEntityId] = useState('');
  const [destination, setDestination] = useState('');
  const [destSkyId, setDestSkyId] = useState('');
  const [destEntityId, setDestEntityId] = useState('');
  const [departDate, setDepartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [returnDate, setReturnDate] = useState('');
  const [cabin, setCabin] = useState('economy');
  const [passengers, setPassengers] = useState(1);
  const [handBags, setHandBags] = useState(1);
  const [holdBags, setHoldBags] = useState(0);

  /* -- Data state -- */
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState<any | null>(null);

  /* -- Comparison state -- */
  const [compareSet, setCompareSet] = useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = useState(false);

  /* -- Explore Everywhere state -- */
  const [exploreResults, setExploreResults] = useState<Array<{ destination: string; destinationCity: string; price: number; airline: string; deepLink: string | null }>>([]);
  const [exploreLoading, setExploreLoading] = useState(false);

  /* -- Sort -- */
  const [sortBy, setSortBy] = useState('best');

  /* -- Filters -- */
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [stopsFilter, setStopsFilter] = useState<Set<number>>(new Set());
  const [airlinesFilter, setAirlinesFilter] = useState<Set<string>>(new Set());
  const [timeFilter, setTimeFilter] = useState<Set<string>>(new Set());
  const [carbonFilter, setCarbonFilter] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);

  /* -- Price Calendar state -- */
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => departDate.slice(0, 7));
  const [calendarPrices, setCalendarPrices] = useState<Record<string, number>>({});
  const [calendarLoading, setCalendarLoading] = useState(false);

  const loadCalendar = useCallback(async () => {
    if (!origin || !destination) return;
    setCalendarOpen(true);
    setCalendarLoading(true);
    try {
      const o = originSkyId || origin;
      const d = destSkyId || destination;
      const res = await fetch(
        `/api/flights/calendar?origin=${encodeURIComponent(o)}&destination=${encodeURIComponent(d)}&month=${calendarMonth}&cabin=${cabin}&adults=${passengers}`
      );
      const data = await res.json();
      if (data.success) setCalendarPrices(data.prices || {});
    } catch {} finally { setCalendarLoading(false); }
  }, [origin, destination, originSkyId, destSkyId, calendarMonth, cabin, passengers]);

  // Reload calendar when month changes while open
  useEffect(() => {
    if (calendarOpen && origin && destination) {
      setCalendarLoading(true);
      const o = originSkyId || origin;
      const d = destSkyId || destination;
      fetch(`/api/flights/calendar?origin=${encodeURIComponent(o)}&destination=${encodeURIComponent(d)}&month=${calendarMonth}&cabin=${cabin}&adults=${passengers}`)
        .then(r => r.json())
        .then(data => { if (data.success) setCalendarPrices(data.prices || {}); })
        .catch(() => {})
        .finally(() => setCalendarLoading(false));
    }
  }, [calendarMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  /* -- Swap -- */
  function swapCities() {
    const tmp = origin; const tmpSky = originSkyId; const tmpEnt = originEntityId;
    setOrigin(destination); setOriginSkyId(destSkyId); setOriginEntityId(destEntityId);
    setDestination(tmp); setDestSkyId(tmpSky); setDestEntityId(tmpEnt);
  }

  /* -- Explore handler -- */
  const handleExplore = useCallback(async () => {
    if (!origin) return;
    setExploreLoading(true);
    setExploreResults([]);
    try {
      const res = await fetch('/api/flights/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: originSkyId || origin, departDate }),
      });
      const data = await res.json();
      if (data.success && data.destinations) {
        setExploreResults(data.destinations);
      }
    } catch {
      // silently fail — explore is supplementary
    } finally {
      setExploreLoading(false);
    }
  }, [origin, originSkyId, departDate]);

  /* -- Search handler -- */
  const handleSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const res = await fetch('/api/flights/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          destination,
          departDate,
          returnDate: returnDate || undefined,
          adults: passengers,
          cabinClass: cabin,
          handBags: handBags,
          holdBags: holdBags,
          originSkyId: originSkyId || undefined,
          originEntityId: originEntityId || undefined,
          destSkyId: destSkyId || undefined,
          destEntityId: destEntityId || undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        const normalized = normalizeFlights(data.data || []);
        setFlights(normalized);
        // Persist a real recent search (no mock values — only record what the
        // live API actually returned)
        if (normalized.length > 0) {
          const cheapest = normalized.reduce((m, f) => (f.price < m.price ? f : m), normalized[0]);
          pushRecentSearch({
            kind: 'flight',
            origin: origin || cheapest.originIata || '',
            destination: destination || cheapest.destinationIata || '',
            departDate,
            returnDate: returnDate || undefined,
            cheapestPrice: cheapest.price,
            airline: cheapest.airline,
            at: Date.now(),
          });

          // --- Activity Tracker ---
          // Only count real metrics: searches performed + deals seen.
          // Savings are NEVER counted from searches — only from real
          // bookings (captures via Stripe or USDC release). Showing
          // fake savings from search results is misleading and
          // unprofessional.
          useSavingsStore.getState().incrementSearches();
          useSavingsStore.getState().incrementDeals(normalized.length);

          // Push a real notification
          pushNotification({
            type: 'price_drop',
            title: `${normalized.length} flights found`,
            body: `${origin} → ${destination} from $${cheapest.price} (${cheapest.airline})`,
          });

          // Award engagement points (+5 per search)
          useStreakStore.getState().addPoints(5, 'flight_search');
        }
      } else {
        setError(data.error || 'Search failed');
        setFlights([]);
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
      setFlights([]);
    }

    setLoading(false);
  }, [origin, destination, departDate, returnDate, passengers, cabin]);

  /* -- Airlines list from results -- */
  const airlinesList = useMemo(
    () => [...new Set(flights.map((f) => f.airline))].sort(),
    [flights]
  );

  /* -- Filter + sort logic -- */
  const results = useMemo(() => {
    if (!searched || flights.length === 0) return [];

    let list = [...flights];

    // Price
    if (priceMin) list = list.filter((f) => f.price >= Number(priceMin));
    if (priceMax) list = list.filter((f) => f.price <= Number(priceMax));

    // Stops
    if (stopsFilter.size > 0) {
      list = list.filter((f) => {
        if (stopsFilter.has(0) && f.stops === 0) return true;
        if (stopsFilter.has(1) && f.stops === 1) return true;
        if (stopsFilter.has(2) && f.stops >= 2) return true;
        return false;
      });
    }

    // Airlines
    if (airlinesFilter.size > 0) {
      list = list.filter((f) => airlinesFilter.has(f.airline));
    }

    // Departure time
    if (timeFilter.size > 0) {
      list = list.filter((f) =>
        timeFilter.has(getDepartureSlot(f.departureTime))
      );
    }

    // Carbon
    if (carbonFilter.size > 0) {
      list = list.filter((f) => carbonFilter.has(getCarbonLevel(f.carbonKg)));
    }

    // Sort
    switch (sortBy) {
      case 'cheapest':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'fastest':
        list.sort((a, b) => a.durationMinutes - b.durationMinutes);
        break;
      case 'greenest':
        list.sort((a, b) => a.carbonKg - b.carbonKg);
        break;
      default:
        list.sort((a, b) => b.score - a.score);
    }

    return list;
  }, [
    searched,
    flights,
    priceMin,
    priceMax,
    stopsFilter,
    airlinesFilter,
    timeFilter,
    carbonFilter,
    sortBy,
  ]);

  /* -- Hacker Fare detection -- */
  const hackerFare = useMemo(() => {
    // Only relevant for round-trip searches with results
    if (!returnDate || flights.length < 2) return null;

    // Group flights by airline
    const byAirline = new Map<string, Flight[]>();
    for (const f of flights) {
      const list = byAirline.get(f.airline) || [];
      list.push(f);
      byAirline.set(f.airline, list);
    }

    // Find cheapest single-airline round-trip (cheapest outbound + cheapest return from same airline)
    // Since the API returns one-way results, we consider the cheapest flight as outbound
    // and the second cheapest from the same airline as return
    let cheapestSameAirline = Infinity;
    let sameAirlineName = '';
    for (const [airline, airlineFlights] of byAirline) {
      if (airlineFlights.length >= 2) {
        const sorted = [...airlineFlights].sort((a, b) => a.price - b.price);
        const total = sorted[0].price + sorted[1].price;
        if (total < cheapestSameAirline) {
          cheapestSameAirline = total;
          sameAirlineName = airline;
        }
      }
    }

    // Find cheapest mix: cheapest outbound from any airline + cheapest return from a different airline
    const sortedAll = [...flights].sort((a, b) => a.price - b.price);
    if (sortedAll.length < 2) return null;

    const outbound = sortedAll[0];
    const returnFlight = sortedAll.find((f) => f.airline !== outbound.airline);
    if (!returnFlight) return null;

    const hackerTotal = outbound.price + returnFlight.price;

    // Only show if mixing airlines actually saves money
    if (cheapestSameAirline === Infinity || hackerTotal >= cheapestSameAirline) return null;

    const savings = cheapestSameAirline - hackerTotal;
    if (savings < 5) return null; // minimum $5 savings threshold

    return {
      outboundAirline: outbound.airline,
      returnAirline: returnFlight.airline,
      outboundPrice: outbound.price,
      returnPrice: returnFlight.price,
      total: hackerTotal,
      savings,
      sameAirlineTotal: cheapestSameAirline,
      sameAirlineName,
    };
  }, [flights, returnDate]);

  /* -- Checkbox toggle helpers -- */
  function toggleSet<T>(set: Set<T>, value: T, setter: (s: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  }

  const dealColor = (q: string) => {
    const lower = q.toLowerCase();
    if (lower === 'excellent') return 'success' as const;
    if (lower === 'good') return 'highlight' as const;
    return 'warning' as const;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8 space-y-6 fade-in">
      <Breadcrumb items={[{ label: 'Home', href: '/dashboard' }, { label: 'Flights' }]} />
      {/* ---- Search Form ---- */}
      <Card padding="lg">
        <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Search Flights
          </h1>
          <div className="flex items-center gap-3">
            {searched && !loading && flights.length > 0 && (
              <Badge variant="success" size="sm">
                Live prices
              </Badge>
            )}
            <Link
              href="/flights/calendar"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="14" height="14" rx="2" />
                <path d="M3 8h14M7 2v4M13 2v4" />
              </svg>
              Calendar view
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-3">
            <AirportInput
              label="From"
              placeholder="City or airport..."
              value={origin}
              onChange={(sel: AirportSelection) => { setOrigin(sel.code); setOriginSkyId(sel.skyId); setOriginEntityId(sel.entityId); }}
            />
          </div>
          <div className="md:col-span-1 flex items-end justify-center">
            <button
              type="button"
              onClick={swapCities}
              className="w-10 h-10 rounded-xl glass flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              title="Swap"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 3v12M5 15l-3-3M5 15l3-3M13 15V3M13 3l-3 3M13 3l3 3" />
              </svg>
            </button>
          </div>
          <div className="md:col-span-3">
            <AirportInput
              label="To"
              placeholder="City or airport..."
              value={destination}
              onChange={(sel: AirportSelection) => { setDestination(sel.code); setDestSkyId(sel.skyId); setDestEntityId(sel.entityId); }}
            />
          </div>
          <div className="md:col-span-2">
            <Input
              label="Departure"
              type="date"
              value={departDate}
              onChange={(e) => setDepartDate(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Input
              label="Return (optional)"
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
            />
          </div>
          <div className="md:col-span-1" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end mt-4">
          <div className="md:col-span-3">
            <Select
              label="Cabin Class"
              value={cabin}
              onChange={(e) => setCabin(e.target.value)}
              options={[
                { value: 'economy', label: 'Economy' },
                { value: 'premium_economy', label: 'Premium Economy' },
                { value: 'business', label: 'Business' },
                { value: 'first', label: 'First' },
              ]}
            />
          </div>
          <div className="md:col-span-2">
            <Input
              label="Passengers"
              type="number"
              min={1}
              max={9}
              value={passengers}
              onChange={(e) => setPassengers(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>

          {/* Baggage options */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-white/50 mb-1.5">Cabin bags</label>
            <select
              className="glass-input w-full"
              value={handBags}
              onChange={(e) => setHandBags(Number(e.target.value))}
            >
              <option value={0}>No cabin bag</option>
              <option value={1}>1 cabin bag</option>
              <option value={2}>2 cabin bags</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-white/50 mb-1.5">Checked bags</label>
            <select
              className="glass-input w-full"
              value={holdBags}
              onChange={(e) => setHoldBags(Number(e.target.value))}
            >
              <option value={0}>No checked bag (cheapest)</option>
              <option value={1}>1 checked bag (23kg)</option>
              <option value={2}>2 checked bags</option>
            </select>
          </div>
          <div className="md:col-span-7 flex items-end gap-3">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={loading}
            >
              {loading ? 'Searching...' : 'Search Flights'}
            </Button>
            {origin && !destination && (
              <Button
                type="button"
                variant="ghost"
                size="lg"
                fullWidth
                onClick={handleExplore}
                disabled={exploreLoading}
                className="mt-2"
              >
                <span className="inline-flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                  </svg>
                  {exploreLoading ? 'Exploring...' : `Explore from ${origin}`}
                </span>
              </Button>
            )}
            {origin && destination && (
              <Button
                type="button"
                variant="ghost"
                size="lg"
                fullWidth
                onClick={loadCalendar}
                className="mt-2"
              >
                <span className="inline-flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="14" height="14" rx="2" />
                    <path d="M3 8h14M7 2v4M13 2v4" />
                  </svg>
                  Price Calendar
                </span>
              </Button>
            )}
          </div>
        </div>
        </form>
      </Card>

      {/* ---- Explore Everywhere Results ---- */}
      {exploreLoading && (
        <Card padding="lg">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-white/60">Exploring cheapest destinations from {origin}...</p>
          </div>
        </Card>
      )}
      {exploreResults.length > 0 && !exploreLoading && (
        <Card padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E8A317" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
              </svg>
              Explore from {origin}
            </h2>
            <button
              className="text-xs text-white/40 hover:text-white/70 transition"
              onClick={() => setExploreResults([])}
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {exploreResults.map((d: any) => (
              <button
                key={d.destination}
                type="button"
                className="glass rounded-xl p-4 text-left hover:bg-white/5 transition-all group border border-white/5 hover:border-amber-500/20"
                onClick={() => {
                  setDestination(d.destination);
                  setDestSkyId('');
                  setDestEntityId('');
                  setExploreResults([]);
                }}
              >
                <p className="text-sm font-semibold text-white group-hover:text-amber-300 transition-colors">
                  {d.destinationCity}
                </p>
                <p className="text-[10px] text-white/40 mt-0.5">{d.destination}</p>
                <p className="text-lg font-bold text-amber-400 mt-2">${d.price}</p>
                <p className="text-[10px] text-white/40 mt-0.5">{d.airline}</p>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* ---- Price Calendar Modal ---- */}
      <Modal isOpen={calendarOpen} onClose={() => setCalendarOpen(false)} title="Price Calendar">
        <div className="p-1">
          <p className="text-xs text-white/40 mb-4">
            {origin} → {destination} · Cheapest prices per day
          </p>
          <PriceCalendar
            prices={calendarPrices}
            selectedDate={departDate}
            onDateSelect={(date) => {
              setDepartDate(date);
              setCalendarOpen(false);
              // Auto-trigger search with new date
              setTimeout(() => handleSearch(), 100);
            }}
            loading={calendarLoading}
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
          />
        </div>
      </Modal>

      {/* ---- Error State ---- */}
      {error && (
        <Card padding="lg" className="border border-amber-500/30">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(245,158,11,0.12)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E8A317" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-300">
                {/temporarily unavailable/i.test(error) ? 'Live provider is catching up' : "Couldn't load flights"}
              </p>
              <p className="text-xs text-white/60 mt-1">{error}</p>
              {/temporarily unavailable/i.test(error) && (
                <p className="text-xs text-white/40 mt-1">
                  Our upstream Sky-Scrapper data source is momentarily throttled for this route. Try a nearby airport, a different date, or search hotels for the same destination.
                </p>
              )}
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="primary" onClick={handleSearch}>
                  Try again
                </Button>
                <Link href="/hotels">
                  <Button size="sm" variant="ghost">Search hotels instead</Button>
                </Link>
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
              Searching live flight prices...
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <FlightSkeleton key={i} />
            ))}
          </div>
        </div>
      )}

      {/* ---- Results ---- */}
      {searched && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* ---- Sidebar Filters ---- */}
          <div>
            {/* Mobile toggle */}
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
              {/* Price range */}
              <Card padding="md">
                <h3 className="text-sm font-semibold text-white/80 mb-3">
                  Price Range (USD)
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

              {/* Stops */}
              <Card padding="md">
                <h3 className="text-sm font-semibold text-white/80 mb-3">
                  Stops
                </h3>
                <div className="space-y-2">
                  {([0, 1, 2] as const).map((s) => (
                    <label
                      key={s}
                      className="flex items-center gap-2.5 text-sm text-white/70 cursor-pointer hover:text-white/90 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={stopsFilter.has(s)}
                        onChange={() =>
                          toggleSet(stopsFilter, s, setStopsFilter)
                        }
                        className="w-4 h-4 rounded accent-amber-400"
                      />
                      {s === 0 ? 'Nonstop' : s === 1 ? '1 Stop' : '2+ Stops'}
                    </label>
                  ))}
                </div>
              </Card>

              {/* Airlines */}
              {airlinesList.length > 0 && (
                <Card padding="md">
                  <h3 className="text-sm font-semibold text-white/80 mb-3">
                    Airlines
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {airlinesList.map((a) => (
                      <label
                        key={a}
                        className="flex items-center gap-2.5 text-sm text-white/70 cursor-pointer hover:text-white/90 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={airlinesFilter.has(a)}
                          onChange={() =>
                            toggleSet(airlinesFilter, a, setAirlinesFilter)
                          }
                          className="w-4 h-4 rounded accent-amber-400"
                        />
                        {a}
                      </label>
                    ))}
                  </div>
                </Card>
              )}

              {/* Departure Time */}
              <Card padding="md">
                <h3 className="text-sm font-semibold text-white/80 mb-3">
                  Departure Time
                </h3>
                <div className="space-y-2">
                  {['Morning', 'Afternoon', 'Evening', 'Night'].map((t) => (
                    <label
                      key={t}
                      className="flex items-center gap-2.5 text-sm text-white/70 cursor-pointer hover:text-white/90 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={timeFilter.has(t)}
                        onChange={() =>
                          toggleSet(timeFilter, t, setTimeFilter)
                        }
                        className="w-4 h-4 rounded accent-amber-400"
                      />
                      {t}{' '}
                      {t === 'Morning'
                        ? '(5-12)'
                        : t === 'Afternoon'
                          ? '(12-17)'
                          : t === 'Evening'
                            ? '(17-21)'
                            : '(21-5)'}
                    </label>
                  ))}
                </div>
              </Card>

              {/* Carbon */}
              <Card padding="md">
                <h3 className="text-sm font-semibold text-white/80 mb-3">
                  Carbon Footprint
                </h3>
                <div className="space-y-2">
                  {['Low', 'Medium', 'High'].map((c) => (
                    <label
                      key={c}
                      className="flex items-center gap-2.5 text-sm text-white/70 cursor-pointer hover:text-white/90 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={carbonFilter.has(c)}
                        onChange={() =>
                          toggleSet(carbonFilter, c, setCarbonFilter)
                        }
                        className="w-4 h-4 rounded accent-amber-400"
                      />
                      {c}{' '}
                      {c === 'Low'
                        ? '(< 500kg)'
                        : c === 'Medium'
                          ? '(500-650kg)'
                          : '(> 650kg)'}
                    </label>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          {/* ---- Hacker Fare Banner ---- */}
          {hackerFare && (
            <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(16,185,129,0.12)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="6" cy="6" r="3" />
                    <circle cx="6" cy="18" r="3" />
                    <line x1="20" y1="4" x2="8.12" y2="15.88" />
                    <line x1="14.47" y1="14.48" x2="20" y2="20" />
                    <line x1="8.12" y1="8.12" x2="12" y2="12" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-emerald-300">
                    Hacker Fare — Save ${hackerFare.savings}
                  </p>
                  <p className="text-xs text-white/40 mt-0.5">
                    Combine {hackerFare.outboundAirline} outbound (${hackerFare.outboundPrice}) + {hackerFare.returnAirline} return (${hackerFare.returnPrice}) for ${hackerFare.total} instead of ${hackerFare.sameAirlineTotal} on {hackerFare.sameAirlineName}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ---- Results List ---- */}
          <div className="space-y-4">
            {/* Results header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-white/60">
                <span className="text-white font-semibold">
                  {results.length}
                </span>{' '}
                flights found
              </p>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                options={[
                  { value: 'best', label: 'Best Match' },
                  { value: 'cheapest', label: 'Cheapest' },
                  { value: 'fastest', label: 'Fastest' },
                  { value: 'greenest', label: 'Greenest' },
                ]}
                className="!w-auto min-w-[160px]"
              />
            </div>

            {/* Flight cards */}
            {results.length === 0 && (
              <Card padding="lg" className="text-center">
                <p className="text-white/50 text-sm">
                  {flights.length === 0
                    ? 'No flights found. Try different dates or routes.'
                    : 'No flights match your filters. Try adjusting your criteria.'}
                </p>
              </Card>
            )}

            {results.map((f) => (
              <Card key={f.id} hoverable padding="none" className="overflow-hidden card-interactive stagger-item cursor-pointer relative" onClick={() => setSelectedFlight(f)}>
                {/* Compare checkbox */}
                <label
                  className="absolute top-3 right-3 z-10 flex items-center gap-1.5 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={compareSet.has(f.id)}
                    onChange={() => {
                      setCompareSet((prev) => {
                        const next = new Set(prev);
                        if (next.has(f.id)) {
                          next.delete(f.id);
                        } else if (next.size < 3) {
                          next.add(f.id);
                        }
                        return next;
                      });
                    }}
                    className="w-4 h-4 rounded accent-amber-400 cursor-pointer"
                  />
                  <span className="text-[10px] text-white/40 select-none">Compare</span>
                </label>
                <div className="p-5 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-center gap-5">
                    {/* Airline + flight info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl glass flex items-center justify-center overflow-hidden">
                          {f.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={f.logoUrl}
                              alt={f.airline}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="text-xs font-bold text-amber-300">
                              {(f.airline || 'Unknown')
                                .split(' ')
                                .map((w) => w[0])
                                .join('')}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {f.airline}
                          </p>
                          <p className="text-xs text-white/45">
                            {f.flightNumber || f.airlineCode}
                          </p>
                        </div>
                        {f.label && (
                          <Badge variant="highlight" size="sm">
                            {capitalize(f.label)}
                          </Badge>
                        )}
                      </div>

                      {/* Times */}
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-xl font-bold text-white">
                            {formatTime(f.departureTime)}
                          </p>
                          <p className="text-xs text-white/45">
                            {f.originIata || origin.toUpperCase().slice(0, 3)}
                          </p>
                        </div>

                        <div className="flex-1 flex flex-col items-center gap-1 px-2">
                          <p className="text-xs text-white/45">
                            {formatDuration(f.durationMinutes)}
                          </p>
                          <div className="w-full h-px bg-white/10 relative">
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-amber-400" />
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-amber-400" />
                            {f.stops > 0 && (
                              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-400 border border-[#1C1917]" />
                            )}
                          </div>
                          <Badge
                            variant={
                              f.stops === 0
                                ? 'success'
                                : f.stops === 1
                                  ? 'warning'
                                  : 'danger'
                            }
                            size="sm"
                          >
                            {f.stops === 0
                              ? 'Nonstop'
                              : f.stops === 1
                                ? '1 Stop'
                                : `${f.stops} Stops`}
                          </Badge>
                        </div>

                        <div>
                          <p className="text-xl font-bold text-white">
                            {formatTime(f.arrivalTime)}
                          </p>
                          <p className="text-xs text-white/45">
                            {f.destinationIata || destination.toUpperCase().slice(0, 3)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Badges column */}
                    <div className="flex flex-wrap md:flex-col items-start gap-2 md:items-end">
                      <Badge variant={dealColor(f.dealQuality)} size="sm">
                        {f.dealQuality} Deal
                      </Badge>
                      <Badge
                        variant={
                          getCarbonLevel(f.carbonKg) === 'Low'
                            ? 'success'
                            : getCarbonLevel(f.carbonKg) === 'Medium'
                              ? 'warning'
                              : 'danger'
                        }
                        size="sm"
                      >
                        {f.carbonKg} kg CO2
                      </Badge>
                      {/* Points badge */}
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-400/20">
                        ✈️ +{formatPoints(calculatePoints(f.price, 'free'))} pts
                      </span>
                      {/* Baggage indicator */}
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                        f.baggageIncluded
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-400/20'
                          : 'bg-white/5 text-white/40 border border-white/10'
                      }`}>
                        {f.baggageIncluded ? '🧳 Bag included' : '🎒 Cabin only'}
                      </span>
                      {/* Price vs average indicator */}
                      {(() => {
                        const prices = results.map((r) => r.price).filter((p) => p > 0);
                        if (prices.length < 3) return null;
                        const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
                        const pct = Math.round(((f.price - avg) / avg) * 100);
                        if (pct >= -3) return null; // not significantly below
                        return (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-400/20">
                            {pct}% vs avg
                          </span>
                        );
                      })()}
                    </div>

                    {/* Price + action */}
                    <div className="flex flex-row md:flex-col items-center md:items-end gap-3 md:gap-2 md:min-w-[140px]">
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <p className="text-2xl font-bold text-white">
                            ${f.price}
                          </p>
                          {/* Price level badge */}
                          {f.score >= 75 ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="14 10 10 6 7 9 2 4" />
                                <polyline points="10 10 14 10 14 6" />
                              </svg>
                              Low
                            </span>
                          ) : f.score >= 40 ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/8 text-white/50 border border-white/10">
                              Typical
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-500/15 text-orange-300 border border-orange-500/20">
                              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="14 6 10 10 7 7 2 12" />
                                <polyline points="10 6 14 6 14 10" />
                              </svg>
                              High
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/40">per person</p>
                        {/* Price volatility indicator */}
                        {f.dealQuality.toLowerCase() === 'excellent' && (
                          <p className="text-[10px] text-amber-400 mt-0.5 flex items-center justify-end gap-1">
                            <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M8 12V4M5 7l3-3 3 3" />
                            </svg>
                            Price likely to increase
                          </p>
                        )}
                        {f.dealQuality.toLowerCase() === 'good' && (
                          <p className="text-[10px] text-emerald-400 mt-0.5 flex items-center justify-end gap-1">
                            Good time to book
                          </p>
                        )}
                        {f.dealQuality.toLowerCase() === 'fair' && (
                          <p className="text-[10px] text-blue-400 mt-0.5 flex items-center justify-end gap-1">
                            <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M8 4v8M5 9l3 3 3-3" />
                            </svg>
                            Price may drop
                          </p>
                        )}
                        {f.dealQuality.toLowerCase() === 'poor' && (
                          <p className="text-[10px] text-white/40 mt-0.5 flex items-center justify-end gap-1">
                            Wait for better price
                          </p>
                        )}
                      </div>

                      {/* Score bar */}
                      <div className="flex items-center gap-2 w-full max-w-[120px]">
                        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${f.score}%`,
                              background:
                                f.score >= 85
                                  ? 'linear-gradient(90deg, #E8A317, #10b981)'
                                  : f.score >= 70
                                    ? 'linear-gradient(90deg, #F97316, #E8A317)'
                                    : 'linear-gradient(90deg, #f59e0b, #ef4444)',
                            }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-white/60">
                          {f.score}
                        </span>
                      </div>

                      {/* Favorite button */}
                      <FavoriteButton
                        item={{
                          kind: 'flight',
                          id: f.id,
                          airline: f.airline,
                          airlineCode: f.airlineCode,
                          origin: f.originIata || origin,
                          destination: f.destinationIata || destination,
                          originCity: f.originCity,
                          destinationCity: f.destinationCity,
                          departureTime: f.departureTime,
                          arrivalTime: f.arrivalTime,
                          durationMinutes: f.durationMinutes,
                          stops: f.stops,
                          price: f.price,
                          cabin: f.cabin || f.cabinClass || 'Economy',
                          dealQuality: f.dealQuality,
                          deepLink: f.deepLink,
                          logoUrl: f.logoUrl,
                          savedAt: Date.now(),
                        } satisfies FavoriteFlight}
                      />

                      {/* Alert button — quick mission creation */}
                      <Link
                        href={`/missions/new?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&departDate=${departDate}&budget=${Math.round(f.price * 1.1)}&autoBuy=${Math.round(f.price * 0.95)}`}
                        className="rounded-lg px-3 py-2 text-xs text-white/40 hover:text-amber-300 hover:bg-amber-500/5 transition"
                        title="Set price alert for this route"
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M8 2a4 4 0 00-4 4c0 3-1.5 4-1.5 4h11S12 10 12 6a4 4 0 00-4-4z" />
                          <path d="M6.5 13a1.5 1.5 0 003 0" />
                        </svg>
                      </Link>

                      {/* Share button */}
                      <button
                        type="button"
                        className="rounded-lg px-3 py-2 text-xs text-white/40 hover:text-white hover:bg-white/5 transition"
                        title="Share this deal"
                        onClick={() => shareDeal({
                          origin: f.originIata || origin,
                          destination: f.destinationIata || destination,
                          price: f.price,
                          airline: f.airline,
                          date: departDate,
                          url: f.deepLink || 'https://faregenie.vercel.app/flights',
                        })}
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 12v1a2 2 0 002 2h4a2 2 0 002-2v-1M12 5l-4-4-4 4M8 1v10" />
                        </svg>
                      </button>

                      {f.deepLink ? (
                        <a
                          href={f.deepLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="premium-button rounded-lg px-4 py-2 text-xs font-semibold text-white inline-flex items-center gap-1.5"
                          title="Book this flight on the carrier's partner site"
                        >
                          Book
                          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 3h7v7" />
                            <path d="M13 3L6 10" />
                            <path d="M11 13H3V5" />
                          </svg>
                        </a>
                      ) : (
                        <Link
                          href={`/flights/book?price=${f.price}&airline=${encodeURIComponent(f.airline)}&route=${origin}-${destination}&flight=${f.flightNumber || ''}&departure=${f.departureTime}&arrival=${f.arrivalTime}&duration=${f.durationMinutes}&stops=${f.stops}`}
                          className="premium-button rounded-lg px-4 py-2 text-xs font-semibold text-white"
                        >
                          Book
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Price History — shown after results */}
      {searched && !loading && flights.length > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PriceHistory
              currentPrice={flights.reduce((m, f) => Math.min(m, f.price), Infinity)}
              route={`${origin.toUpperCase()} → ${destination.toUpperCase()}`}
              origin={origin}
              destination={destination}
            />
            <PriceComparator
              flightPrice={flights.reduce((m, f) => Math.min(m, f.price), Infinity)}
              route={`${origin.toUpperCase()} → ${destination.toUpperCase()}`}
              origin={origin}
              destination={destination}
              departDate={departDate}
              returnDate={returnDate}
              passengers={passengers}
              cabin={cabin}
              airline={flights[0]?.airline || ''}
              deepLink={flights[0]?.deepLink}
            />
          </div>

          {/* Destination info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <WeatherWidget destination={destination} startDate={departDate} />
            <CurrencyConverter compact={false} />
          </div>
          <DestinationGuide destination={destination} />
        </>
      )}

      {/* Flight detail modal */}
      {selectedFlight && (
        <FlightDetailModal
          flight={selectedFlight}
          origin={origin}
          destination={destination}
          departDate={departDate}
          onClose={() => setSelectedFlight(null)}
        />
      )}

      {/* Floating compare bar */}
      {compareSet.size >= 2 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl"
          style={{
            background: 'rgba(28,25,23,0.92)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(245,158,11,0.25)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="rgba(245,158,11,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="1" width="5" height="14" rx="1" />
            <rect x="10" y="4" width="5" height="11" rx="1" />
          </svg>
          <span className="text-sm text-white/80 font-medium">
            {compareSet.size} flights selected
          </span>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setShowComparison(true)}
          >
            Compare
          </Button>
          <button
            className="text-xs text-white/40 hover:text-white/70 transition ml-1"
            onClick={() => setCompareSet(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      {/* Flight comparison modal */}
      {showComparison && (
        <FlightComparisonModal
          flights={flights.filter((f) => compareSet.has(f.id))}
          onClose={() => setShowComparison(false)}
          origin={origin}
          destination={destination}
          departDate={departDate}
        />
      )}
    </div>
  );
}
