import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { amount, currency = 'usd' } = await req.json();

    if (!amount || amount < 1) {
      return NextResponse.json({ error: 'Amount must be at least $1' }, { status: 400 });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json({ error: 'Payment service not configured' }, { status: 503 });
    }

    // Create Stripe Checkout Session via API (no SDK needed)
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'mode': 'payment',
        'payment_method_types[0]': 'card',
        'line_items[0][price_data][currency]': currency,
        'line_items[0][price_data][product_data][name]': 'Flyeas Budget Pool Deposit',
        'line_items[0][price_data][product_data][description]': `Deposit $${amount} into your Flyeas travel budget pool`,
        'line_items[0][price_data][unit_amount]': String(Math.round(amount * 100)),
        'line_items[0][quantity]': '1',
        'success_url': `${req.headers.get('origin') || 'https://faregenie.vercel.app'}/wallet?success=true&amount=${amount}`,
        'cancel_url': `${req.headers.get('origin') || 'https://faregenie.vercel.app'}/wallet?cancelled=true`,
      }).toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Stripe error:', err);
      return NextResponse.json({ error: 'Payment creation failed' }, { status: 500 });
    }

    const session = await res.json();
    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Checkout error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
