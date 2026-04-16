import { NextRequest, NextResponse } from 'next/server';
import type { BehaviorEvent } from '@/lib/algorithm/types';

/**
 * POST /api/events — ingest a batch of behavior events.
 *
 * Body: { events: BehaviorEvent[] }
 *
 * Storage: best-effort to Supabase `behavior_events` table. If Supabase is
 * not configured, logs + returns 204 so the client queue clears.
 *
 * This endpoint is intentionally permissive (no auth required) so that
 * anonymous browser sessions can contribute signals via deviceId. Events
 * carrying a userId require that userId to match the authenticated session
 * (not yet enforced here — wire in the auth check once Supabase sessions
 * are consumed server-side).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

function sanitize(e: unknown): BehaviorEvent | null {
  if (!e || typeof e !== 'object') return null;
  const obj = e as Record<string, unknown>;
  if (typeof obj.kind !== 'string') return null;
  if (typeof obj.deviceId !== 'string' || obj.deviceId.length === 0) return null;
  if (typeof obj.ts !== 'number' || !Number.isFinite(obj.ts)) return null;
  const allowed = new Set([
    'impression', 'click', 'save', 'dismiss', 'book', 'abandon', 'widen_applied',
  ]);
  if (!allowed.has(obj.kind)) return null;

  // Cap future timestamps (skew protection) and stale ones
  const now = Date.now();
  if (obj.ts > now + 60_000) return null;
  if (obj.ts < now - 7 * 86_400_000) return null;

  return {
    userId: typeof obj.userId === 'string' ? obj.userId : undefined,
    deviceId: obj.deviceId as string,
    ts: obj.ts as number,
    kind: obj.kind as BehaviorEvent['kind'],
    watchId: typeof obj.watchId === 'string' ? obj.watchId : undefined,
    offerFeatures: typeof obj.offerFeatures === 'object' ? (obj.offerFeatures as any) : undefined,
    contextFeatures: typeof obj.contextFeatures === 'object' ? (obj.contextFeatures as any) : undefined,
  };
}

async function persistEvents(events: BehaviorEvent[]): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey || events.length === 0) return;

  try {
    // Lazy import — if @supabase/supabase-js isn't configured, skip
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const rows = events.map((e) => ({
      user_id: e.userId ?? null,
      device_id: e.deviceId,
      ts: new Date(e.ts).toISOString(),
      kind: e.kind,
      watch_id: e.watchId ?? null,
      offer_features: e.offerFeatures ?? null,
      context_features: e.contextFeatures ?? null,
    }));

    // Table may not exist yet — errors are swallowed below.
    await supabase.from('behavior_events').insert(rows);
  } catch (err) {
    // Do not leak — treat persistence as best-effort
    console.warn('[events] persist failed:', (err as Error).message);
  }
}

export async function POST(req: NextRequest) {
  let body: { events?: unknown };
  try {
    body = await req.json();
  } catch (_) {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const rawEvents = Array.isArray(body.events) ? body.events : [];
  const events = rawEvents
    .map(sanitize)
    .filter((e): e is BehaviorEvent => e !== null)
    .slice(0, 100); // cap per-batch

  if (events.length === 0) {
    return NextResponse.json({ ok: true, accepted: 0 });
  }

  // Fire-and-forget persistence
  void persistEvents(events);

  return NextResponse.json({ ok: true, accepted: events.length });
}
