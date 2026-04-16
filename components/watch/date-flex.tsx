'use client';

import { useMemo, useState } from 'react';
import type { DateFlexIntent } from '@/lib/algorithm';
import { Calendar, CalendarRange, CalendarDays, Wind } from 'lucide-react';

/**
 * DateFlexPicker — first-class flexibility input.
 *
 * Users can pick one of:
 *   · Exact dates
 *   · A date range (we'll try many combinations inside it)
 *   · A whole month
 *   · A season
 *   · Weekends only
 *
 * The active mode changes the fields shown. Calm, no modal pickers —
 * just inline fields that the form layout can arrange.
 */

type Mode = DateFlexIntent['kind'];

const MODES: Array<{ kind: Mode; label: string; icon: typeof Calendar; hint: string }> = [
  { kind: 'exact', label: 'Exact dates', icon: Calendar, hint: 'Depart + return' },
  { kind: 'range', label: 'A window', icon: CalendarRange, hint: 'Any dates in the window' },
  { kind: 'month', label: 'A month', icon: CalendarDays, hint: 'Any dates inside July' },
  { kind: 'season', label: 'A season', icon: Wind, hint: 'Any dates that season' },
  { kind: 'weekends', label: 'Weekends only', icon: CalendarDays, hint: 'Fri–Sun within range' },
];

export function DateFlexPicker({
  value,
  onChange,
  minDurationDays,
  maxDurationDays,
  onDurationChange,
}: {
  value: DateFlexIntent | undefined;
  onChange: (v: DateFlexIntent) => void;
  minDurationDays?: number;
  maxDurationDays?: number;
  onDurationChange?: (min: number | undefined, max: number | undefined) => void;
}) {
  const [mode, setMode] = useState<Mode>(value?.kind ?? 'exact');

  function setKind(k: Mode) {
    setMode(k);
    // initialize sane defaults for each mode
    const today = new Date();
    const plus30 = new Date(today.getTime() + 30 * 86400000);
    const plus37 = new Date(today.getTime() + 37 * 86400000);
    const iso = (d: Date) => d.toISOString().split('T')[0];

    switch (k) {
      case 'exact':
        onChange({ kind: 'exact', departDate: iso(plus30), returnDate: iso(plus37) });
        break;
      case 'range':
        onChange({ kind: 'range', from: iso(plus30), to: iso(plus37) });
        break;
      case 'month':
        onChange({ kind: 'month', month: iso(plus30).slice(0, 7) });
        break;
      case 'season':
        onChange({
          kind: 'season',
          year: today.getFullYear() + (today.getMonth() >= 9 ? 1 : 0),
          season: inferNextSeason(today),
        });
        break;
      case 'weekends':
        onChange({ kind: 'weekends', from: iso(plus30), to: iso(new Date(today.getTime() + 60 * 86400000)) });
        break;
    }
  }

  return (
    <div>
      {/* Mode pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = mode === m.kind;
          return (
            <button
              key={m.kind}
              type="button"
              onClick={() => setKind(m.kind)}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-caption transition ${
                active
                  ? 'bg-ink-700 text-pen-1 border border-line-2'
                  : 'bg-ink-800 text-pen-2 border border-line-1 hover:border-line-2 hover:text-pen-1'
              }`}
              aria-pressed={active}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={1.8} />
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Active mode fields */}
      <div className="grid gap-3 md:grid-cols-2">
        {mode === 'exact' && value?.kind === 'exact' && (
          <>
            <Field label="Depart">
              <input
                type="date"
                value={value.departDate}
                onChange={(e) => onChange({ ...value, departDate: e.target.value })}
                className="glass-input"
              />
            </Field>
            <Field label="Return">
              <input
                type="date"
                value={value.returnDate ?? ''}
                onChange={(e) => onChange({ ...value, returnDate: e.target.value })}
                className="glass-input"
              />
            </Field>
          </>
        )}

        {mode === 'range' && value?.kind === 'range' && (
          <>
            <Field label="Any time from">
              <input
                type="date"
                value={value.from}
                onChange={(e) => onChange({ ...value, from: e.target.value })}
                className="glass-input"
              />
            </Field>
            <Field label="Until">
              <input
                type="date"
                value={value.to}
                onChange={(e) => onChange({ ...value, to: e.target.value })}
                className="glass-input"
              />
            </Field>
          </>
        )}

        {mode === 'month' && value?.kind === 'month' && (
          <Field label="Month" className="md:col-span-2">
            <input
              type="month"
              value={value.month}
              onChange={(e) => onChange({ ...value, month: e.target.value })}
              className="glass-input"
            />
          </Field>
        )}

        {mode === 'season' && value?.kind === 'season' && (
          <>
            <Field label="Season">
              <select
                value={value.season}
                onChange={(e) =>
                  onChange({ ...value, season: e.target.value as DateFlexIntent extends { kind: 'season' } ? any : any })
                }
                className="glass-input"
              >
                <option value="spring">Spring</option>
                <option value="summer">Summer</option>
                <option value="autumn">Autumn</option>
                <option value="winter">Winter</option>
              </select>
            </Field>
            <Field label="Year">
              <input
                type="number"
                min={new Date().getFullYear()}
                max={new Date().getFullYear() + 2}
                value={value.year}
                onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
                className="glass-input"
              />
            </Field>
          </>
        )}

        {mode === 'weekends' && value?.kind === 'weekends' && (
          <>
            <Field label="Between">
              <input
                type="date"
                value={value.from}
                onChange={(e) => onChange({ ...value, from: e.target.value })}
                className="glass-input"
              />
            </Field>
            <Field label="And">
              <input
                type="date"
                value={value.to}
                onChange={(e) => onChange({ ...value, to: e.target.value })}
                className="glass-input"
              />
            </Field>
          </>
        )}
      </div>

      {/* Duration — relevant for flex modes */}
      {onDurationChange && mode !== 'exact' && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="Stay at least">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={60}
                value={minDurationDays ?? ''}
                onChange={(e) => onDurationChange(e.target.value ? Number(e.target.value) : undefined, maxDurationDays)}
                className="glass-input"
                placeholder="3"
              />
              <span className="text-caption text-pen-3">days</span>
            </div>
          </Field>
          <Field label="And at most">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={90}
                value={maxDurationDays ?? ''}
                onChange={(e) => onDurationChange(minDurationDays, e.target.value ? Number(e.target.value) : undefined)}
                className="glass-input"
                placeholder="7"
              />
              <span className="text-caption text-pen-3">days</span>
            </div>
          </Field>
        </div>
      )}

      {/* Current mode hint */}
      <p className="mt-3 text-caption text-pen-3">
        {MODES.find((m) => m.kind === mode)?.hint}
      </p>
    </div>
  );
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-micro uppercase text-pen-3 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function inferNextSeason(now: Date): 'spring' | 'summer' | 'autumn' | 'winter' {
  const m = now.getMonth();
  if (m >= 2 && m <= 4) return 'summer';
  if (m >= 5 && m <= 7) return 'autumn';
  if (m >= 8 && m <= 10) return 'winter';
  return 'spring';
}
