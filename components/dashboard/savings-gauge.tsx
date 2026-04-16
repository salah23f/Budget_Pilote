'use client';

import { useEffect, useState } from 'react';
import { PriceDisplay } from '@/components/ui/price-display';

/**
 * Savings gauge — semicircular SVG meter showing lifetime savings.
 * Arc fills smoothly when component mounts. Dial needle glows.
 */
export function SavingsGauge({
  totalSavedUsd,
  thisMonthUsd = 0,
  size = 220,
}: {
  totalSavedUsd: number;
  thisMonthUsd?: number;
  size?: number;
}) {
  const [progress, setProgress] = useState(0);

  // Tiers: 0 → $50 → $250 → $1000 → $5000+
  const tiers = [0, 50, 250, 1000, 5000];
  const tierLabels = ['Rookie', 'Saver', 'Hunter', 'Pro', 'Master'];
  let tierIndex = 0;
  for (let i = 1; i < tiers.length; i++) {
    if (totalSavedUsd >= tiers[i]) tierIndex = i;
  }
  const currentTier = tiers[tierIndex];
  const nextTier = tiers[tierIndex + 1] ?? tiers[tierIndex];
  const tierProgress =
    nextTier === currentTier
      ? 1
      : Math.min(1, (totalSavedUsd - currentTier) / (nextTier - currentTier));

  // Target = tier progress (0-1)
  const target = tierProgress;

  // Animate progress on mount
  useEffect(() => {
    const t0 = performance.now();
    const duration = 1200;
    let raf: number;
    function tick(t: number) {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setProgress(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  const cx = size / 2;
  const cy = size / 2 + 10;
  const r = size / 2 - 20;

  // Semicircle from 180deg to 360deg (top half)
  // Start point: left (cx - r, cy). End: right (cx + r, cy)
  const start = { x: cx - r, y: cy };
  const end = { x: cx + r, y: cy };

  // Current progress end point along arc
  const angle = Math.PI * (1 - progress); // from PI to 0
  const px = cx + r * Math.cos(Math.PI - angle + Math.PI);
  const py = cy + r * Math.sin(Math.PI - angle + Math.PI);

  // Simpler: arc point at progress p (0→1): start at left going clockwise
  const progressAngle = Math.PI + Math.PI * progress; // PI (left) → 2PI (right)
  const endX = cx + r * Math.cos(progressAngle);
  const endY = cy + r * Math.sin(progressAngle);

  return (
    <div className="relative" style={{ width: size, height: size * 0.75 }}>
      <svg
        width={size}
        height={size * 0.75}
        viewBox={`0 0 ${size} ${size * 0.75}`}
        className="block"
      >
        <defs>
          <linearGradient id="gaugeBg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
          </linearGradient>
          <linearGradient id="gaugeFill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#E8A317" />
            <stop offset="50%" stopColor="#F97316" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <filter id="gaugeGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background arc */}
        <path
          d={`M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`}
          stroke="url(#gaugeBg)"
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
        />

        {/* Tick marks */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const tickAngle = Math.PI + Math.PI * t;
          const innerR = r - 4;
          const outerR = r + 4;
          const x1 = cx + innerR * Math.cos(tickAngle);
          const y1 = cy + innerR * Math.sin(tickAngle);
          const x2 = cx + outerR * Math.cos(tickAngle);
          const y2 = cy + outerR * Math.sin(tickAngle);
          return (
            <line
              key={t}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="1"
            />
          );
        })}

        {/* Progress arc */}
        {progress > 0.005 && (
          <path
            d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${progress > 0.5 ? 1 : 0} 1 ${endX} ${endY}`}
            stroke="url(#gaugeFill)"
            strokeWidth="12"
            fill="none"
            strokeLinecap="round"
            filter="url(#gaugeGlow)"
          />
        )}

        {/* Needle dot */}
        {progress > 0.005 && (
          <circle
            cx={endX}
            cy={endY}
            r="7"
            fill="#E8A317"
            stroke="#09090B"
            strokeWidth="2"
            filter="url(#gaugeGlow)"
          />
        )}
      </svg>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pointer-events-none">
        <p className="text-[9px] uppercase tracking-[0.2em] text-white/30 font-medium">
          Total saved
        </p>
        <div className="mt-1">
          <PriceDisplay usd={totalSavedUsd} size="2xl" color="#E8A317" />
        </div>
        <p className="text-[10px] text-white/40 mt-1">
          Tier: <span className="text-[#E8A317] font-semibold">{tierLabels[tierIndex]}</span>
          {nextTier !== currentTier && (
            <span className="text-white/30">
              {' '}
              · ${Math.ceil(nextTier - totalSavedUsd)} to {tierLabels[tierIndex + 1]}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
