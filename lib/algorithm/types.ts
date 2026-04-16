/**
 * Flyeas travel intelligence engine — type system.
 *
 * This file is the canonical vocabulary for the algorithm layer. If a name
 * changes here, propagate to feasibility.ts, explain.ts, cohorts.ts, and
 * any UI component that consumes these structures.
 *
 * User-facing term: "watch". DB/URL slug: stays "mission". Translation
 * happens only in the UI layer.
 */

/* ── Travel intent ──────────────────────────────────────── */

export type AirportSelection =
  | { kind: 'exact'; iata: string; label?: string }
  | { kind: 'region'; label: string; airports: string[] }
  | { kind: 'radius'; centerIata: string; km: number; airports: string[] };

export type DateFlexIntent =
  | { kind: 'exact'; departDate: string; returnDate?: string }
  | { kind: 'range'; from: string; to: string }
  | { kind: 'month'; month: string /* 'YYYY-MM' */ }
  | { kind: 'season'; year: number; season: 'winter' | 'spring' | 'summer' | 'autumn' }
  | { kind: 'weekends'; from: string; to: string };

export type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first';

export interface TravelIntent {
  origin: AirportSelection;
  destination: AirportSelection;
  dates: DateFlexIntent;
  /** Trip duration in days — only meaningful for flex intents that need a return. */
  duration?: { min?: number; max?: number };
  budgetUsd?: number;
  cabin?: CabinClass;
  travelers: { adults: number; children: number; infants: number };
  /** Max number of stops the traveler tolerates. null = unspecified. */
  maxStops?: number;
  /** Original free-text intent if the user described in natural language. */
  rawText?: string;
}

/** Output of Layer 1 (constraint resolution). */
export interface ResolvedConstraints {
  originAirports: string[];
  destinationAirports: string[];
  /** Concrete date windows the engine will search (ISO date strings). */
  dateWindows: Array<{ depart: string; return?: string; weight: number }>;
  durationRange: { minDays: number; maxDays: number };
  budgetUsd?: number;
  cabin: CabinClass;
  maxStops: number;
  travelers: { adults: number; children: number; infants: number };
  /** Machine-readable "breadth" indicator for each axis: 0 (single) → 1 (wide). */
  breadth: {
    airports: number;
    dates: number;
    duration: number;
  };
}

/* ── Baselines ──────────────────────────────────────────── */

export interface PriceBaseline {
  routeKey: string; // e.g. "CDG-NRT"
  /** Median price in USD for this route in the relevant date window. */
  median: number;
  /** Percentiles. */
  p5: number;
  p25: number;
  p75: number;
  p95: number;
  /** Number of historical data points. */
  dataPoints: number;
  /** Age in days of the most recent baseline update. */
  ageDays: number;
  /** Upstream source diversity 0..1 (more sources = more reliable). */
  sourceDiversity: number;
  /** Optional seasonality multiplier for the requested date window. */
  seasonalityFactor?: number;
}

/* ── Feasibility + realism ──────────────────────────────── */

export type BlockerKey =
  | 'budget_too_low'
  | 'constraints_too_tight'
  | 'no_baseline_data'
  | 'impossible_duration'
  | 'unreachable_route';

export interface ConstraintSuggestion {
  lever: 'dates' | 'airports' | 'duration' | 'stops' | 'cabin' | 'budget';
  description: string;
  /** How much the feasibilityScore would improve if applied (0..1, additive). */
  expectedFeasibilityGain: number;
}

export interface FeasibilityAssessment {
  feasibilityScore: number;       // 0..1 — P(matching offer appears in 30 days)
  budgetRealismScore: number;     // 0..1 — how realistic the target budget is
  constraintTightness: number;    // 0..1 — 0 = loose, 1 = overly squeezed
  baseline: PriceBaseline | null;
  blockers: BlockerKey[];
  suggestions: ConstraintSuggestion[];
  computedAt: number;
  /** Human-friendly verdict for UI. */
  verdict: 'easy' | 'likely' | 'tight' | 'unrealistic' | 'impossible' | 'insufficient_data';
}

/* ── Offer scoring ──────────────────────────────────────── */

export interface OfferFeatures {
  priceUsd: number;
  stops: number;
  durationMinutes: number;
  departureTime: string;
  arrivalTime: string;
  cabin: CabinClass;
  baggageIncluded: boolean;
  airline: string;
  /** Layover quality, precomputed. 0 = terrible, 1 = ideal. */
  layoverQuality?: number;
  /** Whether the offer is within the user's flex window. */
  inFlexWindow: boolean;
  /** Whether the offer uses a departure/arrival airport the user explicitly selected. */
  inAirportSet: boolean;
  /** Cancellation + refund terms. */
  cancelPolicy?: 'refundable' | 'partial' | 'none';
}

export interface AllScores {
  priceValueScore: number;              // 0..1
  convenienceScore: number;             // 0..1
  confidenceScore: number;              // 0..1
  preferenceMatchScore: number;         // 0..1
  flexibilityCompatibilityScore: number; // 0..1
  feasibilityScore: number;             // 0..1 (inherited from assessment)
  safetyScore: number;                  // 0..1
  explorationScore: number;             // 0..1
}

export type Cohort =
  | 'SMARTEST'
  | 'CHEAPEST'
  | 'SAFEST'
  | 'BEST_FIT'
  | 'WIDEN_TO_UNLOCK';

export interface Explanation {
  /** One-line headline the UI surfaces prominently. */
  headline: string;
  cohort: Cohort;
  /** Short positive evidence — each item is a terse phrase. */
  evidence: string[];
  /** Honest caveats — each item is a terse phrase. */
  caveats: string[];
  confidence: number; // 0..1
}

export interface Recommendation {
  watchId: string;
  offerId: string;
  offer: OfferFeatures;
  scores: AllScores;
  overallScore: number;
  cohorts: Cohort[];
  explanation: Explanation;
}

/* ── User preference profile ────────────────────────────── */

export type PersonaCohort = 'explorer' | 'planner' | 'decisive' | 'newcomer';

export interface UserPreferenceProfile {
  userId: string;
  priceSensitivity: number;        // 0..1
  convenienceSensitivity: number;  // 0..1
  certaintySensitivity: number;    // 0..1
  airlines: Record<string, number>; // airline code -> affinity 0..1
  departureTimes: Record<'morning' | 'afternoon' | 'evening' | 'redeye', number>;
  cabins: Record<CabinClass, number>;
  destinations: Record<string, number>; // IATA or country -> affinity
  durations: { mean: number; stdev: number };
  cohort: PersonaCohort;
  updatedAt: number;
  /** Number of behavior events observed. Used for cold-start. */
  observationCount: number;
}

/* ── Behavior events ────────────────────────────────────── */

export type BehaviorEventKind =
  | 'impression'
  | 'click'
  | 'save'
  | 'dismiss'
  | 'book'
  | 'abandon'
  | 'widen_applied';

export interface BehaviorEvent {
  userId?: string;
  deviceId: string;
  ts: number;
  kind: BehaviorEventKind;
  watchId?: string;
  offerFeatures?: Partial<OfferFeatures>;
  contextFeatures?: {
    budgetTightness?: number;
    flexUsed?: boolean;
    regionUsed?: boolean;
    cohortShown?: Cohort;
  };
}

/* ── Draft flow state ───────────────────────────────────── */

export interface DraftFlowState {
  userId?: string;
  deviceId: string;
  kind: 'watch_creation';
  intent: Partial<TravelIntent>;
  step: number;
  updatedAt: number;
}
