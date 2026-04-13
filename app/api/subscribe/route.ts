import { NextResponse } from 'next/server';

/**
 * Newsletter subscription endpoint.
 * Stores email in Supabase and triggers a welcome email via Resend.
 * Falls back gracefully if services are unavailable.
 */
export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    // Normalize
    const normalizedEmail = email.trim().toLowerCase();

    // Store in Supabase if configured
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_KEY
        );

        await supabase
          .from('subscribers')
          .upsert(
            { email: normalizedEmail, subscribed_at: new Date().toISOString(), active: true },
            { onConflict: 'email' }
          );
      } catch (e) {
        console.warn('[subscribe] Supabase storage failed:', e);
      }
    }

    // Send welcome email via Resend if configured
    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);

        await resend.emails.send({
          from: 'Flyeas <noreply@faregenie.vercel.app>',
          to: normalizedEmail,
          subject: 'Welcome to Flyeas — Your Travel Intelligence Starts Now ✈️',
          html: `
            <div style="font-family: Inter, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0C0A09; color: white; border-radius: 16px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; padding: 8px 16px; background: linear-gradient(135deg, #F59E0B, #F97316, #EF4444); border-radius: 12px; font-size: 24px; font-weight: 800; color: white; letter-spacing: -0.02em;">
                  ✈️ Flyeas
                </div>
              </div>
              <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 12px; color: white;">Welcome aboard!</h1>
              <p style="color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
                You are now subscribed to Flyeas Travel Intelligence. Every week, you will receive:
              </p>
              <ul style="color: rgba(255,255,255,0.5); font-size: 14px; line-height: 1.8; padding-left: 20px;">
                <li>🔥 Error fares and flash deals</li>
                <li>📊 Data-driven booking tips</li>
                <li>🗺️ Destination guides</li>
                <li>💰 Money-saving travel hacks</li>
              </ul>
              <div style="margin-top: 24px; text-align: center;">
                <a href="https://faregenie.vercel.app/flights" style="display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #F59E0B, #F97316); color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 14px;">
                  Search Flights Now
                </a>
              </div>
              <p style="color: rgba(255,255,255,0.25); font-size: 11px; text-align: center; margin-top: 32px;">
                Flyeas — AI Travel Agent · faregenie.vercel.app
              </p>
            </div>
          `,
        });
      } catch (e) {
        console.warn('[subscribe] Resend email failed:', e);
      }
    }

    return NextResponse.json({ success: true, message: 'Subscribed successfully' });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Subscription failed' },
      { status: 500 }
    );
  }
}
