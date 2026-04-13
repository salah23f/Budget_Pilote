import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/setup/stripe-webhook
 *
 * One-time setup endpoint that registers the Stripe webhook
 * automatically using the STRIPE_SECRET_KEY from the environment.
 * After running once, this endpoint can be deleted.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ error: 'STRIPE_SECRET_KEY not configured' }, { status: 503 });
  }

  // Auth gate — only allow with the cron secret
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://faregenie.vercel.app';
  const webhookUrl = `${baseUrl}/api/webhooks/stripe`;

  try {
    // Check if webhook already exists
    const listRes = await fetch('https://api.stripe.com/v1/webhook_endpoints?limit=100', {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const listData = await listRes.json();

    const existing = listData.data?.find((w: any) =>
      w.url === webhookUrl && w.status === 'enabled'
    );

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Webhook already exists',
        webhookId: existing.id,
        signingSecret: '(already configured — check Stripe dashboard)',
      });
    }

    // Create the webhook
    const body = new URLSearchParams();
    body.append('url', webhookUrl);
    body.append('enabled_events[]', 'payment_intent.amount_capturable_updated');
    body.append('enabled_events[]', 'payment_intent.succeeded');
    body.append('enabled_events[]', 'payment_intent.canceled');
    body.append('enabled_events[]', 'payment_intent.payment_failed');
    body.append('description', 'Flyeas mission payment lifecycle');

    const createRes = await fetch('https://api.stripe.com/v1/webhook_endpoints', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const webhook = await createRes.json();

    if (webhook.error) {
      return NextResponse.json({
        success: false,
        error: webhook.error.message,
      }, { status: 400 });
    }

    console.log('[setup] Stripe webhook created', {
      id: webhook.id,
      url: webhook.url,
    });

    return NextResponse.json({
      success: true,
      webhookId: webhook.id,
      url: webhook.url,
      signingSecret: webhook.secret,
      message: 'Webhook created! Add the signing secret to Vercel as STRIPE_WEBHOOK_SECRET',
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err?.message || 'Failed to create webhook',
    }, { status: 500 });
  }
}
