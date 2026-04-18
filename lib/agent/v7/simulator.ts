/**
 * Price trajectory simulator — generates realistic flight price curves
 * for backtesting and MCTS rollouts.
 *
 * Model: Ornstein-Uhlenbeck mean-reverting process with:
 *   - Seasonal component (day-of-week + month multipliers)
 *   - TTD-dependent volatility (increases near departure)
 *   - Jump process for mistake fares (Poisson arrivals)
 *   - Regime transitions (descent → floor → ascent → panic)
 *
 * Calibrated to realistic parameters from airline pricing literature.
 */

import type { SimulatedTrajectory } from './types';

export interface SimulatorParams {
  /** Base price for the route in USD */
  basePrice: number;
  /** Days from booking window open to departure */
  horizonDays: number;
  /** Mean-reversion speed (0.01 = slow, 0.1 = fast) */
  kappa?: number;
  /** Base volatility (fraction of basePrice per sqrt(day)) */
  sigma?: number;
  /** Mistake fare probability per day */
  jumpProb?: number;
  /** Mistake fare discount (fraction, e.g. 0.4 = 40% below current) */
  jumpSize?: number;
  /** Random seed for reproducibility */
  seed?: number;
}

/** Simple seeded PRNG (xorshift32) */
class PRNG {
  private state: number;
  constructor(seed: number) {
    this.state = seed | 0 || 1;
  }
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    this.state = x;
    return (x >>> 0) / 4294967296;
  }
  /** Box-Muller transform for standard normal */
  normal(): number {
    const u1 = Math.max(1e-10, this.next());
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}

/** Day-of-week multiplier (0=Mon..6=Sun). Flights cheaper mid-week. */
const DOW_MULT = [0.97, 0.95, 0.96, 0.98, 1.02, 1.04, 1.03];

/** Month multiplier. Peak summer + holidays. */
const MONTH_MULT = [0.92, 0.90, 0.95, 0.98, 1.0, 1.08, 1.15, 1.12, 1.02, 0.95, 0.93, 1.05];

/** TTD volatility curve — vol multiplier as function of days-to-departure */
function ttdVolMultiplier(ttd: number): number {
  if (ttd > 120) return 0.6;
  if (ttd > 60) return 0.8;
  if (ttd > 30) return 1.0;
  if (ttd > 14) return 1.3;
  if (ttd > 7) return 1.8;
  if (ttd > 3) return 2.5;
  return 3.5;
}

/** TTD mean-shift — prices rise near departure (bid-price effect) */
function ttdMeanShift(ttd: number, basePrice: number): number {
  if (ttd > 60) return 0;
  if (ttd > 30) return basePrice * 0.05;
  if (ttd > 14) return basePrice * 0.15;
  if (ttd > 7) return basePrice * 0.3;
  return basePrice * 0.5;
}

/**
 * Generate a single price trajectory.
 */
export function simulateTrajectory(params: SimulatorParams): SimulatedTrajectory {
  const {
    basePrice,
    horizonDays,
    kappa = 0.03,
    sigma = 0.02,
    jumpProb = 0.01,
    jumpSize = 0.35,
    seed = Date.now(),
  } = params;

  const rng = new PRNG(seed);
  const T = Math.max(1, horizonDays);
  const prices: number[] = [];

  // Start at base price + some random offset
  let logPrice = Math.log(basePrice) + rng.normal() * sigma * 2;
  const logMu = Math.log(basePrice);

  for (let d = 0; d < T; d++) {
    const ttd = T - d;
    const dow = d % 7;
    const month = Math.floor((d / 30) % 12);

    // Mean-reversion (OU process in log-space)
    const meanShift = ttdMeanShift(ttd, basePrice);
    const effectiveMu = logMu + Math.log(1 + meanShift / basePrice);
    const dt = 1;
    const volMult = ttdVolMultiplier(ttd);

    logPrice +=
      kappa * (effectiveMu - logPrice) * dt +
      sigma * volMult * rng.normal() * Math.sqrt(dt);

    // Seasonal adjustments
    logPrice += Math.log(DOW_MULT[dow]) * 0.1;
    logPrice += Math.log(MONTH_MULT[month]) * 0.05;

    // Jump process (mistake fare)
    if (rng.next() < jumpProb) {
      logPrice -= jumpSize + rng.next() * jumpSize * 0.5;
    }

    // Floor at 30% of base price (no airline sells below cost)
    const price = Math.max(basePrice * 0.3, Math.round(Math.exp(logPrice)));
    prices.push(price);
  }

  // Find floor and optimal window
  let floor = Infinity;
  let floorDay = 0;
  for (let d = 0; d < prices.length; d++) {
    if (prices[d] < floor) {
      floor = prices[d];
      floorDay = d;
    }
  }

  // Optimal window: 5% above floor
  const threshold = floor * 1.05;
  let windowStart = floorDay;
  let windowEnd = floorDay;
  for (let d = floorDay; d >= 0; d--) {
    if (prices[d] <= threshold) windowStart = d;
    else break;
  }
  for (let d = floorDay; d < prices.length; d++) {
    if (prices[d] <= threshold) windowEnd = d;
    else break;
  }

  return {
    prices,
    floor,
    floorDay,
    optimalWindow: [windowStart, windowEnd],
  };
}

/**
 * Generate N trajectories for backtesting.
 */
export function simulateMany(
  params: SimulatorParams,
  n: number
): SimulatedTrajectory[] {
  const results: SimulatedTrajectory[] = [];
  for (let i = 0; i < n; i++) {
    results.push(simulateTrajectory({ ...params, seed: (params.seed ?? 42) + i * 7919 }));
  }
  return results;
}

/**
 * Generate fixture data for the 50-route benchmark.
 */
export function generate50RouteFixtures(): Array<{
  routeKey: string;
  basePrice: number;
  horizon: number;
  trajectory: SimulatedTrajectory;
}> {
  const routes = [
    { key: 'CDG-NRT', base: 780, h: 120 }, { key: 'CDG-JFK', base: 450, h: 90 },
    { key: 'LHR-SIN', base: 650, h: 150 }, { key: 'LHR-LAX', base: 520, h: 100 },
    { key: 'FRA-BKK', base: 580, h: 130 }, { key: 'AMS-HND', base: 820, h: 120 },
    { key: 'CDG-DXB', base: 380, h: 60 },  { key: 'JFK-LHR', base: 480, h: 90 },
    { key: 'LAX-NRT', base: 680, h: 120 }, { key: 'SFO-CDG', base: 550, h: 100 },
    { key: 'JFK-FCO', base: 420, h: 90 },  { key: 'ORD-LHR', base: 460, h: 80 },
    { key: 'CDG-IST', base: 220, h: 60 },  { key: 'LHR-BOM', base: 520, h: 130 },
    { key: 'FRA-JFK', base: 440, h: 90 },  { key: 'AMS-BCN', base: 120, h: 45 },
    { key: 'CDG-RAK', base: 150, h: 45 },  { key: 'LHR-CPT', base: 620, h: 150 },
    { key: 'JFK-CUN', base: 280, h: 60 },  { key: 'LAX-HNL', base: 220, h: 45 },
    { key: 'CDG-ATH', base: 180, h: 60 },  { key: 'LHR-DPS', base: 720, h: 150 },
    { key: 'JFK-SJU', base: 180, h: 45 },  { key: 'ORD-CUN', base: 250, h: 60 },
    { key: 'SFO-HND', base: 750, h: 120 }, { key: 'BOS-LIS', base: 350, h: 90 },
    { key: 'IAD-CDG', base: 480, h: 90 },  { key: 'MIA-BOG', base: 280, h: 60 },
    { key: 'CDG-CMN', base: 160, h: 45 },  { key: 'LHR-DEL', base: 480, h: 130 },
    { key: 'FCO-JFK', base: 450, h: 90 },  { key: 'MAD-EZE', base: 680, h: 150 },
    { key: 'BCN-TLV', base: 180, h: 60 },  { key: 'CDG-MEX', base: 520, h: 130 },
    { key: 'AMS-IAD', base: 440, h: 90 },  { key: 'LHR-YYZ', base: 420, h: 80 },
    { key: 'CDG-GRU', base: 580, h: 150 }, { key: 'JFK-BCN', base: 380, h: 90 },
    { key: 'SFO-ICN', base: 700, h: 120 }, { key: 'LAX-SYD', base: 850, h: 150 },
    { key: 'ORD-FCO', base: 480, h: 100 }, { key: 'FRA-PVG', base: 580, h: 120 },
    { key: 'LHR-KUL', base: 520, h: 130 }, { key: 'CDG-PEK', base: 620, h: 120 },
    { key: 'JFK-DUB', base: 350, h: 80 },  { key: 'LAX-CDG', base: 550, h: 100 },
    { key: 'AMS-BKK', base: 560, h: 130 }, { key: 'FRA-ORD', base: 440, h: 90 },
    { key: 'CDG-TUN', base: 140, h: 45 },  { key: 'LHR-NBO', base: 480, h: 130 },
  ];

  return routes.map((r, i) => ({
    routeKey: r.key,
    basePrice: r.base,
    horizon: r.h,
    trajectory: simulateTrajectory({
      basePrice: r.base,
      horizonDays: r.h,
      seed: 42 + i * 1337,
    }),
  }));
}
