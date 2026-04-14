import { NextRequest, NextResponse } from 'next/server';
import { searchCars, type CarSearchParams } from '@/lib/amadeus/cars';

export async function POST(req: NextRequest) {
  const { rateLimit } = await import('@/lib/rate-limit');
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { allowed } = rateLimit(`cars:${ip}`, 10, 60000);
  if (!allowed) {
    return NextResponse.json({ success: false, error: 'Too many searches. Please wait.' }, { status: 429 });
  }

  let body: CarSearchParams;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.pickupLocation || !body.pickupDate || !body.dropoffDate) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields: pickupLocation, pickupDate, dropoffDate' },
      { status: 400 }
    );
  }

  try {
    const results = await searchCars(body);
    return NextResponse.json({ success: true, data: results, count: results.length });
  } catch (err: any) {
    console.error('[cars/search] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Car search failed' }, { status: 500 });
  }
}
