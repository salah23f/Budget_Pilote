import { NextResponse } from 'next/server';
import { scoreOffers, makeDecision, type ScoredOffer } from '@/lib/scoring';
import type { MarketSignal, Offer } from '@/lib/types';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { searchFlights } from '@/lib/amadeus/flights';
import { searchHotels } from '@/lib/amadeus/hotels';

const memory = globalThis as any;

if (!memory.__flyeasStore) {
  memory.__flyeasStore = {
    missions: new Map(),
    offers: new Map(),
    decisions: new Map(),
  };
}

const store = memory.__flyeasStore;

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch (_) {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const type: 'flight' | 'hotel' | 'package' = body.type || 'flight';

  // Shared validation
  if ((type === 'flight' || type === 'package') && (!body.origin || !body.destination || !body.departDate)) {
    return NextResponse.json(
      { success: false, error: 'Missing flight fields (origin, destination, departDate)' },
      { status: 400 }
    );
  }
  if ((type === 'hotel' || type === 'package') && (!body.checkIn || !body.checkOut)) {
    return NextResponse.json(
      { success: false, error: 'Missing hotel dates (checkIn, checkOut)' },
      { status: 400 }
    );
  }

  const id = crypto.randomUUID();

  const mission = {
    id,
    type,
    origin: body.origin || null,
    originCity: body.originCity || null,
    destination: body.destination || null,
    destinationCity: body.destinationCity || null,
    departDate: body.departDate || null,
    returnDate: body.returnDate || null,
    hotelEntityId: body.hotelEntityId || null,
    hotelDestination: body.hotelDestination || null,
    checkIn: body.checkIn || null,
    checkOut: body.checkOut || null,
    passengers: Number(body.passengers || 1),
    rooms: Number(body.rooms || 1),
    cabinClass: body.cabinClass || 'economy',
    ecoPreference: body.ecoPreference || 'balanced',
    stopsPreference: body.stopsPreference || 'any',
    preferredAirlines: body.preferredAirlines || [],
    maxBudgetUsd: Number(body.maxBudgetUsd || 0),
    autoBuyThresholdUsd: body.autoBuyThresholdUsd ? Number(body.autoBuyThresholdUsd) : null,
    budgetDepositedUsd: Number(body.budgetDepositedUsd || 0),
    monitoringEnabled: body.monitoringEnabled !== false,
    alertEmailEnabled: body.alertEmailEnabled !== false,
    status: 'monitoring' as const,
    createdAt: new Date().toISOString(),
  };

  let flightOffers: Offer[] = [];
  let hotelOffers: Offer[] = [];
  let searchErrors: string[] = [];

  // Run flight + hotel searches in parallel when needed
  const tasks: Array<Promise<void>> = [];

  if (type === 'flight' || type === 'package') {
    tasks.push(
      (async () => {
        try {
          flightOffers = await searchFlights({
            origin: mission.origin!,
            destination: mission.destination!,
            departDate: mission.departDate!,
            returnDate: mission.returnDate || undefined,
            adults: mission.passengers,
            cabinClass: mission.cabinClass as any,
          });
        } catch (err: any) {
          console.error('[mission] flight search error:', err.message);
          searchErrors.push(`Flight search: ${err.message}`);
        }
      })()
    );
  }

  if (type === 'hotel' || type === 'package') {
    tasks.push(
      (async () => {
        try {
          hotelOffers = await searchHotels({
            cityCode: mission.hotelDestination || mission.destinationCity || mission.destination || '',
            entityId: mission.hotelEntityId || undefined,
            query: mission.hotelDestination || undefined,
            checkIn: mission.checkIn!,
            checkOut: mission.checkOut!,
            adults: mission.passengers,
            rooms: mission.rooms,
          } as any);
        } catch (err: any) {
          console.error('[mission] hotel search error:', err.message);
          searchErrors.push(`Hotel search: ${err.message}`);
        }
      })()
    );
  }

  await Promise.all(tasks);

  // Compute market signal + scoring when we have offers (flights only for now)
  let bestOffer: Offer | null = null;
  let decision: any = null;
  let scored: ScoredOffer[] = [];

  if (flightOffers.length > 0) {
    const signal: MarketSignal = {
      avgPrice: flightOffers.reduce((s, o) => s + o.priceUsd, 0) / flightOffers.length,
      minPrice: Math.min(...flightOffers.map((o) => o.priceUsd)),
      maxPrice: Math.max(...flightOffers.map((o) => o.priceUsd)),
      pricePercentile: 50,
      trend: 'stable',
      daysUntilDeparture: Math.ceil(
        (new Date(mission.departDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ),
    };
    scored = scoreOffers(flightOffers, signal);
    decision = makeDecision(scored, mission as any, signal);
    bestOffer = scored[0];
  } else if (hotelOffers.length > 0) {
    bestOffer = hotelOffers[0];
  }

  const finalStatus =
    decision?.action === 'AUTO_BUY' ? 'booked' : 'monitoring';

  // In-memory store
  store.missions.set(id, { ...mission, status: finalStatus });
  store.offers.set(id, { flights: scored, hotels: hotelOffers });
  if (decision) store.decisions.set(id, [decision]);

  return NextResponse.json({
    success: true,
    mission: { ...mission, status: finalStatus },
    flightOffers: scored,
    hotelOffers,
    bestOffer,
    decision,
    searchErrors: searchErrors.length > 0 ? searchErrors : undefined,
  });
}
