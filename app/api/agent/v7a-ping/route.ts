import { NextRequest, NextResponse } from 'next/server';
import { callV7a, type V7aPredictInput } from '@/lib/agent/v7a/client';

/**
 * POST /api/agent/v7a-ping
 *
 * Test endpoint — appelle le endpoint V7a Modal depuis Next.js pour vérifier
 * que le chemin TS → Modal fonctionne bout en bout (env vars, client.ts,
 * fetch, response parsing). Bypasse mission/Stripe/watcher.
 *
 * Auth : Bearer CRON_SECRET (même secret que /api/agent/sweep).
 *
 * Body (tous optionnels — defaults testés en prod Modal) :
 *   { origin?: "ATL", destination?: "LAX", ttd_days?: 30,
 *     current_price?: 180, price_history?: [...] }
 *
 * Renvoie :
 *   { ok: true, env: { modal_v7a_url_set, modal_v7a_secret_set },
 *     v7a: <réponse endpoint Modal> | null, ms }
 *
 * Utilisation UNIQUEMENT en shadow mode / debug. À retirer ou gater plus
 * strictement une fois V7a validé et activé en prod.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const started = Date.now();

  const auth = req.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    auth !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    console.warn('[v7a-ping] 401 unauthorized', {
      has_auth_header: Boolean(auth),
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

  const input: V7aPredictInput = {
    origin: (body.origin as string) ?? 'ATL',
    destination: (body.destination as string) ?? 'LAX',
    ttd_days: (body.ttd_days as number) ?? 30,
    current_price: (body.current_price as number) ?? 180,
    fetched_at: new Date().toISOString(),
    price_history: (body.price_history as
      | { fetched_at: string; price_usd: number }[]
      | undefined) ?? [],
    budget_max: (body.budget_max as number) ?? 500,
    budget_autobuy: (body.budget_autobuy as number) ?? 450,
    autobuy_enabled: (body.autobuy_enabled as boolean) ?? false,
  };

  const env = {
    modal_v7a_url_set: Boolean(process.env.MODAL_V7A_URL),
    modal_v7a_url_host: process.env.MODAL_V7A_URL
      ? new URL(process.env.MODAL_V7A_URL).host
      : null,
    modal_v7a_secret_set: Boolean(process.env.MODAL_V7A_SECRET),
    flyeas_algo_version: process.env.FLYEAS_ALGO_VERSION ?? null,
    flyeas_autobuy_enabled: process.env.FLYEAS_AUTOBUY_ENABLED ?? null,
  };

  const v7a = await callV7a(input, { timeoutMs: 5000 });
  const ms = Date.now() - started;

  console.log('[v7a-ping]', {
    ms,
    route: `${input.origin}-${input.destination}`,
    ttd: input.ttd_days,
    price: input.current_price,
    env,
    v7a_ok: v7a !== null,
    v7a_action: v7a?.action ?? null,
    v7a_route_known: v7a?.route_known ?? null,
  });

  return NextResponse.json({
    ok: true,
    env,
    input,
    v7a,
    ms,
  });
}
