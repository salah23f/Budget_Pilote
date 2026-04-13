import { NextRequest, NextResponse } from 'next/server';
import { listMissions } from '@/lib/store/missions-db';
import { watchMission } from '@/lib/agent/watcher';
import type { Mission } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * POST /api/agent/sweep
 *
 * External scheduler entrypoint. GitHub Actions (free, unlimited
 * minutes on public repos) calls this endpoint every 15 minutes to
 * keep the agents "toujours à l'affût" without needing Vercel Pro.
 *
 * What it does:
 *   1. Authenticates the caller with CRON_SECRET (same secret as the
 *      Vercel cron)
 *   2. Loads every monitoring/proposal_pending mission
 *   3. For each, calls watchMission() which runs a flight search,
 *      records a price sample, and runs the predictor
 *   4. For any mission that triggers a BUY_NOW signal above the
 *      auto-buy confidence threshold, fires /api/missions/[id]/propose
 *      to execute the actual capture
 *
 * Why POST not GET: semantically this mutates state (it records
 * samples + may trigger captures). GitHub Actions workflow_dispatch
 * uses POST by default anyway.
 *
 * Concurrency: bounded to 5 parallel missions per sweep to avoid
 * hammering Sky-Scrapper / Kiwi rate limits.
 */

const PARALLEL_LIMIT = 5;

export async function POST(req: NextRequest) {
  const started = Date.now();

  // Auth — same shared secret as the Vercel cron
  const auth = req.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    auth !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const all = await listMissions();
    const active = all.filter(
      (m) =>
        m.monitoringEnabled !== false &&
        (m.status === 'monitoring' || m.status === 'proposal_pending')
    );

    console.log('[agent/sweep] started', {
      total: all.length,
      active: active.length,
    });

    if (active.length === 0) {
      return NextResponse.json({
        success: true,
        checked: 0,
        triggered: 0,
      });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      `https://${req.headers.get('host') || 'faregenie.vercel.app'}`;

    // Bounded concurrency — process missions in chunks of PARALLEL_LIMIT
    const results: any[] = [];
    for (let i = 0; i < active.length; i += PARALLEL_LIMIT) {
      const chunk = active.slice(i, i + PARALLEL_LIMIT);
      const chunkResults = await Promise.all(
        chunk.map((m) => sweepOne(m, baseUrl, auth))
      );
      results.push(...chunkResults);
    }

    const triggered = results.filter(
      (r) => r.decision === 'AUTO_BOUGHT' || r.decision === 'PROPOSAL_PENDING'
    ).length;

    console.log('[agent/sweep] complete', {
      ms: Date.now() - started,
      checked: active.length,
      triggered,
    });

    return NextResponse.json({
      success: true,
      checked: active.length,
      triggered,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[agent/sweep] error', {
      ms: Date.now() - started,
      error: err?.message,
    });
    return NextResponse.json(
      { success: false, error: err?.message || 'Sweep failed' },
      { status: 500 }
    );
  }
}

async function sweepOne(
  mission: Mission,
  baseUrl: string,
  auth: string | null
): Promise<any> {
  try {
    // First run the watcher directly — this is fast and just records
    // a price sample + runs the predictor.
    const watch = await watchMission(mission);

    if (!watch.prediction || !watch.cheapest) {
      return {
        missionId: mission.id,
        decision: 'NO_OFFERS',
        error: watch.error,
      };
    }

    // If the watcher's prediction says BUY_NOW with strong confidence,
    // fire the propose endpoint which does the real capture work
    // (Stripe / escrow). We don't capture directly from here because
    // the propose endpoint centralizes the payment state transitions.
    const shouldPropose =
      watch.prediction.action === 'BUY_NOW' ||
      // Also propose if we found a price above auto-buy threshold but
      // within budget — user will see a proposal
      (mission.autoBuyThresholdUsd != null &&
        watch.cheapest.priceUsd <= mission.maxBudgetUsd);

    if (!shouldPropose) {
      return {
        missionId: mission.id,
        decision: 'NO_TRIGGER',
        cheapest: watch.cheapest.priceUsd,
        predictorAction: watch.prediction.action,
        predictorConfidence: watch.prediction.confidence,
      };
    }

    const res = await fetch(`${baseUrl}/api/missions/${mission.id}/propose`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-flyeas-sweep': '1',
        ...(auth ? { authorization: auth } : {}),
      },
      body: JSON.stringify({ source: 'sweep' }),
    });
    const data = await res.json().catch(() => ({}));
    return {
      missionId: mission.id,
      decision: data.decision || 'UNKNOWN',
      cheapest: watch.cheapest.priceUsd,
      predictorAction: watch.prediction.action,
      predictorConfidence: watch.prediction.confidence,
    };
  } catch (err: any) {
    return { missionId: mission.id, error: err?.message || 'sweep failed' };
  }
}
