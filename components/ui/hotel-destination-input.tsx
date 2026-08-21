'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface HotelDestination {
  entityId: string;
  name: string;
  type: string;
  hierarchy?: string;
}

interface Props {
  label: string;
  value: string;
  onChange: (selection: HotelDestination) => void;
  placeholder?: string;
}

interface Result {
  code: string;
  entityId: string;
  name: string;
  type: string;
  hierarchy?: string;
}

export function HotelDestinationInput({ label, value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Result[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Sync external `value` changes into the internal `query` state. This lets
  // the parent page prefill the destination programmatically (e.g. from a
  // ?q= URL query on the dashboard → hotels nav).
  useEffect(() => {
    if (value !== query) {
      setQuery(value);
      if (value) setSelected(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/hotels/destinations?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setResults(data.data.slice(0, 10));
        setIsOpen(true);
      } else {
        setResults([]);
      }
    } catch (_) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    setSelected(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  }

  function select(r: Result) {
    setQuery(r.name);
    onChange({ entityId: r.entityId, name: r.name, type: r.type, hierarchy: r.hierarchy });
    setSelected(true);
    setIsOpen(false);
    setResults([]);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      select(results[0]);
    }
  }

  const typeIcon = (t: string) => {
    const s = t.toUpperCase();
    if (s.includes('CITY')) return '🏙';
    if (s.includes('AIRPORT')) return '✈';
    if (s.includes('HOTEL')) return 'H';
    if (s.includes('REGION') || s.includes('AREA')) return '📍';
    if (s.includes('DISTRICT') || s.includes('NEIGHBORHOOD')) return '🏘';
    return '📍';
  };

  const typeLabel = (t: string) => {
    const s = t.toUpperCase();
    if (s.includes('CITY')) return 'City';
    if (s.includes('AIRPORT')) return 'Airport';
    if (s.includes('HOTEL')) return 'Hotel';
    if (s.includes('REGION')) return 'Region';
    if (s.includes('DISTRICT')) return 'District';
    if (s.includes('NEIGHBORHOOD')) return 'Neighborhood';
    return t;
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-xs font-medium text-pen-3 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type="text"
          className="w-full rounded-md bg-ink-900 border border-line-2 px-3 py-2 pr-8 text-sm text-pen-1 placeholder:text-pen-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          placeholder={placeholder || 'City, neighborhood, hotel...'}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
            else if (query.length >= 2) search(query);
          }}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
          </div>
        )}
        {!loading && selected && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8.5l3.5 3.5L13 5" />
            </svg>
          </div>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div
          className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto rounded-lg bg-ink-800 border border-line-1 shadow-elev-3"
        >
          {results.map((r, i) => (
            <button
              key={`${r.entityId}-${i}`}
              type="button"
              className="w-full px-4 py-3 text-left transition-colors hover:bg-ink-600 flex items-center gap-3"
              onClick={() => select(r)}
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-soft text-base flex-shrink-0"
              >
                {typeIcon(r.type)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-pen-1 truncate">{r.name}</p>
                <p className="text-xs text-pen-3 truncate">
                  {r.hierarchy || typeLabel(r.type)}
                </p>
              </div>
              <span className="text-[10px] text-pen-3 font-mono flex-shrink-0">
                {typeLabel(r.type)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
