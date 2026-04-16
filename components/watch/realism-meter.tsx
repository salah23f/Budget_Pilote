'use client';

import { useMemo } from 'react';
import type { FeasibilityAssessment } from '@/lib/algorithm';
import { verdictCopy } from '@/lib/algorithm';
import { PriceDisplay } from '@/components/ui/price-display';

/**
 * RealismMeter — the trust-building component.
 *
 * Shows the typical price distribution for the route against the user's
 * target, with a non-clickable percentile band. This is the "don't let me
 * overpay / don't let me set an impossible target" visualization.
 *
 * Calm, honest, specific. No emojis. No exclamation marks.
 */
export function RealismMeter({
  assessment,
  targetUsd,
  className = '',
}: {
  assessment: FeasibilityAssessment;
  targetUsd?: number;
  className?: string;
}) {
  const verdict = verdictCopy(assessment.verdict);
  const baseline = assessment.baseline;

  // Position of target on the p5..p95 band (0..1). Used for the marker.
  const markerPct = useMemo(() => {
    if (!baseline || targetUsd == null) return null;
    const span = baseline.p95 - baseline.p5;
    if (span <= 0) return null;
    const t = (targetUsd - baseline.p5) / span;
    return Math.max(0, Math.min(1, t));
  }, [baseline, targetUsd]);

  const toneClasses: Record<typeof verdict.tone, { pill: string; text: string }> = {
    positive: { pill: 'bg-success-soft text-success', text: 'text-success' },
    warn: { pill: 'bg-accent-soft text-accent', text: 'text-accent' },
    block: { pill: 'bg-danger-soft text-danger', text: 'text-danger' },
    info: { pill: 'bg-ink-700 text-pen-2', text: 'text-pen-2' },
    neutral: { pill: 'bg-ink-700 text-pen-2', text: 'text-pen-2' },
  };
  const t = toneClasses[verdict.tone];

  return (
    <div
      className={`rounded-lg border border-line-1 bg-ink-800 p-6 ${className}`}
      role="region"
      aria-label="Realism assessment"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-3">
        <div>
          <p className="text-micro uppercase text-pen-3">Realism</p>
          <p className={`editorial text-h2 mt-1 ${t.text}`}>{verdict.title}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-sm text-caption font-medium ${t.pill}`}>
          {Math.round(assessment.feasibilityScore * 100)}% feasible
        </span>
      </div>

      <p className="text-body text-pen-2 leading-relaxed mb-5">{verdict.body}</p>

      {/* Price distribution band */}
      {baseline ? (
        <div className="mb-5">
          <div className="flex items-baseline justify-between text-caption text-pen-3 font-mono mb-2">
            <span>
              <PriceDisplay usd={baseline.p5} size="xs" className="font-mono !text-pen-3" />
            </span>
            <span className="text-pen-2">
              Typical <PriceDisplay usd={baseline.median} size="sm" className="!text-pen-1" />
            </span>
            <span>
              <PriceDisplay usd={baseline.p95} size="xs" className="font-mono !text-pen-3" />
            </span>
          </div>

          {/* The band itself */}
          <div className="relative h-2 rounded-full bg-ink-700">
            {/* P25..P75 — the common zone */}
            <div
              className="absolute top-0 bottom-0 rounded-full bg-line-3"
              style={{
                left: `${pctOf(baseline, baseline.p25) * 100}%`,
                width: `${(pctOf(baseline, baseline.p75) - pctOf(baseline, baseline.p25)) * 100}%`,
              }}
            />
            {/* Median tick */}
            <div
              className="absolute top-0 bottom-0 w-px bg-pen-2"
              style={{ left: `${pctOf(baseline, baseline.median) * 100}%` }}
            />
            {/* Target marker */}
            {markerPct != null && (
              <div
                className="absolute -top-1 -bottom-1 w-1 rounded-full bg-accent"
                style={{
                  left: `calc(${markerPct * 100}% - 2px)`,
                  boxShadow: '0 0 0 2px var(--ink-800)',
                }}
                aria-label="Your target"
              />
            )}
          </div>

          {targetUsd != null && (
            <p className="mt-2 text-caption text-pen-3">
              Your target:{' '}
              <span className="font-mono text-pen-1">
                <PriceDisplay usd={targetUsd} size="xs" className="!text-pen-1 font-mono" />
              </span>
              {baseline.median > 0 && (
                <span className="ml-2 text-pen-3">
                  ·{' '}
                  {targetUsd < baseline.median
                    ? `${Math.round(((baseline.median - targetUsd) / baseline.median) * 100)}% below typical`
                    : `${Math.round(((targetUsd - baseline.median) / baseline.median) * 100)}% above typical`}
                </span>
              )}
            </p>
          )}
        </div>
      ) : null}

      {/* Suggestions — the "widen" levers */}
      {assessment.suggestions.length > 0 && (
        <div className="mt-5 pt-5 border-t border-line-1">
          <p className="text-micro uppercase text-pen-3 mb-3">How to lift realism</p>
          <ul className="space-y-2">
            {assessment.suggestions.map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-3">
                <span className="text-body text-pen-1">{s.description}</span>
                <span className="text-caption text-accent font-mono shrink-0">
                  +{Math.round(s.expectedFeasibilityGain * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Confidence footer */}
      {baseline && (
        <div className="mt-5 pt-5 border-t border-line-1 flex items-center justify-between text-caption text-pen-3">
          <span>Based on {baseline.dataPoints} historical fares</span>
          <span>
            Updated{' '}
            {baseline.ageDays === 0 ? 'today' : `${baseline.ageDays}d ago`}
          </span>
        </div>
      )}
    </div>
  );
}

function pctOf(b: { p5: number; p95: number }, value: number): number {
  const span = b.p95 - b.p5;
  if (span <= 0) return 0.5;
  return Math.max(0, Math.min(1, (value - b.p5) / span));
}
