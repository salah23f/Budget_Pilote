/**
 * Mission + proposal persistence.
 *
 * Strategy: file-backed JSON store with an in-memory index. Survives
 * dev-server hot reloads and keeps local demos working without any
 * external DB. The file lives under `.data/missions.json` relative to
 * the project root. When you migrate to Supabase/Neon later, the
 * interface here stays identical — just swap the storage layer.
 *
 * NOT for heavy production traffic. Once you have >1 instance, move to
 * Postgres + a real DB row-level-security setup.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Mission, MissionProposal } from '../types';

interface StoreShape {
  missions: Record<string, Mission>;
  proposals: Record<string, MissionProposal>;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'missions.json');

// Singleton in-memory cache with filesystem persistence
const g = globalThis as unknown as { __flyeasMissionStore?: StoreShape };
if (!g.__flyeasMissionStore) {
  g.__flyeasMissionStore = { missions: {}, proposals: {} };
}
const store: StoreShape = g.__flyeasMissionStore;

let loaded = false;
let saveTimer: NodeJS.Timeout | null = null;

async function ensureLoaded() {
  if (loaded) return;
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as StoreShape;
    if (parsed && typeof parsed === 'object') {
      Object.assign(store.missions, parsed.missions || {});
      Object.assign(store.proposals, parsed.proposals || {});
    }
  } catch (err: any) {
    if (err?.code !== 'ENOENT') {
      console.warn('[missions-db] load failed:', err?.message);
    }
  }
  loaded = true;
}

async function persist() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(
      DATA_FILE,
      JSON.stringify(
        { missions: store.missions, proposals: store.proposals },
        null,
        2
      )
    );
  } catch (err: any) {
    console.warn('[missions-db] persist failed:', err?.message);
  }
}

function schedulePersist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persist();
  }, 200);
}

// ------------------------------------------------------------------
// Missions
// ------------------------------------------------------------------
export async function listMissions(userId?: string): Promise<Mission[]> {
  await ensureLoaded();
  const all = Object.values(store.missions);
  return userId ? all.filter((m) => m.userId === userId) : all;
}

export async function getMission(id: string): Promise<Mission | null> {
  await ensureLoaded();
  return store.missions[id] || null;
}

export async function createMission(mission: Mission): Promise<Mission> {
  await ensureLoaded();
  store.missions[mission.id] = mission;
  schedulePersist();
  return mission;
}

export async function updateMission(
  id: string,
  patch: Partial<Mission>
): Promise<Mission | null> {
  await ensureLoaded();
  const existing = store.missions[id];
  if (!existing) return null;
  const updated: Mission = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  store.missions[id] = updated;
  schedulePersist();
  return updated;
}

export async function deleteMission(id: string): Promise<boolean> {
  await ensureLoaded();
  if (!store.missions[id]) return false;
  delete store.missions[id];
  // cascade proposals
  for (const [pid, p] of Object.entries(store.proposals)) {
    if (p.missionId === id) delete store.proposals[pid];
  }
  schedulePersist();
  return true;
}

// ------------------------------------------------------------------
// Proposals
// ------------------------------------------------------------------
export async function listProposalsForMission(
  missionId: string
): Promise<MissionProposal[]> {
  await ensureLoaded();
  return Object.values(store.proposals)
    .filter((p) => p.missionId === missionId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getProposal(id: string): Promise<MissionProposal | null> {
  await ensureLoaded();
  return store.proposals[id] || null;
}

export async function createProposal(
  proposal: MissionProposal
): Promise<MissionProposal> {
  await ensureLoaded();
  store.proposals[proposal.id] = proposal;
  schedulePersist();
  return proposal;
}

export async function updateProposal(
  id: string,
  patch: Partial<MissionProposal>
): Promise<MissionProposal | null> {
  await ensureLoaded();
  const existing = store.proposals[id];
  if (!existing) return null;
  const updated: MissionProposal = { ...existing, ...patch };
  store.proposals[id] = updated;
  schedulePersist();
  return updated;
}

export async function findPendingProposal(
  missionId: string
): Promise<MissionProposal | null> {
  const list = await listProposalsForMission(missionId);
  return list.find((p) => p.status === 'pending') || null;
}
