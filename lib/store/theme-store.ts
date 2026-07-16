import { create } from 'zustand';

/**
 * Theme store — Design System v3 "Le Concierge".
 *
 * Light-first: the default experience is warm paper + cedar green.
 * Dark mode is applied via the `.dark` class on <html> (Tailwind
 * darkMode: 'class'); all tokens live in globals.css.
 *
 * NOTE: the old Revolut-style accent customizer (11 presets +
 * gradients) is retired — one strong brand identity, one accent.
 * The preset API is kept so legacy consumers don't crash, but
 * applying a preset no longer overrides brand CSS variables.
 */

export interface ThemePreset {
  id: string;
  name: string;
  accent: string;       // primary accent hex
  gradient: string;     // legacy field — now always the solid accent
  tier: 'free' | 'pro' | 'elite';
}

/** Single brand preset — cedar green (light) / sage (dark). */
export const THEME_PRESETS: ThemePreset[] = [
  { id: 'default', name: 'Flyeas', accent: '#175943', gradient: '#175943', tier: 'free' },
];

interface ThemeState {
  activeThemeId: string;
  customAccent: string | null;
  mode: 'dark' | 'light';

  setTheme: (id: string) => void;
  setCustomAccent: (hex: string) => void;
  toggleMode: () => void;
  setMode: (mode: 'dark' | 'light') => void;
  getActivePreset: () => ThemePreset;
  getGradient: () => string;
  getAccent: () => string;
}

const STORAGE_KEY = 'flyeas_theme';

function loadFromStorage(): { activeThemeId: string; customAccent: string | null; mode: 'dark' | 'light' } {
  if (typeof window === 'undefined') return { activeThemeId: 'default', customAccent: null, mode: 'light' };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { activeThemeId: 'default', customAccent: null, mode: 'light' };
    const parsed = JSON.parse(raw);
    return {
      activeThemeId: 'default',
      customAccent: null,
      mode: parsed.mode === 'dark' ? 'dark' : 'light',
    };
  } catch (_) { return { activeThemeId: 'default', customAccent: null, mode: 'light' }; }
}

function saveToStorage(state: { activeThemeId: string; customAccent: string | null; mode: 'dark' | 'light' }) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
}

const initial = loadFromStorage();

export const useThemeStore = create<ThemeState>()((set, get) => ({
  activeThemeId: initial.activeThemeId,
  customAccent: null,
  mode: initial.mode,

  // Retired customizer — kept as no-ops on brand variables.
  setTheme: (_id) => {
    set({ activeThemeId: 'default', customAccent: null });
    saveToStorage({ activeThemeId: 'default', customAccent: null, mode: get().mode });
  },

  setCustomAccent: (_hex) => {
    // Custom accents are retired — brand accent is fixed.
  },

  toggleMode: () => {
    const newMode = get().mode === 'dark' ? 'light' : 'dark';
    set({ mode: newMode });
    saveToStorage({ activeThemeId: 'default', customAccent: null, mode: newMode });
    applyModeToDOM(newMode);
  },

  setMode: (mode) => {
    set({ mode });
    saveToStorage({ activeThemeId: 'default', customAccent: null, mode });
    applyModeToDOM(mode);
  },

  getActivePreset: () => THEME_PRESETS[0],

  getGradient: () => THEME_PRESETS[0].gradient,

  getAccent: () => THEME_PRESETS[0].accent,
}));

/**
 * Apply light/dark mode to the DOM via the `.dark` class.
 * Token values are defined in globals.css — nothing inline here.
 */
function applyModeToDOM(mode: 'dark' | 'light') {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Smooth transition while the palette flips
  root.classList.add('theme-transitioning');

  if (mode === 'dark') {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }

  // Keep the browser chrome in sync
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', mode === 'dark' ? '#171512' : '#FAF7F2');

  setTimeout(() => root.classList.remove('theme-transitioning'), 800);
}

/**
 * Initialize theme on app load.
 * The inline script in app/layout.tsx already set the `.dark` class
 * pre-paint; this re-syncs the store and browser chrome after mount.
 */
export function initializeTheme() {
  if (typeof window === 'undefined') return;
  const { mode } = loadFromStorage();
  applyModeToDOM(mode);
}
