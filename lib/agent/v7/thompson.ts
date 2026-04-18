/**
 * Thompson Sampling — contextual bandit for policy selection.
 *
 * Arms = 3 trading policies:
 *   - AGGRESSIVE: buys early when price is even slightly below mean
 *   - NEUTRAL:    buys at or below P25 percentile
 *   - CONSERVATIVE: waits for strong signals (< P10 or near departure)
 *
 * Each arm has a Beta posterior on its "success rate" (did the buy
 * turn out to be within 5% of the floor?).
 *
 * Thompson sampling: draw from each Beta, pick the arm with highest draw.
 * Online update: after mission resolves, update the winning arm's posterior.
 *
 * Ref: Russo et al. (2018), "A Tutorial on Thompson Sampling"
 */

import type { PredictionContext, SubModelOutput, V7Action } from './types';

export type PolicyId = 'aggressive' | 'neutral' | 'conservative';

export interface ThompsonState {
  /** Beta(alpha, beta) posteriors per arm */
  arms: Record<PolicyId, { alpha: number; beta: number }>;
  totalPulls: number;
}

/** Initial state — weakly informative prior */
export function initThompson(): ThompsonState {
  return {
    arms: {
      aggressive: { alpha: 2, beta: 3 },   // prior: ~40% success
      neutral: { alpha: 3, beta: 3 },       // prior: ~50% success
      conservative: { alpha: 3, beta: 2 },  // prior: ~60% success
    },
    totalPulls: 0,
  };
}

/** Sample from Beta(α, β) using Jöhnk's method */
function sampleBeta(alpha: number, beta: number, seed: number): number {
  // Gamma-based sampling
  const ga = sampleGamma(alpha, seed);
  const gb = sampleGamma(beta, seed + 7919);
  return ga / (ga + gb + 1e-10);
}

/** Sample from Gamma(α, 1) — Marsaglia & Tsang */
function sampleGamma(alpha: number, seed: number): number {
  let s = seed | 0 || 1;
  const nextRand = (): number => {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
  const nextNormal = (): number => {
    return Math.sqrt(-2 * Math.log(Math.max(1e-10, nextRand()))) * Math.cos(2 * Math.PI * nextRand());
  };

  if (alpha < 1) {
    return sampleGamma(alpha + 1, seed) * Math.pow(nextRand(), 1 / alpha);
  }
  const d = alpha - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (let attempt = 0; attempt < 100; attempt++) {
    let x: number, v: number;
    do {
      x = nextNormal();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = nextRand();
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
  return d; // fallback
}

/**
 * Select the best arm via Thompson sampling.
 */
export function selectPolicy(state: ThompsonState, seed: number = Date.now()): PolicyId {
  let bestId: PolicyId = 'neutral';
  let bestDraw = -1;

  const policies: PolicyId[] = ['aggressive', 'neutral', 'conservative'];
  for (let i = 0; i < policies.length; i++) {
    const arm = state.arms[policies[i]];
    const draw = sampleBeta(arm.alpha, arm.beta, seed + i * 3571);
    if (draw > bestDraw) {
      bestDraw = draw;
      bestId = policies[i];
    }
  }
  return bestId;
}

/**
 * Update the arm's posterior after observing outcome.
 */
export function updateThompson(
  state: ThompsonState,
  arm: PolicyId,
  success: boolean
): ThompsonState {
  const next = structuredClone(state);
  if (success) {
    next.arms[arm].alpha += 1;
  } else {
    next.arms[arm].beta += 1;
  }
  next.totalPulls += 1;
  return next;
}

/**
 * Map policy + current price + baseline to a V7 action.
 */
function policyToAction(
  policy: PolicyId,
  currentPrice: number,
  mean: number,
  p25: number,
  p10: number,
  ttd: number
): V7Action {
  switch (policy) {
    case 'aggressive':
      return currentPrice <= mean ? 'BUY_NOW' : ttd < 14 ? 'BUY_NOW' : 'MONITOR';
    case 'neutral':
      return currentPrice <= p25 ? 'BUY_NOW' : ttd < 7 ? 'BUY_NOW' : 'MONITOR';
    case 'conservative':
      if (currentPrice <= p10 || ttd < 5) return 'BUY_NOW';
      if (currentPrice > mean && ttd > 30) return 'WAIT';
      return 'MONITOR';
  }
}

/**
 * V7 sub-model: Thompson Sampling policy selector.
 */
export function predictThompson(ctx: PredictionContext): SubModelOutput {
  const series = ctx.priceSeries;
  if (series.length < 5) {
    return { modelId: 'thompson', action: 'MONITOR', confidence: 0.1, probBetter: 0.5, expectedFloor: ctx.currentPrice };
  }

  const prices = series.map((p) => p.price);
  const sorted = [...prices].sort((a, b) => a - b);
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const p25 = sorted[Math.floor(sorted.length * 0.25)];
  const p10 = sorted[Math.floor(sorted.length * 0.1)];

  // In production, state would be loaded from Supabase. For now, use fresh prior.
  const state = initThompson();
  const policy = selectPolicy(state, ctx.nowMs);
  const action = policyToAction(policy, ctx.currentPrice, mean, p25, p10, ctx.ttd);

  const probBetter = action === 'BUY_NOW' ? 0.2 : action === 'WAIT' ? 0.65 : 0.45;

  return {
    modelId: 'thompson',
    action,
    confidence: Math.min(0.8, 0.3 + 0.3 * Math.min(1, series.length / 20) + 0.2 * (state.totalPulls / 100)),
    probBetter,
    expectedFloor: Math.max(Math.min(...prices) * 0.9, p10),
    meta: { selectedPolicy: policy, arms: state.arms },
  };
}
