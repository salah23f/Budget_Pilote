/**
 * V7 Predictor Types — shared vocabulary across all sub-models.
 *
 * Every sub-model consumes PredictionContext and returns SubModelOutput.
 * The ensemble layer aggregates SubModelOutputs into EnsembleDecision.
 */

export type V7Action = 'BUY_NOW' | 'MONITOR' | 'WAIT';

export interface PredictionContext {
  /** Current observed price in USD */
  currentPrice: number;
  /** Days until departure */
  ttd: number;
  /** Time-series of past observations for this route+TTD window */
  priceSeries: PricePoint[];
  /** Broader route history (all TTD windows) */
  allHistory: PricePoint[];
  /** Route identifier */
  routeKey: string;
  /** Current timestamp (ms) */
  nowMs: number;
}

export interface PricePoint {
  price: number;
  timestamp: number; // ms epoch
  ttd: number;       // days until departure at observation time
}

/** Output from any single sub-model */
export interface SubModelOutput {
  modelId: string;
  /** Probability distribution over future price (optional) */
  priceForecast?: {
    mean: number;
    std: number;
    quantiles: Record<number, number>; // tau -> value (e.g., 0.1 -> $540)
  };
  /** Action recommendation */
  action: V7Action;
  /** Confidence in the action 0..1 */
  confidence: number;
  /** Probability of seeing a lower price before departure */
  probBetter: number;
  /** Expected best achievable price */
  expectedFloor: number;
  /** Regime if detected */
  regime?: RegimeState;
  /** Free metadata for debugging */
  meta?: Record<string, unknown>;
}

export type RegimeName =
  | 'PLATEAU_HIGH'
  | 'DESCENT'
  | 'OPTIMAL_FLOOR'
  | 'ASCENT'
  | 'PANIC_LATE'
  | 'MISTAKE_FARE';

export interface RegimeState {
  current: RegimeName;
  probabilities: Record<RegimeName, number>;
  durationInRegime: number; // days
  transitionProb: number;   // P(regime changes in next step)
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  level: number; // e.g. 0.9 for 90%
  method: 'conformal' | 'gaussian' | 'quantile' | 'bootstrap';
}

export interface EnsembleDecision {
  action: V7Action;
  confidence: number;
  /** Probability the price will be lower in the next 7 days */
  probBetter7d: number;
  /** Probability the price will be lower before departure */
  probBetterBeforeDeparture: number;
  /** Expected minimum price achievable if we keep watching */
  expectedFloor: number;
  /** Risk-adjusted expected savings from waiting */
  expectedSavingsWait: number;
  /** CVaR — expected cost in the worst 5% of outcomes if we wait */
  cvar05: number;
  /** Calibrated prediction intervals */
  intervals: ConfidenceInterval[];
  /** Current detected regime */
  regime: RegimeState;
  /** Per-model breakdown */
  subModels: SubModelOutput[];
  /** Human-readable explanation */
  reason: string;
  /** SHAP-like feature importances for the decision */
  featureImportances: Record<string, number>;
  /** Model version and metadata */
  meta: {
    version: 'v7';
    modelsUsed: string[];
    latencyMs: number;
    dataQuality: number; // 0..1
  };
}

/** Simulator output — a single generated price trajectory */
export interface SimulatedTrajectory {
  prices: number[];         // daily prices from day 0 to day T
  floor: number;            // minimum price in trajectory
  floorDay: number;         // day index of floor
  optimalWindow: [number, number]; // [start, end] of best-buy window
}

/** Model metadata for registry */
export interface ModelMetadata {
  modelId: string;
  version: string;
  trainedAt: number;
  hyperparams: Record<string, unknown>;
  metrics: Record<string, number>;
  dataHash: string;
}
