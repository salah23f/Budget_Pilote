'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AirportInput, type AirportSelection } from '@/components/ui/airport-input';
import { WeatherWidget } from '@/components/weather-widget';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface TripState {
  // Step 1: Destination
  origin: string;
  originCode: string;
  destination: string;
  destinationCode: string;
  departDate: string;
  returnDate: string;
  passengers: number;
  // Step 2: Flight
  selectedFlight: any | null;
  flights: any[];
  // Step 3: Hotel
  selectedHotel: any | null;
  hotels: any[];
  // Step 4: Car
  wantsCar: boolean;
  selectedCar: any | null;
  cars: any[];
  // Step 5: Insurance
  wantsInsurance: boolean;
  insurancePlan: 'basic' | 'standard' | 'premium' | null;
}

const INSURANCE_PRICES: Record<string, number> = { basic: 29, standard: 49, premium: 79 };

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export default function TripBuilderPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [trip, setTrip] = useState<TripState>({
    origin: '', originCode: '', destination: '', destinationCode: '',
    departDate: '', returnDate: '', passengers: 1,
    selectedFlight: null, flights: [],
    selectedHotel: null, hotels: [],
    wantsCar: false, selectedCar: null, cars: [],
    wantsInsurance: false, insurancePlan: null,
  });

  const update = useCallback((partial: Partial<TripState>) => {
    setTrip((prev) => ({ ...prev, ...partial }));
  }, []);

  // Calculate totals
  const flightCost = trip.selectedFlight?.price || 0;
  const hotelCost = trip.selectedHotel?.totalPrice || 0;
  const carCost = trip.selectedCar?.priceTotal || 0;
  const insuranceCost = trip.insurancePlan ? (INSURANCE_PRICES[trip.insurancePlan] || 0) * trip.passengers : 0;
  const totalCost = flightCost + hotelCost + carCost + insuranceCost;

  const days = trip.departDate && trip.returnDate
    ? Math.max(1, Math.ceil((new Date(trip.returnDate).getTime() - new Date(trip.departDate).getTime()) / 86400000))
    : 1;

  // Step handlers
  async function searchFlights() {
    setLoading(true);
    try {
      const res = await fetch('/api/flights/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: trip.originCode, destination: trip.destinationCode,
          departDate: trip.departDate, returnDate: trip.returnDate,
          adults: trip.passengers, cabinClass: 'economy',
        }),
      });
      const data = await res.json();
      if (data.success) update({ flights: (data.data || []).slice(0, 8) });
    } catch {}
    setLoading(false);
  }

  async function searchHotels() {
    setLoading(true);
    try {
      const res = await fetch('/api/hotels/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trip.destination || trip.destinationCode,
          checkIn: trip.departDate, checkOut: trip.returnDate,
          adults: trip.passengers, rooms: 1,
        }),
      });
      const data = await res.json();
      if (data.success) update({ hotels: (data.data || []).slice(0, 8) });
    } catch {}
    setLoading(false);
  }

  async function searchCars() {
    setLoading(true);
    try {
      const res = await fetch('/api/cars/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupLocation: trip.destination || trip.destinationCode,
          pickupDate: trip.departDate, dropoffDate: trip.returnDate,
        }),
      });
      const data = await res.json();
      if (data.success) update({ cars: (data.data || []).slice(0, 8) });
    } catch {}
    setLoading(false);
  }

  function nextStep() {
    const next = step + 1;
    setStep(next);
    // Auto-search when entering steps
    if (next === 1 && trip.flights.length === 0) searchFlights();
    if (next === 2 && trip.hotels.length === 0) searchHotels();
    if (next === 3 && trip.cars.length === 0) searchCars();
  }

  const STEPS = [
    { label: 'Destination', icon: '🗺️' },
    { label: 'Flight', icon: '✈️' },
    { label: 'Hotel', icon: '🏨' },
    { label: 'Car', icon: '🚗' },
    { label: 'Insurance', icon: '🛡️' },
    { label: 'Summary', icon: '📋' },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--flyeas-gradient)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          </div>
          Trip Builder
        </h1>
        <p className="text-sm text-white/40 mt-1">Build your perfect trip step by step</p>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <button
              onClick={() => i <= step ? setStep(i) : null}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all ${
                i < step ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : i === step ? 'text-white border-2 border-amber-500' : 'bg-white/5 text-white/20'
              }`}
              style={i === step ? { background: 'var(--flyeas-gradient)' } : undefined}
            >
              {i < step ? '✓' : s.icon}
            </button>
            <span className={`text-[9px] ${i <= step ? 'text-white/60' : 'text-white/20'}`}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Running total */}
      {totalCost > 0 && (
        <div className="glass rounded-xl px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs text-white/40">Running total</span>
          <div className="flex items-center gap-3">
            {flightCost > 0 && <span className="text-[10px] text-white/30">✈️ ${flightCost}</span>}
            {hotelCost > 0 && <span className="text-[10px] text-white/30">🏨 ${hotelCost}</span>}
            {carCost > 0 && <span className="text-[10px] text-white/30">🚗 ${carCost}</span>}
            {insuranceCost > 0 && <span className="text-[10px] text-white/30">🛡️ ${insuranceCost}</span>}
            <span className="text-base font-bold text-amber-400">${totalCost}</span>
          </div>
        </div>
      )}

      {/* ── Step 0: Destination ── */}
      {step === 0 && (
        <Card padding="lg" className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Where are you going?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AirportInput label="From" placeholder="City or airport..." value={trip.originCode}
              onChange={(sel: AirportSelection) => update({ origin: sel.code, originCode: sel.code })} />
            <AirportInput label="To" placeholder="City or airport..." value={trip.destinationCode}
              onChange={(sel: AirportSelection) => update({ destination: sel.code, destinationCode: sel.code })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Departure" type="date" value={trip.departDate} onChange={(e) => update({ departDate: e.target.value })} />
            <Input label="Return" type="date" value={trip.returnDate} onChange={(e) => update({ returnDate: e.target.value })} />
            <Input label="Passengers" type="number" min={1} max={9} value={trip.passengers} onChange={(e) => update({ passengers: Number(e.target.value) })} />
          </div>
          {trip.destination && trip.departDate && (
            <WeatherWidget destination={trip.destination} startDate={trip.departDate} days={Math.min(days, 7)} />
          )}
          <Button variant="primary" size="lg" fullWidth onClick={nextStep}
            disabled={!trip.originCode || !trip.destinationCode || !trip.departDate || !trip.returnDate}>
            Find Flights →
          </Button>
        </Card>
      )}

      {/* ── Step 1: Flights ── */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Pick your flight</h2>
          {loading && (
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-white/60">Searching live flights...</p>
            </div>
          )}
          {trip.flights.map((f: any) => (
            <Card key={f.id} hoverable padding="md"
              className={`cursor-pointer transition-all ${trip.selectedFlight?.id === f.id ? 'ring-2 ring-amber-500/50' : ''}`}
              onClick={() => update({ selectedFlight: f })}
            >
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{f.airline}</p>
                  <p className="text-xs text-white/40">
                    {f.stops === 0 ? 'Nonstop' : `${f.stops} stop${f.stops > 1 ? 's' : ''}`} ·
                    {Math.floor(f.durationMinutes / 60)}h {f.durationMinutes % 60}m
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-white">${f.price}</p>
                  {f.dealQuality && <Badge variant={f.dealQuality === 'excellent' ? 'success' : 'default'} size="sm">{f.dealQuality}</Badge>}
                </div>
                {trip.selectedFlight?.id === f.id && <span className="text-emerald-400 text-lg">✓</span>}
              </div>
            </Card>
          ))}
          {!loading && trip.flights.length === 0 && (
            <Card padding="md"><p className="text-sm text-white/40 text-center">No flights found. Try different dates.</p></Card>
          )}
          <div className="flex gap-3">
            <Button variant="ghost" size="md" onClick={() => setStep(0)}>← Back</Button>
            <Button variant="primary" size="lg" className="flex-1" onClick={nextStep} disabled={!trip.selectedFlight}>
              Pick Hotel →
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Hotels ── */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Pick your hotel</h2>
          {loading && (
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-white/60">Searching hotels...</p>
            </div>
          )}
          {trip.hotels.map((h: any) => (
            <Card key={h.id || h.name} hoverable padding="md"
              className={`cursor-pointer transition-all ${trip.selectedHotel?.id === h.id ? 'ring-2 ring-amber-500/50' : ''}`}
              onClick={() => update({ selectedHotel: h })}
            >
              <div className="flex items-center gap-4">
                {h.photos?.[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={h.photos[0]} alt={h.name} className="w-16 h-12 rounded-lg object-cover" loading="lazy" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{h.name}</p>
                  <p className="text-xs text-white/40">
                    {'★'.repeat(h.stars || 0)} · {h.rating?.toFixed(1) || '—'}
                    {h.amenities?.slice(0, 3).map((a: string) => ` · ${a}`).join('')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-white">${h.totalPrice || h.pricePerNight || '—'}</p>
                  <p className="text-[10px] text-white/30">{days} nights</p>
                </div>
                {trip.selectedHotel?.id === h.id && <span className="text-emerald-400 text-lg">✓</span>}
              </div>
            </Card>
          ))}
          {!loading && trip.hotels.length === 0 && (
            <Card padding="md"><p className="text-sm text-white/40 text-center">No hotels found.</p></Card>
          )}
          <div className="flex gap-3">
            <Button variant="ghost" size="md" onClick={() => setStep(1)}>← Back</Button>
            <Button variant="primary" size="lg" className="flex-1" onClick={nextStep}>
              {trip.selectedHotel ? 'Add Car? →' : 'Skip Hotel →'}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Car Rental ── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Need a car?</h2>
            <button
              onClick={() => { update({ wantsCar: false, selectedCar: null }); nextStep(); }}
              className="text-xs text-white/30 hover:text-white/60 transition"
            >
              Skip this step →
            </button>
          </div>
          {loading && (
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-white/60">Searching car rentals...</p>
            </div>
          )}
          {trip.cars.slice(0, 6).map((c: any) => (
            <Card key={c.id} hoverable padding="md"
              className={`cursor-pointer transition-all ${trip.selectedCar?.id === c.id ? 'ring-2 ring-amber-500/50' : ''}`}
              onClick={() => update({ selectedCar: c, wantsCar: true })}
            >
              <div className="flex items-center gap-4">
                <span className="text-3xl">🚗</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{c.carName}</p>
                  <p className="text-xs text-white/40">{c.carType} · {c.seats} seats · {c.transmission} · via {c.provider}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-white">${c.priceTotal}</p>
                  <p className="text-[10px] text-white/30">${c.pricePerDay}/day</p>
                </div>
                {trip.selectedCar?.id === c.id && <span className="text-emerald-400 text-lg">✓</span>}
              </div>
            </Card>
          ))}
          <div className="flex gap-3">
            <Button variant="ghost" size="md" onClick={() => setStep(2)}>← Back</Button>
            <Button variant="primary" size="lg" className="flex-1" onClick={nextStep}>
              {trip.selectedCar ? 'Add Insurance? →' : 'Skip →'}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 4: Insurance ── */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Protect your trip?</h2>
            <button
              onClick={() => { update({ wantsInsurance: false, insurancePlan: null }); nextStep(); }}
              className="text-xs text-white/30 hover:text-white/60 transition"
            >
              Skip this step →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(['basic', 'standard', 'premium'] as const).map((plan) => {
              const price = INSURANCE_PRICES[plan] * trip.passengers;
              const selected = trip.insurancePlan === plan;
              return (
                <Card key={plan} hoverable padding="md"
                  className={`cursor-pointer text-center ${selected ? 'ring-2 ring-amber-500/50' : ''}`}
                  onClick={() => update({ insurancePlan: plan, wantsInsurance: true })}
                >
                  <p className="text-lg mb-1">🛡️</p>
                  <p className="text-sm font-bold text-white capitalize">{plan}</p>
                  <p className="text-xl font-bold text-amber-400 mt-1">${price}</p>
                  <p className="text-[10px] text-white/30">{trip.passengers} traveler{trip.passengers > 1 ? 's' : ''}</p>
                  {plan === 'standard' && <Badge variant="highlight" size="sm" className="mt-2">Popular</Badge>}
                  {selected && <span className="text-emerald-400 block mt-2">✓ Selected</span>}
                </Card>
              );
            })}
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" size="md" onClick={() => setStep(3)}>← Back</Button>
            <Button variant="primary" size="lg" className="flex-1" onClick={nextStep}>
              View Summary →
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 5: Summary ── */}
      {step === 5 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Your Trip Summary</h2>

          {/* Grand total */}
          <Card padding="lg" className="glass-premium text-center">
            <p className="text-xs text-white/40 uppercase tracking-wider">Total Trip Cost</p>
            <p className="text-4xl font-bold text-amber-400 mt-2">${totalCost}</p>
            <p className="text-xs text-white/30 mt-1">{trip.passengers} passenger{trip.passengers > 1 ? 's' : ''} · {days} days</p>
          </Card>

          {/* Breakdown */}
          <div className="space-y-3">
            {/* Flight */}
            {trip.selectedFlight && (
              <Card padding="md" className="stagger-item">
                <div className="flex items-center gap-3">
                  <span className="text-xl">✈️</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{trip.selectedFlight.airline}</p>
                    <p className="text-xs text-white/40">{trip.originCode} → {trip.destinationCode} · {trip.selectedFlight.stops === 0 ? 'Nonstop' : `${trip.selectedFlight.stops} stops`}</p>
                  </div>
                  <p className="text-lg font-bold text-white">${flightCost}</p>
                </div>
              </Card>
            )}

            {/* Hotel */}
            {trip.selectedHotel && (
              <Card padding="md" className="stagger-item">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🏨</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{trip.selectedHotel.name}</p>
                    <p className="text-xs text-white/40">{days} nights · {'★'.repeat(trip.selectedHotel.stars || 0)}</p>
                  </div>
                  <p className="text-lg font-bold text-white">${hotelCost}</p>
                </div>
              </Card>
            )}

            {/* Car */}
            {trip.selectedCar && (
              <Card padding="md" className="stagger-item">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🚗</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{trip.selectedCar.carName}</p>
                    <p className="text-xs text-white/40">{trip.selectedCar.carType} · {days} days · via {trip.selectedCar.provider}</p>
                  </div>
                  <p className="text-lg font-bold text-white">${carCost}</p>
                </div>
              </Card>
            )}

            {/* Insurance */}
            {trip.insurancePlan && (
              <Card padding="md" className="stagger-item">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🛡️</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white capitalize">{trip.insurancePlan} Insurance</p>
                    <p className="text-xs text-white/40">via VisitorsCoverage · {trip.passengers} traveler{trip.passengers > 1 ? 's' : ''}</p>
                  </div>
                  <p className="text-lg font-bold text-white">${insuranceCost}</p>
                </div>
              </Card>
            )}
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
            <Button variant="primary" size="lg" fullWidth onClick={() => {
              // Share trip summary
              const text = `My trip to ${trip.destinationCode}:\n✈️ ${trip.selectedFlight?.airline || '—'} $${flightCost}\n🏨 ${trip.selectedHotel?.name || '—'} $${hotelCost}\n🚗 ${trip.selectedCar?.carName || '—'} $${carCost}\n🛡️ ${trip.insurancePlan || '—'} $${insuranceCost}\n\nTotal: $${totalCost}\n\nPlanned with Flyeas ✈️`;
              if (navigator.share) {
                navigator.share({ title: `Trip to ${trip.destinationCode}`, text, url: 'https://faregenie.vercel.app' });
              } else {
                navigator.clipboard.writeText(text);
                alert('Trip summary copied!');
              }
            }}>
              📤 Share Trip
            </Button>
            <Link href={`/missions/new?origin=${trip.originCode}&destination=${trip.destinationCode}&departDate=${trip.departDate}&budget=${Math.round(totalCost * 1.1)}`}>
              <Button variant="secondary" size="lg" fullWidth>
                🎯 Create Mission to Monitor
              </Button>
            </Link>
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" size="md" onClick={() => setStep(4)}>← Back</Button>
          </div>
        </div>
      )}
    </div>
  );
}
