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

/* ── User preference profile (v1 — retained for back-compat) ── */

export type PersonaCohort = 'explorer' | 'planner' | 'decisive' | 'newcomer';

export interface UserPreferenceProfile {
  userId: string;
  priceSensitivity: number;
  convenienceSensitivity: number;
  certaintySensitivity: number;
  airlines: Record<string, number>;
  departureTimes: Record<'morning' | 'afternoon' | 'evening' | 'redeye', number>;
  cabins: Record<CabinClass, number>;
  destinations: Record<string, number>;
  durations: { mean: number; stdev: number };
  cohort: PersonaCohort;
  updatedAt: number;
  observationCount: number;
}

/* ── User travel profile (v2 — the real user model) ────────── */

/** Score with explicit confidence — always 0..1 for value, 0..1 for confidence. */
export interface AffinityScore {
  value: number;
  confidence: number;
  lastUpdatedAt: number;
}

export type UserCohort = 'newcomer' | 'explorer' | 'planner' | 'decisive' | 'dormant';

export interface UserTravelProfile {
  userId: string;
  deviceId: string;
  firstSeenAt: number;
  lastActiveAt: number;

  /** 0..1 — how much we actually know. Drives cold-start shrinkage. */
  dataRichness: number;
  observationCount: number;
  cohort: UserCohort;

  // Persona sensitivities
  priceSensitivity: AffinityScore;
  convenienceSensitivity: AffinityScore;
  certaintySensitivity: AffinityScore;
  hotelSensitivity: AffinityScore;
  explorationVsFamiliar: AffinityScore;
  spontaneityVsPlanning: AffinityScore;
  aspirationGap: AffinityScore;

  // Budget signature
  typicalTripBudgetUsd: {
    median: number;
    p25: number;
    p75: number;
    confidence: number;
  };
  budgetPerRoute: Record<string, { median: number; n: number; lastAt: number }>;

  // Temporal
  typicalLeadDays: { median: number; stdev: number; n: number };
  typicalDurationDays: { median: number; stdev: number; n: number };
  seasonAffinity: Record<'spring' | 'summer' | 'autumn' | 'winter', AffinityScore>;

  // Entities
  destinations: Record<string, AffinityScore>;
  destinationFatigue: Record<string, number>;
  destinationsSavedNotBooked: Record<string, number>;
  airlines: Record<string, AffinityScore>;
  cabins: Record<CabinClass, AffinityScore>;
  departureTimes: Record<'morning' | 'afternoon' | 'evening' | 'redeye', AffinityScore>;

  // Regional preferences
  preferredOriginRegions: Array<{ region: string; confidence: number }>;
  preferredDestRegions: Array<{ region: string; confidence: number }>;
}

/* ── Session intent + fusion ─────────────────────────────── */

export interface SessionIntent {
  sessionId: string;
  dominantGoal: 'cheapest' | 'convenience' | 'specific_destination' | 'exploration' | 'escape' | 'unknown';
  urgency: number;           // 0..1
  priceFlexibility: number;  // 0..1
  dateFlexibilityHint: number;
  destFlexibilityHint: number;
  hotelImportance: number;
  confidence: number;
}

export type ContradictionField = 'budget' | 'dates' | 'region' | 'cabin' | 'duration' | 'destination';

export interface Contradiction {
  field: ContradictionField;
  stated: unknown;
  profileExpected: unknown;
  severity: number; // 0..1
  resolution: 'trust_stated' | 'nudge_user' | 'soft_override' | 'refuse_until_confirmed';
  message: string;
}

export interface FusedIntent {
  stated: TravelIntent;
  session: SessionIntent;
  /** What the engine actually uses downstream. */
  effective: TravelIntent;
  contradictions: Contradiction[];
  /** Confidence in the fusion overall. */
  confidence: number;
}

/* ── Realism v2 ─────────────────────────────────────────── */

export interface RealismV2 extends FeasibilityAssessment {
  profileBudgetAlignment: number;
  historicalPressure: number;
  dataSufficiency: number;
  regionFlexibilityHeadroom: number;
  dateFlexibilityHeadroom: number;
  bottleneck: 'budget' | 'dates' | 'airports' | 'duration' | 'data' | null;
}

/* ── Enriched candidate ─────────────────────────────────── */

export interface CandidateFeatures {
  // Price
  priceUsd: number;
  priceVsRouteMedian: number;
  priceVsUserTypical: number;
  priceVsBudget: number;
  priceValueZ: number;

  // Convenience
  stops: number;
  durationMin: number;
  layoverQuality: number;
  redEye: boolean;
  weekendTravel: boolean;
  originAirportBurden: number;
  destAirportBurden: number;

  // Trust
  baselineDataPoints: number;
  baselineAgeDays: number;
  sourceDiversity: number;
  partnerReliability: number;
  refundability: 'refundable' | 'partial' | 'none';
  baggageIncluded: boolean;

  // Fit
  airlineAffinity: number;
  cabinAffinity: number;
  timeAffinity: number;
  destAffinity: number;
  seasonAffinity: number;
  durationAffinity: number;
  leadTimeAffinity: number;

  // Regret-risk primitives
  compromiseCount: number;
  extremeness: number;
  hiddenCostRisk: number;

  // Trip-level (if bundled)
  hotelQualityScore?: number;
  bundleSavingsVsSeparate?: number;
  budgetAllocationRatio?: number;

  // Meta
  sourceExpansion: 'exact' | 'date_flex' | 'airport_region' | 'adjacent_dest' | 'duration_flex' | 'bundle';
  destinationKey: string;
  tripDurationDays?: number;
}

export interface EnrichedCandidate {
  offerId: string;
  raw: OfferFeatures;
  features: CandidateFeatures;
  sourceExpansion: CandidateFeatures['sourceExpansion'];
}

/* ── 15-score ranking ───────────────────────────────────── */

export interface RankingScores {
  feasibilityScore: number;
  budgetRealismScore: number;
  flightFitScore: number;
  hotelFitScore: number;
  tripFitScore: number;
  convenienceScore: number;
  preferenceMatchScore: number;
  confidenceScore: number;
  regretRiskScore: number;
  discoveryScore: number;
  valueForMoneyScore: number;
  aspirationMatchScore: number;
  timingFitScore: number;
  conversionLikelihoodScore: number;
  overallRecommendationScore: number;
}

/* ── Extended cohorts ───────────────────────────────────── */

export type CohortV2 =
  | 'SMARTEST'
  | 'CHEAPEST_SANE'
  | 'SAFEST'
  | 'BEST_FIT'
  | 'PREMIUM_WORTH_IT'
  | 'HIDDEN_GEM'
  | 'WIDEN_TO_UNLOCK'
  | 'NOT_RECOMMENDED';

/* ── Ranked recommendation (v2) ─────────────────────────── */

export interface RankedRecommendation {
  offerId: string;
  features: CandidateFeatures;
  scores: RankingScores;
  cohorts: CohortV2[];
  safeToSurface: boolean;
  safeguardVeto?: string;
  explanation: {
    headline: string;
    why: string;
    evidence: string[];
    caveats: string[];
    contrarian?: string;
    cohort: CohortV2;
    confidence: number;
  };
}

/* ── Safeguard result ───────────────────────────────────── */

export type SafeguardReason =
  | 'price_temptation_low_fit'
  | 'hotel_veto'
  | 'regret_risk_for_certainty_user'
  | 'low_confidence_no_price_compensation'
  | 'blows_budget'
  | 'hidden_cost_trap'
  | 'fit_too_low';

export interface SafeguardResult {
  safe: boolean;
  reason?: SafeguardReason;
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
