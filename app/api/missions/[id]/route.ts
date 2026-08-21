import { NextRequest, NextResponse } from 'next/server';
import { requireMissionOwner } from '@/lib/auth/guard';
import {
  getMission,
  listProposalsForMission,
} from '@/lib/store/missions-db';
import { readMissionState, isEscrowConfigured } from '@/lib/payments/escrow';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/missions/[id]
 *
 * Returns the mission, its proposals, and (for wallet-rail missions)
 * the live on-chain state read straight from MissionEscrow. The
 * frontend polls this endpoint every few seconds on the Cockpit page
 * so the user sees the agent's progress in real time.
 */
export async function GET(
  _req: NextRequest,
  context: { params: { id: string } }
) {
  const started = Date.now();
  const missionId = context.params.id;
  // Caller must own this mission — 404 (not 403) hides existence.
  const owned = await requireMissionOwner(missionId);
  if (!owned.ok) return owned.response;
  const logCtx: Record<string, any> = { missionId };

  try {
    const mission = await getMission(missionId);
    if (!mission) {
      console.warn('[missions/get] not found', logCtx);
      return NextResponse.json(
        { success: false, error: 'Mission not found' },
        { status: 404 }
      );
    }
    logCtx.rail = mission.paymentRail;
    logCtx.status = mission.status;

    // Project to only non-sensitive fields. This endpoint is currently
    // UNAUTHENTICATED (no ownership check yet — see docs/audit/), so it must
    // not leak userId, payment identifiers/secrets, wallet addresses, tx
    // hashes, or contact info. The cockpit + pay pages only consume the
    // fields below; the Stripe client secret comes from the create response
    // (sessionStorage on the client), never from this endpoint.
    const safe = {
      id: mission.id,
      type: mission.type,
      status: mission.status,
      origin: mission.origin,
      originCity: mission.originCity,
      destination: mission.destination,
      destinationCity: mission.destinationCity,
      departDate: mission.departDate,
      returnDate: mission.returnDate,
      passengers: mission.passengers,
      cabinClass: mission.cabinClass,
      maxBudgetUsd: mission.maxBudgetUsd,
      autoBuyThresholdUsd: mission.autoBuyThresholdUsd,
      bestSeenPrice: mission.bestSeenPrice,
      lastCheckedAt: mission.lastCheckedAt,
      budgetDepositedUsd: mission.budgetDepositedUsd,
      paymentRail: mission.paymentRail,
      paymentStatus: mission.paymentStatus,
      stripeAuthorizedAmount: mission.stripeAuthorizedAmount,
      stripeCapturedAmount: mission.stripeCapturedAmount,
      createdAt: mission.createdAt,
      updatedAt: mission.updatedAt,
    };

    const proposals = await listProposalsForMission(missionId);
    logCtx.proposalCount = proposals.length;

    let onchain: any = null;
    if (mission.paymentRail === 'wallet' && isEscrowConfigured()) {
      try {
        onchain = await readMissionState(missionId);
      } catch (err: any) {
        console.warn('[missions/get] onchain read failed', {
          ...logCtx,
          error: err?.message,
        });
        onchain = null;
      }
    }

    console.log('[missions/get] ok', {
      ...logCtx,
      ms: Date.now() - started,
    });

    return NextResponse.json({
      success: true,
      mission: safe,
      proposals,
      onchain,
    });
  } catch (err: any) {
    console.error('[missions/get] unhandled', {
      ...logCtx,
      ms: Date.now() - started,
      error: err?.message,
      stack: err?.stack?.split('\n').slice(0, 4).join('\n'),
    });
    return NextResponse.json(
      { success: false, error: err?.message || 'Fetch failed' },
      { status: 500 }
    );
  }
}
