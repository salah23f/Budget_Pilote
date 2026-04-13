import { NextRequest, NextResponse } from 'next/server';
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

    // Strip secret fields before sending to the client
    const safe: any = { ...mission };
    delete safe.stripeClientSecret;

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
