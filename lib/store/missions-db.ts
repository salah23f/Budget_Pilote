/**
 * Mission + proposal persistence.
 *
 * Deux backends sélectionnés au chargement du module :
 *
 *   - SupabaseBackend : actif si NEXT_PUBLIC_SUPABASE_URL et
 *                       SUPABASE_SERVICE_ROLE_KEY sont set. Utilise les
 *                       tables `missions` et `mission_proposals`
 *                       (migration 20260424000001_missions_tables.sql).
 *                       Obligatoire en prod Vercel — le filesystem y est
 *                       éphémère et ne survit pas aux redeploys.
 *
 *   - JsonBackend     : fallback dev local. Fichier `.data/missions.json`
 *                       + cache in-memory sur `globalThis`. Sert uniquement
 *                       quand on développe sans accès Supabase.
 *
 * L'interface publique (listMissions, createMission, ...) est identique
 * dans les deux cas. Aucun code consommateur n'a à savoir quel backend
 * est actif.
 *
 * Schéma Supabase (voir supabase/migrations/20260424000001_missions_tables.sql) :
 *   missions(id, user_id, status, monitoring_enabled, data jsonb,
 *            created_at, updated_at)
 *   mission_proposals(id, mission_id FK, status, data jsonb, created_at)
 *
 * Stratégie : le `data` jsonb contient l'objet Mission/MissionProposal
 * complet. Les colonnes dédiées (user_id, status, monitoring_enabled)
 * sont des index matérialisés pour les requêtes chaudes du watcher.
 * Ajouter un nouveau champ Mission → pas de migration de schéma.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Mission, MissionProposal, MissionStatus, MissionProposalStatus } from '../types';

// ======================================================================
// Backend interface
// ======================================================================

interface Backend {
  readonly kind: 'supabase' | 'json';
  listMissions(userId?: string): Promise<Mission[]>;
  getMission(id: string): Promise<Mission | null>;
  createMission(mission: Mission): Promise<Mission>;
  updateMission(id: string, patch: Partial<Mission>): Promise<Mission | null>;
  deleteMission(id: string): Promise<boolean>;
  listProposalsForMission(missionId: string): Promise<MissionProposal[]>;
  getProposal(id: string): Promise<MissionProposal | null>;
  createProposal(proposal: MissionProposal): Promise<MissionProposal>;
  updateProposal(
    id: string,
    patch: Partial<MissionProposal>
  ): Promise<MissionProposal | null>;
}

// ======================================================================
// Supabase backend
// ======================================================================

interface MissionRow {
  id: string;
  user_id: string;
  status: MissionStatus;
  monitoring_enabled: boolean;
  data: Mission;
  created_at: string;
  updated_at: string;
}

interface ProposalRow {
  id: string;
  mission_id: string;
  status: MissionProposalStatus;
  data: MissionProposal;
  created_at: string;
}

function missionToRow(m: Mission): MissionRow {
  return {
    id: m.id,
    user_id: m.userId,
    status: m.status,
    monitoring_enabled: m.monitoringEnabled,
    data: m,
    created_at: m.createdAt,
    updated_at: m.updatedAt,
  };
}

function proposalToRow(p: MissionProposal): ProposalRow {
  return {
    id: p.id,
    mission_id: p.missionId,
    status: p.status,
    data: p,
    created_at: p.createdAt,
  };
}

class SupabaseBackend implements Backend {
  readonly kind = 'supabase' as const;
  private sb: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.sb = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async listMissions(userId?: string): Promise<Mission[]> {
    let q = this.sb
      .from('missions')
      .select('data')
      .order('updated_at', { ascending: false });
    if (userId) q = q.eq('user_id', userId);
    const { data, error } = await q;
    if (error) {
      console.error('[missions-db] listMissions error', error.message);
      return [];
    }
    return ((data ?? []) as Array<{ data: Mission }>).map((r) => r.data);
  }

  async getMission(id: string): Promise<Mission | null> {
    const { data, error } = await this.sb
      .from('missions')
      .select('data')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.error('[missions-db] getMission error', error.message);
      return null;
    }
    return (data as { data: Mission } | null)?.data ?? null;
  }

  async createMission(mission: Mission): Promise<Mission> {
    const row = missionToRow(mission);
    const { error } = await this.sb.from('missions').insert(row);
    if (error) {
      console.error('[missions-db] createMission error', error.message);
      throw new Error(`createMission failed: ${error.message}`);
    }
    return mission;
  }

  async updateMission(
    id: string,
    patch: Partial<Mission>
  ): Promise<Mission | null> {
    // Read-modify-write : on merge dans `data`, puis on écrit la version
    // complète pour garder la jsonb synchronisée avec les colonnes dénormalisées.
    const existing = await this.getMission(id);
    if (!existing) return null;
    const updated: Mission = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    const row = missionToRow(updated);
    const { error } = await this.sb
      .from('missions')
      .update({
        status: row.status,
        monitoring_enabled: row.monitoring_enabled,
        data: row.data,
        updated_at: row.updated_at,
      })
      .eq('id', id);
    if (error) {
      console.error('[missions-db] updateMission error', error.message);
      return null;
    }
    return updated;
  }

  async deleteMission(id: string): Promise<boolean> {
    // ON DELETE CASCADE côté DB s'occupe des proposals
    const { error, count } = await this.sb
      .from('missions')
      .delete({ count: 'exact' })
      .eq('id', id);
    if (error) {
      console.error('[missions-db] deleteMission error', error.message);
      return false;
    }
    return (count ?? 0) > 0;
  }

  async listProposalsForMission(
    missionId: string
  ): Promise<MissionProposal[]> {
    const { data, error } = await this.sb
      .from('mission_proposals')
      .select('data')
      .eq('mission_id', missionId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[missions-db] listProposals error', error.message);
      return [];
    }
    return ((data ?? []) as Array<{ data: MissionProposal }>).map((r) => r.data);
  }

  async getProposal(id: string): Promise<MissionProposal | null> {
    const { data, error } = await this.sb
      .from('mission_proposals')
      .select('data')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.error('[missions-db] getProposal error', error.message);
      return null;
    }
    return (data as { data: MissionProposal } | null)?.data ?? null;
  }

  async createProposal(proposal: MissionProposal): Promise<MissionProposal> {
    const row = proposalToRow(proposal);
    const { error } = await this.sb.from('mission_proposals').insert(row);
    if (error) {
      console.error('[missions-db] createProposal error', error.message);
      throw new Error(`createProposal failed: ${error.message}`);
    }
    return proposal;
  }

  async updateProposal(
    id: string,
    patch: Partial<MissionProposal>
  ): Promise<MissionProposal | null> {
    const existing = await this.getProposal(id);
    if (!existing) return null;
    const updated: MissionProposal = { ...existing, ...patch };
    const row = proposalToRow(updated);
    const { error } = await this.sb
      .from('mission_proposals')
      .update({ status: row.status, data: row.data })
      .eq('id', id);
    if (error) {
      console.error('[missions-db] updateProposal error', error.message);
      return null;
    }
    return updated;
  }
}

// ======================================================================
// JSON backend (fallback dev local)
// ======================================================================

interface StoreShape {
  missions: Record<string, Mission>;
  proposals: Record<string, MissionProposal>;
}

class JsonBackend implements Backend {
  readonly kind = 'json' as const;
  private readonly dir: string;
  private readonly file: string;
  private readonly store: StoreShape;
  private loaded = false;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.dir = path.resolve(process.cwd(), '.data');
    this.file = path.join(this.dir, 'missions.json');
    // Singleton sur globalThis pour survivre au hot-reload dev
    const g = globalThis as unknown as { __flyeasMissionStore?: StoreShape };
    if (!g.__flyeasMissionStore) {
      g.__flyeasMissionStore = { missions: {}, proposals: {} };
    }
    this.store = g.__flyeasMissionStore;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw) as StoreShape;
      if (parsed && typeof parsed === 'object') {
        Object.assign(this.store.missions, parsed.missions || {});
        Object.assign(this.store.proposals, parsed.proposals || {});
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code !== 'ENOENT') {
        console.warn(
          '[missions-db/json] load failed:',
          (err as Error)?.message
        );
      }
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    try {
      await fs.mkdir(this.dir, { recursive: true });
      await fs.writeFile(
        this.file,
        JSON.stringify(
          { missions: this.store.missions, proposals: this.store.proposals },
          null,
          2
        )
      );
    } catch (err: unknown) {
      console.warn(
        '[missions-db/json] persist failed:',
        (err as Error)?.message
      );
    }
  }

  private schedulePersist(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.persist();
    }, 200);
  }

  async listMissions(userId?: string): Promise<Mission[]> {
    await this.ensureLoaded();
    const all = Object.values(this.store.missions);
    return userId ? all.filter((m) => m.userId === userId) : all;
  }

  async getMission(id: string): Promise<Mission | null> {
    await this.ensureLoaded();
    return this.store.missions[id] || null;
  }

  async createMission(mission: Mission): Promise<Mission> {
    await this.ensureLoaded();
    this.store.missions[mission.id] = mission;
    this.schedulePersist();
    return mission;
  }

  async updateMission(
    id: string,
    patch: Partial<Mission>
  ): Promise<Mission | null> {
    await this.ensureLoaded();
    const existing = this.store.missions[id];
    if (!existing) return null;
    const updated: Mission = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.store.missions[id] = updated;
    this.schedulePersist();
    return updated;
  }

  async deleteMission(id: string): Promise<boolean> {
    await this.ensureLoaded();
    if (!this.store.missions[id]) return false;
    delete this.store.missions[id];
    // cascade proposals
    for (const [pid, p] of Object.entries(this.store.proposals)) {
      if (p.missionId === id) delete this.store.proposals[pid];
    }
    this.schedulePersist();
    return true;
  }

  async listProposalsForMission(
    missionId: string
  ): Promise<MissionProposal[]> {
    await this.ensureLoaded();
    return Object.values(this.store.proposals)
      .filter((p) => p.missionId === missionId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getProposal(id: string): Promise<MissionProposal | null> {
    await this.ensureLoaded();
    return this.store.proposals[id] || null;
  }

  async createProposal(
    proposal: MissionProposal
  ): Promise<MissionProposal> {
    await this.ensureLoaded();
    this.store.proposals[proposal.id] = proposal;
    this.schedulePersist();
    return proposal;
  }

  async updateProposal(
    id: string,
    patch: Partial<MissionProposal>
  ): Promise<MissionProposal | null> {
    await this.ensureLoaded();
    const existing = this.store.proposals[id];
    if (!existing) return null;
    const updated: MissionProposal = { ...existing, ...patch };
    this.store.proposals[id] = updated;
    this.schedulePersist();
    return updated;
  }
}

// ======================================================================
// Backend selection — une seule fois au chargement module
// ======================================================================

function pickBackend(): Backend {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    console.log('[missions-db] backend=supabase');
    return new SupabaseBackend(url, key);
  }
  console.warn(
    '[missions-db] backend=json (fallback dev) — data will NOT survive Vercel deploys'
  );
  return new JsonBackend();
}

const backend: Backend = pickBackend();

// ======================================================================
// Public API — signatures identiques à la version précédente
// ======================================================================

export function getBackendKind(): 'supabase' | 'json' {
  return backend.kind;
}

export async function listMissions(userId?: string): Promise<Mission[]> {
  return backend.listMissions(userId);
}

export async function getMission(id: string): Promise<Mission | null> {
  return backend.getMission(id);
}

export async function createMission(mission: Mission): Promise<Mission> {
  return backend.createMission(mission);
}

export async function updateMission(
  id: string,
  patch: Partial<Mission>
): Promise<Mission | null> {
  return backend.updateMission(id, patch);
}

export async function deleteMission(id: string): Promise<boolean> {
  return backend.deleteMission(id);
}

export async function listProposalsForMission(
  missionId: string
): Promise<MissionProposal[]> {
  return backend.listProposalsForMission(missionId);
}

export async function getProposal(
  id: string
): Promise<MissionProposal | null> {
  return backend.getProposal(id);
}

export async function createProposal(
  proposal: MissionProposal
): Promise<MissionProposal> {
  return backend.createProposal(proposal);
}

export async function updateProposal(
  id: string,
  patch: Partial<MissionProposal>
): Promise<MissionProposal | null> {
  return backend.updateProposal(id, patch);
}

export async function findPendingProposal(
  missionId: string
): Promise<MissionProposal | null> {
  const list = await listProposalsForMission(missionId);
  return list.find((p) => p.status === 'pending') || null;
}
