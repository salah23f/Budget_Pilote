import { create } from 'zustand';

/** All supported locale codes. Keep in sync with lib/i18n/index.ts */
const VALID_LOCALES = new Set([
  'en', 'fr', 'es', 'de', 'it', 'pt', 'ar', 'zh', 'ja',
  'ko', 'ru', 'tr', 'nl', 'pl', 'th', 'vi', 'hi', 'id',
]);

export type LocaleCode =
  | 'en' | 'fr' | 'es' | 'de' | 'it' | 'pt'
  | 'ar' | 'zh' | 'ja' | 'ko' | 'ru' | 'tr'
  | 'nl' | 'pl' | 'th' | 'vi' | 'hi' | 'id';

interface LocaleState {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
}

const STORAGE_KEY = 'flyeas_locale';

function loadLocale(): LocaleCode {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_LOCALES.has(stored)) return stored as LocaleCode;
    // Auto-detect from browser
    const lang = navigator.language || 'en';
    const prefix = lang.split('-')[0];
    if (VALID_LOCALES.has(prefix)) return prefix as LocaleCode;
    return 'en';
  } catch (_) {
    return 'en';
  }
}

export const useLocaleStore = create<LocaleState>()((set) => ({
  locale: loadLocale(),
  setLocale: (locale) => {
    set({ locale });
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, locale);
        document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
      } catch (_) {}
    }
  },
}));
