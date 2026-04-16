import { create } from 'zustand';
import type { DraftFlowState, TravelIntent } from '@/lib/algorithm';

/**
 * Draft store — persists an in-progress watch creation locally so the user
 * can close the tab, come back a week later, and resume where they stopped.
 *
 * TTL: 30 days. A draft older than that is dropped silently.
 * Sync to server happens only after the user signs in AND touches the draft.
 */

const STORAGE_KEY = 'flyeas_watch_draft';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface DraftState {
  draft: DraftFlowState | null;
  loaded: boolean;
  save: (intent: Partial<TravelIntent>, step?: number) => void;
  clear: () => void;
  hydrate: () => void;
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

function load(): DraftFlowState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftFlowState;
    if (Date.now() - parsed.updatedAt > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch (_) {
    return null;
  }
}

function persist(draft: DraftFlowState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch (_) {}
}

export const useDraftStore = create<DraftState>()((set, get) => ({
  draft: null,
  loaded: false,

  hydrate: () => {
    if (get().loaded) return;
    const existing = load();
    set({ draft: existing, loaded: true });
  },

  save: (intent, step) => {
    const prev = get().draft;
    const next: DraftFlowState = {
      userId: prev?.userId,
      deviceId: prev?.deviceId ?? deviceId(),
      kind: 'watch_creation',
      intent: { ...(prev?.intent ?? {}), ...intent } as Partial<TravelIntent>,
      step: step ?? prev?.step ?? 0,
      updatedAt: Date.now(),
    };
    set({ draft: next });
    persist(next);
  },

  clear: () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (_) {}
    }
    set({ draft: null });
  },
}));

/* ── Helpers for UI ── */

export function draftIsResumable(draft: DraftFlowState | null): boolean {
  if (!draft) return false;
  // At least origin OR destination OR budget present
  const { intent } = draft;
  return !!(intent.origin || intent.destination || intent.budgetUsd || intent.dates);
}

export function summarizeDraft(draft: DraftFlowState): string {
  const parts: string[] = [];
  const o = draft.intent.origin;
  const d = draft.intent.destination;
  if (o?.kind === 'exact') parts.push(o.iata);
  else if (o?.kind === 'region') parts.push(o.label);
  if (d?.kind === 'exact') parts.push('→ ' + d.iata);
  else if (d?.kind === 'region') parts.push('→ ' + d.label);
  if (draft.intent.dates?.kind === 'month') parts.push(`· ${draft.intent.dates.month}`);
  else if (draft.intent.dates?.kind === 'season') parts.push(`· ${draft.intent.dates.season}`);
  else if (draft.intent.dates?.kind === 'exact') parts.push(`· ${draft.intent.dates.departDate}`);
  return parts.join(' ') || 'Unnamed draft';
}
