import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 minutes max for scraping cycle

/**
 * POST /api/scraper/run — execute a scraping cycle.
 *
 * Security: requires SCRAPER_SECRET header or query param.
 * Called by: GitHub Actions cron every 4h, or manual trigger.
 *
 * Flow:
 *   1. Verify secret
 *   2. Run scraper (25 routes × 1 date each)
 *   3. Store results in Supabase real_price_samples
 *   4. Log run in scraper_runs
 *   5. Return summary
 */
/**
 * GET /api/scraper/run — diagnostic endpoint (no auth).
 * Tests: env vars, Supabase connectivity, Sky-Scrapper API for one route.
 */
export async function GET(_req: NextRequest) {
  const diag: Record<string, unknown> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      SCRAPER_SECRET: !!process.env.SCRAPER_SECRET,
      RAPIDAPI_KEY: !!process.env.RAPIDAPI_KEY,
      SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_SERVICE_KEY_LENGTH: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').length,
    },
  };

  // Test 1: Supabase connectivity
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && supabaseKey) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

      // Try inserting a test row into scraper_runs
      const { data, error } = await sb.from('scraper_runs').insert({
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        routes_attempted: 0,
        routes_succeeded: 0,
        routes_failed: 0,
        total_flights: 0,
        cheapest_overall: null,
      }).select('id').single();

      diag.supabase_test = error
        ? { ok: false, error: error.message, code: error.code, details: error.details, hint: error.hint }
        : { ok: true, insertedId: data?.id };
    } catch (err: unknown) {
      diag.supabase_test = { ok: false, exception: (err as Error)?.message };
    }
  } else {
    diag.supabase_test = { ok: false, reason: 'missing_env_vars' };
  }

  // Test 2: Sky-Scrapper API — search airport for "Paris"
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  if (rapidApiKey) {
    try {
      const airportRes = await fetch(
        'https://sky-scrapper.p.rapidapi.com/api/v1/flights/searchAirport?query=paris&locale=en-US',
        {
          headers: {
            'x-rapidapi-key': rapidApiKey,
            'x-rapidapi-host': 'sky-scrapper.p.rapidapi.com',
          },
        }
      );
      const airportData = await airportRes.json() as any;
      const first = airportData?.data?.[0];

      diag.skyscrapper_airport = {
        status: airportRes.status,
        found: !!first,
        skyId: first?.skyId,
        entityId: first?.entityId,
        name: first?.presentation?.suggestionTitle,
      };

      // If airport found, try a flight search
      if (first?.skyId && first?.entityId) {
        const date = new Date();
        date.setDate(date.getDate() + 45);
        const departDate = date.toISOString().split('T')[0];

        const flightRes = await fetch(
          `https://sky-scrapper.p.rapidapi.com/api/v1/flights/searchFlights?originSkyId=${first.skyId}&destinationSkyId=NYCA&originEntityId=${first.entityId}&destinationEntityId=27537542&date=${departDate}&adults=1&cabinClass=economy&currency=USD`,
          {
            headers: {
              'x-rapidapi-key': rapidApiKey,
              'x-rapidapi-host': 'sky-scrapper.p.rapidapi.com',
            },
          }
        );
        const flightData = await flightRes.json() as any;
        const itineraries = flightData?.data?.itineraries ?? [];

        diag.skyscrapper_flights = {
          status: flightRes.status,
          itineraryCount: itineraries.length,
          firstPrice: itineraries[0]?.price?.raw,
          firstAirline: itineraries[0]?.legs?.[0]?.carriers?.marketing?.[0]?.name,
          responseKeys: Object.keys(flightData?.data ?? {}),
          rawSample: itineraries.length > 0
            ? JSON.stringify(itineraries[0]).slice(0, 500)
            : JSON.stringify(flightData).slice(0, 500),
        };
      }
    } catch (err: unknown) {
      diag.skyscrapper_test = { ok: false, exception: (err as Error)?.message };
    }
  }

  return NextResponse.json(diag);
}

export async function POST(req: NextRequest) {
  const secret = process.env.SCRAPER_SECRET;
  if (!secret) {
    console.warn('[scraper/run] SCRAPER_SECRET not set in env');
    return NextResponse.json({ error: 'SCRAPER_SECRET not configured' }, { status: 500 });
  }

  // Verify auth — trim whitespace from both sides to handle newline in secrets
  const providedSecret = (
    req.headers.get('x-scraper-secret') ??
    req.nextUrl.searchParams.get('secret') ??
    ''
  ).trim();

  const expectedSecret = secret.trim();

  if (providedSecret !== expectedSecret) {
    console.warn('[scraper/run] auth failed', {
      providedLength: providedSecret.length,
      expectedLength: expectedSecret.length,
      match: providedSecret === expectedSecret,
      headerPresent: !!req.headers.get('x-scraper-secret'),
    });
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    // Dynamic import to avoid bundling scraper in client
    const { runScrape } = await import('@/scripts/scraper/core');
    const summary = await runScrape(25, 2000);

    // Store results in Supabase (best effort)
    await storeResults(summary);

    return NextResponse.json({
      ok: true,
      routesAttempted: summary.routesAttempted,
      routesSucceeded: summary.routesSucceeded,
      totalFlights: summary.totalFlights,
      cheapestOverall: summary.cheapestOverall,
      duration: `${Math.round((new Date(summary.completedAt).getTime() - new Date(summary.startedAt).getTime()) / 1000)}s`,
      quotaStatus: summary.quotaStatus,
    });
  } catch (err: unknown) {
    console.error('[scraper/run] error:', (err as Error)?.message);
    return NextResponse.json(
      { error: (err as Error)?.message ?? 'scraper_failed' },
      { status: 500 }
    );
  }
}

async function storeResults(summary: Awaited<ReturnType<typeof import('@/scripts/scraper/core').runScrape>>): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[scraper/store] missing SUPABASE_URL or SERVICE_ROLE_KEY — skipping DB write');
    return;
  }

  console.log(`[scraper/store] attempting DB write: ${summary.totalFlights} flights, ${summary.routesAttempted} routes`);

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    // Always log the run — even if 0 flights
    const runPayload = {
      started_at: summary.startedAt,
      completed_at: summary.completedAt,
      routes_attempted: summary.routesAttempted,
      routes_succeeded: summary.routesSucceeded,
      routes_failed: summary.routesFailed,
      total_flights: summary.totalFlights,
      cheapest_overall: summary.cheapestOverall,
    };

    const { data: runData, error: runError } = await supabase
      .from('scraper_runs')
      .insert(runPayload)
      .select('id')
      .single();

    if (runError) {
      console.error('[scraper/store] scraper_runs INSERT failed:', runError.message, runError.code, runError.details);
    } else {
      console.log(`[scraper/store] scraper_runs INSERT ok, id=${runData?.id}`);
    }

    // Insert flights if any
    if (summary.totalFlights > 0) {
      const rows = summary.results
        .flatMap((r) =>
          r.flights.map((f) => ({
            origin: f.origin,
            destination: f.destination,
            depart_date: f.departDate,
            price_usd: f.priceUsd,
            airline: f.airline,
            stops: f.stops,
            duration_minutes: f.durationMinutes,
            source: f.source,
            fetched_at: f.fetchedAt,
          }))
        )
        .slice(0, 500);

      console.log(`[scraper/store] inserting ${rows.length} price samples...`);

      const { error: flightsError } = await supabase
        .from('real_price_samples')
        .insert(rows);

      if (flightsError) {
        console.error('[scraper/store] real_price_samples INSERT failed:', flightsError.message, flightsError.code, flightsError.details);
      } else {
        console.log(`[scraper/store] real_price_samples INSERT ok: ${rows.length} rows`);
      }
    } else {
      console.log('[scraper/store] no flights to insert (totalFlights=0)');
    }
  } catch (err: unknown) {
    console.error('[scraper/store] unexpected error:', (err as Error)?.message, (err as Error)?.stack?.slice(0, 200));
  }
}
