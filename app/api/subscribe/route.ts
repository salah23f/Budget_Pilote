import { NextResponse } from 'next/server';
import { welcomeEmail } from '@/lib/email-templates';

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

        const userName = normalizedEmail.split('@')[0];
        const welcome = welcomeEmail({ userName });

        await resend.emails.send({
          from: 'Flyeas <onboarding@resend.dev>',
          to: normalizedEmail,
          subject: welcome.subject,
          html: welcome.html,
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
