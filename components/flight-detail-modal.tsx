'use client';

import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FavoriteButton } from '@/components/ui/favorite-button';
import type { FavoriteFlight } from '@/lib/store/favorites-store';

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

interface FlightDetailModalProps {
  flight: Flight | null;
  origin: string;
  destination: string;
  departDate: string;
  onClose: () => void;
}

function formatTime(t: string) {
  try { return new Date(t).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch { return t?.slice(11, 16) || t; }
}

function formatDate(t: string) {
  try { return new Date(t).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
  catch { return t; }
}

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export function FlightDetailModal({ flight, origin, destination, departDate, onClose }: FlightDetailModalProps) {
  if (!flight) return null;

  const f = flight;

  const favoriteItem: FavoriteFlight = {
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
  };

  return (
    <Modal open onClose={onClose} title="">
      <div className="space-y-5 -mt-2">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl glass flex items-center justify-center overflow-hidden">
              {f.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.logoUrl} alt={f.airline} className="w-full h-full object-contain" />
              ) : (
                <span className="text-sm font-bold text-amber-400">{f.airlineCode}</span>
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{f.airline}</h2>
              {f.flightNumber && (
                <p className="text-xs text-white/40 font-mono">{f.flightNumber}</p>
              )}
            </div>
          </div>
          <FavoriteButton item={favoriteItem} size="md" />
        </div>

        {/* Route visual */}
        <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{formatTime(f.departureTime)}</p>
              <p className="text-sm text-white/60 font-medium">{f.originIata || origin.toUpperCase().slice(0, 3)}</p>
              <p className="text-[10px] text-white/30">{f.originCity || origin}</p>
            </div>

            <div className="flex-1 px-6 flex flex-col items-center gap-2">
              <p className="text-xs text-white/40">{formatDuration(f.durationMinutes)}</p>
              <div className="w-full flex items-center">
                <div className="w-2.5 h-2.5 rounded-full border-2 border-amber-400" />
                <div className="flex-1 h-px bg-white/15 relative">
                  {f.stops > 0 && Array.from({ length: f.stops }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-400/60"
                      style={{ left: `${((i + 1) / (f.stops + 1)) * 100}%` }}
                    />
                  ))}
                </div>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              </div>
              <Badge variant={f.stops === 0 ? 'success' : f.stops === 1 ? 'warning' : 'danger'} size="sm">
                {f.stops === 0 ? 'Nonstop' : `${f.stops} stop${f.stops > 1 ? 's' : ''}`}
              </Badge>
            </div>

            <div className="text-center">
              <p className="text-2xl font-bold text-white">{formatTime(f.arrivalTime)}</p>
              <p className="text-sm text-white/60 font-medium">{f.destinationIata || destination.toUpperCase().slice(0, 3)}</p>
              <p className="text-[10px] text-white/30">{f.destinationCity || destination}</p>
            </div>
          </div>

          <p className="text-[10px] text-white/25 text-center">{formatDate(f.departureTime)}</p>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Cabin', value: (f.cabinClass || f.cabin || 'Economy').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()), icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h4M14 10h4"/></svg> },
            { label: 'Baggage', value: f.baggageIncluded ? 'Included (23kg)' : 'Cabin bag only', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M9 2v20M15 2v20M6 7h12M6 17h12"/></svg> },
            { label: 'CO2 Emissions', value: `${f.carbonKg} kg`, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M8 12a4 4 0 018 0"/></svg> },
            { label: 'Deal Quality', value: f.dealQuality, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> },
            { label: 'Score', value: `${f.score}/100`, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> },
            { label: 'Source', value: f.source || 'Live search', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/></svg> },
          ].map((detail) => (
            <div key={detail.label} className="flex items-start gap-2.5 rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="text-white/30 mt-0.5">{detail.icon}</div>
              <div>
                <p className="text-[10px] text-white/35 uppercase tracking-wider">{detail.label}</p>
                <p className="text-xs text-white/80 font-medium mt-0.5 capitalize">{detail.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Score bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40">Flight Score</span>
            <span className="text-white font-semibold">{f.score}/100</span>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${f.score}%`,
                background: f.score >= 85 ? 'linear-gradient(90deg, #10b981, #F59E0B)' : f.score >= 70 ? 'linear-gradient(90deg, #F59E0B, #F97316)' : 'linear-gradient(90deg, #f59e0b, #ef4444)',
              }}
            />
          </div>
        </div>

        {/* Price + actions */}
        <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <p className="text-3xl font-bold text-white">${f.price}</p>
            <p className="text-xs text-white/30">per person</p>
          </div>
          <div className="flex gap-2">
            {f.deepLink ? (
              <a href={f.deepLink} target="_blank" rel="noopener noreferrer">
                <Button variant="primary" size="lg">
                  Book Now
                </Button>
              </a>
            ) : (
              <Button variant="primary" size="lg" onClick={() => window.open(`https://www.kiwi.com/en/search/results/${origin}/${destination}/${departDate}?adults=1`, '_blank')}>
                Book Now
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
