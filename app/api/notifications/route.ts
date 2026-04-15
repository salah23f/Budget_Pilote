import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export type NotificationType =
  | 'mission_created'
  | 'price_drop'
  | 'proposal'
  | 'booking_confirmed'
  | 'system';

/**
 * GET /api/notifications?userId=xxx&limit=20
 * Fetch notifications for a user, ordered by newest first.
 */
export async function GET(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { success: false, error: 'Supabase not configured' },
      { status: 503 },
    );
  }

  const { searchParams } = request.nextUrl;
  const userId = searchParams.get('userId');
  const limit = Math.min(Number(searchParams.get('limit') || '20'), 100);

  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'userId is required' },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, notifications: data });
}

/**
 * POST /api/notifications
 * Create a new notification.
 * Body: { userId, type, title, body, data? }
 */
export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { success: false, error: 'Supabase not configured' },
      { status: 503 },
    );
  }

  let body: {
    userId?: string;
    type?: NotificationType;
    title?: string;
    body?: string;
    data?: Record<string, unknown>;
  };

  try {
    body = await request.json();
  } catch (_) {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  if (!body.userId || !body.type || !body.title || !body.body) {
    return NextResponse.json(
      { success: false, error: 'userId, type, title, and body are required' },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .insert({
      user_id: body.userId,
      type: body.type,
      title: body.title,
      body: body.body,
      data: body.data ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, notification: data }, { status: 201 });
}

/**
 * PATCH /api/notifications
 * Mark a notification as read.
 * Body: { id, read: true }
 */
export async function PATCH(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { success: false, error: 'Supabase not configured' },
      { status: 503 },
    );
  }

  let body: { id?: string; read?: boolean };

  try {
    body = await request.json();
  } catch (_) {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  if (!body.id || typeof body.read !== 'boolean') {
    return NextResponse.json(
      { success: false, error: 'id and read (boolean) are required' },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .update({ read: body.read })
    .eq('id', body.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, notification: data });
}
