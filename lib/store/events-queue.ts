'use client';

import type { BehaviorEvent } from '@/lib/algorithm/types';
import { useProfileStore } from './profile-store';

/**
 * Events queue — batched write-behind for behavior events.
 *
 * Flow:
 *   1. UI calls emitEvent({ kind, offerFeatures, ... })
 *   2. Event is (a) applied to the local profile immediately for fast personalization,
 *      and (b) pushed into a queue.
 *   3. The queue flushes every 5s (or on pagehide) via sendBeacon to /api/events.
 *
 * Why batched: saves network calls; sendBeacon ensures flush on navigation.
 */

const QUEUE_KEY = 'flyeas_events_queue';
const FLUSH_INTERVAL_MS = 5000;
const MAX_QUEUE = 50;

let flushTimer: number | null = null;

function loadQueue(): BehaviorEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as BehaviorEvent[]) : [];
  } catch (_) {
    return [];
  }
}

function saveQueue(q: BehaviorEvent[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE)));
  } catch (_) {}
}

function deviceId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = localStorage.getItem('flyeas_device_id');
    if (!id) {
      id = `d_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
      localStorage.setItem('flyeas_device_id', id);
    }
    return id;
  } catch (_) {
    return 'ephemeral';
  }
}

function scheduleFlush() {
  if (typeof window === 'undefined') return;
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    flush().catch(() => {});
  }, FLUSH_INTERVAL_MS);
}

export async function flush(): Promise<void> {
  if (typeof window === 'undefined') return;
  const q = loadQueue();
  if (q.length === 0) return;

  saveQueue([]); // clear optimistically

  const body = JSON.stringify({ events: q });

  // Try sendBeacon first (survives navigation)
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const ok = navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }));
    if (ok) return;
  }

  // Fallback: fetch keepalive
  try {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
  } catch (_) {
    // put them back if it fails
    const current = loadQueue();
    saveQueue([...q, ...current]);
  }
}

/**
 * Public API: record an event. Applies to local profile, queues for server.
 */
export function emitEvent(partial: Omit<BehaviorEvent, 'deviceId' | 'ts'> & { ts?: number }): void {
  if (typeof window === 'undefined') return;

  const event: BehaviorEvent = {
    deviceId: deviceId(),
    ts: partial.ts ?? Date.now(),
    ...partial,
  };

  // 1. Apply locally for instant personalization
  try {
    useProfileStore.getState().apply(event);
  } catch (_) {}

  // 2. Queue for server
  const q = loadQueue();
  q.push(event);
  saveQueue(q);
  scheduleFlush();
}

/* ── Auto-flush hooks ── */

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    void flush();
  });
  window.addEventListener('beforeunload', () => {
    void flush();
  });
}

/* ── Pre-baked emitters for common UI spots ── */

export const track = {
  impression(ctx: { watchId?: string; offerId?: string; cohortShown?: string }) {
    emitEvent({ kind: 'impression', watchId: ctx.watchId, contextFeatures: { cohortShown: ctx.cohortShown as any } });
  },
  click(ctx: { watchId?: string; offerFeatures?: BehaviorEvent['offerFeatures'] }) {
    emitEvent({ kind: 'click', watchId: ctx.watchId, offerFeatures: ctx.offerFeatures });
  },
  save(ctx: { watchId?: string; offerFeatures?: BehaviorEvent['offerFeatures'] }) {
    emitEvent({ kind: 'save', watchId: ctx.watchId, offerFeatures: ctx.offerFeatures });
  },
  dismiss(ctx: { watchId?: string; offerFeatures?: BehaviorEvent['offerFeatures'] }) {
    emitEvent({ kind: 'dismiss', watchId: ctx.watchId, offerFeatures: ctx.offerFeatures });
  },
  book(ctx: { watchId?: string; offerFeatures?: BehaviorEvent['offerFeatures']; wasBundle?: boolean }) {
    emitEvent({
      kind: 'book',
      watchId: ctx.watchId,
      offerFeatures: ctx.offerFeatures,
      contextFeatures: { ...(ctx.wasBundle != null ? { cohortShown: ctx.wasBundle ? 'SMARTEST' : 'CHEAPEST' } : {}) } as any,
    });
  },
  widen(ctx: { watchId?: string }) {
    emitEvent({ kind: 'widen_applied', watchId: ctx.watchId });
  },
  abandon(ctx: { watchId?: string }) {
    emitEvent({ kind: 'abandon', watchId: ctx.watchId });
  },
};
