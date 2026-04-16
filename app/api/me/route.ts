import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/me — return the authenticated user's identity.
 * PATCH /api/me — update identity fields.
 *
 * If Supabase is configured: reads/writes the `users` table.
 * If not: returns 404 (client keeps localStorage as fallback).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  // Try Supabase auth token from cookie / header
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const sb = await getSupabaseClient();
    if (sb) {
      try {
        const { data: { user } } = await sb.auth.getUser(token);
        return user?.id ?? null;
      } catch (_) {}
    }
  }

  // Fallback: cookie-based session
  const cookies = req.cookies;
  const sbAccess = cookies.get('sb-access-token')?.value;
  if (sbAccess) {
    const sb = await getSupabaseClient();
    if (sb) {
      try {
        const { data: { user } } = await sb.auth.getUser(sbAccess);
        return user?.id ?? null;
      } catch (_) {}
    }
  }

  return null;
}

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const sb = await getSupabaseClient();
  if (!sb) {
    return NextResponse.json({ error: 'no_database' }, { status: 404 });
  }

  try {
    const { data, error } = await sb
      .from('users')
      .select('id, first_name, last_name, email, avatar_url, created_at')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    return NextResponse.json({
      userId: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      avatarUrl: data.avatar_url,
      createdAt: data.created_at ? new Date(data.created_at).getTime() : undefined,
    });
  } catch (err) {
    console.warn('[/api/me] GET error:', (err as Error).message);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const sb = await getSupabaseClient();
  if (!sb) {
    return NextResponse.json({ error: 'no_database' }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_) {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Whitelist updateable fields
  const patch: Record<string, unknown> = {};
  if (typeof body.firstName === 'string') patch.first_name = body.firstName.trim().slice(0, 100);
  if (typeof body.lastName === 'string') patch.last_name = body.lastName.trim().slice(0, 100);
  if (typeof body.avatarUrl === 'string') patch.avatar_url = body.avatarUrl.slice(0, 500);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true, message: 'nothing_to_update' });
  }

  try {
    const { error } = await sb
      .from('users')
      .update(patch)
      .eq('id', userId);

    if (error) {
      console.warn('[/api/me] PATCH error:', error.message);
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn('[/api/me] PATCH exception:', (err as Error).message);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
