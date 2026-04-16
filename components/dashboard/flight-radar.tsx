'use client';

import { useEffect, useState } from 'react';

/**
 * Flight radar — animated SVG showing live price monitoring activity.
 * Purely decorative but builds the "AI is working" sensation.
 * Concentric rings with a sweeping scan line + blip dots that pulse when scan hits them.
 */
export function FlightRadar({
  activeMissions = 0,
  size = 220,
}: {
  activeMissions?: number;
  size?: number;
}) {
  const [scanAngle, setScanAngle] = useState(0);

  useEffect(() => {
    let raf: number;
    let start: number | null = null;
    function tick(t: number) {
      if (start === null) start = t;
      const elapsed = t - start;
      // Full rotation every 4s
      setScanAngle((elapsed / 4000) * 360 % 360);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Pseudo-random blips positions — stable per render
  const blips = [
    { angle: 30, radius: 0.55, id: 'b1' },
    { angle: 110, radius: 0.72, id: 'b2' },
    { angle: 180, radius: 0.45, id: 'b3' },
    { angle: 240, radius: 0.68, id: 'b4' },
    { angle: 310, radius: 0.5, id: 'b5' },
  ];

  const center = size / 2;
  const radius = size / 2 - 6;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="block"
      >
        <defs>
          <radialGradient id="radarBg" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="rgba(232,163,23,0.05)" />
            <stop offset="100%" stopColor="rgba(232,163,23,0)" />
          </radialGradient>
          <linearGradient
            id="scanGradient"
            gradientUnits="userSpaceOnUse"
            x1={center}
            y1={center}
            x2={center + radius}
            y2={center}
          >
            <stop offset="0%" stopColor="rgba(232,163,23,0.5)" />
            <stop offset="70%" stopColor="rgba(232,163,23,0.15)" />
            <stop offset="100%" stopColor="rgba(232,163,23,0)" />
          </linearGradient>
        </defs>

        {/* Background disc */}
        <circle cx={center} cy={center} r={radius} fill="url(#radarBg)" />

        {/* Concentric rings */}
        {[0.25, 0.5, 0.75, 1].map((r) => (
          <circle
            key={r}
            cx={center}
            cy={center}
            r={radius * r}
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
          />
        ))}

        {/* Crosshair lines */}
        <line
          x1={center - radius}
          y1={center}
          x2={center + radius}
          y2={center}
          stroke="rgba(255,255,255,0.03)"
          strokeWidth="1"
        />
        <line
          x1={center}
          y1={center - radius}
          x2={center}
          y2={center + radius}
          stroke="rgba(255,255,255,0.03)"
          strokeWidth="1"
        />

        {/* Sweep cone (rotating) */}
        <g transform={`rotate(${scanAngle}, ${center}, ${center})`}>
          <path
            d={`M ${center} ${center} L ${center + radius} ${center} A ${radius} ${radius} 0 0 0 ${center + radius * Math.cos(-0.6)} ${center + radius * Math.sin(-0.6)} Z`}
            fill="url(#scanGradient)"
            opacity="0.55"
          />
          <line
            x1={center}
            y1={center}
            x2={center + radius}
            y2={center}
            stroke="rgba(232,163,23,0.65)"
            strokeWidth="1.5"
          />
        </g>

        {/* Blips (active missions) */}
        {blips.slice(0, Math.max(1, activeMissions || 3)).map((b) => {
          const rad = (b.angle * Math.PI) / 180;
          const bx = center + Math.cos(rad) * radius * b.radius;
          const by = center + Math.sin(rad) * radius * b.radius;
          // Pulse intensity based on distance from scan line
          const diff = Math.abs(((scanAngle - b.angle + 360) % 360));
          const near = diff < 30 || diff > 330 ? 1 : 0.35;
          return (
            <g key={b.id}>
              <circle cx={bx} cy={by} r={4 * near + 2} fill="rgba(232,163,23,0.2)" />
              <circle cx={bx} cy={by} r={2} fill="#D4A24C" opacity={0.6 + 0.4 * near} />
            </g>
          );
        })}

        {/* Center pulse */}
        <circle cx={center} cy={center} r="3" fill="#D4A24C" />
        <circle cx={center} cy={center} r="3" fill="none" stroke="rgba(232,163,23,0.4)" strokeWidth="1">
          <animate attributeName="r" from="3" to="12" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.6" to="0" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>

      {/* Overlay label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-center">
          <p className="text-[9px] uppercase tracking-[0.2em] text-white/30 font-medium">
            Live monitoring
          </p>
          <p className="text-2xl font-bold text-white mt-1 tabular-nums">{activeMissions || 0}</p>
          <p className="text-[10px] text-white/40 -mt-0.5">
            {activeMissions === 1 ? 'mission' : 'missions'}
          </p>
        </div>
      </div>
    </div>
  );
}
