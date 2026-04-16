/**
 * Intent fusion layer — combines stated intent, session signals, and the
 * persistent user profile into a single FusedIntent the engine acts on.
 *
 * Core principle: we trust explicit input *unless* the profile has high-confidence
 * evidence of a contradiction. In that case we nudge the user — never silently
 * override. The engine, however, uses a soft-fused "effective" intent for
 * candidate generation and ranking so we're not held hostage by a typo.
 */

import type {
  Contradiction,
  ContradictionField,
  FusedIntent,
  SessionIntent,
  TravelIntent,
  UserTravelProfile,
} from './types';

/* ── Neutral session intent ─────────────────────────── */

export function neutralSession(sessionId: string = 'anon'): SessionIntent {
  return {
    sessionId,
    dominantGoal: 'unknown',
    urgency: 0.3,
    priceFlexibility: 0.5,
    dateFlexibilityHint: 0.5,
    destFlexibilityHint: 0.5,
    hotelImportance: 0.5,
    confidence: 0,
  };
}

/* ── Public API ─────────────────────────────────────── */

/**
 * Fuse stated intent × session × profile.
 * Returns an effective intent plus the contradictions we detected.
 */
export function fuseIntent(
  stated: TravelIntent,
  session: SessionIntent,
  profile: UserTravelProfile | null
): FusedIntent {
  const contradictions: Contradiction[] = [];
  let effective: TravelIntent = structuredClone(stated);

  if (profile && profile.dataRichness > 0.2) {
    contradictions.push(...detectBudgetContradiction(stated, profile));
    contradictions.push(...detectDurationContradiction(stated, profile));
    contradictions.push(...detectDestinationContradiction(stated, profile));
  }

  // Soft-merge session hints into the effective intent (never overwriting stated)
  effective = applySessionHints(effective, session, profile);

  const confidence = computeFusionConfidence(stated, session, profile, contradictions);

  return {
    stated,
    session,
    effective,
    contradictions,
    confidence,
  };
}

/* ── Contradiction detectors ────────────────────────── */

function detectBudgetContradiction(
  stated: TravelIntent,
  profile: UserTravelProfile
): Contradiction[] {
  if (stated.budgetUsd == null) return [];
  const typical = profile.typicalTripBudgetUsd;
  if (typical.confidence < 0.3 || typical.median <= 0) return [];

  const ratio = stated.budgetUsd / typical.median;

  // User typically spends $1,200 but now states $400 — that's a strong contradiction
  if (ratio < 0.5) {
    return [
      {
        field: 'budget',
        stated: stated.budgetUsd,
        profileExpected: typical.median,
        severity: clampSeverity(1 - ratio),
        resolution: 'nudge_user',
        message: `You typically spend around $${Math.round(typical.median)} on trips. $${stated.budgetUsd} is unusually tight for you — want to try closer to your usual?`,
      },
    ];
  }

  // User typically spends $300 but states $2,000 — less common but worth noting
  if (ratio > 2.5) {
    return [
      {
        field: 'budget',
        stated: stated.budgetUsd,
        profileExpected: typical.median,
        severity: clampSeverity((ratio - 1) / 3),
        resolution: 'trust_stated',
        message: `Your typical budget is around $${Math.round(typical.median)}. This is a bigger trip — we'll show premium options too.`,
      },
    ];
  }

  return [];
}

function detectDurationContradiction(
  stated: TravelIntent,
  profile: UserTravelProfile
): Contradiction[] {
  if (!stated.duration?.max || profile.typicalDurationDays.n < 3) return [];
  const typ = profile.typicalDurationDays.median;
  const diff = Math.abs((stated.duration.max ?? typ) - typ);
  if (diff > Math.max(5, profile.typicalDurationDays.stdev * 2.5)) {
    return [
      {
        field: 'duration',
        stated: stated.duration,
        profileExpected: typ,
        severity: clampSeverity(diff / 14),
        resolution: 'trust_stated',
        message: `Typical trip: ${Math.round(typ)} days. This one's noticeably ${
          (stated.duration.max ?? typ) > typ ? 'longer' : 'shorter'
        }.`,
      },
    ];
  }
  return [];
}

function detectDestinationContradiction(
  stated: TravelIntent,
  profile: UserTravelProfile
): Contradiction[] {
  const dest = stated.destination;
  if (dest.kind !== 'exact') return [];
  const aff = profile.destinations[dest.iata];
  const fatigue = profile.destinationFatigue[dest.iata] ?? 0;

  if (fatigue > 0.7 && (!aff || aff.value < 0.4)) {
    return [
      {
        field: 'destination',
        stated: dest.iata,
        profileExpected: null,
        severity: fatigue,
        resolution: 'soft_override',
        message: `You've viewed ${dest.iata} often but rarely engaged. Want suggestions in the same region?`,
      },
    ];
  }
  return [];
}

/* ── Session hint application ───────────────────────── */

function applySessionHints(
  intent: TravelIntent,
  session: SessionIntent,
  profile: UserTravelProfile | null
): TravelIntent {
  const out = structuredClone(intent);

  // If session strongly suggests high urgency and user's spontaneity is high,
  // prefer tighter date windows for candidate generation (but don't change stated).
  // This is already captured in session.dateFlexibilityHint.

  // If profile says user is heavily hotel-sensitive but current intent has
  // no hotel preferences, session.hotelImportance lifts — engine will prefer bundles.
  if (profile?.hotelSensitivity.value && profile.hotelSensitivity.value > 0.55) {
    session.hotelImportance = Math.max(session.hotelImportance, profile.hotelSensitivity.value);
  }

  return out;
}

/* ── Confidence computation ─────────────────────────── */

function computeFusionConfidence(
  _stated: TravelIntent,
  session: SessionIntent,
  profile: UserTravelProfile | null,
  contradictions: Contradiction[]
): number {
  const profileConf = profile ? profile.dataRichness : 0;
  const sessionConf = session.confidence;
  // Contradictions reduce confidence in the fused intent
  const contradictionPenalty = contradictions.reduce(
    (acc, c) => acc + c.severity * 0.15,
    0
  );
  return clamp01(0.4 + 0.4 * profileConf + 0.2 * sessionConf - contradictionPenalty);
}

/* ── Utilities ──────────────────────────────────────── */

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const clampSeverity = (n: number): number => clamp01(n);

/**
 * Given contradictions, should we block the watch and force user confirmation?
 * Returns null if safe to proceed, otherwise the field that must be resolved.
 */
export function requiresUserConfirmation(fused: FusedIntent): ContradictionField | null {
  const hard = fused.contradictions.find(
    (c) => c.resolution === 'refuse_until_confirmed' || (c.resolution === 'nudge_user' && c.severity > 0.85)
  );
  return hard ? hard.field : null;
}

/**
 * Convenience: infer a session intent from a handful of recent signals.
 * Intended to run each time a user opens a watch creation flow.
 */
export function inferSessionIntent(signals: {
  sessionId: string;
  timeOnSite?: number; // ms
  pricesViewed?: number[];
  datesChanged?: number; // count of date picker changes
  airportsViewed?: number; // distinct airports viewed
  hotelsClicked?: number;
  urgencyFromCopy?: number; // 0..1 if we parsed "next week", "asap"
}): SessionIntent {
  const {
    sessionId,
    pricesViewed = [],
    datesChanged = 0,
    airportsViewed = 0,
    hotelsClicked = 0,
    urgencyFromCopy = 0,
  } = signals;

  // Dominant goal
  let dominantGoal: SessionIntent['dominantGoal'] = 'unknown';
  if (pricesViewed.length >= 5) dominantGoal = 'cheapest';
  else if (airportsViewed >= 3) dominantGoal = 'exploration';
  else if (hotelsClicked > pricesViewed.length) dominantGoal = 'specific_destination';

  // Urgency
  const urgency = clamp01(0.2 + 0.3 * Math.min(datesChanged / 3, 1) + 0.5 * urgencyFromCopy);

  // Date flexibility hint — more date changes implies flexibility
  const dateFlexibilityHint = clamp01(0.3 + 0.1 * datesChanged);
  const destFlexibilityHint = clamp01(0.3 + 0.1 * airportsViewed);
  const hotelImportance = clamp01(hotelsClicked * 0.15);

  // Price flexibility: wide range viewed = high flex
  const pSpan =
    pricesViewed.length >= 2
      ? Math.max(...pricesViewed) - Math.min(...pricesViewed)
      : 0;
  const pAvg = pricesViewed.length ? pricesViewed.reduce((a, b) => a + b, 0) / pricesViewed.length : 1;
  const priceFlexibility = clamp01(pSpan / Math.max(50, pAvg));

  const confidence = clamp01(
    0.1 * pricesViewed.length + 0.05 * datesChanged + 0.05 * airportsViewed + 0.1 * hotelsClicked
  );

  return {
    sessionId,
    dominantGoal,
    urgency,
    priceFlexibility,
    dateFlexibilityHint,
    destFlexibilityHint,
    hotelImportance,
    confidence,
  };
}
