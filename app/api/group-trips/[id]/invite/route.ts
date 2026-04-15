import { NextRequest, NextResponse } from 'next/server';

async function getSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * POST /api/group-trips/[id]/invite — Send email invitation
 */
export async function POST(req: NextRequest, context: { params: { id: string } }) {
  const db = await getSupabase();
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  try {
    const { email, inviterName } = await req.json();
    const tripId = context.params.id;

    if (!email?.includes('@')) return NextResponse.json({ error: 'Valid email required' }, { status: 400 });

    // Get trip details
    const { data: trip } = await db
      .from('group_trips')
      .select('id, name, destination, invite_code')
      .eq('id', tripId)
      .single();

    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

    // Add as pending member
    await db.from('group_members').upsert({
      group_id: tripId,
      user_name: email.split('@')[0],
      user_email: email.toLowerCase(),
      role: 'member',
      status: 'pending',
    }, { onConflict: 'group_id,user_email' }).select();

    // Send invitation email via Resend
    if (process.env.RESEND_API_KEY) {
      try {
        const inviteUrl = `https://faregenie.vercel.app/group-trip/${tripId}?code=${trip.invite_code}`;
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);

        await resend.emails.send({
          from: 'Flyeas <onboarding@resend.dev>',
          to: email.toLowerCase(),
          subject: `${inviterName || 'Someone'} invited you to a trip — ${trip.name}`,
          html: `
            <div style="font-family:Inter,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0C0A09;color:white;border-radius:16px;">
              <div style="text-align:center;margin-bottom:24px;">
                <div style="display:inline-block;padding:8px 16px;background:linear-gradient(135deg,#E8A317,#F97316,#EF4444);border-radius:12px;font-size:20px;font-weight:800;color:white;">
                  Flyeas
                </div>
              </div>
              <h1 style="font-size:20px;font-weight:700;margin:0 0 8px;text-align:center;">You're invited!</h1>
              <p style="color:rgba(255,255,255,0.6);font-size:14px;text-align:center;margin:0 0 24px;">
                <strong>${inviterName || 'A friend'}</strong> wants you to join their trip to <strong>${trip.destination || 'an adventure'}</strong>.
              </p>
              <div style="background:#1C1917;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
                <p style="font-size:18px;font-weight:700;color:white;margin:0 0 4px;">${trip.name}</p>
                ${trip.destination ? `<p style="color:rgba(255,255,255,0.4);font-size:13px;margin:0;">${trip.destination}</p>` : ''}
              </div>
              <div style="text-align:center;">
                <a href="${inviteUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#E8A317,#F97316);color:white;text-decoration:none;border-radius:12px;font-weight:600;font-size:14px;">
                  Join This Trip
                </a>
              </div>
              <p style="color:rgba(255,255,255,0.2);font-size:11px;text-align:center;margin-top:24px;">
                Flyeas — AI Travel Agent · faregenie.vercel.app
              </p>
            </div>
          `,
        });

        console.log(`[group-trips] Invite email sent to ${email} for trip "${trip.name}"`);
      } catch (emailErr: any) {
        console.warn('[group-trips] Email send failed:', emailErr.message);
      }
    }

    return NextResponse.json({ success: true, message: `Invitation sent to ${email}` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
