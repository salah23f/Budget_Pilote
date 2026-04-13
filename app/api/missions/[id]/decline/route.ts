import { NextRequest, NextResponse } from 'next/server';
import {
  getMission,
  updateMission,
  getProposal,
  updateProposal,
} from '@/lib/store/missions-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/missions/[id]/decline
 *
 * User says "no thanks" to a pending proposal. The hold stays in place
 * and the mission goes back to monitoring for a better offer.
 */
export async function POST(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const missionId = context.params.id;
  try {
    const { proposalId } = (await req.json().catch(() => ({}))) as {
      proposalId?: string;
    };
    if (!proposalId) {
      return NextResponse.json(
        { success: false, error: 'proposalId is required' },
        { status: 400 }
      );
    }

    const mission = await getMission(missionId);
    if (!mission) {
      return NextResponse.json(
        { success: false, error: 'Mission not found' },
        { status: 404 }
      );
    }

    const proposal = await getProposal(proposalId);
    if (!proposal || proposal.missionId !== missionId) {
      return NextResponse.json(
        { success: false, error: 'Proposal not found' },
        { status: 404 }
      );
    }

    await updateProposal(proposalId, { status: 'declined' });
    await updateMission(missionId, { status: 'monitoring' });

    console.log('[missions/decline] ok', { missionId, proposalId });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[missions/decline] unhandled', {
      missionId,
      error: err?.message,
    });
    return NextResponse.json(
      { success: false, error: err?.message || 'Decline failed' },
      { status: 500 }
    );
  }
}
