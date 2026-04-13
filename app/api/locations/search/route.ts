import { NextRequest, NextResponse } from 'next/server';
import { searchLocations } from '@/lib/amadeus/hotels';

export async function GET(req: NextRequest) {
  const keyword = req.nextUrl.searchParams.get('q') || '';

  if (keyword.length < 2) {
    return NextResponse.json({ success: true, data: [] });
  }

  try {
    const locations = await searchLocations(keyword);
    return NextResponse.json({ success: true, data: locations });
  } catch (error: any) {
    // Fallback popular cities
    const fallback = [
      { code: 'PAR', name: 'Paris', type: 'CITY' },
      { code: 'LON', name: 'London', type: 'CITY' },
      { code: 'NYC', name: 'New York', type: 'CITY' },
      { code: 'TYO', name: 'Tokyo', type: 'CITY' },
      { code: 'DXB', name: 'Dubai', type: 'CITY' },
      { code: 'SIN', name: 'Singapore', type: 'CITY' },
      { code: 'HKG', name: 'Hong Kong', type: 'CITY' },
      { code: 'BKK', name: 'Bangkok', type: 'CITY' },
      { code: 'FRA', name: 'Frankfurt', type: 'CITY' },
      { code: 'MAD', name: 'Madrid', type: 'CITY' },
    ].filter(
      (c) =>
        c.name.toLowerCase().includes(keyword.toLowerCase()) ||
        c.code.toLowerCase().includes(keyword.toLowerCase())
    );

    return NextResponse.json({ success: true, data: fallback });
  }
}
