/**
 * Multi-currency system — detect user's locale, fetch live exchange rates,
 * convert prices, and format with the correct symbol.
 *
 * Rates fetched from open.er-api.com (free, no key needed).
 * Cached in localStorage for 6 hours.
 */

export type CurrencyCode =
  | 'USD' | 'EUR' | 'GBP' | 'CHF' | 'CAD' | 'AUD' | 'JPY' | 'CNY'
  | 'KRW' | 'INR' | 'BRL' | 'MXN' | 'TRY' | 'RUB' | 'SAR' | 'AED'
  | 'THB' | 'VND' | 'IDR' | 'MYR' | 'SGD' | 'HKD' | 'TWD' | 'NOK'
  | 'SEK' | 'DKK' | 'PLN' | 'CZK' | 'HUF' | 'MAD' | 'TND' | 'EGP'
  | 'ZAR' | 'NZD';

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$', EUR: '\u20ac', GBP: '\u00a3', CHF: 'CHF', CAD: 'CA$', AUD: 'A$',
  JPY: '\u00a5', CNY: '\u00a5', KRW: '\u20a9', INR: '\u20b9', BRL: 'R$', MXN: 'MX$',
  TRY: '\u20ba', RUB: '\u20bd', SAR: 'SAR', AED: 'AED', THB: '\u0e3f', VND: '\u20ab',
  IDR: 'Rp', MYR: 'RM', SGD: 'S$', HKD: 'HK$', TWD: 'NT$',
  NOK: 'kr', SEK: 'kr', DKK: 'kr', PLN: 'z\u0142', CZK: 'K\u010d', HUF: 'Ft',
  MAD: 'MAD', TND: 'TND', EGP: 'E\u00a3', ZAR: 'R', NZD: 'NZ$',
};

export const CURRENCY_NAMES: Record<CurrencyCode, string> = {
  USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound', CHF: 'Swiss Franc',
  CAD: 'Canadian Dollar', AUD: 'Australian Dollar', JPY: 'Japanese Yen',
  CNY: 'Chinese Yuan', KRW: 'South Korean Won', INR: 'Indian Rupee',
  BRL: 'Brazilian Real', MXN: 'Mexican Peso', TRY: 'Turkish Lira',
  RUB: 'Russian Ruble', SAR: 'Saudi Riyal', AED: 'UAE Dirham',
  THB: 'Thai Baht', VND: 'Vietnamese Dong', IDR: 'Indonesian Rupiah',
  MYR: 'Malaysian Ringgit', SGD: 'Singapore Dollar', HKD: 'Hong Kong Dollar',
  TWD: 'Taiwan Dollar', NOK: 'Norwegian Krone', SEK: 'Swedish Krona',
  DKK: 'Danish Krone', PLN: 'Polish Zloty', CZK: 'Czech Koruna',
  HUF: 'Hungarian Forint', MAD: 'Moroccan Dirham', TND: 'Tunisian Dinar',
  EGP: 'Egyptian Pound', ZAR: 'South African Rand', NZD: 'New Zealand Dollar',
};

const ZERO_DECIMAL: Set<CurrencyCode> = new Set(['JPY', 'KRW', 'VND', 'IDR', 'HUF']);

const LOCALE_CURRENCY_MAP: Record<string, CurrencyCode> = {
  'en-US': 'USD', 'en-GB': 'GBP', 'en-AU': 'AUD', 'en-CA': 'CAD', 'en-NZ': 'NZD',
  'fr-FR': 'EUR', 'fr-CH': 'CHF', 'fr-CA': 'CAD', 'fr-MA': 'MAD', 'fr-TN': 'TND',
  'de-DE': 'EUR', 'de-CH': 'CHF', 'de-AT': 'EUR',
  'es-ES': 'EUR', 'es-MX': 'MXN', 'es-AR': 'USD',
  'it-IT': 'EUR', 'pt-BR': 'BRL', 'pt-PT': 'EUR',
  'ar-SA': 'SAR', 'ar-AE': 'AED', 'ar-MA': 'MAD', 'ar-TN': 'TND', 'ar-EG': 'EGP',
  'zh-CN': 'CNY', 'zh-TW': 'TWD', 'zh-HK': 'HKD',
  'ja-JP': 'JPY', 'ko-KR': 'KRW',
  'ru-RU': 'RUB', 'tr-TR': 'TRY',
  'nl-NL': 'EUR', 'pl-PL': 'PLN', 'cs-CZ': 'CZK', 'hu-HU': 'HUF',
  'th-TH': 'THB', 'vi-VN': 'VND', 'id-ID': 'IDR', 'ms-MY': 'MYR',
  'hi-IN': 'INR', 'sv-SE': 'SEK', 'da-DK': 'DKK', 'nb-NO': 'NOK',
  'ro-RO': 'EUR', 'bg-BG': 'EUR', 'hr-HR': 'EUR',
  'en-ZA': 'ZAR', 'en-SG': 'SGD', 'en-HK': 'HKD',
};

/** Detect user's likely currency from browser locale */
export function detectCurrency(): CurrencyCode {
  if (typeof navigator === 'undefined') return 'USD';
  const lang = navigator.language || 'en-US';
  if (LOCALE_CURRENCY_MAP[lang]) return LOCALE_CURRENCY_MAP[lang];
  const prefix = lang.split('-')[0];
  const match = Object.entries(LOCALE_CURRENCY_MAP).find(([k]) => k.startsWith(prefix + '-'));
  return match ? match[1] : 'USD';
}

const CACHE_KEY = 'flyeas_exchange_rates';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

/** Fetch exchange rates (cached 6h in localStorage) */
export async function getExchangeRates(): Promise<Record<string, number>> {
  if (typeof window === 'undefined') return {};
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.ts && Date.now() - parsed.ts < CACHE_TTL && parsed.rates) {
        return parsed.rates;
      }
    }
  } catch (_) {}

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();
    if (data.result === 'success' && data.rates) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ rates: data.rates, ts: Date.now() }));
      } catch (_) {}
      return data.rates;
    }
  } catch (_) {}
  return {};
}

/** Convert USD price to target currency */
export function convertPrice(usd: number, to: CurrencyCode, rates: Record<string, number>): number {
  if (to === 'USD' || !rates[to]) return usd;
  return usd * rates[to];
}

/** Format price with correct symbol and decimals */
export function formatPrice(amount: number, currency: CurrencyCode): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  const isZeroDecimal = ZERO_DECIMAL.has(currency);
  const formatted = isZeroDecimal
    ? Math.round(amount).toLocaleString()
    : amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${symbol}${formatted}`;
}
