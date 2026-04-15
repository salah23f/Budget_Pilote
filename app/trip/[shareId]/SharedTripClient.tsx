'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/*  SVG Icons                                                           */
/* ------------------------------------------------------------------ */

function PlaneIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  );
}

function HotelIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
      <path d="M9 22V12h6v10M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01" />
    </svg>
  );
}

function CarIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18 10l-2.7-3.6a2 2 0 0 0-1.6-.8H6.3a2 2 0 0 0-1.6.8L2 10l-2.5 1.1C-1.2 11.3-2 12.1-2 13v3c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

function MapPinIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function DollarIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function CloudSunIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M17.66 6.34l1.41-1.41M6.34 17.66l-1.41 1.41M2 12h2M6.34 6.34L4.93 4.93" />
      <circle cx="12" cy="10" r="4" />
      <path d="M16 18a4 4 0 0 0-8 0" />
    </svg>
  );
}

function ShareIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function ExternalLinkIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface SharedTripData {
  title: string;
  flights: Array<{
    airline: string;
    route: string;
    price: number;
    date: string;
    deepLink?: string;
  }>;
  hotels: Array<{
    name: string;
    address: string;
    pricePerNight: number;
    nights: number;
    totalPrice: number;
  }>;
  cars: Array<{
    provider: string;
    type: string;
    pricePerDay: number;
    days: number;
  }>;
  totalPrice: number;
  destination: string;
  destinationCoords?: { lat: number; lng: number };
  createdBy?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export default function SharedTripClient({ shareId }: { shareId: string }) {
  const [trip, setTrip] = useState<SharedTripData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchTrip() {
      try {
        const res = await fetch(`/api/trips/${shareId}`);
        if (!res.ok) throw new Error('Trip not found');
        const data = await res.json();
        setTrip(data.tripData);
      } catch (_) {
        setError('This trip could not be found or may have been removed.');
      } finally {
        setLoading(false);
      }
    }
    fetchTrip();
  }, [shareId]);

  function handleCopyLink() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  /* Loading state */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/40 text-sm">Loading trip...</p>
        </div>
      </div>
    );
  }

  /* Error state */
  if (error || !trip) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass rounded-2xl p-8 max-w-md w-full text-center border border-white/[0.06]">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <MapPinIcon className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Trip Not Found</h2>
          <p className="text-white/40 text-sm mb-6">{error}</p>
          <Link
            href="https://faregenie.vercel.app/onboarding"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold text-sm hover:opacity-90 transition"
          >
            Plan Your Own Trip
          </Link>
        </div>
      </div>
    );
  }

  const hasCoords = trip.destinationCoords?.lat && trip.destinationCoords?.lng;
  const mapSrc = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${trip.destinationCoords!.lng - 0.05},${trip.destinationCoords!.lat - 0.03},${trip.destinationCoords!.lng + 0.05},${trip.destinationCoords!.lat + 0.03}&layer=mapnik&marker=${trip.destinationCoords!.lat},${trip.destinationCoords!.lng}`
    : null;

  return (
    <div className="min-h-screen pb-16">
      {/* Header */}
      <header className="border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="https://faregenie.vercel.app" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <PlaneIcon className="w-4 h-4 text-black" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">Flyeas</span>
            </Link>
            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-semibold uppercase tracking-wider">
              Shared Trip
            </span>
          </div>
          <button
            onClick={handleCopyLink}
            className="glass rounded-xl px-4 py-2 text-xs text-white/60 hover:text-white transition inline-flex items-center gap-2 border border-white/[0.06]"
          >
            <ShareIcon className="w-3.5 h-3.5" />
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-8 space-y-6">
        {/* Trip title */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            {trip.title}
          </h1>
          {trip.createdBy && (
            <p className="text-sm text-white/40 mt-1">Shared by {trip.createdBy}</p>
          )}
        </div>

        {/* Map section */}
        <div className="glass rounded-2xl overflow-hidden border border-white/[0.06]">
          {mapSrc ? (
            <iframe
              title={`Map of ${trip.destination}`}
              src={mapSrc}
              className="w-full h-56 md:h-72 border-0"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-56 md:h-72 flex items-center justify-center bg-white/[0.02]">
              <div className="text-center">
                <MapPinIcon className="w-10 h-10 text-white/20 mx-auto mb-2" />
                <p className="text-white/30 text-sm">{trip.destination || 'Destination'}</p>
              </div>
            </div>
          )}
        </div>

        {/* Summary stats */}
        <div className="glass rounded-2xl p-6 border border-white/[0.06]">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Flights</p>
              <p className="text-xl font-bold text-white">{trip.flights.length}</p>
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Hotels</p>
              <p className="text-xl font-bold text-white">{trip.hotels.length}</p>
            </div>
            {trip.cars.length > 0 && (
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-wider">Cars</p>
                <p className="text-xl font-bold text-white">{trip.cars.length}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Total Cost</p>
              <p className="text-xl font-bold text-amber-400">${trip.totalPrice}</p>
            </div>
          </div>
        </div>

        {/* Flights section */}
        {trip.flights.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <PlaneIcon className="w-4 h-4 text-amber-400" />
              Flights
            </h2>
            {trip.flights.map((f, i) => (
              <div
                key={i}
                className="glass rounded-2xl p-5 border border-white/[0.06] flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <PlaneIcon className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{f.route}</p>
                  <p className="text-xs text-white/40">
                    {f.airline}{f.date ? ` \u00B7 ${f.date}` : ''}
                  </p>
                </div>
                <div className="text-right flex-shrink-0 flex items-center gap-3">
                  <p className="text-lg font-bold text-white">${f.price}</p>
                  {f.deepLink && (
                    <a
                      href={f.deepLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center hover:bg-amber-500/20 transition"
                    >
                      <ExternalLinkIcon className="w-3.5 h-3.5 text-amber-400" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Hotels section */}
        {trip.hotels.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <HotelIcon className="w-4 h-4 text-amber-400" />
              Hotels
            </h2>
            {trip.hotels.map((h, i) => (
              <div
                key={i}
                className="glass rounded-2xl p-5 border border-white/[0.06] flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <HotelIcon className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{h.name}</p>
                  <p className="text-xs text-white/40 truncate">
                    {h.address}{h.nights ? ` \u00B7 ${h.nights} night${h.nights !== 1 ? 's' : ''}` : ''}
                    {h.pricePerNight ? ` \u00B7 $${h.pricePerNight}/night` : ''}
                  </p>
                </div>
                <p className="text-lg font-bold text-white flex-shrink-0">${h.totalPrice}</p>
              </div>
            ))}
          </div>
        )}

        {/* Cars section */}
        {trip.cars.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <CarIcon className="w-4 h-4 text-amber-400" />
              Rental Cars
            </h2>
            {trip.cars.map((c, i) => (
              <div
                key={i}
                className="glass rounded-2xl p-5 border border-white/[0.06] flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <CarIcon className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{c.type}</p>
                  <p className="text-xs text-white/40">
                    {c.provider} \u00B7 {c.days} day{c.days !== 1 ? 's' : ''} \u00B7 ${c.pricePerDay}/day
                  </p>
                </div>
                <p className="text-lg font-bold text-white flex-shrink-0">
                  ${c.pricePerDay * c.days}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Total cost card */}
        <div className="glass rounded-2xl p-6 border border-amber-500/20 bg-gradient-to-r from-amber-500/[0.05] to-orange-500/[0.05]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <DollarIcon className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Total Trip Cost</p>
                <p className="text-[10px] text-white/30 uppercase tracking-wider">
                  {trip.flights.length} flight{trip.flights.length !== 1 ? 's' : ''}
                  {trip.hotels.length > 0 && ` + ${trip.hotels.length} hotel${trip.hotels.length !== 1 ? 's' : ''}`}
                  {trip.cars.length > 0 && ` + ${trip.cars.length} car${trip.cars.length !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            <p className="text-3xl font-bold text-amber-400">${trip.totalPrice}</p>
          </div>
        </div>

        {/* Weather link */}
        {trip.destination && (
          <div className="glass rounded-2xl p-5 border border-white/[0.06] flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <CloudSunIcon className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Weather at {trip.destination}</p>
              <p className="text-xs text-white/40">Check the forecast before you go</p>
            </div>
            <a
              href={`https://wttr.in/${encodeURIComponent(trip.destination)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition inline-flex items-center gap-1.5"
            >
              Check Weather
              <ExternalLinkIcon className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* CTA section */}
        <div className="text-center pt-6 pb-4 space-y-4">
          <Link
            href="https://faregenie.vercel.app/onboarding"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold text-sm hover:opacity-90 transition shadow-lg shadow-amber-500/20"
          >
            <PlaneIcon className="w-4 h-4" />
            Plan a Similar Trip
          </Link>
          <div className="flex items-center justify-center gap-2 pt-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <PlaneIcon className="w-3 h-3 text-black" />
            </div>
            <span className="text-xs text-white/30">Powered by Flyeas</span>
          </div>
        </div>
      </div>
    </div>
  );
}
