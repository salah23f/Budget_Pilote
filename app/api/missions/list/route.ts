import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guard';
import { listMissions } from '@/lib/store/missions-db';
import type { Mission } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * This endpoint is currently UNAUTHENTICATED and returns every mission,
 * so it must never leak sensitive data. We project each mission down to
 * only the non-sensitive fields the dashboard renders — no userId, no
 * payment identifiers/secrets, no wallet addresses, no contact info.
 * (Per-user scoping still needs to be added once auth is enforced — see
 * docs/audit/.)
 */
function toListMission(m: Mission) {
  return {
    id: m.id,
    status: m.status,
    type: m.type,
    origin: m.origin,
    originCity: m.originCity,
    destination: m.destination,
    destinationCity: m.destinationCity,
    departDate: m.departDate,
    returnDate: m.returnDate,
    passengers: m.passengers,
    cabinClass: m.cabinClass,
    maxBudgetUsd: m.maxBudgetUsd,
    bestSeenPrice: m.bestSeenPrice,
    lastCheckedAt: m.lastCheckedAt,
    paymentRail: m.paymentRail,
    createdAt: m.createdAt,
  };
}

export async function GET() {
  const started = Date.now();
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  try {
    // Scoped to the caller — never return another user's missions.
    const missions = await listMissions(auth.user.id);
    missions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    console.log('[missions/list] ok', { count: missions.length, ms: Date.now() - started });
    return NextResponse.json({ success: true, missions: missions.map(toListMission) });
  } catch (err: any) {
    console.error('[missions/list] error', { ms: Date.now() - started, error: err?.message });
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to list missions', missions: [] },
      { status: 500 }
    );
  }
}
