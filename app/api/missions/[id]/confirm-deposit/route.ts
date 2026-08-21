import { NextRequest, NextResponse } from 'next/server';
import { requireMissionOwner } from '@/lib/auth/guard';
import { getMission, updateMission } from '@/lib/store/missions-db';
import { readMissionState } from '@/lib/payments/escrow';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST /api/missions/[id]/confirm-deposit
 *
 * Called by the frontend after a wallet user signs + broadcasts the
 * USDC approve + deposit transactions. We verify the deposit is
 * actually on-chain by reading the MissionEscrow contract state
 * before flipping the mission status to 'monitoring'.
 *
 * Body: { depositTxHash: string }
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
    const { depositTxHash } = (await req.json().catch(() => ({}))) as {
      depositTxHash?: string;
    };
    if (!depositTxHash) {
      return NextResponse.json(
        { success: false, error: 'depositTxHash is required' },
        { status: 400 }
      );
    }
    logCtx.depositTxHash = depositTxHash;

    const mission = await getMission(missionId);
    if (!mission) {
      return NextResponse.json(
        { success: false, error: 'Mission not found' },
        { status: 404 }
      );
    }
    if (mission.paymentRail !== 'wallet') {
      return NextResponse.json(
        {
          success: false,
          error: 'This endpoint is only for wallet-rail missions',
        },
        { status: 400 }
      );
    }

    // Verify the deposit is actually on-chain
    try {
      const state = await readMissionState(missionId);
      if (!state.active || state.budgetUsd <= 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              'On-chain mission not found or inactive — did the deposit transaction actually mine?',
          },
          { status: 409 }
        );
      }

      await updateMission(missionId, {
        status: 'monitoring',
        paymentStatus: 'authorized',
        walletEscrowTxHash: depositTxHash,
        budgetDepositedUsd: state.budgetUsd,
      });

      console.log('[missions/confirm-deposit] ok', {
        ...logCtx,
        onchainBudget: state.budgetUsd,
        ms: Date.now() - started,
      });

      // Don't echo the full Mission (it carries userId, wallet address,
      // escrow id, and tx hashes). The pay page only reads `success`;
      // return a minimal, non-sensitive view. On-chain state is public.
      return NextResponse.json({
        success: true,
        mission: {
          id: missionId,
          status: 'monitoring',
          paymentStatus: 'authorized',
          budgetDepositedUsd: state.budgetUsd,
        },
        onchain: state,
      });
    } catch (err: any) {
      console.error('[missions/confirm-deposit] read failed', {
        ...logCtx,
        error: err?.message,
      });
      return NextResponse.json(
        {
          success: false,
          error: `Could not verify on-chain deposit: ${err.message}`,
        },
        { status: 502 }
      );
    }
  } catch (err: any) {
    console.error('[missions/confirm-deposit] unhandled', {
      ...logCtx,
      error: err?.message,
    });
    return NextResponse.json(
      { success: false, error: err?.message || 'Confirm-deposit failed' },
      { status: 500 }
    );
  }
}
