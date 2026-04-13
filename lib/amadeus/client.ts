const BASE_URL = 'https://sky-scrapper.p.rapidapi.com/api';

export async function skyGet(path: string, params?: Record<string, string>): Promise<any> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) throw new Error('RAPIDAPI_KEY not configured');

  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v);
    });
  }

  const res = await fetch(url.toString(), {
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'sky-scrapper.p.rapidapi.com',
    },
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status}`);
  }

  return res.json();
}

export async function searchSkyId(query: string): Promise<{ skyId: string; entityId: string; name: string } | null> {
  // Small delay to avoid rate limiting between sequential calls
  await new Promise(r => setTimeout(r, 300));

  const data = await skyGet('/v1/flights/searchAirport', { query, locale: 'en-US' });

  if (!data?.data || data.data.length === 0) return null;

  const item = data.data[0];
  const fp = item.navigation?.relevantFlightParams;

  return {
    skyId: fp?.skyId || item.skyId || query,
    entityId: fp?.entityId || item.entityId || '',
    name: item.presentation?.title || query,
  };
}
