import type { Offer, FlightSearchParams, CabinClass } from '../types';

/**
 * Google Flights2 integration via RapidAPI.
 *
 * Host: google-flights2.p.rapidapi.com
 * Plan utilisé : BASIC (gratuit, ~100 req/mois)
 *
 * Sert de 2e fallback réel après Kiwi quand celui-ci est over-quota
 * ou en panne, et avant Amadeus. Vraies données Google Flights, jamais
 * synthétique.
 *
 * Réponse Google Flights2 : structure variable selon version. Le parser
 * ci-dessous est défensif — accepte plusieurs shapes (`data.itineraries`,
 * `flights`, `topFlights`) et tombe gracieusement sur `[]` si la
 * structure est imprévue.
 */

const GF_HOST = 'google-flights2.p.rapidapi.com';
const GF_BASE = `https://${GF_HOST}`;

export function isGoogleFlightsConfigured(): boolean {
  return !!process.env.RAPIDAPI_KEY;
}

function headers() {
  return {
    'x-rapidapi-key': process.env.RAPIDAPI_KEY!,
    'x-rapidapi-host': GF_HOST,
  };
}

const CABIN_MAP: Record<string, string> = {
  economy: '1',
  premium_economy: '2',
  business: '3',
  first: '4',
};

/**
 * Cherche des vols sur Google Flights via RapidAPI.
 * Renvoie un tableau d'Offer normalisés (provider='google_flights') ou []
 * si la requête échoue ou si aucun résultat exploitable.
 */
export async function searchFlightsGoogle(
  params: FlightSearchParams & { originIata?: string; destinationIata?: string }
): Promise<Offer[]> {
  if (!isGoogleFlightsConfigured()) {
    throw new Error('NO_GOOGLE_FLIGHTS');
  }

  const originCode = (params.originIata || params.origin || '').toUpperCase();
  const destCode = (params.destinationIata || params.destination || '').toUpperCase();
  if (!originCode || !destCode) {
    throw new Error('Google Flights: missing origin/destination IATA');
  }

  const cabin = CABIN_MAP[params.cabinClass || 'economy'] ?? '1';
  const adults = String(Math.max(1, Math.min(9, Number(params.adults) || 1)));

  const url = new URL(`${GF_BASE}/api/v1/searchFlights`);
  url.searchParams.set('departure_id', originCode);
  url.searchParams.set('arrival_id', destCode);
  url.searchParams.set('outbound_date', params.departDate);
  if (params.returnDate) {
    url.searchParams.set('return_date', params.returnDate);
    url.searchParams.set('travel_class', cabin);
  } else {
    url.searchParams.set('travel_class', cabin);
  }
  url.searchParams.set('adults', adults);
  url.searchParams.set('show_hidden', '1');
  url.searchParams.set('currency', 'USD');
  url.searchParams.set('language_code', 'en-US');
  url.searchParams.set('country_code', 'US');

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: headers(),
      // Si Google Flights met >15 s à répondre, on bail — Vercel a un
      // budget global limité côté watcher.
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    throw new Error(
      `Google Flights fetch failed: ${(e as Error)?.message ?? 'network'}`
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Google Flights ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json().catch(() => ({}));

  // Réponses Google Flights2 connues (selon API et version) :
  //  { status, data: { itineraries: [...], topFlights: [...] } }
  //  { data: { flights: [...] } }
  //  { itineraries: [...] }
  const itinList: any[] =
    (Array.isArray(data?.data?.itineraries) && data.data.itineraries) ||
    (Array.isArray(data?.data?.topFlights) && data.data.topFlights) ||
    (Array.isArray(data?.data?.otherFlights) && data.data.otherFlights) ||
    (Array.isArray(data?.data?.flights) && data.data.flights) ||
    (Array.isArray(data?.itineraries) && data.itineraries) ||
    (Array.isArray(data?.flights) && data.flights) ||
    [];

  if (itinList.length === 0) {
    console.warn('[google-flights] no itineraries', {
      http_status: res.status,
      http_ok: res.ok,
      response_keys: Object.keys(data || {}),
      api_status: (data as { status?: unknown })?.status,
      api_message: (data as { message?: unknown })?.message,
      sent_departure_id: originCode,
      sent_arrival_id: destCode,
      sent_outbound_date: params.departDate,
      sent_travel_class: cabin,
    });
    return [];
  }

  const cabinOut = (params.cabinClass || 'economy') as CabinClass;

  const offers: Offer[] = itinList.slice(0, 30).map((it: any, i: number): Offer => {
    // Prix : peut être nombre direct, "$123", { amount: 123 }
    const rawPrice = it.price ?? it.totalPrice ?? it.price_usd;
    let price = 0;
    if (typeof rawPrice === 'number') price = rawPrice;
    else if (typeof rawPrice === 'string') price = Number(rawPrice.replace(/[^0-9.]/g, '')) || 0;
    else if (rawPrice && typeof rawPrice === 'object') {
      price = Number(rawPrice.amount ?? rawPrice.value ?? rawPrice.raw ?? 0);
    }

    // Vols : tableau des segments pour ce trajet aller (ou aller+retour selon API)
    const flightSegments: any[] = Array.isArray(it.flights)
      ? it.flights
      : Array.isArray(it.legs)
        ? it.legs
        : Array.isArray(it.segments)
          ? it.segments
          : [];

    const first = flightSegments[0] || {};
    const last = flightSegments[flightSegments.length - 1] || first;

    const airlineName =
      first.airline ||
      first.carrier?.name ||
      first.flight?.airline ||
      'Unknown';
    const airlineCode =
      first.airline_code ||
      first.carrier?.code ||
      first.flight?.airlineCode ||
      '';
    const flightNum =
      first.flight_number ||
      first.flightNumber ||
      `${airlineCode}${first.number || ''}`.trim();

    const dep =
      first.departure_time ||
      first.departure ||
      first.departureAirport?.time;
    const arr =
      last.arrival_time ||
      last.arrival ||
      last.arrivalAirport?.time;

    const totalDurationMin =
      Number(it.total_duration || it.totalDuration || it.duration || 0) ||
      flightSegments.reduce((s: number, f: any) => s + Number(f.duration || 0), 0);

    const stops = Math.max(0, flightSegments.length - 1);

    return {
      id: `gf_${it.id || i}`,
      missionId: '',
      source: 'amadeus' as const,
      externalId: String(it.id || i),
      airline: airlineName,
      airlineCode,
      flightNumber: flightNum,
      departureTime: dep,
      arrivalTime: arr,
      durationMinutes: totalDurationMin,
      stops,
      cabinClass: cabinOut,
      baggageIncluded: !/spirit|frontier|ryanair|easyjet|wizz/i.test(airlineName),
      priceUsd: price > 0 ? Math.round(price) : 0,
      originalCurrency: 'USD',
      originalPrice: price > 0 ? Math.round(price) : 0,
      carbonKg: Math.round((totalDurationMin / 60) * 850 * 0.09 * (1 + stops * 0.15)),
      rawData: {
        provider: 'google_flights',
        originIata: originCode,
        destinationIata: destCode,
        deepLink: it.booking_token || it.bookingUrl || undefined,
      },
      fetchedAt: new Date().toISOString(),
    };
  });

  const valid = offers.filter((o) => o.priceUsd > 0);
  valid.sort((a, b) => a.priceUsd - b.priceUsd);
  return valid;
}
