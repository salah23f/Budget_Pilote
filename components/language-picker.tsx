'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useLocale, SUPPORTED_LOCALES } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';
import { Globe, Search, Check } from 'lucide-react';

/**
 * Premium language picker with search + region grouping.
 * Revolut-style: clean, fast, no flags (country codes are politically fraught).
 */
export function LanguagePicker({
  variant = 'dropdown',
  onSelect,
}: {
  variant?: 'dropdown' | 'inline';
  onSelect?: () => void;
}) {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(variant === 'inline');
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (variant !== 'dropdown') return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [variant]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? SUPPORTED_LOCALES.filter(
          (l) =>
            l.name.toLowerCase().includes(q) ||
            l.nativeName.toLowerCase().includes(q) ||
            l.code.includes(q)
        )
      : SUPPORTED_LOCALES;

    return filtered.reduce<Record<string, typeof SUPPORTED_LOCALES>>((acc, loc) => {
      if (!acc[loc.region]) acc[loc.region] = [];
      acc[loc.region].push(loc);
      return acc;
    }, {});
  }, [query]);

  const current = SUPPORTED_LOCALES.find((l) => l.code === locale);

  function pick(code: Locale) {
    setLocale(code);
    setOpen(false);
    setQuery('');
    onSelect?.();
  }

  if (variant === 'inline') {
    return (
      <div className="w-full">
        <PickerContent
          grouped={grouped}
          query={query}
          setQuery={setQuery}
          locale={locale}
          pick={pick}
          inputRef={inputRef}
        />
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition"
        aria-label="Change language"
      >
        <Globe className="w-4 h-4" strokeWidth={1.8} />
        <span>{current?.nativeName || 'English'}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[320px] max-h-[440px] rounded-2xl overflow-hidden z-50 flex flex-col"
          style={{
            background: 'rgba(9,9,11,0.98)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
            animation: 'flyeas-slide-up 0.25s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <PickerContent
            grouped={grouped}
            query={query}
            setQuery={setQuery}
            locale={locale}
            pick={pick}
            inputRef={inputRef}
          />
        </div>
      )}
    </div>
  );
}

function PickerContent({
  grouped,
  query,
  setQuery,
  locale,
  pick,
  inputRef,
}: {
  grouped: Record<string, typeof SUPPORTED_LOCALES>;
  query: string;
  setQuery: (q: string) => void;
  locale: Locale;
  pick: (code: Locale) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const regionOrder = ['Europe', 'Middle East', 'Asia', 'Africa', 'Americas'];

  return (
    <>
      <div className="px-3 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" strokeWidth={1.8} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search language..."
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-white/25 outline-none focus:border-[rgba(232,163,23,0.3)]"
          />
        </div>
      </div>
      <div className="overflow-y-auto flex-1 py-2">
        {regionOrder.map((region) => {
          const items = grouped[region];
          if (!items || items.length === 0) return null;
          return (
            <div key={region} className="mb-2">
              <p className="px-4 pt-1 pb-1 text-[9px] font-semibold text-white/25 uppercase tracking-[0.1em]">
                {region}
              </p>
              {items.map((l) => {
                const isActive = locale === l.code;
                return (
                  <button
                    key={l.code}
                    onClick={() => pick(l.code)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-2 text-left transition ${
                      isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex flex-col items-start min-w-0">
                      <span className={`text-sm truncate ${isActive ? 'text-white font-medium' : 'text-white/70'}`}>
                        {l.nativeName}
                      </span>
                      <span className="text-[10px] text-white/30">{l.name}</span>
                    </div>
                    {isActive ? (
                      <Check className="w-4 h-4 text-accent shrink-0" strokeWidth={2.2} />
                    ) : (
                      <span className="text-[10px] font-mono text-white/20 shrink-0">{l.code.toUpperCase()}</span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
        {Object.keys(grouped).length === 0 && (
          <p className="px-4 py-8 text-center text-xs text-white/30">No languages match &quot;{query}&quot;</p>
        )}
      </div>
    </>
  );
}
