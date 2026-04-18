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
import { searchCars } from '../amadeus/cars';
import {
  recordSample,
  getSamples,
  getSamplesForWindow,
  routeKey,
  type PriceSample,
} from './price-history';
import { predict, type Prediction } from './predictor';
import { predictV7, type EnsembleDecision } from './v7';
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
  /** Best car rental price found (for package missions) */
  bestCarPrice?: number;
  bestCarProvider?: string;
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

    const algoVersion = process.env.FLYEAS_ALGO_VERSION || 'v1';

    let prediction: Prediction;
    let v7Decision: EnsembleDecision | undefined;

    if (algoVersion === 'v7') {
      v7Decision = predictV7({
        currentPrice: cheapest.priceUsd,
        daysUntilDeparture,
        windowSamples,
        allSamples,
        routeKey: rKey,
      });
      // Map V7 → V1 Prediction shape for back-compat
      prediction = {
        action: v7Decision.action,
        confidence: v7Decision.confidence,
        zScore: 0,
        percentile: 50,
        trend: 'unknown',
        trendSlopePerDay: 0,
        daysUntilDeparture,
        expectedSavingsIfWait: v7Decision.expectedSavingsWait,
        probabilityBeaten7d: v7Decision.probBetter7d,
        baseline: null,
        sampleCount: windowSamples.length,
        reason: v7Decision.reason,
        subScores: { zScoreScore: 0, percentileScore: 0, trendScore: 0, ttdScore: 0 },
      };
    } else {
      prediction = predict({
        currentPrice: cheapest.priceUsd,
        daysUntilDeparture,
        windowSamples,
        allSamples,
      });
      // Shadow mode: also run V7 and log
      if (algoVersion === 'shadow') {
        try {
          v7Decision = predictV7({
            currentPrice: cheapest.priceUsd,
            daysUntilDeparture,
            windowSamples,
            allSamples,
            routeKey: rKey,
          });
          console.log('[v7-shadow-watcher]', {
            route: rKey, v1: prediction.action, v7: v7Decision.action,
            agree: prediction.action === v7Decision.action,
            v7Conf: v7Decision.confidence, models: v7Decision.meta.modelsUsed.length,
          });
        } catch (_) {}
      }
    }

    // --- Car rental search (package missions) -------------------
    let bestCarPrice: number | undefined;
    let bestCarProvider: string | undefined;

    if (
      mission.packageIncludes?.includes('car') &&
      mission.carPickupLocation &&
      mission.carPickupDate &&
      mission.carDropoffDate
    ) {
      try {
        const carResults = await searchCars({
          pickupLocation: mission.carPickupLocation,
          pickupDate: mission.carPickupDate,
          dropoffDate: mission.carDropoffDate,
        });

        if (carResults.length > 0) {
          // Filter by car type preference if specified
          let filteredCars = carResults;
          if (mission.carType) {
            const typePref = filteredCars.filter(
              (c) => c.carType.toLowerCase() === mission.carType!.toLowerCase()
            );
            if (typePref.length > 0) filteredCars = typePref;
          }
          // Filter by max daily price if specified
          if (mission.carMaxPerDay && mission.carMaxPerDay > 0) {
            const withinBudget = filteredCars.filter(
              (c) => c.pricePerDay <= mission.carMaxPerDay!
            );
            if (withinBudget.length > 0) filteredCars = withinBudget;
          }

          filteredCars.sort((a, b) => a.priceTotal - b.priceTotal);
          if (filteredCars.length > 0) {
            bestCarPrice = filteredCars[0].priceTotal;
            bestCarProvider = filteredCars[0].provider;
          }
        }
      } catch (carErr: any) {
        console.warn('[watcher] car search failed', {
          missionId: mission.id,
          error: carErr?.message,
        });
      }
    }

    return {
      checkedAt,
      routeKey: key,
      cheapest,
      offerCount: offers.length,
      filteredCount: filtered.length,
      prediction,
      recorded: true,
      bestCarPrice,
      bestCarProvider,
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
