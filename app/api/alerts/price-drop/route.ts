import { NextRequest, NextResponse } from 'next/server';
import { priceDropAlertEmail } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/alerts/price-drop
 *
 * Sends a price drop alert email.
 * Body: { email, userName, origin, destination, airline, oldPrice, newPrice, percentDrop, deepLink }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      email,
      userName,
      origin,
      destination,
      airline,
      oldPrice,
      newPrice,
      percentDrop,
      deepLink,
    } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Valid email required' },
        { status: 400 }
      );
    }

    if (!origin || !destination || !airline || oldPrice == null || newPrice == null) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: origin, destination, airline, oldPrice, newPrice' },
        { status: 400 }
      );
    }

    const drop = percentDrop ?? Math.round((1 - newPrice / oldPrice) * 100);

    const { subject, html } = priceDropAlertEmail({
      userName: userName || email.split('@')[0],
      origin,
      destination,
      airline,
      oldPrice,
      newPrice,
      percentDrop: drop,
      deepLink: deepLink || `https://faregenie.vercel.app/flights`,
    });

    if (!process.env.RESEND_API_KEY) {
      console.warn('[alerts/price-drop] RESEND_API_KEY not configured');
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

    console.log('[alerts/price-drop] email sent', {
      to: email,
      route: `${origin}-${destination}`,
      drop: `${drop}%`,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[alerts/price-drop] failed', { error: err?.message });
    return NextResponse.json(
      { success: false, error: err?.message || 'Price drop alert failed' },
      { status: 500 }
    );
  }
}
