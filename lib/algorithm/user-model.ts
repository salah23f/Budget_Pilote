/**
 * User Model Layer — the persistent travel preference brain.
 *
 * Responsibilities:
 *   1. Construct neutral profiles for cold-start users.
 *   2. Update affinities + persona dimensions from behavior events.
 *   3. Apply time decay nightly (or on read).
 *   4. Compute dataRichness & cohort from observation history.
 *
 * Core principles:
 *   - Asymmetric learning: positives (book, save) update 3x harder than negatives.
 *   - Confidence grows with consistency, not volume.
 *   - Shrinkage to neutral when data is sparse.
 *   - Short-term (session) and long-term (profile) memory are separate.
 */

import type {
  AffinityScore,
  BehaviorEvent,
  CabinClass,
  UserCohort,
  UserTravelProfile,
} from './types';

/* ── Constants ────────────────────────────────────────── */

/** Half-life for affinity decay in days. */
const DECAY_HALF_LIFE_DAYS = 120;

/** Maximum per-event movement for any persona dimension (anti-overfit). */
const MAX_STEP_PER_EVENT = 0.05;

/** Events below this threshold do not update sensitive persona dimensions. */
const MIN_OBSERVATIONS_FOR_PERSONA = 10;

/* ── Event weights ────────────────────────────────────── */

const EVENT_WEIGHTS: Record<BehaviorEvent['kind'], number> = {
  book: 1.0,
  save: 0.5,
  click: 0.15,
  impression: 0.02,
  dismiss: -0.2,
  abandon: -0.3,
  widen_applied: 0.1,
};

/* ── Helpers ──────────────────────────────────────────── */

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

export function neutral(): AffinityScore {
  return { value: 0.5, confidence: 0, lastUpdatedAt: Date.now() };
}

function daysBetween(a: number, b: number): number {
  return Math.max(0, (b - a) / 86400000);
}

/* ── Profile construction ─────────────────────────────── */

export function createNeutralProfile(userId: string, deviceId: string): UserTravelProfile {
  const now = Date.now();
  return {
    userId,
    deviceId,
    firstSeenAt: now,
    lastActiveAt: now,
    dataRichness: 0,
    observationCount: 0,
    cohort: 'newcomer',
    priceSensitivity: neutral(),
    convenienceSensitivity: neutral(),
    certaintySensitivity: neutral(),
    hotelSensitivity: neutral(),
    explorationVsFamiliar: neutral(),
    spontaneityVsPlanning: neutral(),
    aspirationGap: neutral(),
    typicalTripBudgetUsd: { median: 0, p25: 0, p75: 0, confidence: 0 },
    budgetPerRoute: {},
    typicalLeadDays: { median: 30, stdev: 30, n: 0 },
    typicalDurationDays: { median: 5, stdev: 3, n: 0 },
    seasonAffinity: {
      spring: neutral(),
      summer: neutral(),
      autumn: neutral(),
      winter: neutral(),
    },
    destinations: {},
    destinationFatigue: {},
    destinationsSavedNotBooked: {},
    airlines: {},
    cabins: {
      economy: neutral(),
      premium_economy: neutral(),
      business: neutral(),
      first: neutral(),
    },
    departureTimes: {
      morning: neutral(),
      afternoon: neutral(),
      evening: neutral(),
      redeye: neutral(),
    },
    preferredOriginRegions: [],
    preferredDestRegions: [],
  };
}

/* ── Update primitives ────────────────────────────────── */

/**
 * Bayesian-flavored affinity update. New observation with direction (0..1)
 * and weight moves the value toward it, with learning rate scaled by the
 * current confidence (low confidence → larger moves).
 */
export function updateAffinity(
  current: AffinityScore,
  direction: number,
  weight: number,
  now: number = Date.now()
): AffinityScore {
  const w = Math.max(-1, Math.min(1, weight));
  const learningRate = (1 - current.confidence * 0.7) * Math.min(Math.abs(w), 1);
  const signedRate = w >= 0 ? learningRate : -learningRate;
  const newValue = clamp01(current.value + signedRate * (direction - current.value));
  const newConf = clamp01(current.confidence + 0.02 * Math.abs(w));

  const capped =
    newValue > current.value
      ? Math.min(newValue, current.value + MAX_STEP_PER_EVENT)
      : Math.max(newValue, current.value - MAX_STEP_PER_EVENT);

  return {
    value: capped,
    confidence: newConf,
    lastUpdatedAt: now,
  };
}

/**
 * Apply exponential recency decay toward neutral (0.5 for persona,
 * a nearby reference for destination maps).
 */
export function decay(score: AffinityScore, now: number = Date.now()): AffinityScore {
  const days = daysBetween(score.lastUpdatedAt, now);
  if (days < 1) return score;
  const factor = Math.pow(0.5, days / DECAY_HALF_LIFE_DAYS);
  return {
    value: 0.5 + (score.value - 0.5) * factor,
    confidence: clamp01(score.confidence * factor),
    lastUpdatedAt: score.lastUpdatedAt,
  };
}

/* ── Event ingestion ──────────────────────────────────── */

function inferTimeBucket(iso: string | undefined): 'morning' | 'afternoon' | 'evening' | 'redeye' {
  if (!iso) return 'morning';
  const d = new Date(iso);
  const h = isNaN(d.getTime()) ? 12 : d.getHours();
  if (h < 6 || h >= 22) return 'redeye';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

/**
 * Apply one event to the profile. Returns a new profile (immutable).
 *
 * The "direction" for persona dimensions is implicit in the event:
 *   - dismissing a premium option → convenienceSensitivity ↓ slightly
 *   - saving a red-eye → priceSensitivity ↑
 *   - booking a 4-star hotel bundle → hotelSensitivity ↑ significantly
 */
export function applyEvent(
  profile: UserTravelProfile,
  event: BehaviorEvent
): UserTravelProfile {
  const w = EVENT_WEIGHTS[event.kind];
  if (w === undefined) return profile;

  const next: UserTravelProfile = structuredClone(profile);
  next.observationCount += 1;
  next.lastActiveAt = event.ts;

  const feat = event.offerFeatures;
  const ctx = event.contextFeatures;

  // Entity affinities (destinations, airlines, cabins, times)
  if (feat?.airline) {
    const cur = next.airlines[feat.airline] ?? neutral();
    next.airlines[feat.airline] = updateAffinity(cur, w > 0 ? 1 : 0, Math.abs(w), event.ts);
  }

  if (feat?.cabin) {
    const cabin = feat.cabin as CabinClass;
    next.cabins[cabin] = updateAffinity(
      next.cabins[cabin] ?? neutral(),
      w > 0 ? 1 : 0,
      Math.abs(w),
      event.ts
    );
  }

  if (feat?.departureTime) {
    const bucket = inferTimeBucket(feat.departureTime);
    next.departureTimes[bucket] = updateAffinity(
      next.departureTimes[bucket] ?? neutral(),
      w > 0 ? 1 : 0,
      Math.abs(w),
      event.ts
    );
  }

  // Persona updates — only when we have enough observations to avoid overfitting
  if (next.observationCount >= MIN_OBSERVATIONS_FOR_PERSONA) {
    // Price sensitivity: booked/saved cheap offers push sensitivity up;
    // booked premium cabin or high price vs typical pushes it down.
    if ((event.kind === 'book' || event.kind === 'save') && feat?.priceUsd != null) {
      const cheapSignal = typeof ctx?.budgetTightness === 'number' ? ctx.budgetTightness : 0.5;
      next.priceSensitivity = updateAffinity(
        next.priceSensitivity,
        cheapSignal,
        Math.abs(w) * 0.3,
        event.ts
      );
    }

    // Convenience sensitivity: book with stops > 0 slightly lowers conv sensitivity;
    // dismissing multi-stops raises it.
    if (feat?.stops != null) {
      if (event.kind === 'book' || event.kind === 'save') {
        next.convenienceSensitivity = updateAffinity(
          next.convenienceSensitivity,
          feat.stops === 0 ? 0.7 : 0.3,
          Math.abs(w) * 0.3,
          event.ts
        );
      } else if (event.kind === 'dismiss' && feat.stops > 0) {
        next.convenienceSensitivity = updateAffinity(
          next.convenienceSensitivity,
          0.8,
          0.3,
          event.ts
        );
      }
    }

    // Hotel sensitivity: any event with hotel features inside a bundle
    // increases hotelSensitivity; flight-only bookings with no hotel interest decrease it.
    if (event.kind === 'book' || event.kind === 'save') {
      // If the event was about a bundle (contextFeatures flag), bump hotelSensitivity
      if ((ctx as any)?.wasBundle === true) {
        next.hotelSensitivity = updateAffinity(next.hotelSensitivity, 0.75, Math.abs(w) * 0.4, event.ts);
      } else {
        next.hotelSensitivity = updateAffinity(next.hotelSensitivity, 0.25, Math.abs(w) * 0.2, event.ts);
      }
    }

    // Widen-applied events → flexibility signal
    if (event.kind === 'widen_applied') {
      next.spontaneityVsPlanning = updateAffinity(next.spontaneityVsPlanning, 0.7, 0.3, event.ts);
    }
  }

  // Meta: richness + cohort
  next.dataRichness = clamp01(next.observationCount / 60);
  next.cohort = inferCohort(next);

  return next;
}

/* ── Cohort inference ─────────────────────────────────── */

export function inferCohort(profile: UserTravelProfile): UserCohort {
  if (profile.observationCount < 5) return 'newcomer';

  const daysSinceActive = daysBetween(profile.lastActiveAt, Date.now());
  if (daysSinceActive > 45) return 'dormant';

  const expl = profile.explorationVsFamiliar.value;
  const spont = profile.spontaneityVsPlanning.value;

  if (expl > 0.7) return 'explorer';
  if (spont < 0.35) return 'planner';
  return 'decisive';
}

/* ── Nightly decay (server-side; idempotent) ──────────── */

export function decayProfile(profile: UserTravelProfile, now: number = Date.now()): UserTravelProfile {
  const next: UserTravelProfile = structuredClone(profile);

  next.priceSensitivity = decay(next.priceSensitivity, now);
  next.convenienceSensitivity = decay(next.convenienceSensitivity, now);
  next.certaintySensitivity = decay(next.certaintySensitivity, now);
  next.hotelSensitivity = decay(next.hotelSensitivity, now);
  next.explorationVsFamiliar = decay(next.explorationVsFamiliar, now);
  next.spontaneityVsPlanning = decay(next.spontaneityVsPlanning, now);
  next.aspirationGap = decay(next.aspirationGap, now);

  for (const key of Object.keys(next.destinations)) {
    next.destinations[key] = decay(next.destinations[key], now);
  }
  for (const key of Object.keys(next.airlines)) {
    next.airlines[key] = decay(next.airlines[key], now);
  }

  for (const bucket of Object.keys(next.departureTimes) as Array<keyof typeof next.departureTimes>) {
    next.departureTimes[bucket] = decay(next.departureTimes[bucket], now);
  }
  for (const c of Object.keys(next.cabins) as Array<keyof typeof next.cabins>) {
    next.cabins[c] = decay(next.cabins[c], now);
  }

  return next;
}

/* ── Persona-shifted weights ──────────────────────────── */

export interface RankingWeights {
  feasibility: number;
  budgetRealism: number;
  flightFit: number;
  hotelFit: number;
  tripFit: number;
  convenience: number;
  preferenceMatch: number;
  confidence: number;
  regretRisk: number; // penalty coefficient
  discovery: number;
  valueForMoney: number;
  aspirationMatch: number;
  timingFit: number;
  conversion: number;
}

export const BASE_WEIGHTS: RankingWeights = {
  feasibility: 0.06,
  budgetRealism: 0.06,
  flightFit: 0.12,
  hotelFit: 0.08,
  tripFit: 0.10,
  convenience: 0.10,
  preferenceMatch: 0.12,
  confidence: 0.08,
  regretRisk: 0.12, // applied as a penalty (1 - regretRisk) in overall formula
  discovery: 0.03,
  valueForMoney: 0.10,
  aspirationMatch: 0.05,
  timingFit: 0.04,
  conversion: 0.08,
};

/**
 * Shift weights by persona. Max ±30% per dim, then renormalize the
 * positive-weighted dims (regretRisk is a fixed penalty, not part of sum).
 */
export function adaptWeights(
  base: RankingWeights,
  profile: UserTravelProfile
): RankingWeights {
  // Cold-start: no shift
  if (profile.dataRichness < 0.2) return { ...base };

  const w: RankingWeights = { ...base };

  const p = profile.priceSensitivity;
  const c = profile.convenienceSensitivity;
  const cert = profile.certaintySensitivity;
  const hot = profile.hotelSensitivity;
  const expl = profile.explorationVsFamiliar;

  // Price-sensitive
  if (p.value > 0.65 && p.confidence > 0.3) {
    w.valueForMoney *= 1.25;
    w.flightFit *= 0.9;
    w.hotelFit *= 0.95;
  }
  // Convenience-sensitive
  if (c.value > 0.65 && c.confidence > 0.3) {
    w.convenience *= 1.3;
    w.regretRisk *= 1.15;
    w.flightFit *= 1.1;
  }
  // Certainty-sensitive
  if (cert.value > 0.65 && cert.confidence > 0.3) {
    w.confidence *= 1.3;
    w.regretRisk *= 1.25;
    w.discovery *= 0.7;
  }
  // Hotel-sensitive → hotelFit + tripFit matter more
  if (hot.value > 0.6 && hot.confidence > 0.3) {
    w.hotelFit *= 1.4;
    w.tripFit *= 1.25;
    w.flightFit *= 0.8;
  }
  // Explorer → discovery + aspiration
  if (expl.value > 0.65 && expl.confidence > 0.3) {
    w.discovery *= 1.5;
    w.aspirationMatch *= 1.3;
    w.preferenceMatch *= 0.85;
  }

  // Renormalize positive-sum portion (all except regretRisk)
  const positiveKeys = Object.keys(w).filter((k) => k !== 'regretRisk') as Array<keyof RankingWeights>;
  const sumPositive = positiveKeys.reduce((acc, k) => acc + w[k], 0);
  const target = Object.keys(base).filter((k) => k !== 'regretRisk').reduce((acc, k) => acc + (base as any)[k], 0);
  const scale = target / Math.max(1e-6, sumPositive);
  for (const k of positiveKeys) w[k] = w[k] * scale;

  return w;
}
