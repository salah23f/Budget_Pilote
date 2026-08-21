import { NextRequest, NextResponse } from 'next/server';
import { requireMissionOwner } from '@/lib/auth/guard';
import {
  getMission,
  updateMission,
  getProposal,
  updateProposal,
} from '@/lib/store/missions-db';
import { captureMissionHold, getHold } from '@/lib/payments/stripe';
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
  // Caller must own this mission — 404 (not 403) hides existence.
  const owned = await requireMissionOwner(missionId);
  if (!owned.ok) return owned.response;
  const logCtx: Record<string, any> = { missionId };

  try {
    const body = (await req.json().catch(() => ({}))) as {
      proposalId?: string;
      txHash?: string;
      /** Set when the traveller paid for this offer through /book. */
      paymentIntentId?: string;
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
      // No hold means this is an ordinary mission: nothing was authorised
      // when it started, and the traveller has just paid for this exact
      // fare through /book. Verify that payment instead of capturing.
      if (!mission.stripePaymentIntentId) {
        const paidIntentId = String(body?.paymentIntentId || '');
        if (!paidIntentId) {
          return NextResponse.json(
            { success: false, error: 'Payment is required before confirming this offer.' },
            { status: 402 }
          );
        }

        let pi: Awaited<ReturnType<typeof getHold>>;
        try {
          pi = await getHold(paidIntentId);
        } catch (err: any) {
          return NextResponse.json(
            { success: false, error: `Could not verify payment: ${err?.message || 'unknown error'}` },
            { status: 502 }
          );
        }

        // Every one of these must hold, or a caller could confirm a booking
        // with somebody else's payment, a cheaper one, or one still pending.
        const expectedCents = Math.round(proposal.offerSnapshot.priceUsd * 100);
        const mismatch =
          pi.status !== 'succeeded' ||
          pi.metadata?.missionId !== missionId ||
          pi.metadata?.proposalId !== proposalId ||
          pi.amount_received < expectedCents;

        if (mismatch) {
          console.warn('[missions/confirm] payment verification failed', {
            ...logCtx,
            status: pi.status,
            received: pi.amount_received,
            expected: expectedCents,
          });
          return NextResponse.json(
            { success: false, error: 'This payment does not match the offer.' },
            { status: 402 }
          );
        }

        await updateMission(missionId, {
          status: 'booked',
          paymentStatus: 'captured',
          stripePaymentIntentId: pi.id,
          stripeCapturedAmount: pi.amount_received,
          budgetDepositedUsd: proposal.offerSnapshot.priceUsd,
        });
        const confirmed = await updateProposal(proposalId, {
          status: 'confirmed',
          confirmedAt: new Date().toISOString(),
          captureAmountCents: pi.amount_received,
          bookingDeepLink: proposal.offerSnapshot.deepLink,
        });
        console.log('[missions/confirm] paid at booking', {
          ...logCtx,
          ms: Date.now() - started,
          amountCents: pi.amount_received,
        });
        return NextResponse.json({
          success: true,
          decision: 'BOOKED',
          proposal: confirmed,
          bookingDeepLink: proposal.offerSnapshot.deepLink,
        });
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
