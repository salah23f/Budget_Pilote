/**
 * Ensemble stacking — combines all sub-model outputs into a single decision.
 *
 * Level 0: Kalman, HMM-Regime, Bayesian-Stopping, BOCPD
 * Level 1: Weighted vote with adaptive weights based on data quality + TTD
 *
 * Disagreement between models increases uncertainty and widens intervals.
 * Agreement strengthens confidence and sharpens the recommendation.
 */

import type {
  ConfidenceInterval,
  EnsembleDecision,
  RegimeName,
  RegimeState,
  SubModelOutput,
  V7Action,
} from './types';

/** Adaptive model weights — adjusted by TTD and data availability */
function computeWeights(
  outputs: SubModelOutput[],
  ttd: number,
  dataQuality: number
): Map<string, number> {
  const weights = new Map<string, number>();

  for (const out of outputs) {
    let w = out.confidence;

    // Bayesian stopping is best for medium-TTD decisions
    if (out.modelId === 'bayesian-stopping') {
      w *= ttd > 7 && ttd < 120 ? 1.3 : 0.7;
    }
    // Kalman excels with frequent, recent data
    if (out.modelId === 'kalman') {
      w *= dataQuality > 0.5 ? 1.2 : 0.6;
    }
    // HMM is most useful with 10+ observations
    if (out.modelId === 'hmm-regime') {
      w *= dataQuality > 0.4 ? 1.1 : 0.5;
    }
    // BOCPD is most useful when there might be regime changes
    if (out.modelId === 'bocpd') {
      w *= 0.8; // generally a supporting signal, not primary
    }

    weights.set(out.modelId, Math.max(0.01, w));
  }

  // Normalize
  const totalW = Array.from(weights.values()).reduce((a, b) => a + b, 0);
  for (const [k, v] of weights) {
    weights.set(k, v / Math.max(0.01, totalW));
  }

  return weights;
}

/** Weighted vote over actions */
function voteAction(
  outputs: SubModelOutput[],
  weights: Map<string, number>
): V7Action {
  const votes: Record<V7Action, number> = { BUY_NOW: 0, MONITOR: 0, WAIT: 0 };
  for (const out of outputs) {
    const w = weights.get(out.modelId) ?? 0;
    votes[out.action] += w;
  }

  let best: V7Action = 'MONITOR';
  let bestScore = 0;
  for (const [action, score] of Object.entries(votes) as [V7Action, number][]) {
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }
  return best;
}

/** Compute disagreement entropy — higher = less agreement */
function disagreementEntropy(
  outputs: SubModelOutput[],
  weights: Map<string, number>
): number {
  const votes: Record<V7Action, number> = { BUY_NOW: 0, MONITOR: 0, WAIT: 0 };
  for (const out of outputs) {
    votes[out.action] += weights.get(out.modelId) ?? 0;
  }
  let entropy = 0;
  for (const v of Object.values(votes)) {
    if (v > 0) entropy -= v * Math.log2(v);
  }
  return entropy; // 0 = perfect agreement, ~1.58 = max disagreement
}

/** Aggregate confidence intervals from sub-models with forecasts */
function buildIntervals(
  outputs: SubModelOutput[],
  currentPrice: number
): ConfidenceInterval[] {
  const forecasts = outputs
    .filter((o) => o.priceForecast)
    .map((o) => o.priceForecast!);

  if (forecasts.length === 0) {
    // Fallback: crude interval based on current price ± 10%
    return [{ lower: currentPrice * 0.9, upper: currentPrice * 1.15, level: 0.9, method: 'gaussian' }];
  }

  // Aggregate means and stds
  const means = forecasts.map((f) => f.mean);
  const stds = forecasts.map((f) => f.std);
  const avgMean = means.reduce((a, b) => a + b, 0) / means.length;
  const avgStd = stds.reduce((a, b) => a + b, 0) / stds.length;

  // Ensemble uncertainty = avg model uncertainty + model disagreement
  const modelDisagreement = Math.sqrt(
    means.reduce((a, m) => a + (m - avgMean) ** 2, 0) / Math.max(1, means.length)
  );
  const totalStd = Math.sqrt(avgStd ** 2 + modelDisagreement ** 2);

  return [
    { lower: avgMean - 1.28 * totalStd, upper: avgMean + 1.28 * totalStd, level: 0.8, method: 'gaussian' },
    { lower: avgMean - 1.645 * totalStd, upper: avgMean + 1.645 * totalStd, level: 0.9, method: 'gaussian' },
    { lower: avgMean - 1.96 * totalStd, upper: avgMean + 1.96 * totalStd, level: 0.95, method: 'gaussian' },
  ];
}

/** Aggregate regime from HMM model (or fallback) */
function aggregateRegime(outputs: SubModelOutput[]): RegimeState {
  const hmmOutput = outputs.find((o) => o.modelId === 'hmm-regime');
  if (hmmOutput?.regime) return hmmOutput.regime;

  return {
    current: 'PLATEAU_HIGH' as RegimeName,
    probabilities: {
      PLATEAU_HIGH: 0.4, DESCENT: 0.15, OPTIMAL_FLOOR: 0.1,
      ASCENT: 0.15, PANIC_LATE: 0.1, MISTAKE_FARE: 0.1,
    },
    durationInRegime: 0,
    transitionProb: 0.3,
  };
}

/** Build natural-language explanation */
function buildReason(
  action: V7Action,
  outputs: SubModelOutput[],
  weights: Map<string, number>,
  regime: RegimeState,
  currentPrice: number,
  ttd: number,
  probBetter: number
): string {
  const agreeing = outputs.filter((o) => o.action === action);
  const modelNames = agreeing.map((o) => o.modelId).slice(0, 3).join(', ');
  const regimeName = regime.current.replace(/_/g, ' ').toLowerCase();

  if (action === 'BUY_NOW') {
    return `${agreeing.length} of ${outputs.length} models recommend buying now (${modelNames}). Current regime: ${regimeName}. Estimated ${Math.round(probBetter * 100)}% chance of seeing a lower price before departure. ${ttd < 14 ? `With ${ttd} days to departure, waiting is high-risk.` : ''}`;
  }
  if (action === 'WAIT') {
    return `${agreeing.length} of ${outputs.length} models suggest waiting (${modelNames}). Current regime: ${regimeName}. ${Math.round(probBetter * 100)}% chance of improvement. ${ttd > 30 ? 'Time is on your side.' : ''}`;
  }
  return `Models are split — ${outputs.filter((o) => o.action === 'BUY_NOW').length} buy, ${outputs.filter((o) => o.action === 'WAIT').length} wait, ${outputs.filter((o) => o.action === 'MONITOR').length} monitor. Current regime: ${regimeName}. Monitoring until signal strengthens.`;
}

/**
 * Main ensemble function — combines all sub-model outputs.
 */
export function ensembleDecision(
  outputs: SubModelOutput[],
  currentPrice: number,
  ttd: number,
  dataQuality: number
): EnsembleDecision {
  const t0 = Date.now();

  if (outputs.length === 0) {
    return fallbackDecision(currentPrice, ttd, t0);
  }

  const weights = computeWeights(outputs, ttd, dataQuality);
  const action = voteAction(outputs, weights);
  const entropy = disagreementEntropy(outputs, weights);

  // Aggregate probBetter
  let probBetter7d = 0;
  let probBetterAll = 0;
  for (const out of outputs) {
    const w = weights.get(out.modelId) ?? 0;
    probBetter7d += w * out.probBetter * 0.5; // 7d is roughly half of probBetter
    probBetterAll += w * out.probBetter;
  }

  // Expected floor
  const floors = outputs.map((o) => o.expectedFloor);
  const expectedFloor = floors.reduce((a, b) => a + b, 0) / floors.length;

  // Expected savings if wait
  const expectedSavingsWait = Math.max(0, currentPrice - expectedFloor) * probBetterAll;

  // CVaR 5% — worst case in the bottom 5% of outcomes
  // Approximate: if we wait and price goes up by 2 sigma
  const forecasts = outputs.filter((o) => o.priceForecast).map((o) => o.priceForecast!);
  const avgStd = forecasts.length > 0
    ? forecasts.reduce((a, f) => a + f.std, 0) / forecasts.length
    : currentPrice * 0.08;
  const cvar05 = currentPrice + 2.33 * avgStd; // 95th percentile cost

  // Confidence: base from model agreement, penalized by entropy
  const avgConfidence = outputs.reduce(
    (a, o) => a + (weights.get(o.modelId) ?? 0) * o.confidence, 0
  );
  const confidence = Math.min(0.95, avgConfidence * (1 - entropy * 0.3));

  const regime = aggregateRegime(outputs);
  const intervals = buildIntervals(outputs, currentPrice);

  // Feature importances (which model had most influence)
  const featureImportances: Record<string, number> = {};
  for (const out of outputs) {
    featureImportances[out.modelId] = weights.get(out.modelId) ?? 0;
  }

  const reason = buildReason(action, outputs, weights, regime, currentPrice, ttd, probBetterAll);

  return {
    action,
    confidence,
    probBetter7d: Math.min(0.95, probBetter7d),
    probBetterBeforeDeparture: Math.min(0.95, probBetterAll),
    expectedFloor,
    expectedSavingsWait,
    cvar05,
    intervals,
    regime,
    subModels: outputs,
    reason,
    featureImportances,
    meta: {
      version: 'v7',
      modelsUsed: outputs.map((o) => o.modelId),
      latencyMs: Date.now() - t0,
      dataQuality,
    },
  };
}

function fallbackDecision(price: number, ttd: number, t0: number): EnsembleDecision {
  return {
    action: ttd < 14 ? 'BUY_NOW' : 'MONITOR',
    confidence: 0.2,
    probBetter7d: 0.5,
    probBetterBeforeDeparture: 0.5,
    expectedFloor: price * 0.9,
    expectedSavingsWait: 0,
    cvar05: price * 1.15,
    intervals: [{ lower: price * 0.85, upper: price * 1.2, level: 0.9, method: 'gaussian' }],
    regime: {
      current: 'PLATEAU_HIGH',
      probabilities: { PLATEAU_HIGH: 1, DESCENT: 0, OPTIMAL_FLOOR: 0, ASCENT: 0, PANIC_LATE: 0, MISTAKE_FARE: 0 },
      durationInRegime: 0,
      transitionProb: 0.3,
    },
    subModels: [],
    reason: 'Insufficient data for model-based prediction. Using conservative defaults.',
    featureImportances: {},
    meta: { version: 'v7', modelsUsed: [], latencyMs: Date.now() - t0, dataQuality: 0 },
  };
}
