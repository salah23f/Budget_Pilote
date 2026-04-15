import { NextRequest, NextResponse } from 'next/server';
import { searchFlights } from '@/lib/amadeus/flights';
import { searchHotels, resolveHotelDestination } from '@/lib/amadeus/hotels';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Natural-language trip planning endpoint.
 *
 * Takes a free-form prompt like "4 days in Barcelona from Paris next month
 * under $800" and returns a real flight + hotel plan from LIVE data.
 *
 * Extraction pipeline:
 *  1. Parse origin / destination / dates / budget / nights / travelers
 *  2. Resolve origin + destination to IATA via live API
 *  3. Fire flight search + hotel search in parallel
 *  4. Return the cheapest flight + 3 hotels that fit the leftover budget
 */

interface ParsedPrompt {
  origin?: string;
  destination?: string;
  departDate?: string;
  returnDate?: string;
  nights?: number;
  budget?: number;
  travelers: number;
}

const CITY_PATTERNS: Record<string, string[]> = {
  paris: ['paris', 'pari'],
  london: ['london', 'londres'],
  'new york': ['new york', 'nyc', 'new-york'],
  tokyo: ['tokyo', 'tokio'],
  barcelona: ['barcelona', 'barcelone'],
  rome: ['rome', 'roma'],
  madrid: ['madrid'],
  berlin: ['berlin'],
  amsterdam: ['amsterdam'],
  dubai: ['dubai', 'dubaï'],
  bangkok: ['bangkok'],
  istanbul: ['istanbul'],
  lisbon: ['lisbon', 'lisbonne', 'lisboa'],
  athens: ['athens', 'athènes'],
  prague: ['prague'],
  vienna: ['vienna', 'vienne'],
  budapest: ['budapest'],
  copenhagen: ['copenhagen', 'copenhague'],
  stockholm: ['stockholm'],
  tunis: ['tunis'],
  casablanca: ['casablanca'],
  marrakech: ['marrakech', 'marrakesh'],
  cairo: ['cairo', 'le caire'],
  singapore: ['singapore', 'singapour'],
  'hong kong': ['hong kong', 'hongkong'],
  sydney: ['sydney'],
  melbourne: ['melbourne'],
  'los angeles': ['los angeles', 'la', 'lax'],
  'san francisco': ['san francisco', 'sf', 'sfo'],
  miami: ['miami'],
  chicago: ['chicago'],
  nice: ['nice'],
  geneva: ['geneva', 'genève'],
  zurich: ['zurich'],
  milan: ['milan', 'milano'],
  seoul: ['seoul'],
  bali: ['bali', 'denpasar'],
  phuket: ['phuket'],
};

function findCity(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const [canonical, aliases] of Object.entries(CITY_PATTERNS)) {
    for (const a of aliases) {
      const re = new RegExp(`\\b${a}\\b`, 'i');
      if (re.test(lower)) return canonical;
    }
  }
  return undefined;
}

function parsePrompt(input: string): ParsedPrompt {
  const text = input.trim();

  // Budget — "$800", "under 800", "max 1500", "€1000"
  const budgetMatch =
    text.match(/(?:under|max|budget|less than|around|sous|max\.?|jusqu'à)\s*[\$€£]?\s*(\d{2,5})/i) ||
    text.match(/[\$€£]\s*(\d{2,5})/);
  const budget = budgetMatch ? Number(budgetMatch[1]) : undefined;

  // Nights / days — "4 days", "3 nights", "a week"
  let nights: number | undefined;
  const daysMatch = text.match(/(\d+)\s*(?:days?|nights?|nuits?|jours?)/i);
  if (daysMatch) nights = Math.max(1, Number(daysMatch[1]));
  else if (/\bweek(?:end)?\b/i.test(text)) nights = 3;
  else if (/\ba?\s*month\b/i.test(text)) nights = 30;

  // Travelers — "2 people", "for 4", "family of 3"
  let travelers = 1;
  const pMatch = text.match(/(\d+)\s*(?:people|persons?|pax|adults?|travelers?|personnes?|voyageurs?)/i);
  if (pMatch) travelers = Math.max(1, Math.min(9, Number(pMatch[1])));

  // Routes — "X to Y", "from X to Y", "Paris -> Tokyo", "in Y" (destination only)
  let origin: string | undefined;
  let destination: string | undefined;

  // Words that should NEVER be part of a city name — stop the capture there.
  const stopWords = 'on|for|under|with|from|in|to|next|last|this|tomorrow|today|[0-9]|[\\$€£]';

  const routeMatch = text.match(
    new RegExp(`(?:from\\s+)?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\\s]{1,30}?)\\s+(?:to|->|→|vers|à)\\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\\s]{1,30}?)(?:\\s+(?:${stopWords})\\b|,|\\.|\\?|$)`, 'i')
  );
  if (routeMatch) {
    origin = routeMatch[1].trim();
    destination = routeMatch[2].trim();
  } else {
    // "4 days in Barcelona from Paris"
    const inMatch = text.match(
      new RegExp(`\\bin\\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\\s]{1,30}?)(?=\\s+(?:${stopWords})\\b|,|\\.|\\?|$)`, 'i')
    );
    if (inMatch) destination = inMatch[1].trim();
    const fromMatch = text.match(
      new RegExp(`\\bfrom\\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\\s]{1,30}?)(?=\\s+(?:${stopWords})\\b|,|\\.|\\?|$)`, 'i')
    );
    if (fromMatch) origin = fromMatch[1].trim();
  }

  // Second-pass cleanup: if the captured name contains a stop-word, trim at it.
  const trimCity = (s?: string) => {
    if (!s) return s;
    const m = s.match(/^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]*?)(?:\s+(?:next|last|this|tomorrow|today|on|for|under|with|from|in|to)\b.*)?$/i);
    return (m?.[1] || s).trim();
  };
  origin = trimCity(origin);
  destination = trimCity(destination);

  // If destination still missing, try city pattern matching
  if (!destination) {
    const city = findCity(text);
    if (city) destination = city;
  }

  // Dates — "next month", "June 15", "2026-06-15"
  const isoMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  let departDate: string | undefined;
  if (isoMatch) departDate = isoMatch[1];
  else if (/\bnext\s+week\b/i.test(text)) {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    departDate = d.toISOString().split('T')[0];
  } else if (/\bnext\s+month\b/i.test(text)) {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    departDate = d.toISOString().split('T')[0];
  } else {
    // Default: 30 days from now
    const d = new Date();
    d.setDate(d.getDate() + 30);
    departDate = d.toISOString().split('T')[0];
  }

  let returnDate: string | undefined;
  if (nights && departDate) {
    const d = new Date(departDate);
    d.setDate(d.getDate() + nights);
    returnDate = d.toISOString().split('T')[0];
  }

  return { origin, destination, departDate, returnDate, nights, budget, travelers };
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  let body: { prompt?: string };
  try {
    body = await req.json();
  } catch (_) {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const prompt = (body.prompt || '').trim();
  if (!prompt) {
    return NextResponse.json({ success: false, error: 'Empty prompt' }, { status: 400 });
  }

  try {
    const result = await planTripInternal(prompt);
    console.log('[plan] ok', { ms: Date.now() - started, dest: result.parsed.destination, flights: result.flights.length, hotels: result.hotels.length });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[plan] error', { ms: Date.now() - started, msg: err?.message });
    return NextResponse.json(
      { success: false, error: err?.message || 'Plan failed' },
      { status: 500 }
    );
  }
}

interface PlanResult {
  success: boolean;
  error?: string;
  parsed: ParsedPrompt;
  flights: any[];
  hotels: any[];
  flightsError?: string;
  hotelsError?: string;
  destinationName?: string;
  summary?: any;
}

async function planTripInternal(prompt: string): Promise<PlanResult> {
  const parsed = parsePrompt(prompt);

  if (!parsed.destination) {
    return {
      success: false,
      error: "I couldn't figure out where you want to go. Try something like 'Flight from Paris to Tokyo next month' or '4 days in Barcelona from London'.",
      parsed,
      flights: [],
      hotels: [],
    };
  }

  // Fire flight + hotel searches in parallel
  const tasks: Promise<any>[] = [];
  const results: any = { parsed };

  if (parsed.origin && parsed.destination && parsed.departDate) {
    tasks.push(
      (async () => {
        try {
          const offers = await searchFlights({
            origin: parsed.origin!,
            destination: parsed.destination!,
            departDate: parsed.departDate!,
            returnDate: parsed.returnDate,
            adults: parsed.travelers,
            cabinClass: 'economy',
          });
          // Top 3 cheapest
          results.flights = offers.slice(0, 3).map((o) => ({
            id: o.id,
            airline: o.airline,
            airlineCode: o.airlineCode,
            flightNumber: o.flightNumber,
            priceUsd: o.priceUsd,
            departureTime: o.departureTime,
            arrivalTime: o.arrivalTime,
            durationMinutes: o.durationMinutes,
            stops: o.stops,
            originIata: (o.rawData as any)?.originIata,
            destinationIata: (o.rawData as any)?.destinationIata,
            logoUrl: (o.rawData as any)?.logoUrl,
            deepLink: (o.rawData as any)?.deepLink,
          }));
        } catch (err: any) {
          results.flightsError = err?.message || 'Flight search unavailable';
        }
      })()
    );
  }

  // Hotels search (always, for the destination)
  if (parsed.destination && parsed.departDate && parsed.returnDate) {
    tasks.push(
      (async () => {
        try {
          const dest = await resolveHotelDestination(parsed.destination!);
          if (!dest) {
            results.hotelsError = `Could not find hotels in ${parsed.destination}`;
            return;
          }
          const offers = await searchHotels({
            cityCode: parsed.destination!,
            entityId: dest.entityId,
            query: parsed.destination!,
            checkIn: parsed.departDate!,
            checkOut: parsed.returnDate!,
            adults: parsed.travelers,
            rooms: 1,
          } as any);
          results.hotels = offers.slice(0, 3).map((o) => ({
            id: o.id,
            name: o.hotelName,
            stars: o.hotelRating,
            priceUsd: o.priceUsd,
            pricePerNight: (o.rawData as any)?.pricePerNight,
            guestRating: (o.rawData as any)?.guestRating,
            reviewCount: (o.rawData as any)?.reviewCount,
            address: (o.rawData as any)?.address,
            photos: o.photos || [],
            lat: o.locationLat,
            lng: o.locationLng,
            partner: (o.rawData as any)?.cheapestOfferPartnerName,
          }));
          results.destinationName = dest.entityName;
        } catch (err: any) {
          results.hotelsError = err?.message || 'Hotel search unavailable';
        }
      })()
    );
  }

  await Promise.all(tasks);

  const cheapestFlight = results.flights?.[0]?.priceUsd || 0;
  const cheapestHotelTotal = results.hotels?.[0]?.priceUsd || 0;
  const estimatedTotal = cheapestFlight * parsed.travelers + cheapestHotelTotal;

  return {
    success: true,
    parsed,
    flights: results.flights || [],
    hotels: results.hotels || [],
    flightsError: results.flightsError,
    hotelsError: results.hotelsError,
    destinationName: results.destinationName,
    summary: {
      cheapestFlight,
      cheapestHotelTotal,
      estimatedTotal,
      withinBudget: parsed.budget ? estimatedTotal <= parsed.budget : undefined,
      budget: parsed.budget,
    },
  };
}
