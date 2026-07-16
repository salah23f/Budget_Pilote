import 'server-only';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { getAuthedUser } from '@/lib/supabase-server';
import { getMission } from '@/lib/store/missions-db';
import type { Mission } from '@/lib/types';

/**
 * Shared authorization guards for API route handlers.
 *
 * Usage:
 *   const auth = await requireUser();
 *   if (!auth.ok) return auth.response;   // 401
 *   // auth.user is the verified caller
 *
 *   const owned = await requireMissionOwner(missionId);
 *   if (!owned.ok) return owned.response; // 401 or 404
 *   // owned.mission belongs to owned.user
 */

export type AuthOk = { ok: true; user: User };
export type AuthFail = { ok: false; response: NextResponse };
export type AuthResult = AuthOk | AuthFail;

export async function requireUser(): Promise<AuthResult> {
  const user = await getAuthedUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      ),
    };
  }
  return { ok: true, user };
}

export type OwnerOk = { ok: true; user: User; mission: Mission };
export type OwnerResult = OwnerOk | AuthFail;

export async function requireMissionOwner(
  missionId: string
): Promise<OwnerResult> {
  const auth = await requireUser();
  if (!auth.ok) return auth;

  const mission = await getMission(missionId);
  // Return the SAME 404 whether the mission is missing or simply not the
  // caller's — never confirm existence of another user's mission.
  if (!mission || mission.userId !== auth.user.id) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Mission not found' },
        { status: 404 }
      ),
    };
  }
  return { ok: true, user: auth.user, mission };
}

/**
 * True when the request carries the internal CRON_SECRET bearer token.
 * Fail-closed: if CRON_SECRET is not configured, this is always false.
 */
export function isInternalRequest(authorizationHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return authorizationHeader === `Bearer ${secret}`;
}
