import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/group-trips — Create a new group trip
 * GET /api/group-trips — List user's group trips
 */

async function getSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  const db = await getSupabase();
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  try {
    const { name, destination, startDate, endDate, ownerName, ownerEmail } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Trip name is required' }, { status: 400 });
    }

    // Create the group trip
    const { data: trip, error: tripErr } = await db
      .from('group_trips')
      .insert({
        name: name.trim(),
        destination: destination?.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        owner_id: ownerEmail || 'anonymous',
        owner_name: ownerName || 'Organizer',
      })
      .select()
      .single();

    if (tripErr) throw tripErr;

    // Add owner as first member
    await db.from('group_members').insert({
      group_id: trip.id,
      user_name: ownerName || 'Organizer',
      user_email: ownerEmail || null,
      role: 'organizer',
      status: 'confirmed',
    });

    return NextResponse.json({
      success: true,
      trip,
      inviteLink: `https://faregenie.vercel.app/group-trip/${trip.id}?code=${trip.invite_code}`,
    });
  } catch (err: any) {
    console.error('[group-trips] create error:', err);
    return NextResponse.json({ error: err.message || 'Failed to create trip' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const db = await getSupabase();
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const email = req.nextUrl.searchParams.get('email');

  try {
    if (email) {
      // Get trips where user is a member
      const { data: memberships } = await db
        .from('group_members')
        .select('group_id')
        .eq('user_email', email.toLowerCase());

      const groupIds = memberships?.map((m: any) => m.group_id) || [];

      if (groupIds.length === 0) {
        return NextResponse.json({ success: true, trips: [] });
      }

      const { data: trips } = await db
        .from('group_trips')
        .select('*')
        .in('id', groupIds)
        .order('created_at', { ascending: false });

      return NextResponse.json({ success: true, trips: trips || [] });
    }

    // No email filter — return recent public trips (limit 20)
    const { data: trips } = await db
      .from('group_trips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({ success: true, trips: trips || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list trips' }, { status: 500 });
  }
}
