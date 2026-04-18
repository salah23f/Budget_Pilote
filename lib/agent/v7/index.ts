/**
 * V7 Predictor — next-generation flight price prediction engine.
 *
 * Orchestrates 9 Tier-S sub-models in parallel:
 *   1. Kalman Filter       — online state estimation (fair price + velocity)
 *   2. HMM Regime          — 6-state regime detection
 *   3. Bayesian Stopping   — optimal buy/wait threshold via dynamic programming
 *   4. BOCPD               — change point detection for regime shifts
 *   5. EVT / Pareto        — extreme value / mistake fare detection
 *   6. Survival Analysis   — time-to-better-price probability
 *   7. Gaussian Process    — probabilistic price surface
 *   8. MCTS                — Monte Carlo tree search planning
 *   9. Thompson Sampling   — contextual bandit policy selection
 *
 * Results are combined by the ensemble layer which:
 *   - Weighted-votes the action (BUY/MONITOR/WAIT)
 *   - Aggregates confidence intervals
 *   - Generates an explainable reason
 *   - Outputs SHAP-like feature importances
 *
 * Feature flag: FLYEAS_ALGO_VERSION
 *   - "v1" (default): original predict() in lib/agent/predictor.ts
 *   - "v7": this module
 *   - "shadow": both run, v1 returned, v7 logged
 *
 * All sub-models are deterministic, local, no external API calls.
 * Target latency: p95 < 300ms Node, < 600ms browser.
 */

import type { PriceSample } from '../price-history';
import type { EnsembleDecision, PredictionContext, PricePoint, SubModelOutput } from './types';
import { predictKalman } from './kalman';
import { predictHMM } from './hmm-regime';
import { predictBayesianStopping } from './bayesian-stopping';
import { predictBOCPD } from './bocpd';
import { predictEVT } from './evt';
import { predictSurvival } from './survival';
import { predictGP } from './gp';
import { predictMCTS } from './mcts';
import { predictThompson } from './thompson';
import { ensembleDecision } from './ensemble';

export type { EnsembleDecision, PredictionContext, SubModelOutput };

/**
 * Convert PriceSample[] from the existing data layer to PricePoint[].
 */
function toPricePoints(samples: PriceSample[]): PricePoint[] {
  return samples
    .filter((s) => s.priceUsd > 0 && s.checkedAt)
    .map((s) => ({
      price: s.priceUsd,
      timestamp: new Date(s.checkedAt).getTime(),
      ttd: s.daysUntilDeparture,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

export interface PredictV7Input {
  currentPrice: number;
  daysUntilDeparture: number;
  /** Samples in the same TTD window (±14 days) */
  windowSamples: PriceSample[];
  /** All samples for the route */
  allSamples: PriceSample[];
  /** Route identifier */
  routeKey?: string;
}

/**
 * Main entry point — runs all sub-models and returns an ensemble decision.
 */
export function predictV7(input: PredictV7Input): EnsembleDecision {
  const ctx: PredictionContext = {
    currentPrice: input.currentPrice,
    ttd: input.daysUntilDeparture,
    priceSeries: toPricePoints(input.windowSamples),
    allHistory: toPricePoints(input.allSamples),
    routeKey: input.routeKey ?? 'unknown',
    nowMs: Date.now(),
  };

  // Data quality metric: 0..1 based on sample count + recency
  const dataQuality = computeDataQuality(ctx);

  // Run all sub-models
  const outputs: SubModelOutput[] = [];

  try {
    outputs.push(predictKalman(ctx));
  } catch (_) {
    // Model failure — skip, don't crash
  }

  try {
    outputs.push(predictHMM(ctx));
  } catch (_) {}

  try {
    outputs.push(predictBayesianStopping(ctx));
  } catch (_) {}

  try {
    outputs.push(predictBOCPD(ctx));
  } catch (_) {}

  try {
    outputs.push(predictEVT(ctx));
  } catch (_) {}

  try {
    outputs.push(predictSurvival(ctx));
  } catch (_) {}

  try {
    outputs.push(predictGP(ctx));
  } catch (_) {}

  try {
    outputs.push(predictMCTS(ctx));
  } catch (_) {}

  try {
    outputs.push(predictThompson(ctx));
  } catch (_) {}

  // Ensemble
  return ensembleDecision(outputs, ctx.currentPrice, ctx.ttd, dataQuality);
}

function computeDataQuality(ctx: PredictionContext): number {
  const n = ctx.priceSeries.length;
  if (n === 0) return 0;

  // Sample count factor (logarithmic — 10 = 0.5, 30 = 0.74, 100 = 1.0)
  const countFactor = Math.min(1, Math.log10(n + 1) / 2);

  // Recency factor — is the latest data point recent?
  const lastTs = ctx.priceSeries[n - 1]?.timestamp ?? 0;
  const hoursSinceUpdate = (ctx.nowMs - lastTs) / 3600000;
  const recencyFactor = hoursSinceUpdate < 24 ? 1 : hoursSinceUpdate < 168 ? 0.7 : 0.4;

  // Coverage factor — are there gaps in the series?
  const firstTs = ctx.priceSeries[0]?.timestamp ?? 0;
  const spanDays = (lastTs - firstTs) / 86400000;
  const expectedObservations = spanDays * 0.5; // assume ~1 obs every 2 days
  const coverageFactor = expectedObservations > 0
    ? Math.min(1, n / expectedObservations)
    : 0.5;

  return 0.4 * countFactor + 0.35 * recencyFactor + 0.25 * coverageFactor;
}

/**
 * Shadow mode helper — runs both V1 and V7, returns V1, logs V7.
 */
export function predictShadow(
  v1Result: unknown,
  v7Input: PredictV7Input
): { v1: unknown; v7: EnsembleDecision; agreement: boolean } {
  const v7 = predictV7(v7Input);
  const v1Action = (v1Result as { action?: string })?.action;
  const agreement = v1Action === v7.action;
  return { v1: v1Result, v7, agreement };
}
