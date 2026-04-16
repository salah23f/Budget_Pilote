/**
 * Flyeas travel intelligence engine — public entrypoint.
 *
 * Consumers (API routes, React components) should import from here,
 * not from individual files. This file orchestrates the 5 layers:
 *
 *   Layer 1: constraint resolution   (performed by caller)
 *   Layer 2: feasibility assessment  (assessFeasibility)
 *   Layer 3: per-offer scoring        (scoreOffer)
 *   Layer 4: persona-weighted ranking (applyPersonaWeights + isOfferEligible)
 *   Layer 5: cohort + explanation     (assignCohorts + explain)
 */

export * from './types';
export {
  assessFeasibility,
  scoreBudgetRealism,
  scoreFeasibility,
  scoreOffer,
  applyPersonaWeights,
  isOfferEligible,
  generateSuggestions,
  verdictFromScores,
} from './feasibility';
export { assignCohorts, type CohortInput } from './cohorts';
export { explain, verdictCopy, type ExplainInput } from './explain';

import type {
  FeasibilityAssessment,
  OfferFeatures,
  PriceBaseline,
  Recommendation,
  ResolvedConstraints,
  TravelIntent,
  UserPreferenceProfile,
} from './types';

import {
  assessFeasibility as _assess,
  scoreOffer as _scoreOffer,
  applyPersonaWeights as _apply,
  isOfferEligible as _eligible,
} from './feasibility';
import { assignCohorts as _cohorts, type CohortInput } from './cohorts';
import { explain as _explain } from './explain';

/**
 * End-to-end convenience: take a resolved constraint set, a baseline, a list
 * of offers, and the user's preference profile — produce ranked Recommendations.
 *
 * Split out so API routes and server code can call this directly.
 */
export interface RankInput {
  watchId: string;
  intent: TravelIntent;
  constraints: ResolvedConstraints;
  baseline: PriceBaseline | null;
  offers: Array<{ id: string; features: OfferFeatures; destinationKey: string }>;
  profile: UserPreferenceProfile | null;
}

export interface RankOutput {
  assessment: FeasibilityAssessment;
  recommendations: Recommendation[];
  blockedCount: number;
}

export function rank(input: RankInput): RankOutput {
  const { watchId, intent, constraints, baseline, offers, profile } = input;

  const assessment = _assess(intent, constraints, baseline);

  const scored: Array<{
    offerId: string;
    features: OfferFeatures;
    scores: ReturnType<typeof _scoreOffer>;
    overall: number;
    eligible: boolean;
  }> = [];

  for (const o of offers) {
    const scores = _scoreOffer({
      offer: o.features,
      baseline,
      feasibilityScore: assessment.feasibilityScore,
      profile,
      destinationKey: o.destinationKey,
    });
    const eligibility = _eligible(scores, profile);
    const overall = eligibility.eligible ? _apply(scores, profile) : 0;
    scored.push({ offerId: o.id, features: o.features, scores, overall, eligible: eligibility.eligible });
  }

  const cohortInputs: CohortInput[] = scored.map((s) => ({
    offerId: s.offerId,
    priceUsd: s.features.priceUsd,
    scores: s.scores,
    overallScore: s.overall,
    eligible: s.eligible,
  }));

  const cohortMap = _cohorts(cohortInputs, assessment);

  const recommendations: Recommendation[] = scored
    .filter((s) => s.eligible)
    .map((s) => {
      const cohorts = cohortMap[s.offerId] ?? [];
      const explanation = _explain({
        offer: s.features,
        baseline,
        scores: s.scores,
        cohorts,
      });
      return {
        watchId,
        offerId: s.offerId,
        offer: s.features,
        scores: s.scores,
        overallScore: s.overall,
        cohorts,
        explanation,
      };
    })
    .sort((a, b) => b.overallScore - a.overallScore);

  return {
    assessment,
    recommendations,
    blockedCount: scored.filter((s) => !s.eligible).length,
  };
}
