'use client';

/**
 * Price Calendar Heatmap — the Hopper feature.
 *
 * Renders a month grid where each day is colored green (cheap),
 * yellow (average), or red (expensive) based on its price relative
 * to the month's min/max. Users can click any day to select it as
 * their departure date.
 *
 * Props:
 *   - prices: Record<string, number> — "YYYY-MM-DD" → cheapest price
 *   - selectedDate: string — currently selected date
 *   - onDateSelect: (date: string) => void
 *   - loading: boolean
 *   - month: string — "YYYY-MM" for the displayed month
 *   - onMonthChange: (month: string) => void
 */

import { useMemo } from 'react';

interface PriceCalendarProps {
  prices: Record<string, number>;
  selectedDate?: string;
  onDateSelect?: (date: string) => void;
  loading?: boolean;
  month: string; // "YYYY-MM"
  onMonthChange?: (month: string) => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getMonthDays(yearMonth: string): Array<{ date: string; day: number; inMonth: boolean }> {
  const [year, month] = yearMonth.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();

  // Monday = 0, Sunday = 6 (ISO week)
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const cells: Array<{ date: string; day: number; inMonth: boolean }> = [];

  // Leading empty cells
  for (let i = 0; i < startDow; i++) {
    cells.push({ date: '', day: 0, inMonth: false });
  }

  // Days of the month
  for (let d = 1; d <= daysInMonth; d++) {
    const pad = String(d).padStart(2, '0');
    const mPad = String(month).padStart(2, '0');
    cells.push({ date: `${year}-${mPad}-${pad}`, day: d, inMonth: true });
  }

  return cells;
}

function prevMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function PriceCalendar({
  prices,
  selectedDate,
  onDateSelect,
  loading,
  month,
  onMonthChange,
}: PriceCalendarProps) {
  const cells = useMemo(() => getMonthDays(month), [month]);

  // Compute price quartiles for color mapping
  const priceValues = useMemo(() => {
    const vals = Object.values(prices).filter((p) => p > 0);
    if (vals.length === 0) return { min: 0, max: 0, p25: 0, p75: 0 };
    vals.sort((a, b) => a - b);
    return {
      min: vals[0],
      max: vals[vals.length - 1],
      p25: vals[Math.floor(vals.length * 0.25)] || vals[0],
      p75: vals[Math.floor(vals.length * 0.75)] || vals[vals.length - 1],
    };
  }, [prices]);

  function priceColor(price: number | undefined): {
    bg: string;
    text: string;
    label: string;
  } {
    if (!price || price <= 0) return { bg: 'var(--ink-900)', text: 'text-pen-3', label: '' };
    if (price <= priceValues.p25) return { bg: 'var(--success-soft)', text: 'text-success', label: 'cheap' };
    if (price <= priceValues.p75) return { bg: 'var(--warning-soft)', text: 'text-warning', label: 'average' };
    return { bg: 'var(--danger-soft)', text: 'text-danger', label: 'expensive' };
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <div>
      {/* Month navigator */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => onMonthChange?.(prevMonth(month))}
          className="p-2 rounded-md hover:bg-ink-600 transition text-pen-3 hover:text-pen-1 focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M10 4l-4 4 4 4" />
          </svg>
        </button>
        <h3 className="text-sm font-semibold text-pen-1">{monthLabel(month)}</h3>
        <button
          type="button"
          onClick={() => onMonthChange?.(nextMonth(month))}
          className="p-2 rounded-md hover:bg-ink-600 transition text-pen-3 hover:text-pen-1 focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 4l4 4-4 4" />
          </svg>
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mb-4 text-[10px]">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded" style={{ background: 'var(--success)' }} />
          <span className="text-pen-3">Cheap</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded" style={{ background: 'var(--warning)' }} />
          <span className="text-pen-3">Average</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded" style={{ background: 'var(--danger)' }} />
          <span className="text-pen-3">Expensive</span>
        </span>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[10px] text-pen-3 font-medium py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }, (_, i) => (
            <div key={i} className="aspect-square rounded-md bg-ink-600 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            if (!cell.inMonth) {
              return <div key={`empty-${i}`} className="aspect-square" />;
            }

            const price = prices[cell.date];
            const color = priceColor(price);
            const isPast = cell.date < today;
            const isSelected = cell.date === selectedDate;

            return (
              <button
                key={cell.date}
                type="button"
                disabled={isPast || !price}
                onClick={() => onDateSelect?.(cell.date)}
                className={`aspect-square rounded-md flex flex-col items-center justify-center transition-all relative focus-visible:ring-2 focus-visible:ring-accent/50 ${
                  isPast ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:scale-105'
                } ${isSelected ? 'ring-2 ring-accent ring-offset-1 ring-offset-[var(--ink-950)]' : ''}`}
                style={{ background: color.bg }}
                title={price ? `$${price} — ${color.label}` : 'No data'}
              >
                <span className={`text-xs font-medium num ${price ? color.text : 'text-pen-3'}`}>
                  {cell.day}
                </span>
                {price ? (
                  <span className={`text-[9px] font-semibold num ${color.text}`}>
                    ${price}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {/* Price range summary */}
      {priceValues.min > 0 && (
        <div className="mt-3 flex items-center justify-between text-[10px] text-pen-3 px-1">
          <span>Cheapest: <span className="text-success font-semibold num">${priceValues.min}</span></span>
          <span>Most expensive: <span className="text-danger font-semibold num">${priceValues.max}</span></span>
        </div>
      )}
    </div>
  );
}
