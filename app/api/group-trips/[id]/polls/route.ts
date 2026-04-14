import { NextRequest, NextResponse } from 'next/server';

async function getSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * POST /api/group-trips/[id]/polls — Create a poll with options
 */
export async function POST(req: NextRequest, context: { params: { id: string } }) {
  const db = await getSupabase();
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  try {
    const { question, options } = await req.json();
    const groupId = context.params.id;

    if (!question?.trim() || !options?.length || options.length < 2) {
      return NextResponse.json({ error: 'Question and at least 2 options required' }, { status: 400 });
    }

    // Create poll
    const { data: poll, error: pollErr } = await db
      .from('group_polls')
      .insert({ group_id: groupId, question: question.trim() })
      .select()
      .single();

    if (pollErr) throw pollErr;

    // Create options
    const optionRows = options.map((text: string) => ({
      poll_id: poll.id,
      text: text.trim(),
      votes: 0,
    }));

    const { data: createdOptions, error: optErr } = await db
      .from('group_poll_options')
      .insert(optionRows)
      .select();

    if (optErr) throw optErr;

    console.log(`[group-trips] Poll created: "${question}" with ${options.length} options`);

    return NextResponse.json({
      success: true,
      poll: { ...poll, options: createdOptions },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
