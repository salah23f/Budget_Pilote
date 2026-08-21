import { create } from 'zustand';

/** All supported locale codes. Keep in sync with lib/i18n/index.ts */
const VALID_LOCALES = new Set([
  'en', 'fr', 'es', 'de', 'it', 'pt', 'ar', 'zh', 'ja',
  'ko', 'ru', 'tr', 'nl', 'pl', 'th', 'vi', 'hi', 'id',
  'sv', 'no', 'da', 'fi', 'uk', 'cs', 'hu', 'ro', 'el',
  'he', 'fa', 'ms', 'sw', 'af',
]);

export type LocaleCode =
  | 'en' | 'fr' | 'es' | 'de' | 'it' | 'pt'
  | 'ar' | 'zh' | 'ja' | 'ko' | 'ru' | 'tr'
  | 'nl' | 'pl' | 'th' | 'vi' | 'hi' | 'id'
  | 'sv' | 'no' | 'da' | 'fi' | 'uk' | 'cs'
  | 'hu' | 'ro' | 'el' | 'he' | 'fa' | 'ms'
  | 'sw' | 'af';

interface LocaleState {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
}

const STORAGE_KEY = 'flyeas_locale';
const RTL_LOCALES = new Set(['ar', 'he', 'fa']);

function loadLocale(): LocaleCode {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_LOCALES.has(stored)) return stored as LocaleCode;
    const lang = navigator.language || 'en';
    const prefix = lang.split('-')[0];
    if (VALID_LOCALES.has(prefix)) return prefix as LocaleCode;
    return 'en';
  } catch (_) {
    return 'en';
  }
}

export const useLocaleStore = create<LocaleState>()((set) => ({
  // Deterministic 'en' for SSR AND the first client render — the real
  // locale is applied after mount via initializeLocale() (no hydration
  // mismatch between server and client HTML).
  locale: 'en',
  setLocale: (locale) => {
    set({ locale });
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, locale);
        document.documentElement.dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
        document.documentElement.lang = locale;
      } catch (_) {}
    }
  },
}));

/**
 * Hydrate the stored/browser locale after mount (client only).
 * Called from AppShell alongside initializeTheme().
 */
export function initializeLocale() {
  if (typeof window === 'undefined') return;
  const detected = loadLocale();
  const { locale, setLocale } = useLocaleStore.getState();
  if (detected !== locale) setLocale(detected);
}
