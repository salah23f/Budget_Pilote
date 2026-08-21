'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface AirportResult {
  skyId: string;
  entityId: string;
  name: string;
  iata: string;
  country: string;
  type: string;
}

export interface AirportSelection {
  code: string;
  skyId: string;
  entityId: string;
}

interface AirportInputProps {
  label: string;
  value: string;
  onChange: (selection: AirportSelection) => void;
  placeholder?: string;
}

export function AirportInput({ label, value, onChange, placeholder }: AirportInputProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<AirportResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (value !== query && !isOpen && !selected) {
      setQuery(value);
    }
  }, [value]);

  const searchAirports = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }

    setLoading(true);
    try {
      const res = await fetch(`/api/airports/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.success && data.data && data.data.length > 0) {
        setResults(data.data.slice(0, 8));
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

    // Always trigger autocomplete search (even for IATA codes)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchAirports(val), 250);
  }

  function selectAirport(airport: AirportResult) {
    const code = airport.iata || airport.skyId;
    setQuery(`${airport.name} (${code})`);
    onChange({ code, skyId: airport.skyId, entityId: airport.entityId });
    setSelected(true);
    setIsOpen(false);
    setResults([]);
  }

  // When user presses Enter without selecting from dropdown, use the typed value
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      selectAirport(results[0]); // Select first result
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-xs font-medium text-pen-3 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type="text"
          className="w-full pr-8 rounded-md bg-ink-900 border border-line-2 px-3 py-2 text-sm text-pen-1 placeholder:text-pen-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          placeholder={placeholder || 'City or airport...'}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
            else if (query.length >= 2) searchAirports(query);
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

      {/* Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-lg bg-ink-800 border border-line-1 shadow-elev-3">
          {results.map((r, i) => (
            <button
              key={`${r.skyId}-${i}`}
              type="button"
              className="w-full px-4 py-3 text-left transition-colors hover:bg-ink-600 flex items-center gap-3"
              onClick={() => selectAirport(r)}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-md text-xs font-bold flex-shrink-0 bg-accent/10 text-accent num">
                {r.iata || r.skyId?.slice(0, 3)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-pen-1 truncate">{r.name}</p>
                <p className="text-xs text-pen-3">{r.country}{r.type === 'AIRPORT' ? ' · Airport' : ' · City'}</p>
              </div>
              <span className="text-[10px] text-pen-3 font-mono num">{r.iata || r.skyId}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
