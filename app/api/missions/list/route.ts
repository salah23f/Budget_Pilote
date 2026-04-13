import { NextResponse } from 'next/server';
import { listMissions } from '@/lib/store/missions-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const started = Date.now();
  try {
    const missions = await listMissions();
    missions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    console.log('[missions/list] ok', { count: missions.length, ms: Date.now() - started });
    return NextResponse.json({ success: true, missions });
  } catch (err: any) {
    console.error('[missions/list] error', { ms: Date.now() - started, error: err?.message });
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to list missions', missions: [] },
      { status: 500 }
    );
  }
}
