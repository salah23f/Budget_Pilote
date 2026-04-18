/**
 * Kalman Filter — online estimation of the "fair price" hidden state.
 *
 * State vector: x = [price, velocity] (price level + rate of change)
 * Observation: z = observed_price (noisy)
 *
 * Process model:
 *   price_{t+1}  = price_t + velocity_t * dt + noise_q1
 *   velocity_{t+1} = velocity_t + noise_q2
 *
 * Observation model:
 *   z_t = price_t + noise_r
 *
 * Process noise Q scales with TTD (more volatile near departure).
 * Observation noise R scales with route volatility.
 *
 * Reference: Welch & Bishop, "An Introduction to the Kalman Filter", UNC 2006.
 */

import type { PredictionContext, SubModelOutput, V7Action } from './types';

export interface KalmanState {
  /** State estimate [price, velocity] */
  x: [number, number];
  /** Error covariance 2x2 matrix (flattened row-major) */
  P: [number, number, number, number];
  /** Last update timestamp (ms) */
  lastTs: number;
}

export function initKalman(price: number, ts: number): KalmanState {
  return {
    x: [price, 0], // initial: observed price, zero velocity
    P: [100, 0, 0, 10], // initial uncertainty: price ±10, velocity ±3.16
    lastTs: ts,
  };
}

/**
 * Kalman predict step — advance state by dt days.
 */
export function kalmanPredict(
  state: KalmanState,
  dt: number,
  processNoise: number
): KalmanState {
  if (dt <= 0) return state;

  const [x0, x1] = state.x;
  const [p00, p01, p10, p11] = state.P;

  // State transition: x' = F * x
  // F = [[1, dt], [0, 1]]
  const xPred: [number, number] = [x0 + x1 * dt, x1];

  // Covariance: P' = F * P * F^T + Q
  const pPred: [number, number, number, number] = [
    p00 + dt * (p01 + p10) + dt * dt * p11 + processNoise * dt,
    p01 + dt * p11,
    p10 + dt * p11,
    p11 + processNoise * 0.1,
  ];

  return { x: xPred, P: pPred, lastTs: state.lastTs };
}

/**
 * Kalman update step — incorporate a new observation.
 */
export function kalmanUpdate(
  state: KalmanState,
  observation: number,
  observationNoise: number,
  ts: number
): KalmanState {
  const [x0, x1] = state.x;
  const [p00, p01, p10, p11] = state.P;

  // Innovation: y = z - H * x (H = [1, 0])
  const y = observation - x0;

  // Innovation covariance: S = H * P * H^T + R
  const S = p00 + observationNoise;

  if (Math.abs(S) < 1e-10) return state; // degenerate

  // Kalman gain: K = P * H^T / S
  const k0 = p00 / S;
  const k1 = p10 / S;

  // Updated state: x' = x + K * y
  const xUpd: [number, number] = [x0 + k0 * y, x1 + k1 * y];

  // Updated covariance: P' = (I - K * H) * P
  const pUpd: [number, number, number, number] = [
    (1 - k0) * p00,
    (1 - k0) * p01,
    p10 - k1 * p00,
    p11 - k1 * p01,
  ];

  return { x: xUpd, P: pUpd, lastTs: ts };
}

/**
 * Run Kalman filter over a price series and return the latest state.
 */
export function runKalmanFilter(
  series: Array<{ price: number; timestamp: number; ttd: number }>,
  routeVolatility: number // stdev/mean of the route
): KalmanState | null {
  if (series.length === 0) return null;

  const sorted = [...series].sort((a, b) => a.timestamp - b.timestamp);
  let state = initKalman(sorted[0].price, sorted[0].timestamp);

  // Process noise scales with route volatility
  const baseQ = Math.max(1, routeVolatility * sorted[0].price * 0.01);
  // Observation noise — assumes 2-5% measurement error
  const baseR = Math.max(1, (routeVolatility * sorted[0].price) ** 2 * 0.04);

  for (let i = 1; i < sorted.length; i++) {
    const dt = Math.max(0.01, (sorted[i].timestamp - sorted[i - 1].timestamp) / 86400000);

    // Process noise increases near departure (more volatile)
    const ttdFactor = sorted[i].ttd > 0 ? Math.max(0.5, 60 / sorted[i].ttd) : 3;
    const Q = baseQ * ttdFactor;
    const R = baseR;

    state = kalmanPredict(state, dt, Q);
    state = kalmanUpdate(state, sorted[i].price, R, sorted[i].timestamp);
  }

  return state;
}

/**
 * V7 sub-model: Kalman-based prediction.
 */
export function predictKalman(ctx: PredictionContext): SubModelOutput {
  const series = ctx.priceSeries.map((p) => ({
    price: p.price,
    timestamp: p.timestamp,
    ttd: p.ttd,
  }));

  if (series.length < 3) {
    return {
      modelId: 'kalman',
      action: 'MONITOR',
      confidence: 0.1,
      probBetter: 0.5,
      expectedFloor: ctx.currentPrice,
    };
  }

  const prices = series.map((s) => s.price);
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const stdev = Math.sqrt(
    prices.reduce((a, p) => a + (p - mean) ** 2, 0) / Math.max(1, prices.length - 1)
  );
  const cv = mean > 0 ? stdev / mean : 0.1;

  const state = runKalmanFilter(series, cv);
  if (!state) {
    return {
      modelId: 'kalman',
      action: 'MONITOR',
      confidence: 0.1,
      probBetter: 0.5,
      expectedFloor: ctx.currentPrice,
    };
  }

  const [fairPrice, velocity] = state.x;
  const priceUncertainty = Math.sqrt(Math.max(0, state.P[0]));

  // Decision logic based on Kalman state
  const deviation = ctx.currentPrice - fairPrice;
  const deviationSigmas = priceUncertainty > 0.01 ? deviation / priceUncertainty : 0;

  // Projected price in 7 days
  const projected7d = fairPrice + velocity * 7;
  const probBetter = velocity < 0
    ? Math.min(0.9, 0.5 + Math.abs(velocity) / (stdev / 7 + 0.01) * 0.3)
    : Math.max(0.1, 0.5 - velocity / (stdev / 7 + 0.01) * 0.3);

  // Expected floor: fair price - 1.5 * uncertainty (optimistic but bounded)
  const expectedFloor = Math.max(
    prices.length > 0 ? Math.min(...prices) * 0.95 : ctx.currentPrice * 0.8,
    fairPrice - 1.5 * priceUncertainty
  );

  let action: V7Action = 'MONITOR';
  if (deviationSigmas < -1.5 || (ctx.ttd < 14 && deviationSigmas < -0.5)) {
    action = 'BUY_NOW';
  } else if (deviationSigmas > 1.0 && velocity < 0 && ctx.ttd > 21) {
    action = 'WAIT';
  }

  // Confidence based on filter convergence + data quality
  const filterConvergence = 1 / (1 + priceUncertainty / Math.max(1, mean * 0.05));
  const dataQuality = Math.min(1, series.length / 30);
  const confidence = 0.5 * filterConvergence + 0.5 * dataQuality;

  return {
    modelId: 'kalman',
    action,
    confidence: Math.min(0.95, confidence),
    probBetter,
    expectedFloor,
    priceForecast: {
      mean: fairPrice,
      std: priceUncertainty,
      quantiles: {
        0.1: fairPrice - 1.28 * priceUncertainty,
        0.25: fairPrice - 0.67 * priceUncertainty,
        0.5: fairPrice,
        0.75: fairPrice + 0.67 * priceUncertainty,
        0.9: fairPrice + 1.28 * priceUncertainty,
      },
    },
    meta: {
      fairPrice,
      velocity,
      priceUncertainty,
      deviationSigmas,
      projected7d,
    },
  };
}
