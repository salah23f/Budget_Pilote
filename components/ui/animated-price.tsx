'use client';

import { useEffect, useState, useRef } from 'react';
import { useCurrencyStore } from '@/lib/store/currency-store';
import { convertPrice, formatPrice, CURRENCY_SYMBOLS } from '@/lib/currency';

/**
 * Animated price display that counts up from 0 to the final value.
 * Also supports automatic currency conversion from USD.
 */
export function AnimatedPrice({
  amount,
  usdAmount,
  className = '',
  duration = 400,
  convert = true,
}: {
  /** Price to display (already formatted) */
  amount?: number;
  /** USD amount — will auto-convert to user's currency */
  usdAmount?: number;
  className?: string;
  duration?: number;
  convert?: boolean;
}) {
  const currency = useCurrencyStore((s) => s.currency);
  const rates = useCurrencyStore((s) => s.rates);
  const loadRates = useCurrencyStore((s) => s.loadRates);

  useEffect(() => {
    if (convert && usdAmount && !rates) loadRates();
  }, [convert, usdAmount, rates, loadRates]);

  // Determine final value + symbol
  const finalValue =
    convert && usdAmount !== undefined && rates
      ? convertPrice(usdAmount, currency, rates)
      : amount !== undefined
      ? amount
      : usdAmount || 0;

  const symbol = convert ? CURRENCY_SYMBOLS[currency] : '$';

  const [displayed, setDisplayed] = useState(finalValue);
  const targetRef = useRef(finalValue);
  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    targetRef.current = finalValue;
    const start = displayed;
    const end = finalValue;
    const t0 = performance.now();

    function tick(now: number) {
      const elapsed = now - t0;
      const p = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      const val = start + (end - start) * eased;
      setDisplayed(val);
      if (p < 1) frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalValue]);

  const rounded = Math.round(displayed);
  const formatted = convert
    ? formatPrice(displayed, currency)
    : `${symbol}${rounded.toLocaleString()}`;

  return <span className={className}>{formatted}</span>;
}
