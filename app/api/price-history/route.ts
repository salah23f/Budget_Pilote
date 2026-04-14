import { NextRequest, NextResponse } from 'next/server';
import { getSamples, routeKey } from '@/lib/agent/price-history';

/**
 * GET /api/price-history?origin=CDG&destination=JFK&cabin=economy&adults=1
 *
 * Returns real price history samples from the agent's time-series store.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.searchParams.get('origin');
  const destination = req.nextUrl.searchParams.get('destination');
  const cabin = req.nextUrl.searchParams.get('cabin') || 'economy';
  const adults = Number(req.nextUrl.searchParams.get('adults')) || 1;

  if (!origin || !destination) {
    return NextResponse.json({ error: 'Missing origin or destination' }, { status: 400 });
  }

  try {
    const samples = await getSamples({ origin, destination, cabinClass: cabin, adults });

    // Transform to chart-friendly format
    const data = samples.map((s) => ({
      date: s.checkedAt.split('T')[0],
      price: s.priceUsd,
      airline: s.airline,
      offerCount: s.offerCount,
    }));

    return NextResponse.json({
      success: true,
      data,
      count: data.length,
      route: `${origin} → ${destination}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to get history' }, { status: 500 });
  }
}
