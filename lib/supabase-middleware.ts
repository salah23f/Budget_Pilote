import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refreshes the Supabase Auth session on every request and writes the
 * rotated tokens back into the response cookies. This is what lets
 * Server Components and Route Handlers read a valid session via
 * `getServerSupabase()`.
 *
 * It does NOT gate access — unauthenticated visitors pass through so
 * that public/guest pages keep working. Authorization is enforced at the
 * (money-moving) API route level.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Touch the user to trigger a token refresh into the response cookies.
  await supabase.auth.getUser();

  return response;
}
