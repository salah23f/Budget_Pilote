'use client';

/**
 * World map — minimalist dotted SVG of continents with animated flight routes.
 * Not geographically perfect — it's a stylized visualization, like Apple's Activity rings.
 * Routes are great-circle arcs with animated planes.
 */

type Route = {
  from: { x: number; y: number; label: string };
  to: { x: number; y: number; label: string };
};

// Pre-computed 2D positions for popular cities (0-100 scale).
// Not geographically accurate — optimized for visual balance.
const CITY_POS: Record<string, { x: number; y: number }> = {
  Paris: { x: 49, y: 34 },
  London: { x: 47, y: 31 },
  'New York': { x: 27, y: 40 },
  Tokyo: { x: 83, y: 43 },
  Barcelona: { x: 48, y: 39 },
  Rome: { x: 52, y: 40 },
  Dubai: { x: 62, y: 47 },
  Bangkok: { x: 75, y: 56 },
  Bali: { x: 79, y: 66 },
  Sydney: { x: 86, y: 72 },
  Madrid: { x: 46, y: 40 },
  Berlin: { x: 52, y: 31 },
  Istanbul: { x: 56, y: 40 },
  Cairo: { x: 56, y: 46 },
  Mumbai: { x: 68, y: 52 },
  Singapore: { x: 77, y: 60 },
  Seoul: { x: 81, y: 43 },
  Shanghai: { x: 80, y: 46 },
  'Los Angeles': { x: 17, y: 44 },
  'San Francisco': { x: 16, y: 41 },
  'Mexico City': { x: 22, y: 52 },
  'Rio de Janeiro': { x: 34, y: 69 },
  'Buenos Aires': { x: 32, y: 76 },
  'Cape Town': { x: 54, y: 74 },
  Marrakech: { x: 45, y: 45 },
  Lisbon: { x: 45, y: 40 },
  Amsterdam: { x: 50, y: 30 },
  Vienna: { x: 53, y: 34 },
};

const DEFAULT_ROUTES: Route[] = [
  { from: { ...CITY_POS.Paris, label: 'Paris' }, to: { ...CITY_POS.Tokyo, label: 'Tokyo' } },
  { from: { ...CITY_POS['New York'], label: 'NYC' }, to: { ...CITY_POS.London, label: 'London' } },
  { from: { ...CITY_POS.Dubai, label: 'Dubai' }, to: { ...CITY_POS.Bali, label: 'Bali' } },
];

export function WorldMap({
  routes,
  className = '',
}: {
  routes?: Array<{ from: string; to: string }>;
  className?: string;
}) {
  // Resolve routes from city names
  const resolved: Route[] = routes
    ? routes
        .map((r) => {
          const fp = CITY_POS[r.from];
          const tp = CITY_POS[r.to];
          if (!fp || !tp) return null;
          return {
            from: { ...fp, label: r.from },
            to: { ...tp, label: r.to },
          };
        })
        .filter((r): r is Route => r !== null)
    : DEFAULT_ROUTES;

  const displayRoutes = resolved.length > 0 ? resolved : DEFAULT_ROUTES;

  return (
    <div className={`w-full ${className}`}>
      <svg
        viewBox="0 0 100 80"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="wmRoute" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(232,163,23,0)" />
            <stop offset="50%" stopColor="rgba(232,163,23,0.9)" />
            <stop offset="100%" stopColor="rgba(249,115,22,0)" />
          </linearGradient>
          <radialGradient id="wmPin" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#D4A24C" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#D4A24C" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Stylized continents as dotted patterns */}
        {/* North America */}
        {dotGrid(10, 35, 18, 20, 1.5).map((d, i) => (
          <circle key={`na-${i}`} cx={d.x} cy={d.y} r="0.4" fill="rgba(255,255,255,0.1)" />
        ))}
        {/* South America */}
        {dotGrid(27, 60, 10, 20, 1.5).map((d, i) => (
          <circle key={`sa-${i}`} cx={d.x} cy={d.y} r="0.4" fill="rgba(255,255,255,0.1)" />
        ))}
        {/* Europe */}
        {dotGrid(44, 28, 15, 15, 1.3).map((d, i) => (
          <circle key={`eu-${i}`} cx={d.x} cy={d.y} r="0.4" fill="rgba(255,255,255,0.1)" />
        ))}
        {/* Africa */}
        {dotGrid(48, 45, 15, 25, 1.5).map((d, i) => (
          <circle key={`af-${i}`} cx={d.x} cy={d.y} r="0.4" fill="rgba(255,255,255,0.1)" />
        ))}
        {/* Asia */}
        {dotGrid(60, 28, 30, 25, 1.5).map((d, i) => (
          <circle key={`as-${i}`} cx={d.x} cy={d.y} r="0.4" fill="rgba(255,255,255,0.1)" />
        ))}
        {/* Oceania */}
        {dotGrid(80, 65, 12, 10, 1.5).map((d, i) => (
          <circle key={`oc-${i}`} cx={d.x} cy={d.y} r="0.4" fill="rgba(255,255,255,0.1)" />
        ))}

        {/* Routes */}
        {displayRoutes.map((r, i) => {
          const midX = (r.from.x + r.to.x) / 2;
          const midY = (r.from.y + r.to.y) / 2 - Math.abs(r.to.x - r.from.x) * 0.25;
          const path = `M ${r.from.x} ${r.from.y} Q ${midX} ${midY} ${r.to.x} ${r.to.y}`;
          return (
            <g key={i}>
              {/* Dotted background route */}
              <path
                d={path}
                fill="none"
                stroke="rgba(232,163,23,0.15)"
                strokeWidth="0.3"
                strokeDasharray="0.8 0.8"
              />
              {/* Animated highlight */}
              <path
                d={path}
                fill="none"
                stroke="url(#wmRoute)"
                strokeWidth="0.7"
                strokeLinecap="round"
                strokeDasharray="5 95"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="100"
                  to="0"
                  dur={`${3 + i * 0.5}s`}
                  repeatCount="indefinite"
                />
              </path>
              {/* Endpoints */}
              <circle cx={r.from.x} cy={r.from.y} r="2" fill="url(#wmPin)" />
              <circle cx={r.from.x} cy={r.from.y} r="0.8" fill="#D4A24C" />
              <circle cx={r.to.x} cy={r.to.y} r="2" fill="url(#wmPin)" />
              <circle cx={r.to.x} cy={r.to.y} r="0.8" fill="#DFAE5B" />
              {/* Labels */}
              <text
                x={r.from.x}
                y={r.from.y - 2}
                textAnchor="middle"
                fontSize="2"
                fill="rgba(255,255,255,0.4)"
                fontFamily="inherit"
              >
                {r.from.label}
              </text>
              <text
                x={r.to.x}
                y={r.to.y - 2}
                textAnchor="middle"
                fontSize="2"
                fill="rgba(255,255,255,0.4)"
                fontFamily="inherit"
              >
                {r.to.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function dotGrid(x: number, y: number, w: number, h: number, step = 1.5): Array<{ x: number; y: number }> {
  const dots: Array<{ x: number; y: number }> = [];
  for (let i = x; i < x + w; i += step) {
    for (let j = y; j < y + h; j += step) {
      // Random sparse pattern — create continent-like shapes
      if (Math.sin(i * 0.3) + Math.cos(j * 0.4) > -0.3) {
        dots.push({ x: i, y: j });
      }
    }
  }
  return dots;
}
