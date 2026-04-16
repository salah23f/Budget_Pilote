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
import sv from './sv';
import no from './no';
import da from './da';
import fi from './fi';
import uk from './uk';
import cs from './cs';
import hu from './hu';
import ro from './ro';
import el from './el';
import he from './he';
import fa from './fa';
import ms from './ms';
import sw from './sw';
import af from './af';

/** Locale type — re-exported from locale-store for convenience */
export type Locale = LocaleCode;

type LocaleEntry = {
  code: Locale;
  name: string;
  nativeName: string;
  region: 'Europe' | 'Asia' | 'Middle East' | 'Africa' | 'Americas';
  dir?: 'rtl';
};

export const SUPPORTED_LOCALES: LocaleEntry[] = [
  // Europe
  { code: 'en', name: 'English', nativeName: 'English', region: 'Europe' },
  { code: 'fr', name: 'French', nativeName: 'Fran\u00e7ais', region: 'Europe' },
  { code: 'es', name: 'Spanish', nativeName: 'Espa\u00f1ol', region: 'Europe' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', region: 'Europe' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', region: 'Europe' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Portugu\u00eas', region: 'Europe' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', region: 'Europe' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', region: 'Europe' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk', region: 'Europe' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', region: 'Europe' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi', region: 'Europe' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', region: 'Europe' },
  { code: 'cs', name: 'Czech', nativeName: '\u010ce\u0161tina', region: 'Europe' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', region: 'Europe' },
  { code: 'ro', name: 'Romanian', nativeName: 'Rom\u00e2n\u0103', region: 'Europe' },
  { code: 'el', name: 'Greek', nativeName: '\u0395\u03bb\u03bb\u03b7\u03bd\u03b9\u03ba\u03ac', region: 'Europe' },
  { code: 'ru', name: 'Russian', nativeName: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439', region: 'Europe' },
  { code: 'uk', name: 'Ukrainian', nativeName: '\u0423\u043a\u0440\u0430\u0457\u043d\u0441\u044c\u043a\u0430', region: 'Europe' },
  { code: 'tr', name: 'Turkish', nativeName: 'T\u00fcrk\u00e7e', region: 'Europe' },
  // Middle East
  { code: 'ar', name: 'Arabic', nativeName: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629', region: 'Middle East', dir: 'rtl' },
  { code: 'he', name: 'Hebrew', nativeName: '\u05e2\u05d1\u05e8\u05d9\u05ea', region: 'Middle East', dir: 'rtl' },
  { code: 'fa', name: 'Persian', nativeName: '\u0641\u0627\u0631\u0633\u06cc', region: 'Middle East', dir: 'rtl' },
  // Asia
  { code: 'zh', name: 'Chinese', nativeName: '\u4e2d\u6587', region: 'Asia' },
  { code: 'ja', name: 'Japanese', nativeName: '\u65e5\u672c\u8a9e', region: 'Asia' },
  { code: 'ko', name: 'Korean', nativeName: '\ud55c\uad6d\uc5b4', region: 'Asia' },
  { code: 'hi', name: 'Hindi', nativeName: '\u0939\u093f\u0928\u094d\u0926\u0940', region: 'Asia' },
  { code: 'th', name: 'Thai', nativeName: '\u0e44\u0e17\u0e22', region: 'Asia' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Ti\u1ebfng Vi\u1ec7t', region: 'Asia' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', region: 'Asia' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', region: 'Asia' },
  // Africa
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', region: 'Africa' },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans', region: 'Africa' },
];

const allTranslations: Record<Locale, Record<string, string>> = {
  en, fr, es, de, it, pt, ar, zh, ja, ko, ru, tr, nl, pl, th, vi, hi, id,
  sv, no, da, fi, uk, cs, hu, ro, el, he, fa, ms, sw, af,
};

/**
 * Get a translated string by dot-notation key.
 * Falls back to English, then returns the key itself if not found.
 */
export function t(key: string, locale: Locale = 'en'): string {
  const dict = allTranslations[locale];
  if (dict && dict[key]) return dict[key];
  if (en[key]) return en[key];
  return key;
}

/**
 * Check if a locale uses RTL direction.
 */
export function isRtl(locale: Locale): boolean {
  return locale === 'ar' || locale === 'he' || locale === 'fa';
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
