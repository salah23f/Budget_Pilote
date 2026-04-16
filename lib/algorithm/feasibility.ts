/**
 * Flyeas feasibility + scoring engine.
 *
 * Core responsibilities
 * ─────────────────────
 * 1. Budget realism — is the user's target defensible vs history?
 * 2. Feasibility    — what's the probability of a matching offer in 30 days?
 * 3. Offer scoring  — 8 per-offer dimensions, used for ranking.
 * 4. Hard rules     — block/hide/warn signals before ranking.
 * 5. Suggestions    — concrete levers to improve feasibility.
 *
 * All scores are normalized to [0, 1]. Higher is better.
 */

import type {
  AllScores,
  BlockerKey,
  ConstraintSuggestion,
  FeasibilityAssessment,
  OfferFeatures,
  PriceBaseline,
  ResolvedConstraints,
  TravelIntent,
  UserPreferenceProfile,
} from './types';

/* ── Utility math ───────────────────────────────────────── */

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

/* ── Budget realism ─────────────────────────────────────── */

/**
 * Score the user's budget against the price distribution.
 * - Below P5:       0.0 (impossible)
 * - P5..P25:        0.0 → 0.4 (very tight, unlikely)
 * - P25..P50:       0.4 → 0.7 (tight but doable)
 * - P50..P75:       0.7 → 0.9 (comfortable)
 * - Above P75:      1.0 (easy)
 * If the user didn't specify a budget, returns 1.0 (no constraint).
 */
export function scoreBudgetRealism(
  budgetUsd: number | undefined,
  baseline: PriceBaseline | null
): number {
  if (budgetUsd == null) return 1.0;
  if (!baseline) return 0.5; // neutral when we can't tell

  const { p5, p25, median: p50, p75 } = baseline;

  if (budgetUsd < p5) return 0.0;
  if (budgetUsd < p25) {
    const t = (budgetUsd - p5) / Math.max(1, p25 - p5);
    return 0.0 + 0.4 * t;
  }
  if (budgetUsd < p50) {
    const t = (budgetUsd - p25) / Math.max(1, p50 - p25);
    return 0.4 + 0.3 * t;
  }
  if (budgetUsd < p75) {
    const t = (budgetUsd - p50) / Math.max(1, p75 - p50);
    return 0.7 + 0.2 * t;
  }
  return 1.0;
}

/* ── Feasibility ────────────────────────────────────────── */

/**
 * Probability-like estimate that a matching offer will appear within 30 days.
 *
 * Inputs: budget realism, date flexibility breadth, airport breadth.
 * Higher breadth multiplies the base budget realism because "widening"
 * captures more offers.
 */
export function scoreFeasibility(
  budgetRealism: number,
  breadth: ResolvedConstraints['breadth']
): number {
  const airports = clamp01(breadth.airports);
  const dates = clamp01(breadth.dates);

  // A tight budget with wide breadth still has real feasibility.
  const base = budgetRealism;
  const breadthBoost = 0.35 * dates + 0.25 * airports;
  const lifted = base + (1 - base) * breadthBoost;

  // Soften: don't let feasibility climb above 0.95 unless budget is easy.
  if (budgetRealism < 0.4) return Math.min(0.75, lifted);
  if (budgetRealism < 0.7) return Math.min(0.9, lifted);
  return Math.min(1.0, lifted);
}

/* ── Constraint tightness ──────────────────────────────── */

export function computeConstraintTightness(
  budgetRealism: number,
  breadth: ResolvedConstraints['breadth']
): number {
  // Combine: tight budget + narrow inputs = high tightness
  const budgetTightness = 1 - budgetRealism;
  const inputTightness = 1 - (0.5 * breadth.airports + 0.5 * breadth.dates);
  // Weighted toward budget because it dominates outcomes
  return clamp01(0.65 * budgetTightness + 0.35 * inputTightness);
}

/* ── Suggestions (actionable levers) ───────────────────── */

/**
 * Given the assessment, generate 0–3 concrete levers that would improve
 * feasibility. Each lever has an estimated gain. UI surfaces the top 3.
 */
export function generateSuggestions(
  intent: TravelIntent,
  constraints: ResolvedConstraints,
  baseline: PriceBaseline | null,
  budgetRealism: number
): ConstraintSuggestion[] {
  const out: ConstraintSuggestion[] = [];

  // Lever 1: widen dates
  if (constraints.breadth.dates < 0.3) {
    out.push({
      lever: 'dates',
      description: 'Widen travel dates by ±3 days',
      expectedFeasibilityGain: 0.2,
    });
  } else if (constraints.breadth.dates < 0.6) {
    out.push({
      lever: 'dates',
      description: 'Widen travel dates by ±7 days',
      expectedFeasibilityGain: 0.12,
    });
  }

  // Lever 2: broaden airports
  if (constraints.breadth.airports < 0.3) {
    out.push({
      lever: 'airports',
      description: 'Include nearby airports in the same region',
      expectedFeasibilityGain: 0.15,
    });
  }

  // Lever 3: accept one more stop
  if ((intent.maxStops ?? 0) === 0) {
    out.push({
      lever: 'stops',
      description: 'Accept 1-stop connections',
      expectedFeasibilityGain: 0.18,
    });
  }

  // Lever 4: shorten the trip
  if (intent.duration?.min != null && intent.duration.min > 7) {
    out.push({
      lever: 'duration',
      description: 'Shorten the stay by 2–3 days',
      expectedFeasibilityGain: 0.08,
    });
  }

  // Lever 5: raise the budget
  if (budgetRealism < 0.3 && baseline) {
    const suggestedBudget = Math.round(baseline.p25);
    out.push({
      lever: 'budget',
      description: `Raise budget to ~$${suggestedBudget}`,
      expectedFeasibilityGain: 0.25,
    });
  }

  // Sort by gain, cap at 3
  return out.sort((a, b) => b.expectedFeasibilityGain - a.expectedFeasibilityGain).slice(0, 3);
}

/* ── Blockers ───────────────────────────────────────────── */

export function detectBlockers(
  intent: TravelIntent,
  constraints: ResolvedConstraints,
  baseline: PriceBaseline | null,
  budgetRealism: number,
  feasibility: number
): BlockerKey[] {
  const blockers: BlockerKey[] = [];

  if (!baseline) {
    blockers.push('no_baseline_data');
  }

  if (budgetRealism < 0.1) {
    blockers.push('budget_too_low');
  }

  if (feasibility < 0.15) {
    blockers.push('constraints_too_tight');
  }

  // Duration sanity: min > max (user error) or max < 1
  if (intent.duration) {
    const { min, max } = intent.duration;
    if (min != null && max != null && min > max) {
      blockers.push('impossible_duration');
    }
  }

  return blockers;
}

/* ── Verdict ────────────────────────────────────────────── */

export function verdictFromScores(
  budgetRealism: number,
  feasibility: number,
  baseline: PriceBaseline | null
): FeasibilityAssessment['verdict'] {
  if (!baseline) return 'insufficient_data';
  if (budgetRealism < 0.1) return 'impossible';
  if (feasibility < 0.25) return 'unrealistic';
  if (feasibility < 0.55) return 'tight';
  if (feasibility < 0.85) return 'likely';
  return 'easy';
}

/* ── Main assessment entrypoint ─────────────────────────── */

export function assessFeasibility(
  intent: TravelIntent,
  constraints: ResolvedConstraints,
  baseline: PriceBaseline | null
): FeasibilityAssessment {
  const budgetRealismScore = scoreBudgetRealism(intent.budgetUsd, baseline);
  const feasibilityScore = scoreFeasibility(budgetRealismScore, constraints.breadth);
  const constraintTightness = computeConstraintTightness(budgetRealismScore, constraints.breadth);
  const suggestions = generateSuggestions(intent, constraints, baseline, budgetRealismScore);
  const blockers = detectBlockers(intent, constraints, baseline, budgetRealismScore, feasibilityScore);
  const verdict = verdictFromScores(budgetRealismScore, feasibilityScore, baseline);

  return {
    feasibilityScore,
    budgetRealismScore,
    constraintTightness,
    baseline,
    blockers,
    suggestions,
    verdict,
    computedAt: Date.now(),
  };
}

/* ── Per-offer scoring (Layer 3) ────────────────────────── */

export function scorePriceValue(offer: OfferFeatures, baseline: PriceBaseline | null): number {
  if (!baseline) return 0.5;
  const iqr = Math.max(1, baseline.p75 - baseline.p25);
  const zSoft = (baseline.median - offer.priceUsd) / iqr;
  return clamp01(sigmoid(zSoft * 1.5));
}

export function scoreConvenience(offer: OfferFeatures): number {
  const stopsPenalty = offer.stops === 0 ? 0 : offer.stops === 1 ? 0.25 : 0.55;

  // Duration penalty: > 18h scales down
  const durationScore = offer.durationMinutes > 0
    ? clamp01(1 - Math.max(0, offer.durationMinutes - 600) / 900)
    : 0.5;

  // Time of day
  const dep = new Date(offer.departureTime);
  const hr = isNaN(dep.getTime()) ? 12 : dep.getHours();
  let tod = 0.8;
  if (hr >= 6 && hr < 10) tod = 1.0;
  else if (hr >= 10 && hr < 17) tod = 0.9;
  else if (hr >= 17 && hr < 21) tod = 0.85;
  else tod = 0.6; // red-eye

  const layover = offer.layoverQuality ?? 0.7;

  return clamp01(
    0.4 * (1 - stopsPenalty) +
    0.3 * durationScore +
    0.2 * tod +
    0.1 * layover
  );
}

export function scoreConfidence(baseline: PriceBaseline | null): number {
  if (!baseline) return 0.1;
  const dataScore = clamp01(baseline.dataPoints / 60);
  const recency = clamp01(1 - baseline.ageDays / 45);
  const diversity = clamp01(baseline.sourceDiversity);
  return clamp01(0.6 * dataScore + 0.25 * recency + 0.15 * diversity);
}

export function scorePreferenceMatch(
  offer: OfferFeatures,
  profile: UserPreferenceProfile | null
): number {
  if (!profile || profile.observationCount < 3) return 0.5; // cold start

  const airlineAff = profile.airlines[offer.airline] ?? 0.5;

  const depHr = new Date(offer.departureTime).getHours();
  const timeBucket =
    depHr < 12 ? 'morning' :
    depHr < 17 ? 'afternoon' :
    depHr < 21 ? 'evening' : 'redeye';
  const timeAff = profile.departureTimes[timeBucket as keyof typeof profile.departureTimes] ?? 0.5;

  const cabinAff = profile.cabins[offer.cabin] ?? 0.5;

  // Weighted cosine-ish similarity
  return clamp01(0.4 * airlineAff + 0.35 * timeAff + 0.25 * cabinAff);
}

export function scoreFlexCompat(offer: OfferFeatures): number {
  if (!offer.inFlexWindow) return 0; // hard block via 0
  return offer.inAirportSet ? 1.0 : 0.7;
}

export function scoreSafety(offer: OfferFeatures): number {
  let points = 0;
  if (offer.cancelPolicy === 'refundable') points += 1;
  else if (offer.cancelPolicy === 'partial') points += 0.5;

  if (offer.baggageIncluded) points += 1;

  // Reasonable layover (if multi-stop)
  if (offer.stops === 0) points += 1;
  else if ((offer.layoverQuality ?? 0.5) >= 0.6) points += 1;

  // Non-redeye bias for safety
  const hr = new Date(offer.departureTime).getHours();
  if (hr >= 6 && hr < 22) points += 1;

  return clamp01(points / 4);
}

export function scoreExploration(
  offer: OfferFeatures,
  destinationKey: string,
  profile: UserPreferenceProfile | null
): number {
  if (!profile) return 0.5;
  const seen = profile.destinations[destinationKey] ?? 0;
  return clamp01(1 - seen);
}

/* ── Per-offer full scoring ─────────────────────────────── */

export interface ScoreOfferInput {
  offer: OfferFeatures;
  baseline: PriceBaseline | null;
  feasibilityScore: number;
  profile: UserPreferenceProfile | null;
  destinationKey: string;
}

export function scoreOffer(input: ScoreOfferInput): AllScores {
  const { offer, baseline, feasibilityScore, profile, destinationKey } = input;

  return {
    priceValueScore: scorePriceValue(offer, baseline),
    convenienceScore: scoreConvenience(offer),
    confidenceScore: scoreConfidence(baseline),
    preferenceMatchScore: scorePreferenceMatch(offer, profile),
    flexibilityCompatibilityScore: scoreFlexCompat(offer),
    feasibilityScore,
    safetyScore: scoreSafety(offer),
    explorationScore: scoreExploration(offer, destinationKey, profile),
  };
}

/* ── Ranking formula ────────────────────────────────────── */

const BASE_WEIGHTS = {
  priceValueScore: 0.28,
  convenienceScore: 0.18,
  confidenceScore: 0.14,
  preferenceMatchScore: 0.14,
  flexibilityCompatibilityScore: 0.1,
  feasibilityScore: 0.08,
  safetyScore: 0.05,
  explorationScore: 0.03,
};

/**
 * Apply persona-based weight shifts. Weights re-normalize to 1.0.
 * Max individual shift ±30%.
 */
export function applyPersonaWeights(
  scores: AllScores,
  profile: UserPreferenceProfile | null
): number {
  if (!profile || profile.observationCount < 5) {
    return applyWeights(scores, BASE_WEIGHTS);
  }

  const weights = { ...BASE_WEIGHTS };

  // Price-sensitive users weight price & exploration higher
  if (profile.priceSensitivity > 0.65) {
    weights.priceValueScore *= 1.3;
    weights.convenienceScore *= 0.9;
  }

  // Convenience-sensitive users weight convenience & safety higher
  if (profile.convenienceSensitivity > 0.65) {
    weights.convenienceScore *= 1.3;
    weights.safetyScore *= 1.2;
    weights.priceValueScore *= 0.85;
  }

  // Certainty-sensitive users weight confidence & safety higher
  if (profile.certaintySensitivity > 0.65) {
    weights.confidenceScore *= 1.3;
    weights.safetyScore *= 1.25;
    weights.explorationScore *= 0.7;
  }

  // Re-normalize
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  for (const key of Object.keys(weights) as Array<keyof typeof weights>) {
    weights[key] = weights[key] / total;
  }

  return applyWeights(scores, weights);
}

function applyWeights(scores: AllScores, weights: typeof BASE_WEIGHTS): number {
  return (
    weights.priceValueScore * scores.priceValueScore +
    weights.convenienceScore * scores.convenienceScore +
    weights.confidenceScore * scores.confidenceScore +
    weights.preferenceMatchScore * scores.preferenceMatchScore +
    weights.flexibilityCompatibilityScore * scores.flexibilityCompatibilityScore +
    weights.feasibilityScore * scores.feasibilityScore +
    weights.safetyScore * scores.safetyScore +
    weights.explorationScore * scores.explorationScore
  );
}

/**
 * Hard rules applied before ranking. Returns false if the offer should be
 * excluded from ranking entirely.
 */
export function isOfferEligible(
  scores: AllScores,
  profile: UserPreferenceProfile | null
): { eligible: boolean; reason?: string } {
  if (scores.flexibilityCompatibilityScore === 0) {
    return { eligible: false, reason: 'outside_flex_window' };
  }
  if (scores.safetyScore < 0.25 && profile?.certaintySensitivity !== undefined && profile.certaintySensitivity > 0.4) {
    return { eligible: false, reason: 'unsafe_for_certainty_profile' };
  }
  if (scores.confidenceScore < 0.2 && scores.priceValueScore < 0.3) {
    return { eligible: false, reason: 'low_confidence_and_weak_price' };
  }
  return { eligible: true };
}
