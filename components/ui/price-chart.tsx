'use client';

import React, { useMemo, useState, useRef, useCallback } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface PriceDataPoint {
  date: string;
  price: number;
}

export interface PriceChartProps {
  data: PriceDataPoint[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const PADDING = { top: 8, right: 8, bottom: 24, left: 8 };

function formatPrice(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toPrecision(4)}`;
}

function formatDate(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PriceChart({
  data,
  width = 400,
  height = 200,
  color = '#E8A317',
  className = '',
}: PriceChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    point: PriceDataPoint;
  } | null>(null);

  /* ---- derived geometry ---- */
  const chartW = width - PADDING.left - PADDING.right;
  const chartH = height - PADDING.top - PADDING.bottom;

  const { points, linePath, areaPath, minPrice, maxPrice } = useMemo(() => {
    if (data.length === 0)
      return { points: [], linePath: '', areaPath: '', minPrice: 0, maxPrice: 0 };

    const prices = data.map((d) => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    const pts = data.map((d, i) => ({
      x: PADDING.left + (i / (data.length - 1 || 1)) * chartW,
      y: PADDING.top + (1 - (d.price - min) / range) * chartH,
      ...d,
    }));

    const lineSegments = pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
      .join(' ');

    const area = [
      lineSegments,
      `L${pts[pts.length - 1].x},${PADDING.top + chartH}`,
      `L${pts[0].x},${PADDING.top + chartH}`,
      'Z',
    ].join(' ');

    return { points: pts, linePath: lineSegments, areaPath: area, minPrice: min, maxPrice: max };
  }, [data, chartW, chartH]);

  /* ---- mouse interaction ---- */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current || points.length === 0) return;
      const rect = svgRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;

      // Find nearest point
      let nearest = points[0];
      let nearestDist = Infinity;
      for (const p of points) {
        const dist = Math.abs(p.x - mouseX);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = p;
        }
      }

      setTooltip({ x: nearest.x, y: nearest.y, point: nearest });
    },
    [points],
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  if (data.length === 0) {
    return (
      <div
        className={`flex items-center justify-center text-sm text-white/40 ${className}`}
        style={{ width, height }}
      >
        No data
      </div>
    );
  }

  const gradientId = `bp-price-grad-${color.replace('#', '')}`;

  return (
    <div className={`relative select-none ${className}`} style={{ width, height }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path d={areaPath} fill={`url(#${gradientId})`} />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Hover crosshair */}
        {tooltip && (
          <>
            <line
              x1={tooltip.x}
              y1={PADDING.top}
              x2={tooltip.x}
              y2={PADDING.top + chartH}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle cx={tooltip.x} cy={tooltip.y} r="4" fill={color} stroke="#1C1917" strokeWidth="2" />
          </>
        )}

        {/* Bottom axis labels (first, middle, last) */}
        {data.length >= 2 && (
          <>
            <text
              x={PADDING.left}
              y={height - 4}
              fill="rgba(255,255,255,0.35)"
              fontSize="10"
              textAnchor="start"
            >
              {formatDate(data[0].date)}
            </text>
            <text
              x={width - PADDING.right}
              y={height - 4}
              fill="rgba(255,255,255,0.35)"
              fontSize="10"
              textAnchor="end"
            >
              {formatDate(data[data.length - 1].date)}
            </text>
          </>
        )}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 glass rounded-lg px-3 py-2 text-xs whitespace-nowrap -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y - 10 }}
        >
          <span className="text-white/60 mr-2">{formatDate(tooltip.point.date)}</span>
          <span className="font-semibold text-white">{formatPrice(tooltip.point.price)}</span>
        </div>
      )}
    </div>
  );
}
