/**
 * Survival Analysis — models the probability of seeing a price below a
 * target threshold as a function of time.
 *
 * Event: "price drops below X% of current level"
 * Time: days from now
 *
 * Implements:
 *   - Kaplan-Meier estimator for the survival function S(t)
 *   - Exponential parametric model for forecasting
 *
 * Used by the ensemble to estimate "how long should I wait?" and
 * "what's the probability I'll see a better price in D days?"
 *
 * Ref: Kaplan & Meier (1958), Klein & Moeschberger (2003)
 */

import type { PredictionContext, SubModelOutput, V7Action } from './types';

interface SurvivalEvent {
  /** Time in days from start of observation */
  time: number;
  /** True if the event occurred (price dropped below target), false if censored */
  event: boolean;
}

/**
 * Kaplan-Meier survival function estimator.
 *
 * Returns an array of (time, S(t)) pairs where S(t) = P(T > t).
 */
export function kaplanMeier(
  events: SurvivalEvent[]
): Array<{ time: number; survival: number }> {
  if (events.length === 0) return [{ time: 0, survival: 1 }];

  // Sort by time
  const sorted = [...events].sort((a, b) => a.time - b.time);

  const result: Array<{ time: number; survival: number }> = [];
  let nAtRisk = sorted.length;
  let survival = 1;

  let i = 0;
  while (i < sorted.length) {
    const t = sorted[i].time;
    // Count events and censored at this time
    let nEvents = 0;
    let nCensored = 0;
    while (i < sorted.length && sorted[i].time === t) {
      if (sorted[i].event) nEvents++;
      else nCensored++;
      i++;
    }

    if (nEvents > 0) {
      survival *= 1 - nEvents / nAtRisk;
    }
    result.push({ time: t, survival: Math.max(0, survival) });
    nAtRisk -= nEvents + nCensored;
    if (nAtRisk <= 0) break;
  }

  return result;
}

/**
 * Estimate survival probability at a specific time using the KM curve.
 */
export function survivalAtTime(
  kmCurve: Array<{ time: number; survival: number }>,
  t: number
): number {
  if (kmCurve.length === 0) return 1;
  if (t <= 0) return 1;

  // Find the last KM step before or at time t
  let s = 1;
  for (const point of kmCurve) {
    if (point.time > t) break;
    s = point.survival;
  }
  return s;
}

/**
 * Fit exponential survival model: S(t) = exp(-λt)
 * MLE for λ = events / total_time_at_risk
 */
export function fitExponential(events: SurvivalEvent[]): { lambda: number } {
  let totalTime = 0;
  let totalEvents = 0;
  for (const e of events) {
    totalTime += e.time;
    if (e.event) totalEvents++;
  }
  const lambda = totalTime > 0 ? totalEvents / totalTime : 0.01;
  return { lambda: Math.max(0.001, Math.min(1, lambda)) };
}

/**
 * V7 sub-model: Survival analysis prediction.
 *
 * Converts the price series into survival events:
 *   - For each historical price drop below X% of baseline, record as event
 *   - For prices that stayed above, record as censored
 *
 * Then uses KM to estimate P(price drops below target in D days).
 */
export function predictSurvival(ctx: PredictionContext): SubModelOutput {
  const series = ctx.priceSeries;
  if (series.length < 8) {
    return {
      modelId: 'survival',
      action: 'MONITOR',
      confidence: 0.1,
      probBetter: 0.5,
      expectedFloor: ctx.currentPrice,
    };
  }

  const prices = series.map((p) => p.price);
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const minP = Math.min(...prices);

  // Target: 10% below current price
  const target = ctx.currentPrice * 0.9;

  // Build survival events: track how long each "observation window" takes
  // before price drops below target
  const events: SurvivalEvent[] = [];
  for (let i = 0; i < series.length - 1; i++) {
    if (series[i].price > target) {
      // Find when (if ever) price drops below target after this point
      let foundEvent = false;
      for (let j = i + 1; j < series.length; j++) {
        const daysDiff = (series[j].timestamp - series[i].timestamp) / 86400000;
        if (series[j].price <= target) {
          events.push({ time: Math.max(1, Math.round(daysDiff)), event: true });
          foundEvent = true;
          break;
        }
      }
      if (!foundEvent) {
        // Censored — never dropped below target in our window
        const maxTime = (series[series.length - 1].timestamp - series[i].timestamp) / 86400000;
        events.push({ time: Math.max(1, Math.round(maxTime)), event: false });
      }
    }
  }

  if (events.length < 3) {
    return {
      modelId: 'survival',
      action: 'MONITOR',
      confidence: 0.15,
      probBetter: 0.4,
      expectedFloor: minP,
    };
  }

  const km = kaplanMeier(events);
  const exp = fitExponential(events);

  // P(price drops in next 7 days)
  const survAt7 = survivalAtTime(km, 7);
  const probDrop7 = 1 - survAt7;

  // P(price drops in next 30 days)
  const survAt30 = survivalAtTime(km, 30);
  const probDrop30 = 1 - survAt30;

  // P(price drops before departure)
  const survAtTTD = survivalAtTime(km, ctx.ttd);
  const probDropTTD = 1 - survAtTTD;

  // Expected floor from exponential model
  const medianSurvival = Math.log(2) / exp.lambda; // median time to event
  const expectedFloor = ctx.currentPrice * (1 - 0.1 * (1 - Math.exp(-exp.lambda * ctx.ttd)));

  // Decision
  let action: V7Action = 'MONITOR';
  if (probDropTTD < 0.15) {
    // Unlikely to see a better price — buy now
    action = 'BUY_NOW';
  } else if (probDropTTD > 0.6 && ctx.ttd > 21) {
    // Good chance of improvement and we have time
    action = 'WAIT';
  }

  const confidence = Math.min(0.85,
    0.3 + 0.4 * Math.min(1, events.length / 15) +
    0.3 * (probDropTTD < 0.3 || probDropTTD > 0.7 ? 0.8 : 0.3)
  );

  return {
    modelId: 'survival',
    action,
    confidence,
    probBetter: probDropTTD,
    expectedFloor: Math.max(minP * 0.9, expectedFloor),
    meta: {
      probDrop7,
      probDrop30,
      probDropTTD,
      survivalEvents: events.length,
      expLambda: exp.lambda,
      medianSurvival,
    },
  };
}
