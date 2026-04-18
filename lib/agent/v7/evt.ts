/**
 * Extreme Value Theory — Generalized Pareto Distribution (GPD) for tail events.
 *
 * Models the lower tail of the price distribution to estimate:
 *   - P(mistake fare) = probability of an extreme price drop
 *   - Expected minimum under extreme conditions
 *   - Return levels (e.g., "what is the 1-in-100 lowest price?")
 *
 * Method: Peaks-Over-Threshold (POT) with adaptive threshold at the
 * 5th percentile of the rolling price distribution.
 *
 * Parameters (ξ, σ) estimated via MLE or Probability Weighted Moments (PWM).
 *
 * Ref: Coles (2001), "An Introduction to Statistical Modeling of Extreme Values"
 */

import type { PredictionContext, SubModelOutput, V7Action } from './types';

export interface GPDParams {
  /** Shape parameter. ξ < 0 → bounded tail (Weibull), ξ > 0 → heavy tail (Fréchet) */
  xi: number;
  /** Scale parameter σ > 0 */
  sigma: number;
  /** Threshold used for POT selection */
  threshold: number;
  /** Number of exceedances used for fitting */
  nExceedances: number;
}

/**
 * Fit GPD to threshold exceedances using Probability Weighted Moments (PWM).
 * More robust than MLE for small samples.
 *
 * @param exceedances - values BELOW the threshold (negated so they're positive)
 */
export function fitGPD_PWM(exceedances: number[]): { xi: number; sigma: number } | null {
  const n = exceedances.length;
  if (n < 5) return null;

  const sorted = [...exceedances].sort((a, b) => a - b);

  // L-moments (probability weighted moments)
  let b0 = 0;
  let b1 = 0;
  for (let i = 0; i < n; i++) {
    b0 += sorted[i];
    b1 += sorted[i] * i / (n - 1);
  }
  b0 /= n;
  b1 /= n;

  // PWM estimators for GPD
  // ξ = 2 - b0 / (b0 - 2*b1)
  // σ = 2 * b0 * b1 / (b0 - 2*b1)
  const denom = b0 - 2 * b1;
  if (Math.abs(denom) < 1e-10) return null;

  const xi = 2 - b0 / denom;
  const sigma = (2 * b0 * b1) / denom;

  if (sigma <= 0) return null;
  if (xi < -1 || xi > 2) return null; // sanity bounds

  return { xi, sigma };
}

/**
 * GPD survival function: P(X > x | X > threshold) = (1 + ξ·x/σ)^(-1/ξ)
 */
export function gpdSurvival(x: number, xi: number, sigma: number): number {
  if (sigma <= 0) return 0;
  if (Math.abs(xi) < 1e-8) {
    // Exponential limit
    return Math.exp(-x / sigma);
  }
  const t = 1 + (xi * x) / sigma;
  if (t <= 0) return xi < 0 ? 0 : 1;
  return Math.pow(t, -1 / xi);
}

/**
 * Return level: price exceeded once in every m observations.
 * x_m = threshold + (σ/ξ) · [(m·P(X>u))^ξ - 1]
 */
export function returnLevel(
  m: number,
  params: GPDParams,
  totalObservations: number
): number {
  const { xi, sigma, threshold, nExceedances } = params;
  const exceedRate = nExceedances / Math.max(1, totalObservations);

  if (Math.abs(xi) < 1e-8) {
    return threshold - sigma * Math.log(m * exceedRate);
  }
  return threshold - (sigma / xi) * (Math.pow(m * exceedRate, xi) - 1);
}

/**
 * V7 sub-model: EVT-based extreme price prediction.
 */
export function predictEVT(ctx: PredictionContext): SubModelOutput {
  const prices = ctx.priceSeries.map((p) => p.price);
  if (prices.length < 10) {
    return {
      modelId: 'evt',
      action: 'MONITOR',
      confidence: 0.1,
      probBetter: 0.5,
      expectedFloor: ctx.currentPrice,
    };
  }

  // Compute adaptive threshold at 10th percentile
  const sorted = [...prices].sort((a, b) => a - b);
  const thresholdIdx = Math.max(0, Math.floor(prices.length * 0.1));
  const threshold = sorted[thresholdIdx];

  // Exceedances below threshold (negated for GPD fitting)
  const exceedances = sorted
    .filter((p) => p <= threshold)
    .map((p) => threshold - p);

  const params = fitGPD_PWM(exceedances);

  if (!params || exceedances.length < 3) {
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    return {
      modelId: 'evt',
      action: 'MONITOR',
      confidence: 0.15,
      probBetter: 0.5,
      expectedFloor: Math.min(...prices) * 0.95,
      meta: { reason: 'insufficient_exceedances' },
    };
  }

  const gpdParams: GPDParams = {
    xi: params.xi,
    sigma: params.sigma,
    threshold,
    nExceedances: exceedances.length,
  };

  // Return levels
  const rl100 = returnLevel(100, gpdParams, prices.length); // 1-in-100 low
  const rl50 = returnLevel(50, gpdParams, prices.length);  // 1-in-50 low

  // Is current price in the tail?
  const isInTail = ctx.currentPrice <= threshold;
  const probCurrentIsMistake =
    isInTail && params.sigma > 0
      ? gpdSurvival(threshold - ctx.currentPrice, params.xi, params.sigma) *
        (exceedances.length / prices.length)
      : 0;

  // Decision
  let action: V7Action = 'MONITOR';
  let probBetter = 0.5;

  if (probCurrentIsMistake > 0.3) {
    // Likely a mistake fare — BUY IMMEDIATELY
    action = 'BUY_NOW';
    probBetter = 0.02; // almost certainly won't see lower
  } else if (isInTail) {
    action = 'BUY_NOW';
    probBetter = 0.1;
  } else if (ctx.currentPrice > threshold * 1.3) {
    // Price is way above tail — could come down
    action = ctx.ttd > 30 ? 'WAIT' : 'MONITOR';
    probBetter = ctx.ttd > 30 ? 0.6 : 0.35;
  }

  const confidence = Math.min(0.9,
    0.3 + 0.3 * Math.min(1, exceedances.length / 10) +
    0.4 * (isInTail ? 0.8 : 0.3)
  );

  return {
    modelId: 'evt',
    action,
    confidence,
    probBetter,
    expectedFloor: Math.max(0, rl100),
    meta: {
      xi: params.xi,
      sigma: params.sigma,
      threshold,
      nExceedances: exceedances.length,
      returnLevel100: rl100,
      returnLevel50: rl50,
      probCurrentIsMistake,
      isInTail,
    },
  };
}
