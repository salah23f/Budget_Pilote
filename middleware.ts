import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase-middleware';

/**
 * Keeps the Supabase Auth session cookie fresh so the server can read the
 * caller's identity. Deliberately does NOT redirect — guest access to
 * public pages stays intact; authorization lives in the API routes.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on all paths except Next internals and static assets. We keep
     * API routes IN so the session cookie is refreshed for fetch() calls
     * that carry it.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
};
