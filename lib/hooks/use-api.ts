import useSWR, { type SWRConfiguration } from 'swr';

/* ------------------------------------------------------------------ */
/*  Global fetcher                                                      */
/* ------------------------------------------------------------------ */

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

/* ------------------------------------------------------------------ */
/*  POST fetcher (for search endpoints)                                 */
/* ------------------------------------------------------------------ */

async function postFetcher<T>(key: string): Promise<T> {
  const [url, bodyStr] = key.split('::BODY::');
  const body = bodyStr ? JSON.parse(bodyStr) : undefined;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

/* ------------------------------------------------------------------ */
/*  Hooks                                                               */
/* ------------------------------------------------------------------ */

/**
 * GET request with SWR caching, deduplication, and revalidation.
 * Usage: const { data, error, isLoading } = useAPI('/api/airports?q=paris')
 */
export function useAPI<T = any>(url: string | null, config?: SWRConfiguration) {
  return useSWR<T>(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000, // 30s dedup
    ...config,
  });
}

/**
 * POST search with SWR caching.
 * The key includes the body so different payloads are cached separately.
 * Usage: const { data } = useSearchAPI('/api/flights/search', { origin: 'CDG' })
 */
export function useSearchAPI<T = any>(
  url: string | null,
  body: Record<string, any> | null,
  config?: SWRConfiguration
) {
  const key = url && body ? `${url}::BODY::${JSON.stringify(body)}` : null;
  return useSWR<T>(key, postFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000, // 60s dedup for searches
    ...config,
  });
}

/**
 * Airport/location autocomplete with aggressive caching.
 * Results are cached for 5 minutes since airport data rarely changes.
 */
export function useAutocomplete<T = any>(url: string | null) {
  return useSWR<T>(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300_000, // 5 min
    keepPreviousData: true,
  });
}
