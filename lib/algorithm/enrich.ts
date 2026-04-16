/**
 * Enrichment Layer — turn raw offers into rich EnrichedCandidates.
 *
 * This is the separation of concerns between "facts about offers" and
 * "how we score them". Scoring consumes features; it does not recompute.
 */

import type {
  CandidateFeatures,
  EnrichedCandidate,
  FusedIntent,
  OfferFeatures,
  PriceBaseline,
  UserTravelProfile,
} from './types';

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/* ── Public API ─────────────────────────────────────── */

export interface EnrichInput {
  offerId: string;
  offer: OfferFeatures;
  baseline: PriceBaseline | null;
  profile: UserTravelProfile | null;
  fusedIntent: FusedIntent;
  destinationKey: string;
  sourceExpansion: CandidateFeatures['sourceExpansion'];
  tripDurationDays?: number;
  hotelFeatures?: {
    stars: number;
    guestRating: number;
    pricePerNight: number;
    medianNightlyInMarket?: number;
    locationScore?: number; // 0..1
  };
  bundlePrice?: number;
  separatePrice?: number;
}

export function enrichCandidate(input: EnrichInput): EnrichedCandidate {
  const features = extractFeatures(input);
  return {
    offerId: input.offerId,
    raw: input.offer,
    features,
    sourceExpansion: input.sourceExpansion,
  };
}

/* ── Feature extraction ─────────────────────────────── */

function extractFeatures(input: EnrichInput): CandidateFeatures {
  const { offer, baseline, profile, fusedIntent, destinationKey, sourceExpansion, tripDurationDays, hotelFeatures, bundlePrice, separatePrice } = input;

  // Price features
  const priceUsd = offer.priceUsd;
  const priceVsRouteMedian = baseline ? priceUsd / Math.max(1, baseline.median) : 1;
  const userTypicalBudget = profile?.typicalTripBudgetUsd?.median ?? 0;
  const priceVsUserTypical = userTypicalBudget > 0 ? priceUsd / userTypicalBudget : 1;
  const priceVsBudget = fusedIntent.effective.budgetUsd
    ? priceUsd / fusedIntent.effective.budgetUsd
    : 1;
  const priceValueZ = baseline && baseline.p75 - baseline.p25 > 0
    ? (baseline.median - priceUsd) / (baseline.p75 - baseline.p25)
    : 0;

  // Convenience features
  const stops = offer.stops;
  const durationMin = offer.durationMinutes;
  const layoverQuality = offer.layoverQuality ?? (stops === 0 ? 1 : 0.6);
  const depHour = safeHour(offer.departureTime);
  const redEye = depHour < 6 || depHour >= 22;
  const weekendTravel = isWeekendIso(offer.departureTime);

  const originAirportBurden = offer.inAirportSet ? 0 : 0.5;
  const destAirportBurden = offer.inAirportSet ? 0 : 0.3;

  // Trust
  const baselineDataPoints = baseline?.dataPoints ?? 0;
  const baselineAgeDays = baseline?.ageDays ?? 999;
  const sourceDiversity = baseline?.sourceDiversity ?? 0;
  const partnerReliability = 0.8; // placeholder — filled by connector
  const refundability = offer.cancelPolicy ?? 'none';
  const baggageIncluded = offer.baggageIncluded;

  // Fit signals
  const airlineAffinity = profile?.airlines[offer.airline]?.value ?? 0.5;
  const cabinAffinity = profile?.cabins[offer.cabin]?.value ?? 0.5;
  const timeAffinity = profile?.departureTimes[timeBucket(depHour)]?.value ?? 0.5;
  const destAffinity = profile?.destinations[destinationKey]?.value ?? 0.5;
  const seasonAffinity = profile?.seasonAffinity[seasonFromIso(offer.departureTime)]?.value ?? 0.5;
  const durationAffinity = tripDurationDays != null && profile?.typicalDurationDays?.n
    ? gaussianFit(tripDurationDays, profile.typicalDurationDays)
    : 0.5;
  const leadTimeAffinity = profile?.typicalLeadDays?.n
    ? gaussianFit(daysFromNow(offer.departureTime), profile.typicalLeadDays)
    : 0.5;

  // Regret-risk primitives
  const compromises: number[] = [];
  if (stops >= 2) compromises.push(1);
  if (redEye) compromises.push(0.6);
  if (!baggageIncluded) compromises.push(0.3);
  if (refundability === 'none') compromises.push(0.4);
  if (originAirportBurden > 0) compromises.push(originAirportBurden);
  if (durationMin > 18 * 60) compromises.push(0.5);
  const compromiseCount = compromises.reduce((a, b) => a + b, 0);

  const extremeness = clamp01(Math.abs(priceValueZ) / 3);

  const hiddenCostRisk =
    (!baggageIncluded ? 0.3 : 0) +
    (refundability === 'none' ? 0.3 : refundability === 'partial' ? 0.1 : 0) +
    (stops > 1 && (offer.layoverQuality ?? 0.5) < 0.4 ? 0.4 : 0);

  // Hotel/bundle features (if present)
  let hotelQualityScore: number | undefined;
  let bundleSavingsVsSeparate: number | undefined;
  let budgetAllocationRatio: number | undefined;

  if (hotelFeatures) {
    const starFit = clamp01((hotelFeatures.stars - 2) / 3); // 2* = 0, 5* = 1
    const rating = clamp01((hotelFeatures.guestRating - 6) / 4); // 6 = 0, 10 = 1
    const priceScore = hotelFeatures.medianNightlyInMarket
      ? sigmoid((hotelFeatures.medianNightlyInMarket - hotelFeatures.pricePerNight) / Math.max(1, hotelFeatures.medianNightlyInMarket))
      : 0.6;
    const location = hotelFeatures.locationScore ?? 0.6;
    hotelQualityScore = 0.3 * starFit + 0.25 * rating + 0.25 * priceScore + 0.2 * location;
  }

  if (bundlePrice != null && separatePrice != null && separatePrice > 0) {
    bundleSavingsVsSeparate = clamp01((separatePrice - bundlePrice) / separatePrice);
  }

  if (bundlePrice != null && hotelFeatures && tripDurationDays) {
    const hotelTotal = hotelFeatures.pricePerNight * tripDurationDays;
    const flightPortion = bundlePrice - hotelTotal;
    if (flightPortion > 0) {
      budgetAllocationRatio = flightPortion / bundlePrice;
    }
  }

  return {
    // Price
    priceUsd,
    priceVsRouteMedian,
    priceVsUserTypical,
    priceVsBudget,
    priceValueZ,
    // Convenience
    stops,
    durationMin,
    layoverQuality,
    redEye,
    weekendTravel,
    originAirportBurden,
    destAirportBurden,
    // Trust
    baselineDataPoints,
    baselineAgeDays,
    sourceDiversity,
    partnerReliability,
    refundability,
    baggageIncluded,
    // Fit
    airlineAffinity,
    cabinAffinity,
    timeAffinity,
    destAffinity,
    seasonAffinity,
    durationAffinity,
    leadTimeAffinity,
    // Regret
    compromiseCount,
    extremeness,
    hiddenCostRisk,
    // Trip
    hotelQualityScore,
    bundleSavingsVsSeparate,
    budgetAllocationRatio,
    // Meta
    sourceExpansion,
    destinationKey,
    tripDurationDays,
  };
}

/* ── Small helpers ──────────────────────────────────── */

function safeHour(iso: string): number {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? 12 : d.getHours();
}

function isWeekendIso(iso: string): boolean {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  const day = d.getDay();
  return day === 0 || day === 5 || day === 6;
}

function timeBucket(h: number): 'morning' | 'afternoon' | 'evening' | 'redeye' {
  if (h < 6 || h >= 22) return 'redeye';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function seasonFromIso(iso: string): 'spring' | 'summer' | 'autumn' | 'winter' {
  const d = new Date(iso);
  const m = isNaN(d.getTime()) ? 0 : d.getMonth();
  if (m <= 1 || m === 11) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'autumn';
}

function daysFromNow(iso: string): number {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return 30;
  return Math.max(0, (t - Date.now()) / 86400000);
}

function gaussianFit(value: number, dist: { median: number; stdev: number }): number {
  if (dist.stdev <= 0) return 1;
  const z = Math.abs(value - dist.median) / dist.stdev;
  return clamp01(Math.exp(-0.5 * z * z));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}
