import { skyGet, searchSkyId } from './client';
import type { Offer, FlightSearchParams, CabinClass } from '../types';

export async function searchFlights(params: FlightSearchParams): Promise<Offer[]> {
  // Sequential calls to avoid rate limiting
  const orig = await searchSkyId(params.origin);
  const dest = await searchSkyId(params.destination);

  if (!orig) throw new Error(`Airport not found: "${params.origin}"`);
  if (!dest) throw new Error(`Airport not found: "${params.destination}"`);

  // Use searchFlights v2 (non-deprecated) instead of searchFlightsComplete
  const data = await skyGet('/v2/flights/searchFlights', {
    originSkyId: orig.skyId,
    destinationSkyId: dest.skyId,
    originEntityId: orig.entityId,
    destinationEntityId: dest.entityId,
    date: params.departDate,
    ...(params.returnDate ? { returnDate: params.returnDate } : {}),
    adults: String(params.adults || 1),
    cabinClass: params.cabinClass || 'economy',
    currency: 'USD',
    market: 'en-US',
    countryCode: 'US',
    sortBy: 'best',
  });

  const itineraries = data?.data?.itineraries;
  if (!itineraries || !Array.isArray(itineraries)) return [];

  return itineraries.slice(0, 20).map((it: any, i: number) => {
    const leg = it.legs?.[0];
    const seg = leg?.segments?.[0];
    const carrier = leg?.carriers?.marketing?.[0] || {};
    const price = it.price?.raw || 0;

    return {
      id: `sky_${it.id || i}`,
      missionId: '',
      source: 'amadeus' as const,
      airline: carrier.name || seg?.marketingCarrier?.name || 'Airline',
      airlineCode: carrier.alternateId || '',
      flightNumber: `${carrier.alternateId || ''}${seg?.flightNumber || ''}`,
      departureTime: leg?.departure || '',
      arrivalTime: leg?.arrival || '',
      durationMinutes: leg?.durationInMinutes || 0,
      stops: leg?.stopCount ?? 0,
      cabinClass: (params.cabinClass || 'economy') as CabinClass,
      baggageIncluded: false,
      priceUsd: typeof price === 'number' ? price : parseFloat(price) || 0,
      originalCurrency: 'USD',
      originalPrice: typeof price === 'number' ? price : parseFloat(price) || 0,
      carbonKg: Math.round((leg?.durationInMinutes || 0) / 60 * 150),
      fetchedAt: new Date().toISOString(),
    };
  });
}
