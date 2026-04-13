'use client';

import { useState, useMemo, useCallback } from 'react';

/* ------------------------------------------------------------------ */
/*  Exchange rates (static — updated periodically in production)        */
/* ------------------------------------------------------------------ */

const RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149.5, CAD: 1.36, AUD: 1.53,
  CHF: 0.88, CNY: 7.24, INR: 83.1, BRL: 4.97, MXN: 17.15, KRW: 1320,
  SEK: 10.45, NOK: 10.6, DKK: 6.87, PLN: 3.98, CZK: 22.8, HUF: 355,
  TRY: 30.2, THB: 35.1, SGD: 1.34, HKD: 7.82, NZD: 1.64, ZAR: 18.7,
  AED: 3.67, SAR: 3.75, MAD: 10.05, EGP: 30.9, PHP: 55.8, IDR: 15500,
  VND: 24300, MYR: 4.65, TWD: 31.5, ILS: 3.65, COP: 3950, CLP: 880,
  PEN: 3.72, ARS: 350, NGN: 780, KES: 153, GHS: 12.5, RUB: 92,
};

const CURRENCY_INFO: Record<string, { name: string; symbol: string; flag: string }> = {
  USD: { name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  EUR: { name: 'Euro', symbol: '€', flag: '🇪🇺' },
  GBP: { name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  JPY: { name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
  CAD: { name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
  AUD: { name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
  CHF: { name: 'Swiss Franc', symbol: 'CHF', flag: '🇨🇭' },
  CNY: { name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' },
  INR: { name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
  BRL: { name: 'Brazilian Real', symbol: 'R$', flag: '🇧🇷' },
  MXN: { name: 'Mexican Peso', symbol: 'MX$', flag: '🇲🇽' },
  KRW: { name: 'South Korean Won', symbol: '₩', flag: '🇰🇷' },
  THB: { name: 'Thai Baht', symbol: '฿', flag: '🇹🇭' },
  SGD: { name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬' },
  TRY: { name: 'Turkish Lira', symbol: '₺', flag: '🇹🇷' },
  MAD: { name: 'Moroccan Dirham', symbol: 'MAD', flag: '🇲🇦' },
  AED: { name: 'UAE Dirham', symbol: 'AED', flag: '🇦🇪' },
  SEK: { name: 'Swedish Krona', symbol: 'kr', flag: '🇸🇪' },
  PLN: { name: 'Polish Zloty', symbol: 'zł', flag: '🇵🇱' },
  ZAR: { name: 'South African Rand', symbol: 'R', flag: '🇿🇦' },
};

const currencies = Object.keys(CURRENCY_INFO);

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

interface CurrencyConverterProps {
  defaultAmount?: number;
  defaultFrom?: string;
  defaultTo?: string;
  compact?: boolean;
  className?: string;
}

export function CurrencyConverter({
  defaultAmount = 100,
  defaultFrom = 'USD',
  defaultTo = 'EUR',
  compact = false,
  className = '',
}: CurrencyConverterProps) {
  const [amount, setAmount] = useState(defaultAmount);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  const converted = useMemo(() => {
    const fromRate = RATES[from] || 1;
    const toRate = RATES[to] || 1;
    return (amount / fromRate) * toRate;
  }, [amount, from, to]);

  const rate = useMemo(() => {
    const fromRate = RATES[from] || 1;
    const toRate = RATES[to] || 1;
    return toRate / fromRate;
  }, [from, to]);

  const swap = useCallback(() => {
    setFrom(to);
    setTo(from);
  }, [from, to]);

  const fromInfo = CURRENCY_INFO[from] || { name: from, symbol: from, flag: '💱' };
  const toInfo = CURRENCY_INFO[to] || { name: to, symbol: to, flag: '💱' };

  if (compact) {
    return (
      <div className={`glass rounded-xl p-3 flex items-center gap-3 ${className}`}>
        <span className="text-lg">{fromInfo.flag}</span>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value) || 0)}
          className="w-20 bg-transparent text-sm font-semibold text-white outline-none"
        />
        <span className="text-xs text-white/30">{from}</span>
        <button onClick={swap} className="text-white/30 hover:text-amber-400 transition">⇄</button>
        <span className="text-lg">{toInfo.flag}</span>
        <span className="text-sm font-bold text-amber-400">
          {toInfo.symbol}{converted.toFixed(2)}
        </span>
        <span className="text-xs text-white/30">{to}</span>
      </div>
    );
  }

  return (
    <div className={`glass rounded-2xl p-5 space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <span className="text-base">💱</span>
          Currency Converter
        </h3>
        <span className="text-[10px] text-white/25">Approximate rates</span>
      </div>

      <div className="flex items-center gap-3">
        {/* From */}
        <div className="flex-1 space-y-1.5">
          <label className="text-[10px] text-white/35 font-medium">FROM</label>
          <div className="flex items-center gap-2 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="text-lg">{fromInfo.flag}</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              className="flex-1 bg-transparent text-lg font-bold text-white outline-none min-w-0"
              min={0}
            />
            <select
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-transparent text-xs font-semibold text-white/60 outline-none cursor-pointer"
            >
              {currencies.map((c) => (
                <option key={c} value={c} style={{ background: '#1C1917' }}>
                  {CURRENCY_INFO[c]?.flag} {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Swap button */}
        <button
          onClick={swap}
          className="mt-6 w-10 h-10 rounded-xl glass flex items-center justify-center text-white/40 hover:text-amber-400 hover:bg-amber-500/5 transition btn-press"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 16l-4-4 4-4" /><path d="M17 8l4 4-4 4" />
            <path d="M3 12h18" />
          </svg>
        </button>

        {/* To */}
        <div className="flex-1 space-y-1.5">
          <label className="text-[10px] text-white/35 font-medium">TO</label>
          <div className="flex items-center gap-2 rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <span className="text-lg">{toInfo.flag}</span>
            <span className="flex-1 text-lg font-bold text-amber-400">
              {converted < 0.01 ? converted.toFixed(4) : converted < 100 ? converted.toFixed(2) : Math.round(converted).toLocaleString()}
            </span>
            <select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-transparent text-xs font-semibold text-white/60 outline-none cursor-pointer"
            >
              {currencies.map((c) => (
                <option key={c} value={c} style={{ background: '#1C1917' }}>
                  {CURRENCY_INFO[c]?.flag} {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Rate display */}
      <p className="text-[11px] text-white/30 text-center">
        1 {from} = {rate < 0.01 ? rate.toFixed(4) : rate.toFixed(4)} {to}
      </p>
    </div>
  );
}
