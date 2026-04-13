import type { Offer, HotelSearchParams } from '../types';

/**
 * Real hotel search backed by Sky-Scrapper (RapidAPI).
 *
 * Two step flow:
 *  1. Resolve a human-typed destination ("Paris", "New York", "CDG") into an
 *     entityId via /api/v1/hotels/searchDestinationOrHotel
 *  2. Query /api/v1/hotels/searchHotels with that entityId + dates.
 *
 * Response shapes on sky-scrapper have varied across versions, so the parser
 * below is defensive and tolerates multiple field names.
 */

const BASE_URL = 'https://sky-scrapper.p.rapidapi.com';

type SkyDestination = {
  entityId: string;
  entityName: string;
  entityType?: string;
  hierarchy?: string;
  location?: string; // "lat,lng"
  class?: string;
};

function headers() {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) throw new Error('RAPIDAPI_KEY not configured');
  return {
    'x-rapidapi-key': apiKey,
    'x-rapidapi-host': 'sky-scrapper.p.rapidapi.com',
  } as Record<string, string>;
}

async function skyFetch(path: string, params: Record<string, string | number | undefined>): Promise<any> {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });

  const res = await fetch(url.toString(), { headers: headers() });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`sky-scrapper ${path} ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Resolve a destination query (city name, airport, etc.) into a Sky-Scrapper entityId.
 * Returns `null` if nothing plausible was found.
 */
export async function resolveHotelDestination(query: string): Promise<SkyDestination | null> {
  const data = await skyFetch('/api/v1/hotels/searchDestinationOrHotel', { query });
  const list: any[] = Array.isArray(data?.data) ? data.data : [];
  if (list.length === 0) return null;

  // Prefer city-level matches, then region, then hotel (so "Paris" -> the city, not a random Paris hotel).
  const rank = (t?: string) => {
    const s = (t || '').toLowerCase();
    if (s.includes('city')) return 0;
    if (s.includes('region') || s.includes('area')) return 1;
    if (s.includes('district') || s.includes('neighborhood')) return 2;
    if (s.includes('airport')) return 3;
    if (s.includes('hotel')) return 4;
    return 5;
  };
  list.sort((a, b) => rank(a.entityType || a.class) - rank(b.entityType || b.class));
  const top = list[0];
  if (!top?.entityId) return null;

  return {
    entityId: String(top.entityId),
    entityName: top.entityName || top.suggestItem || query,
    entityType: top.entityType || top.class,
    hierarchy: top.hierarchy,
    location: top.location,
  };
}

/** List of destinations for autocomplete. */
export async function searchLocations(keyword: string): Promise<Array<{ code: string; name: string; type: string; entityId: string; hierarchy?: string }>> {
  if (!keyword || keyword.length < 2) return [];

  try {
    const data = await skyFetch('/api/v1/hotels/searchDestinationOrHotel', { query: keyword });
    const list: any[] = Array.isArray(data?.data) ? data.data : [];
    return list.slice(0, 10).map((d) => ({
      code: String(d.entityId || ''),
      entityId: String(d.entityId || ''),
      name: d.entityName || d.suggestItem || keyword,
      type: String(d.entityType || d.class || 'CITY').toUpperCase(),
      hierarchy: d.hierarchy,
    }));
  } catch (err) {
    console.warn('[hotels] searchLocations failed:', (err as Error).message);
    return [];
  }
}

function pickImages(h: any): string[] {
  const out: string[] = [];
  const push = (v: any) => {
    if (!v) return;
    if (typeof v === 'string' && v.startsWith('http')) out.push(v);
    else if (typeof v === 'object') {
      if (typeof v.url === 'string') out.push(v.url);
      else if (typeof v.src === 'string') out.push(v.src);
      else if (typeof v.imageUrl === 'string') out.push(v.imageUrl);
    }
  };

  push(h.heroImage);
  push(h.image);
  push(h.mainImage);
  const arrays = [h.images, h.gallery, h.photos, h.imageUrls];
  for (const arr of arrays) {
    if (Array.isArray(arr)) arr.forEach(push);
  }
  return Array.from(new Set(out));
}

function pickPrice(h: any): number {
  const candidates = [
    h.rawPrice,
    h.price?.raw,
    h.price?.amount,
    h.cheapestPrice?.raw,
    h.cheapestPrice?.amount,
    h.lowestPrice?.raw,
    typeof h.price === 'number' ? h.price : undefined,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  // As a last resort try to parse a currency string like "$123" or "€ 1,234"
  if (typeof h.price === 'string') {
    const num = Number(h.price.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(num) && num > 0) return num;
  }
  return 0;
}

function pickCoords(h: any): { lat: number; lng: number } {
  const c = h.coordinates || h.coordinate || h.location;

  // Sky-Scrapper format: coordinates is an array [lng, lat] (GeoJSON-like)
  if (Array.isArray(c) && c.length >= 2) {
    const a = Number(c[0]);
    const b = Number(c[1]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      // Heuristic: latitude must be in [-90, 90]; longitude in [-180, 180].
      // Sky-Scrapper returns [lng, lat], so b is lat.
      if (Math.abs(b) <= 90 && Math.abs(a) <= 180) return { lat: b, lng: a };
      if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return { lat: a, lng: b };
    }
  }

  if (c && typeof c === 'object' && !Array.isArray(c)) {
    const lat = Number(c.latitude ?? c.lat);
    const lng = Number(c.longitude ?? c.lng ?? c.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  if (typeof c === 'string' && c.includes(',')) {
    const [lat, lng] = c.split(',').map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  const lat = Number(h.latitude ?? h.lat);
  const lng = Number(h.longitude ?? h.lng ?? h.lon);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return { lat: 0, lng: 0 };
}

function pickStars(h: any): number {
  const v = Number(h.stars ?? h.starRating ?? h.rating?.value ?? h.starRatingValue);
  return Number.isFinite(v) ? Math.round(v) : 0;
}

function pickGuestRating(h: any): { score: number; count: number; label?: string } {
  // Sky-Scrapper uses `rating` (0-10 scale) or `reviewSummary` (0-5 scale).
  const r = h.rating || h.reviewsSummary || h.reviewSummary || h.reviews || h.guestReviews || h.guestScore || {};
  const raw = r.value ?? r.score ?? r.rating ?? h.reviewScore ?? h.guestRating;
  let score = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  if (!Number.isFinite(score)) score = 0;
  // If the score looks like a 5-star value, rescale to 10.
  if (score > 0 && score <= 5) score = score * 2;
  const count = Number(r.count ?? r.total ?? r.numReviews ?? 0);
  const label = r.description || r.scoreDesc || r.label;
  return { score: Math.round(score * 10) / 10, count: Number.isFinite(count) ? count : 0, label };
}

function pickAddress(h: any, fallback?: string): string {
  // Prefer the POI-relative distance ("1.42 miles from Palais Garnier")
  // because it's more informative than "X miles from downtown".
  const candidates = [
    h.address,
    h.location?.address,
    h.addressLine,
    h.fullAddress,
    h.relevantPoiDistance,
    h.distance,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
    if (c && typeof c === 'object' && typeof c.formattedAddress === 'string') return c.formattedAddress;
  }
  return fallback || '';
}

function extractHotelArray(data: any): any[] {
  // Sky-Scrapper has moved things around over versions; try the common shapes.
  const candidates = [
    data?.data?.results?.hotelCards,
    data?.data?.hotelCards,
    data?.data?.hotels,
    data?.data?.results,
    data?.data?.searchResults,
    data?.results?.hotelCards,
    data?.results?.hotels,
    data?.hotels,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c;
    if (Array.isArray(c?.hotelCards) && c.hotelCards.length > 0) return c.hotelCards;
  }
  // Some versions wrap each entry with { hotel: {...} }
  const flat = candidates.find((c) => Array.isArray(c)) as any[] | undefined;
  if (flat) return flat.map((item) => item?.hotel || item);
  return [];
}

export async function searchHotels(
  params: HotelSearchParams & { entityId?: string; query?: string }
): Promise<Offer[]> {
  const checkIn = params.checkIn;
  const checkOut = params.checkOut;
  const nightsMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  const nights = Math.max(1, Math.ceil(nightsMs / 86400000));

  // Resolve entityId if we don't already have one.
  let entityId = params.entityId;
  let destinationLabel = params.query || params.cityCode;

  if (!entityId) {
    const destQuery = params.query || params.cityCode;
    if (!destQuery) throw new Error('Missing destination');
    const resolved = await resolveHotelDestination(destQuery);
    if (!resolved) throw new Error(`Could not resolve location "${destQuery}"`);
    entityId = resolved.entityId;
    destinationLabel = resolved.entityName;
  }

  const data = await skyFetch('/api/v1/hotels/searchHotels', {
    entityId,
    checkin: checkIn,
    checkout: checkOut,
    adults: params.adults || 2,
    rooms: params.rooms || 1,
    limit: 30,
    sort: 'price',
    currency: 'USD',
    market: 'en-US',
    countryCode: 'US',
  });

  const rawHotels = extractHotelArray(data);
  if (rawHotels.length === 0) {
    console.warn('[hotels] no hotels extracted. root keys:', Object.keys(data || {}));
    return [];
  }

  const offers: Offer[] = rawHotels.map((h, i) => {
    const price = pickPrice(h);
    const coords = pickCoords(h);
    const images = pickImages(h);
    const guest = pickGuestRating(h);
    const stars = pickStars(h);
    const address = pickAddress(h, destinationLabel);

    return {
      id: `sk_hotel_${h.hotelId || h.id || i}`,
      missionId: '',
      source: 'amadeus' as const,
      externalId: String(h.hotelId || h.id || i),
      hotelName: h.name || h.hotelName || 'Hotel',
      hotelRating: stars,
      amenities: Array.isArray(h.amenities) ? h.amenities.slice(0, 8) : [],
      photos: images,
      locationLat: coords.lat,
      locationLng: coords.lng,
      checkIn,
      checkOut,
      roomType: h.roomType || h.cheapestOfferPartnerName || '',
      priceUsd: price > 0 ? Math.round(price) : 0,
      originalCurrency: 'USD',
      originalPrice: price > 0 ? Math.round(price) : 0,
      rawData: {
        pricePerNight: price > 0 ? Math.round(price / nights) : 0,
        nights,
        address,
        guestRating: guest.score,
        reviewCount: guest.count,
        guestRatingLabel: guest.label,
        distance: h.distance || h.relevantPoiDistance,
        cheapestOfferPartnerName: h.cheapestOfferPartnerName,
        hotelId: h.hotelId || h.id,
      },
      fetchedAt: new Date().toISOString(),
    };
  });

  // Drop entries we couldn't price at all
  const priced = offers.filter((o) => o.priceUsd > 0);
  priced.sort((a, b) => a.priceUsd - b.priceUsd);
  return priced;
}
