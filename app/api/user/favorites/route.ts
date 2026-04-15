import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/* ------------------------------------------------------------------ */
/*  GET /api/user/favorites?userId=xxx                                  */
/*  Fetches all favorites for the given user from Supabase.             */
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
    .from('user_favorites')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[favorites/GET]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ favorites: data });
}

/* ------------------------------------------------------------------ */
/*  POST /api/user/favorites                                            */
/*  Body: { userId: string, items: FavoriteItem[] }                     */
/*  Upserts all provided favorites into Supabase for the given user.    */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 503 }
    );
  }

  let body: { userId?: string; items?: unknown[] };
  try {
    body = await req.json();
  } catch (_) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { userId, items } = body;
  if (!userId || !Array.isArray(items)) {
    return NextResponse.json(
      { error: 'Missing userId or items array' },
      { status: 400 }
    );
  }

  const rows = items.map((item: Record<string, unknown>) => ({
    id: item.id as string,
    user_id: userId,
    item_type: item.kind as string,
    item_data: item,
    created_at: item.savedAt
      ? new Date(item.savedAt as number).toISOString()
      : new Date().toISOString(),
  }));

  const { error } = await supabaseAdmin
    .from('user_favorites')
    .upsert(rows, { onConflict: 'id,user_id' });

  if (error) {
    console.error('[favorites/POST]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, synced: rows.length });
}

/* ------------------------------------------------------------------ */
/*  DELETE /api/user/favorites                                          */
/*  Body: { userId: string, id: string }                                */
/*  Removes a single favorite by id for the given user.                 */
/* ------------------------------------------------------------------ */

export async function DELETE(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 503 }
    );
  }

  let body: { userId?: string; id?: string };
  try {
    body = await req.json();
  } catch (_) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { userId, id } = body;
  if (!userId || !id) {
    return NextResponse.json(
      { error: 'Missing userId or id' },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from('user_favorites')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('[favorites/DELETE]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
