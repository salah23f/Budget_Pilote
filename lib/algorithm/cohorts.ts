/**
 * Cohort assignment — tag each recommendation with what it's good at.
 *
 * A single offer can be in 0, 1, or 2 cohorts. UI uses this to surface:
 *   · the CHEAPEST
 *   · the SAFEST
 *   · the SMARTEST (highest overall score — the default featured)
 *   · the BEST_FIT (strong preference match)
 *   · and suggests WIDEN_TO_UNLOCK if feasibility is weak
 */

import type { AllScores, Cohort, FeasibilityAssessment } from './types';

export interface CohortInput {
  offerId: string;
  priceUsd: number;
  scores: AllScores;
  overallScore: number;
  eligible: boolean;
}

export interface CohortAssignment {
  offerId: string;
  cohorts: Cohort[];
}

/**
 * Assign cohorts across the whole set of eligible offers.
 * Returns a map offerId → cohort list.
 */
export function assignCohorts(
  offers: CohortInput[],
  assessment: FeasibilityAssessment
): Record<string, Cohort[]> {
  const eligible = offers.filter((o) => o.eligible);
  const out: Record<string, Cohort[]> = {};
  for (const o of offers) out[o.offerId] = [];

  if (eligible.length === 0) {
    return out;
  }

  // SMARTEST — max overallScore
  const smartest = eligible.reduce((a, b) => (b.overallScore > a.overallScore ? b : a));
  out[smartest.offerId].push('SMARTEST');

  // CHEAPEST — min priceUsd (if distinct from smartest)
  const cheapest = eligible.reduce((a, b) => (b.priceUsd < a.priceUsd ? b : a));
  if (cheapest.offerId !== smartest.offerId) {
    out[cheapest.offerId].push('CHEAPEST');
  }

  // SAFEST — max (safetyScore + confidenceScore), among top-5 cheapest to avoid premium-only offers
  const topByPrice = [...eligible].sort((a, b) => a.priceUsd - b.priceUsd).slice(0, 5);
  if (topByPrice.length > 0) {
    const safest = topByPrice.reduce((a, b) => {
      const sa = a.scores.safetyScore + a.scores.confidenceScore;
      const sb = b.scores.safetyScore + b.scores.confidenceScore;
      return sb > sa ? b : a;
    });
    if (!out[safest.offerId].includes('SAFEST') && safest.offerId !== smartest.offerId) {
      out[safest.offerId].push('SAFEST');
    }
  }

  // BEST_FIT — if any offer has preferenceMatchScore ≥ 0.8
  const bestFitCandidates = eligible
    .filter((o) => o.scores.preferenceMatchScore >= 0.8)
    .sort((a, b) => b.scores.preferenceMatchScore - a.scores.preferenceMatchScore);
  if (bestFitCandidates.length > 0) {
    const bf = bestFitCandidates[0];
    if (!out[bf.offerId].includes('BEST_FIT')) {
      out[bf.offerId].push('BEST_FIT');
    }
  }

  // WIDEN_TO_UNLOCK — pseudo-cohort signal, attached only when feasibility is weak.
  // Applied to the smartest existing offer as an annotation for UI so we can
  // surface a "widen to find cheaper" nudge next to the best current option.
  if (assessment.feasibilityScore < 0.35 && assessment.suggestions.length > 0) {
    out[smartest.offerId].push('WIDEN_TO_UNLOCK');
  }

  return out;
}
