'use client';

import { useEffect, useMemo } from 'react';
import { useCurrencyStore } from '@/lib/store/currency-store';
import { convertPrice, formatPrice, CURRENCIES, type CurrencyCode } from '@/lib/currency';

/**
 * Premium price display component — handles:
 *  - USD -> user-preferred currency via live rates (cached 6h)
 *  - Locale-appropriate formatting (symbol position, decimals, separators)
 *  - Optional USD original caption (builds trust)
 *  - Graceful fallback to USD if rates unavailable
 *
 * Use EVERYWHERE prices are shown.
 */
export function PriceDisplay({
  usd,
  amount,
  currency: forcedCurrency,
  size = 'md',
  suffix,
  prefix,
  showUsdOriginal,
  className = '',
  strikethrough,
  color,
  showCode,
}: {
  /** Price in USD (preferred — triggers auto-conversion) */
  usd?: number;
  /** Pre-converted amount (bypass conversion) */
  amount?: number;
  /** Force a specific currency (bypass user preference) */
  currency?: CurrencyCode;
  /** Visual size preset */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Suffix like "/night", "/person" */
  suffix?: string;
  /** Prefix like "from" */
  prefix?: string;
  /** Show the original USD price as a subtle caption (helps trust) */
  showUsdOriginal?: boolean;
  /** Extra classes for the main price */
  className?: string;
  /** Strikethrough (for original price on deals) */
  strikethrough?: boolean;
  /** Custom color */
  color?: string;
  /** Show the ISO currency code next to the price */
  showCode?: boolean;
}) {
  const currency = useCurrencyStore((s) => s.currency);
  const rates = useCurrencyStore((s) => s.rates);
  const loadRates = useCurrencyStore((s) => s.loadRates);

  const activeCurrency = forcedCurrency || currency;

  useEffect(() => {
    if (!rates && usd !== undefined) loadRates();
  }, [rates, usd, loadRates]);

  const displayValue = useMemo(() => {
    if (amount !== undefined) return formatPrice(amount, activeCurrency);
    if (usd === undefined) return '';
    if (activeCurrency === 'USD' || !rates) return formatPrice(usd, 'USD');
    const converted = convertPrice(usd, activeCurrency, rates);
    return formatPrice(converted, activeCurrency);
  }, [usd, amount, activeCurrency, rates]);

  const sizes: Record<NonNullable<typeof size>, string> = {
    xs: 'text-[10px]',
    sm: 'text-xs',
    md: 'text-sm font-semibold',
    lg: 'text-base font-bold',
    xl: 'text-xl font-bold',
    '2xl': 'text-2xl md:text-3xl font-bold',
  };

  const needsOriginal =
    showUsdOriginal && usd !== undefined && activeCurrency !== 'USD' && rates;

  return (
    <span className="inline-flex flex-col items-end leading-none">
      <span className={`${sizes[size]} ${className}`} style={color ? { color } : undefined}>
        {prefix && <span className="text-white/40 font-normal mr-1">{prefix}</span>}
        <span style={strikethrough ? { textDecoration: 'line-through', opacity: 0.5 } : undefined}>
          {displayValue}
        </span>
        {showCode && activeCurrency !== 'USD' && (
          <span className="text-[0.6em] text-white/30 ml-1 font-mono">{activeCurrency}</span>
        )}
        {suffix && <span className="text-white/40 text-[0.75em] font-normal ml-0.5">{suffix}</span>}
      </span>
      {needsOriginal && (
        <span className="text-[10px] text-white/25 mt-0.5 font-mono">
          ~ ${Math.round(usd!).toLocaleString()}
        </span>
      )}
    </span>
  );
}

/**
 * Programmatic helper — format a USD amount without rendering JSX.
 */
export function formatPriceUsd(usd: number, currency: CurrencyCode, rates: Record<string, number> | null): string {
  if (currency === 'USD' || !rates) return formatPrice(usd, 'USD');
  return formatPrice(convertPrice(usd, currency, rates), currency);
}

export { CURRENCIES };
