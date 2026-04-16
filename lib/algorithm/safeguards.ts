/**
 * Trust / Fail-safe Layer.
 *
 * A candidate can score well on paper and still be a bad recommendation for
 * *this* user. These rules veto unsafe surface-level wins and are the
 * difference between a smart system and a careless one.
 *
 * Rules are hard: a veto here removes the candidate from the ranked set.
 * Vetoed candidates are still tracked (for analytics + explanation) so we
 * can say "we hid 4 options because of these reasons."
 */

import type {
  EnrichedCandidate,
  RankingScores,
  SafeguardReason,
  SafeguardResult,
  UserTravelProfile,
} from './types';

export interface IsSafeInput {
  candidate: EnrichedCandidate;
  scores: RankingScores;
  profile: UserTravelProfile;
}

export function isSafeToSurface(input: IsSafeInput): SafeguardResult {
  const { candidate: c, scores: s, profile: p } = input;
  const f = c.features;

  // Rule 1 — Cheap but painful trap
  // Strong price signal (VfM > 0.85) + very weak convenience = regret generator,
  // unless the user is explicitly price-first.
  const strongPrice = s.valueForMoneyScore > 0.85;
  if (strongPrice && s.convenienceScore < 0.25 && p.priceSensitivity.value < 0.75) {
    return { safe: false, reason: 'price_temptation_low_fit' };
  }

  // Rule 2 — Hotel veto for hotel-sensitive users
  if (
    p.hotelSensitivity.value > 0.55 &&
    p.hotelSensitivity.confidence > 0.3 &&
    f.hotelQualityScore != null &&
    f.hotelQualityScore < 0.3
  ) {
    return { safe: false, reason: 'hotel_veto' };
  }

  // Rule 3 — Certainty-sensitive users should not see high-regret options
  if (
    p.certaintySensitivity.value > 0.55 &&
    p.certaintySensitivity.confidence > 0.3 &&
    s.regretRiskScore > 0.6
  ) {
    return { safe: false, reason: 'regret_risk_for_certainty_user' };
  }

  // Rule 4 — Low confidence AND mediocre price: nothing compensates
  if (s.confidenceScore < 0.2 && s.valueForMoneyScore < 0.5) {
    return { safe: false, reason: 'low_confidence_no_price_compensation' };
  }

  // Rule 5 — Blows budget significantly
  if (f.priceVsBudget > 1.5) {
    return { safe: false, reason: 'blows_budget' };
  }

  // Rule 6 — Hidden cost trap
  if (f.hiddenCostRisk > 0.7) {
    return { safe: false, reason: 'hidden_cost_trap' };
  }

  // Rule 7 — Total fit is below noise floor
  const totalFit = (s.flightFitScore + s.preferenceMatchScore + s.timingFitScore) / 3;
  if (totalFit < 0.2 && s.valueForMoneyScore < 0.6) {
    return { safe: false, reason: 'fit_too_low' };
  }

  return { safe: true };
}

/* ── Human-readable reason text ── */

const REASON_COPY: Record<SafeguardReason, string> = {
  price_temptation_low_fit:
    'Cheap but the itinerary has multiple compromises. We hid it to avoid a regret booking.',
  hotel_veto:
    'The hotel quality in this bundle is too low relative to what you usually stay in.',
  regret_risk_for_certainty_user:
    'This option has a high regret risk, and your profile prefers reliable picks.',
  low_confidence_no_price_compensation:
    "We don't have enough history on this route to trust this recommendation.",
  blows_budget:
    'This option is more than 50% over your stated budget.',
  hidden_cost_trap:
    'Multiple hidden costs (non-refundable, no baggage, tight layover).',
  fit_too_low:
    "This doesn't match how you typically travel and the price alone doesn't justify it.",
};

export function reasonCopy(reason: SafeguardReason): string {
  return REASON_COPY[reason];
}
