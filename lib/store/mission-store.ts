import { create } from 'zustand';
import type { Mission, Offer, AgentDecision, PriceHistoryEntry } from '../types';

interface MissionState {
  missions: Mission[];
  activeMission: Mission | null;
  offers: Record<string, Offer[]>; // missionId -> offers
  decisions: Record<string, AgentDecision>; // missionId -> latest decision
  priceHistory: Record<string, PriceHistoryEntry[]>; // missionId -> history
  isLoading: boolean;

  setMissions: (missions: Mission[]) => void;
  addMission: (mission: Mission) => void;
  setActiveMission: (mission: Mission | null) => void;
  updateMission: (id: string, partial: Partial<Mission>) => void;
  setOffers: (missionId: string, offers: Offer[]) => void;
  setDecision: (missionId: string, decision: AgentDecision) => void;
  setPriceHistory: (missionId: string, history: PriceHistoryEntry[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useMissionStore = create<MissionState>()((set, get) => ({
  missions: [],
  activeMission: null,
  offers: {},
  decisions: {},
  priceHistory: {},
  isLoading: false,

  setMissions: (missions) => set({ missions }),

  addMission: (mission) => set({ missions: [...get().missions, mission] }),

  setActiveMission: (mission) => set({ activeMission: mission }),

  updateMission: (id, partial) =>
    set({
      missions: get().missions.map((m) =>
        m.id === id ? { ...m, ...partial } : m
      ),
      activeMission:
        get().activeMission?.id === id
          ? { ...get().activeMission!, ...partial }
          : get().activeMission,
    }),

  setOffers: (missionId, offers) =>
    set({
      offers: { ...get().offers, [missionId]: offers },
    }),

  setDecision: (missionId, decision) =>
    set({
      decisions: { ...get().decisions, [missionId]: decision },
    }),

  setPriceHistory: (missionId, history) =>
    set({
      priceHistory: { ...get().priceHistory, [missionId]: history },
    }),

  setLoading: (loading) => set({ isLoading: loading }),
}));
