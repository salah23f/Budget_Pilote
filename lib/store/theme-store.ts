import { create } from 'zustand';

/**
 * Theme customizer store — Revolut-style UI personalization.
 *
 * Users can change the accent color of the app. The default is
 * amber/orange (Flyeas brand). Pro/Elite users get access to more
 * themes + custom color picker.
 *
 * The theme is applied by setting a CSS variable on <html> that
 * overrides the default gradient/accent colors across the entire app.
 */

export interface ThemePreset {
  id: string;
  name: string;
  accent: string;       // primary accent hex
  gradient: string;     // CSS gradient string
  tier: 'free' | 'pro' | 'elite';
}

export const THEME_PRESETS: ThemePreset[] = [
  // Free presets
  { id: 'default', name: 'Flyeas Gold', accent: '#E8A317', gradient: 'linear-gradient(135deg, #E8A317, #F97316, #EF4444)', tier: 'free' },
  { id: 'ocean', name: 'Ocean Blue', accent: '#3B82F6', gradient: 'linear-gradient(135deg, #3B82F6, #2563EB, #1D4ED8)', tier: 'free' },
  { id: 'emerald', name: 'Emerald', accent: '#10B981', gradient: 'linear-gradient(135deg, #10B981, #059669, #047857)', tier: 'free' },
  // Pro presets
  { id: 'purple', name: 'Royal Purple', accent: '#8B5CF6', gradient: 'linear-gradient(135deg, #8B5CF6, #7C3AED, #6D28D9)', tier: 'pro' },
  { id: 'rose', name: 'Rose', accent: '#F43F5E', gradient: 'linear-gradient(135deg, #F43F5E, #E11D48, #BE123C)', tier: 'pro' },
  { id: 'cyan', name: 'Cyan Ice', accent: '#06B6D4', gradient: 'linear-gradient(135deg, #06B6D4, #0891B2, #0E7490)', tier: 'pro' },
  { id: 'sunset', name: 'Sunset', accent: '#F97316', gradient: 'linear-gradient(135deg, #F97316, #EF4444, #DC2626)', tier: 'pro' },
  // Elite presets
  { id: 'gold', name: 'Black & Gold', accent: '#D4A017', gradient: 'linear-gradient(135deg, #D4A017, #B8860B, #996515)', tier: 'elite' },
  { id: 'neon', name: 'Neon', accent: '#22D3EE', gradient: 'linear-gradient(135deg, #22D3EE, #A855F7, #EC4899)', tier: 'elite' },
  { id: 'midnight', name: 'Midnight', accent: '#6366F1', gradient: 'linear-gradient(135deg, #6366F1, #4F46E5, #4338CA)', tier: 'elite' },
  { id: 'aurora', name: 'Aurora', accent: '#34D399', gradient: 'linear-gradient(135deg, #34D399, #22D3EE, #A78BFA)', tier: 'elite' },
];

interface ThemeState {
  activeThemeId: string;
  customAccent: string | null; // Elite only: custom hex color
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
  if (typeof window === 'undefined') return { activeThemeId: 'default', customAccent: null, mode: 'dark' };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { activeThemeId: 'default', customAccent: null, mode: 'dark' };
    const parsed = JSON.parse(raw);
    return { activeThemeId: parsed.activeThemeId || 'default', customAccent: parsed.customAccent || null, mode: parsed.mode || 'dark' };
  } catch (_) { return { activeThemeId: 'default', customAccent: null, mode: 'dark' }; }
}

function saveToStorage(state: { activeThemeId: string; customAccent: string | null; mode: 'dark' | 'light' }) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
}

const initial = loadFromStorage();

export const useThemeStore = create<ThemeState>()((set, get) => ({
  activeThemeId: initial.activeThemeId || 'default',
  customAccent: initial.customAccent || null,
  mode: initial.mode || 'dark',

  setTheme: (id) => {
    const mode = get().mode;
    set({ activeThemeId: id, customAccent: null });
    saveToStorage({ activeThemeId: id, customAccent: null, mode });
    applyThemeToDOM(id, null);
    applyModeToDOM(mode);
  },

  setCustomAccent: (hex) => {
    const mode = get().mode;
    set({ customAccent: hex });
    saveToStorage({ activeThemeId: get().activeThemeId, customAccent: hex, mode });
    applyThemeToDOM(get().activeThemeId, hex);
  },

  toggleMode: () => {
    const newMode = get().mode === 'dark' ? 'light' : 'dark';
    set({ mode: newMode });
    saveToStorage({ activeThemeId: get().activeThemeId, customAccent: get().customAccent, mode: newMode });
    applyModeToDOM(newMode);
  },

  setMode: (mode) => {
    set({ mode });
    saveToStorage({ activeThemeId: get().activeThemeId, customAccent: get().customAccent, mode });
    applyModeToDOM(mode);
  },

  getActivePreset: () => {
    return THEME_PRESETS.find((p) => p.id === get().activeThemeId) || THEME_PRESETS[0];
  },

  getGradient: () => {
    const custom = get().customAccent;
    if (custom) return `linear-gradient(135deg, ${custom}, ${adjustColor(custom, -30)}, ${adjustColor(custom, -60)})`;
    return get().getActivePreset().gradient;
  },

  getAccent: () => {
    return get().customAccent || get().getActivePreset().accent;
  },
}));

/**
 * Apply theme to the DOM by setting CSS variables on <html>.
 */
function applyThemeToDOM(themeId: string, customAccent: string | null) {
  if (typeof document === 'undefined') return;
  const preset = THEME_PRESETS.find((p) => p.id === themeId) || THEME_PRESETS[0];
  const accent = customAccent || preset.accent;
  const gradient = customAccent
    ? `linear-gradient(135deg, ${accent}, ${adjustColor(accent, -30)}, ${adjustColor(accent, -60)})`
    : preset.gradient;
  const root = document.documentElement;

  // Enable smooth transition for theme change
  root.classList.add('theme-transitioning');

  // Core CSS variables
  root.style.setProperty('--flyeas-accent', accent);
  root.style.setProperty('--flyeas-gradient', gradient);
  root.style.setProperty('--flyeas-avatar-gradient', gradient);

  // Update meta theme-color for mobile browsers
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', adjustColor(accent, -70));

  // Remove transition class after animation completes
  setTimeout(() => root.classList.remove('theme-transitioning'), 800);
}

/**
 * Darken/lighten a hex color by a percentage.
 */
function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + Math.round(2.55 * percent)));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + Math.round(2.55 * percent)));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + Math.round(2.55 * percent)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * Apply light/dark mode to the DOM.
 */
function applyModeToDOM(mode: 'dark' | 'light') {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const body = document.body;

  if (mode === 'light') {
    root.classList.add('light-mode');
    root.style.colorScheme = 'light';
    body.style.background = '#f5f5f4';
    body.style.color = '#1c1917';
  } else {
    root.classList.remove('light-mode');
    root.style.colorScheme = 'dark';
    body.style.background = '';
    body.style.color = '';
  }
}

/**
 * Initialize theme on app load.
 */
export function initializeTheme() {
  if (typeof window === 'undefined') return;
  const { activeThemeId, customAccent, mode } = loadFromStorage();
  applyThemeToDOM(activeThemeId, customAccent);
  applyModeToDOM(mode);
}
