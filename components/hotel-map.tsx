'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface MapHotel {
  id: string;
  name: string;
  lat: number;
  lng: number;
  pricePerNight: number;
  stars: number;
  rating: number;
  photo?: string;
}

interface HotelMapProps {
  hotels: MapHotel[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  CSS injected once for Leaflet                                       */
/* ------------------------------------------------------------------ */

const LEAFLET_CSS_ID = 'leaflet-css';
function ensureLeafletCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(LEAFLET_CSS_ID)) return;
  const link = document.createElement('link');
  link.id = LEAFLET_CSS_ID;
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
}

/* Custom price marker CSS */
const MARKER_STYLE_ID = 'hotel-map-markers';
function ensureMarkerStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(MARKER_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = MARKER_STYLE_ID;
  style.textContent = `
    .hotel-price-marker {
      background: #1C1917;
      border: 2px solid rgba(245,158,11,0.5);
      border-radius: 12px;
      padding: 3px 8px;
      font-size: 11px;
      font-weight: 700;
      color: white;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      cursor: pointer;
      transition: transform 0.15s ease, border-color 0.2s ease;
      font-family: Inter, system-ui, sans-serif;
    }
    .hotel-price-marker:hover {
      transform: scale(1.15);
      border-color: #E8A317;
      z-index: 1000 !important;
    }
    .hotel-price-marker.selected {
      background: linear-gradient(135deg, #E8A317, #F97316);
      border-color: #E8A317;
      color: white;
      transform: scale(1.2);
      z-index: 1000 !important;
    }
    .leaflet-tile-pane {
      filter: brightness(0.6) saturate(0.3) contrast(1.2);
    }
  `;
  document.head.appendChild(style);
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export function HotelMap({ hotels, selectedId, onSelect, className = '' }: HotelMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load Leaflet dynamically
  useEffect(() => {
    ensureLeafletCSS();
    ensureMarkerStyles();

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setLoaded(true);

    // Check if already loaded
    if ((window as any).L) {
      setLoaded(true);
    } else {
      document.head.appendChild(script);
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (!loaded || !mapRef.current || hotels.length === 0) return;

    const L = (window as any).L;
    if (!L) return;

    // Destroy previous map
    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
    }

    // Calculate bounds
    const validHotels = hotels.filter((h) => h.lat && h.lng);
    if (validHotels.length === 0) return;

    const lats = validHotels.map((h) => h.lat);
    const lngs = validHotels.map((h) => h.lng);
    const center: [number, number] = [
      (Math.min(...lats) + Math.max(...lats)) / 2,
      (Math.min(...lngs) + Math.max(...lngs)) / 2,
    ];

    const map = L.map(mapRef.current, {
      center,
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
    }).addTo(map);

    // Fit bounds
    const bounds = L.latLngBounds(validHotels.map((h: MapHotel) => [h.lat, h.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });

    // Add markers
    const markers: any[] = [];
    validHotels.forEach((hotel) => {
      const isSelected = hotel.id === selectedId;
      const icon = L.divIcon({
        className: '',
        html: `<div class="hotel-price-marker ${isSelected ? 'selected' : ''}">$${hotel.pricePerNight}</div>`,
        iconSize: [60, 28],
        iconAnchor: [30, 14],
      });

      const marker = L.marker([hotel.lat, hotel.lng], { icon }).addTo(map);

      marker.on('click', () => {
        onSelect?.(hotel.id);
      });

      // Tooltip
      marker.bindPopup(
        `<div style="font-family:Inter,system-ui;min-width:160px">
          <strong style="font-size:13px">${hotel.name}</strong><br/>
          <span style="color:#888;font-size:11px">${'★'.repeat(hotel.stars)} · ${hotel.rating.toFixed(1)}</span><br/>
          <span style="font-size:15px;font-weight:700;color:#E8A317">$${hotel.pricePerNight}</span>
          <span style="color:#888;font-size:11px"> / night</span>
        </div>`,
        { closeButton: false, className: 'hotel-popup' }
      );

      markers.push(marker);
    });

    leafletMapRef.current = map;
    markersRef.current = markers;

    return () => {
      map.remove();
      leafletMapRef.current = null;
      markersRef.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, hotels, selectedId]);

  if (hotels.length === 0) return null;

  return (
    <div className={`relative rounded-2xl overflow-hidden ${className}`}>
      <div
        ref={mapRef}
        className="w-full"
        style={{ height: 400, background: '#1a1a1a' }}
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a1a]">
          <div className="flex items-center gap-2 text-white/40 text-sm">
            <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            Loading map...
          </div>
        </div>
      )}
      {/* Legend */}
      <div className="absolute bottom-3 left-3 glass rounded-lg px-3 py-1.5 text-[10px] text-white/50">
        {hotels.filter((h) => h.lat && h.lng).length} hotels on map
      </div>
    </div>
  );
}
