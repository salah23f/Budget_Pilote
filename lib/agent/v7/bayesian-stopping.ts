/**
 * Bayesian Optimal Stopping — finite-horizon buy/wait decision.
 *
 * The core question: given T days until departure, current price p_t,
 * and a belief about future prices, should I buy now or wait?
 *
 * Solution: backward induction on the Bellman equation:
 *   V_T(p) = p                                        (must buy at departure)
 *   V_t(p) = min(p, E[V_{t+1}(p') | p_t = p])        (buy now or wait)
 *
 * The buy threshold at time t is the price below which buying is optimal.
 *
 * We model the price process as discretized Gaussian with mean-reversion:
 *   p_{t+1} = μ + φ(p_t - μ) + σ·ε,  ε ~ N(0,1)
 *
 * φ < 1 gives mean-reversion (prices tend back to μ).
 * σ scales with TTD (volatility increases near departure).
 *
 * Ref: Chow, Robbins & Siegmund (1971), "Great Expectations"
 *      Dynkin (1963), optimal stopping for Markov processes
 */

import type { PredictionContext, SubModelOutput, V7Action } from './types';

/**
 * Compute optimal stopping thresholds via backward induction.
 *
 * Returns an array of thresholds: threshold[d] = max price worth buying
 * when there are d days until departure.
 *
 * @param mu - long-run mean price
 * @param phi - mean-reversion speed (0 = no reversion, 1 = no reversion to mean)
 * @param sigma - daily volatility
 * @param T - days until departure
 * @param nGrid - price grid resolution
 */
export function computeStoppingThresholds(
  mu: number,
  phi: number,
  sigma: number,
  T: number,
  nGrid: number = 100
): number[] {
  const maxT = Math.min(T, 180);
  const spread = 3 * sigma * Math.sqrt(maxT);
  const pMin = Math.max(0, mu - spread);
  const pMax = mu + spread;
  const dp = (pMax - pMin) / (nGrid - 1);
  const grid = Array.from({ length: nGrid }, (_, i) => pMin + i * dp);

  // V[d][i] = value function at d days to go, price grid index i
  // Start from T (must buy) and work backwards
  const V: number[][] = [];
  V[0] = grid.slice(); // at departure, V = p (must buy at whatever price)

  // Gaussian transition kernel weights (precompute for each grid point)
  function transitionProbs(
    fromIdx: number,
    d: number
  ): { idx: number; weight: number }[] {
    const p = grid[fromIdx];
    // Mean-reverting next-step distribution
    const nextMean = mu + phi * (p - mu);
    // Volatility increases as departure approaches (bid-price jumps)
    const ttdFactor = Math.max(1, 1 + 2 * Math.exp(-d / 14));
    const nextSigma = sigma * ttdFactor;

    const probs: { idx: number; weight: number }[] = [];
    let totalWeight = 0;
    for (let j = 0; j < nGrid; j++) {
      const z = (grid[j] - nextMean) / Math.max(0.01, nextSigma);
      const w = Math.exp(-0.5 * z * z);
      if (w > 1e-6) {
        probs.push({ idx: j, weight: w });
        totalWeight += w;
      }
    }
    // Normalize
    for (const p of probs) p.weight /= Math.max(1e-10, totalWeight);
    return probs;
  }

  // Backward induction
  for (let d = 1; d <= maxT; d++) {
    V[d] = new Array(nGrid);
    for (let i = 0; i < nGrid; i++) {
      const buyNow = grid[i];
      // Expected value of waiting = E[V_{d-1}(p')]
      const trans = transitionProbs(i, d);
      let eWait = 0;
      for (const t of trans) {
        eWait += t.weight * V[d - 1][t.idx];
      }
      V[d][i] = Math.min(buyNow, eWait);
    }
  }

  // Extract thresholds: for each d, find the max price where V[d][i] = grid[i]
  // (i.e., where buying is optimal)
  const thresholds = new Array(maxT + 1).fill(0);
  for (let d = 0; d <= maxT; d++) {
    // Threshold = highest price where buy is optimal
    let thresh = grid[0]; // at least buy at minimum
    for (let i = 0; i < nGrid; i++) {
      if (Math.abs(V[d][i] - grid[i]) < dp * 0.5) {
        thresh = grid[i]; // buying is optimal at this price
      }
    }
    thresholds[d] = thresh;
  }

  return thresholds;
}

/**
 * V7 sub-model: Bayesian optimal stopping.
 */
export function predictBayesianStopping(ctx: PredictionContext): SubModelOutput {
  const series = ctx.priceSeries;

  if (series.length < 5) {
    return {
      modelId: 'bayesian-stopping',
      action: 'MONITOR',
      confidence: 0.1,
      probBetter: 0.5,
      expectedFloor: ctx.currentPrice,
    };
  }

  const prices = series.map((p) => p.price);
  const n = prices.length;
  const mean = prices.reduce((a, b) => a + b, 0) / n;
  const stdev = Math.sqrt(prices.reduce((a, p) => a + (p - mean) ** 2, 0) / Math.max(1, n - 1));
  const minP = Math.min(...prices);

  // Estimate mean-reversion parameter phi
  // phi = autocorrelation(1) of demeaned prices
  let sumProd = 0;
  let sumSq = 0;
  for (let i = 1; i < n; i++) {
    sumProd += (prices[i] - mean) * (prices[i - 1] - mean);
    sumSq += (prices[i - 1] - mean) ** 2;
  }
  const phi = sumSq > 0 ? Math.max(-0.5, Math.min(0.99, sumProd / sumSq)) : 0.8;

  // Daily volatility estimate
  const dailyReturns: number[] = [];
  for (let i = 1; i < n; i++) {
    if (prices[i - 1] > 0) {
      const dt = Math.max(0.5,
        (series[i].timestamp - series[i - 1].timestamp) / 86400000
      );
      dailyReturns.push((prices[i] - prices[i - 1]) / Math.sqrt(dt));
    }
  }
  const sigma = dailyReturns.length > 0
    ? Math.sqrt(dailyReturns.reduce((a, r) => a + r * r, 0) / dailyReturns.length)
    : stdev * 0.05;

  // Compute thresholds
  const T = Math.max(1, Math.min(ctx.ttd, 180));
  const thresholds = computeStoppingThresholds(mean, phi, Math.max(1, sigma), T, 80);

  // Decision: compare current price to threshold for current TTD
  const thresholdIdx = Math.min(T, thresholds.length - 1);
  const buyThreshold = thresholds[thresholdIdx];

  const shouldBuy = ctx.currentPrice <= buyThreshold;
  const margin = buyThreshold - ctx.currentPrice;

  let action: V7Action;
  if (shouldBuy) {
    action = 'BUY_NOW';
  } else if (margin < -stdev * 0.3) {
    action = 'WAIT';
  } else {
    action = 'MONITOR';
  }

  // Prob of seeing a better price: approximate from the distribution
  const probBetter = shouldBuy
    ? Math.max(0.05, 0.5 * Math.exp(-ctx.ttd / 60)) // very low if below threshold
    : Math.min(0.9, 0.3 + 0.4 * (1 - ctx.currentPrice / Math.max(1, mean)));

  // Expected floor: the threshold at day 0 (departure) is the must-buy price
  const expectedFloor = Math.max(minP * 0.9, thresholds[0]);

  // Confidence: more data + clearer signal = higher confidence
  const signalStrength = Math.abs(margin) / Math.max(1, stdev);
  const dataConf = Math.min(1, n / 25);
  const confidence = Math.min(0.95, 0.4 * dataConf + 0.6 * Math.tanh(signalStrength));

  return {
    modelId: 'bayesian-stopping',
    action,
    confidence,
    probBetter,
    expectedFloor,
    meta: {
      buyThreshold,
      margin,
      phi,
      sigma,
      mu: mean,
      T,
    },
  };
}
