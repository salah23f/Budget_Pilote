'use client';

/**
 * Mini sparkline SVG component for showing 7-day price trends on flight cards.
 * Pure SVG, no external dependencies.
 */

type SparklineProps = {
  /** Array of price values (e.g., last 7 days) */
  data: number[];
  /** SVG width */
  width?: number;
  /** SVG height */
  height?: number;
  /** Stroke color — auto-selects green (trending down) or red (trending up) */
  color?: string;
  /** Show a filled area under the line */
  filled?: boolean;
};

export function Sparkline({
  data,
  width = 48,
  height = 20,
  color,
  filled = true,
}: SparklineProps) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  // Build path points
  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * innerW;
    const y = padding + innerH - ((val - min) / range) * innerH;
    return { x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Area fill path
  const areaD = filled
    ? `${pathD} L${points[points.length - 1].x.toFixed(1)},${height - padding} L${points[0].x.toFixed(1)},${height - padding} Z`
    : '';

  // Auto-detect trend color
  const trendColor =
    color ||
    (data[data.length - 1] <= data[0] ? 'rgba(34,197,94,0.8)' : 'rgba(239,68,68,0.7)');

  const fillColor = data[data.length - 1] <= data[0]
    ? 'rgba(34,197,94,0.1)'
    : 'rgba(239,68,68,0.08)';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block align-middle"
      aria-hidden="true"
    >
      {filled && areaD && (
        <path d={areaD} fill={fillColor} />
      )}
      <path
        d={pathD}
        fill="none"
        stroke={trendColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Current price dot */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="1.5"
        fill={trendColor}
      />
    </svg>
  );
}

/**
 * Generate mock price trend data for demo purposes.
 * In production, this would come from historical price APIs.
 */
export function generatePriceTrend(currentPrice: number, days: number = 7): number[] {
  const trend: number[] = [];
  const volatility = currentPrice * 0.08; // 8% variation
  let price = currentPrice + (Math.random() - 0.4) * volatility;

  for (let i = 0; i < days - 1; i++) {
    trend.push(Math.round(price));
    price += (Math.random() - 0.5) * volatility * 0.6;
    price = Math.max(price, currentPrice * 0.7);
  }
  trend.push(currentPrice); // Last point is current price
  return trend;
}
