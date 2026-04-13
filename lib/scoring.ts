import type {
  Offer,
  MarketSignal,
  AgentDecision,
  DealQuality,
  OfferLabel,
  Mission,
} from './types';

// ---------------------------------------------------------------------------
// Weight configuration
// ---------------------------------------------------------------------------

const WEIGHTS = {
  price: 0.4,
  carbon: 0.15,
  duration: 0.15,
  stops: 0.1,
  time: 0.1,
  deal: 0.1,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise a value between min and max into 0-100 (lower raw = higher score). */
function inverseLerp(value: number, min: number, max: number): number {
  if (max === min) return 100;
  return Math.max(0, Math.min(100, ((max - value) / (max - min)) * 100));
}

/** Preferred departure windows: 7-10 AM and 5-8 PM score highest. */
function timeScore(departureTime?: string): number {
  if (!departureTime) return 50; // neutral when unknown
  const date = new Date(departureTime);
  const hour = date.getHours();
  if (hour >= 7 && hour <= 10) return 100;
  if (hour >= 17 && hour <= 20) return 90;
  if (hour >= 6 && hour <= 22) return 60;
  return 20;
}

/** Map percentile to deal quality. */
function percentileToDealQuality(percentile: number): DealQuality {
  if (percentile <= 15) return 'excellent';
  if (percentile <= 40) return 'good';
  if (percentile <= 70) return 'fair';
  return 'poor';
}

/** Map deal quality to a 0-100 sub-score. */
function dealQualityScore(quality: DealQuality): number {
  switch (quality) {
    case 'excellent':
      return 100;
    case 'good':
      return 75;
    case 'fair':
      return 45;
    case 'poor':
      return 15;
  }
}

// ---------------------------------------------------------------------------
// Public: scoreOffers
// ---------------------------------------------------------------------------

export interface ScoredOffer extends Offer {
  score: number;
  dealQuality: DealQuality;
  label?: OfferLabel;
  explanation: string;
}

/**
 * Score an array of offers against market signals and return them sorted
 * by composite score descending. Each offer receives:
 * - score (0-100)
 * - dealQuality
 * - label (best_value / cheapest / fastest / greenest / recommended)
 * - human-readable explanation
 */
export function scoreOffers(
  offers: Offer[],
  signal: MarketSignal
): ScoredOffer[] {
  if (offers.length === 0) return [];

  // Compute per-dimension min/max across all offers
  const prices = offers.map((o) => o.priceUsd);
  const carbons = offers.map((o) => o.carbonKg ?? 0);
  const durations = offers.map((o) => o.durationMinutes ?? 0);
  const stopsArr = offers.map((o) => o.stops ?? 0);

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minCarbon = Math.min(...carbons);
  const maxCarbon = Math.max(...carbons);
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);
  const minStops = Math.min(...stopsArr);
  const maxStops = Math.max(...stopsArr);

  const scored: ScoredOffer[] = offers.map((offer) => {
    const pScore = inverseLerp(offer.priceUsd, minPrice, maxPrice);

    const cScore =
      offer.carbonKg != null
        ? inverseLerp(offer.carbonKg, minCarbon, maxCarbon)
        : 50;

    const dScore =
      offer.durationMinutes != null
        ? inverseLerp(offer.durationMinutes, minDuration, maxDuration)
        : 50;

    const sScore =
      offer.stops != null ? inverseLerp(offer.stops, minStops, maxStops) : 50;

    const tScore = timeScore(offer.departureTime);

    // Percentile of this offer price within the market signal range
    const priceRange = signal.maxPrice - signal.minPrice;
    const percentile =
      priceRange > 0
        ? ((offer.priceUsd - signal.minPrice) / priceRange) * 100
        : 50;
    const quality = percentileToDealQuality(percentile);
    const dqScore = dealQualityScore(quality);

    const composite = Math.round(
      pScore * WEIGHTS.price +
        cScore * WEIGHTS.carbon +
        dScore * WEIGHTS.duration +
        sScore * WEIGHTS.stops +
        tScore * WEIGHTS.time +
        dqScore * WEIGHTS.deal
    );

    const parts: string[] = [];
    if (quality === 'excellent' || quality === 'good')
      parts.push(`${quality} deal (${Math.round(percentile)}th percentile)`);
    if (offer.stops === 0) parts.push('nonstop');
    if (offer.carbonKg != null && cScore >= 80)
      parts.push('low carbon footprint');
    if (tScore >= 90) parts.push('convenient departure time');

    return {
      ...offer,
      score: composite,
      dealQuality: quality,
      explanation:
        parts.length > 0
          ? parts.join(', ')
          : `Score ${composite}/100 based on price, duration, and eco factors`,
    };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // Assign labels
  assignLabels(scored);

  return scored;
}

// ---------------------------------------------------------------------------
// Label assignment
// ---------------------------------------------------------------------------

function assignLabels(scored: ScoredOffer[]): void {
  if (scored.length === 0) return;

  // Best value = highest composite (already sorted, index 0)
  scored[0].label = 'best_value';

  // Cheapest
  const cheapest = scored.reduce((prev, cur) =>
    cur.priceUsd < prev.priceUsd ? cur : prev
  );
  if (!cheapest.label) cheapest.label = 'cheapest';

  // Fastest
  const fastest = scored.reduce((prev, cur) => {
    const prevD = prev.durationMinutes ?? Infinity;
    const curD = cur.durationMinutes ?? Infinity;
    return curD < prevD ? cur : prev;
  });
  if (!fastest.label) fastest.label = 'fastest';

  // Greenest
  const greenest = scored.reduce((prev, cur) => {
    const prevC = prev.carbonKg ?? Infinity;
    const curC = cur.carbonKg ?? Infinity;
    return curC < prevC ? cur : prev;
  });
  if (!greenest.label) greenest.label = 'greenest';

  // Mark remaining high-score offers as recommended
  for (const o of scored) {
    if (!o.label && o.score >= 70) {
      o.label = 'recommended';
    }
  }
}

// ---------------------------------------------------------------------------
// Public: makeDecision
// ---------------------------------------------------------------------------

/**
 * Evaluate the best scored offer against the mission parameters and market
 * signals to produce an AgentDecision (WAIT / RECOMMEND / AUTO_BUY).
 */
export function makeDecision(
  scoredOffers: ScoredOffer[],
  mission: Pick<
    Mission,
    'id' | 'maxBudgetUsd' | 'autoBuyThresholdUsd' | 'departDate'
  >,
  signal: MarketSignal
): AgentDecision {
  const now = new Date().toISOString();

  if (scoredOffers.length === 0) {
    return {
      missionId: mission.id,
      action: 'WAIT',
      confidence: 0,
      reason: 'No offers available to evaluate.',
      predictedTrend: signal.trend,
      timestamp: now,
    };
  }

  const best = scoredOffers[0];
  const percentile =
    signal.maxPrice > signal.minPrice
      ? ((best.priceUsd - signal.minPrice) /
          (signal.maxPrice - signal.minPrice)) *
        100
      : 50;

  // --- AUTO_BUY ---
  if (
    mission.autoBuyThresholdUsd != null &&
    best.priceUsd <= mission.autoBuyThresholdUsd &&
    best.priceUsd <= mission.maxBudgetUsd &&
    best.dealQuality !== 'poor'
  ) {
    const confidence = Math.min(95, Math.round(60 + best.score * 0.35));
    return {
      missionId: mission.id,
      selectedOfferId: best.id,
      action: 'AUTO_BUY',
      confidence,
      reason: `Price $${best.priceUsd} is at or below auto-buy threshold $${mission.autoBuyThresholdUsd} (${best.dealQuality} deal, ${Math.round(percentile)}th percentile).`,
      pricePercentile: Math.round(percentile),
      predictedTrend: signal.trend,
      timestamp: now,
    };
  }

  // --- RECOMMEND ---
  const shouldRecommend =
    best.priceUsd <= mission.maxBudgetUsd &&
    (best.score >= 65 ||
      best.dealQuality === 'excellent' ||
      best.dealQuality === 'good' ||
      signal.trend === 'rising' ||
      signal.daysUntilDeparture <= 7);

  if (shouldRecommend) {
    const urgencyBonus = signal.daysUntilDeparture <= 3 ? 15 : 0;
    const trendBonus = signal.trend === 'rising' ? 10 : 0;
    const confidence = Math.min(
      90,
      Math.round(40 + best.score * 0.3 + urgencyBonus + trendBonus)
    );

    const reasons: string[] = [];
    reasons.push(
      `$${best.priceUsd} is within budget ($${mission.maxBudgetUsd})`
    );
    if (best.dealQuality === 'excellent' || best.dealQuality === 'good')
      reasons.push(`${best.dealQuality} deal`);
    if (signal.trend === 'rising') reasons.push('prices trending up');
    if (signal.daysUntilDeparture <= 7)
      reasons.push(`only ${signal.daysUntilDeparture} days until departure`);

    return {
      missionId: mission.id,
      selectedOfferId: best.id,
      action: 'RECOMMEND',
      confidence,
      reason: reasons.join('; ') + '.',
      pricePercentile: Math.round(percentile),
      predictedTrend: signal.trend,
      timestamp: now,
    };
  }

  // --- WAIT ---
  const reasons: string[] = [];
  if (best.priceUsd > mission.maxBudgetUsd)
    reasons.push(
      `best price $${best.priceUsd} exceeds budget $${mission.maxBudgetUsd}`
    );
  if (signal.trend === 'falling') reasons.push('prices are trending down');
  if (best.score < 65) reasons.push(`best score only ${best.score}/100`);
  if (signal.daysUntilDeparture > 30)
    reasons.push(`${signal.daysUntilDeparture} days out, time to wait`);

  return {
    missionId: mission.id,
    selectedOfferId: best.id,
    action: 'WAIT',
    confidence: Math.min(80, Math.round(30 + (100 - best.score) * 0.3)),
    reason:
      reasons.length > 0
        ? reasons.join('; ') + '.'
        : 'Current offers do not meet recommendation thresholds.',
    pricePercentile: Math.round(percentile),
    predictedTrend: signal.trend,
    timestamp: now,
  };
}
