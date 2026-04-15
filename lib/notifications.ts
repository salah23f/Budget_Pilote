import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Server-side helper to create notifications in Supabase.
 * Gracefully no-ops if Supabase is not configured.
 */
export async function createNotification(data: {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  if (!supabaseAdmin) {
    // Supabase not configured — silently skip
    return;
  }

  try {
    await supabaseAdmin.from('notifications').insert({
      user_id: data.userId,
      type: data.type,
      title: data.title,
      body: data.body,
      data: data.data ?? null,
    });
  } catch (_) {
    // Graceful fallback — do not throw if notification insert fails
    console.error('[notifications] Failed to create notification');
  }
}
