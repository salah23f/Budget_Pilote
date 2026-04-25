/**
 * SHADOW SMOKE — debug-only route. NOT used by the watcher, NOT scheduled,
 * NOT in any client-facing flow. Manual one-shot validator of the internal
 * shadow chain, run server-side where Sensitive env vars are available.
 *
 * Why this exists in addition to scripts/shadow-smoke.ts :
 *   MODAL_V7A_URL / MODAL_V7A_SECRET / NEXT_PUBLIC_APP_URL are marked
 *   Sensitive on Vercel and cannot be pulled to .env.local — only the
 *   Vercel runtime sees them. This route runs there.
 *
 * Auth   : Bearer CRON_SECRET
 * Tag    : provider='shadow-smoke-fixture', mission_id LIKE 'smoke-%'
 * Cleanup: rm app/api/dev/shadow-smoke/route.ts + redeploy
 *          + delete from agent_decisions where provider = 'shadow-smoke-fixture';
 *
 * Usage :
 *   curl -X POST https://faregenie.vercel.app/api/dev/shadow-smoke \
 *     -H "Authorization: Bearer $CRON_SECRET"
 */

import { NextRequest, NextResponse } from 'next/server';
import type { PriceSample } from '@/lib/agent/price-history';
import { predictV7aFirst } from '@/lib/agent/v7a';
import { logV7aShadow } from '@/lib/agent/watcher';
import type { Mission } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROUTE_ORIGIN = 'ATL';
const ROUTE_DESTINATION = 'LAX';
const FIXTURE_PRICE_USD = 180;
const TTD_DAYS = 30;
const FIXTURE_TAG = 'shadow-smoke-fixture';

function buildMission(): Mission {
  const now = new Date();
  const departDate = new Date(now.getTime() + TTD_DAYS * 86400000)
    .toISOString()
    .split('T')[0];
  const nowIso = now.toISOString();
  return {
    id: `smoke-${ROUTE_ORIGIN}-${ROUTE_DESTINATION}-${nowIso}`,
    userId: 'shadow-smoke',
    type: 'flight',
    origin: ROUTE_ORIGIN,
    destination: ROUTE_DESTINATION,
    departDate,
    passengers: 1,
    maxBudgetUsd: 600,
    autoBuyThresholdUsd: 220,
    cabinClass: 'economy',
    cabinBagRequired: false,
    stopsPreference: 'any',
    preferredAirlines: [],
    ecoPreference: 'balanced',
    monitoringEnabled: true,
    alertEmailEnabled: false,
    status: 'monitoring',
    budgetDepositedUsd: 600,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function buildFixtureHistory(): PriceSample[] {
  const now = Date.now();
  const dayMs = 86400000;
  const departIso = new Date(now + TTD_DAYS * dayMs)
    .toISOString()
    .split('T')[0];
  const points = [
    { daysAgo: 14, ttd: TTD_DAYS + 14, price: 215 },
    { daysAgo: 10, ttd: TTD_DAYS + 10, price: 198 },
    { daysAgo: 7,  ttd: TTD_DAYS + 7,  price: 205 },
    { daysAgo: 4,  ttd: TTD_DAYS + 4,  price: 192 },
    { daysAgo: 2,  ttd: TTD_DAYS + 2,  price: 188 },
    { daysAgo: 0,  ttd: TTD_DAYS,      price: FIXTURE_PRICE_USD },
  ];
  return points.map((p) => ({
    checkedAt: new Date(now - p.daysAgo * dayMs).toISOString(),
    departDate: departIso,
    daysUntilDeparture: p.ttd,
    priceUsd: p.price,
    offerCount: 5,
    airline: 'DL',
    source: FIXTURE_TAG,
  }));
}

export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const mission = buildMission();
  const checkedAt = new Date().toISOString();
  const history = buildFixtureHistory();

  const enriched = await predictV7aFirst({
    currentPrice: FIXTURE_PRICE_USD,
    daysUntilDeparture: TTD_DAYS,
    windowSamples: history,
    allSamples: history,
    origin: mission.origin,
    destination: mission.destination,
    budgetMaxUsd: mission.maxBudgetUsd,
    budgetAutoBuyUsd: mission.autoBuyThresholdUsd,
    autobuyEnabled: process.env.FLYEAS_AUTOBUY_ENABLED === 'true',
    preferenceMatch: 1.0,
    nowIso: checkedAt,
  });

  console.log('[shadow-smoke-route] enriched', {
    engine: enriched.engine,
    v1_action: enriched.action,
    v7a_present: Boolean(enriched.v7a),
    v7a_action: enriched.v7a?.action,
    ml_available: enriched.v7a?.ml_layer?.ml_available ?? false,
  });

  if (!enriched.v7a) {
    return NextResponse.json({ ok: false, reason: 'v7a_null' }, { status: 502 });
  }

  await logV7aShadow(enriched, mission, FIXTURE_PRICE_USD, TTD_DAYS, FIXTURE_TAG);

  return NextResponse.json({
    ok: true,
    posted_to: '/api/agent/shadow-log',
    expected_row: {
      mission_id: mission.id,
      route: `${mission.origin}-${mission.destination}`,
      price: FIXTURE_PRICE_USD,
      ttd_days: TTD_DAYS,
      engine: enriched.engine,
      action: enriched.action,
      v7a_action: enriched.v7a.action,
      v7a_action_source: enriched.v7a.action_source,
      confidence: enriched.v7a.confidence,
      ml_available: enriched.v7a.ml_layer.ml_available,
      provider: FIXTURE_TAG,
    },
    verify_sql:
      "select * from agent_decisions where provider = 'shadow-smoke-fixture' order by logged_at desc limit 1;",
  });
}

export async function GET() {
  return NextResponse.json(
    { ok: false, hint: 'POST with Authorization: Bearer $CRON_SECRET. Debug-only.' },
    { status: 405 }
  );
}
