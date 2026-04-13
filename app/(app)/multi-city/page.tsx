'use client';

import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AirportInput, type AirportSelection } from '@/components/ui/airport-input';
import { Input } from '@/components/ui/input';

interface Leg {
  id: string;
  origin: string;
  originCode: string;
  destination: string;
  destinationCode: string;
  date: string;
}

export default function MultiCityPage() {
  const [legs, setLegs] = useState<Leg[]>([
    { id: '1', origin: '', originCode: '', destination: '', destinationCode: '', date: '' },
    { id: '2', origin: '', originCode: '', destination: '', destinationCode: '', date: '' },
  ]);
  const [passengers, setPassengers] = useState(1);
  const [cabin, setCabin] = useState('economy');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [totalEstimate, setTotalEstimate] = useState(0);

  const addLeg = useCallback(() => {
    if (legs.length >= 6) return;
    const lastLeg = legs[legs.length - 1];
    setLegs((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        origin: lastLeg.destination,
        originCode: lastLeg.destinationCode,
        destination: '',
        destinationCode: '',
        date: '',
      },
    ]);
  }, [legs]);

  const removeLeg = useCallback((id: string) => {
    if (legs.length <= 2) return;
    setLegs((prev) => prev.filter((l) => l.id !== id));
  }, [legs.length]);

  const updateLeg = useCallback((id: string, field: keyof Leg, value: string) => {
    setLegs((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  }, []);

  async function handleSearch() {
    setLoading(true);
    setSearched(true);

    // Search each leg independently
    const legResults = [];
    let total = 0;

    for (const leg of legs) {
      if (!leg.originCode || !leg.destinationCode || !leg.date) continue;
      try {
        const res = await fetch('/api/flights/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin: leg.originCode,
            destination: leg.destinationCode,
            departDate: leg.date,
            adults: passengers,
            cabinClass: cabin,
          }),
        });
        const data = await res.json();
        if (data.success && data.data?.length > 0) {
          const cheapest = data.data.reduce((min: any, f: any) => (f.price < min.price ? f : min), data.data[0]);
          legResults.push({ leg, flight: cheapest, allFlights: data.data.slice(0, 5) });
          total += cheapest.price;
        } else {
          legResults.push({ leg, flight: null, allFlights: [] });
        }
      } catch {
        legResults.push({ leg, flight: null, allFlights: [] });
      }
    }

    setResults(legResults);
    setTotalEstimate(total);
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
          <span className="text-2xl">🗺️</span>
          Multi-City Trip
        </h1>
        <p className="text-sm text-white/40 mt-1">Plan a trip with multiple stops in one search</p>
      </div>

      {/* Legs builder */}
      <Card padding="lg">
        <div className="space-y-4">
          {legs.map((leg, i) => (
            <div key={leg.id} className="flex items-end gap-3 stagger-item">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: 'var(--flyeas-gradient)', color: 'white' }}
                >
                  {i + 1}
                </div>
              </div>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <AirportInput
                  label={i === 0 ? 'From' : 'From'}
                  placeholder="City..."
                  value={leg.originCode}
                  onChange={(sel: AirportSelection) => {
                    updateLeg(leg.id, 'origin', sel.name || sel.code);
                    updateLeg(leg.id, 'originCode', sel.code);
                  }}
                />
                <AirportInput
                  label="To"
                  placeholder="City..."
                  value={leg.destinationCode}
                  onChange={(sel: AirportSelection) => {
                    updateLeg(leg.id, 'destination', sel.name || sel.code);
                    updateLeg(leg.id, 'destinationCode', sel.code);
                  }}
                />
                <Input
                  label="Date"
                  type="date"
                  value={leg.date}
                  onChange={(e) => updateLeg(leg.id, 'date', e.target.value)}
                />
              </div>
              {legs.length > 2 && (
                <button
                  onClick={() => removeLeg(leg.id)}
                  className="p-2 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition mb-2"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          ))}

          <div className="flex items-center gap-3 pt-2">
            {legs.length < 6 && (
              <button
                onClick={addLeg}
                className="flex items-center gap-2 text-xs text-amber-400/70 hover:text-amber-300 transition"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                Add another city
              </button>
            )}
            <span className="text-[10px] text-white/20">{legs.length}/6 legs</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Input
              label="Passengers"
              type="number"
              min={1}
              max={9}
              value={passengers}
              onChange={(e) => setPassengers(Number(e.target.value))}
            />
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Cabin</label>
              <select
                value={cabin}
                onChange={(e) => setCabin(e.target.value)}
                className="glass-input w-full rounded-xl py-2.5 px-3 text-sm"
              >
                <option value="economy">Economy</option>
                <option value="premium_economy">Premium Economy</option>
                <option value="business">Business</option>
                <option value="first">First</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={loading}
                onClick={handleSearch}
              >
                {loading ? 'Searching...' : 'Search All Legs'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Results */}
      {searched && !loading && results.length > 0 && (
        <div className="space-y-4">
          {/* Total */}
          {totalEstimate > 0 && (
            <Card padding="md" className="text-center">
              <p className="text-xs text-white/40">Estimated total</p>
              <p className="text-3xl font-bold text-amber-400">${totalEstimate}</p>
              <p className="text-xs text-white/30 mt-1">for {passengers} passenger{passengers > 1 ? 's' : ''} · {results.length} flights</p>
            </Card>
          )}

          {/* Per-leg results */}
          {results.map((r: any, i: number) => (
            <Card key={i} hoverable padding="md" className="stagger-item">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--flyeas-gradient)', color: 'white' }}>
                  {i + 1}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">
                    {r.leg.origin || r.leg.originCode} → {r.leg.destination || r.leg.destinationCode}
                  </p>
                  <p className="text-xs text-white/40">{new Date(r.leg.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                </div>
                {r.flight ? (
                  <div className="text-right">
                    <p className="text-lg font-bold text-white">${r.flight.price}</p>
                    <p className="text-[10px] text-white/30">{r.flight.airline}</p>
                  </div>
                ) : (
                  <Badge variant="warning" size="sm">No flights found</Badge>
                )}
              </div>
              {r.flight && (
                <div className="flex items-center gap-4 text-xs text-white/50">
                  <span>{r.flight.stops === 0 ? 'Nonstop' : `${r.flight.stops} stop${r.flight.stops > 1 ? 's' : ''}`}</span>
                  <span>·</span>
                  <span>{Math.floor(r.flight.durationMinutes / 60)}h {r.flight.durationMinutes % 60}m</span>
                  {r.allFlights.length > 1 && (
                    <>
                      <span>·</span>
                      <span className="text-amber-400/60">{r.allFlights.length} options</span>
                    </>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-white/60">Searching {legs.length} legs...</p>
          </div>
        </div>
      )}
    </div>
  );
}
