import { NextRequest, NextResponse } from 'next/server';

async function getSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * POST /api/group-trips/[id]/join — Join a trip via invite code
 */
export async function POST(req: NextRequest, context: { params: { id: string } }) {
  const db = await getSupabase();
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  try {
    const { code, userName, userEmail } = await req.json();
    const tripId = context.params.id;

    // Verify invite code
    const { data: trip } = await db
      .from('group_trips')
      .select('id, invite_code, name')
      .eq('id', tripId)
      .single();

    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    if (trip.invite_code !== code) return NextResponse.json({ error: 'Invalid invite code' }, { status: 403 });

    // Check if already a member
    if (userEmail) {
      const { data: existing } = await db
        .from('group_members')
        .select('id')
        .eq('group_id', tripId)
        .eq('user_email', userEmail.toLowerCase())
        .single();

      if (existing) {
        return NextResponse.json({ success: true, message: 'Already a member', alreadyMember: true });
      }
    }

    // Add as member
    const { data: member, error } = await db
      .from('group_members')
      .insert({
        group_id: tripId,
        user_name: userName || 'Guest',
        user_email: userEmail?.toLowerCase() || null,
        role: 'member',
        status: 'confirmed',
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`[group-trips] ${userName} joined trip "${trip.name}"`);

    return NextResponse.json({ success: true, member, tripName: trip.name });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
