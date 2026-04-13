import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const SECRET = process.env.OTP_SECRET || process.env.RAPIDAPI_KEY || 'flyeas-dev-secret-change-me';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, code } = body as { token: string; code: string };

    if (!token || !code) {
      return NextResponse.json({ error: 'Missing token or code' }, { status: 400 });
    }

    // Decode token
    let payload: { identifier: string; code: string; expiresAt: number; hmac: string };
    try {
      payload = JSON.parse(Buffer.from(token, 'base64').toString());
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    // Verify HMAC
    const expectedPayload = `${payload.identifier}:${payload.code}:${payload.expiresAt}`;
    const expectedHmac = crypto.createHmac('sha256', SECRET).update(expectedPayload).digest('hex');

    if (payload.hmac !== expectedHmac) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    // Check expiry
    if (Date.now() > payload.expiresAt) {
      return NextResponse.json({ error: 'Code expired. Please request a new one.' }, { status: 400 });
    }

    // Verify code matches
    if (payload.code !== code) {
      return NextResponse.json({ error: 'Invalid code. Please try again.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, verified: true });
  } catch (err) {
    console.error('verify-code error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
