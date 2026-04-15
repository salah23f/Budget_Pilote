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
    <Modal isOpen onClose={onClose} title="">
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
                background: f.score >= 85 ? 'linear-gradient(90deg, #10b981, #E8A317)' : f.score >= 70 ? 'linear-gradient(90deg, #E8A317, #F97316)' : 'linear-gradient(90deg, #f59e0b, #ef4444)',
              }}
            />
          </div>
        </div>

        {/* What's Included */}
        {(() => {
          const cabinLower = (f.cabinClass || f.cabin || 'economy').toLowerCase();
          const isPremium = cabinLower.includes('business') || cabinLower.includes('first');
          const inclusions = [
            { label: 'Cabin bag', status: 'Included', included: true, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="7" y="4" width="10" height="16" rx="2"/><path d="M10 4V2M14 4V2M7 8h10"/></svg> },
            { label: 'Checked bag', status: f.baggageIncluded ? 'Included (23kg)' : 'Not included', included: !!f.baggageIncluded, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M9 2v20M15 2v20M6 7h12M6 17h12"/></svg> },
            { label: 'Meal service', status: isPremium ? 'Included' : 'Purchase on board', included: isPremium, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"/></svg> },
            { label: 'Entertainment', status: 'Available', included: true, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M2 18h20M10 22h4"/></svg> },
            { label: 'USB / Power', status: 'Available', included: true, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> },
            { label: 'WiFi', status: isPremium ? 'Available' : 'Varies', included: isPremium, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01"/></svg> },
          ];
          return (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">What&apos;s Included</h3>
              <div className="grid grid-cols-3 gap-2">
                {inclusions.map((item) => (
                  <div key={item.label} className="flex items-center gap-2 rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className={item.included ? 'text-emerald-400' : 'text-white/30'}>{item.icon}</div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-white/40 truncate">{item.label}</p>
                      <div className="flex items-center gap-1">
                        {item.included ? (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-emerald-400 shrink-0"><path d="M20 6L9 17l-5-5"/></svg>
                        ) : (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-white/25 shrink-0"><path d="M5 12h14"/></svg>
                        )}
                        <p className={`text-[10px] font-medium truncate ${item.included ? 'text-emerald-400' : 'text-white/40'}`}>{item.status}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Cancellation Policy */}
        {(() => {
          const cabinLower = (f.cabinClass || f.cabin || 'economy').toLowerCase();
          let policy = { title: 'Non-refundable', detail: 'Non-refundable. Changes may incur fees. Check with airline for exact policy.', color: 'text-white/50' };
          if (cabinLower.includes('first')) {
            policy = { title: 'Fully flexible', detail: 'Fully flexible. Free cancellation and changes.', color: 'text-emerald-400' };
          } else if (cabinLower.includes('business')) {
            policy = { title: 'Flexible ticket', detail: 'Flexible ticket. Free changes up to 24h before departure.', color: 'text-emerald-400' };
          } else if (cabinLower.includes('premium')) {
            policy = { title: 'Partially refundable', detail: 'Partially refundable. Changes allowed with fee.', color: 'text-amber-400' };
          }
          return (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Cancellation Policy</h3>
              <div className="flex items-start gap-3 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`${policy.color} mt-0.5 shrink-0`}><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 8v4M12 16h.01"/></svg>
                <div>
                  <p className={`text-xs font-semibold ${policy.color}`}>{policy.title}</p>
                  <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">{policy.detail}</p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Layover Details */}
        {f.stops > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Layover Details</h3>
            <div className="flex items-start gap-3 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-amber-400 mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              <div>
                <p className="text-xs font-semibold text-amber-400">{f.stops} connection{f.stops > 1 ? 's' : ''}</p>
                <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">
                  This flight has {f.stops} connection{f.stops > 1 ? 's' : ''}. Check with the airline for layover details and terminal information.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Price Breakdown */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Price Breakdown</h3>
          <div className="rounded-xl p-4 space-y-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Estimated base fare</span>
              <span className="text-xs text-white/70 font-medium">${Math.round(f.price * 0.85)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Estimated taxes & fees</span>
              <span className="text-xs text-white/70 font-medium">${Math.round(f.price * 0.15)}</span>
            </div>
            <div className="h-px bg-white/10" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-white font-semibold">Total</span>
              <span className="text-sm text-white font-bold">${f.price}</span>
            </div>
            <p className="text-[10px] text-white/25 pt-0.5">Final price confirmed at booking</p>
          </div>
        </div>

        {/* Price + actions */}
        <div className="pt-3 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-white">${f.price}</p>
              <p className="text-xs text-white/30">per person</p>
            </div>
            <div className="flex gap-2">
              {f.deepLink ? (
                <a href={f.deepLink} target="_blank" rel="noopener noreferrer">
                  <Button variant="primary" size="lg">
                    <span className="flex items-center gap-1.5">
                      Book on Kiwi.com
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
                    </span>
                  </Button>
                </a>
              ) : (
                <Button variant="primary" size="lg" onClick={() => window.open(`https://www.kiwi.com/en/search/results/${origin}/${destination}/${departDate}?adults=1`, '_blank')}>
                  <span className="flex items-center gap-1.5">
                    Book on Kiwi.com
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
                  </span>
                </Button>
              )}
            </div>
          </div>
          <p className="text-[10px] text-white/25 text-center">You&apos;ll complete your booking on Kiwi.com</p>
          <a href="/missions/new" className="block">
            <Button variant="secondary" size="lg" className="w-full">
              <span className="flex items-center justify-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
                Set Price Alert
              </span>
            </Button>
          </a>
        </div>
      </div>
    </Modal>
  );
}
