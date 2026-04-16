/**
 * Multi-currency system — 80+ currencies organized by region.
 * Live exchange rates from open.er-api.com (free, no key needed).
 * Cached in localStorage for 6 hours.
 */

export type CurrencyCode =
  // Majors
  | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CHF' | 'CAD' | 'AUD' | 'NZD'
  // Europe
  | 'SEK' | 'NOK' | 'DKK' | 'PLN' | 'CZK' | 'HUF' | 'RON' | 'BGN'
  | 'HRK' | 'RSD' | 'UAH' | 'ISK' | 'ALL' | 'MKD' | 'BAM' | 'MDL'
  // Asia
  | 'CNY' | 'HKD' | 'TWD' | 'KRW' | 'SGD' | 'INR' | 'IDR' | 'MYR'
  | 'THB' | 'VND' | 'PHP' | 'PKR' | 'BDT' | 'LKR' | 'NPR' | 'KZT'
  | 'UZS' | 'AFN' | 'MMK' | 'KHR' | 'LAK'
  // Middle East
  | 'AED' | 'SAR' | 'QAR' | 'KWD' | 'BHD' | 'OMR' | 'JOD' | 'LBP'
  | 'ILS' | 'IQD' | 'TRY' | 'IRR' | 'YER' | 'SYP'
  // Africa
  | 'ZAR' | 'EGP' | 'MAD' | 'TND' | 'DZD' | 'NGN' | 'KES' | 'UGX'
  | 'GHS' | 'ETB' | 'XOF' | 'XAF' | 'RWF' | 'TZS' | 'MUR' | 'BWP'
  | 'NAD' | 'ZMW'
  // Americas
  | 'MXN' | 'BRL' | 'ARS' | 'CLP' | 'COP' | 'PEN' | 'UYU' | 'VES'
  | 'BOB' | 'PYG' | 'GTQ' | 'DOP' | 'CRC' | 'PAB' | 'JMD' | 'TTD' | 'BSD'
  // Other
  | 'RUB' | 'BYN' | 'AMD' | 'GEL' | 'AZN' | 'MNT' | 'FJD' | 'PGK'
  | 'XCD' | 'BMD' | 'KYD' | 'ANG';

export type CurrencyRegion = 'Majors' | 'Europe' | 'Asia' | 'Middle East' | 'Africa' | 'Americas' | 'Oceania' | 'Other';

export interface CurrencyMeta {
  code: CurrencyCode;
  symbol: string;
  name: string;
  nativeName?: string;
  region: CurrencyRegion;
  zeroDecimal?: boolean;
  symbolAfter?: boolean;
}

export const CURRENCIES: CurrencyMeta[] = [
  // Majors
  { code: 'USD', symbol: '$', name: 'US Dollar', region: 'Majors' },
  { code: 'EUR', symbol: '\u20ac', name: 'Euro', region: 'Majors' },
  { code: 'GBP', symbol: '\u00a3', name: 'British Pound', region: 'Majors' },
  { code: 'JPY', symbol: '\u00a5', name: 'Japanese Yen', region: 'Majors', zeroDecimal: true },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', region: 'Majors' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', region: 'Majors' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', region: 'Majors' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', region: 'Majors' },

  // Europe
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', region: 'Europe', symbolAfter: true },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', region: 'Europe', symbolAfter: true },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone', region: 'Europe', symbolAfter: true },
  { code: 'PLN', symbol: 'z\u0142', name: 'Polish Zloty', region: 'Europe', symbolAfter: true },
  { code: 'CZK', symbol: 'K\u010d', name: 'Czech Koruna', region: 'Europe', symbolAfter: true },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint', region: 'Europe', zeroDecimal: true, symbolAfter: true },
  { code: 'RON', symbol: 'lei', name: 'Romanian Leu', region: 'Europe', symbolAfter: true },
  { code: 'BGN', symbol: 'лв', name: 'Bulgarian Lev', region: 'Europe', symbolAfter: true },
  { code: 'HRK', symbol: 'kn', name: 'Croatian Kuna', region: 'Europe', symbolAfter: true },
  { code: 'RSD', symbol: 'дин.', name: 'Serbian Dinar', region: 'Europe', symbolAfter: true },
  { code: 'UAH', symbol: '\u20b4', name: 'Ukrainian Hryvnia', region: 'Europe' },
  { code: 'ISK', symbol: 'kr', name: 'Icelandic Krona', region: 'Europe', zeroDecimal: true, symbolAfter: true },
  { code: 'ALL', symbol: 'L', name: 'Albanian Lek', region: 'Europe', zeroDecimal: true, symbolAfter: true },
  { code: 'MKD', symbol: 'ден', name: 'Macedonian Denar', region: 'Europe', symbolAfter: true },
  { code: 'BAM', symbol: 'KM', name: 'Bosnia-Herzegovina Mark', region: 'Europe', symbolAfter: true },
  { code: 'MDL', symbol: 'L', name: 'Moldovan Leu', region: 'Europe', symbolAfter: true },
  { code: 'RUB', symbol: '\u20bd', name: 'Russian Ruble', region: 'Europe' },
  { code: 'BYN', symbol: 'Br', name: 'Belarusian Ruble', region: 'Europe', symbolAfter: true },

  // Asia
  { code: 'CNY', symbol: '\u00a5', name: 'Chinese Yuan', region: 'Asia' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', region: 'Asia' },
  { code: 'TWD', symbol: 'NT$', name: 'Taiwan Dollar', region: 'Asia' },
  { code: 'KRW', symbol: '\u20a9', name: 'South Korean Won', region: 'Asia', zeroDecimal: true },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', region: 'Asia' },
  { code: 'INR', symbol: '\u20b9', name: 'Indian Rupee', region: 'Asia' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', region: 'Asia', zeroDecimal: true },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', region: 'Asia' },
  { code: 'THB', symbol: '\u0e3f', name: 'Thai Baht', region: 'Asia' },
  { code: 'VND', symbol: '\u20ab', name: 'Vietnamese Dong', region: 'Asia', zeroDecimal: true, symbolAfter: true },
  { code: 'PHP', symbol: '\u20b1', name: 'Philippine Peso', region: 'Asia' },
  { code: 'PKR', symbol: '\u20a8', name: 'Pakistani Rupee', region: 'Asia' },
  { code: 'BDT', symbol: '\u09f3', name: 'Bangladeshi Taka', region: 'Asia' },
  { code: 'LKR', symbol: '\u20a8', name: 'Sri Lankan Rupee', region: 'Asia' },
  { code: 'NPR', symbol: '\u20a8', name: 'Nepalese Rupee', region: 'Asia' },
  { code: 'KZT', symbol: '\u20b8', name: 'Kazakhstani Tenge', region: 'Asia' },
  { code: 'UZS', symbol: 'сум', name: 'Uzbekistani Som', region: 'Asia', symbolAfter: true },
  { code: 'AFN', symbol: '\u060b', name: 'Afghan Afghani', region: 'Asia' },
  { code: 'MMK', symbol: 'K', name: 'Myanmar Kyat', region: 'Asia', symbolAfter: true },
  { code: 'KHR', symbol: '\u17db', name: 'Cambodian Riel', region: 'Asia', zeroDecimal: true },
  { code: 'LAK', symbol: '\u20ad', name: 'Lao Kip', region: 'Asia', zeroDecimal: true },
  { code: 'MNT', symbol: '\u20ae', name: 'Mongolian Tugrik', region: 'Asia', zeroDecimal: true },

  // Middle East
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', region: 'Middle East' },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal', region: 'Middle East' },
  { code: 'QAR', symbol: 'QAR', name: 'Qatari Riyal', region: 'Middle East' },
  { code: 'KWD', symbol: 'KWD', name: 'Kuwaiti Dinar', region: 'Middle East' },
  { code: 'BHD', symbol: 'BHD', name: 'Bahraini Dinar', region: 'Middle East' },
  { code: 'OMR', symbol: 'OMR', name: 'Omani Rial', region: 'Middle East' },
  { code: 'JOD', symbol: 'JOD', name: 'Jordanian Dinar', region: 'Middle East' },
  { code: 'LBP', symbol: 'LBP', name: 'Lebanese Pound', region: 'Middle East' },
  { code: 'ILS', symbol: '\u20aa', name: 'Israeli Shekel', region: 'Middle East' },
  { code: 'IQD', symbol: 'IQD', name: 'Iraqi Dinar', region: 'Middle East', zeroDecimal: true },
  { code: 'TRY', symbol: '\u20ba', name: 'Turkish Lira', region: 'Middle East' },
  { code: 'IRR', symbol: 'IRR', name: 'Iranian Rial', region: 'Middle East', zeroDecimal: true },
  { code: 'YER', symbol: 'YER', name: 'Yemeni Rial', region: 'Middle East', zeroDecimal: true },
  { code: 'SYP', symbol: 'SYP', name: 'Syrian Pound', region: 'Middle East' },
  { code: 'AMD', symbol: '\u058f', name: 'Armenian Dram', region: 'Middle East' },
  { code: 'GEL', symbol: '\u20be', name: 'Georgian Lari', region: 'Middle East' },
  { code: 'AZN', symbol: '\u20bc', name: 'Azerbaijani Manat', region: 'Middle East' },

  // Africa
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', region: 'Africa' },
  { code: 'EGP', symbol: 'E\u00a3', name: 'Egyptian Pound', region: 'Africa' },
  { code: 'MAD', symbol: 'MAD', name: 'Moroccan Dirham', region: 'Africa' },
  { code: 'TND', symbol: 'TND', name: 'Tunisian Dinar', region: 'Africa' },
  { code: 'DZD', symbol: 'DZD', name: 'Algerian Dinar', region: 'Africa' },
  { code: 'NGN', symbol: '\u20a6', name: 'Nigerian Naira', region: 'Africa' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', region: 'Africa', symbolAfter: true },
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling', region: 'Africa', zeroDecimal: true, symbolAfter: true },
  { code: 'GHS', symbol: 'GH\u20b5', name: 'Ghanaian Cedi', region: 'Africa' },
  { code: 'ETB', symbol: 'ETB', name: 'Ethiopian Birr', region: 'Africa' },
  { code: 'XOF', symbol: 'CFA', name: 'West African Franc', region: 'Africa', zeroDecimal: true, symbolAfter: true },
  { code: 'XAF', symbol: 'FCFA', name: 'Central African Franc', region: 'Africa', zeroDecimal: true, symbolAfter: true },
  { code: 'RWF', symbol: 'FRw', name: 'Rwandan Franc', region: 'Africa', zeroDecimal: true, symbolAfter: true },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling', region: 'Africa', symbolAfter: true },
  { code: 'MUR', symbol: 'Rs', name: 'Mauritian Rupee', region: 'Africa', symbolAfter: true },
  { code: 'BWP', symbol: 'P', name: 'Botswanan Pula', region: 'Africa' },
  { code: 'NAD', symbol: 'N$', name: 'Namibian Dollar', region: 'Africa' },
  { code: 'ZMW', symbol: 'ZK', name: 'Zambian Kwacha', region: 'Africa' },

  // Americas
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso', region: 'Americas' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', region: 'Americas' },
  { code: 'ARS', symbol: 'AR$', name: 'Argentine Peso', region: 'Americas' },
  { code: 'CLP', symbol: 'CLP$', name: 'Chilean Peso', region: 'Americas', zeroDecimal: true },
  { code: 'COP', symbol: 'COL$', name: 'Colombian Peso', region: 'Americas', zeroDecimal: true },
  { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol', region: 'Americas' },
  { code: 'UYU', symbol: '$U', name: 'Uruguayan Peso', region: 'Americas' },
  { code: 'VES', symbol: 'Bs.', name: 'Venezuelan Bolivar', region: 'Americas' },
  { code: 'BOB', symbol: 'Bs.', name: 'Bolivian Boliviano', region: 'Americas' },
  { code: 'PYG', symbol: '\u20b2', name: 'Paraguayan Guarani', region: 'Americas', zeroDecimal: true },
  { code: 'GTQ', symbol: 'Q', name: 'Guatemalan Quetzal', region: 'Americas' },
  { code: 'DOP', symbol: 'RD$', name: 'Dominican Peso', region: 'Americas' },
  { code: 'CRC', symbol: '\u20a1', name: 'Costa Rican Colon', region: 'Americas' },
  { code: 'PAB', symbol: 'B/.', name: 'Panamanian Balboa', region: 'Americas' },
  { code: 'JMD', symbol: 'J$', name: 'Jamaican Dollar', region: 'Americas' },
  { code: 'TTD', symbol: 'TT$', name: 'Trinidad Dollar', region: 'Americas' },
  { code: 'BSD', symbol: 'B$', name: 'Bahamian Dollar', region: 'Americas' },
  { code: 'XCD', symbol: 'EC$', name: 'East Caribbean Dollar', region: 'Americas' },
  { code: 'BMD', symbol: 'BD$', name: 'Bermudian Dollar', region: 'Americas' },
  { code: 'KYD', symbol: 'CI$', name: 'Cayman Islands Dollar', region: 'Americas' },
  { code: 'ANG', symbol: 'NA\u0192', name: 'Netherlands Antillean Guilder', region: 'Americas' },

  // Oceania
  { code: 'FJD', symbol: 'FJ$', name: 'Fijian Dollar', region: 'Oceania' },
  { code: 'PGK', symbol: 'K', name: 'Papua New Guinean Kina', region: 'Oceania' },
];

/** Legacy exports */
export const CURRENCY_SYMBOLS: Record<string, string> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c.symbol])
);

export const CURRENCY_NAMES: Record<string, string> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c.name])
);

const ZERO_DECIMAL = new Set(CURRENCIES.filter((c) => c.zeroDecimal).map((c) => c.code));

const LOCALE_CURRENCY_MAP: Record<string, CurrencyCode> = {
  'en-US': 'USD', 'en-GB': 'GBP', 'en-AU': 'AUD', 'en-CA': 'CAD', 'en-NZ': 'NZD',
  'en-ZA': 'ZAR', 'en-SG': 'SGD', 'en-HK': 'HKD', 'en-IE': 'EUR', 'en-IN': 'INR',
  'fr-FR': 'EUR', 'fr-CH': 'CHF', 'fr-CA': 'CAD', 'fr-MA': 'MAD', 'fr-TN': 'TND', 'fr-BE': 'EUR',
  'de-DE': 'EUR', 'de-CH': 'CHF', 'de-AT': 'EUR',
  'es-ES': 'EUR', 'es-MX': 'MXN', 'es-AR': 'ARS', 'es-CL': 'CLP', 'es-CO': 'COP', 'es-PE': 'PEN',
  'it-IT': 'EUR', 'pt-BR': 'BRL', 'pt-PT': 'EUR',
  'ar-SA': 'SAR', 'ar-AE': 'AED', 'ar-MA': 'MAD', 'ar-TN': 'TND', 'ar-EG': 'EGP', 'ar-QA': 'QAR', 'ar-KW': 'KWD',
  'zh-CN': 'CNY', 'zh-TW': 'TWD', 'zh-HK': 'HKD', 'zh-SG': 'SGD',
  'ja-JP': 'JPY', 'ko-KR': 'KRW',
  'ru-RU': 'RUB', 'uk-UA': 'UAH', 'tr-TR': 'TRY',
  'nl-NL': 'EUR', 'pl-PL': 'PLN', 'cs-CZ': 'CZK', 'hu-HU': 'HUF',
  'sv-SE': 'SEK', 'da-DK': 'DKK', 'nb-NO': 'NOK', 'no-NO': 'NOK', 'fi-FI': 'EUR',
  'el-GR': 'EUR', 'ro-RO': 'RON', 'bg-BG': 'BGN', 'hr-HR': 'EUR',
  'th-TH': 'THB', 'vi-VN': 'VND', 'id-ID': 'IDR', 'ms-MY': 'MYR',
  'hi-IN': 'INR', 'bn-BD': 'BDT', 'ta-IN': 'INR',
  'he-IL': 'ILS', 'fa-IR': 'IRR', 'ur-PK': 'PKR',
  'sw-KE': 'KES', 'sw-TZ': 'TZS',
  'af-ZA': 'ZAR',
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
const CACHE_TTL = 6 * 60 * 60 * 1000;

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

/** Format price with correct symbol, decimals, and symbol placement */
export function formatPrice(amount: number, currency: CurrencyCode): string {
  const meta = CURRENCIES.find((c) => c.code === currency);
  const symbol = meta?.symbol || currency;
  const isZeroDecimal = meta?.zeroDecimal || ZERO_DECIMAL.has(currency);
  const symbolAfter = meta?.symbolAfter;

  const formatted = isZeroDecimal
    ? Math.round(amount).toLocaleString()
    : amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return symbolAfter ? `${formatted} ${symbol}` : `${symbol}${formatted}`;
}
