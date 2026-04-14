import { NextRequest, NextResponse } from 'next/server';
import { missionCreatedEmail } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/missions/[id]/notify
 *
 * Sends the mission-created confirmation email to the user.
 * Body: { email, userName, mission }
 */
export async function POST(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const { email, userName, mission } = await req.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Valid email required' },
        { status: 400 }
      );
    }

    if (!mission) {
      return NextResponse.json(
        { success: false, error: 'Mission data required' },
        { status: 400 }
      );
    }

    const missionId = context.params.id;

    const { subject, html } = missionCreatedEmail({
      userName: userName || email.split('@')[0],
      origin: mission.origin,
      destination: mission.destination,
      departDate: mission.departDate,
      returnDate: mission.returnDate,
      maxBudget: mission.maxBudgetUsd ?? mission.maxBudget ?? 0,
      cabinClass: mission.cabinClass || 'Economy',
      missionId,
    });

    if (!process.env.RESEND_API_KEY) {
      console.warn('[missions/notify] RESEND_API_KEY not configured');
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'Email service not configured',
      });
    }

    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: 'Flyeas <onboarding@resend.dev>',
      to: email.trim().toLowerCase(),
      subject,
      html,
    });

    console.log('[missions/notify] mission-created email sent', {
      missionId,
      to: email,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[missions/notify] failed', { error: err?.message });
    return NextResponse.json(
      { success: false, error: err?.message || 'Notify failed' },
      { status: 500 }
    );
  }
}
