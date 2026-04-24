import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * POST /api/agent/shadow-log
 *
 * Log append-only des décisions V7a en shadow mode.
 * Pas d'exécution, pas de paiement — juste une trace.
 *
 * Deux modes de persistance :
 *   - Supabase si SUPABASE_SERVICE_ROLE_KEY présent (table `agent_decisions`).
 *   - Sinon fallback fichier JSONL `.data/agent_decisions.jsonl` (dev local).
 *
 * Payload attendu :
 *   { missionId: string,
 *     route: string,
 *     price: number,
 *     ttdDays: number,
 *     engine: 'v7a' | 'v1' | 'v7a-fallback-v1',
 *     action: string,
 *     confidence: number,
 *     v7a?: {...},  // payload complet V7aPrediction si dispo
 *     note?: string }
 *
 * Auth : Bearer CRON_SECRET (réutilisé).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const JSONL_PATH = path.join(process.cwd(), '.data', 'agent_decisions.jsonl');

async function writeFallback(entry: Record<string, unknown>): Promise<void> {
  await fs.mkdir(path.dirname(JSONL_PATH), { recursive: true });
  await fs.appendFile(JSONL_PATH, JSON.stringify(entry) + '\n', 'utf-8');
}

async function writeSupabase(
  entry: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, error: 'supabase not configured' };
  try {
    const res = await fetch(`${url}/rest/v1/agent_decisions`, {
      method: 'POST',
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        prefer: 'return=minimal',
      },
      body: JSON.stringify(entry),
    });
    if (!res.ok) return { ok: false, error: `http ${res.status}` };
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: (e as Error)?.message ?? 'fetch failed' };
  }
}

export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid json' }, { status: 400 });
  }

  // Translate camelCase payload → snake_case columns (PostgREST convention).
  // Le watcher envoie `missionId` / `ttdDays` ; la table a `mission_id` /
  // `ttd_days`. Sans translate, Supabase 400 ("column does not exist").
  const entry: Record<string, unknown> = {
    logged_at: new Date().toISOString(),
    mission_id: body.missionId ?? null,
    route: body.route ?? null,
    price: body.price ?? null,
    ttd_days: body.ttdDays ?? null,
    engine: body.engine ?? null,
    action: body.action ?? null,
    confidence: body.confidence ?? null,
    v7a: body.v7a ?? null,
    note: body.note ?? null,
  };

  const sb = await writeSupabase(entry);
  if (!sb.ok) {
    try {
      await writeFallback(entry);
    } catch (e) {
      console.error('[shadow-log] fallback write failed', {
        missionId: (entry as { missionId?: string }).missionId,
        error: (e as Error)?.message,
      });
      return NextResponse.json(
        { success: false, error: 'storage unavailable' },
        { status: 500 }
      );
    }
  }
  console.log('[shadow-log] entry stored', {
    missionId: (entry as { missionId?: string }).missionId,
    action: (entry as { action?: string }).action,
    engine: (entry as { engine?: string }).engine,
    storage: sb.ok ? 'supabase' : 'jsonl',
  });

  return NextResponse.json({ success: true, storage: sb.ok ? 'supabase' : 'jsonl' });
}

export async function GET() {
  return NextResponse.json(
    { success: true, note: 'POST only. See docs/V7A_SHADOW_MODE.md.' },
    { status: 405 }
  );
}
