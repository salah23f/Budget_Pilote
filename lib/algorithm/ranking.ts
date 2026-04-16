/**
 * 15-score multi-objective ranking engine.
 *
 * This file is the heart of Flyeas intelligence. Every score has a precise
 * meaning, bounded range [0,1], and consumes only CandidateFeatures + profile
 * + realism. No I/O; pure functions; trivially testable.
 */

import type {
  EnrichedCandidate,
  FusedIntent,
  PriceBaseline,
  RankingScores,
  RealismV2,
  UserTravelProfile,
} from './types';
import { adaptWeights, BASE_WEIGHTS, type RankingWeights } from './user-model';

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

/* ── Score 1: feasibilityScore (inherited from realism) ── */

export function feasibilityScore(r: RealismV2): number {
  return r.feasibilityScore;
}

/* ── Score 2: budgetRealismScore ── */

export function budgetRealismScore(r: RealismV2): number {
  return r.budgetRealismScore;
}

/* ── Score 3: flightFitScore ── */

export function flightFitScore(c: EnrichedCandidate, profile: UserTravelProfile): number {
  const f = c.features;
  const stopsFit = f.stops === 0 ? 1 : f.stops === 1 ? 0.75 : 0.45;
  const durFit = clamp01(1 - Math.max(0, f.durationMin - 600) / 900);
  const base =
    0.30 * f.airlineAffinity +
    0.25 * f.timeAffinity +
    0.20 * f.cabinAffinity +
    0.15 * stopsFit +
    0.10 * durFit;
  return shrinkToNeutral(base, profile.dataRichness);
}

/* ── Score 4: hotelFitScore ── */

export function hotelFitScore(c: EnrichedCandidate): number {
  // If the candidate isn't a bundle (no hotel), this score is a neutral 0.5.
  const q = c.features.hotelQualityScore;
  if (q == null) return 0.5;
  return clamp01(q);
}

/* ── Score 5: tripFitScore ── */

export function tripFitScore(
  flightFit: number,
  hotelFit: number,
  allocation: number | undefined
): number {
  const alloc = allocation == null ? 0.7 : clamp01(1 - Math.abs(allocation - 0.55) * 2);
  return 0.45 * flightFit + 0.35 * hotelFit + 0.20 * alloc;
}

/* ── Score 6: convenienceScore ── */

export function convenienceScore(c: EnrichedCandidate): number {
  const f = c.features;
  const stops = f.stops === 0 ? 1 : f.stops === 1 ? 0.75 : 0.45;
  const dur = clamp01(1 - Math.max(0, f.durationMin - 600) / 900);
  const timing = f.redEye ? 0.5 : 0.9;
  const apt = 1 - 0.5 * f.originAirportBurden - 0.25 * f.destAirportBurden;
  return (
    0.30 * stops +
    0.20 * dur +
    0.20 * timing +
    0.15 * f.layoverQuality +
    0.15 * apt
  );
}

/* ── Score 7: preferenceMatchScore (shrinkage-aware) ── */

export function preferenceMatchScore(
  c: EnrichedCandidate,
  profile: UserTravelProfile
): number {
  const f = c.features;
  if (profile.dataRichness < 0.2) return 0.5;

  const raw =
    0.25 * f.airlineAffinity +
    0.25 * f.timeAffinity +
    0.25 * f.cabinAffinity +
    0.25 * f.destAffinity;

  // Shrinkage toward 0.5 scaled by dataRichness
  return 0.5 + (raw - 0.5) * profile.dataRichness;
}

/* ── Score 8: confidenceScore ── */

export function confidenceScore(baseline: PriceBaseline | null): number {
  if (!baseline) return 0.1;
  const n = clamp01(baseline.dataPoints / 60);
  const r = clamp01(1 - baseline.ageDays / 45);
  const d = clamp01(baseline.sourceDiversity);
  return clamp01(0.5 * n + 0.3 * r + 0.2 * d);
}

/* ── Score 9: regretRiskScore (the anti-gambling signal) ── */

export function regretRiskScore(c: EnrichedCandidate): number {
  const f = c.features;
  const compromise = clamp01(f.compromiseCount / 4);
  const extreme = f.extremeness;
  const hidden = clamp01(f.hiddenCostRisk);
  // We measure the *fit gap* against 0.6 as a soft threshold.
  const fitGap = clamp01((0.6 - f.destAffinity) * 1.6);
  return clamp01(0.3 * compromise + 0.2 * extreme + 0.25 * hidden + 0.25 * fitGap);
}

/* ── Score 10: discoveryScore ── */

export function discoveryScore(
  c: EnrichedCandidate,
  profile: UserTravelProfile
): number {
  const seen = profile.destinations[c.features.destinationKey]?.value ?? 0;
  const persona = profile.explorationVsFamiliar.value;
  return clamp01((1 - seen) * persona);
}

/* ── Score 11: valueForMoneyScore ── */

export function valueForMoneyScore(
  c: EnrichedCandidate,
  baseline: PriceBaseline | null
): number {
  const quality = clamp01(
    (c.features.airlineAffinity + c.features.cabinAffinity + c.features.timeAffinity) / 3
  );
  const conf = confidenceScore(baseline);
  const priceMerit = baseline
    ? clamp01((baseline.median - c.features.priceUsd) / Math.max(1, baseline.median) + 0.5)
    : 0.5;
  return clamp01(0.45 * (quality * conf * 1.67) + 0.55 * priceMerit);
}

/* ── Score 12: aspirationMatchScore ── */

export function aspirationMatchScore(
  c: EnrichedCandidate,
  profile: UserTravelProfile
): number {
  const savedNotBooked = profile.destinationsSavedNotBooked[c.features.destinationKey] ?? 0;
  // Users who saved but didn't book this dest → aspiration
  return clamp01(savedNotBooked);
}

/* ── Score 13: timingFitScore ── */

export function timingFitScore(
  c: EnrichedCandidate,
  profile: UserTravelProfile
): number {
  const leadFit = c.features.leadTimeAffinity;
  const durFit = c.features.durationAffinity;
  return clamp01(0.5 * leadFit + 0.5 * durFit);
}

/* ── Score 14: conversionLikelihoodScore ── */

export function conversionLikelihoodScore(
  c: EnrichedCandidate,
  profile: UserTravelProfile,
  fused: FusedIntent
): number {
  const personaFit = clamp01(0.5 + 0.5 * (preferenceMatchScore(c, profile) - 0.5));
  const urgency = fused.session.urgency;
  const budgetFit = clamp01(1 - Math.abs(c.features.priceVsUserTypical - 1));
  return clamp01(0.5 * personaFit + 0.3 * budgetFit + 0.2 * urgency);
}

/* ── Score 15: overallRecommendationScore ── */

export function overallRecommendationScore(
  scores: Omit<RankingScores, 'overallRecommendationScore'>,
  weights: RankingWeights
): number {
  const regretPenalty = weights.regretRisk * (1 - scores.regretRiskScore);

  const raw =
    weights.feasibility * scores.feasibilityScore +
    weights.budgetRealism * scores.budgetRealismScore +
    weights.flightFit * scores.flightFitScore +
    weights.hotelFit * scores.hotelFitScore +
    weights.tripFit * scores.tripFitScore +
    weights.convenience * scores.convenienceScore +
    weights.preferenceMatch * scores.preferenceMatchScore +
    weights.confidence * scores.confidenceScore +
    weights.discovery * scores.discoveryScore +
    weights.valueForMoney * scores.valueForMoneyScore +
    weights.aspirationMatch * scores.aspirationMatchScore +
    weights.timingFit * scores.timingFitScore +
    weights.conversion * scores.conversionLikelihoodScore +
    regretPenalty;

  return clamp01(raw);
}

/* ── Convenience: compute all 15 for one candidate ── */

export interface ScoreAllInput {
  candidate: EnrichedCandidate;
  realism: RealismV2;
  baseline: PriceBaseline | null;
  profile: UserTravelProfile;
  fusedIntent: FusedIntent;
  tripAllocation?: number;
}

export function computeAllScores(input: ScoreAllInput): RankingScores {
  const { candidate, realism, baseline, profile, fusedIntent, tripAllocation } = input;

  const feas = feasibilityScore(realism);
  const budget = budgetRealismScore(realism);
  const flight = flightFitScore(candidate, profile);
  const hotel = hotelFitScore(candidate);
  const trip = tripFitScore(flight, hotel, tripAllocation);
  const conv = convenienceScore(candidate);
  const pref = preferenceMatchScore(candidate, profile);
  const conf = confidenceScore(baseline);
  const regret = regretRiskScore(candidate);
  const disc = discoveryScore(candidate, profile);
  const vfm = valueForMoneyScore(candidate, baseline);
  const asp = aspirationMatchScore(candidate, profile);
  const tim = timingFitScore(candidate, profile);
  const convert = conversionLikelihoodScore(candidate, profile, fusedIntent);

  const weights = adaptWeights(BASE_WEIGHTS, profile);

  const partial = {
    feasibilityScore: feas,
    budgetRealismScore: budget,
    flightFitScore: flight,
    hotelFitScore: hotel,
    tripFitScore: trip,
    convenienceScore: conv,
    preferenceMatchScore: pref,
    confidenceScore: conf,
    regretRiskScore: regret,
    discoveryScore: disc,
    valueForMoneyScore: vfm,
    aspirationMatchScore: asp,
    timingFitScore: tim,
    conversionLikelihoodScore: convert,
  };

  const overall = overallRecommendationScore(partial, weights);

  return { ...partial, overallRecommendationScore: overall };
}

/* ── Utility: shrink a score toward neutral when data is sparse ── */

function shrinkToNeutral(value: number, dataRichness: number): number {
  return 0.5 + (value - 0.5) * clamp01(dataRichness * 1.5);
}
