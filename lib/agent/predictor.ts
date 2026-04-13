/**
 * The Predictor.
 *
 * Given a current price observation + the route's historical baseline,
 * returns a concrete decision the agent acts on:
 *
 *   BUY_NOW : strong signal to capture funds immediately
 *   MONITOR : price is fair, keep watching
 *   WAIT    : price is above normal, don't buy yet
 *
 * The decision is driven by four independent signals, each weighted
 * by the baseline's reliability:
 *
 *   1. Z-score vs historical mean (primary signal)
 *   2. Empirical percentile rank (backup when stdev is noisy)
 *   3. Trend direction ($/day slope over last 7 days)
 *   4. Time-to-departure pressure (closer flights MUST buy sooner)
 *
 * The output is NOT a black-box score — every field is explainable
 * so users see exactly why the agent recommends what it does. This
 * is what differentiates us from "AI" products that just pattern-match.
 */

import type { PriceSample } from './price-history';
import {
  computeBaseline,
  percentileRank,
  zScore,
  type Baseline,
} from './baselines';

export type PredictorAction = 'BUY_NOW' | 'MONITOR' | 'WAIT';

export interface Prediction {
  action: PredictorAction;
  /** 0-1 confidence the recommendation is correct */
  confidence: number;
  /** Primary signals */
  zScore: number;
  percentile: number;
  /** Trend */
  trend: 'falling' | 'rising' | 'stable' | 'unknown';
  trendSlopePerDay: number;
  /** Time-to-departure bucket */
  daysUntilDeparture: number;
  /** Expected savings vs buying now, if the user waits 7 days.
   *  Negative means waiting costs money (prices rising). */
  expectedSavingsIfWait: number;
  /** Probability we'll see a better price in the next 7 days */
  probabilityBeaten7d: number;
  /** Dataset context */
  baseline: Baseline | null;
  sampleCount: number;
  /** Natural-language explanation (to display to user + investors) */
  reason: string;
  /** Sub-scores that composed the final action, for debugging */
  subScores: {
    zScoreScore: number;
    percentileScore: number;
    trendScore: number;
    ttdScore: number;
  };
}

export interface PredictorInput {
  /** Current price we're evaluating (the cheapest offer from this sweep) */
  currentPrice: number;
  /** Days between now and the mission's departure date */
  daysUntilDeparture: number;
  /** Historical samples for the same route AND the same TTD window */
  windowSamples: PriceSample[];
  /** All samples for the route (broader context, used for percentile) */
  allSamples: PriceSample[];
}

// ------------------------------------------------------------------
// Thresholds (tunable)
// ------------------------------------------------------------------
/** z-score below this triggers BUY_NOW consideration */
const Z_BUY_THRESHOLD = -0.8;
/** z-score above this triggers WAIT consideration */
const Z_WAIT_THRESHOLD = 0.6;
/** Percentile rank below this is considered a buy signal */
const PCT_BUY_THRESHOLD = 20;
/** Percentile rank above this is considered a wait signal */
const PCT_WAIT_THRESHOLD = 70;
/** Trend slope more negative than this = "falling fast, might be worth waiting" */
const TREND_FALLING_FAST = -5;
/** Trend slope more positive than this = "rising fast, BUY NOW" */
const TREND_RISING_FAST = 5;
/** Minimum samples for full-confidence prediction */
const MIN_CONFIDENT_SAMPLES = 30;
/** Minimum samples to make ANY recommendation */
const MIN_USABLE_SAMPLES = 5;

// ------------------------------------------------------------------
// Public: predict()
// ------------------------------------------------------------------
export function predict(input: PredictorInput): Prediction {
  const baseline = computeBaseline(input.windowSamples);
  const sampleCount = input.windowSamples.length;
  const daysUntilDeparture = input.daysUntilDeparture;

  // ----------------------------------------------------------------
  // COLD START — not enough data to predict, fall back to rules
  // ----------------------------------------------------------------
  if (!baseline || sampleCount < MIN_USABLE_SAMPLES) {
    return coldStartPrediction(
      input.currentPrice,
      daysUntilDeparture,
      sampleCount,
      baseline
    );
  }

  // ----------------------------------------------------------------
  // 1. Z-SCORE SIGNAL
  // ----------------------------------------------------------------
  const z = zScore(input.currentPrice, baseline);
  //   z < -0.8  → strong buy (score +1)
  //   -0.8..0   → mild buy  (score +0.5 * -z/0.8)
  //   0..0.6    → neutral
  //   > 0.6     → wait
  let zScoreScore = 0;
  if (z <= Z_BUY_THRESHOLD) zScoreScore = 1;
  else if (z < 0) zScoreScore = -z / Math.abs(Z_BUY_THRESHOLD);
  else if (z >= Z_WAIT_THRESHOLD) zScoreScore = -1;
  else zScoreScore = -z / Z_WAIT_THRESHOLD;

  // ----------------------------------------------------------------
  // 2. PERCENTILE SIGNAL
  // ----------------------------------------------------------------
  const percentile = percentileRank(input.currentPrice, input.allSamples);
  let percentileScore = 0;
  if (percentile <= PCT_BUY_THRESHOLD) percentileScore = 1;
  else if (percentile >= PCT_WAIT_THRESHOLD) percentileScore = -1;
  else {
    // linear interpolation between buy and wait thresholds
    const mid = (PCT_BUY_THRESHOLD + PCT_WAIT_THRESHOLD) / 2;
    percentileScore = (mid - percentile) / (PCT_WAIT_THRESHOLD - mid);
  }

  // ----------------------------------------------------------------
  // 3. TREND SIGNAL
  //   Rising prices (positive slope) → buy now before it gets worse
  //   Falling prices (negative slope) → wait for the drop
  //   Stable → neutral
  // ----------------------------------------------------------------
  const slope = baseline.trendSlopePerDay;
  let trend: Prediction['trend'] = 'unknown';
  let trendScore = 0;
  if (baseline.trendR2 < 0.25 || baseline.trendWindowDays < 2) {
    trend = 'unknown';
  } else if (slope <= TREND_FALLING_FAST) {
    trend = 'falling';
    trendScore = -0.7; // the price is falling fast, maybe wait
  } else if (slope < 0) {
    trend = 'falling';
    trendScore = -0.3;
  } else if (slope >= TREND_RISING_FAST) {
    trend = 'rising';
    trendScore = 0.9; // rising fast, BUY before worse
  } else if (slope > 0) {
    trend = 'rising';
    trendScore = 0.4;
  } else {
    trend = 'stable';
    trendScore = 0;
  }

  // ----------------------------------------------------------------
  // 4. TIME-TO-DEPARTURE PRESSURE
  //   < 14 days  → urgent, bias toward BUY regardless of stats
  //   14-30 days → mild buy pressure
  //   30-60 days → neutral
  //   > 60 days  → mild wait pressure (prices usually drop)
  // ----------------------------------------------------------------
  let ttdScore = 0;
  if (daysUntilDeparture < 7) ttdScore = 1;
  else if (daysUntilDeparture < 14) ttdScore = 0.7;
  else if (daysUntilDeparture < 30) ttdScore = 0.2;
  else if (daysUntilDeparture < 60) ttdScore = -0.1;
  else ttdScore = -0.3;

  // ----------------------------------------------------------------
  // COMBINE
  // ----------------------------------------------------------------
  // Weights chosen empirically — z-score is the strongest signal,
  // trend adds dynamism, TTD is the kill switch for urgent flights.
  const composite =
    0.4 * zScoreScore +
    0.25 * percentileScore +
    0.2 * trendScore +
    0.15 * ttdScore;

  let action: PredictorAction;
  if (composite >= 0.4) action = 'BUY_NOW';
  else if (composite <= -0.3) action = 'WAIT';
  else action = 'MONITOR';

  // ----------------------------------------------------------------
  // CONFIDENCE
  // ----------------------------------------------------------------
  // Base confidence comes from sample depth + trend R².
  // Attenuated by edge-case proximity (composite near zero = low confidence).
  const sampleConfidence = Math.min(1, sampleCount / MIN_CONFIDENT_SAMPLES);
  const trendConfidence = trend === 'unknown' ? 0.4 : 0.6 + baseline.trendR2 * 0.4;
  const compositeCertainty = Math.min(1, Math.abs(composite) * 2);
  const confidence =
    sampleConfidence * 0.5 + trendConfidence * 0.2 + compositeCertainty * 0.3;

  // ----------------------------------------------------------------
  // EXPECTED VALUE OF WAITING
  // ----------------------------------------------------------------
  // Naive projection: current price + 7 days of trend slope.
  const projected7d = input.currentPrice + slope * 7;
  const expectedSavingsIfWait = round2(
    input.currentPrice - Math.max(baseline.min, projected7d)
  );

  // Prob we beat this price in 7d — combine trend + empirical beat rate
  const empiricalBeat =
    input.allSamples.filter((s) => s.priceUsd < input.currentPrice).length /
    Math.max(1, input.allSamples.length);
  const trendAdjust =
    trend === 'falling' ? 0.2 : trend === 'rising' ? -0.25 : 0;
  const probabilityBeaten7d = Math.max(
    0,
    Math.min(0.95, empiricalBeat + trendAdjust)
  );

  // ----------------------------------------------------------------
  // REASON (natural language)
  // ----------------------------------------------------------------
  const reason = buildReason({
    action,
    price: input.currentPrice,
    baseline,
    percentile,
    zScoreVal: z,
    trend,
    slope,
    ttd: daysUntilDeparture,
    probabilityBeaten7d,
    sampleCount,
  });

  return {
    action,
    confidence: round3(Math.max(0, Math.min(1, confidence))),
    zScore: round2(z),
    percentile,
    trend,
    trendSlopePerDay: round2(slope),
    daysUntilDeparture,
    expectedSavingsIfWait,
    probabilityBeaten7d: round2(probabilityBeaten7d),
    baseline,
    sampleCount,
    reason,
    subScores: {
      zScoreScore: round2(zScoreScore),
      percentileScore: round2(percentileScore),
      trendScore: round2(trendScore),
      ttdScore: round2(ttdScore),
    },
  };
}

// ------------------------------------------------------------------
// Cold start — not enough history, fall back to conservative rules
// ------------------------------------------------------------------
function coldStartPrediction(
  price: number,
  ttd: number,
  sampleCount: number,
  baseline: Baseline | null
): Prediction {
  // Without history we can't really predict. Be conservative:
  // - < 14 days out: BUY_NOW with low confidence (can't risk losing it)
  // - otherwise: MONITOR while we build up data
  const action: PredictorAction = ttd < 14 ? 'BUY_NOW' : 'MONITOR';
  const confidence = Math.min(0.35, 0.1 + sampleCount * 0.04);
  const reason =
    sampleCount === 0
      ? `First time watching this route. Building baseline — the agent will make stronger recommendations once it has 10+ observations.`
      : `Still learning this route (${sampleCount} observation${sampleCount > 1 ? 's' : ''} so far). ${
          ttd < 14
            ? `With only ${ttd} days until departure, I recommend locking in the current price.`
            : `Monitoring until I have enough data to predict confidently.`
        }`;

  return {
    action,
    confidence: round3(confidence),
    zScore: 0,
    percentile: 50,
    trend: 'unknown',
    trendSlopePerDay: 0,
    daysUntilDeparture: ttd,
    expectedSavingsIfWait: 0,
    probabilityBeaten7d: 0.5,
    baseline,
    sampleCount,
    reason,
    subScores: {
      zScoreScore: 0,
      percentileScore: 0,
      trendScore: 0,
      ttdScore: ttd < 14 ? 1 : 0,
    },
  };
}

// ------------------------------------------------------------------
// Natural language reasoning
// ------------------------------------------------------------------
function buildReason(args: {
  action: PredictorAction;
  price: number;
  baseline: Baseline;
  percentile: number;
  zScoreVal: number;
  trend: Prediction['trend'];
  slope: number;
  ttd: number;
  probabilityBeaten7d: number;
  sampleCount: number;
}): string {
  const { action, price, baseline, percentile, zScoreVal, trend, slope, ttd, probabilityBeaten7d, sampleCount } = args;
  const diffPct = Math.round(((price - baseline.mean) / baseline.mean) * 100);
  const belowAbove = diffPct < 0 ? 'below' : 'above';
  const trendDesc =
    trend === 'falling'
      ? `prices have been falling about $${Math.abs(Math.round(slope))}/day`
      : trend === 'rising'
      ? `prices have been rising about $${Math.round(slope)}/day`
      : trend === 'stable'
      ? `prices have been flat`
      : `no clear trend yet`;

  if (action === 'BUY_NOW') {
    return `$${price} is ${Math.abs(diffPct)}% ${belowAbove} the $${Math.round(
      baseline.mean
    )} average for this route (${sampleCount} samples, ${trendDesc}). Only ${percentile}% of historical prices beat this one. Probability of seeing better in the next 7 days: ${Math.round(
      probabilityBeaten7d * 100
    )}%. ${ttd < 14 ? `With ${ttd} days until departure, I strongly recommend capturing now.` : `Strong buy.`}`;
  }
  if (action === 'WAIT') {
    return `$${price} is ${Math.abs(diffPct)}% ${belowAbove} the $${Math.round(
      baseline.mean
    )} average (${sampleCount} samples, ${trendDesc}). ${percentile}% of historical prices beat this one. ${Math.round(
      probabilityBeaten7d * 100
    )}% chance of a better price in the next week — I'll hold and keep watching.`;
  }
  return `$${price} is ${Math.abs(diffPct)}% ${belowAbove} the $${Math.round(
    baseline.mean
  )} average (${sampleCount} samples, ${trendDesc}). Sitting at the ${percentile}th percentile — fair price but not a steal. I'll keep an eye on it.`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
