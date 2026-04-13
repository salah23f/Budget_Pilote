import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const memory = globalThis as any;

if (!memory.__flyeasStore) {
  memory.__flyeasStore = {
    missions: new Map(),
    offers: new Map(),
    decisions: new Map(),
  };
}

const store = memory.__flyeasStore;

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;

  if (!supabaseAdmin) {
    return NextResponse.json({
      mission: store.missions.get(id) ?? null,
      offers: store.offers.get(id) ?? [],
      decisions: store.decisions.get(id) ?? [],
    });
  }

  const { data: mission, error: missionError } = await supabaseAdmin
    .from('missions')
    .select('*')
    .eq('id', id)
    .single();

  if (missionError || !mission) {
    return NextResponse.json({
      mission: null,
      offers: [],
      decisions: [],
    });
  }

  const { data: offers } = await supabaseAdmin
    .from('offers_history')
    .select('*')
    .eq('mission_id', id)
    .order('score', { ascending: false });

  return NextResponse.json({
    mission: {
      id: mission.id,
      origin: mission.origin,
      destination: mission.destination,
      departDate: mission.depart_date,
      returnDate: mission.return_date,
      maxBudgetUsd: Number(mission.max_budget_usd),
      autoBuyThresholdUsd: Number(mission.auto_buy_threshold_usd),
      status: mission.status,
      ecoPreference: mission.eco_preference,
    },
    offers: (offers ?? []).map((offer) => ({
      id: offer.id,
      airline: offer.airline,
      priceUsd: Number(offer.price_usd),
      carbonKg: Number(offer.carbon_kg),
      score: offer.score ? Number(offer.score) : undefined,
      label: offer.label ?? undefined,
      outboundHour: 9,
      durationHours: 2.5,
      stops: 0,
      cabinBagIncluded: true,
      explanation: `${offer.airline} monitored by agent.`,
    })),
    decisions: [],
  });
}