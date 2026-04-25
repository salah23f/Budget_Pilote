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
// Hobby plan cap = 60 s. On reste sous ce plafond avec 4 routes
// scannées en parallèle par batch de 2 (≈ 25 s observed).
export const maxDuration = 60;

// Hobby plan : maxDuration = 60 s. Chaque scan cold peut prendre 25-40 s
// (Sky-Scrapper down + fallback Kiwi/Google Flights). On part sur 2 routes
// en parallèle (1 batch unique) ≈ 30-45 s. Si tu passes Pro et tu mets
// maxDuration=300, tu peux scaler via les env vars.
const ROUTES_PER_RUN = Number(
  process.env.DEMO_SHADOW_ROUTES_PER_RUN ?? '2'
);
const CONCURRENCY = Number(
  process.env.DEMO_SHADOW_CONCURRENCY ?? '2'
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

  // Parallèle par batches de CONCURRENCY (2 par défaut). Sur Hobby, le
  // budget total est 60 s donc on ne peut pas faire séquentiel sur 10
  // routes. Concurrence 2 est un compromis : 4 routes / 2 = 2 batches,
  // chaque batch ~10-15 s côté flights.ts, total ≤ 30 s.
  const results: RouteResult[] = [];
  const SOFT_BUDGET_MS = 50000;
  for (let i = 0; i < routes.length; i += CONCURRENCY) {
    const elapsed = Date.now() - started;
    if (elapsed > SOFT_BUDGET_MS) {
      console.warn(
        '[demo-shadow-sweep] soft budget reached, skipping remaining routes',
        { elapsed_ms: elapsed, remaining: routes.length - i }
      );
      break;
    }
    const batch = routes.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map((r) => scanOne(r, now))
    );
    for (const s of settled) {
      if (s.status === 'fulfilled') {
        results.push(s.value);
        console.log('[demo-shadow-sweep] route done', s.value);
      } else {
        const err = (s.reason as Error)?.message ?? 'rejected';
        console.warn('[demo-shadow-sweep] route rejected', { error: err });
        results.push({
          route: 'unknown',
          ok: false,
          ms: 0,
          error: err,
        });
      }
    }
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
