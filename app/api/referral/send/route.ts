import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

/**
 * Referral invitation endpoint.
 * Sends a premium-formatted email via Resend.
 * Non-blocking — falls back silently if email fails so the UI stays snappy.
 */

export const dynamic = 'force-dynamic';

function buildEmail({ code, senderName, link }: { code: string; senderName?: string; link: string }) {
  const from = senderName ? senderName : 'A friend';
  return `<!doctype html>
<html lang="en" style="margin:0;padding:0;">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${from} invited you to Flyeas</title>
</head>
<body style="margin:0;padding:0;background:#09090B;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#fafaf9;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#09090B;padding:40px 20px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#111113;border:1px solid rgba(255,255,255,0.06);border-radius:20px;overflow:hidden;">
      <tr><td style="padding:32px 32px 0 32px;">
        <div style="display:inline-flex;align-items:center;gap:10px;">
          <div style="width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,#E8A317,#F97316);display:inline-block;vertical-align:middle;"></div>
          <span style="font-size:18px;font-weight:700;letter-spacing:-0.3px;color:#fafaf9;vertical-align:middle;margin-left:6px;">Flyeas</span>
        </div>
      </td></tr>
      <tr><td style="padding:24px 32px 8px 32px;">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#E8A317;font-weight:600;margin:0 0 16px 0;">Exclusive invite</p>
        <h1 style="font-size:28px;font-weight:700;line-height:1.2;margin:0;color:#fafaf9;">
          ${from} invited you to Flyeas
        </h1>
        <p style="font-size:15px;line-height:1.6;color:rgba(250,250,249,0.65);margin:16px 0 0 0;">
          Flyeas watches flight & hotel prices 24/7 and books the moment they drop.
          Use this code to get <strong style="color:#E8A317;">$10 in travel credit</strong> when you sign up — and they get $10 too.
        </p>
      </td></tr>
      <tr><td style="padding:24px 32px;">
        <div style="background:linear-gradient(135deg,rgba(232,163,23,0.12),rgba(249,115,22,0.06));border:1px dashed rgba(232,163,23,0.4);border-radius:16px;padding:24px;text-align:center;">
          <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:rgba(255,255,255,0.4);margin:0 0 8px 0;">Your code</p>
          <p style="font-size:32px;font-weight:700;letter-spacing:0.1em;font-family:ui-monospace,'SF Mono',Menlo,monospace;color:#fafaf9;margin:0;">${code}</p>
        </div>
      </td></tr>
      <tr><td align="center" style="padding:8px 32px 32px 32px;">
        <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#E8A317,#F97316);color:white;text-decoration:none;font-weight:600;padding:14px 32px;border-radius:12px;font-size:15px;">Claim your $10 credit</a>
      </td></tr>
      <tr><td style="padding:0 32px 32px 32px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding:16px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;">
              <p style="font-size:12px;color:rgba(255,255,255,0.45);margin:0;line-height:1.5;">
                <strong style="color:rgba(255,255,255,0.7);">Why Flyeas?</strong><br/>
                • Live prices from 400+ airlines & hotels worldwide<br/>
                • AI missions that monitor and auto-buy at your target price<br/>
                • Zero hidden fees, transparent deal quality scores
              </p>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:16px 32px;background:rgba(255,255,255,0.02);border-top:1px solid rgba(255,255,255,0.05);">
        <p style="font-size:11px;color:rgba(255,255,255,0.35);margin:0;text-align:center;">
          If you'd rather not receive invites, you can safely ignore this email.<br/>
          © ${new Date().getFullYear()} Flyeas
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  let body: { email?: string; code?: string; senderName?: string };
  try {
    body = await req.json();
  } catch (_) {
    return NextResponse.json({ ok: false, error: 'invalid-json' }, { status: 400 });
  }

  const { email, code, senderName } = body;
  if (!email || !email.includes('@') || !code) {
    return NextResponse.json({ ok: false, error: 'missing-fields' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Graceful fallback — the UI should still feel snappy even without email
    return NextResponse.json({ ok: true, warning: 'email-service-not-configured' });
  }

  try {
    const resend = new Resend(apiKey);
    const link = `${req.nextUrl.origin}/?ref=${encodeURIComponent(code)}`;
    await resend.emails.send({
      from: process.env.RESEND_FROM || 'Flyeas <hello@flyeas.app>',
      to: email,
      subject: `${senderName || 'A friend'} invited you to Flyeas — $10 travel credit inside`,
      html: buildEmail({ code, senderName, link }),
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'send-failed' },
      { status: 500 }
    );
  }
}
