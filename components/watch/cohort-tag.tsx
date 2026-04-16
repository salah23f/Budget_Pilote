'use client';

import type { Cohort } from '@/lib/algorithm';
import { Sparkles, TrendingDown, Shield, UserCheck, MoveHorizontal } from 'lucide-react';

/**
 * Small pill that tags a recommendation's cohort.
 * Max one per card visually; if multiple, prefer SMARTEST > BEST_FIT > SAFEST > CHEAPEST.
 */

const META: Record<Cohort, { label: string; icon: typeof Sparkles; classes: string }> = {
  SMARTEST:        { label: 'Smartest',  icon: Sparkles,      classes: 'bg-accent-soft text-accent' },
  CHEAPEST:        { label: 'Cheapest',  icon: TrendingDown,  classes: 'bg-success-soft text-success' },
  SAFEST:          { label: 'Safest',    icon: Shield,        classes: 'bg-ink-700 text-pen-1' },
  BEST_FIT:        { label: 'Best for you', icon: UserCheck,  classes: 'bg-ink-700 text-pen-1' },
  WIDEN_TO_UNLOCK: { label: 'Widen to unlock', icon: MoveHorizontal, classes: 'bg-ink-700 text-pen-2' },
};

const PRIORITY: Cohort[] = ['SMARTEST', 'BEST_FIT', 'SAFEST', 'CHEAPEST', 'WIDEN_TO_UNLOCK'];

export function CohortTag({ cohorts, className = '' }: { cohorts: Cohort[]; className?: string }) {
  const primary = PRIORITY.find((c) => cohorts.includes(c));
  if (!primary) return null;
  const { label, icon: Icon, classes } = META[primary];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-micro uppercase font-semibold ${classes} ${className}`}
    >
      <Icon className="w-3 h-3" strokeWidth={2} />
      {label}
    </span>
  );
}
