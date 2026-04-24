import { NextRequest, NextResponse } from 'next/server';
import { getBackendKind, listMissions } from '@/lib/store/missions-db';

/**
 * GET/POST /api/agent/diagnostic
 *
 * Retourne l'état de l'infrastructure V7a — utile pour valider une
 * migration ou debug un shadow mode muet.
 *
 * Sortie :
 *   - missions_db_backend : "supabase" | "json"
 *     → doit être "supabase" en prod. Si "json", le filesystem est
 *       éphémère et les missions ne survivront pas au prochain redeploy.
 *   - missions_total       : total missions persistées
 *   - missions_monitoring  : missions avec monitoring_enabled=true
 *   - env                  : booléens présence env vars critiques
 *   - algo_version         : valeur de FLYEAS_ALGO_VERSION
 *
 * Auth : Bearer CRON_SECRET (pour éviter fingerprinting public).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function runDiagnostic() {
  const backendKind = getBackendKind();

  let missionsTotal = 0;
  let missionsMonitoring = 0;
  let listError: string | null = null;
  try {
    const all = await listMissions();
    missionsTotal = all.length;
    missionsMonitoring = all.filter(
      (m) => m.monitoringEnabled && m.status === 'monitoring'
    ).length;
  } catch (e) {
    listError = (e as Error)?.message ?? 'listMissions failed';
  }

  return {
    ok: listError === null,
    missions_db_backend: backendKind,
    missions_total: missionsTotal,
    missions_monitoring: missionsMonitoring,
    list_error: listError,
    env: {
      supabase_url_set: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      supabase_service_key_set: Boolean(
        process.env.SUPABASE_SERVICE_ROLE_KEY
      ),
      modal_v7a_url_set: Boolean(process.env.MODAL_V7A_URL),
      modal_v7a_secret_set: Boolean(process.env.MODAL_V7A_SECRET),
      cron_secret_set: Boolean(process.env.CRON_SECRET),
      app_url_set: Boolean(process.env.NEXT_PUBLIC_APP_URL),
    },
    algo_version: process.env.FLYEAS_ALGO_VERSION ?? null,
    autobuy_enabled: process.env.FLYEAS_AUTOBUY_ENABLED ?? null,
    now: new Date().toISOString(),
  };
}

function checkAuth(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // pas de secret → pas d'auth (dev local)
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${expected}`;
}

async function handle(req: NextRequest, method: 'GET' | 'POST') {
  if (!checkAuth(req)) {
    console.warn('[diagnostic] 401', {
      method,
      cron_secret_configured: Boolean(process.env.CRON_SECRET),
    });
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 }
    );
  }
  try {
    const result = await runDiagnostic();
    console.log('[diagnostic]', {
      method,
      backend: result.missions_db_backend,
      total: result.missions_total,
      monitoring: result.missions_monitoring,
      algo: result.algo_version,
    });
    return NextResponse.json(result);
  } catch (e) {
    const err = (e as Error)?.message ?? 'diagnostic failed';
    console.error('[diagnostic] error', { method, error: err });
    return NextResponse.json(
      { ok: false, error: err },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return handle(req, 'GET');
}

export async function POST(req: NextRequest) {
  return handle(req, 'POST');
}
