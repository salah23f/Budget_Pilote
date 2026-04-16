/**
 * Engine orchestrator — the top-level `runEngine()` that wires layers 1–9.
 *
 * Layers
 *   1. User model        (via profile passed in, maintained by profile-store)
 *   2. Intent fusion     (fuseIntent)
 *   3. Feasibility       (assessFeasibility v1 → wrapped to RealismV2)
 *   4. Candidate gen     (caller provides raw offers; expansion is planned but
 *                         runs outside this function — see lib/algorithm/candidates.ts)
 *   5. Enrichment        (enrichCandidate for each offer)
 *   6. Trip assembly     (placeholder — hotel bundles handled via EnrichInput)
 *   7. Ranking (15)      (computeAllScores)
 *   8. Safeguards        (isSafeToSurface)
 *   9. Explanation       (generateExplanation)
 */

import type {
  CohortV2,
  EnrichedCandidate,
  FusedIntent,
  OfferFeatures,
  PriceBaseline,
  RankedRecommendation,
  RealismV2,
  SessionIntent,
  TravelIntent,
  UserTravelProfile,
} from './types';
import { assessFeasibility } from './feasibility';
import { fuseIntent, neutralSession, requiresUserConfirmation } from './intent';
import { enrichCandidate, type EnrichInput } from './enrich';
import { computeAllScores } from './ranking';
import { isSafeToSurface, reasonCopy } from './safeguards';
import { generateExplanation } from './explain-v2';

/* ── Realism v2 adapter ─────────────────────────────── */

function wrapRealism(
  v1: ReturnType<typeof assessFeasibility>,
  fused: FusedIntent
): RealismV2 {
  const baseline = v1.baseline;
  const bottleneck = computeBottleneck(v1, fused);
  return {
    ...v1,
    profileBudgetAlignment: 0.5, // filled externally when profile is available
    historicalPressure: baseline?.seasonalityFactor ?? 0.5,
    dataSufficiency: baseline ? Math.min(1, baseline.dataPoints / 60) : 0,
    regionFlexibilityHeadroom: estimateRegionHeadroom(fused),
    dateFlexibilityHeadroom: estimateDateHeadroom(fused),
    bottleneck,
  };
}

function computeBottleneck(
  r: ReturnType<typeof assessFeasibility>,
  fused: FusedIntent
): RealismV2['bottleneck'] {
  if (!r.baseline) return 'data';
  if (r.budgetRealismScore < 0.3) return 'budget';
  if (fused.effective.dates.kind === 'exact') return 'dates';
  if (fused.effective.origin.kind === 'exact' && fused.effective.destination.kind === 'exact') return 'airports';
  if (r.constraintTightness > 0.6) return 'duration';
  return null;
}

function estimateRegionHeadroom(fused: FusedIntent): number {
  const single = fused.effective.origin.kind === 'exact' ? 0.4 : 0;
  const singleDest = fused.effective.destination.kind === 'exact' ? 0.3 : 0;
  return single + singleDest;
}

function estimateDateHeadroom(fused: FusedIntent): number {
  switch (fused.effective.dates.kind) {
    case 'exact': return 0.5;
    case 'range': return 0.25;
    case 'month': return 0.1;
    case 'season': return 0.05;
    case 'weekends': return 0.2;
    default: return 0.3;
  }
}

/* ── Cohort assignment (v2) ─────────────────────────── */

function assignCohortsV2(
  ranked: Array<{ offerId: string; priceUsd: number; scores: any; overall: number }>,
  realism: RealismV2
): Record<string, CohortV2[]> {
  const out: Record<string, CohortV2[]> = {};
  ranked.forEach((r) => (out[r.offerId] = []));

  if (ranked.length === 0) return out;

  const safe = ranked.filter((r) => r.overall > 0);
  if (safe.length === 0) return out;

  // SMARTEST — max overall
  const smartest = safe.reduce((a, b) => (b.overall > a.overall ? b : a));
  out[smartest.offerId].push('SMARTEST');

  // CHEAPEST_SANE
  const cheapestPool = safe.filter(
    (r) => r.scores.feasibilityScore >= 0.4 && r.scores.regretRiskScore <= 0.5
  );
  if (cheapestPool.length) {
    const cheap = cheapestPool.reduce((a, b) => (b.priceUsd < a.priceUsd ? b : a));
    if (cheap.offerId !== smartest.offerId) out[cheap.offerId].push('CHEAPEST_SANE');
  }

  // SAFEST
  const topByPrice = [...safe].sort((a, b) => a.priceUsd - b.priceUsd).slice(0, 10);
  if (topByPrice.length) {
    const safest = topByPrice.reduce((a, b) => {
      const sa = a.scores.confidenceScore - a.scores.regretRiskScore;
      const sb = b.scores.confidenceScore - b.scores.regretRiskScore;
      return sb > sa ? b : a;
    });
    if (!out[safest.offerId].includes('SMARTEST')) out[safest.offerId].push('SAFEST');
  }

  // BEST_FIT
  const bf = safe
    .filter((r) => r.scores.preferenceMatchScore >= 0.8)
    .sort((a, b) => b.scores.preferenceMatchScore - a.scores.preferenceMatchScore)[0];
  if (bf && !out[bf.offerId].includes('SMARTEST')) out[bf.offerId].push('BEST_FIT');

  // PREMIUM_WORTH_IT
  const prices = safe.map((r) => r.priceUsd).sort((a, b) => a - b);
  const p75 = prices[Math.floor(prices.length * 0.75)];
  const premium = safe
    .filter((r) => r.priceUsd > p75 && r.scores.tripFitScore > 0.85)
    .sort((a, b) => b.scores.tripFitScore - a.scores.tripFitScore)[0];
  if (premium) out[premium.offerId].push('PREMIUM_WORTH_IT');

  // HIDDEN_GEM
  const gem = safe
    .filter((r) => r.scores.discoveryScore > 0.7 && r.overall > 0.7)
    .sort((a, b) => b.scores.discoveryScore - a.scores.discoveryScore)[0];
  if (gem) out[gem.offerId].push('HIDDEN_GEM');

  // WIDEN_TO_UNLOCK — attach to the SMARTEST when feasibility is soft
  if (realism.feasibilityScore < 0.35 && realism.suggestions.length > 0) {
    if (!out[smartest.offerId].includes('WIDEN_TO_UNLOCK')) {
      out[smartest.offerId].push('WIDEN_TO_UNLOCK');
    }
  }

  return out;
}

/* ── Public entrypoint ──────────────────────────────── */

export interface RunEngineInput {
  userId: string;
  profile: UserTravelProfile;
  stated: TravelIntent;
  session?: SessionIntent;
  baseline: PriceBaseline | null;
  offers: Array<{
    id: string;
    features: OfferFeatures;
    destinationKey: string;
    sourceExpansion?: EnrichInput['sourceExpansion'];
    tripDurationDays?: number;
    hotelFeatures?: EnrichInput['hotelFeatures'];
    bundlePrice?: number;
    separatePrice?: number;
  }>;
  maxResults?: number;
}

export interface RunEngineOutput {
  kind: 'ranked' | 'reframe' | 'nudge';
  fused: FusedIntent;
  realism: RealismV2;
  recommendations: RankedRecommendation[];
  vetoed: Array<{ offerId: string; reason: string }>;
  requiresConfirmation?: string;
}

export function runEngine(input: RunEngineInput): RunEngineOutput {
  const { profile, stated, baseline, offers, maxResults = 20 } = input;
  const session = input.session ?? neutralSession();

  // Layer 2 — Intent fusion
  const fused = fuseIntent(stated, session, profile);
  const confField = requiresUserConfirmation(fused);
  if (confField) {
    return {
      kind: 'nudge',
      fused,
      realism: wrapRealism(assessFeasibility(stated, placeholderConstraints(stated), baseline), fused),
      recommendations: [],
      vetoed: [],
      requiresConfirmation: confField,
    };
  }

  // Layer 3 — Feasibility (note: caller should provide proper ResolvedConstraints)
  const v1Realism = assessFeasibility(fused.effective, placeholderConstraints(fused.effective), baseline);
  const realism = wrapRealism(v1Realism, fused);

  // Hard refuse for impossible watches
  if (realism.verdict === 'impossible') {
    return { kind: 'reframe', fused, realism, recommendations: [], vetoed: [] };
  }

  // Layer 5 — Enrichment
  const enriched: EnrichedCandidate[] = offers.map((o) =>
    enrichCandidate({
      offerId: o.id,
      offer: o.features,
      baseline,
      profile,
      fusedIntent: fused,
      destinationKey: o.destinationKey,
      sourceExpansion: o.sourceExpansion ?? 'exact',
      tripDurationDays: o.tripDurationDays,
      hotelFeatures: o.hotelFeatures,
      bundlePrice: o.bundlePrice,
      separatePrice: o.separatePrice,
    })
  );

  // Layer 7 — Ranking
  const scoredPool = enriched.map((c) => {
    const scores = computeAllScores({
      candidate: c,
      realism,
      baseline,
      profile,
      fusedIntent: fused,
      tripAllocation: c.features.budgetAllocationRatio,
    });
    return { candidate: c, scores };
  });

  // Layer 8 — Safeguards
  const safety = scoredPool.map((r) => ({
    ...r,
    safe: isSafeToSurface({ candidate: r.candidate, scores: r.scores, profile }),
  }));

  const vetoed: Array<{ offerId: string; reason: string }> = [];
  const survivors = safety.filter((r) => {
    if (r.safe.safe) return true;
    vetoed.push({ offerId: r.candidate.offerId, reason: r.safe.reason ? reasonCopy(r.safe.reason) : 'vetoed' });
    return false;
  });

  // Sort
  survivors.sort((a, b) => b.scores.overallRecommendationScore - a.scores.overallRecommendationScore);

  // Layer 9 — Cohorts + explanations
  const cohortsMap = assignCohortsV2(
    survivors.map((r) => ({
      offerId: r.candidate.offerId,
      priceUsd: r.candidate.features.priceUsd,
      scores: r.scores,
      overall: r.scores.overallRecommendationScore,
    })),
    realism
  );

  const recommendations: RankedRecommendation[] = survivors
    .slice(0, maxResults)
    .map((r) => {
      const cohorts = cohortsMap[r.candidate.offerId] ?? [];
      const primaryCohort: CohortV2 = cohorts[0] ?? 'SMARTEST';
      const explanation = generateExplanation({
        candidate: r.candidate,
        scores: r.scores,
        cohort: primaryCohort,
        baseline,
        profile,
        fused,
      });

      return {
        offerId: r.candidate.offerId,
        features: r.candidate.features,
        scores: r.scores,
        cohorts,
        safeToSurface: true,
        explanation: { ...explanation, cohort: primaryCohort },
      };
    });

  return { kind: 'ranked', fused, realism, recommendations, vetoed };
}

/* ── Placeholder constraint resolver ────────────────── */

/**
 * Until `lib/algorithm/candidates.ts` ships a proper constraint resolver,
 * this derives minimal ResolvedConstraints from TravelIntent so feasibility
 * can compute breadth scores. Replace when candidates.ts lands.
 */
function placeholderConstraints(intent: TravelIntent) {
  const originAirports =
    intent.origin.kind === 'exact'
      ? [intent.origin.iata]
      : (intent.origin as any).airports ?? [];
  const destAirports =
    intent.destination.kind === 'exact'
      ? [intent.destination.iata]
      : (intent.destination as any).airports ?? [];

  const datesBreadth =
    intent.dates.kind === 'exact' ? 0 :
    intent.dates.kind === 'weekends' ? 0.3 :
    intent.dates.kind === 'range' ? 0.5 :
    intent.dates.kind === 'month' ? 0.75 :
    intent.dates.kind === 'season' ? 0.9 : 0.2;

  const airportsBreadth = Math.min(
    1,
    (Math.max(0, originAirports.length - 1) + Math.max(0, destAirports.length - 1)) / 4
  );

  return {
    originAirports,
    destinationAirports: destAirports,
    dateWindows: [],
    durationRange: {
      minDays: intent.duration?.min ?? 1,
      maxDays: intent.duration?.max ?? 14,
    },
    budgetUsd: intent.budgetUsd,
    cabin: intent.cabin ?? 'economy',
    maxStops: intent.maxStops ?? 2,
    travelers: intent.travelers,
    breadth: {
      airports: airportsBreadth,
      dates: datesBreadth,
      duration: intent.duration ? 0.3 : 0.1,
    },
  };
}
