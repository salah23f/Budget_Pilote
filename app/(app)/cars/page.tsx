'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

/* ------------------------------------------------------------------ */
/*  Types (mirrors lib/amadeus/cars.ts CarResult)                       */
/* ------------------------------------------------------------------ */

interface CarResult {
  id: string;
  provider: string;
  providerLogo?: string;
  carName: string;
  carType: string;
  carImage?: string;
  seats: number;
  bags: number;
  transmission: string;
  hasAC: boolean;
  fuelPolicy: string;
  mileage: string;
  priceTotal: number;
  pricePerDay: number;
  currency: string;
  pickupLocation: string;
  dropoffLocation: string;
  deepLink?: string;
  rating?: number;
  features: string[];
}

/* ------------------------------------------------------------------ */
/*  Car type icons                                                      */
/* ------------------------------------------------------------------ */

function CarIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 17h14M5 17a2 2 0 01-2-2V9a1 1 0 011-1h1l2-4h10l2 4h1a1 1 0 011 1v6a2 2 0 01-2 2M5 17a2 2 0 002 2h10a2 2 0 002-2" />
      <circle cx="7.5" cy="15.5" r="1.5" /><circle cx="16.5" cy="15.5" r="1.5" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export default function CarsPage() {
  const [location, setLocation] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [dropoffDate, setDropoffDate] = useState('');
  const [results, setResults] = useState<CarResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'price' | 'type' | 'seats'>('price');

  const days = pickupDate && dropoffDate
    ? Math.max(1, Math.ceil((new Date(dropoffDate).getTime() - new Date(pickupDate).getTime()) / 86400000))
    : 1;

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!location || !pickupDate || !dropoffDate) return;

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const res = await fetch('/api/cars/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickupLocation: location, pickupDate, dropoffDate }),
      });

      const data = await res.json();
      if (data.success) {
        setResults(data.data || []);
      } else {
        setError(data.error || 'Search failed');
        setResults([]);
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
      setResults([]);
    }

    setLoading(false);
  }

  // Available car types for filter
  const carTypes = useMemo(() => {
    const types = new Set(results.map((r) => r.carType));
    return Array.from(types).sort();
  }, [results]);

  // Filtered & sorted results
  const filtered = useMemo(() => {
    let list = typeFilter === 'all' ? [...results] : results.filter((r) => r.carType === typeFilter);
    switch (sortBy) {
      case 'price': list.sort((a, b) => a.priceTotal - b.priceTotal); break;
      case 'seats': list.sort((a, b) => b.seats - a.seats); break;
      case 'type': list.sort((a, b) => a.carType.localeCompare(b.carType)); break;
    }
    return list;
  }, [results, typeFilter, sortBy]);

  // Group by car type for display
  const bestPerType = useMemo(() => {
    const map = new Map<string, CarResult>();
    for (const r of [...results].sort((a, b) => a.priceTotal - b.priceTotal)) {
      if (!map.has(r.carType)) map.set(r.carType, r);
    }
    return Array.from(map.values());
  }, [results]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.12)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17h14M5 17a2 2 0 01-2-2V9a1 1 0 011-1h1l2-4h10l2 4h1a1 1 0 011 1v6a2 2 0 01-2 2M5 17a2 2 0 002 2h10a2 2 0 002-2"/><circle cx="7.5" cy="15.5" r="1.5"/><circle cx="16.5" cy="15.5" r="1.5"/></svg>
          </div>
          Car Rental
        </h1>
        <p className="text-sm text-white/40 mt-1">Compare real-time prices from top rental companies</p>
      </div>

      {/* Search form */}
      <Card padding="lg">
        <form onSubmit={handleSearch}>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <Input label="Pick-up Location" placeholder="City or airport..." value={location} onChange={(e) => setLocation(e.target.value)} />
            <Input label="Pick-up Date" type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
            <Input label="Return Date" type="date" value={dropoffDate} onChange={(e) => setDropoffDate(e.target.value)} />
            <Button type="submit" variant="primary" size="lg" fullWidth disabled={loading}>
              {loading ? 'Searching...' : 'Search Cars'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Error */}
      {error && (
        <Card padding="md" className="border border-amber-500/30">
          <p className="text-sm text-amber-300">{error}</p>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-white/60">Searching car rentals in {location}...</p>
        </div>
      )}

      {/* Results */}
      {searched && !loading && results.length > 0 && (
        <div className="space-y-4">
          {/* Summary + filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-white/50">
              <span className="text-white font-semibold">{results.length}</span> cars found · {days} day{days > 1 ? 's' : ''} · {location}
            </p>
            <div className="flex gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="glass-input rounded-lg py-1.5 px-2.5 text-xs"
              >
                <option value="all">All types</option>
                {carTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="glass-input rounded-lg py-1.5 px-2.5 text-xs"
              >
                <option value="price">Cheapest first</option>
                <option value="seats">Most seats</option>
                <option value="type">By type</option>
              </select>
            </div>
          </div>

          {/* Best deals summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {bestPerType.slice(0, 4).map((car) => (
              <div key={car.carType} className="glass rounded-xl p-3 text-center">
                <span className="text-2xl">{<CarIcon className="text-amber-400" />}</span>
                <p className="text-xs font-medium text-white mt-1">{car.carType}</p>
                <p className="text-sm font-bold text-amber-400">from ${car.pricePerDay}/day</p>
              </div>
            ))}
          </div>

          {/* Car cards */}
          <div className="space-y-3">
            {filtered.map((car) => (
              <Card key={car.id} hoverable padding="none" className="overflow-hidden card-interactive stagger-item">
                <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Car image or icon */}
                  <div className="w-16 h-16 rounded-xl glass flex items-center justify-center flex-shrink-0">
                    {car.carImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={car.carImage} alt={car.carName} className="w-full h-full object-contain rounded-xl" />
                    ) : (
                      <span className="text-3xl">{<CarIcon className="text-amber-400" />}</span>
                    )}
                  </div>

                  {/* Car info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-white">{car.carName}</span>
                      <Badge variant="default" size="sm">{car.carType}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-white/40">
                      <span>👤 {car.seats} seats</span>
                      <span>🧳 {car.bags} bags</span>
                      <span>⚙️ {car.transmission}</span>
                      {car.hasAC && <span>❄️ A/C</span>}
                      <span>⛽ {car.fuelPolicy}</span>
                      <span>📏 {car.mileage}</span>
                    </div>
                    {car.features.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {car.features.map((f) => (
                          <span key={f} className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/10 text-emerald-300 border border-emerald-400/20">{f}</span>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-white/25 mt-1.5">
                      via <span className="text-white/40">{car.provider}</span>
                      {car.rating && <span> · ★ {car.rating.toFixed(1)}</span>}
                    </p>
                  </div>

                  {/* Price + book */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xl font-bold text-white">${car.priceTotal}</p>
                      <p className="text-[10px] text-white/30">${car.pricePerDay}/day · {days} days</p>
                    </div>
                    <a
                      href={car.deepLink || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="primary" size="sm">Book</Button>
                    </a>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {searched && !loading && results.length === 0 && !error && (
        <Card padding="lg" className="text-center">
          <p className="text-white/50 text-sm">No cars found for this location and dates. Try a different city.</p>
        </Card>
      )}
    </div>
  );
}
