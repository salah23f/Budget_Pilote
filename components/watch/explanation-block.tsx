'use client';

import type { Explanation } from '@/lib/algorithm';
import { CohortTag } from './cohort-tag';

/**
 * Renders an offer's Explanation — the "why this is shown" block on each
 * recommendation card. Headline + up to 4 evidence chips + up to 3 caveats.
 */
export function ExplanationBlock({
  explanation,
  className = '',
}: {
  explanation: Explanation;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-body text-pen-1 font-medium leading-snug">{explanation.headline}</p>
        <CohortTag cohorts={[explanation.cohort]} />
      </div>

      {explanation.evidence.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {explanation.evidence.map((ev, i) => (
            <li
              key={i}
              className="inline-flex items-center rounded-sm px-2 py-0.5 text-caption bg-ink-700 text-pen-2"
            >
              {ev}
            </li>
          ))}
        </ul>
      )}

      {explanation.caveats.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {explanation.caveats.map((cv, i) => (
            <li
              key={i}
              className="inline-flex items-center gap-1 text-caption text-pen-3"
            >
              <span className="w-1 h-1 rounded-full bg-pen-3" aria-hidden="true" />
              {cv}
            </li>
          ))}
        </ul>
      )}

      {explanation.confidence < 0.3 && (
        <p className="text-caption text-pen-3 italic">
          Low history — early estimate
        </p>
      )}
    </div>
  );
}
