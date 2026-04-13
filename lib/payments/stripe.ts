/**
 * Stripe payment helpers — manual-capture "hold" flow.
 *
 * Legal model:
 *   We NEVER take custody of funds. We create a PaymentIntent with
 *   `capture_method: 'manual'` which authorizes the user's card but
 *   does not charge it. Funds stay on the cardholder's account, reserved
 *   for up to 7 days (or up to 30 days with extended authorization on
 *   eligible cards).
 *
 *   When the AI agent finds a flight at price P (<= budget), we capture
 *   only the actual amount P. The remaining (budget - P) is released
 *   back to the card automatically by Stripe. No money transmitter
 *   license required.
 *
 * Environment:
 *   STRIPE_SECRET_KEY        — live (sk_live_...) or test (sk_test_...)
 *   STRIPE_WEBHOOK_SECRET    — webhook signing secret (whsec_...)
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — public (pk_live_... / pk_test_...)
 *
 * All three are pay-per-transaction on Stripe. Zero subscription fees.
 */

import type Stripe from 'stripe';

// Lazy singleton so we don't crash at module-eval time if the SDK
// hasn't been installed yet.
let stripeClient: Stripe | null = null;

async function getStripe(): Promise<Stripe> {
  if (stripeClient) return stripeClient;
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error('STRIPE_SECRET_KEY is not configured');
  // Dynamic import lets the module load even when the SDK isn't installed
  // yet — an explicit error is thrown only when a caller actually tries
  // to use Stripe.
  const { default: StripeCtor } = await import('stripe');
  stripeClient = new StripeCtor(secret, {
    apiVersion: '2024-12-18.acacia' as any,
    typescript: true,
    appInfo: { name: 'Flyeas', version: '1.0.0' },
  });
  return stripeClient;
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function isLiveMode(): boolean {
  return process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ?? false;
}

/**
 * Create an authorization hold for a mission budget.
 *
 * Stripe will authorize the full budget but not charge it. The hold
 * expires in 7 days (or 30 on eligible extended-auth cards).
 *
 * Returns the client secret the frontend needs to confirm the payment
 * with Stripe Elements (collecting the card).
 */
export async function createMissionHold(params: {
  amountUsd: number;
  missionId: string;
  userEmail?: string;
  description: string;
}): Promise<{
  paymentIntentId: string;
  clientSecret: string;
  amountCents: number;
  expiresAt: string;
}> {
  const stripe = await getStripe();
  const amountCents = Math.round(params.amountUsd * 100);

  const pi = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    capture_method: 'manual',       // authorize but don't capture yet
    payment_method_types: ['card'],
    description: params.description,
    receipt_email: params.userEmail,
    metadata: {
      missionId: params.missionId,
      flyeas_rail: 'stripe',
    },
  });

  if (!pi.client_secret) {
    throw new Error('Stripe did not return a client_secret');
  }

  return {
    paymentIntentId: pi.id,
    clientSecret: pi.client_secret,
    amountCents,
    // Authorization lifetime: 7 days for standard cards. Extended auth
    // (up to 30 days) is available on eligible cards but must be
    // requested explicitly — we stick to the 7-day baseline.
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Capture a portion of the authorized hold and release the rest.
 *
 * Call this the moment the AI agent commits to a specific offer. Stripe
 * captures `amountUsd` and releases the remaining authorization back to
 * the card in the same operation.
 */
export async function captureMissionHold(params: {
  paymentIntentId: string;
  amountUsd: number;
  offerReference: string;
}): Promise<{
  status: string;
  capturedAmountCents: number;
  chargeId?: string;
}> {
  const stripe = await getStripe();
  const amountCents = Math.round(params.amountUsd * 100);

  const pi = await stripe.paymentIntents.capture(params.paymentIntentId, {
    amount_to_capture: amountCents,
    metadata_final: {
      offerReference: params.offerReference,
    } as any,
  } as any);

  const chargeId =
    typeof pi.latest_charge === 'string'
      ? pi.latest_charge
      : (pi.latest_charge as any)?.id;

  return {
    status: pi.status,
    capturedAmountCents: pi.amount_received,
    chargeId,
  };
}

/**
 * Cancel the authorization entirely and release all funds back to the
 * user. Use when the mission is cancelled, expires without finding an
 * offer, or the user opts out.
 */
export async function cancelMissionHold(params: {
  paymentIntentId: string;
  reason?: 'requested_by_customer' | 'abandoned' | 'duplicate';
}): Promise<{ status: string }> {
  const stripe = await getStripe();
  const pi = await stripe.paymentIntents.cancel(params.paymentIntentId, {
    cancellation_reason: params.reason || 'requested_by_customer',
  });
  return { status: pi.status };
}

/**
 * Retrieve a PaymentIntent — used by webhooks and status checks.
 */
export async function getHold(paymentIntentId: string) {
  const stripe = await getStripe();
  return stripe.paymentIntents.retrieve(paymentIntentId);
}

/**
 * Refund a captured payment (post-capture refund — only used if a
 * booking fails AFTER we've already captured).
 */
export async function refundCapture(params: {
  chargeId?: string;
  paymentIntentId?: string;
  amountUsd?: number;
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
}): Promise<{ refundId: string; status: string }> {
  const stripe = await getStripe();
  const refund = await stripe.refunds.create({
    charge: params.chargeId,
    payment_intent: params.paymentIntentId,
    amount: params.amountUsd ? Math.round(params.amountUsd * 100) : undefined,
    reason: params.reason || 'requested_by_customer',
  });
  return { refundId: refund.id, status: refund.status || 'pending' };
}

/**
 * Verify a webhook signature. Stripe signs every event with the
 * STRIPE_WEBHOOK_SECRET. We MUST verify the signature before trusting
 * any webhook payload.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string
): Promise<Stripe.Event> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  const stripe = await getStripe();
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
