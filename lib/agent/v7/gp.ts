/**
 * Gaussian Process Regression — probabilistic price surface.
 *
 * Models price as a function of (TTD, day_of_week, month).
 * Kernel: RBF + Periodic(7d) for weekly patterns.
 *
 * For N observations, exact GP is O(N^3). We use a sparse approximation:
 * keep only the most recent 200 observations and use Cholesky factorization.
 *
 * Output: posterior mean + variance at the current TTD, giving a full
 * predictive distribution for "what price should we expect today?"
 *
 * Ref: Rasmussen & Williams (2006), "Gaussian Processes for Machine Learning"
 */

import type { PredictionContext, SubModelOutput, V7Action } from './types';

const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));

/** RBF kernel: k(x,x') = σ² · exp(-||x-x'||² / 2l²) */
function rbfKernel(x1: number[], x2: number[], lengthscale: number, variance: number): number {
  let sqDist = 0;
  for (let i = 0; i < x1.length; i++) {
    sqDist += (x1[i] - x2[i]) ** 2;
  }
  return variance * Math.exp(-sqDist / (2 * lengthscale * lengthscale));
}

/** Periodic kernel for weekly seasonality */
function periodicKernel(t1: number, t2: number, period: number, lengthscale: number, variance: number): number {
  const diff = Math.abs(t1 - t2);
  const sinTerm = Math.sin(Math.PI * diff / period);
  return variance * Math.exp(-2 * sinTerm * sinTerm / (lengthscale * lengthscale));
}

/** Composite kernel = RBF(TTD, dow, month) + Periodic(daysSinceStart, period=7) */
function compositeKernel(
  x1: { ttd: number; dow: number; dayIdx: number },
  x2: { ttd: number; dow: number; dayIdx: number }
): number {
  const rbf = rbfKernel(
    [x1.ttd / 30, x1.dow / 7],
    [x2.ttd / 30, x2.dow / 7],
    1.5, // lengthscale
    1.0  // variance
  );
  const periodic = periodicKernel(x1.dayIdx, x2.dayIdx, 7, 1.0, 0.3);
  return rbf + periodic;
}

/** Solve Kx = y via Cholesky (K must be positive definite) */
function choleskySolve(K: number[][], y: number[]): number[] | null {
  const n = K.length;
  // Cholesky decomposition: K = L L^T
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = 0;
      for (let k = 0; k < j; k++) s += L[i][k] * L[j][k];
      if (i === j) {
        const diag = K[i][i] - s;
        if (diag <= 0) return null; // not positive definite
        L[i][j] = Math.sqrt(diag);
      } else {
        L[i][j] = L[j][j] > 1e-10 ? (K[i][j] - s) / L[j][j] : 0;
      }
    }
  }

  // Forward sub: L z = y
  const z = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < i; j++) s += L[i][j] * z[j];
    z[i] = L[i][i] > 1e-10 ? (y[i] - s) / L[i][i] : 0;
  }

  // Back sub: L^T x = z
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = 0;
    for (let j = i + 1; j < n; j++) s += L[j][i] * x[j];
    x[i] = L[i][i] > 1e-10 ? (z[i] - s) / L[i][i] : 0;
  }

  return x;
}

export function predictGP(ctx: PredictionContext): SubModelOutput {
  const series = ctx.priceSeries;
  if (series.length < 5) {
    return { modelId: 'gp', action: 'MONITOR', confidence: 0.1, probBetter: 0.5, expectedFloor: ctx.currentPrice };
  }

  // Use most recent 150 observations (O(N^3) limit)
  const recent = series.slice(-150);
  const N = recent.length;

  // Normalize prices
  const prices = recent.map((p) => p.price);
  const mean = prices.reduce((a, b) => a + b, 0) / N;
  const std = Math.sqrt(prices.reduce((a, p) => a + (p - mean) ** 2, 0) / Math.max(1, N - 1)) || 1;
  const yNorm = prices.map((p) => (p - mean) / std);

  // Build features
  const firstTs = recent[0].timestamp;
  const features = recent.map((p) => ({
    ttd: p.ttd,
    dow: new Date(p.timestamp).getDay(),
    dayIdx: (p.timestamp - firstTs) / 86400000,
  }));

  // Build kernel matrix K + noise
  const noiseVar = 0.1; // observation noise
  const K: number[][] = Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) =>
      compositeKernel(features[i], features[j]) + (i === j ? noiseVar : 0)
    )
  );

  // Solve K α = y
  const alpha = choleskySolve(K, yNorm);
  if (!alpha) {
    return { modelId: 'gp', action: 'MONITOR', confidence: 0.15, probBetter: 0.5, expectedFloor: ctx.currentPrice };
  }

  // Predict at current TTD
  const xStar = {
    ttd: ctx.ttd,
    dow: new Date(ctx.nowMs).getDay(),
    dayIdx: (ctx.nowMs - firstTs) / 86400000,
  };

  const kStar = features.map((f) => compositeKernel(xStar, f));

  // Posterior mean
  let fMean = 0;
  for (let i = 0; i < N; i++) fMean += kStar[i] * alpha[i];
  const predictedPrice = fMean * std + mean;

  // Posterior variance (approximate — skip full K^{-1} computation)
  const kStarStar = compositeKernel(xStar, xStar) + noiseVar;
  let vReduce = 0;
  for (let i = 0; i < N; i++) vReduce += kStar[i] * kStar[i] / (K[i][i] || 1);
  const posteriorVar = Math.max(0.01, kStarStar - vReduce) * std * std;
  const posteriorStd = Math.sqrt(posteriorVar);

  // Decision
  const deviation = ctx.currentPrice - predictedPrice;
  const deviationSigmas = posteriorStd > 0.01 ? deviation / posteriorStd : 0;

  let action: V7Action = 'MONITOR';
  if (deviationSigmas < -1.2) action = 'BUY_NOW';
  else if (deviationSigmas > 0.8 && ctx.ttd > 21) action = 'WAIT';

  const probBetter = clamp(0.5 - deviationSigmas * 0.2, 0.05, 0.95);
  const minP = Math.min(...prices);

  return {
    modelId: 'gp',
    action,
    confidence: clamp(0.3 + 0.5 * Math.min(1, N / 50) + 0.2 * Math.min(1, Math.abs(deviationSigmas) / 2), 0, 0.95),
    probBetter,
    expectedFloor: Math.max(minP * 0.9, predictedPrice - 1.5 * posteriorStd),
    priceForecast: {
      mean: predictedPrice,
      std: posteriorStd,
      quantiles: {
        0.1: predictedPrice - 1.28 * posteriorStd,
        0.25: predictedPrice - 0.67 * posteriorStd,
        0.5: predictedPrice,
        0.75: predictedPrice + 0.67 * posteriorStd,
        0.9: predictedPrice + 1.28 * posteriorStd,
      },
    },
    meta: { predictedPrice, posteriorStd, deviationSigmas, N },
  };
}
