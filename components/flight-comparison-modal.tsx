'use client';

import React from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
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

interface FlightComparisonModalProps {
  flights: Flight[];
  onClose: () => void;
  origin: string;
  destination: string;
  departDate: string;
}

/* ------------------------------------------------------------------ */
/*  SVG Icons                                                          */
/* ------------------------------------------------------------------ */

function AirlineIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 13h14" />
      <path d="M2 13l2-8h8l2 8" />
      <circle cx="8" cy="7" r="1.5" />
    </svg>
  );
}

function PriceIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1v14M5 4h5a2 2 0 010 4H5M5 8h6a2 2 0 010 4H4" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4v4l3 2" />
    </svg>
  );
}

function StopsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="3" cy="8" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="13" cy="8" r="1.5" />
      <path d="M4.5 8h2M9.5 8h2" />
    </svg>
  );
}

function BaggageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="5" width="8" height="9" rx="1" />
      <path d="M6 5V3a1 1 0 011-1h2a1 1 0 011 1v2" />
      <path d="M4 14h8" />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 14c0 0 2-2 4-4C8 8 14 2 14 2s0 6-2 8c-1.5 1.5-4 4-4 4" />
      <path d="M6 10L2 14" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1l2.2 4.5 5 .7-3.6 3.5.8 5L8 12.4 3.6 14.7l.8-5L.8 6.2l5-.7z" />
    </svg>
  );
}

function DealIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 2l6 1 6 6-5 5-6-6z" />
      <circle cx="6" cy="6" r="1" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h7v7" />
      <path d="M13 3L6 10" />
      <path d="M11 13H3V5" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDuration(minutes: number): string {
  if (!minutes) return '--';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function FlightComparisonModal({
  flights,
  onClose,
  origin,
  destination,
  departDate,
}: FlightComparisonModalProps) {
  if (flights.length < 2) return null;

  const rows: {
    label: string;
    icon: React.ReactNode;
    render: (f: Flight) => React.ReactNode;
    bestId: string | null;
  }[] = [
    {
      label: 'Airline',
      icon: <AirlineIcon />,
      render: (f) => (
        <div className="flex items-center gap-2">
          {f.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.logoUrl} alt={f.airline} className="w-6 h-6 rounded object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <span className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-[9px] font-bold text-amber-300">
              {f.airline.split(' ').map(w => w[0]).join('')}
            </span>
          )}
          <span className="text-sm font-medium text-white">{f.airline}</span>
        </div>
      ),
      bestId: null,
    },
    {
      label: 'Price',
      icon: <PriceIcon />,
      render: (f) => <span className="text-lg font-bold">${f.price}</span>,
      bestId: flights.reduce((best, f) => f.price < best.price ? f : best, flights[0]).id,
    },
    {
      label: 'Duration',
      icon: <ClockIcon />,
      render: (f) => <span className="text-sm font-semibold">{formatDuration(f.durationMinutes)}</span>,
      bestId: flights.reduce((best, f) => f.durationMinutes < best.durationMinutes ? f : best, flights[0]).id,
    },
    {
      label: 'Stops',
      icon: <StopsIcon />,
      render: (f) => (
        <span className="text-sm font-semibold">
          {f.stops === 0 ? 'Nonstop' : f.stops === 1 ? '1 Stop' : `${f.stops} Stops`}
        </span>
      ),
      bestId: flights.reduce((best, f) => f.stops < best.stops ? f : best, flights[0]).id,
    },
    {
      label: 'Baggage',
      icon: <BaggageIcon />,
      render: (f) => (
        <span className={`text-sm font-medium ${f.baggageIncluded ? 'text-emerald-300' : 'text-white/50'}`}>
          {f.baggageIncluded ? 'Included' : 'Cabin only'}
        </span>
      ),
      bestId: null,
    },
    {
      label: 'CO2 Emissions',
      icon: <LeafIcon />,
      render: (f) => <span className="text-sm font-semibold">{f.carbonKg} kg</span>,
      bestId: flights.reduce((best, f) => f.carbonKg < best.carbonKg ? f : best, flights[0]).id,
    },
    {
      label: 'Score',
      icon: <StarIcon />,
      render: (f) => (
        <div className="flex items-center gap-2">
          <div className="w-12 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${f.score}%`,
                background: f.score >= 85
                  ? 'linear-gradient(90deg, #E8A317, #10b981)'
                  : f.score >= 70
                    ? 'linear-gradient(90deg, #F97316, #E8A317)'
                    : 'linear-gradient(90deg, #f59e0b, #ef4444)',
              }}
            />
          </div>
          <span className="text-sm font-bold">{f.score}</span>
        </div>
      ),
      bestId: flights.reduce((best, f) => f.score > best.score ? f : best, flights[0]).id,
    },
    {
      label: 'Deal Quality',
      icon: <DealIcon />,
      render: (f) => (
        <span className={`text-sm font-semibold ${
          f.dealQuality.toLowerCase() === 'excellent' ? 'text-emerald-300'
          : f.dealQuality.toLowerCase() === 'good' ? 'text-amber-300'
          : 'text-white/60'
        }`}>
          {f.dealQuality}
        </span>
      ),
      bestId: null,
    },
  ];

  return (
    <Modal isOpen onClose={onClose} title={`Compare Flights: ${origin.toUpperCase()} → ${destination.toUpperCase()}`} size="xl">
      <div className="-mx-6 -my-4">
        <p className="px-6 pt-2 pb-4 text-xs text-white/40">{departDate}</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wider" style={{ background: 'rgba(28,25,23,0.95)', minWidth: 120 }}>
                  Attribute
                </th>
                {flights.map((f) => (
                  <th key={f.id} className="px-4 py-3 text-center text-xs font-medium text-white/40 uppercase tracking-wider" style={{ minWidth: 140 }}>
                    {f.airline}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-t border-white/[0.05]">
                  <td className="sticky left-0 z-10 px-4 py-3" style={{ background: 'rgba(28,25,23,0.95)' }}>
                    <div className="flex items-center gap-2 text-white/60">
                      {row.icon}
                      <span className="text-xs font-medium">{row.label}</span>
                    </div>
                  </td>
                  {flights.map((f) => {
                    const isHighlighted = row.bestId !== null && row.bestId === f.id;
                    return (
                      <td
                        key={f.id}
                        className={`px-4 py-3 text-center ${
                          isHighlighted
                            ? 'text-emerald-300'
                            : 'text-white/80'
                        }`}
                        style={isHighlighted ? { background: 'rgba(16,185,129,0.06)' } : undefined}
                      >
                        <div className="flex items-center justify-center">
                          {row.render(f)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Book row */}
              <tr className="border-t border-white/[0.05]">
                <td className="sticky left-0 z-10 px-4 py-4" style={{ background: 'rgba(28,25,23,0.95)' }} />
                {flights.map((f) => (
                  <td key={f.id} className="px-4 py-4 text-center">
                    {f.deepLink ? (
                      <a
                        href={f.deepLink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button size="sm" variant="primary" className="gap-1.5">
                          Book <ExternalLinkIcon />
                        </Button>
                      </a>
                    ) : (
                      <Button size="sm" variant="primary">
                        Book
                      </Button>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
