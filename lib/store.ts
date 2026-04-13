import { Decision, Mission, Offer } from './types';

type MemoryStore = {
  missions: Map<string, Mission>;
  offers: Map<string, Offer[]>;
  decisions: Map<string, Decision[]>;
};

const memory = globalThis as typeof globalThis & { __flyeasStore?: MemoryStore };

export const db: MemoryStore = memory.__flyeasStore ?? {
  missions: new Map<string, Mission>(),
  offers: new Map<string, Offer[]>(),
  decisions: new Map<string, Decision[]>(),
};

memory.__flyeasStore = db;
