'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFavoritesStore } from '@/lib/store/favorites-store';
import { WeatherWidget } from '@/components/weather-widget';
import { DestinationGuide } from '@/components/destination-guide';
import { CurrencyConverter } from '@/components/currency-converter';

export default function ItineraryPage() {
  const favorites = useFavoritesStore((s) => s.items);
  const flights = favorites.filter((i) => i.kind === 'flight');
  const hotels = favorites.filter((i) => i.kind === 'hotel');

  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');

  useEffect(() => {
    // Auto-detect destination from saved items
    if (flights.length > 0 && flights[0].kind === 'flight') {
      setDestination(flights[0].destinationCity || flights[0].destination || '');
      setStartDate(flights[0].departureTime?.split('T')[0] || new Date().toISOString().split('T')[0]);
    } else if (hotels.length > 0 && hotels[0].kind === 'hotel') {
      setDestination(hotels[0].name.split(' ').slice(-1)[0] || '');
      setStartDate(new Date().toISOString().split('T')[0]);
    }
  }, [flights, hotels]);

  const totalFlightCost = flights.reduce((sum, f) => sum + (f.kind === 'flight' ? f.price : 0), 0);
  const totalHotelCost = hotels.reduce((sum, h) => sum + (h.kind === 'hotel' ? h.totalPrice : 0), 0);
  const grandTotal = totalFlightCost + totalHotelCost;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
          <span className="text-2xl">📋</span>
          Trip Itinerary
        </h1>
        <p className="text-sm text-white/40 mt-1">
          Your complete trip overview — flights, hotels, and travel info
        </p>
      </div>

      {/* Summary card */}
      <Card padding="lg" className="glass-premium">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Flights</p>
            <p className="text-xl font-bold text-white">{flights.length}</p>
            <p className="text-xs text-white/40">${totalFlightCost}</p>
          </div>
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Hotels</p>
            <p className="text-xl font-bold text-white">{hotels.length}</p>
            <p className="text-xs text-white/40">${totalHotelCost}</p>
          </div>
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Total</p>
            <p className="text-xl font-bold text-amber-400">${grandTotal}</p>
          </div>
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Destination</p>
            <p className="text-xl font-bold text-white">{destination || '—'}</p>
          </div>
        </div>
      </Card>

      {/* Empty state */}
      {favorites.length === 0 && (
        <Card padding="lg" className="text-center py-12">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-white mb-2">Build your itinerary</h3>
          <p className="text-sm text-white/40 max-w-sm mx-auto mb-6">
            Save flights and hotels to your favorites, then come here to see your complete trip plan with weather, travel guides, and more.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/flights"><Button variant="primary" size="md">Search Flights</Button></Link>
            <Link href="/hotels"><Button variant="secondary" size="md">Search Hotels</Button></Link>
          </div>
        </Card>
      )}

      {/* Flights section */}
      {flights.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            Flights
          </h2>
          {flights.map((f) => f.kind === 'flight' && (
            <Card key={f.id} padding="md" className="stagger-item">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl glass flex items-center justify-center">
                  {f.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.logoUrl} alt={f.airline} className="w-full h-full object-contain rounded-xl" />
                  ) : (
                    <span className="text-xs font-bold text-amber-400">{f.airlineCode}</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{f.originCity || f.origin} → {f.destinationCity || f.destination}</p>
                  <p className="text-xs text-white/40">{f.airline} · {f.stops === 0 ? 'Nonstop' : `${f.stops} stops`} · {f.cabin}</p>
                </div>
                <p className="text-lg font-bold text-white">${f.price}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Hotels section */}
      {hotels.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            Hotels
          </h2>
          {hotels.map((h) => h.kind === 'hotel' && (
            <Card key={h.id} padding="md" className="stagger-item">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/5 flex-shrink-0">
                  {h.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={h.photo} alt={h.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg">H</div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{h.name}</p>
                  <p className="text-xs text-white/40">{'★'.repeat(h.stars)} · {h.rating.toFixed(1)} · {h.nights} nights</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-white">${h.totalPrice}</p>
                  <p className="text-[10px] text-white/30">${h.pricePerNight}/night</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Travel info widgets */}
      {destination && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-white">🌍 Destination Info</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <WeatherWidget destination={destination} startDate={startDate || new Date().toISOString().split('T')[0]} />
            <CurrencyConverter compact={false} />
          </div>
          <DestinationGuide destination={destination} />
        </div>
      )}

      {/* Share button */}
      {favorites.length > 0 && (
        <div className="text-center pt-4">
          <button
            onClick={async () => {
              try {
                const sharePayload = {
                  title: destination ? `Trip to ${destination}` : 'My Trip',
                  flights: flights
                    .filter((f): f is Extract<typeof f, { kind: 'flight' }> => f.kind === 'flight')
                    .map((f) => ({
                      airline: f.airline,
                      route: `${f.originCity || f.origin} → ${f.destinationCity || f.destination}`,
                      price: f.price,
                      date: f.departureTime?.split('T')[0] || '',
                      deepLink: f.deepLink,
                    })),
                  hotels: hotels
                    .filter((h): h is Extract<typeof h, { kind: 'hotel' }> => h.kind === 'hotel')
                    .map((h) => ({
                      name: h.name,
                      address: h.address,
                      pricePerNight: h.pricePerNight,
                      nights: h.nights,
                      totalPrice: h.totalPrice,
                    })),
                  cars: [],
                  totalPrice: grandTotal,
                  destination,
                  destinationCoords:
                    hotels.length > 0 && hotels[0].kind === 'hotel'
                      ? { lat: hotels[0].lat, lng: hotels[0].lng }
                      : undefined,
                };

                const res = await fetch('/api/trips/share', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(sharePayload),
                });

                if (!res.ok) throw new Error('Failed to create share link');
                const { url } = await res.json();

                await navigator.clipboard.writeText(url);
                toast.success('Share link copied to clipboard!', {
                  description: url,
                  duration: 4000,
                });
              } catch (_) {
                toast.error('Failed to create share link. Please try again.');
              }
            }}
            className="glass rounded-xl px-6 py-3 text-sm text-white/60 hover:text-white transition inline-flex items-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share Trip
          </button>
        </div>
      )}
    </div>
  );
}
