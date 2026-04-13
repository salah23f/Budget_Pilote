import { NextRequest, NextResponse } from 'next/server';
import { searchHotels } from '@/lib/amadeus/hotels';
import type { HotelSearchParams } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: HotelSearchParams & { entityId?: string; query?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  // We need either an entityId (preferred, from destination autocomplete)
  // or a free-text query / cityCode that we can resolve.
  const destination = body.entityId || body.query || body.cityCode;
  if (!destination || !body.checkIn || !body.checkOut) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields: destination, checkIn, checkOut' },
      { status: 400 }
    );
  }

  try {
    const offers = await searchHotels(body);
    return NextResponse.json({
      success: true,
      data: offers,
      count: offers.length,
    });
  } catch (error: any) {
    console.error('Hotel search error:', error);

    const message = error?.message || 'Search failed';

    if (message.includes('RAPIDAPI_KEY')) {
      return NextResponse.json({
        success: false,
        error: 'API not configured. Please add RAPIDAPI_KEY to environment variables.',
      }, { status: 503 });
    }

    if (message.includes('429') || /rate.?limit/i.test(message)) {
      return NextResponse.json({
        success: false,
        error: 'API rate limit reached. Please wait a moment and try again.',
      }, { status: 429 });
    }

    if (/Could not resolve location|Could not find location|Missing destination/i.test(message)) {
      return NextResponse.json({
        success: false,
        error: `Could not find that destination. Try a city name like "Paris" or "New York".`,
      }, { status: 404 });
    }

    return NextResponse.json({
      success: false,
      error: `Hotel search failed: ${message}`,
    }, { status: 500 });
  }
}
