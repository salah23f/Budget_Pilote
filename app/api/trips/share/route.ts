import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/trips/share — Create a shareable trip link
 */

async function getSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function generateShareId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export async function POST(req: NextRequest) {
  const db = await getSupabase();
  if (!db) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { title, flights, hotels, cars, totalPrice, destination, destinationCoords, createdBy } = body;

    if (!title?.trim() && !destination?.trim()) {
      return NextResponse.json({ error: 'Title or destination is required' }, { status: 400 });
    }

    const shareId = generateShareId();

    const tripData = {
      title: title?.trim() || `Trip to ${destination}`,
      flights: flights || [],
      hotels: hotels || [],
      cars: cars || [],
      totalPrice: totalPrice || 0,
      destination: destination?.trim() || '',
      destinationCoords: destinationCoords || null,
      createdBy: createdBy || null,
    };

    const { error } = await db
      .from('shared_trips')
      .insert({
        share_id: shareId,
        trip_data: tripData,
      });

    if (error) {
      console.error('Failed to create shared trip:', error);
      return NextResponse.json({ error: 'Failed to create shared trip' }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://faregenie.vercel.app';
    const publicUrl = `${baseUrl}/trip/${shareId}`;

    return NextResponse.json({ shareId, url: publicUrl });
  } catch (err) {
    console.error('Share trip error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
