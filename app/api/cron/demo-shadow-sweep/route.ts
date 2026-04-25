import { NextRequest, NextResponse } from 'next/server';
import { watchMission } from '@/lib/agent/watcher';
import { pickRotatingRoutes, type DemoRoute } from '@/lib/agent/demo-routes';
import type { Mission } from '@/lib/types';

/**
 * GET /api/cron/demo-shadow-sweep
 *
 * Cron endpoint qui fait tourner shadow mode V7a sur un échantillon
 * roulant de routes du pool DEMO_ROUTES (lib/agent/demo-routes.ts).
 *
 * Pourquoi : sans missions utilisateur réelles, agent_decisions reste
 * vide. Ce cron alimente shadow mode avec des données SKY-SCRAPPER
 * RÉELLES sur des routes diverses, sans toucher Stripe ni aucun
 * utilisateur. Les missions sont synthétiques (en RAM uniquement,
 * jamais persistées dans la table missions).
 *
 * Schedule : 1× par jour (voir vercel.json). Pioche 10 routes du pool
 * de 100 selon un index roulant basé sur le day-of-year. Exécution
 * séquentielle pour ne pas surcharger Sky-Scrapper et rester sous le
 * budget Vercel (300 s pour cette route).
 *
 * Auth : Bearer CRON_SECRET (Vercel signe automatiquement les requêtes
 * cron avec ce header).
 *
 * Pas de fake data : chaque scan consomme un appel Sky-Scrapper réel,
 * récupère des prix réels en temps réel, appelle Modal V7a, et logge
 * la décision dans agent_decisions.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ROUTES_PER_RUN = Number(
  process.env.DEMO_SHADOW_ROUTES_PER_RUN ?? '10'
);

interface RouteResult {
  route: string;
  ok: boolean;
  ms: number;
  cheapest_price?: number;
  v1_action?: string;
  v7a_action?: string;
  provider?: string | null;
  error?: string;
}

function buildSyntheticMission(r: DemoRoute, now: Date): Mission {
  const departTimestamp = now.getTime() + r.ttd * 86400000;
  const departDate = new Date(departTimestamp).toISOString().split('T')[0];
  const nowIso = now.toISOString();
  return {
    id: `demo-${r.origin}-${r.destination}-${nowIso}`,
    userId: 'demo-shadow-sweep',
    type: 'flight',
    origin: r.origin,
    destination: r.destination,
    departDate,
    passengers: 1,
    maxBudgetUsd: 1500,
    autoBuyThresholdUsd: 1200,
    cabinClass: 'economy',
    cabinBagRequired: false,
    stopsPreference: 'any',
    preferredAirlines: [],
    ecoPreference: 'balanced',
    monitoringEnabled: true,
    alertEmailEnabled: false,
    status: 'monitoring',
    budgetDepositedUsd: 1500,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

async function scanOne(r: DemoRoute, now: Date): Promise<RouteResult> {
  const started = Date.now();
  const label = `${r.origin}-${r.destination}`;
  try {
    const mission = buildSyntheticMission(r, now);
    const result = await watchMission(mission);
    const ms = Date.now() - started;
    const provider =
      (result.cheapest?.rawData as { provider?: string } | undefined)
        ?.provider ?? null;
    const v7aAction =
      (result.prediction as { v7a?: { action?: string } } | null)?.v7a
        ?.action ?? null;
    return {
      route: label,
      ok: !!result.cheapest && !!result.prediction,
      ms,
      cheapest_price: result.cheapest?.priceUsd,
      v1_action: result.prediction?.action,
      v7a_action: v7aAction ?? undefined,
      provider,
      error: result.error,
    };
  } catch (e) {
    return {
      route: label,
      ok: false,
      ms: Date.now() - started,
      error: (e as Error)?.message ?? 'scanOne failed',
    };
  }
}

export async function GET(req: NextRequest) {
  const started = Date.now();

  // Auth — Vercel cron envoie automatiquement Authorization: Bearer <CRON_SECRET>
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (expected && auth !== `Bearer ${expected}`) {
    console.warn('[demo-shadow-sweep] 401 unauthorized', {
      has_auth: Boolean(auth),
    });
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 }
    );
  }

  const now = new Date();
  const routes = pickRotatingRoutes(ROUTES_PER_RUN, now);
  console.log('[demo-shadow-sweep] starting', {
    at: now.toISOString(),
    routes_count: routes.length,
    sample: routes.slice(0, 3).map((r) => `${r.origin}-${r.destination}`),
  });

  // Séquentiel intentionnel : éviter rate limits Sky-Scrapper
  // (en parallèle on a vu des 429 sur le PRO tier).
  const results: RouteResult[] = [];
  for (const r of routes) {
    const elapsed = Date.now() - started;
    // Garde-fou : si on approche les 300 s, on s'arrête proprement
    // pour ne pas être tué par Vercel.
    if (elapsed > 270000) {
      console.warn(
        '[demo-shadow-sweep] elapsed budget reached, skipping remaining routes',
        { elapsed_ms: elapsed, remaining: routes.length - results.length }
      );
      break;
    }
    const res = await scanOne(r, now);
    results.push(res);
    console.log('[demo-shadow-sweep] route done', res);
  }

  const ms = Date.now() - started;
  const ok_count = results.filter((r) => r.ok).length;
  const fail_count = results.length - ok_count;
  const providers = results.reduce<Record<string, number>>((acc, r) => {
    if (r.provider) acc[r.provider] = (acc[r.provider] ?? 0) + 1;
    return acc;
  }, {});

  console.log('[demo-shadow-sweep] done', {
    ms,
    routes_attempted: results.length,
    ok_count,
    fail_count,
    providers,
  });

  return NextResponse.json({
    ok: true,
    ms,
    routes_attempted: results.length,
    ok_count,
    fail_count,
    providers,
    results,
  });
}

export async function POST(req: NextRequest) {
  // Permet aussi l'appel manuel via curl POST (même auth)
  return GET(req);
}
