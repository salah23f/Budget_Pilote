/**
 * Monte Carlo Tree Search — multi-step buy/wait planning.
 *
 * Actions: BUY_NOW, WAIT_1d, WAIT_7d, WAIT_30d
 * State: (current_price, ttd, regime, velocity)
 * Rollouts: simulated via OU process + regime transitions
 * Objective: minimize expected regret (not expected price)
 *
 * UCB1 for exploration vs exploitation balance.
 * 1000 simulations per decision (fast — pure math, no I/O).
 *
 * Ref: Browne et al. (2012), "A Survey of MCTS Methods"
 */

import type { PredictionContext, SubModelOutput, V7Action } from './types';

interface MCTSNode {
  action: 'BUY' | 'WAIT_1' | 'WAIT_7' | 'WAIT_30';
  visits: number;
  totalReward: number;
  children: MCTSNode[];
}

/** Simple seeded PRNG */
class RNG {
  private s: number;
  constructor(seed: number) { this.s = seed | 0 || 1; }
  next(): number {
    let x = this.s;
    x ^= x << 13; x ^= x >> 17; x ^= x << 5;
    this.s = x;
    return (x >>> 0) / 4294967296;
  }
  normal(): number {
    return Math.sqrt(-2 * Math.log(Math.max(1e-10, this.next()))) * Math.cos(2 * Math.PI * this.next());
  }
}

/**
 * Simulate a price trajectory forward from current state.
 * Returns the minimum price seen during the rollout.
 */
function rollout(
  currentPrice: number,
  ttd: number,
  waitDays: number,
  mean: number,
  sigma: number,
  phi: number,
  rng: RNG
): { minPrice: number; finalPrice: number } {
  let price = currentPrice;
  let logP = Math.log(price);
  const logMu = Math.log(mean);
  let minPrice = price;

  for (let d = 0; d < waitDays && ttd - d > 0; d++) {
    const remainingTTD = ttd - d;
    const volMult = remainingTTD < 7 ? 2.5 : remainingTTD < 14 ? 1.5 : 1.0;
    logP += phi * (logMu - logP) + sigma * volMult * rng.normal();
    price = Math.exp(logP);
    if (price < minPrice) minPrice = price;
  }

  return { minPrice, finalPrice: price };
}

/**
 * MCTS with UCB1 selection.
 */
export function runMCTS(
  currentPrice: number,
  ttd: number,
  mean: number,
  sigma: number,
  phi: number,
  nSimulations: number = 1000,
  seed: number = 42
): { bestAction: string; actionValues: Record<string, number>; regret: Record<string, number> } {
  const rng = new RNG(seed);

  const actions = [
    { key: 'BUY', waitDays: 0 },
    { key: 'WAIT_1', waitDays: 1 },
    { key: 'WAIT_7', waitDays: 7 },
    { key: 'WAIT_30', waitDays: Math.min(30, ttd - 1) },
  ].filter((a) => a.waitDays < ttd);

  const visits: Record<string, number> = {};
  const totalReward: Record<string, number> = {};
  for (const a of actions) {
    visits[a.key] = 0;
    totalReward[a.key] = 0;
  }

  for (let sim = 0; sim < nSimulations; sim++) {
    // UCB1 selection
    const totalVisits = sim + 1;
    let bestUCB = -Infinity;
    let selectedAction = actions[0];

    for (const a of actions) {
      if (visits[a.key] === 0) {
        selectedAction = a;
        break;
      }
      const exploit = totalReward[a.key] / visits[a.key];
      const explore = Math.sqrt(2 * Math.log(totalVisits) / visits[a.key]);
      const ucb = exploit + explore;
      if (ucb > bestUCB) {
        bestUCB = ucb;
        selectedAction = a;
      }
    }

    // Simulate
    let reward: number;
    if (selectedAction.waitDays === 0) {
      // BUY NOW — reward = how much better than buying at a random future time
      reward = 0; // baseline: buy at current price
    } else {
      const result = rollout(currentPrice, ttd, selectedAction.waitDays, mean, sigma, phi, rng);
      // Reward = savings from waiting (positive = waiting saved money)
      reward = (currentPrice - result.minPrice) / Math.max(1, currentPrice) * 10;
      // Penalize risk: if final price > current price, we lost
      if (result.finalPrice > currentPrice * 1.1) {
        reward -= 2;
      }
    }

    visits[selectedAction.key]++;
    totalReward[selectedAction.key] += reward;
  }

  // Compute action values and pick best
  const actionValues: Record<string, number> = {};
  const regret: Record<string, number> = {};
  let bestAction = 'BUY';
  let bestValue = -Infinity;

  for (const a of actions) {
    const v = visits[a.key] > 0 ? totalReward[a.key] / visits[a.key] : 0;
    actionValues[a.key] = v;
    regret[a.key] = visits[a.key] > 0 ? -v : 0; // negative reward = regret
    if (v > bestValue) {
      bestValue = v;
      bestAction = a.key;
    }
  }

  return { bestAction, actionValues, regret };
}

/**
 * V7 sub-model: MCTS-based planning.
 */
export function predictMCTS(ctx: PredictionContext): SubModelOutput {
  const series = ctx.priceSeries;
  if (series.length < 5) {
    return { modelId: 'mcts', action: 'MONITOR', confidence: 0.1, probBetter: 0.5, expectedFloor: ctx.currentPrice };
  }

  const prices = series.map((p) => p.price);
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const std = Math.sqrt(prices.reduce((a, p) => a + (p - mean) ** 2, 0) / Math.max(1, prices.length - 1));
  const sigma = std / Math.max(1, mean) * 0.3;

  // Estimate phi (mean-reversion speed)
  let sumProd = 0, sumSq = 0;
  for (let i = 1; i < prices.length; i++) {
    sumProd += (prices[i] - mean) * (prices[i - 1] - mean);
    sumSq += (prices[i - 1] - mean) ** 2;
  }
  const phi = sumSq > 0 ? Math.max(0.01, Math.min(0.2, 1 - sumProd / sumSq)) : 0.05;

  const { bestAction, actionValues } = runMCTS(
    ctx.currentPrice, ctx.ttd, mean, sigma, phi, 2000, Date.now() % 100000
  );

  let action: V7Action;
  if (bestAction === 'BUY') action = 'BUY_NOW';
  else if (bestAction === 'WAIT_30' || bestAction === 'WAIT_7') action = 'WAIT';
  else action = 'MONITOR';

  const buyValue = actionValues['BUY'] ?? 0;
  const waitValues = Object.entries(actionValues).filter(([k]) => k !== 'BUY').map(([, v]) => v);
  const bestWaitValue = waitValues.length > 0 ? Math.max(...waitValues) : 0;
  const probBetter = bestWaitValue > buyValue ? Math.min(0.9, 0.5 + (bestWaitValue - buyValue) * 0.15) : Math.max(0.1, 0.5 - (buyValue - bestWaitValue) * 0.15);

  return {
    modelId: 'mcts',
    action,
    confidence: Math.min(0.9, 0.4 + 0.3 * Math.min(1, series.length / 20) + 0.3 * Math.abs(buyValue - bestWaitValue)),
    probBetter,
    expectedFloor: Math.max(Math.min(...prices) * 0.9, mean - 1.5 * std),
    meta: { bestAction, actionValues, phi, sigma },
  };
}
