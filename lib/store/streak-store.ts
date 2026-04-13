import { create } from 'zustand';

/**
 * Streak & engagement system — the Duolingo of travel.
 *
 * Users earn points for daily activity:
 *   - Open the app: +1 pt/day (streak builder)
 *   - Search flights: +5 pts
 *   - Create a mission: +25 pts
 *   - Book a flight: +100 pts
 *   - Refer a friend: +50 pts
 *
 * A streak is maintained by opening the app on consecutive days.
 * Breaking the streak resets to 0 (with a "streak freeze" save
 * available at 500 pts — like Duolingo).
 *
 * Milestones unlock badges that show on the user's profile and
 * in the sidebar. This is pure dopamine engineering.
 */

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  requirement: number; // points needed
  unlockedAt?: string;
}

const ALL_BADGES: Badge[] = [
  { id: 'explorer', name: 'Explorer', emoji: '🔍', description: 'First flight search', requirement: 5 },
  { id: 'scout', name: 'Scout', emoji: '🏕️', description: 'Reach 50 points', requirement: 50 },
  { id: 'navigator', name: 'Navigator', emoji: '🧭', description: 'Reach 200 points', requirement: 200 },
  { id: 'captain', name: 'Captain', emoji: '✈️', description: 'Reach 500 points', requirement: 500 },
  { id: 'ace', name: 'Ace Pilot', emoji: '🦅', description: 'Reach 1000 points', requirement: 1000 },
  { id: 'legend', name: 'Travel Legend', emoji: '👑', description: 'Reach 5000 points', requirement: 5000 },
];

export interface StreakState {
  // Points
  totalPoints: number;
  // Streak
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string; // "YYYY-MM-DD"
  streakFreezes: number;
  // Badges
  badges: Badge[];
  // Activity log
  weekActivity: boolean[]; // [Mon, Tue, Wed, Thu, Fri, Sat, Sun] for current week

  // Actions
  recordDailyOpen: () => void;
  addPoints: (amount: number, reason: string) => void;
  useStreakFreeze: () => boolean;
}

const STORAGE_KEY = 'flyeas_streak';

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function dayOfWeek(): number {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1; // Monday = 0
}

function loadFromStorage(): Partial<StreakState> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch { return {}; }
}

function saveToStorage(state: Partial<StreakState>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      totalPoints: state.totalPoints,
      currentStreak: state.currentStreak,
      longestStreak: state.longestStreak,
      lastActiveDate: state.lastActiveDate,
      streakFreezes: state.streakFreezes,
      badges: state.badges,
      weekActivity: state.weekActivity,
    }));
  } catch {}
}

function computeBadges(points: number, existing: Badge[]): Badge[] {
  const existingIds = new Set(existing.map((b) => b.id));
  const result = [...existing];
  for (const badge of ALL_BADGES) {
    if (points >= badge.requirement && !existingIds.has(badge.id)) {
      result.push({ ...badge, unlockedAt: new Date().toISOString() });
    }
  }
  return result;
}

const initial = loadFromStorage();

export const useStreakStore = create<StreakState>()((set, get) => ({
  totalPoints: initial.totalPoints || 0,
  currentStreak: initial.currentStreak || 0,
  longestStreak: initial.longestStreak || 0,
  lastActiveDate: (initial.lastActiveDate as string) || '',
  streakFreezes: initial.streakFreezes || 0,
  badges: (initial.badges as Badge[]) || [],
  weekActivity: (initial.weekActivity as boolean[]) || Array(7).fill(false),

  recordDailyOpen: () => {
    const state = get();
    const today = todayStr();
    const yesterday = yesterdayStr();

    // Already recorded today
    if (state.lastActiveDate === today) return;

    let newStreak = state.currentStreak;
    let newFreezes = state.streakFreezes;

    if (state.lastActiveDate === yesterday) {
      // Consecutive day — streak continues
      newStreak += 1;
    } else if (state.lastActiveDate && state.lastActiveDate < yesterday) {
      // Missed a day — streak breaks (unless freeze available)
      if (newFreezes > 0) {
        newFreezes -= 1;
        newStreak += 1; // freeze saved the streak
      } else {
        newStreak = 1; // reset
      }
    } else {
      // First ever open or same day
      newStreak = Math.max(1, newStreak);
    }

    const newPoints = state.totalPoints + 1; // +1 for daily open
    const newLongest = Math.max(state.longestStreak, newStreak);
    const newBadges = computeBadges(newPoints, state.badges);

    // Update week activity
    const week = [...state.weekActivity];
    // Reset week if it's Monday and last activity was last week
    const dow = dayOfWeek();
    if (dow === 0 && state.lastActiveDate !== yesterday && state.lastActiveDate !== today) {
      week.fill(false);
    }
    week[dow] = true;

    const updated = {
      totalPoints: newPoints,
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastActiveDate: today,
      streakFreezes: newFreezes,
      badges: newBadges,
      weekActivity: week,
    };
    set(updated);
    saveToStorage(updated);
  },

  addPoints: (amount, _reason) => {
    const state = get();
    const newPoints = state.totalPoints + amount;
    const newBadges = computeBadges(newPoints, state.badges);

    // Award a streak freeze at every 500 points
    let newFreezes = state.streakFreezes;
    if (Math.floor(newPoints / 500) > Math.floor(state.totalPoints / 500)) {
      newFreezes += 1;
    }

    const updated = {
      ...state,
      totalPoints: newPoints,
      badges: newBadges,
      streakFreezes: newFreezes,
    };
    set(updated);
    saveToStorage(updated);
  },

  useStreakFreeze: () => {
    const state = get();
    if (state.streakFreezes <= 0) return false;
    const updated = { ...state, streakFreezes: state.streakFreezes - 1 };
    set(updated);
    saveToStorage(updated);
    return true;
  },
}));

export { ALL_BADGES };
