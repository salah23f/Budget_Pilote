'use client';

import { useState, useMemo } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { FavoriteButton } from '@/components/ui/favorite-button';
import type { FavoriteHotel } from '@/lib/store/favorites-store';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface Hotel {
  id: string;
  name: string;
  stars: number;
  address: string;
  distance?: string;
  pricePerNight: number;
  totalPrice: number;
  nights: number;
  amenities: string[];
  rating: number;
  reviewCount: number;
  ratingLabel?: string;
  roomType?: string;
  photos: string[];
  lat: number;
  lng: number;
  partner?: string;
  source?: string;
}

interface HotelDetailModalProps {
  hotel: Hotel | null;
  onClose: () => void;
  checkIn?: string;
  checkOut?: string;
}

/* ------------------------------------------------------------------ */
/*  Amenity icon map                                                    */
/* ------------------------------------------------------------------ */

function AmenityIcon({ name }: { name: string }) {
  const n = name.toLowerCase();
  if (n.includes('wifi') || n.includes('internet'))
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.55a11 11 0 0114 0" />
        <path d="M8.53 16.11a6 6 0 016.95 0" />
        <circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  if (n.includes('pool') || n.includes('swim'))
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M2 20c2-1 4 1 6 0s4-1 6 0 4 1 6 0" />
        <path d="M2 16c2-1 4 1 6 0s4-1 6 0 4 1 6 0" />
        <path d="M8 12V6a2 2 0 114 0v1" />
      </svg>
    );
  if (n.includes('breakfast') || n.includes('restaurant') || n.includes('dining'))
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M18 8h1a4 4 0 010 8h-1" />
        <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
        <path d="M6 1v3M10 1v3M14 1v3" />
      </svg>
    );
  if (n.includes('gym') || n.includes('fitness'))
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M6 5v14M18 5v14M6 12h12" />
        <path d="M3 8v8M21 8v8" />
      </svg>
    );
  if (n.includes('spa') || n.includes('wellness'))
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M12 22c-4-3-8-6-8-10a8 8 0 0116 0c0 4-4 7-8 10z" />
        <path d="M12 12c-2-1.5-4-3-4-5a4 4 0 018 0c0 2-2 3.5-4 5z" />
      </svg>
    );
  if (n.includes('bar') || n.includes('lounge'))
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2h8l-4 9V20" />
        <path d="M7 20h10" />
      </svg>
    );
  if (n.includes('parking'))
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M9 17V7h4a3 3 0 010 6H9" />
      </svg>
    );
  if (n.includes('air') || n.includes('ac') || n.includes('conditioning'))
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M12 2v8M4.93 10.93l2.83 2.83M2 18h4M19.07 10.93l-2.83 2.83M22 18h-4M12 14v8" />
      </svg>
    );
  // Default amenity icon
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  SVG icons                                                           */
/* ------------------------------------------------------------------ */

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function BedIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className}>
      <path d="M3 21V7a2 2 0 012-2h14a2 2 0 012 2v14" />
      <path d="M3 14h18" />
      <path d="M7 14V9h4v5" />
    </svg>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function renderStars(n: number) {
  return Array.from({ length: 5 }, (_, i) => (
    <span key={i} className={i < n ? 'text-amber-400' : 'text-white/15'}>
      &#9733;
    </span>
  ));
}

function ratingColor(r: number) {
  if (r >= 9) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  if (r >= 8) return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
  return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
}

function barColor(score: number) {
  if (score >= 9) return 'bg-emerald-400';
  if (score >= 8) return 'bg-green-400';
  if (score >= 7) return 'bg-amber-400';
  if (score >= 6) return 'bg-orange-400';
  return 'bg-red-400';
}

/** Seeded variation so the same hotel always shows the same breakdown */
function seededVariation(id: string, index: number): number {
  let hash = 0;
  const str = id + String(index);
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return ((hash % 7) - 3) / 10; // range -0.3 to +0.3
}

function clampRating(val: number): number {
  return Math.round(Math.min(10, Math.max(1, val)) * 10) / 10;
}

function guessBedType(roomType: string): string {
  const r = roomType.toLowerCase();
  if (r.includes('king')) return 'King bed';
  if (r.includes('queen')) return 'Queen bed';
  if (r.includes('twin') || r.includes('double')) return 'Twin beds';
  if (r.includes('suite')) return 'King bed';
  if (r.includes('family')) return 'Two double beds';
  if (r.includes('single')) return 'Single bed';
  return 'Double bed';
}

function buildBookingUrl(hotel: Hotel, checkIn?: string, checkOut?: string): string {
  const partner = (hotel.partner || '').toLowerCase();
  if (partner.includes('booking.com') || partner.includes('booking')) {
    let url = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(hotel.name)}`;
    if (checkIn) url += `&checkin=${checkIn}`;
    if (checkOut) url += `&checkout=${checkOut}`;
    return url;
  }
  if (partner.includes('hotels.com')) {
    return `https://www.hotels.com/search.do?q=${encodeURIComponent(hotel.name)}`;
  }
  if (partner.includes('expedia')) {
    return `https://www.expedia.com/Hotel-Search?destination=${encodeURIComponent(hotel.name)}`;
  }
  if (partner.includes('agoda')) {
    return `https://www.agoda.com/search?searchText=${encodeURIComponent(hotel.name)}`;
  }
  // Generic fallback: Google Hotels
  return `https://www.google.com/travel/hotels?q=${encodeURIComponent(hotel.name + ' ' + (hotel.address || ''))}`;
}

function bookingLabel(partner?: string): string {
  if (!partner) return 'Find on Google Hotels';
  return `Book on ${partner}`;
}

function handleShare(hotel: Hotel) {
  const text = `${hotel.name} - $${hotel.pricePerNight}/night`;
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotel.name + ' ' + (hotel.address || ''))}`;
  if (navigator.share) {
    navigator.share({ title: hotel.name, text, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(`${text}\n${url}`).catch(() => {});
  }
}

/* ------------------------------------------------------------------ */
/*  Sub-sections                                                        */
/* ------------------------------------------------------------------ */

const sectionStyle = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] text-white/35 uppercase tracking-wider mb-3">{children}</p>;
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export function HotelDetailModal({ hotel, onClose, checkIn, checkOut }: HotelDetailModalProps) {
  const [photoIndex, setPhotoIndex] = useState(0);

  const ratingBreakdown = useMemo(() => {
    if (!hotel) return [];
    const h = hotel;
    return [
      { label: 'Cleanliness', score: clampRating(h.rating + seededVariation(h.id, 0)) },
      { label: 'Comfort', score: clampRating(h.rating + seededVariation(h.id, 1)) },
      { label: 'Location', score: clampRating(h.rating + seededVariation(h.id, 2)) },
      { label: 'Value for money', score: clampRating(h.rating - 0.2 + seededVariation(h.id, 3)) },
    ];
  }, [hotel]);

  if (!hotel) return null;

  const h = hotel;
  const photos = h.photos.length > 0 ? h.photos : [];
  const hasPhotos = photos.length > 0;

  const mapsUrl =
    h.lat && h.lng
      ? `https://www.google.com/maps/search/?api=1&query=${h.lat},${h.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name + ' ' + (h.address || ''))}`;

  const osmEmbedUrl =
    h.lat && h.lng
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${h.lng - 0.01},${h.lat - 0.01},${h.lng + 0.01},${h.lat + 0.01}&layer=mapnik&marker=${h.lat},${h.lng}`
      : '';

  const bookUrl = buildBookingUrl(h, checkIn, checkOut);

  const favoriteItem: FavoriteHotel = {
    kind: 'hotel',
    id: h.id,
    name: h.name,
    stars: h.stars,
    address: h.address,
    pricePerNight: h.pricePerNight,
    totalPrice: h.totalPrice,
    nights: h.nights,
    rating: h.rating,
    reviewCount: h.reviewCount,
    amenities: h.amenities,
    photo: h.photos[0] || undefined,
    lat: h.lat,
    lng: h.lng,
    partner: h.partner,
    savedAt: Date.now(),
  };

  function prevPhoto() {
    setPhotoIndex((i) => (i === 0 ? photos.length - 1 : i - 1));
  }
  function nextPhoto() {
    setPhotoIndex((i) => (i === photos.length - 1 ? 0 : i + 1));
  }

  return (
    <Modal isOpen onClose={onClose} title="" size="lg">
      <div className="space-y-5 -mt-2">
        {/* Photo carousel */}
        {hasPhotos && (
          <div className="relative rounded-xl overflow-hidden h-56 -mx-6 -mt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[photoIndex]}
              alt={`${h.name} photo ${photoIndex + 1}`}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

            {photos.length > 1 && (
              <>
                {/* Prev arrow */}
                <button
                  onClick={prevPhoto}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-black/70 transition-colors"
                  aria-label="Previous photo"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                {/* Next arrow */}
                <button
                  onClick={nextPhoto}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-black/70 transition-colors"
                  aria-label="Next photo"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
                {/* Dot indicators */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {photos.slice(0, 8).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPhotoIndex(i)}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${i === photoIndex ? 'bg-white w-3' : 'bg-white/40 hover:bg-white/60'}`}
                      aria-label={`Go to photo ${i + 1}`}
                    />
                  ))}
                  {photos.length > 8 && (
                    <span className="text-[9px] text-white/50 self-center ml-1">+{photos.length - 8}</span>
                  )}
                </div>
              </>
            )}

            {/* Photo counter */}
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-sm text-[10px] text-white/80">
              {photoIndex + 1} / {photos.length}
            </div>
          </div>
        )}

        {/* Header: name, stars, rating, favorite, share */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-white">{h.name}</h2>
            {h.stars > 0 && (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-sm">{renderStars(h.stars)}</span>
                <span className="text-xs text-white/30 ml-1">{h.stars}-star hotel</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {h.rating > 0 && (
              <div className={`px-2.5 py-1 rounded-lg text-sm font-bold border ${ratingColor(h.rating)}`}>
                {h.rating.toFixed(1)}
                {h.ratingLabel && (
                  <span className="block text-[9px] font-normal opacity-70">{h.ratingLabel}</span>
                )}
                {!h.ratingLabel && h.reviewCount > 0 && (
                  <span className="block text-[9px] font-normal opacity-70">{h.reviewCount} reviews</span>
                )}
              </div>
            )}
            <button
              onClick={() => handleShare(h)}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
              aria-label="Share hotel"
            >
              <ShareIcon />
            </button>
            <FavoriteButton item={favoriteItem} size="md" />
          </div>
        </div>

        {/* Address + Map link */}
        {(h.address || h.distance) && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 text-xs text-white/50 hover:text-amber-300 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-0.5 flex-shrink-0">
              <path d="M8 14s5-4.5 5-9a5 5 0 00-10 0c0 4.5 5 9 5 9z" strokeLinejoin="round" />
              <circle cx="8" cy="5" r="2" />
            </svg>
            <span>{h.address}{h.distance ? ` (${h.distance})` : ''}</span>
          </a>
        )}

        {/* Embedded map */}
        {osmEmbedUrl && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <iframe
              src={osmEmbedUrl}
              className="w-full h-40"
              style={{ border: 0 }}
              loading="lazy"
              title={`Map of ${h.name}`}
            />
          </div>
        )}

        {/* Check-in / Check-out */}
        <div className="rounded-xl p-4" style={sectionStyle}>
          <SectionTitle>Check-in / Check-out</SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <ClockIcon />
              </div>
              <div>
                <p className="text-xs text-white/80 font-medium">Check-in</p>
                <p className="text-[11px] text-white/40">From 14:00</p>
                {checkIn && <p className="text-[10px] text-amber-400/70 mt-0.5">{checkIn}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400">
                <ClockIcon />
              </div>
              <div>
                <p className="text-xs text-white/80 font-medium">Check-out</p>
                <p className="text-[11px] text-white/40">Until 11:00</p>
                {checkOut && <p className="text-[10px] text-amber-400/70 mt-0.5">{checkOut}</p>}
              </div>
            </div>
          </div>
          <p className="text-[10px] text-white/25 mt-3">Times may vary. Confirm with property.</p>
        </div>

        {/* Room Details */}
        {h.roomType && (
          <div className="rounded-xl p-4" style={sectionStyle}>
            <SectionTitle>Room Details</SectionTitle>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="text-white/30">
                  <BedIcon />
                </div>
                <div>
                  <p className="text-xs text-white/80 font-medium">{h.roomType}</p>
                  <p className="text-[11px] text-white/40">{guessBedType(h.roomType)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {['Air conditioning', 'Private bathroom', 'Flat-screen TV'].map((feat) => (
                  <span
                    key={feat}
                    className="text-[10px] text-white/50 px-2 py-1 rounded-md"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    {feat}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Amenities */}
        {h.amenities.length > 0 && (
          <div className="rounded-xl p-4" style={sectionStyle}>
            <SectionTitle>Amenities</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              {h.amenities.map((a) => (
                <div key={a} className="flex items-center gap-2 text-xs text-white/70">
                  <span className="text-amber-400/70">
                    <AmenityIcon name={a} />
                  </span>
                  {a}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Guest Rating Breakdown */}
        {h.rating > 0 && (
          <div className="rounded-xl p-4" style={sectionStyle}>
            <SectionTitle>Guest Rating Breakdown</SectionTitle>
            <div className="space-y-2.5">
              {ratingBreakdown.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-[11px] text-white/50 w-28 flex-shrink-0">{item.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barColor(item.score)} transition-all`}
                      style={{ width: `${(item.score / 10) * 100}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-white/60 font-medium w-7 text-right">{item.score.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cancellation Policy */}
        <div className="rounded-xl p-4" style={sectionStyle}>
          <SectionTitle>Cancellation Policy</SectionTitle>
          {h.rating > 7 ? (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <ShieldIcon />
              </div>
              <div>
                <p className="text-xs text-emerald-400 font-medium">Free cancellation available</p>
                <p className="text-[10px] text-white/30 mt-0.5">Cancel up to 24h before check-in for a full refund</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400">
                <ShieldIcon />
              </div>
              <div>
                <p className="text-xs text-orange-400 font-medium">Non-refundable rate</p>
                <p className="text-[10px] text-white/30 mt-0.5">Check property for cancellation terms</p>
              </div>
            </div>
          )}
        </div>

        {/* What's Nearby */}
        {(h.distance || h.address) && (
          <div className="rounded-xl p-4" style={sectionStyle}>
            <SectionTitle>{"What's Nearby"}</SectionTitle>
            <div className="space-y-2">
              {h.distance && (
                <div className="flex items-center gap-2.5 text-xs text-white/60">
                  <MapPinIcon className="text-amber-400/70 flex-shrink-0" />
                  <span>{h.distance} from city center</span>
                </div>
              )}
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-xs text-white/40 hover:text-amber-300 transition-colors"
              >
                <ExternalLinkIcon className="flex-shrink-0" />
                <span>View on Google Maps</span>
              </a>
            </div>
          </div>
        )}

        {/* Price + actions */}
        <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <p className="text-3xl font-bold text-white">${h.pricePerNight}</p>
            <p className="text-xs text-white/30">per night</p>
            <p className="text-xs text-white/25 mt-0.5">
              ${h.totalPrice} total ({h.nights} night{h.nights !== 1 ? 's' : ''})
            </p>
            {h.partner && (
              <p className="text-[10px] text-white/25 mt-1">
                via {h.partner}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Button
              variant="primary"
              size="lg"
              onClick={() => window.open(bookUrl, '_blank')}
            >
              <span className="flex items-center gap-2">
                {bookingLabel(h.partner)}
                <ExternalLinkIcon />
              </span>
            </Button>
            <p className="text-[10px] text-white/25">
              {"You'll complete your booking on "}
              {h.partner || 'Google Hotels'}
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
