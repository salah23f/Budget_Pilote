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
    if (!price || price <= 0) return { bg: 'rgba(255,255,255,0.02)', text: 'text-white/20', label: '' };
    if (price <= priceValues.p25) return { bg: 'rgba(16,185,129,0.15)', text: 'text-emerald-300', label: 'cheap' };
    if (price <= priceValues.p75) return { bg: 'rgba(245,158,11,0.12)', text: 'text-amber-300', label: 'average' };
    return { bg: 'rgba(239,68,68,0.12)', text: 'text-red-300', label: 'expensive' };
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <div>
      {/* Month navigator */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => onMonthChange?.(prevMonth(month))}
          className="p-2 rounded-lg hover:bg-white/5 transition text-white/50 hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M10 4l-4 4 4 4" />
          </svg>
        </button>
        <h3 className="text-sm font-semibold text-white">{monthLabel(month)}</h3>
        <button
          type="button"
          onClick={() => onMonthChange?.(nextMonth(month))}
          className="p-2 rounded-lg hover:bg-white/5 transition text-white/50 hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 4l4 4-4 4" />
          </svg>
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mb-4 text-[10px]">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded" style={{ background: 'rgba(16,185,129,0.4)' }} />
          <span className="text-white/40">Cheap</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded" style={{ background: 'rgba(245,158,11,0.35)' }} />
          <span className="text-white/40">Average</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded" style={{ background: 'rgba(239,68,68,0.35)' }} />
          <span className="text-white/40">Expensive</span>
        </span>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[10px] text-white/30 font-medium py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }, (_, i) => (
            <div key={i} className="aspect-square rounded-lg bg-white/[0.03] animate-pulse" />
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
                className={`aspect-square rounded-lg flex flex-col items-center justify-center transition-all relative ${
                  isPast ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:scale-105'
                } ${isSelected ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-[#0c0a09]' : ''}`}
                style={{ background: color.bg }}
                title={price ? `$${price} — ${color.label}` : 'No data'}
              >
                <span className={`text-xs font-medium ${price ? color.text : 'text-white/20'}`}>
                  {cell.day}
                </span>
                {price ? (
                  <span className={`text-[9px] font-semibold ${color.text}`}>
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
        <div className="mt-3 flex items-center justify-between text-[10px] text-white/30 px-1">
          <span>Cheapest: <span className="text-emerald-300 font-semibold">${priceValues.min}</span></span>
          <span>Most expensive: <span className="text-red-300 font-semibold">${priceValues.max}</span></span>
        </div>
      )}
    </div>
  );
}
