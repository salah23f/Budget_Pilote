import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/payments/stripe';
import { getMission, updateMission } from '@/lib/store/missions-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST /api/webhooks/stripe
 *
 * Stripe webhook. We verify the signature against STRIPE_WEBHOOK_SECRET
 * and react to the PaymentIntent lifecycle events that drive the
 * mission state machine:
 *
 *   - payment_intent.amount_capturable_updated: the user confirmed the
 *     hold via Stripe Elements — the authorization is now locked in.
 *     Mission transitions: awaiting_payment → monitoring.
 *
 *   - payment_intent.succeeded: the agent captured the hold (full or
 *     partial). Mission transitions: * → booked.
 *
 *   - payment_intent.canceled: either the user cancelled the mission
 *     OR the 7-day hold expired. Mission transitions: * → cancelled
 *     / expired.
 *
 *   - payment_intent.payment_failed: the card was declined. We flip
 *     the mission to 'awaiting_payment' so the user can retry.
 *
 * IMPORTANT: Next.js App Router buffers the body for us. We read it
 * as raw text (req.text()) to feed Stripe's signature verifier
 * unchanged — any JSON re-serialization would break the signature.
 */
export async function POST(req: NextRequest) {
  const started = Date.now();
  const logCtx: Record<string, any> = {};

  // Read the raw body as a string — Stripe signatures are computed
  // over the exact bytes that were sent.
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (err: any) {
    console.error('[stripe/webhook] failed to read body', err?.message);
    return NextResponse.json(
      { received: false, error: 'body read failed' },
      { status: 400 }
    );
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json(
      { received: false, error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event;
  try {
    event = await verifyWebhookSignature(rawBody, signature);
  } catch (err: any) {
    console.error('[stripe/webhook] signature verification failed', {
      error: err?.message,
    });
    return NextResponse.json(
      { received: false, error: 'Invalid signature' },
      { status: 400 }
    );
  }

  logCtx.type = event.type;
  logCtx.eventId = event.id;

  const pi: any = (event.data?.object as any) || {};
  const missionId: string | undefined = pi.metadata?.missionId;
  if (!missionId) {
    // Not one of our events — ack and drop
    console.log('[stripe/webhook] no missionId', logCtx);
    return NextResponse.json({ received: true, ignored: true });
  }
  logCtx.missionId = missionId;

  const mission = await getMission(missionId);
  if (!mission) {
    console.warn('[stripe/webhook] mission missing for PI', logCtx);
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    switch (event.type) {
      case 'payment_intent.amount_capturable_updated': {
        // The hold is confirmed — move mission to monitoring
        if (mission.status === 'awaiting_payment') {
          await updateMission(missionId, {
            status: 'monitoring',
            paymentStatus: 'authorized',
            stripeAuthorizedAmount: pi.amount_capturable || pi.amount,
          });
          console.log('[stripe/webhook] hold authorized', logCtx);
        }
        break;
      }

      case 'payment_intent.succeeded': {
        // Capture completed (either full or partial)
        await updateMission(missionId, {
          status: 'booked',
          paymentStatus: 'captured',
          stripeCapturedAmount: pi.amount_received,
          budgetDepositedUsd: (pi.amount_received || 0) / 100,
        });
        console.log('[stripe/webhook] captured', {
          ...logCtx,
          amount: pi.amount_received,
        });
        break;
      }

      case 'payment_intent.canceled': {
        const reason = pi.cancellation_reason || 'unknown';
        await updateMission(missionId, {
          status:
            reason === 'automatic' || reason === 'abandoned'
              ? 'expired'
              : 'cancelled',
          paymentStatus: 'cancelled',
        });
        console.log('[stripe/webhook] canceled', { ...logCtx, reason });
        break;
      }

      case 'payment_intent.payment_failed': {
        console.warn('[stripe/webhook] payment failed', {
          ...logCtx,
          lastPaymentError: pi.last_payment_error?.message,
        });
        await updateMission(missionId, {
          paymentStatus: 'none',
          status: 'awaiting_payment',
        });
        break;
      }

      default:
        // Ignore other events for now
        break;
    }

    console.log('[stripe/webhook] handled', {
      ...logCtx,
      ms: Date.now() - started,
    });
    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('[stripe/webhook] handler error', {
      ...logCtx,
      error: err?.message,
      stack: err?.stack?.split('\n').slice(0, 4).join('\n'),
    });
    return NextResponse.json(
      { received: false, error: err?.message || 'handler failed' },
      { status: 500 }
    );
  }
}
