import { NextRequest, NextResponse } from 'next/server';
import { searchFlights, searchFlightsDebug } from '@/lib/amadeus/flights';
import { scoreOffers } from '@/lib/scoring';
import type { FlightSearchParams } from '@/lib/types';

export async function POST(req: NextRequest) {
  // Rate limiting: max 10 searches per minute per IP
  const { rateLimit } = await import('@/lib/rate-limit');
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { allowed } = rateLimit(`flights:${ip}`, 10, 60000);
  if (!allowed) {
    return NextResponse.json({ success: false, error: 'Too many searches. Please wait a moment.' }, { status: 429 });
  }

  let body: FlightSearchParams & { originSkyId?: string; originEntityId?: string; destSkyId?: string; destEntityId?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  // Validate required fields
  if (!body.origin || !body.destination || !body.departDate) {
    return NextResponse.json(
      {
        success: false,
        error: 'Missing required fields: origin, destination, departDate',
      },
      { status: 400 }
    );
  }

  try {
    const offers = await searchFlights(body);

    if (offers.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
        message: 'No flights available for this route and date.',
      });
    }

    // Score the offers
    const scored = scoreOffers(offers, {
      avgPrice:
        offers.reduce((s, o) => s + o.priceUsd, 0) / (offers.length || 1),
      minPrice: Math.min(...offers.map((o) => o.priceUsd), Infinity),
      maxPrice: Math.max(...offers.map((o) => o.priceUsd), 0),
      pricePercentile: 50,
      trend: 'stable',
      daysUntilDeparture: Math.ceil(
        (new Date(body.departDate).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      ),
    });

    return NextResponse.json({
      success: true,
      data: scored,
      count: scored.length,
    });
  } catch (error: any) {
    console.error('Flight search error:', error);

    const message = error.message || 'Search failed';

    if (message.includes('RAPIDAPI_KEY')) {
      return NextResponse.json({
        success: false,
        error: 'API not configured. Please add RAPIDAPI_KEY to your .env.local file.',
      }, { status: 503 });
    }

    if (message.includes('429')) {
      return NextResponse.json({
        success: false,
        error: 'API rate limit reached. Please wait a moment and try again.',
      }, { status: 429 });
    }

    if (message.includes('UPSTREAM_UNAVAILABLE')) {
      return NextResponse.json({
        success: false,
        error: 'Flight data provider is temporarily unavailable for this route. Please try again in a moment.',
      }, { status: 503 });
    }

    if (/not subscribed|403/i.test(message)) {
      return NextResponse.json({
        success: false,
        error: 'Flight provider not subscribed. Go to RapidAPI and click "Subscribe" (free tier) on the Kiwi.com Cheap Flights API.',
      }, { status: 503 });
    }

    if (/Could not resolve/i.test(message)) {
      return NextResponse.json({
        success: false,
        error: message,
      }, { status: 404 });
    }

    return NextResponse.json({
      success: false,
      error: `Flight search failed: ${message}`,
    }, { status: 500 });
  }
}
