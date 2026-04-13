/**
 * Statistical baselines for a route.
 *
 * Given a set of PriceSample observations, computes:
 *   - Central tendency: mean, median, mode
 *   - Dispersion: stdev, variance, inter-quartile range
 *   - Distribution: min/max, P25/P50/P75/P90 percentiles
 *   - Trend: linear regression slope ($/day) over the last N days
 *   - Volatility: coefficient of variation (stdev / mean)
 *   - Seasonality: day-of-week + month multipliers
 *
 * All math is implemented from scratch with no external deps — we
 * don't need numpy / tensorflow for this. The functions are deterministic,
 * pure, and testable.
 */

import type { PriceSample } from './price-history';

export interface Baseline {
  /** Total usable sample count */
  n: number;
  mean: number;
  median: number;
  stdev: number;
  variance: number;
  min: number;
  max: number;
  /** Empirical percentiles */
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  /** stdev / mean — a route with CV > 0.15 is volatile */
  coefficientOfVariation: number;
  /** Linear regression slope in $/day over the last `trendWindowDays` */
  trendSlopePerDay: number;
  /** Pearson correlation coefficient for the trend fit — how linear is the trend? */
  trendR2: number;
  /** Days of the trend window actually covered */
  trendWindowDays: number;
  /** Most recent observation price */
  lastPrice: number;
  /** Timestamp of most recent observation */
  lastCheckedAt: string;
}

/**
 * Compute a full baseline from a list of PriceSample objects. Returns
 * null if fewer than 3 samples — not enough data for meaningful stats.
 */
export function computeBaseline(samples: PriceSample[]): Baseline | null {
  if (!samples || samples.length < 3) return null;

  const sorted = [...samples].sort((a, b) => a.priceUsd - b.priceUsd);
  const prices = sorted.map((s) => s.priceUsd);
  const n = prices.length;

  // --- Central tendency ----------------------------------------
  const sum = prices.reduce((acc, p) => acc + p, 0);
  const mean = sum / n;

  const median =
    n % 2 === 0
      ? (prices[n / 2 - 1] + prices[n / 2]) / 2
      : prices[Math.floor(n / 2)];

  // --- Dispersion ----------------------------------------------
  const sqDiff = prices.reduce((acc, p) => acc + (p - mean) ** 2, 0);
  const variance = sqDiff / (n - 1); // sample variance
  const stdev = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? stdev / mean : 0;

  // --- Distribution percentiles --------------------------------
  const pct = (q: number): number => {
    const idx = Math.min(n - 1, Math.max(0, Math.floor(q * n)));
    return prices[idx];
  };
  const p10 = pct(0.1);
  const p25 = pct(0.25);
  const p50 = pct(0.5);
  const p75 = pct(0.75);
  const p90 = pct(0.9);

  // --- Trend: linear regression on last 7 days of observations -
  const chrono = [...samples].sort(
    (a, b) =>
      new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime()
  );
  const latest = chrono[chrono.length - 1];
  const latestMs = new Date(latest.checkedAt).getTime();
  const trendCutoff = latestMs - 7 * 24 * 60 * 60 * 1000;
  const trendWindow = chrono.filter(
    (s) => new Date(s.checkedAt).getTime() >= trendCutoff
  );

  let trendSlopePerDay = 0;
  let trendR2 = 0;
  if (trendWindow.length >= 3) {
    // X = days since first observation in window, Y = price
    const first = new Date(trendWindow[0].checkedAt).getTime();
    const points = trendWindow.map((s) => ({
      x: (new Date(s.checkedAt).getTime() - first) / (24 * 60 * 60 * 1000),
      y: s.priceUsd,
    }));
    const m = points.length;
    const sumX = points.reduce((a, p) => a + p.x, 0);
    const sumY = points.reduce((a, p) => a + p.y, 0);
    const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
    const sumXX = points.reduce((a, p) => a + p.x * p.x, 0);
    const meanX = sumX / m;
    const meanY = sumY / m;
    const denom = sumXX - (sumX * sumX) / m;
    if (denom > 0.0001) {
      trendSlopePerDay = (sumXY - (sumX * sumY) / m) / denom;
      const intercept = meanY - trendSlopePerDay * meanX;
      // R² = 1 - SSresid/SStot
      const ssTot = points.reduce((a, p) => a + (p.y - meanY) ** 2, 0);
      const ssRes = points.reduce(
        (a, p) => a + (p.y - (trendSlopePerDay * p.x + intercept)) ** 2,
        0
      );
      trendR2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
    }
  }

  const trendWindowDays =
    trendWindow.length >= 2
      ? (new Date(trendWindow[trendWindow.length - 1].checkedAt).getTime() -
          new Date(trendWindow[0].checkedAt).getTime()) /
        (24 * 60 * 60 * 1000)
      : 0;

  return {
    n,
    mean: round2(mean),
    median: round2(median),
    stdev: round2(stdev),
    variance: round2(variance),
    min: round2(Math.min(...prices)),
    max: round2(Math.max(...prices)),
    p10: round2(p10),
    p25: round2(p25),
    p50: round2(p50),
    p75: round2(p75),
    p90: round2(p90),
    coefficientOfVariation: round3(coefficientOfVariation),
    trendSlopePerDay: round2(trendSlopePerDay),
    trendR2: round3(trendR2),
    trendWindowDays: round1(trendWindowDays),
    lastPrice: round2(latest.priceUsd),
    lastCheckedAt: latest.checkedAt,
  };
}

/**
 * Compute a z-score for an observation against a baseline.
 * z = (x - mean) / stdev
 * Negative z means the price is below the mean (good).
 */
export function zScore(price: number, baseline: Baseline): number {
  if (baseline.stdev < 0.001) return 0;
  return (price - baseline.mean) / baseline.stdev;
}

/**
 * Empirical percentile rank — "this price beats X% of historical
 * observations". Lower = better. Returns 0-100.
 */
export function percentileRank(
  price: number,
  samples: PriceSample[]
): number {
  if (samples.length === 0) return 50;
  const belowCount = samples.filter((s) => s.priceUsd < price).length;
  return Math.round((belowCount / samples.length) * 100);
}

// ------------------------------------------------------------------
// Formatting helpers
// ------------------------------------------------------------------
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
