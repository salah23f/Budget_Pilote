import { NextRequest, NextResponse } from 'next/server';
import { watchMission } from '@/lib/agent/watcher';
import type { Mission } from '@/lib/types';

/**
 * POST /api/agent/v7a-sim-watch
 *
 * Endpoint de test DEV/DEBUG UNIQUEMENT.
 * Construit une mission synthétique en mémoire, appelle directement
 * `watchMission(...)` dessus, et renvoie la prédiction + les champs V7a.
 *
 * Ne persiste RIEN en DB ou filesystem. Ne déclenche AUCUN paiement.
 * Zéro effet utilisateur. Sert uniquement à valider que le chemin
 * watcher → V7a → shadow-log fonctionne en production Vercel quand il
 * n'y a aucune mission réelle active.
 *
 * Auth : Bearer CRON_SECRET (même secret que /api/agent/sweep).
 *
 * Body optionnel :
 *   { origin?: "ATL", destination?: "LAX",
 *     departDate?: "2026-05-24", // ISO date, doit être dans le futur
 *     maxBudgetUsd?: 500, autoBuyThresholdUsd?: 400 }
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const started = Date.now();

  const auth = req.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    auth !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    console.warn('[v7a-sim-watch] 401 unauthorized', {
      has_auth: Boolean(auth),
      cron_secret_configured: Boolean(process.env.CRON_SECRET),
    });
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const origin = (body.origin as string) ?? 'ATL';
  const destination = (body.destination as string) ?? 'LAX';
  // Depart date : +30 jours par défaut
  const defaultDepart = new Date(Date.now() + 30 * 86400_000)
    .toISOString()
    .split('T')[0];
  const departDate = (body.departDate as string) ?? defaultDepart;
  const maxBudgetUsd = (body.maxBudgetUsd as number) ?? 500;
  const autoBuyThresholdUsd = (body.autoBuyThresholdUsd as number) ?? 400;

  const nowIso = new Date().toISOString();
  const mission: Mission = {
    id: `sim-${Date.now()}`,
    userId: 'sim-user',
    type: 'flight',
    origin,
    destination,
    departDate,
    passengers: 1,
    maxBudgetUsd,
    autoBuyThresholdUsd,
    cabinClass: 'economy',
    cabinBagRequired: false,
    stopsPreference: 'any',
    preferredAirlines: [],
    ecoPreference: 'balanced',
    monitoringEnabled: true,
    alertEmailEnabled: false,
    status: 'monitoring',
    budgetDepositedUsd: maxBudgetUsd,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  let watchResult: unknown = null;
  let watchError: string | null = null;
  try {
    watchResult = await watchMission(mission);
  } catch (e) {
    watchError = (e as Error)?.message ?? 'watchMission failed';
    console.error('[v7a-sim-watch] watchMission threw', { error: watchError });
  }

  const ms = Date.now() - started;

  console.log('[v7a-sim-watch]', {
    ms,
    mission_id: mission.id,
    route: `${origin}-${destination}`,
    depart: departDate,
    algo_version: process.env.FLYEAS_ALGO_VERSION ?? 'v1',
    watch_ok: watchError === null,
    has_error: Boolean(watchError),
  });

  return NextResponse.json({
    ok: watchError === null,
    env: {
      flyeas_algo_version: process.env.FLYEAS_ALGO_VERSION ?? null,
      flyeas_autobuy_enabled: process.env.FLYEAS_AUTOBUY_ENABLED ?? null,
      modal_v7a_url_set: Boolean(process.env.MODAL_V7A_URL),
      modal_v7a_secret_set: Boolean(process.env.MODAL_V7A_SECRET),
    },
    mission,
    watch_result: watchResult,
    watch_error: watchError,
    ms,
  });
}
