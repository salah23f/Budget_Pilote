import { create } from 'zustand';
import type { Locale } from '@/lib/i18n';

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const STORAGE_KEY = 'flyeas_locale';

function loadLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'fr' || stored === 'es') return stored;
    return 'en';
  } catch {
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
      } catch {}
    }
  },
}));
