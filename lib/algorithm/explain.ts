/**
 * Explanation generator — turns score vectors into one-line reasons + evidence.
 *
 * Every recommendation gets an Explanation. Users should never see an
 * unexplained pick. Copy is terse, factual, no hype.
 */

import type {
  AllScores,
  Cohort,
  Explanation,
  OfferFeatures,
  PriceBaseline,
} from './types';

export interface ExplainInput {
  offer: OfferFeatures;
  baseline: PriceBaseline | null;
  scores: AllScores;
  cohorts: Cohort[];
  destinationName?: string;
}

export function explain(input: ExplainInput): Explanation {
  const { offer, baseline, scores, cohorts } = input;

  const primaryCohort: Cohort = cohorts[0] ?? 'SMARTEST';

  return {
    headline: buildHeadline(primaryCohort, offer, baseline, scores),
    cohort: primaryCohort,
    evidence: buildEvidence(offer, baseline, scores),
    caveats: buildCaveats(offer, scores),
    confidence: scores.confidenceScore,
  };
}

function buildHeadline(
  cohort: Cohort,
  offer: OfferFeatures,
  baseline: PriceBaseline | null,
  scores: AllScores
): string {
  // Prefer concrete, percentage-based statements over labels.
  if (baseline && baseline.median > 0) {
    const delta = Math.round(((baseline.median - offer.priceUsd) / baseline.median) * 100);

    if (delta >= 25) return `${delta}% below typical for this route`;
    if (delta >= 12) return `${delta}% below typical — a strong deal`;
    if (delta >= 3) return `Slightly below typical (${delta}%)`;
    if (delta >= -5) return `In line with typical pricing`;
    if (delta >= -15) return `${Math.abs(delta)}% above typical — consider widening`;
    return `${Math.abs(delta)}% above typical`;
  }

  switch (cohort) {
    case 'CHEAPEST':
      return 'The lowest price we found';
    case 'SAFEST':
      return 'Calmest pick — refundable, direct, generous layover';
    case 'BEST_FIT':
      return 'Matches how you usually travel';
    case 'WIDEN_TO_UNLOCK':
      return 'Our best current option — widening could unlock more';
    case 'SMARTEST':
    default:
      if (scores.priceValueScore > 0.8 && scores.convenienceScore > 0.75) {
        return 'Well-priced and convenient';
      }
      if (scores.convenienceScore > 0.85) return 'Direct, well-timed, quality fare';
      return 'Balanced on price, schedule, and flexibility';
  }
}

function buildEvidence(
  offer: OfferFeatures,
  baseline: PriceBaseline | null,
  scores: AllScores
): string[] {
  const ev: string[] = [];

  if (offer.stops === 0) ev.push('direct');
  else if (offer.stops === 1) ev.push('one stop');
  else ev.push(`${offer.stops} stops`);

  if (offer.baggageIncluded) ev.push('baggage included');

  if (offer.cancelPolicy === 'refundable') ev.push('refundable');
  else if (offer.cancelPolicy === 'partial') ev.push('partial refund');

  if (baseline) {
    if (baseline.dataPoints >= 60) ev.push(`${baseline.dataPoints} fares analyzed`);
    else if (baseline.dataPoints >= 20) ev.push(`${baseline.dataPoints} data points`);
  }

  // Price-specific evidence
  if (scores.priceValueScore > 0.85) ev.push('rare opportunity');

  // Convenience
  const hr = new Date(offer.departureTime).getHours();
  if (hr >= 6 && hr < 10) ev.push('morning departure');
  else if (hr >= 17 && hr < 21) ev.push('evening departure');

  return ev.slice(0, 4);
}

function buildCaveats(offer: OfferFeatures, scores: AllScores): string[] {
  const caveats: string[] = [];

  if (scores.confidenceScore < 0.3) {
    caveats.push('low history — early estimate');
  }

  if (offer.stops >= 2) {
    caveats.push('multiple stops');
  }

  if ((offer.layoverQuality ?? 0.5) < 0.4 && offer.stops > 0) {
    caveats.push('tight layover');
  }

  const hr = new Date(offer.departureTime).getHours();
  if (hr < 6 || hr >= 23) {
    caveats.push('overnight departure');
  }

  if (!offer.baggageIncluded) {
    caveats.push('baggage extra');
  }

  if (offer.cancelPolicy === 'none') {
    caveats.push('non-refundable');
  }

  return caveats.slice(0, 3);
}

/* ── Verdict copy — used on watch-creation realism panel ── */

export function verdictCopy(
  verdict: 'easy' | 'likely' | 'tight' | 'unrealistic' | 'impossible' | 'insufficient_data'
): { title: string; body: string; tone: 'positive' | 'neutral' | 'warn' | 'block' | 'info' } {
  switch (verdict) {
    case 'easy':
      return {
        title: 'Very realistic',
        body: 'Your target is comfortable for this route and timeframe.',
        tone: 'positive',
      };
    case 'likely':
      return {
        title: 'Realistic',
        body: "We'll probably find something in 30 days.",
        tone: 'positive',
      };
    case 'tight':
      return {
        title: 'Tight, but possible',
        body: 'Widening dates, airports, or stops noticeably improves the odds.',
        tone: 'warn',
      };
    case 'unrealistic':
      return {
        title: 'Unlikely as set',
        body: "Few fares hit your target. Widen one lever to change that.",
        tone: 'warn',
      };
    case 'impossible':
      return {
        title: 'Below historical minimums',
        body: 'Your budget is below what this route has ever sold for recently.',
        tone: 'block',
      };
    case 'insufficient_data':
      return {
        title: 'Not enough history',
        body: "We don't have enough data on this route yet. We'll still watch — confidence is low.",
        tone: 'info',
      };
  }
}
