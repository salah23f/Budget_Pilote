/**
 * Explainability engine v2 — generated, not templated.
 *
 * Given a fully-scored candidate, produce a headline, a one-sentence "why for
 * this user", short evidence, honest caveats, and (when the candidate is on
 * the borderline) a contrarian warning.
 *
 * Principles:
 *   - Numerical > adjectival. "12% below typical" beats "a great deal".
 *   - Second-person > third. "Matches your usual morning departures".
 *   - Honest > hypey. If `regretRiskScore > 0.5` we add a contrarian note.
 */

import type {
  CohortV2,
  EnrichedCandidate,
  FusedIntent,
  PriceBaseline,
  RankingScores,
  UserTravelProfile,
} from './types';

const fmtPct = (x: number): string => `${Math.round(x * 100)}%`;
const fmtUsd = (x: number): string => `$${Math.round(x).toLocaleString()}`;

/* ── Headline ─────────────────────────────────────── */

export function buildHeadline(
  c: EnrichedCandidate,
  s: RankingScores,
  cohort: CohortV2,
  baseline: PriceBaseline | null,
  profile: UserTravelProfile
): string {
  // 1. Numerical price framing if we have a baseline
  if (baseline && baseline.median > 0) {
    const delta = (baseline.median - c.features.priceUsd) / baseline.median;
    if (delta >= 0.25) return `${fmtPct(delta)} below typical for this route`;
    if (delta >= 0.12) return `${fmtPct(delta)} below typical — a strong price`;
  }

  // 2. Deeply personalized framing when signal is strong
  if (profile.dataRichness > 0.4 && s.preferenceMatchScore > 0.85) {
    return 'Matches how you usually travel';
  }

  // 3. Cohort-specific framing
  switch (cohort) {
    case 'CHEAPEST_SANE':
      return 'Lowest price we can honestly recommend';
    case 'SAFEST':
      return 'The safer pick — refundable, direct, generous layover';
    case 'BEST_FIT':
      return 'Strong match with your preferences';
    case 'PREMIUM_WORTH_IT':
      return 'Costs more, but significantly better trip';
    case 'HIDDEN_GEM':
      return 'Destination you\u2019ve searched before, rarely this cheap';
    case 'WIDEN_TO_UNLOCK':
      return 'Best option today — widening dates unlocks more';
    case 'SMARTEST':
    default:
      if (s.valueForMoneyScore > 0.8 && s.convenienceScore > 0.75) return 'Well-priced and convenient';
      if (s.convenienceScore > 0.85) return 'Direct, well-timed';
      return 'Balanced on price, schedule, and fit';
  }
}

/* ── Why (one personalized sentence) ─────────────────── */

export function buildWhy(
  c: EnrichedCandidate,
  s: RankingScores,
  profile: UserTravelProfile,
  fused: FusedIntent
): string {
  const facts: string[] = [];

  // Strongest fit signal
  if (s.preferenceMatchScore > 0.75 && profile.dataRichness > 0.3) {
    facts.push('aligns with your past bookings');
  }
  // Price evidence
  if (c.features.priceValueZ > 1) {
    facts.push(`${Math.round(c.features.priceValueZ * 10) / 10}\u03c3 below typical`);
  }
  // Convenience
  if (c.features.stops === 0) facts.push('direct flight');
  else if (c.features.stops === 1 && c.features.layoverQuality > 0.7) {
    facts.push('short layover');
  }
  // Timing
  if (s.timingFitScore > 0.7 && profile.typicalLeadDays.n >= 3) {
    facts.push('fits your usual booking window');
  }
  // Source expansion honest disclosure
  if (c.sourceExpansion === 'date_flex') facts.push('unlocked by shifting dates');
  else if (c.sourceExpansion === 'airport_region') facts.push('via a nearby airport');
  else if (c.sourceExpansion === 'adjacent_dest') facts.push('at a nearby destination');

  // Fallback: generic but useful
  if (facts.length === 0) {
    return 'Balanced choice across price, convenience, and confidence.';
  }

  // Compose into one sentence
  return ['This option', ...facts].join(', ').replace(/,([^,]*)$/, ' and$1') + '.';
}

/* ── Evidence chips ─────────────────────────────────── */

export function buildEvidence(c: EnrichedCandidate, s: RankingScores): string[] {
  const ev: string[] = [];
  const f = c.features;

  if (f.stops === 0) ev.push('direct');
  else if (f.stops === 1) ev.push('one stop');

  if (f.baggageIncluded) ev.push('bag included');
  if (f.refundability === 'refundable') ev.push('refundable');
  if (f.refundability === 'partial') ev.push('partial refund');

  if (f.baselineDataPoints >= 60) ev.push(`${f.baselineDataPoints} fares analyzed`);
  else if (f.baselineDataPoints >= 20) ev.push(`${f.baselineDataPoints} data points`);

  if (s.valueForMoneyScore > 0.85) ev.push('rare opportunity');
  if (s.confidenceScore > 0.7) ev.push('high confidence');

  return ev.slice(0, 4);
}

/* ── Caveats ────────────────────────────────────────── */

export function buildCaveats(c: EnrichedCandidate, s: RankingScores): string[] {
  const caveats: string[] = [];
  const f = c.features;

  if (s.confidenceScore < 0.3) caveats.push('limited history for this route');
  if (f.stops >= 2) caveats.push('multiple stops');
  if (f.layoverQuality < 0.4 && f.stops > 0) caveats.push('tight layover');
  if (f.redEye) caveats.push('overnight departure');
  if (!f.baggageIncluded) caveats.push('baggage extra');
  if (f.refundability === 'none') caveats.push('non-refundable');

  return caveats.slice(0, 3);
}

/* ── Contrarian warning ─────────────────────────────── */

export function buildContrarian(
  c: EnrichedCandidate,
  s: RankingScores,
  profile: UserTravelProfile
): string | undefined {
  // Only warn when price is seductive but regret risk is real
  if (s.regretRiskScore > 0.5 && s.valueForMoneyScore > 0.75) {
    const concerns: string[] = [];
    if (c.features.stops >= 2) concerns.push('two stops');
    if (c.features.layoverQuality < 0.4) concerns.push('tight layover');
    if (c.features.redEye) concerns.push('red-eye');
    if (!c.features.baggageIncluded) concerns.push('no bag');
    if (c.features.refundability === 'none') concerns.push('non-refundable');
    if (concerns.length >= 2) {
      return `Cheaper, but ${concerns.slice(0, 2).join(' + ')} — not recommended unless price is the only lever.`;
    }
  }

  // Hotel-sensitive user + decent flight + weak hotel
  if (
    profile.hotelSensitivity.value > 0.55 &&
    c.features.hotelQualityScore != null &&
    c.features.hotelQualityScore < 0.45
  ) {
    return 'Flight is fine, hotel is weaker than your usual — consider booking the flight alone.';
  }

  return undefined;
}

/* ── Public entrypoint ──────────────────────────────── */

export interface ExplainV2Input {
  candidate: EnrichedCandidate;
  scores: RankingScores;
  cohort: CohortV2;
  baseline: PriceBaseline | null;
  profile: UserTravelProfile;
  fused: FusedIntent;
}

export interface ExplanationV2 {
  headline: string;
  why: string;
  evidence: string[];
  caveats: string[];
  contrarian?: string;
  cohort: CohortV2;
  confidence: number;
}

export function generateExplanation(input: ExplainV2Input): ExplanationV2 {
  return {
    headline: buildHeadline(input.candidate, input.scores, input.cohort, input.baseline, input.profile),
    why: buildWhy(input.candidate, input.scores, input.profile, input.fused),
    evidence: buildEvidence(input.candidate, input.scores),
    caveats: buildCaveats(input.candidate, input.scores),
    contrarian: buildContrarian(input.candidate, input.scores, input.profile),
    cohort: input.cohort,
    confidence: input.scores.confidenceScore,
  };
}
