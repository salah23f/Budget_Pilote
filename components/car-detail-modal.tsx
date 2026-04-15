'use client';

import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface Car {
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

interface CarDetailModalProps {
  car: Car | null;
  onClose: () => void;
  pickupLocation?: string;
  pickupDate?: string;
  returnDate?: string;
}

/* ------------------------------------------------------------------ */
/*  SVG Icons                                                           */
/* ------------------------------------------------------------------ */

function SeatsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v10" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function BagsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="8" width="16" height="13" rx="2" />
      <path d="M8 8V5a2 2 0 012-2h4a2 2 0 012 2v3" />
      <path d="M4 14h16" />
    </svg>
  );
}

function TransmissionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
    </svg>
  );
}

function ACIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v8M4.93 10.93l2.83 2.83M2 18h4M19.07 10.93l-2.83 2.83M22 18h-4M12 14v8" />
    </svg>
  );
}

function FuelIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 22V5a2 2 0 012-2h8a2 2 0 012 2v17" />
      <path d="M15 12h2a2 2 0 012 2v3a2 2 0 004 0V9l-3-3" />
      <path d="M3 22h12" />
      <path d="M7 8h4" />
    </svg>
  );
}

function MileageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19h16" />
      <path d="M4 15l4-8 4 4 4-6 4 10" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function DashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function CarPlaceholderIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400/50">
      <path d="M5 17h14M5 17a2 2 0 01-2-2V9a1 1 0 011-1h1l2-4h10l2 4h1a1 1 0 011 1v6a2 2 0 01-2 2M5 17a2 2 0 002 2h10a2 2 0 002-2" />
      <circle cx="7.5" cy="15.5" r="1.5" />
      <circle cx="16.5" cy="15.5" r="1.5" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatDate(dateStr?: string): string {
  if (!dateStr) return '--';
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch (_) {
    return dateStr;
  }
}

function computeDays(pickup?: string, returnD?: string): number {
  if (!pickup || !returnD) return 1;
  return Math.max(1, Math.ceil((new Date(returnD).getTime() - new Date(pickup).getTime()) / 86400000));
}

function isLuxuryOrSUV(carType: string): boolean {
  const t = carType.toLowerCase();
  return t.includes('luxury') || t.includes('suv') || t.includes('premium') || t.includes('full');
}

/* ------------------------------------------------------------------ */
/*  Section component                                                   */
/* ------------------------------------------------------------------ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-[10px] text-white/35 uppercase tracking-wider mb-3">{title}</p>
      {children}
    </div>
  );
}

function InclusionRow({ included, label }: { included: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={included ? 'text-emerald-400' : 'text-white/25'}>
        {included ? <CheckIcon /> : <DashIcon />}
      </span>
      <span className={included ? 'text-white/70' : 'text-white/35'}>{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export function CarDetailModal({ car, onClose, pickupLocation, pickupDate, returnDate }: CarDetailModalProps) {
  if (!car) return null;

  const c = car;
  const days = computeDays(pickupDate, returnDate);
  const subtotal = c.pricePerDay * days;
  const taxes = Math.round(subtotal * 0.15 * 100) / 100;
  const total = Math.round((subtotal + taxes) * 100) / 100;
  const hasUnlimitedMileage = c.mileage.toLowerCase().includes('unlimited');
  const luxury = isLuxuryOrSUV(c.carType);

  const bookUrl = c.deepLink || `https://www.google.com/search?q=${encodeURIComponent(c.provider + ' car rental ' + (pickupLocation || ''))}`;
  const bookLabel = c.deepLink ? `Book on ${c.provider}` : 'Search on rental provider';

  return (
    <Modal isOpen onClose={onClose} title="" size="lg">
      <div className="space-y-5 -mt-2 max-h-[75vh] overflow-y-auto pr-1 -mr-1">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-white">{c.carName}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="default" size="sm">{c.carType}</Badge>
              {c.rating && (
                <span className="text-xs text-white/40">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="inline text-amber-400 mr-0.5 -mt-px">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  {c.rating.toFixed(1)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {c.providerLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.providerLogo} alt={c.provider} className="h-6 object-contain rounded" />
            ) : (
              <span className="text-xs text-white/40 font-medium px-2 py-1 rounded-md" style={{ background: 'rgba(255,255,255,0.06)' }}>{c.provider}</span>
            )}
          </div>
        </div>

        {/* Photo section */}
        <div className="relative rounded-xl overflow-hidden h-44 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {c.carImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.carImage}
              alt={c.carName}
              className="w-full h-full object-contain p-4"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent) parent.classList.add('flex', 'items-center', 'justify-center');
              }}
            />
          ) : (
            <CarPlaceholderIcon />
          )}
        </div>

        {/* Specs grid */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: <SeatsIcon />, label: 'Seats', value: String(c.seats) },
            { icon: <BagsIcon />, label: 'Bags', value: String(c.bags) },
            { icon: <TransmissionIcon />, label: 'Transmission', value: c.transmission },
            { icon: <ACIcon />, label: 'A/C', value: c.hasAC ? 'Yes' : 'No' },
            { icon: <FuelIcon />, label: 'Fuel Policy', value: c.fuelPolicy },
            { icon: <MileageIcon />, label: 'Mileage', value: c.mileage },
          ].map((spec) => (
            <div
              key={spec.label}
              className="rounded-lg p-3 text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <span className="text-amber-400/70 inline-flex justify-center">{spec.icon}</span>
              <p className="text-[10px] text-white/35 mt-1">{spec.label}</p>
              <p className="text-xs text-white/80 font-medium mt-0.5 truncate">{spec.value}</p>
            </div>
          ))}
        </div>

        {/* Rental Conditions */}
        <Section title="Rental Conditions">
          <div className="space-y-2 text-xs text-white/60">
            <div className="flex items-start gap-2">
              <span className="text-amber-400/60 mt-0.5"><CheckIcon /></span>
              <span>Minimum age: {luxury ? '25' : '21'} years</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-400/60 mt-0.5"><CheckIcon /></span>
              <span>Valid driver&apos;s license required</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-400/60 mt-0.5"><CheckIcon /></span>
              <span>Credit card required for deposit</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-400/60 mt-0.5"><CheckIcon /></span>
              <span>Deposit: estimated ${luxury ? '350-500' : '200-350'} depending on car type</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-400/60 mt-0.5"><CheckIcon /></span>
              <span>Additional driver: available for extra fee</span>
            </div>
          </div>
        </Section>

        {/* Pick-up & Drop-off */}
        <Section title="Pick-up & Drop-off">
          <div className="space-y-3 text-xs text-white/60">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-white/30 mb-0.5">Pick-up Location</p>
                <p className="text-white/70 font-medium">{pickupLocation || c.pickupLocation || '--'}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/30 mb-0.5">Drop-off Location</p>
                <p className="text-white/70 font-medium">{c.dropoffLocation || pickupLocation || '--'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-white/30 mb-0.5">Pick-up Date</p>
                <p className="text-white/70 font-medium">{formatDate(pickupDate)}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/30 mb-0.5">Return Date</p>
                <p className="text-white/70 font-medium">{formatDate(returnDate)}</p>
              </div>
            </div>
            <p className="text-[10px] text-white/30 italic mt-2">Present your booking confirmation and valid ID at the counter</p>
          </div>
        </Section>

        {/* Insurance & Protection */}
        <Section title="Insurance & Protection">
          <div className="space-y-2 text-xs">
            <InclusionRow included label="Collision Damage Waiver (CDW) -- included" />
            <InclusionRow included label="Theft protection -- included" />
            <InclusionRow included={false} label="Personal accident insurance -- optional" />
            <InclusionRow included label="Roadside assistance -- included" />
          </div>
          <p className="text-[10px] text-white/30 italic mt-3">Excess may apply. Consider additional coverage at pickup.</p>
        </Section>

        {/* What's Included */}
        <Section title="What's Included">
          <div className="space-y-2 text-xs">
            <InclusionRow included={hasUnlimitedMileage} label={hasUnlimitedMileage ? 'Unlimited mileage' : `Mileage: ${c.mileage}`} />
            <InclusionRow included={false} label="GPS navigation -- varies" />
            <InclusionRow included={false} label="Child seat -- available on request" />
            <InclusionRow included={false} label="Snow chains / winter tires -- varies by location" />
            <InclusionRow included={false} label="Additional driver -- extra fee" />
          </div>
        </Section>

        {/* Features */}
        {c.features.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {c.features.map((f) => (
              <span key={f} className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-400/20">{f}</span>
            ))}
          </div>
        )}

        {/* Price breakdown */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] text-white/35 uppercase tracking-wider mb-3">Price Breakdown</p>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-white/50">
              <span>${c.pricePerDay} x {days} day{days > 1 ? 's' : ''}</span>
              <span className="text-white/70">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-white/50">
              <span>Estimated taxes & fees (~15%)</span>
              <span className="text-white/70">${taxes.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-2 text-sm font-bold text-white" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <span>Total estimated price</span>
              <span className="text-amber-400">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Book button */}
        <div className="flex flex-col items-center gap-2 pt-2">
          <a href={bookUrl} target="_blank" rel="noopener noreferrer" className="w-full">
            <Button variant="primary" size="lg" fullWidth>
              <span className="flex items-center justify-center gap-2">
                {bookLabel}
                <ExternalLinkIcon />
              </span>
            </Button>
          </a>
          <p className="text-[10px] text-white/25">You&apos;ll complete your booking on the provider&apos;s site</p>
        </div>
      </div>
    </Modal>
  );
}
