'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AirportSelection } from '@/lib/algorithm';
import { MapPin, Plane, Check, Radius } from 'lucide-react';

/**
 * AirportRegionPicker — single airport OR region cluster OR radius.
 *
 * The existing AirportInput handles autocomplete. This component wraps
 * that concept and adds region/cluster/radius modes. Designed to be used
 * in the watch creation form (and later, search forms).
 */

// Small curated clusters — the 25 most common city regions worldwide.
// Expand this list as the product grows. Keys are slugs, labels localized-ready.
const REGION_CLUSTERS: Record<string, { label: string; airports: string[] }> = {
  'london': { label: 'London', airports: ['LHR', 'LGW', 'STN', 'LTN', 'LCY'] },
  'paris': { label: 'Paris', airports: ['CDG', 'ORY', 'BVA'] },
  'nyc': { label: 'New York metro', airports: ['JFK', 'EWR', 'LGA'] },
  'washington': { label: 'Washington DC', airports: ['IAD', 'DCA', 'BWI'] },
  'san-francisco': { label: 'San Francisco Bay', airports: ['SFO', 'OAK', 'SJC'] },
  'los-angeles': { label: 'Los Angeles metro', airports: ['LAX', 'BUR', 'LGB', 'SNA'] },
  'chicago': { label: 'Chicago', airports: ['ORD', 'MDW'] },
  'tokyo': { label: 'Tokyo', airports: ['HND', 'NRT'] },
  'seoul': { label: 'Seoul', airports: ['ICN', 'GMP'] },
  'shanghai': { label: 'Shanghai', airports: ['PVG', 'SHA'] },
  'beijing': { label: 'Beijing', airports: ['PEK', 'PKX'] },
  'moscow': { label: 'Moscow', airports: ['SVO', 'DME', 'VKO'] },
  'milan': { label: 'Milan', airports: ['MXP', 'LIN', 'BGY'] },
  'rome': { label: 'Rome', airports: ['FCO', 'CIA'] },
  'berlin': { label: 'Berlin', airports: ['BER'] },
  'istanbul': { label: 'Istanbul', airports: ['IST', 'SAW'] },
  'sao-paulo': { label: 'São Paulo', airports: ['GRU', 'CGH', 'VCP'] },
  'bangkok': { label: 'Bangkok', airports: ['BKK', 'DMK'] },
  'taipei': { label: 'Taipei', airports: ['TPE', 'TSA'] },
  'osaka': { label: 'Osaka', airports: ['KIX', 'ITM'] },
  'jakarta': { label: 'Jakarta', airports: ['CGK', 'HLP'] },
  'buenos-aires': { label: 'Buenos Aires', airports: ['EZE', 'AEP'] },
  'stockholm': { label: 'Stockholm', airports: ['ARN', 'BMA', 'NYO'] },
  'oslo': { label: 'Oslo', airports: ['OSL', 'TRF'] },
  'copenhagen': { label: 'Copenhagen', airports: ['CPH'] },
};

type Mode = AirportSelection['kind'];

export function AirportRegionPicker({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: AirportSelection | undefined;
  onChange: (v: AirportSelection) => void;
  label: string;
  placeholder?: string;
}) {
  const [mode, setMode] = useState<Mode>(value?.kind ?? 'exact');
  const [query, setQuery] = useState('');
  const [radiusKm, setRadiusKm] = useState(100);

  const regionMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return Object.entries(REGION_CLUSTERS)
      .filter(([, v]) => v.label.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query]);

  useEffect(() => {
    if (value?.kind !== mode) setMode(value?.kind ?? 'exact');
  }, [value?.kind, mode]);

  return (
    <div>
      <span className="block text-micro uppercase text-pen-3 mb-1.5">{label}</span>

      {/* Mode toggle */}
      <div className="inline-flex rounded-md border border-line-1 bg-ink-900 p-0.5 mb-2 text-caption">
        <ModeBtn mode="exact" active={mode === 'exact'} onClick={() => setMode('exact')} icon={Plane} label="One airport" />
        <ModeBtn mode="region" active={mode === 'region'} onClick={() => setMode('region')} icon={MapPin} label="Region" />
        <ModeBtn mode="radius" active={mode === 'radius'} onClick={() => setMode('radius')} icon={Radius} label="Within" />
      </div>

      {/* Input area */}
      {mode === 'exact' && (
        <input
          type="text"
          className="glass-input"
          placeholder={placeholder ?? 'IATA code (e.g. CDG)'}
          value={value?.kind === 'exact' ? value.iata : ''}
          onChange={(e) => {
            const iata = e.target.value.toUpperCase().slice(0, 3);
            onChange({ kind: 'exact', iata });
          }}
          aria-label={label}
        />
      )}

      {mode === 'region' && (
        <div>
          <input
            type="text"
            className="glass-input"
            placeholder={placeholder ?? 'Search region (London, NYC, Tokyo…)'}
            value={value?.kind === 'region' ? value.label : query}
            onChange={(e) => {
              setQuery(e.target.value);
              // If user clears, reset
              if (!e.target.value) {
                onChange({ kind: 'region', label: '', airports: [] });
              }
            }}
            aria-label={label}
          />
          {regionMatches.length > 0 && (
            <ul className="mt-2 rounded-md border border-line-1 bg-ink-800 overflow-hidden" role="listbox">
              {regionMatches.map(([slug, r]) => {
                const selected = value?.kind === 'region' && value.label === r.label;
                return (
                  <li key={slug}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange({ kind: 'region', label: r.label, airports: r.airports });
                        setQuery('');
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left transition ${
                        selected ? 'bg-ink-700' : 'hover:bg-ink-700'
                      }`}
                    >
                      <div>
                        <p className="text-body text-pen-1">{r.label}</p>
                        <p className="text-caption text-pen-3">{r.airports.join(' · ')}</p>
                      </div>
                      {selected && <Check className="w-4 h-4 text-accent" strokeWidth={2} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {value?.kind === 'region' && value.airports.length > 0 && (
            <p className="mt-2 text-caption text-pen-3">
              Watching {value.airports.length} airports: <span className="font-mono text-pen-2">{value.airports.join(', ')}</span>
            </p>
          )}
        </div>
      )}

      {mode === 'radius' && (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input
            type="text"
            className="glass-input"
            placeholder="Anchor airport (e.g. CDG)"
            value={value?.kind === 'radius' ? value.centerIata : ''}
            onChange={(e) => {
              const iata = e.target.value.toUpperCase().slice(0, 3);
              onChange({
                kind: 'radius',
                centerIata: iata,
                km: radiusKm,
                airports: [iata], // resolver fills in nearby airports server-side
              });
            }}
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={25}
              max={500}
              step={25}
              value={radiusKm}
              onChange={(e) => {
                const km = Number(e.target.value) || 100;
                setRadiusKm(km);
                if (value?.kind === 'radius') onChange({ ...value, km });
              }}
              className="glass-input w-20"
            />
            <span className="text-caption text-pen-3">km</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ModeBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  mode: Mode;
  active: boolean;
  onClick: () => void;
  icon: typeof Plane;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 transition ${
        active ? 'bg-ink-700 text-pen-1' : 'text-pen-2 hover:text-pen-1'
      }`}
      aria-pressed={active}
    >
      <Icon className="w-3 h-3" strokeWidth={1.8} />
      {label}
    </button>
  );
}
