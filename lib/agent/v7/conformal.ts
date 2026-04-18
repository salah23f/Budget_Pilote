/**
 * Conformal Prediction — distribution-free calibrated intervals.
 *
 * Given a set of past predictions + actual outcomes, computes a
 * nonconformity score quantile that guarantees:
 *   P(y_new ∈ [L, U]) ≥ 1 - α
 *
 * Uses split conformal: calibration set of residuals → quantile → interval.
 * Also implements CQR (Conformalized Quantile Regression) which wraps
 * the ensemble's quantile forecasts for tighter intervals.
 *
 * Ref: Vovk, Gammerman, Shafer (2005), "Algorithmic Learning in a Random World"
 *      Romano, Patterson, Candès (2019), "Conformalized Quantile Regression"
 */

import type { ConfidenceInterval, SubModelOutput } from './types';

export interface CalibrationPoint {
  predicted: number;
  actual: number;
  predictedLower?: number; // from quantile model
  predictedUpper?: number; // from quantile model
}

/**
 * Split Conformal — compute the nonconformity quantile from calibration data.
 *
 * @param calibration - past (predicted, actual) pairs
 * @param alpha - miscoverage level (e.g. 0.1 for 90% coverage)
 * @returns the quantile of |actual - predicted| such that coverage ≥ 1-α
 */
export function computeConformalQuantile(
  calibration: CalibrationPoint[],
  alpha: number
): number {
  if (calibration.length === 0) return Infinity;

  const scores = calibration.map((c) => Math.abs(c.actual - c.predicted));
  scores.sort((a, b) => a - b);

  // The (1-α)(1 + 1/n) quantile of the nonconformity scores
  const n = scores.length;
  const idx = Math.min(n - 1, Math.ceil((1 - alpha) * (n + 1)) - 1);
  return scores[Math.max(0, idx)];
}

/**
 * Build a split conformal interval for a new prediction.
 */
export function conformalInterval(
  predicted: number,
  calibration: CalibrationPoint[],
  alpha: number = 0.1
): ConfidenceInterval {
  const q = computeConformalQuantile(calibration, alpha);
  return {
    lower: predicted - q,
    upper: predicted + q,
    level: 1 - alpha,
    method: 'conformal',
  };
}

/**
 * CQR — Conformalized Quantile Regression.
 *
 * Tighter intervals when quantile predictions are available.
 * Nonconformity score = max(q_lower - y, y - q_upper).
 */
export function computeCQRQuantile(
  calibration: CalibrationPoint[],
  alpha: number
): number {
  const valid = calibration.filter((c) => c.predictedLower != null && c.predictedUpper != null);
  if (valid.length === 0) return Infinity;

  const scores = valid.map((c) =>
    Math.max(c.predictedLower! - c.actual, c.actual - c.predictedUpper!)
  );
  scores.sort((a, b) => a - b);

  const n = scores.length;
  const idx = Math.min(n - 1, Math.ceil((1 - alpha) * (n + 1)) - 1);
  return scores[Math.max(0, idx)];
}

/**
 * Build a CQR interval.
 */
export function cqrInterval(
  predictedLower: number,
  predictedUpper: number,
  calibration: CalibrationPoint[],
  alpha: number = 0.1
): ConfidenceInterval {
  const q = computeCQRQuantile(calibration, alpha);
  return {
    lower: predictedLower - q,
    upper: predictedUpper + q,
    level: 1 - alpha,
    method: 'conformal',
  };
}

/**
 * Generate synthetic calibration data from ensemble outputs for bootstrapping
 * conformal intervals when real calibration data is scarce.
 *
 * Uses the ensemble's own uncertainty estimates + noise to simulate
 * calibration residuals. This is a warm-start — real calibration data
 * should replace it as predictions accumulate.
 */
export function syntheticCalibration(
  ensembleMean: number,
  ensembleStd: number,
  n: number = 50,
  seed: number = 42
): CalibrationPoint[] {
  const points: CalibrationPoint[] = [];
  let state = seed;
  for (let i = 0; i < n; i++) {
    // xorshift for reproducibility
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    const u = (state >>> 0) / 4294967296;
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    const v = (state >>> 0) / 4294967296;

    const z = Math.sqrt(-2 * Math.log(Math.max(1e-10, u))) * Math.cos(2 * Math.PI * v);
    const actual = ensembleMean + z * ensembleStd;
    const predicted = ensembleMean + z * ensembleStd * 0.3; // slightly overconfident model

    points.push({
      predicted,
      actual,
      predictedLower: ensembleMean - 1.28 * ensembleStd,
      predictedUpper: ensembleMean + 1.28 * ensembleStd,
    });
  }
  return points;
}
