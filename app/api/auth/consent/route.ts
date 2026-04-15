import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, consents, timestamp } = body as {
      email: string;
      consents: string[];
      timestamp: string;
    };

    if (!email || !consents || !timestamp) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // Create immutable hash of consent
    const consentData = JSON.stringify({ email, consents, timestamp });
    const hash = crypto.createHash('sha256').update(consentData).digest('hex');

    const record = {
      email,
      consents,
      timestamp,
      hash,
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown',
    };

    // Store in Supabase if available
    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('consent_logs').insert({
          email: record.email,
          consents: record.consents,
          consent_hash: record.hash,
          ip_address: record.ip,
          user_agent: record.user_agent,
          created_at: record.timestamp,
        });
      } catch (_) {
        // Table may not exist yet - log to console
        console.log('[CONSENT]', JSON.stringify(record));
      }
    } else {
      console.log('[CONSENT]', JSON.stringify(record));
    }

    return NextResponse.json({ success: true, hash });
  } catch (err) {
    console.error('[CONSENT] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
