import { NextRequest, NextResponse } from 'next/server';
import type { Mission, PaymentRail } from '@/lib/types';
import { createMission } from '@/lib/store/missions-db';
import {
  createMissionHold,
  isStripeConfigured,
  isLiveMode,
} from '@/lib/payments/stripe';
import {
  isEscrowConfigured,
  getEscrowAddress,
  getMerchantAddress,
  getEscrowChainName,
  getEscrowUsdcAddress,
  buildDepositCallData,
  missionIdToBytes32,
  toUsdcBaseUnits,
} from '@/lib/payments/escrow';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST /api/missions/create
 *
 * Creates a new monitoring mission AND initiates the payment hold on
 * the chosen rail. Returns everything the frontend needs to finish the
 * hold:
 *   - stripe rail: clientSecret (for Stripe Elements)
 *   - wallet rail: contract address, ABI fragment, args (for wagmi
 *                  writeContract())
 *
 * The mission status starts as 'awaiting_payment'. It transitions to
 * 'monitoring' only after the hold is actually confirmed — for Stripe
 * via the /api/webhooks/stripe webhook, for wallet via a user-signed
 * tx that the frontend reports back via /api/missions/[id]/confirm-deposit.
 */
export async function POST(req: NextRequest) {
  // ---- Observability instrumentation -------------------------------
  // Every mission creation is logged with rail, route, budget, latency,
  // and outcome. Errors are captured with full stack traces so
  // production issues are traceable. The logCtx object accumulates
  // metadata as the handler progresses.
  const started = Date.now();
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const logCtx: Record<string, any> = { ip };

  try {
    return await handleCreate(req, started, logCtx);
  } catch (err: any) {
    console.error('[missions/create] unhandled error', {
      ...logCtx,
      ms: Date.now() - started,
      error: err?.message,
      stack: err?.stack?.split('\n').slice(0, 4).join('\n'),
    });
    return NextResponse.json(
      { success: false, error: `Mission creation failed: ${err?.message || 'unknown error'}` },
      { status: 500 }
    );
  }
}

async function handleCreate(
  req: NextRequest,
  started: number,
  logCtx: Record<string, any>
) {
  let body: any;
  try {
    body = await req.json();
  } catch (_) {
    console.warn('[missions/create] invalid JSON', { ip: logCtx.ip });
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }
  logCtx.rail = body?.paymentRail || 'stripe';
  logCtx.route = `${body?.origin || '?'}→${body?.destination || '?'}`;
  logCtx.budget = body?.maxBudgetUsd;
  console.log('[missions/create] received', logCtx);

  // --------------------------------------------------------------
  // Validate
  // --------------------------------------------------------------
  const errors: string[] = [];
  const rail: PaymentRail =
    body.paymentRail === 'wallet' ? 'wallet' : 'stripe';

  if (!body.origin) errors.push('origin is required');
  if (!body.destination) errors.push('destination is required');
  if (!body.departDate) errors.push('departDate is required');

  const maxBudget = Number(body.maxBudgetUsd || 0);
  if (!Number.isFinite(maxBudget) || maxBudget <= 0) {
    errors.push('maxBudgetUsd must be a positive number');
  }

  const autoBuyThreshold =
    body.autoBuyThresholdUsd != null
      ? Number(body.autoBuyThresholdUsd)
      : undefined;
  if (
    autoBuyThreshold != null &&
    (!Number.isFinite(autoBuyThreshold) || autoBuyThreshold < 0)
  ) {
    errors.push('autoBuyThresholdUsd must be a non-negative number');
  }
  if (autoBuyThreshold != null && autoBuyThreshold > maxBudget) {
    errors.push('autoBuyThresholdUsd cannot exceed maxBudgetUsd');
  }

  if (rail === 'stripe' && !isStripeConfigured()) {
    errors.push(
      'Stripe rail is not configured on this server. Set STRIPE_SECRET_KEY.'
    );
  }
  if (rail === 'wallet' && !isEscrowConfigured()) {
    errors.push(
      'Wallet rail is not configured. Set NEXT_PUBLIC_ESCROW_ADDRESS and NEXT_PUBLIC_ESCROW_MERCHANT.'
    );
  }
  if (rail === 'wallet' && !body.walletAddress) {
    errors.push('walletAddress is required for the wallet rail');
  }

  if (errors.length > 0) {
    console.warn('[missions/create] validation failed', {
      ...logCtx,
      ms: Date.now() - started,
      errors,
    });
    return NextResponse.json(
      { success: false, error: errors.join('; ') },
      { status: 400 }
    );
  }

  // --------------------------------------------------------------
  // Build the mission row
  // --------------------------------------------------------------
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const holdExpiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days — matches Stripe hold window
  ).toISOString();

  const mission: Mission = {
    id,
    userId: body.userId || 'anonymous',
    type: 'flight',
    origin: String(body.origin),
    originCity: body.originCity,
    destination: String(body.destination),
    destinationCity: body.destinationCity,
    departDate: String(body.departDate),
    returnDate: body.returnDate || undefined,
    passengers: Number(body.passengers || 1),
    maxBudgetUsd: maxBudget,
    autoBuyThresholdUsd: autoBuyThreshold,
    cabinClass: body.cabinClass || 'economy',
    cabinBagRequired: body.cabinBagRequired !== false,
    stopsPreference: body.stopsPreference || 'any',
    preferredAirlines: body.preferredAirlines || [],
    ecoPreference: body.ecoPreference || 'balanced',
    monitoringEnabled: true,
    alertEmailEnabled: body.alertEmailEnabled !== false,
    status: 'awaiting_payment',
    budgetDepositedUsd: 0,
    paymentRail: rail,
    paymentStatus: 'none',
    createdAt: now,
    updatedAt: now,
  };

  // --------------------------------------------------------------
  // Kick off the hold on the chosen rail
  // --------------------------------------------------------------
  if (rail === 'stripe') {
    try {
      const hold = await createMissionHold({
        amountUsd: maxBudget,
        missionId: id,
        userEmail: body.userEmail,
        description: `Flyeas mission ${mission.origin} → ${mission.destination} on ${mission.departDate}`,
      });
      mission.stripePaymentIntentId = hold.paymentIntentId;
      mission.stripeClientSecret = hold.clientSecret;
      mission.stripeAuthorizedAmount = hold.amountCents;
      mission.stripeExpiresAt = hold.expiresAt;
      logCtx.paymentIntentId = hold.paymentIntentId;
    } catch (err: any) {
      console.error('[missions/create] stripe hold failed', {
        ...logCtx,
        ms: Date.now() - started,
        error: err?.message,
      });
      return NextResponse.json(
        { success: false, error: `Stripe hold failed: ${err.message}` },
        { status: 502 }
      );
    }
  }

  if (rail === 'wallet') {
    mission.walletUserAddress = String(body.walletAddress);
    mission.walletEscrowId = missionIdToBytes32(id);
    mission.walletChain = getEscrowChainName();
    mission.stripeExpiresAt = holdExpiresAt;
  }

  await createMission(mission);

  // --------------------------------------------------------------
  // Response
  // --------------------------------------------------------------
  const response: any = {
    success: true,
    mission,
    rail,
  };

  if (rail === 'stripe') {
    response.stripe = {
      clientSecret: mission.stripeClientSecret,
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null,
      liveMode: isLiveMode(),
      authorizedAmountCents: mission.stripeAuthorizedAmount,
      expiresAt: mission.stripeExpiresAt,
    };
    // Don't leak the client secret back in the mission snapshot the
    // client might cache — return it only inside the `stripe` object.
    delete (response.mission as Mission).stripeClientSecret;
  }

  if (rail === 'wallet') {
    const calldata = buildDepositCallData({
      missionId: id,
      budgetUsd: maxBudget,
      autoBuyLimitUsd: autoBuyThreshold ?? maxBudget,
      expiresAtIso: holdExpiresAt,
    });
    response.wallet = {
      chain: getEscrowChainName(),
      escrowAddress: getEscrowAddress(),
      usdcAddress: getEscrowUsdcAddress(),
      merchantAddress: getMerchantAddress(),
      depositArgs: {
        id: calldata.args[0],
        budget: calldata.args[1].toString(),
        autoBuyLimit: calldata.args[2].toString(),
        expiresAt: calldata.args[3].toString(),
      },
      approvalAmount: toUsdcBaseUnits(maxBudget).toString(),
      expiresAt: holdExpiresAt,
    };
    logCtx.walletAddress = mission.walletUserAddress;
  }

  console.log('[missions/create] success', {
    ...logCtx,
    missionId: id,
    ms: Date.now() - started,
  });

  return NextResponse.json(response);
}
