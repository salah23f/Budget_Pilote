import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const exportDate = new Date().toISOString();

    if (!supabaseAdmin) {
      return NextResponse.json({
        exportDate,
        message: 'No server data available',
        user: null,
      });
    }

    // Get the user from the auth header
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    // Fetch user profile
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    // Fetch user missions
    const { data: missions } = await supabaseAdmin
      .from('missions')
      .select('*')
      .eq('user_id', userId);

    // Fetch user bookings (table may not exist)
    let bookings: any[] = [];
    try {
      const { data: bookingsData } = await supabaseAdmin
        .from('bookings')
        .select('*')
        .eq('user_id', userId);
      bookings = bookingsData ?? [];
    } catch {
      // bookings table may not exist — ignore
    }

    return NextResponse.json(
      {
        exportDate,
        user: userProfile ?? null,
        missions: missions ?? [],
        bookings,
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('[EXPORT] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
