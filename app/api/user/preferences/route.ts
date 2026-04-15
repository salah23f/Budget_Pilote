import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/* ------------------------------------------------------------------ */
/*  GET /api/user/preferences?userId=xxx                                */
/*  Fetches the user preferences row from Supabase.                     */
/* ------------------------------------------------------------------ */

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 503 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('user_preferences')
    .select('preferences, updated_at')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = row not found, which is fine for new users
    console.error('[preferences/GET]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    preferences: data?.preferences ?? null,
    updatedAt: data?.updated_at ?? null,
  });
}

/* ------------------------------------------------------------------ */
/*  POST /api/user/preferences                                          */
/*  Body: { userId: string, preferences: UserPreferences }              */
/*  Upserts the preferences row for the given user.                     */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 503 }
    );
  }

  let body: { userId?: string; preferences?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch (_) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { userId, preferences } = body;
  if (!userId || !preferences) {
    return NextResponse.json(
      { error: 'Missing userId or preferences' },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin.from('user_preferences').upsert(
    {
      user_id: userId,
      preferences,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    console.error('[preferences/POST]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
