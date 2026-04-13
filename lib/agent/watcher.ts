/**
 * The Watcher — single entrypoint for "look at a mission, record the
 * current market, and decide what to do about it".
 *
 * This is the only place in the codebase that should call searchFlights()
 * on behalf of an active mission. Everything else (cron, on-demand refresh,
 * frontend "check now" button) goes through watchMission().
 *
 * Flow:
 *   1. Run a flight search for the mission's parameters
 *   2. Apply mission filters (stops, airlines)
 *   3. Record a PriceSample into the route's time-series history
 *   4. Pull the route's baseline window
 *   5. Run the predictor
 *   6. Return the observation + prediction to the caller
 *
 * The caller decides whether to fire an auto-buy, create a proposal,
 * or just update the mission — we don't touch Stripe/escrow here. That
 * separation is intentional: the watcher is READ-only on payment state,
 * which makes it safe to call from anywhere (including public endpoints).
 */

import { searchFlights } from '../amadeus/flights';
import {
  recordSample,
  getSamples,
  getSamplesForWindow,
  routeKey,
  type PriceSample,
} from './price-history';
import { predict, type Prediction } from './predictor';
import type { Mission, Offer } from '../types';

export interface WatchResult {
  /** ISO timestamp when the scan ran */
  checkedAt: string;
  /** Route identifier used for history storage */
  routeKey: string;
  /** Cheapest offer observed */
  cheapest: Offer | null;
  /** Number of offers returned by the provider (before filtering) */
  offerCount: number;
  /** Offers after applying mission filters */
  filteredCount: number;
  /** Prediction from the statistical engine */
  prediction: Prediction | null;
  /** Whether this observation was recorded into the time-series store */
  recorded: boolean;
  /** Error that prevented the scan from completing, if any */
  error?: string;
}

export async function watchMission(mission: Mission): Promise<WatchResult> {
  const checkedAt = new Date().toISOString();
  const key = routeKey({
    origin: mission.origin,
    destination: mission.destination,
    cabinClass: mission.cabinClass,
    adults: mission.passengers,
  });

  try {
    const offers = await searchFlights({
      origin: mission.origin,
      destination: mission.destination,
      departDate: mission.departDate,
      returnDate: mission.returnDate,
      adults: mission.passengers,
      cabinClass: mission.cabinClass,
      nonStop: mission.stopsPreference === 'nonstop',
    });

    if (!offers || offers.length === 0) {
      return {
        checkedAt,
        routeKey: key,
        cheapest: null,
        offerCount: 0,
        filteredCount: 0,
        prediction: null,
        recorded: false,
      };
    }

    // Apply mission filters
    let filtered = offers;
    if (mission.stopsPreference === 'nonstop') {
      filtered = filtered.filter((o) => (o.stops || 0) === 0);
    } else if (mission.stopsPreference === 'max1') {
      filtered = filtered.filter((o) => (o.stops || 0) <= 1);
    }
    if (mission.preferredAirlines && mission.preferredAirlines.length > 0) {
      const allow = new Set(
        mission.preferredAirlines.map((a) => a.toLowerCase())
      );
      const pref = filtered.filter((o) =>
        allow.has((o.airline || '').toLowerCase())
      );
      if (pref.length > 0) filtered = pref;
    }
    filtered.sort((a, b) => a.priceUsd - b.priceUsd);

    if (filtered.length === 0) {
      return {
        checkedAt,
        routeKey: key,
        cheapest: null,
        offerCount: offers.length,
        filteredCount: 0,
        prediction: null,
        recorded: false,
      };
    }

    const cheapest = filtered[0];

    // --- Record the sample into the time-series store -----------
    const daysUntilDeparture = Math.max(
      0,
      Math.ceil(
        (new Date(mission.departDate).getTime() - Date.now()) /
          (24 * 60 * 60 * 1000)
      )
    );

    const sample: PriceSample = {
      checkedAt,
      departDate: mission.departDate,
      returnDate: mission.returnDate,
      daysUntilDeparture,
      priceUsd: cheapest.priceUsd,
      secondPrice: filtered[1]?.priceUsd,
      medianPrice:
        filtered.length >= 5
          ? filtered[Math.floor(filtered.length / 2)].priceUsd
          : undefined,
      offerCount: filtered.length,
      airline: cheapest.airline,
      source: cheapest.source,
    };

    await recordSample(
      {
        origin: mission.origin,
        destination: mission.destination,
        cabinClass: mission.cabinClass,
        adults: mission.passengers,
      },
      sample
    );

    // --- Run the predictor --------------------------------------
    const windowSamples = await getSamplesForWindow(
      {
        origin: mission.origin,
        destination: mission.destination,
        cabinClass: mission.cabinClass,
        adults: mission.passengers,
      },
      daysUntilDeparture,
      14 // ±2 weeks bucket tolerance
    );
    const allSamples = await getSamples({
      origin: mission.origin,
      destination: mission.destination,
      cabinClass: mission.cabinClass,
      adults: mission.passengers,
    });

    const prediction = predict({
      currentPrice: cheapest.priceUsd,
      daysUntilDeparture,
      windowSamples,
      allSamples,
    });

    return {
      checkedAt,
      routeKey: key,
      cheapest,
      offerCount: offers.length,
      filteredCount: filtered.length,
      prediction,
      recorded: true,
    };
  } catch (err: any) {
    console.error('[watcher] scan failed', {
      missionId: mission.id,
      error: err?.message,
    });
    return {
      checkedAt,
      routeKey: key,
      cheapest: null,
      offerCount: 0,
      filteredCount: 0,
      prediction: null,
      recorded: false,
      error: err?.message || 'scan failed',
    };
  }
}
