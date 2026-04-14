import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/trips/[shareId] — Fetch a shared trip by its share ID
 */

async function getSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ shareId: string }> },
) {
  const { shareId } = await params;

  if (!shareId || shareId.length !== 8) {
    return NextResponse.json({ error: 'Invalid share ID' }, { status: 400 });
  }

  const db = await getSupabase();
  if (!db) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { data, error } = await db
      .from('shared_trips')
      .select('share_id, trip_data, created_at')
      .eq('share_id', shareId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    return NextResponse.json({
      shareId: data.share_id,
      tripData: data.trip_data,
      createdAt: data.created_at,
    });
  } catch (err) {
    console.error('Fetch shared trip error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
