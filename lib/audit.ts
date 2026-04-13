import { supabaseAdmin } from '@/lib/supabase-admin';

export async function logAudit(
  action: string,
  userId: string | null,
  details: Record<string, any>
): Promise<void> {
  const timestamp = new Date().toISOString();

  if (supabaseAdmin) {
    try {
      await supabaseAdmin.from('audit_logs').insert({
        action,
        user_id: userId,
        details,
        created_at: timestamp,
      });
    } catch (err) {
      console.error('[AUDIT] Failed to write audit log to DB:', err);
      console.log(`[AUDIT] ${timestamp} | action=${action} | user=${userId} | details=${JSON.stringify(details)}`);
    }
  } else {
    console.log(`[AUDIT] ${timestamp} | action=${action} | user=${userId} | details=${JSON.stringify(details)}`);
  }
}
