import { NextRequest, NextResponse } from 'next/server';
import { getMission } from '@/lib/store/missions-db';
import {
  getSamples,
  getSamplesForWindow,
  getCoverageScore,
  routeKey,
} from '@/lib/agent/price-history';
import { computeBaseline } from '@/lib/agent/baselines';
import { predict } from '@/lib/agent/predictor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 15;

/**
 * GET /api/missions/[id]/prediction
 *
 * Returns a rich statistical read-out for a mission's route without
 * running a new flight search. Used by:
 *   - The cockpit UI to render the prediction chart + confidence meter
 *   - A public "price insight" surface on the landing page (future)
 *   - Investor-facing dashboards that want the raw numbers
 *
 * The response is entirely historical — it's whatever the agent has
 * already observed through previous sweeps. Cheap to call, no upstream
 * API burned.
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
      return NextResponse.json(
        { success: false, error: 'Mission not found' },
        { status: 404 }
      );
    }
    logCtx.route = `${mission.origin}→${mission.destination}`;

    const daysUntilDeparture = Math.max(
      0,
      Math.ceil(
        (new Date(mission.departDate).getTime() - Date.now()) /
          (24 * 60 * 60 * 1000)
      )
    );

    const routeParts = {
      origin: mission.origin,
      destination: mission.destination,
      cabinClass: mission.cabinClass,
      adults: mission.passengers,
    };

    const [windowSamples, allSamples, coverage] = await Promise.all([
      getSamplesForWindow(routeParts, daysUntilDeparture, 14),
      getSamples(routeParts, { sinceDays: 90 }),
      getCoverageScore(routeParts),
    ]);

    // Build a 30-day sparkline series (daily minimum)
    const sparkline = buildSparkline(allSamples, 30);

    // Overall route baseline (not window-filtered) for context
    const overallBaseline = computeBaseline(allSamples);

    // Window baseline — what the predictor actually uses
    const windowBaseline = computeBaseline(windowSamples);

    // If we have a current observation (mission.bestSeenPrice) we can
    // immediately run a prediction for it without a new search.
    let prediction = null;
    if (mission.bestSeenPrice && mission.bestSeenPrice > 0) {
      prediction = predict({
        currentPrice: mission.bestSeenPrice,
        daysUntilDeparture,
        windowSamples,
        allSamples,
      });
    }

    const coverageLabel =
      coverage.samples < 5
        ? 'learning'
        : coverage.samples < 30
        ? 'ramping up'
        : coverage.samples < 100
        ? 'confident'
        : 'highly confident';

    console.log('[missions/prediction] ok', {
      ...logCtx,
      ms: Date.now() - started,
      samples: coverage.samples,
    });

    return NextResponse.json({
      success: true,
      route: routeKey(routeParts),
      daysUntilDeparture,
      coverage: {
        samples: coverage.samples,
        confidence: coverage.confidence,
        label: coverageLabel,
      },
      baseline: overallBaseline,
      windowBaseline,
      prediction,
      sparkline,
      lastCheckedAt: mission.lastCheckedAt,
    });
  } catch (err: any) {
    console.error('[missions/prediction] error', {
      ...logCtx,
      error: err?.message,
    });
    return NextResponse.json(
      { success: false, error: err?.message || 'Prediction failed' },
      { status: 500 }
    );
  }
}

// ------------------------------------------------------------------
// Build a daily-min sparkline from raw samples
// ------------------------------------------------------------------
function buildSparkline(
  samples: Array<{ checkedAt: string; priceUsd: number }>,
  days: number
): Array<{ date: string; priceUsd: number }> {
  if (samples.length === 0) return [];
  const byDay = new Map<string, number>();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  for (const s of samples) {
    const t = new Date(s.checkedAt).getTime();
    if (t < cutoff) continue;
    const day = s.checkedAt.slice(0, 10);
    const prev = byDay.get(day);
    if (prev == null || s.priceUsd < prev) byDay.set(day, s.priceUsd);
  }
  return Array.from(byDay.entries())
    .map(([date, priceUsd]) => ({ date, priceUsd }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
