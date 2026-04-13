import { NextRequest, NextResponse } from 'next/server';
import {
  getMission,
  updateMission,
  getProposal,
  updateProposal,
} from '@/lib/store/missions-db';
import { captureMissionHold } from '@/lib/payments/stripe';
import {
  isEscrowConfigured,
  buildUserReleaseCallData,
} from '@/lib/payments/escrow';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST /api/missions/[id]/confirm
 *
 * User confirms a pending proposal. The handler captures the payment
 * (or for the wallet rail, returns the calldata the user needs to
 * sign from their wallet), updates the mission + proposal state, and
 * returns the booking deep-link.
 *
 * Body: { proposalId: string, txHash?: string }
 *   - txHash is only provided by the wallet rail AFTER the user has
 *     signed the release transaction in their wallet. The frontend
 *     reports it back so the backend can mark the release as executed.
 */
export async function POST(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const started = Date.now();
  const missionId = context.params.id;
  const logCtx: Record<string, any> = { missionId };

  try {
    const body = (await req.json().catch(() => ({}))) as {
      proposalId?: string;
      txHash?: string;
    };

    const proposalId = body?.proposalId;
    if (!proposalId) {
      return NextResponse.json(
        { success: false, error: 'proposalId is required' },
        { status: 400 }
      );
    }
    logCtx.proposalId = proposalId;

    const mission = await getMission(missionId);
    if (!mission) {
      return NextResponse.json(
        { success: false, error: 'Mission not found' },
        { status: 404 }
      );
    }
    logCtx.rail = mission.paymentRail;

    const proposal = await getProposal(proposalId);
    if (!proposal || proposal.missionId !== missionId) {
      return NextResponse.json(
        { success: false, error: 'Proposal not found for this mission' },
        { status: 404 }
      );
    }
    if (proposal.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Proposal is ${proposal.status}` },
        { status: 409 }
      );
    }
    if (new Date(proposal.expiresAt) < new Date()) {
      await updateProposal(proposalId, { status: 'expired' });
      return NextResponse.json(
        { success: false, error: 'Proposal has expired' },
        { status: 410 }
      );
    }

    // ----------------------------------------------------------------
    // Rail-specific confirmation
    // ----------------------------------------------------------------
    if (mission.paymentRail === 'stripe') {
      if (!mission.stripePaymentIntentId) {
        return NextResponse.json(
          { success: false, error: 'Mission has no Stripe hold to capture' },
          { status: 400 }
        );
      }
      try {
        const res = await captureMissionHold({
          paymentIntentId: mission.stripePaymentIntentId,
          amountUsd: proposal.offerSnapshot.priceUsd,
          offerReference: proposal.offerId,
        });
        logCtx.stripeCaptured = res.capturedAmountCents;
        await updateMission(missionId, {
          status: 'booked',
          paymentStatus: 'captured',
          stripeCapturedAmount: res.capturedAmountCents,
          budgetDepositedUsd: proposal.offerSnapshot.priceUsd,
        });
        const confirmed = await updateProposal(proposalId, {
          status: 'confirmed',
          confirmedAt: new Date().toISOString(),
          captureAmountCents: res.capturedAmountCents,
          bookingDeepLink: proposal.offerSnapshot.deepLink,
        });
        console.log('[missions/confirm] captured', {
          ...logCtx,
          ms: Date.now() - started,
        });
        return NextResponse.json({
          success: true,
          proposal: confirmed,
          bookingUrl: proposal.offerSnapshot.deepLink,
          capturedAmountCents: res.capturedAmountCents,
          refundedCents:
            (mission.stripeAuthorizedAmount || 0) - res.capturedAmountCents,
        });
      } catch (err: any) {
        console.error('[missions/confirm] stripe capture failed', {
          ...logCtx,
          error: err?.message,
        });
        return NextResponse.json(
          { success: false, error: `Capture failed: ${err.message}` },
          { status: 502 }
        );
      }
    }

    if (mission.paymentRail === 'wallet') {
      if (!isEscrowConfigured()) {
        return NextResponse.json(
          { success: false, error: 'Wallet escrow not configured' },
          { status: 503 }
        );
      }

      // Two-phase: first call returns the calldata the user must sign
      // in their wallet. Second call (with txHash) marks the proposal
      // as confirmed once the tx is mined.
      if (!body.txHash) {
        const call = buildUserReleaseCallData({
          missionId,
          amountUsd: proposal.offerSnapshot.priceUsd,
          offerId: proposal.offerId,
        });
        if (!call) {
          return NextResponse.json(
            { success: false, error: 'Unable to build release calldata' },
            { status: 500 }
          );
        }
        return NextResponse.json({
          success: true,
          requiresWalletSignature: true,
          userReleaseCall: {
            address: call.address,
            functionName: call.functionName,
            args: [
              call.args[0],
              call.args[1],
              call.args[2].toString(),
              call.args[3],
            ],
          },
        });
      }

      // Second phase — frontend has signed + broadcast the tx
      logCtx.releaseTx = body.txHash;
      await updateMission(missionId, {
        status: 'booked',
        paymentStatus: 'captured',
        walletReleaseTxHash: body.txHash,
        budgetDepositedUsd: proposal.offerSnapshot.priceUsd,
      });
      const confirmed = await updateProposal(proposalId, {
        status: 'confirmed',
        confirmedAt: new Date().toISOString(),
        captureTxHash: body.txHash,
        bookingDeepLink: proposal.offerSnapshot.deepLink,
      });
      console.log('[missions/confirm] wallet release', {
        ...logCtx,
        ms: Date.now() - started,
      });
      return NextResponse.json({
        success: true,
        proposal: confirmed,
        bookingUrl: proposal.offerSnapshot.deepLink,
        txHash: body.txHash,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Mission has no active payment rail' },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('[missions/confirm] unhandled', {
      ...logCtx,
      ms: Date.now() - started,
      error: err?.message,
    });
    return NextResponse.json(
      { success: false, error: err?.message || 'Confirm failed' },
      { status: 500 }
    );
  }
}
