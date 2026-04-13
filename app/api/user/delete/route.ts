import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({
        success: true,
        message: 'Local data cleared. No server data to delete.',
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

    // Delete user data from 'users' table
    const { error: usersError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);
    if (usersError) {
      console.error('[DELETE] Error deleting from users:', usersError);
    }

    // Delete user missions from 'missions' table
    const { error: missionsError } = await supabaseAdmin
      .from('missions')
      .delete()
      .eq('user_id', userId);
    if (missionsError) {
      console.error('[DELETE] Error deleting from missions:', missionsError);
    }

    // Delete user bookings from 'bookings' table (if exists)
    try {
      const { error: bookingsError } = await supabaseAdmin
        .from('bookings')
        .delete()
        .eq('user_id', userId);
      if (bookingsError) {
        console.error('[DELETE] Error deleting from bookings:', bookingsError);
      }
    } catch {
      // bookings table may not exist — ignore
    }

    // Log the deletion
    await logAudit('account_deleted', userId, {
      email: user.email,
      deleted_at: new Date().toISOString(),
    });

    // Delete the auth user
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      console.error('[DELETE] Error deleting auth user:', deleteAuthError);
      return NextResponse.json(
        { error: 'Failed to delete auth account' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Account and all data deleted',
    });
  } catch (err) {
    console.error('[DELETE] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
