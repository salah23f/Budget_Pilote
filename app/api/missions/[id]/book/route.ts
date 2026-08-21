import { NextRequest, NextResponse } from 'next/server';
import { requireMissionOwner } from '@/lib/auth/guard';
import { getProposal } from '@/lib/store/missions-db';
import { createBookingPayment, isStripeConfigured } from '@/lib/payments/stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST /api/missions/[id]/book
 *
 * Opens payment for one specific proposal, at the moment the traveller
 * decides to take it.
 *
 * This exists because a mission no longer costs anything to start. There
 * is no authorised budget sitting on the card waiting to be captured —
 * the traveller sees a real fare first, then pays exactly that fare.
 *
 * Returns a client secret the cockpit mounts inline, so booking never
 * leaves the screen where the offer is shown.
 *
 * Auto-buy missions do not come through here: they already authorised
 * the budget up front, and /confirm captures that hold instead.
 */
export async function POST(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const missionId = context.params.id;

  const owned = await requireMissionOwner(missionId);
  if (!owned.ok) return owned.response;
  const { mission } = owned;

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Payments are not configured on this server.' },
      { status: 503 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch (_) {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const proposalId = String(body?.proposalId || '');
  if (!proposalId) {
    return NextResponse.json(
      { success: false, error: 'proposalId is required' },
      { status: 400 }
    );
  }

  const proposal = await getProposal(proposalId);
  // Same 404 whether it is missing or belongs to another mission — never
  // confirm that someone else's proposal exists.
  if (!proposal || proposal.missionId !== missionId) {
    return NextResponse.json(
      { success: false, error: 'Proposal not found' },
      { status: 404 }
    );
  }

  if (proposal.status !== 'pending') {
    return NextResponse.json(
      { success: false, error: `This offer is ${proposal.status}.` },
      { status: 409 }
    );
  }

  if (proposal.expiresAt && new Date(proposal.expiresAt).getTime() < Date.now()) {
    return NextResponse.json(
      { success: false, error: 'This offer has expired.' },
      { status: 410 }
    );
  }

  // Charge the fare on the offer, never a figure supplied by the caller.
  const amountUsd = proposal.offerSnapshot?.priceUsd;
  if (!Number.isFinite(amountUsd) || (amountUsd as number) <= 0) {
    return NextResponse.json(
      { success: false, error: 'This offer has no usable price.' },
      { status: 422 }
    );
  }

  // The budget is the ceiling the traveller set; an offer above it should
  // never have been proposed, so refuse rather than quietly overcharge.
  if ((amountUsd as number) > mission.maxBudgetUsd) {
    return NextResponse.json(
      { success: false, error: 'This offer is above your budget.' },
      { status: 409 }
    );
  }

  try {
    const payment = await createBookingPayment({
      amountUsd: amountUsd as number,
      missionId,
      proposalId,
      userEmail: owned.user.email ?? undefined,
      description: `Flyeas booking ${mission.origin} → ${mission.destination} on ${mission.departDate}`,
    });

    return NextResponse.json({
      success: true,
      clientSecret: payment.clientSecret,
      paymentIntentId: payment.paymentIntentId,
      amountUsd,
    });
  } catch (err: any) {
    console.error('[missions/book] payment intent failed', {
      missionId,
      proposalId,
      error: err?.message,
    });
    return NextResponse.json(
      { success: false, error: `Could not open payment: ${err?.message || 'unknown error'}` },
      { status: 502 }
    );
  }
}
