import { NextRequest, NextResponse } from 'next/server';

async function getSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * POST /api/group-trips/[id]/polls/[pollId]/vote — Vote on a poll option
 */
export async function POST(req: NextRequest, context: { params: { id: string; pollId: string } }) {
  const db = await getSupabase();
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  try {
    const { optionId } = await req.json();
    if (!optionId) return NextResponse.json({ error: 'optionId required' }, { status: 400 });

    // Increment vote count
    const { data: option, error } = await db.rpc('increment_vote', { option_id: optionId });

    // Fallback if RPC not set up — do a manual update
    if (error) {
      const { data: current } = await db
        .from('group_poll_options')
        .select('votes')
        .eq('id', optionId)
        .single();

      if (!current) return NextResponse.json({ error: 'Option not found' }, { status: 404 });

      await db
        .from('group_poll_options')
        .update({ votes: (current.votes || 0) + 1 })
        .eq('id', optionId);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
