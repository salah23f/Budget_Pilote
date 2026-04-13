import { NextRequest, NextResponse } from 'next/server';
import { getMission, updateMission } from '@/lib/store/missions-db';
import { cancelMissionHold } from '@/lib/payments/stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST /api/missions/[id]/cancel
 *
 * User cancels a monitoring mission. For the Stripe rail we void the
 * PaymentIntent so the authorization is released back to the card
 * immediately. For the wallet rail the USER calls
 * MissionEscrow.withdraw() directly from their wallet — we just flip
 * the mission status so the agent stops working on it.
 */
export async function POST(
  _req: NextRequest,
  context: { params: { id: string } }
) {
  const started = Date.now();
  const missionId = context.params.id;
  const logCtx: Record<string, any> = { missionId };

  try {
    const mission = await getMission(missionId);
    if (!mission) {
      return NextResponse.json(
        { success: false, error: 'Mission not found' },
        { status: 404 }
      );
    }
    logCtx.rail = mission.paymentRail;

    if (mission.status === 'booked') {
      return NextResponse.json(
        {
          success: false,
          error: 'Mission is already booked — cancellation requires a refund, not a hold release.',
        },
        { status: 409 }
      );
    }

    if (mission.paymentRail === 'stripe' && mission.stripePaymentIntentId) {
      try {
        await cancelMissionHold({
          paymentIntentId: mission.stripePaymentIntentId,
          reason: 'requested_by_customer',
        });
      } catch (err: any) {
        // If Stripe says it's already cancelled, that's fine. Log and
        // continue — we still want to mark the mission cancelled.
        console.warn('[missions/cancel] stripe cancel warning', {
          ...logCtx,
          error: err?.message,
        });
      }
    }

    await updateMission(missionId, {
      status: 'cancelled',
      paymentStatus: 'cancelled',
      monitoringEnabled: false,
    });

    console.log('[missions/cancel] ok', {
      ...logCtx,
      ms: Date.now() - started,
    });

    return NextResponse.json({
      success: true,
      mission: await getMission(missionId),
    });
  } catch (err: any) {
    console.error('[missions/cancel] unhandled', {
      ...logCtx,
      error: err?.message,
    });
    return NextResponse.json(
      { success: false, error: err?.message || 'Cancel failed' },
      { status: 500 }
    );
  }
}
