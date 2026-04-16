/**
 * Learning Loop — event → profile update.
 *
 * Stateless pure functions (no I/O). Callable from both client (immediate
 * profile update in the zustand store) and server (batched aggregation).
 *
 * Two ingestion modes:
 *   - streaming: apply each event immediately
 *   - batch:     aggregate events first, then apply once (server-side nightly)
 */

import type { BehaviorEvent, UserTravelProfile } from './types';
import { applyEvent, decayProfile } from './user-model';

/* ── Streaming (client) ─────────────────────────────── */

export function ingestEvent(profile: UserTravelProfile, event: BehaviorEvent): UserTravelProfile {
  return applyEvent(profile, event);
}

/* ── Batch (server) ─────────────────────────────────── */

export interface BatchIngestOptions {
  decayFirst?: boolean;
  maxEvents?: number;
}

export function ingestBatch(
  profile: UserTravelProfile,
  events: BehaviorEvent[],
  options: BatchIngestOptions = {}
): UserTravelProfile {
  const { decayFirst = false, maxEvents } = options;

  let next = decayFirst ? decayProfile(profile) : profile;

  // Sort chronologically — older first — so most recent events have the final say
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  const sliced = maxEvents ? sorted.slice(-maxEvents) : sorted;

  for (const ev of sliced) {
    next = applyEvent(next, ev);
  }

  return next;
}

/* ── Inference helpers ──────────────────────────────── */

/**
 * Quick derivation of session-level signals from a short window of events.
 * Used on the client to answer "is this person browsing or ready to book?".
 */
export function inferUrgency(recentEvents: BehaviorEvent[]): number {
  if (recentEvents.length === 0) return 0.2;

  let urgency = 0.2;
  const lastMinutes = 10 * 60 * 1000;
  const now = Date.now();
  const recent = recentEvents.filter((e) => now - e.ts < lastMinutes);

  if (recent.some((e) => e.kind === 'abandon' && e.contextFeatures)) urgency -= 0.15;
  if (recent.some((e) => e.kind === 'save')) urgency += 0.25;
  if (recent.some((e) => e.kind === 'widen_applied')) urgency += 0.15;
  const clickCount = recent.filter((e) => e.kind === 'click').length;
  if (clickCount >= 3) urgency += Math.min(0.3, clickCount * 0.06);

  return Math.max(0, Math.min(1, urgency));
}

/**
 * Running mean of a feature across recent events (last 30 events max).
 * Used by the server aggregator to keep a few per-user summary stats hot.
 */
export function runningMean(
  events: BehaviorEvent[],
  extract: (e: BehaviorEvent) => number | undefined
): { mean: number; n: number } {
  let sum = 0;
  let n = 0;
  for (const e of events.slice(-30)) {
    const v = extract(e);
    if (typeof v === 'number' && !isNaN(v)) {
      sum += v;
      n += 1;
    }
  }
  return n > 0 ? { mean: sum / n, n } : { mean: 0, n: 0 };
}
