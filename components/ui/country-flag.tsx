'use client';

import { Globe } from 'lucide-react';

/**
 * Country flag — renders an SVG flag from flagcdn.com.
 * NEVER renders a letter. If iso2 is unknown, shows a Globe icon.
 */

const CITY_TO_ISO2: Record<string, string> = {
  tokyo: 'jp', kyoto: 'jp', osaka: 'jp',
  bali: 'id', jakarta: 'id',
  lisbon: 'pt', porto: 'pt',
  marrakech: 'ma', casablanca: 'ma',
  istanbul: 'tr',
  'mexico city': 'mx', cancun: 'mx',
  'cape town': 'za', johannesburg: 'za',
  'buenos aires': 'ar',
  reykjavik: 'is',
  paris: 'fr', nice: 'fr', lyon: 'fr',
  london: 'gb', edinburgh: 'gb',
  rome: 'it', milan: 'it', florence: 'it', venice: 'it',
  madrid: 'es', barcelona: 'es',
  berlin: 'de', munich: 'de',
  amsterdam: 'nl',
  dubai: 'ae', 'abu dhabi': 'ae',
  bangkok: 'th', phuket: 'th',
  singapore: 'sg',
  seoul: 'kr',
  shanghai: 'cn', beijing: 'cn',
  sydney: 'au', melbourne: 'au',
  mumbai: 'in', delhi: 'in',
  cairo: 'eg',
  'new york': 'us', 'los angeles': 'us', miami: 'us', chicago: 'us',
  toronto: 'ca', vancouver: 'ca',
  'rio de janeiro': 'br', 'sao paulo': 'br',
  lima: 'pe', bogota: 'co',
  athens: 'gr', prague: 'cz', vienna: 'at', budapest: 'hu',
  copenhagen: 'dk', stockholm: 'se', oslo: 'no', helsinki: 'fi',
  zurich: 'ch', geneva: 'ch',
  brussels: 'be', dublin: 'ie',
  warsaw: 'pl', bucharest: 'ro',
  nairobi: 'ke', lagos: 'ng',
};

export function resolveIso2(city: string): string | null {
  return CITY_TO_ISO2[city.toLowerCase()] ?? null;
}

export function CountryFlag({
  iso2,
  city,
  size = 24,
  className = '',
}: {
  iso2?: string;
  city?: string;
  size?: number;
  className?: string;
}) {
  const code = iso2 ?? (city ? resolveIso2(city) : null);

  if (!code) {
    return <Globe className={`text-pen-3 ${className}`} style={{ width: size, height: size }} strokeWidth={1.5} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/${code.toLowerCase()}.svg`}
      alt={code.toUpperCase()}
      width={size}
      height={Math.round(size * 0.75)}
      className={`inline-block rounded-sm ${className}`}
      loading="lazy"
      style={{ objectFit: 'cover' }}
    />
  );
}
