import { NextRequest, NextResponse } from 'next/server';

async function getSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * GET /api/group-trips/[id] — Get full trip with members, polls, expenses
 */
export async function GET(req: NextRequest, context: { params: { id: string } }) {
  const db = await getSupabase();
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const tripId = context.params.id;

  try {
    const [tripRes, membersRes, pollsRes, expensesRes] = await Promise.all([
      db.from('group_trips').select('*').eq('id', tripId).single(),
      db.from('group_members').select('*').eq('group_id', tripId).order('joined_at'),
      db.from('group_polls').select('*, group_poll_options(*)').eq('group_id', tripId).order('created_at'),
      db.from('group_expenses').select('*').eq('group_id', tripId).order('created_at', { ascending: false }),
    ]);

    if (tripRes.error || !tripRes.data) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      trip: tripRes.data,
      members: membersRes.data || [],
      polls: (pollsRes.data || []).map((p: any) => ({
        ...p,
        options: p.group_poll_options || [],
      })),
      expenses: expensesRes.data || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
