import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Cookie-backed Supabase client for the SERVER (Route Handlers / Server
 * Components). Reads the session from the request cookies that
 * `middleware.ts` keeps refreshed, so `auth.getUser()` can validate the
 * caller's identity against the Supabase Auth server.
 *
 * Returns null when Supabase env is not configured (local dev without a
 * project) — callers must treat that as "no authenticated user".
 */
export function getServerSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  const cookieStore = cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a read-only context (Server Component). The
          // middleware is responsible for persisting refreshed cookies,
          // so it's safe to ignore here.
        }
      },
    },
  });
}

/**
 * The authenticated user for the current request, or null.
 *
 * IMPORTANT: uses `auth.getUser()` (not `getSession()`) so the access
 * token is verified against the Supabase Auth server on every call — a
 * forged/expired cookie cannot impersonate a user.
 */
export async function getAuthedUser(): Promise<User | null> {
  const sb = getServerSupabase();
  if (!sb) return null;
  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}
