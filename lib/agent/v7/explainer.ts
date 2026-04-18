/**
 * SHAP-like Explainer — decomposes the ensemble decision into per-model contributions.
 *
 * For each sub-model, computes its marginal contribution to the final action
 * using a leave-one-out approach: how would the ensemble decide WITHOUT this model?
 *
 * Output: feature importances + human-readable explanation fragments.
 *
 * Ref: Lundberg & Lee (2017), "A Unified Approach to Interpreting Model Predictions"
 */

import type { EnsembleDecision, SubModelOutput, V7Action } from './types';
import { ensembleDecision } from './ensemble';

export interface ShapExplanation {
  /** Per-model Shapley-like importance (how much each model influenced the action) */
  modelImportances: Record<string, number>;
  /** Ranked list from most to least influential */
  rankedModels: Array<{ modelId: string; importance: number; action: V7Action; agreed: boolean }>;
  /** Human-readable fragments explaining the decision */
  fragments: string[];
  /** One-line summary */
  summary: string;
}

/** Action to numeric for comparison */
function actionToNum(a: V7Action): number {
  return a === 'BUY_NOW' ? 1 : a === 'WAIT' ? -1 : 0;
}

/**
 * Compute marginal importance of each model via leave-one-out.
 *
 * For each model i, re-run the ensemble without model i. The importance
 * of model i = |score_with - score_without|.
 */
export function computeShap(
  allOutputs: SubModelOutput[],
  finalDecision: EnsembleDecision,
  currentPrice: number,
  ttd: number,
  dataQuality: number
): ShapExplanation {
  const finalNum = actionToNum(finalDecision.action);
  const importances: Record<string, number> = {};

  for (let i = 0; i < allOutputs.length; i++) {
    const without = allOutputs.filter((_, j) => j !== i);
    if (without.length === 0) {
      importances[allOutputs[i].modelId] = 1.0;
      continue;
    }

    const decisionWithout = ensembleDecision(without, currentPrice, ttd, dataQuality);
    const withoutNum = actionToNum(decisionWithout.action);

    // Importance = how much the decision changed when this model was removed
    const confDelta = Math.abs(finalDecision.confidence - decisionWithout.confidence);
    const actionDelta = Math.abs(finalNum - withoutNum);
    importances[allOutputs[i].modelId] = actionDelta * 0.6 + confDelta * 0.4;
  }

  // Normalize to sum = 1
  const total = Object.values(importances).reduce((a, b) => a + b, 0);
  if (total > 0) {
    for (const k of Object.keys(importances)) {
      importances[k] = importances[k] / total;
    }
  }

  // Rank
  const ranked = allOutputs
    .map((o) => ({
      modelId: o.modelId,
      importance: importances[o.modelId] ?? 0,
      action: o.action,
      agreed: o.action === finalDecision.action,
    }))
    .sort((a, b) => b.importance - a.importance);

  // Build fragments
  const fragments = buildFragments(ranked, finalDecision, currentPrice, ttd);
  const summary = buildSummary(ranked, finalDecision);

  return { modelImportances: importances, rankedModels: ranked, fragments, summary };
}

function buildFragments(
  ranked: ShapExplanation['rankedModels'],
  decision: EnsembleDecision,
  price: number,
  ttd: number
): string[] {
  const frags: string[] = [];
  const top = ranked[0];

  if (!top) return ['Insufficient model data for explanation.'];

  // Most influential model
  const modelNames: Record<string, string> = {
    'kalman': 'the Kalman filter (fair-price estimator)',
    'hmm-regime': 'the regime detector',
    'bayesian-stopping': 'the optimal-stopping calculator',
    'bocpd': 'the change-point detector',
    'evt': 'the extreme-value analyzer',
    'survival': 'the survival model',
    'gp': 'the Gaussian process',
    'mcts': 'the Monte Carlo planner',
    'thompson': 'the policy selector',
  };

  const topName = modelNames[top.modelId] ?? top.modelId;
  frags.push(`The strongest signal comes from ${topName} (${Math.round(top.importance * 100)}% influence).`);

  // Agreement level
  const agreeing = ranked.filter((r) => r.agreed).length;
  const total = ranked.length;
  if (agreeing === total) {
    frags.push(`All ${total} models agree on ${decision.action.replace('_', ' ').toLowerCase()}.`);
  } else {
    frags.push(`${agreeing} of ${total} models agree. ${total - agreeing} suggest a different action.`);
  }

  // Regime context
  if (decision.regime?.current) {
    const regimeNames: Record<string, string> = {
      'PLATEAU_HIGH': 'prices are stable at a high level',
      'DESCENT': 'prices are trending down',
      'OPTIMAL_FLOOR': 'prices are near their historical low',
      'ASCENT': 'prices are climbing',
      'PANIC_LATE': 'last-minute surge is underway',
      'MISTAKE_FARE': 'an unusually low price was detected',
    };
    const desc = regimeNames[decision.regime.current] ?? decision.regime.current;
    frags.push(`Current regime: ${desc}.`);
  }

  // TTD urgency
  if (ttd < 7) {
    frags.push(`Only ${ttd} days to departure — time pressure is critical.`);
  } else if (ttd < 14) {
    frags.push(`${ttd} days to departure — getting tight.`);
  }

  return frags;
}

function buildSummary(
  ranked: ShapExplanation['rankedModels'],
  decision: EnsembleDecision
): string {
  const agreeing = ranked.filter((r) => r.agreed).length;
  const total = ranked.length;
  const confPct = Math.round(decision.confidence * 100);

  if (decision.action === 'BUY_NOW') {
    return `Buy recommended (${confPct}% confidence, ${agreeing}/${total} models agree). ${decision.reason}`;
  }
  if (decision.action === 'WAIT') {
    return `Wait recommended (${confPct}% confidence, ${agreeing}/${total} models agree). ${decision.reason}`;
  }
  return `Monitoring (${confPct}% confidence, models split ${agreeing}/${total}). ${decision.reason}`;
}
