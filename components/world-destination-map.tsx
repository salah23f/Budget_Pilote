'use client';

import { useMemo } from 'react';
import {
  WORLD_LAND_PATH,
  WORLD_MAP_VIEWBOX,
  projectToViewboxPercent,
} from '@/lib/geo/world-land-path';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export interface MapDestination {
  city: string;
  country: string;
  /** Decimal degrees, WGS84. */
  lat: number;
  lon: number;
}

interface WorldDestinationMapProps {
  destinations: readonly MapDestination[];
  /** City names currently selected — matches `MapDestination.city`. */
  selected: readonly string[];
  onToggle: (city: string) => void;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Pin geometry — constant in px so touch targets survive any width    */
/* ------------------------------------------------------------------ */

const RING = '0 0 0 2px var(--ink-900)';
const RING_WITH_HALO = '0 0 0 2px var(--ink-900), 0 0 0 7px var(--accent-soft)';

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

/**
 * World map with clickable destination pins.
 *
 * Self-contained: the land outline is static SVG geometry bundled with the
 * app (Natural Earth 110m, public domain) — no tile server, no API key, no
 * network request. Pins are real <button>s laid over the SVG so they focus,
 * announce and respond like any other control.
 */
export function WorldDestinationMap({
  destinations,
  selected,
  onToggle,
  className = '',
}: WorldDestinationMapProps) {
  const { x, y, width, height } = WORLD_MAP_VIEWBOX;
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  return (
    <div className={`rounded-lg border border-line-1 bg-ink-900 p-3 sm:p-4 ${className}`}>
      <div className="relative w-full" style={{ aspectRatio: `${width} / ${height}` }}>
        {/* Land — decorative, the pins carry the meaning */}
        <svg
          viewBox={`${x} ${y} ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d={WORLD_LAND_PATH}
            className="fill-line-2 stroke-line-3"
            strokeWidth={0.75}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Destination pins */}
        <div role="group" aria-label="Dream destinations on the world map">
          {destinations.map((d) => {
            const isSelected = selectedSet.has(d.city);
            const { left, top } = projectToViewboxPercent(d.lon, d.lat);

            return (
              <button
                key={d.city}
                type="button"
                onClick={() => onToggle(d.city)}
                aria-pressed={isSelected}
                aria-label={`${d.city}, ${d.country}`}
                className={`group absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full hover:z-20 focus-visible:z-20 sm:h-7 sm:w-7 ${
                  isSelected ? 'z-10' : ''
                }`}
                style={{ left: `${left}%`, top: `${top}%` }}
              >
                {/* Dot */}
                <span
                  aria-hidden="true"
                  className={`block rounded-full transition-transform duration-default ease-default group-hover:scale-125 group-focus-visible:scale-125 ${
                    isSelected ? 'h-3 w-3 bg-accent' : 'h-2 w-2 bg-pen-3'
                  }`}
                  style={{ boxShadow: isSelected ? RING_WITH_HALO : RING }}
                />

                {/* Name — on hover / keyboard focus */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-sm border border-line-2 bg-ink-800 px-1.5 py-0.5 text-caption font-medium text-pen-1 opacity-0 shadow-elev-2 transition-opacity duration-default ease-default group-hover:opacity-100 group-focus-visible:opacity-100"
                >
                  {d.city}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default WorldDestinationMap;
