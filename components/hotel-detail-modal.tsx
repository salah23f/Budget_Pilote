'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
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

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export function HotelDetailModal({ hotel, onClose }: HotelDetailModalProps) {
  const [photoIndex, setPhotoIndex] = useState(0);

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

        {/* Header: name, stars, rating, favorite */}
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

        {/* Room type */}
        {h.roomType && (
          <div className="flex items-start gap-2.5 rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-white/30 mt-0.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M3 21V7a2 2 0 012-2h14a2 2 0 012 2v14" />
                <path d="M3 14h18" />
                <path d="M7 14V9h4v5" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] text-white/35 uppercase tracking-wider">Room Type</p>
              <p className="text-xs text-white/80 font-medium mt-0.5">{h.roomType}</p>
            </div>
          </div>
        )}

        {/* Amenities */}
        {h.amenities.length > 0 && (
          <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] text-white/35 uppercase tracking-wider mb-3">Amenities</p>
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
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="lg"
              onClick={() =>
                window.open(
                  mapsUrl,
                  '_blank'
                )
              }
            >
              Book Now
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
