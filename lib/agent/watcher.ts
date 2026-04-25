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
import { predictV7aFirst, type EnrichedPrediction } from './v7a';
import type { Mission, Offer } from '../types';

/**
 * V7a shadow logging — envoi non bloquant vers /api/agent/shadow-log.
 * Utilisé en mode `shadow` ou `v7a` pour tracer chaque décision V7a en
 * conditions réelles (évaluation causale prospective). Jamais bloquant.
 */
async function logV7aShadow(
  enriched: EnrichedPrediction,
  mission: Mission,
  cheapestPrice: number,
  ttd: number,
  provider: string | null
): Promise<void> {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret || !enriched.v7a) return;
  try {
    await fetch(`${base}/api/agent/shadow-log`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        missionId: mission.id,
        route: `${mission.origin}-${mission.destination}`,
        price: cheapestPrice,
        ttdDays: ttd,
        engine: enriched.engine,
        // `action` = décision RÉELLE (V1 en shadow mode, V7a en mode 'v7a').
        // `v7a` (jsonb) contient l'opinion V7a complète, dont `v7a.action`.
        // Avant : on logait enriched.v7a.action ici, ce qui rendait
        // action == v7a.action systématiquement et masquait toutes les
        // divergences V1/V7a en shadow mode.
        action: enriched.action,
        // Confidence : on garde la confiance V7a car c'est elle qu'on
        // veut analyser pour le critère go/no-go (la confiance V1 est
        // dérivée de subScores, peu interprétable seule).
        confidence: enriched.v7a.confidence,
        v7a: enriched.v7a,
        provider,
      }),
      // Très court : si le shadow-log endpoint est lent, on ne bloque pas
      // le watcher. Le log est un best-effort, pas un bloc critique.
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    // Swallow — shadow log failure must never impact watcher
  }
}

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

    const algoVersion = (process.env.FLYEAS_ALGO_VERSION || 'v1').toLowerCase();

    let prediction: Prediction;

    // ------------------------------------------------------------------
    // V7a (pivot A) — shadow ou actif
    // ------------------------------------------------------------------
    // Cadre théorique :
    //   - `shadow` : V1 décide, V7a (ensemble_ttd_switch + ml_layer) est
    //                logué pour évaluation causale prospective.
    //   - `v7a`    : V7a décide, V1 est le fallback si Modal injoignable.
    // predictV7aFirst renvoie une Prediction V1-compatible (action mappée),
    // avec un champ v7a optionnel pour logs/UI.
    // ------------------------------------------------------------------
    if (algoVersion === 'shadow' || algoVersion === 'v7a') {
      try {
        const enriched = await predictV7aFirst({
          currentPrice: cheapest.priceUsd,
          daysUntilDeparture,
          windowSamples,
          allSamples,
          origin: mission.origin,
          destination: mission.destination,
          budgetMaxUsd: mission.maxBudgetUsd,
          budgetAutoBuyUsd: mission.autoBuyThresholdUsd,
          autobuyEnabled: process.env.FLYEAS_AUTOBUY_ENABLED === 'true',
          preferenceMatch: 1.0,
          nowIso: checkedAt,
        });
        prediction = enriched;
        // Provider tag — quel upstream a effectivement servi le prix.
        // Sky-Scrapper marque rawData.provider='sky_scrapper', Kiwi='kiwi'.
        // Stocké dans agent_decisions.provider pour analyse comparative.
        const provider =
          (cheapest.rawData as { provider?: string } | undefined)?.provider ??
          null;
        // Log non bloquant — V7a est observé, jamais bloquant pour le watcher
        if (enriched.v7a) {
          void logV7aShadow(
            enriched,
            mission,
            cheapest.priceUsd,
            daysUntilDeparture,
            provider
          );
          console.log('[v7a-shadow-watcher]', {
            route: `${mission.origin}-${mission.destination}`,
            engine: enriched.engine,
            v1_action: algoVersion === 'shadow' ? enriched.action : undefined,
            v7a_action: enriched.v7a.action,
            v7a_source: enriched.v7a.action_source,
            ml_available: enriched.v7a.ml_layer?.ml_available ?? false,
            provider,
          });
        }
      } catch (e) {
        // V7a ne doit JAMAIS casser le watcher → fallback V1 strict
        console.warn('[v7a-shadow-watcher] error → fallback V1', {
          missionId: mission.id,
          err: (e as Error)?.message,
        });
        prediction = predict({
          currentPrice: cheapest.priceUsd,
          daysUntilDeparture,
          windowSamples,
          allSamples,
        });
      }
    } else if (algoVersion === 'v7') {
      // Legacy V7 TS (non entraîné, gardé pour compat historique)
      const v7Decision: EnsembleDecision = predictV7({
        currentPrice: cheapest.priceUsd,
        daysUntilDeparture,
        windowSamples,
        allSamples,
        routeKey: key,
      });
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
      // V1 pur (défaut)
      prediction = predict({
        currentPrice: cheapest.priceUsd,
        daysUntilDeparture,
        windowSamples,
        allSamples,
      });
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
