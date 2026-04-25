/**
 * SHADOW SMOKE — debug only. NOT used by the watcher, NOT scheduled, NOT
 * a feature. One-shot validator of the internal shadow chain :
 *
 *     decideV1 -> predictV7aFirst -> logV7aShadow -> /api/agent/shadow-log
 *     -> INSERT agent_decisions
 *
 * Bypasses the broken live flight providers (Sky-Scrapper proxy / Kiwi
 * 429 / Google Flights empty) by feeding a synthetic in-memory offer +
 * fixture price history. NO disk write, NO real searchFlights() call,
 * NO Stripe, NO real mission persisted.
 *
 * Identification of the produced row in prod :
 *   mission_id LIKE 'smoke-%'
 *   provider   = 'shadow-smoke-fixture'
 *   route      = 'ATL-LAX' (default)
 *
 * Reversibility :
 *   delete from agent_decisions where provider = 'shadow-smoke-fixture';
 *
 * Usage :
 *   node --env-file=.env.local --import tsx scripts/shadow-smoke.ts
 */

import type { PriceSample } from '../lib/agent/price-history';
import { predictV7aFirst } from '../lib/agent/v7a';
import { logV7aShadow } from '../lib/agent/watcher';
import type { Mission } from '../lib/types';

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

// In-memory only. Never written to .data/price-history.json — recordSample
// is intentionally NOT called here. Guarantees zero local pollution.
function buildFixtureHistory(): PriceSample[] {
  const now = Date.now();
  const dayMs = 86400000;
  const departIso = new Date(now + TTD_DAYS * dayMs)
    .toISOString()
    .split('T')[0];
  const points: Array<{ daysAgo: number; ttd: number; price: number }> = [
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

async function main(): Promise<void> {
  console.log('[shadow-smoke] start', {
    algo: process.env.FLYEAS_ALGO_VERSION,
    target: process.env.NEXT_PUBLIC_APP_URL,
    has_modal_url: Boolean(process.env.MODAL_V7A_URL),
    has_cron_secret: Boolean(process.env.CRON_SECRET),
    has_supabase: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  });

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

  console.log('[shadow-smoke] enriched', {
    engine: enriched.engine,
    v1_action: enriched.action,
    v1_confidence: enriched.confidence,
    v7a_present: Boolean(enriched.v7a),
    v7a_action: enriched.v7a?.action,
    v7a_action_source: enriched.v7a?.action_source,
    ml_available: enriched.v7a?.ml_layer?.ml_available ?? false,
  });

  if (!enriched.v7a) {
    console.error(
      '[shadow-smoke] FAIL — V7a returned null. Check MODAL_V7A_URL / ' +
        'MODAL_V7A_SECRET / FLYEAS_ALGO_VERSION=shadow.'
    );
    process.exit(1);
  }

  await logV7aShadow(
    enriched,
    mission,
    FIXTURE_PRICE_USD,
    TTD_DAYS,
    FIXTURE_TAG
  );

  console.log('[shadow-smoke] DONE — payload posted to /api/agent/shadow-log');
  console.log('[shadow-smoke] expected row in agent_decisions :', {
    mission_id: mission.id,
    route: `${mission.origin}-${mission.destination}`,
    price: FIXTURE_PRICE_USD,
    ttd_days: TTD_DAYS,
    engine: enriched.engine,
    action: enriched.action,
    v7a_action: enriched.v7a.action,
    confidence: enriched.v7a.confidence,
    provider: FIXTURE_TAG,
  });
  console.log(
    "[shadow-smoke] verify with: select * from agent_decisions where provider = '" +
      FIXTURE_TAG +
      "' order by logged_at desc limit 1;"
  );
}

main().catch((e) => {
  console.error('[shadow-smoke] FAILED', e);
  process.exit(1);
});
