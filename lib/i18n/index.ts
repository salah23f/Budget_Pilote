'use client';

import { useLocaleStore, type LocaleCode } from '@/lib/store/locale-store';

import en from './en';
import fr from './fr';
import es from './es';
import de from './de';
import it from './it';
import pt from './pt';
import ar from './ar';
import zh from './zh';
import ja from './ja';
import ko from './ko';
import ru from './ru';
import tr from './tr';
import nl from './nl';
import pl from './pl';
import th from './th';
import vi from './vi';
import hi from './hi';
import id from './id';

/** Locale type — re-exported from locale-store for convenience */
export type Locale = LocaleCode;

export const SUPPORTED_LOCALES: { code: Locale; name: string; nativeName: string; dir?: 'rtl' }[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'fr', name: 'French', nativeName: 'Fran\u00e7ais' },
  { code: 'es', name: 'Spanish', nativeName: 'Espa\u00f1ol' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Portugu\u00eas' },
  { code: 'ar', name: 'Arabic', nativeName: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629', dir: 'rtl' },
  { code: 'zh', name: 'Chinese', nativeName: '\u4e2d\u6587' },
  { code: 'ja', name: 'Japanese', nativeName: '\u65e5\u672c\u8a9e' },
  { code: 'ko', name: 'Korean', nativeName: '\ud55c\uad6d\uc5b4' },
  { code: 'ru', name: 'Russian', nativeName: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439' },
  { code: 'tr', name: 'Turkish', nativeName: 'T\u00fcrk\u00e7e' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'th', name: 'Thai', nativeName: '\u0e44\u0e17\u0e22' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Ti\u1ebfng Vi\u1ec7t' },
  { code: 'hi', name: 'Hindi', nativeName: '\u0939\u093f\u0928\u094d\u0926\u0940' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
];

const allTranslations: Record<Locale, Record<string, string>> = {
  en, fr, es, de, it, pt, ar, zh, ja, ko, ru, tr, nl, pl, th, vi, hi, id,
};

/**
 * Get a translated string by dot-notation key.
 * Falls back to English, then returns the key itself if not found.
 */
export function t(key: string, locale: Locale = 'en'): string {
  const dict = allTranslations[locale];
  if (dict && dict[key]) return dict[key];
  // Fallback to English
  if (en[key]) return en[key];
  return key;
}

/**
 * Check if a locale uses RTL direction.
 */
export function isRtl(locale: Locale): boolean {
  return locale === 'ar';
}

/**
 * React hook that provides the current locale and a bound translation function.
 */
export function useLocale() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  return {
    locale,
    setLocale,
    t: (key: string) => t(key, locale),
    isRtl: isRtl(locale),
  };
}
