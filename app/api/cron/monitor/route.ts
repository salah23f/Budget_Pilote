import { NextResponse } from 'next/server';
import { listMissions } from '@/lib/store/missions-db';
import type { Mission } from '@/lib/types';

// Vercel Cron auth
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * GET /api/cron/monitor
 *
 * Vercel Cron entrypoint. Runs on the Hobby-compatible daily schedule.
 * For true continuous monitoring (every 15 minutes) you should ALSO
 * enable the GitHub Actions workflow at .github/workflows/flyeas-watcher.yml
 * which hits /api/agent/sweep with the same CRON_SECRET.
 *
 * Both endpoints share the same loop: for each monitoring/proposal_pending
 * mission, fire /api/missions/[id]/propose which runs the predictor
 * (from lib/agent/watcher.ts) and decides whether to auto-buy, create
 * a proposal, or keep watching.
 */
export async function GET(req: Request) {
  // Authorize the cron request
  const authHeader = req.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const started = Date.now();
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    `https://${req.headers.get('host') || 'faregenie.vercel.app'}`;

  try {
    const allMissions: Mission[] = await listMissions();
    const active = allMissions.filter(
      (m) =>
        m.monitoringEnabled !== false &&
        (m.status === 'monitoring' || m.status === 'proposal_pending')
    );

    console.log('[cron/monitor] started', {
      total: allMissions.length,
      active: active.length,
    });

    if (active.length === 0) {
      return NextResponse.json({
        success: true,
        checked: 0,
        message: 'No active missions',
      });
    }

    // Fire propose calls in parallel (bounded concurrency). The propose
    // handler is idempotent — safe to call repeatedly on the same
    // mission; it respects the existing pending proposal if any.
    const results = await Promise.allSettled(
      active.map(async (m) => {
        try {
          const res = await fetch(`${baseUrl}/api/missions/${m.id}/propose`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-flyeas-cron': '1',
            },
            body: JSON.stringify({ source: 'cron' }),
          });
          const data = await res.json().catch(() => ({}));
          return {
            missionId: m.id,
            decision: data.decision || 'UNKNOWN',
            ok: res.ok,
          };
        } catch (err: any) {
          return { missionId: m.id, error: err?.message || 'fetch failed' };
        }
      })
    );

    const summary = results.map((r) =>
      r.status === 'fulfilled' ? r.value : { error: String(r.reason) }
    );

    console.log('[cron/monitor] complete', {
      ms: Date.now() - started,
      checked: active.length,
      results: summary.length,
    });

    return NextResponse.json({
      success: true,
      checked: active.length,
      results: summary,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[cron/monitor] error', {
      ms: Date.now() - started,
      error: err?.message,
    });
    return NextResponse.json(
      { success: false, error: err?.message || 'Monitor failed' },
      { status: 500 }
    );
  }
}
