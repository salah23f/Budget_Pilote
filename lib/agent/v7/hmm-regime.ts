/**
 * Hidden Markov Model — 6-state regime detection for flight prices.
 *
 * States:
 *   PLATEAU_HIGH   — price stable at high level (loaded flights)
 *   DESCENT        — price falling toward floor (sales, low demand)
 *   OPTIMAL_FLOOR  — price at or near historical minimum (BUY zone)
 *   ASCENT         — price climbing from floor (demand returning)
 *   PANIC_LATE     — last-minute price surge (< 14 days)
 *   MISTAKE_FARE   — anomalously low price (error or flash sale)
 *
 * Emissions: Gaussian on (log_price_delta, normalized_price_level)
 * Transitions: pre-set based on airline pricing domain knowledge
 *
 * Online inference: Forward algorithm for P(state_t | observations_1:t)
 *
 * Ref: Rabiner 1989, "A Tutorial on HMM"
 */

import type { PredictionContext, RegimeName, RegimeState, SubModelOutput, V7Action } from './types';

const STATES: RegimeName[] = [
  'PLATEAU_HIGH', 'DESCENT', 'OPTIMAL_FLOOR', 'ASCENT', 'PANIC_LATE', 'MISTAKE_FARE',
];
const K = STATES.length;

/** Transition probability matrix (row = from, col = to) */
const TRANS: number[][] = [
  // PH     DESC   FLOOR  ASC    PANIC  MIST
  [0.70,  0.20,  0.03,  0.02,  0.04,  0.01], // PLATEAU_HIGH
  [0.05,  0.65,  0.25,  0.02,  0.01,  0.02], // DESCENT
  [0.02,  0.05,  0.70,  0.20,  0.01,  0.02], // OPTIMAL_FLOOR
  [0.10,  0.02,  0.03,  0.75,  0.08,  0.02], // ASCENT
  [0.05,  0.02,  0.01,  0.02,  0.88,  0.02], // PANIC_LATE
  [0.10,  0.15,  0.50,  0.05,  0.05,  0.15], // MISTAKE_FARE
];

/** Emission parameters: (mean, stdev) for normalized price level per state */
interface EmissionParams {
  priceLevelMean: number;   // 0 = route mean, 1 = route max, -1 = route min
  priceLevelStd: number;
  deltaReturnMean: number;  // log return mean
  deltaReturnStd: number;
}

const EMISSIONS: Record<RegimeName, EmissionParams> = {
  PLATEAU_HIGH:  { priceLevelMean: 0.7,  priceLevelStd: 0.2,  deltaReturnMean: 0.0,  deltaReturnStd: 0.02 },
  DESCENT:       { priceLevelMean: 0.3,  priceLevelStd: 0.3,  deltaReturnMean: -0.03, deltaReturnStd: 0.03 },
  OPTIMAL_FLOOR: { priceLevelMean: -0.5, priceLevelStd: 0.25, deltaReturnMean: 0.0,  deltaReturnStd: 0.015 },
  ASCENT:        { priceLevelMean: 0.2,  priceLevelStd: 0.3,  deltaReturnMean: 0.025, deltaReturnStd: 0.03 },
  PANIC_LATE:    { priceLevelMean: 0.8,  priceLevelStd: 0.15, deltaReturnMean: 0.05,  deltaReturnStd: 0.04 },
  MISTAKE_FARE:  { priceLevelMean: -1.5, priceLevelStd: 0.4,  deltaReturnMean: -0.1,  deltaReturnStd: 0.08 },
};

/** Gaussian log-pdf */
function gaussLogPdf(x: number, mu: number, sigma: number): number {
  if (sigma <= 0) return -1e10;
  const z = (x - mu) / sigma;
  return -0.5 * z * z - Math.log(sigma) - 0.5 * Math.log(2 * Math.PI);
}

/** Compute emission log-probability for observation in state k */
function emissionLogProb(
  priceLevel: number,
  deltaReturn: number,
  state: RegimeName
): number {
  const e = EMISSIONS[state];
  return (
    gaussLogPdf(priceLevel, e.priceLevelMean, e.priceLevelStd) +
    gaussLogPdf(deltaReturn, e.deltaReturnMean, e.deltaReturnStd)
  );
}

/** Log-sum-exp for numerical stability */
function logSumExp(arr: number[]): number {
  const mx = Math.max(...arr);
  if (!isFinite(mx)) return -Infinity;
  return mx + Math.log(arr.reduce((s, x) => s + Math.exp(x - mx), 0));
}

/**
 * Forward algorithm — returns posterior P(state_T | obs_1:T).
 */
export function forwardHMM(
  observations: Array<{ priceLevel: number; deltaReturn: number; ttd: number }>
): Record<RegimeName, number> {
  const N = observations.length;
  if (N === 0) {
    return Object.fromEntries(STATES.map((s) => [s, 1 / K])) as Record<RegimeName, number>;
  }

  // Initial distribution (uniform with slight bias toward PLATEAU_HIGH)
  let logAlpha = STATES.map((s, i) => {
    const prior = i === 0 ? Math.log(0.3) : Math.log(0.7 / (K - 1));
    const obs = observations[0];
    return prior + emissionLogProb(obs.priceLevel, obs.deltaReturn, s);
  });

  // Forward pass
  for (let t = 1; t < N; t++) {
    const obs = observations[t];

    // Adjust transition probs based on TTD (PANIC_LATE more likely when ttd < 14)
    const ttdAdjust = obs.ttd < 14 ? 0.3 : obs.ttd < 30 ? 0.1 : 0;

    const newLogAlpha = new Array(K);
    for (let j = 0; j < K; j++) {
      const transLogProbs = new Array(K);
      for (let i = 0; i < K; i++) {
        let tp = TRANS[i][j];
        // Boost PANIC_LATE probability when TTD is low
        if (STATES[j] === 'PANIC_LATE') tp = Math.min(0.95, tp + ttdAdjust);
        transLogProbs[i] = logAlpha[i] + Math.log(Math.max(1e-10, tp));
      }
      newLogAlpha[j] =
        logSumExp(transLogProbs) +
        emissionLogProb(obs.priceLevel, obs.deltaReturn, STATES[j]);
    }
    logAlpha = newLogAlpha;
  }

  // Normalize to get posterior
  const logZ = logSumExp(logAlpha);
  const result: Record<string, number> = {};
  for (let i = 0; i < K; i++) {
    result[STATES[i]] = Math.exp(logAlpha[i] - logZ);
  }

  return result as Record<RegimeName, number>;
}

/**
 * V7 sub-model: HMM regime-based prediction.
 */
export function predictHMM(ctx: PredictionContext): SubModelOutput {
  const series = ctx.priceSeries;
  if (series.length < 5) {
    return {
      modelId: 'hmm-regime',
      action: 'MONITOR',
      confidence: 0.1,
      probBetter: 0.5,
      expectedFloor: ctx.currentPrice,
    };
  }

  // Compute features for each observation
  const prices = series.map((p) => p.price);
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const stdev = Math.sqrt(
    prices.reduce((a, p) => a + (p - mean) ** 2, 0) / Math.max(1, prices.length - 1)
  );
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;

  const observations = series.map((p, i) => ({
    priceLevel: stdev > 0 ? (p.price - mean) / stdev : 0,
    deltaReturn: i > 0 && series[i - 1].price > 0
      ? Math.log(p.price / series[i - 1].price)
      : 0,
    ttd: p.ttd,
  }));

  const posterior = forwardHMM(observations);

  // Find most likely current regime
  let bestRegime: RegimeName = 'PLATEAU_HIGH';
  let bestProb = 0;
  for (const s of STATES) {
    if (posterior[s] > bestProb) {
      bestProb = posterior[s];
      bestRegime = s;
    }
  }

  // Action based on regime
  let action: V7Action = 'MONITOR';
  let probBetter = 0.5;
  let expectedFloor = mean - stdev;

  switch (bestRegime) {
    case 'OPTIMAL_FLOOR':
      action = 'BUY_NOW';
      probBetter = 0.15;
      expectedFloor = ctx.currentPrice * 0.98;
      break;
    case 'MISTAKE_FARE':
      action = 'BUY_NOW';
      probBetter = 0.05;
      expectedFloor = ctx.currentPrice;
      break;
    case 'DESCENT':
      action = ctx.ttd < 21 ? 'BUY_NOW' : 'WAIT';
      probBetter = ctx.ttd < 21 ? 0.25 : 0.65;
      expectedFloor = mean - 1.5 * stdev;
      break;
    case 'ASCENT':
      action = 'BUY_NOW';
      probBetter = 0.2;
      expectedFloor = ctx.currentPrice * 0.95;
      break;
    case 'PANIC_LATE':
      action = ctx.currentPrice < mean ? 'BUY_NOW' : 'MONITOR';
      probBetter = 0.1;
      expectedFloor = ctx.currentPrice;
      break;
    case 'PLATEAU_HIGH':
      action = ctx.ttd > 30 ? 'WAIT' : 'MONITOR';
      probBetter = ctx.ttd > 30 ? 0.6 : 0.35;
      expectedFloor = mean - stdev;
      break;
  }

  // Confidence: regime probability * data quality
  const dataQuality = Math.min(1, series.length / 20);
  const confidence = bestProb * 0.7 + dataQuality * 0.3;

  // Estimate duration in regime (count consecutive observations matching)
  let durationInRegime = 0;
  for (let i = observations.length - 1; i >= 0; i--) {
    const obs = observations[i];
    const levels = STATES.map((s) => emissionLogProb(obs.priceLevel, obs.deltaReturn, s));
    const maxIdx = levels.indexOf(Math.max(...levels));
    if (STATES[maxIdx] === bestRegime) durationInRegime++;
    else break;
  }

  const regime: RegimeState = {
    current: bestRegime,
    probabilities: posterior,
    durationInRegime,
    transitionProb: 1 - TRANS[STATES.indexOf(bestRegime)][STATES.indexOf(bestRegime)],
  };

  return {
    modelId: 'hmm-regime',
    action,
    confidence: Math.min(0.95, confidence),
    probBetter,
    expectedFloor: Math.max(minP * 0.9, expectedFloor),
    regime,
    meta: { bestRegime, bestProb, durationInRegime },
  };
}
