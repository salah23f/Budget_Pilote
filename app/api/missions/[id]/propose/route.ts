import { NextRequest, NextResponse } from 'next/server';
import {
  getMission,
  updateMission,
  createProposal,
  findPendingProposal,
  updateProposal,
} from '@/lib/store/missions-db';
import { captureMissionHold } from '@/lib/payments/stripe';
import {
  agentReleaseOnChain,
  isEscrowConfigured,
} from '@/lib/payments/escrow';
import { buildBookingDeepLink } from '@/lib/payments/booking-link';
import { watchMission } from '@/lib/agent/watcher';
import type { MissionProposal, Offer } from '@/lib/types';
import { dealFoundEmail } from '@/lib/email-templates';

/** Minimum predictor confidence required to auto-buy without asking */
const AUTO_BUY_MIN_CONFIDENCE = 0.6;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/missions/[id]/propose
 *
 * Called by the backend agent loop (cron monitor) when it searches
 * flights for a monitoring mission. The handler decides one of three
 * outcomes:
 *
 *   1. cheapest > budget → nothing to do, keep monitoring
 *   2. cheapest ≤ autoBuyThreshold → AUTO-BUY NOW
 *        - stripe: capture the exact amount on the existing hold
 *        - wallet: call MissionEscrow.agentRelease() on-chain
 *        - create a MissionProposal with status='auto_bought'
 *        - generate the Kiwi deep-link and return it to the user via
 *          the mission detail endpoint (frontend polls)
 *   3. autoBuyThreshold < cheapest ≤ budget → CREATE PENDING PROPOSAL
 *        - don't capture yet
 *        - create a MissionProposal with status='pending' and
 *          expiresAt = now + 6h
 *        - user confirms via /api/missions/[id]/confirm (then we
 *          capture)
 *
 * Idempotency: if there's already a pending proposal for this mission,
 * we only refresh its expiresAt and return it unchanged.
 */
export async function POST(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const started = Date.now();
  const missionId = context.params.id;
  const logCtx: Record<string, any> = { missionId };

  try {
    const mission = await getMission(missionId);
    if (!mission) {
      console.warn('[missions/propose] mission not found', logCtx);
      return NextResponse.json(
        { success: false, error: 'Mission not found' },
        { status: 404 }
      );
    }

    logCtx.rail = mission.paymentRail;
    logCtx.budget = mission.maxBudgetUsd;
    logCtx.autoBuy = mission.autoBuyThresholdUsd;

    if (mission.status !== 'monitoring' && mission.status !== 'proposal_pending') {
      return NextResponse.json({
        success: true,
        reason: `mission is ${mission.status}, not monitoring`,
        skipped: true,
      });
    }

    // Run the watcher — this delegates the actual flight search to
    // lib/agent/watcher.ts which also records the price into our
    // time-series store AND runs the statistical predictor. We get
    // back both the cheapest offer AND a rich prediction object.
    const watch = await watchMission(mission);

    if (watch.error) {
      return NextResponse.json(
        { success: false, error: watch.error },
        { status: 502 }
      );
    }

    if (!watch.cheapest || watch.filteredCount === 0) {
      await updateMission(missionId, { lastCheckedAt: watch.checkedAt });
      return NextResponse.json({
        success: true,
        decision: 'NO_OFFERS',
        checked: watch.offerCount,
      });
    }

    const cheapest = watch.cheapest;
    const prediction = watch.prediction;

    await updateMission(missionId, {
      lastCheckedAt: watch.checkedAt,
      bestSeenPrice:
        mission.bestSeenPrice != null
          ? Math.min(mission.bestSeenPrice, cheapest.priceUsd)
          : cheapest.priceUsd,
    });

    logCtx.cheapest = cheapest.priceUsd;
    logCtx.predictorAction = prediction?.action;
    logCtx.predictorConfidence = prediction?.confidence;
    logCtx.zScore = prediction?.zScore;
    logCtx.sampleCount = prediction?.sampleCount;

    // Above budget — do nothing, but still expose the prediction so
    // the cockpit can show the user "we're watching, here's where the
    // market stands"
    if (cheapest.priceUsd > mission.maxBudgetUsd) {
      console.log('[missions/propose] above budget', {
        ...logCtx,
        ms: Date.now() - started,
      });
      return NextResponse.json({
        success: true,
        decision: 'ABOVE_BUDGET',
        cheapest: cheapest.priceUsd,
        prediction,
      });
    }

    // Check for an existing pending proposal — avoid spam
    const existing = await findPendingProposal(missionId);
    if (existing) {
      console.log('[missions/propose] proposal already pending', {
        ...logCtx,
        proposalId: existing.id,
      });
      return NextResponse.json({
        success: true,
        decision: 'ALREADY_PENDING',
        proposal: existing,
      });
    }

    const threshold =
      mission.autoBuyThresholdUsd != null && mission.autoBuyThresholdUsd > 0
        ? mission.autoBuyThresholdUsd
        : 0;

    const deepLink = buildBookingDeepLink(cheapest, {
      origin: mission.origin,
      destination: mission.destination,
      departDate: mission.departDate,
      returnDate: mission.returnDate,
      adults: mission.passengers,
      cabinClass: mission.cabinClass,
    });

    const snapshot: MissionProposal['offerSnapshot'] = {
      airline: cheapest.airline || 'Unknown',
      airlineCode: cheapest.airlineCode,
      logoUrl: (cheapest.rawData as any)?.logoUrl,
      priceUsd: cheapest.priceUsd,
      originIata: (cheapest.rawData as any)?.originIata,
      destinationIata: (cheapest.rawData as any)?.destinationIata,
      departureTime: cheapest.departureTime,
      arrivalTime: cheapest.arrivalTime,
      durationMinutes: cheapest.durationMinutes || 0,
      stops: cheapest.stops || 0,
      deepLink: deepLink.url,
    };

    // ----------------------------------------------------------------
    // AUTO-BUY PATH
    //
    // Two conditions must BOTH be met for the agent to auto-buy:
    //   1. Price is at or below the user's auto-buy threshold
    //   2. Predictor says BUY_NOW with confidence >= AUTO_BUY_MIN_CONFIDENCE
    //
    // The second gate is what makes Flyeas different from a dumb
    // cron — we only capture when the statistical model believes
    // this is actually a good deal vs the route's historical baseline.
    // On cold start (low sample count) the predictor returns low
    // confidence, so the agent falls through to the proposal path and
    // lets the user confirm manually while we build up data.
    // ----------------------------------------------------------------
    const meetsThresholdGate = threshold > 0 && cheapest.priceUsd <= threshold;
    const meetsPredictorGate =
      !!prediction &&
      prediction.action === 'BUY_NOW' &&
      prediction.confidence >= AUTO_BUY_MIN_CONFIDENCE;

    if (meetsThresholdGate && meetsPredictorGate) {
      const proposal: MissionProposal = {
        id: crypto.randomUUID(),
        missionId,
        offerId: cheapest.id,
        offerSnapshot: snapshot,
        status: 'auto_bought',
        reason: prediction
          ? `Auto-bought. ${prediction.reason}`
          : `Agent auto-bought: $${cheapest.priceUsd} is ≤ your $${threshold} auto-buy limit.`,
        captureAmountCents: Math.round(cheapest.priceUsd * 100),
        bookingDeepLink: deepLink.url,
        createdAt: new Date().toISOString(),
        confirmedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      // Execute the capture / release depending on the rail
      if (mission.paymentRail === 'stripe' && mission.stripePaymentIntentId) {
        try {
          const res = await captureMissionHold({
            paymentIntentId: mission.stripePaymentIntentId,
            amountUsd: cheapest.priceUsd,
            offerReference: cheapest.id,
          });
          logCtx.stripeCaptured = res.capturedAmountCents;
          await updateMission(missionId, {
            status: 'booked',
            paymentStatus: 'captured',
            stripeCapturedAmount: res.capturedAmountCents,
            budgetDepositedUsd: cheapest.priceUsd,
            bestSeenPrice: cheapest.priceUsd,
          });
        } catch (err: any) {
          console.error('[missions/propose] stripe capture failed', {
            ...logCtx,
            error: err?.message,
          });
          return NextResponse.json(
            { success: false, error: `Stripe capture failed: ${err.message}` },
            { status: 502 }
          );
        }
      } else if (mission.paymentRail === 'wallet' && isEscrowConfigured()) {
        try {
          const tx = await agentReleaseOnChain({
            missionId,
            amountUsd: cheapest.priceUsd,
            offerId: cheapest.id,
          });
          proposal.captureTxHash = tx.txHash;
          logCtx.releaseTx = tx.txHash;
          await updateMission(missionId, {
            status: 'booked',
            paymentStatus: 'captured',
            walletReleaseTxHash: tx.txHash,
            budgetDepositedUsd: cheapest.priceUsd,
            bestSeenPrice: cheapest.priceUsd,
          });
        } catch (err: any) {
          console.error('[missions/propose] on-chain release failed', {
            ...logCtx,
            error: err?.message,
          });
          return NextResponse.json(
            {
              success: false,
              error: `On-chain release failed: ${err.message}`,
            },
            { status: 502 }
          );
        }
      } else {
        return NextResponse.json(
          { success: false, error: 'Mission has no active payment rail' },
          { status: 400 }
        );
      }

      await createProposal(proposal);

      // Send deal-found email (non-blocking)
      if ((mission as any).alertEmailEnabled && (mission as any).email && process.env.RESEND_API_KEY) {
        try {
          const { Resend } = await import('resend');
          const resend = new Resend(process.env.RESEND_API_KEY);
          const emailData = dealFoundEmail({
            userName: (mission as any).userName || (mission as any).email.split('@')[0],
            origin: mission.origin,
            destination: mission.destination,
            airline: snapshot.airline,
            price: cheapest.priceUsd,
            oldPrice: mission.bestSeenPrice != null && mission.bestSeenPrice > cheapest.priceUsd
              ? mission.bestSeenPrice : undefined,
            percentOff: mission.bestSeenPrice != null && mission.bestSeenPrice > cheapest.priceUsd
              ? Math.round((1 - cheapest.priceUsd / mission.bestSeenPrice) * 100) : undefined,
            departureTime: cheapest.departureTime || '',
            deepLink: deepLink.url,
            missionId,
          });
          await resend.emails.send({
            from: 'Flyeas <onboarding@resend.dev>',
            to: (mission as any).email,
            subject: emailData.subject,
            html: emailData.html,
          });
          console.log('[missions/propose] auto_bought email sent', { missionId });
        } catch (emailErr: any) {
          console.warn('[missions/propose] auto_bought email failed', { error: emailErr?.message });
        }
      }

      console.log('[missions/propose] auto_bought', {
        ...logCtx,
        ms: Date.now() - started,
        price: cheapest.priceUsd,
      });
      return NextResponse.json({
        success: true,
        decision: 'AUTO_BOUGHT',
        proposal,
        prediction,
      });
    }

    // ----------------------------------------------------------------
    // PROPOSAL PATH (within budget but predictor says not to auto-buy)
    //
    // This fires when:
    //   - Price is above the auto-buy threshold, OR
    //   - Predictor confidence is too low to auto-buy, OR
    //   - Predictor says MONITOR/WAIT
    //
    // The proposal includes the full prediction so the user sees
    // exactly why the agent thinks this is worth a decision.
    // ----------------------------------------------------------------
    const proposalReason = prediction
      ? `${prediction.reason}${
          !meetsThresholdGate
            ? ` (price above your $${threshold} auto-buy limit)`
            : !meetsPredictorGate && prediction.action !== 'BUY_NOW'
            ? ` I'm asking before capturing because the signal isn't decisive yet.`
            : ''
        }`
      : `Agent found ${cheapest.airline || 'a flight'} at $${cheapest.priceUsd}. Above your auto-buy limit, so confirm before I charge your card.`;

    const proposal: MissionProposal = {
      id: crypto.randomUUID(),
      missionId,
      offerId: cheapest.id,
      offerSnapshot: snapshot,
      status: 'pending',
      reason: proposalReason,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6h
    };
    await createProposal(proposal);
    await updateMission(missionId, { status: 'proposal_pending' });

    // Send deal-found email for pending proposal (non-blocking)
    if ((mission as any).alertEmailEnabled && (mission as any).email && process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        const emailData = dealFoundEmail({
          userName: (mission as any).userName || (mission as any).email.split('@')[0],
          origin: mission.origin,
          destination: mission.destination,
          airline: snapshot.airline,
          price: cheapest.priceUsd,
          oldPrice: mission.bestSeenPrice != null && mission.bestSeenPrice > cheapest.priceUsd
            ? mission.bestSeenPrice : undefined,
          percentOff: mission.bestSeenPrice != null && mission.bestSeenPrice > cheapest.priceUsd
            ? Math.round((1 - cheapest.priceUsd / mission.bestSeenPrice) * 100) : undefined,
          departureTime: cheapest.departureTime || '',
          deepLink: deepLink.url,
          missionId,
        });
        await resend.emails.send({
          from: 'Flyeas <onboarding@resend.dev>',
          to: (mission as any).email,
          subject: emailData.subject,
          html: emailData.html,
        });
        console.log('[missions/propose] pending proposal email sent', { missionId });
      } catch (emailErr: any) {
        console.warn('[missions/propose] pending proposal email failed', { error: emailErr?.message });
      }
    }

    console.log('[missions/propose] pending proposal', {
      ...logCtx,
      proposalId: proposal.id,
      ms: Date.now() - started,
    });

    return NextResponse.json({
      success: true,
      decision: 'PROPOSAL_PENDING',
      proposal,
      prediction,
    });
  } catch (err: any) {
    console.error('[missions/propose] unhandled error', {
      ...logCtx,
      ms: Date.now() - started,
      error: err?.message,
      stack: err?.stack?.split('\n').slice(0, 4).join('\n'),
    });
    return NextResponse.json(
      { success: false, error: err?.message || 'Propose failed' },
      { status: 500 }
    );
  }
}
