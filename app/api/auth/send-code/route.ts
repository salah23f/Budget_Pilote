import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const SECRET = process.env.OTP_SECRET || process.env.RAPIDAPI_KEY || 'flyeas-dev-secret-change-me';

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function signToken(identifier: string, code: string, expiresAt: number): string {
  const payload = `${identifier}:${code}:${expiresAt}`;
  const hmac = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(JSON.stringify({ identifier, code, expiresAt, hmac })).toString('base64');
}

async function sendEmailViaResend(to: string, code: string, attempt = 1): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: 'Email service not configured. Please contact support.' };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Flyeas <onboarding@resend.dev>',
        to: [to],
        subject: `Your Flyeas verification code: ${code}`,
        html: `
          <div style="font-family:-apple-system,sans-serif;max-width:420px;margin:0 auto;padding:40px 32px;background:#0C0A09;color:white;border-radius:20px;">
            <div style="text-align:center;margin-bottom:32px;">
              <h1 style="margin:0;font-size:28px;color:#F59E0B;">Flyeas</h1>
              <p style="color:#888;font-size:13px;margin:8px 0 0;">Your AI Travel Agent</p>
            </div>
            <p style="color:#ccc;font-size:15px;margin:0 0 24px;text-align:center;">Your verification code:</p>
            <div style="background:#1C1917;border:1px solid #2a2520;border-radius:16px;padding:24px;text-align:center;margin-bottom:28px;">
              <span style="font-size:40px;font-weight:800;letter-spacing:10px;color:#F59E0B;">${code}</span>
            </div>
            <p style="color:#666;font-size:12px;margin:0;text-align:center;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      // Retry once on failure
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 1000));
        return sendEmailViaResend(to, code, attempt + 1);
      }
      return { ok: false, error: `Email delivery failed (${res.status}). Please try again.` };
    }

    return { ok: true };
  } catch (err) {
    // Retry once on network error
    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 1000));
      return sendEmailViaResend(to, code, attempt + 1);
    }
    return { ok: false, error: 'Email service temporarily unavailable. Please try again.' };
  }
}

export async function POST(req: NextRequest) {
  // Rate limiting: max 5 emails per minute per IP
  const { rateLimit } = await import('@/lib/rate-limit');
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { allowed } = rateLimit(`send-code:${ip}`, 5, 60000);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { email, phone, method } = body as {
      email?: string;
      phone?: string;
      method: 'email' | 'phone';
    };

    const identifier = method === 'email' ? email?.toLowerCase()?.trim() : phone?.replace(/\s/g, '');

    if (!identifier || (method === 'email' && !identifier.includes('@')) || (method === 'phone' && identifier.length < 6)) {
      return NextResponse.json({ error: `Invalid ${method}` }, { status: 400 });
    }

    const code = generateCode();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    const token = signToken(identifier, code, expiresAt);

    // Send email via Resend
    const result = await sendEmailViaResend(identifier, code);

    if (!result.ok) {
      console.error('Email send failed:', result.error);
      return NextResponse.json(
        { error: `Email failed: ${result.error}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, token });
  } catch (err) {
    console.error('send-code error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
