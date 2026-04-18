/**
 * Bayesian Online Change Point Detection (BOCPD)
 *
 * Detects structural breaks in price time-series in real time:
 *   - Promotion start/end
 *   - Mistake fare flash
 *   - Competitor action
 *   - Demand regime shift
 *
 * Maintains a posterior distribution over "run length" r_t = number of
 * observations since the last change point. When P(r_t = 0) spikes,
 * a change point has occurred.
 *
 * Ref: Adams & MacKay (2007), "Bayesian Online Changepoint Detection"
 *
 * Observation model: Gaussian with conjugate Normal-InverseGamma prior.
 * Hazard function: constant rate λ (geometric prior on run length).
 */

import type { PredictionContext, SubModelOutput, V7Action } from './types';

/** Sufficient statistics for Normal-InverseGamma conjugate */
interface NIGStats {
  n: number;
  sumX: number;
  sumXX: number;
  mu0: number;
  kappa0: number;
  alpha0: number;
  beta0: number;
}

function initNIG(mu0: number, kappa0: number, alpha0: number, beta0: number): NIGStats {
  return { n: 0, sumX: 0, sumXX: 0, mu0, kappa0, alpha0, beta0 };
}

function updateNIG(s: NIGStats, x: number): NIGStats {
  return {
    ...s,
    n: s.n + 1,
    sumX: s.sumX + x,
    sumXX: s.sumXX + x * x,
  };
}

/** Marginal predictive log-likelihood under Normal-InverseGamma */
function nigPredLogLik(s: NIGStats, x: number): number {
  const kn = s.kappa0 + s.n;
  const alphan = s.alpha0 + s.n / 2;
  const mun = (s.kappa0 * s.mu0 + s.sumX) / kn;
  const betan =
    s.beta0 +
    0.5 * (s.sumXX - s.sumX * s.sumX / Math.max(1, s.n)) +
    (s.kappa0 * s.n * (s.sumX / Math.max(1, s.n) - s.mu0) ** 2) /
      (2 * kn);

  const scale = Math.sqrt(((kn + 1) / kn) * (betan / alphan));
  const nu = 2 * alphan;

  // Student-t log pdf
  const z = (x - mun) / Math.max(0.001, scale);
  return (
    lgamma((nu + 1) / 2) -
    lgamma(nu / 2) -
    0.5 * Math.log(nu * Math.PI) -
    Math.log(Math.max(0.001, scale)) -
    ((nu + 1) / 2) * Math.log(1 + (z * z) / nu)
  );
}

/** Log gamma function (Stirling approximation for large x, exact for small) */
function lgamma(x: number): number {
  if (x <= 0) return 0;
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  }
  // Stirling series
  x -= 1;
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  let sum = c[0];
  for (let i = 1; i < g + 2; i++) {
    sum += c[i] / (x + i);
  }
  const t = x + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(sum);
}

export interface BOCPDResult {
  /** Posterior probability of a change point at each time step */
  changePointProbs: number[];
  /** Most recent change point probability */
  currentChangeProb: number;
  /** Most likely current run length */
  currentRunLength: number;
  /** Whether a change point was detected recently (last 3 steps) */
  recentChange: boolean;
}

/**
 * Run BOCPD on a price series.
 *
 * @param prices - sequential price observations
 * @param hazardRate - prior probability of change at each step (1/expected_run_length)
 */
export function runBOCPD(
  prices: number[],
  hazardRate: number = 1 / 30 // expect ~30 observations between change points
): BOCPDResult {
  const T = prices.length;
  if (T < 3) {
    return {
      changePointProbs: [],
      currentChangeProb: 0,
      currentRunLength: T,
      recentChange: false,
    };
  }

  // Use log-returns for stationarity
  const obs: number[] = [];
  for (let i = 1; i < T; i++) {
    obs.push(prices[i] > 0 && prices[i - 1] > 0
      ? Math.log(prices[i] / prices[i - 1])
      : 0
    );
  }
  const N = obs.length;

  // Prior parameters: weakly informative
  const mu0 = 0; // log-returns centered at 0
  const kappa0 = 0.1;
  const alpha0 = 1;
  const beta0 = 0.001;

  // Run length probabilities (log scale for stability)
  let logR = [0]; // log P(r_0 = 0) = 1
  const changePointProbs: number[] = [];
  const logH = Math.log(hazardRate);
  const log1mH = Math.log(1 - hazardRate);

  // Sufficient stats for each run length hypothesis
  let stats: NIGStats[] = [initNIG(mu0, kappa0, alpha0, beta0)];

  for (let t = 0; t < N; t++) {
    const x = obs[t];
    const oldLen = logR.length;

    // Evaluate predictive probability for each run length
    const logPred = new Array(oldLen);
    for (let r = 0; r < oldLen; r++) {
      logPred[r] = nigPredLogLik(stats[r], x);
    }

    // Growth probabilities: P(r_t = r+1)
    const newLogR = new Array(oldLen + 1);
    for (let r = 0; r < oldLen; r++) {
      newLogR[r + 1] = logR[r] + logPred[r] + log1mH;
    }

    // Change point probability: P(r_t = 0)
    const logCPterms = new Array(oldLen);
    for (let r = 0; r < oldLen; r++) {
      logCPterms[r] = logR[r] + logPred[r] + logH;
    }
    const maxCP = Math.max(...logCPterms);
    newLogR[0] = maxCP + Math.log(logCPterms.reduce((s, v) => s + Math.exp(v - maxCP), 0));

    // Normalize
    const allVals = newLogR.filter((v) => isFinite(v));
    const maxAll = Math.max(...allVals);
    const logNorm = maxAll + Math.log(allVals.reduce((s, v) => s + Math.exp(v - maxAll), 0));
    for (let r = 0; r <= oldLen; r++) {
      newLogR[r] = (newLogR[r] ?? -Infinity) - logNorm;
    }

    logR = newLogR;

    // Update sufficient statistics
    const newStats: NIGStats[] = [initNIG(mu0, kappa0, alpha0, beta0)];
    for (let r = 0; r < oldLen; r++) {
      newStats[r + 1] = updateNIG(stats[r], x);
    }
    stats = newStats;

    // Record change point probability
    changePointProbs.push(Math.exp(logR[0]));
  }

  // Current run length = argmax of logR
  let maxRL = 0;
  let maxLogR = -Infinity;
  for (let r = 0; r < logR.length; r++) {
    if (logR[r] > maxLogR) {
      maxLogR = logR[r];
      maxRL = r;
    }
  }

  const currentCP = changePointProbs[changePointProbs.length - 1] ?? 0;
  const recentChange =
    changePointProbs.length >= 1 &&
    changePointProbs.slice(-3).some((p) => p > 0.3);

  return {
    changePointProbs,
    currentChangeProb: currentCP,
    currentRunLength: maxRL,
    recentChange,
  };
}

/**
 * V7 sub-model: BOCPD-based prediction.
 */
export function predictBOCPD(ctx: PredictionContext): SubModelOutput {
  const series = ctx.priceSeries;
  if (series.length < 5) {
    return {
      modelId: 'bocpd',
      action: 'MONITOR',
      confidence: 0.1,
      probBetter: 0.5,
      expectedFloor: ctx.currentPrice,
    };
  }

  const prices = series.map((p) => p.price);
  const result = runBOCPD(prices);

  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const minP = Math.min(...prices);

  let action: V7Action = 'MONITOR';
  let probBetter = 0.5;

  if (result.recentChange) {
    // Change detected — are prices dropping or rising?
    const recentSlice = prices.slice(-5);
    const recentMean = recentSlice.reduce((a, b) => a + b, 0) / recentSlice.length;
    const olderMean = prices.slice(0, -5).reduce((a, b) => a + b, 0) / Math.max(1, prices.length - 5);

    if (recentMean < olderMean * 0.95) {
      // Prices dropped — possible promotion or mistake fare → BUY
      action = 'BUY_NOW';
      probBetter = 0.15;
    } else if (recentMean > olderMean * 1.05) {
      // Prices jumped up — new regime of higher prices
      action = ctx.ttd < 21 ? 'BUY_NOW' : 'WAIT';
      probBetter = ctx.ttd < 21 ? 0.2 : 0.6;
    }
  } else if (result.currentRunLength > 20 && ctx.currentPrice < mean * 0.9) {
    // Long stable regime + current price is low → buy
    action = 'BUY_NOW';
    probBetter = 0.2;
  }

  const confidence = Math.min(
    0.9,
    0.3 + 0.3 * Math.min(1, series.length / 20) +
    0.4 * (result.recentChange ? 0.8 : 0.4)
  );

  return {
    modelId: 'bocpd',
    action,
    confidence,
    probBetter,
    expectedFloor: Math.max(minP * 0.9, mean * 0.85),
    meta: {
      currentChangeProb: result.currentChangeProb,
      currentRunLength: result.currentRunLength,
      recentChange: result.recentChange,
    },
  };
}
