/**
 * Re-export from the new i18n module for backwards compatibility.
 * All new code should import from '@/lib/i18n/index' directly.
 */
export { t, useLocale, isRtl, SUPPORTED_LOCALES } from './i18n/index';
export type { Locale } from './i18n/index';
