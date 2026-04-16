'use client';

import { useEffect } from 'react';
import { useCurrencyStore } from '@/lib/store/currency-store';
import { convertPrice, formatPrice } from '@/lib/currency';

interface PriceDisplayProps {
  usd: number;
  className?: string;
  showCode?: boolean;
}

export function PriceDisplay({ usd, className, showCode }: PriceDisplayProps) {
  const { currency, rates, loadRates } = useCurrencyStore();

  useEffect(() => { loadRates(); }, [loadRates]);

  const converted = rates ? convertPrice(usd, currency, rates) : usd;
  const display = rates ? formatPrice(converted, currency) : `$${usd}`;

  return (
    <span className={className}>
      {display}
      {showCode && currency !== 'USD' && (
        <span className="text-[9px] text-white/30 ml-1">{currency}</span>
      )}
    </span>
  );
}
