'use client';

import type { FeasibilityAssessment } from '@/lib/algorithm';
import { PriceDisplay } from '@/components/ui/price-display';
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

/**
 * BudgetRealismNotice — inline, conversational warning when the user's budget
 * is unrealistic or tight. Lives next to the budget input, not as a modal.
 */
export function BudgetRealismNotice({
  assessment,
  className = '',
}: {
  assessment: FeasibilityAssessment;
  className?: string;
}) {
  const { verdict, baseline, budgetRealismScore, blockers } = assessment;

  if (!baseline) return null;

  // Only show for tight/unrealistic/impossible states
  if (verdict === 'easy' || verdict === 'likely') return null;

  const tone: 'warn' | 'block' | 'info' =
    verdict === 'impossible' ? 'block' : verdict === 'insufficient_data' ? 'info' : 'warn';

  const styles: Record<typeof tone, { border: string; bg: string; color: string; Icon: any }> = {
    warn: { border: 'border-accent/25', bg: 'bg-accent-soft', color: 'text-accent', Icon: AlertTriangle },
    block: { border: 'border-danger/30', bg: 'bg-danger-soft', color: 'text-danger', Icon: AlertTriangle },
    info: { border: 'border-line-2', bg: 'bg-ink-700', color: 'text-pen-2', Icon: Info },
  };
  const s = styles[tone];
  const { Icon } = s;

  const messages: Partial<Record<FeasibilityAssessment['verdict'], string>> = {
    tight:
      "Your budget is below typical but not impossible. The easiest wins are usually widening dates or including nearby airports.",
    unrealistic:
      "This target rarely appears for this route. Consider raising the budget or accepting one stop — we'll show you the exact trade-off.",
    impossible:
      "Your budget is below anything this route has actually sold for in the last 180 days. We can't honestly watch for that.",
    insufficient_data:
      "We don't have enough history on this route yet. We'll still watch, but our price outlook will be cautious.",
  };

  const msg = messages[verdict];
  if (!msg) return null;

  return (
    <div
      className={`rounded-md border ${s.border} ${s.bg} px-4 py-3 flex items-start gap-3 ${className}`}
      role="alert"
    >
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${s.color}`} strokeWidth={1.8} />
      <div className="min-w-0">
        <p className={`text-body ${s.color === 'text-pen-2' ? 'text-pen-1' : s.color} font-medium`}>
          {tone === 'block' ? 'Under the floor' : tone === 'info' ? 'Low history' : 'Tight budget'}
        </p>
        <p className="text-caption text-pen-2 mt-1 leading-relaxed">{msg}</p>
        {baseline && (
          <p className="text-caption text-pen-3 mt-2 font-mono">
            P25 <PriceDisplay usd={baseline.p25} size="xs" className="!text-pen-2 font-mono" />{' '}
            · median <PriceDisplay usd={baseline.median} size="xs" className="!text-pen-1 font-mono" />{' '}
            · P75 <PriceDisplay usd={baseline.p75} size="xs" className="!text-pen-2 font-mono" />
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Inline "realism passed" confirmation — used once the user has a decent target.
 */
export function RealismOkChip({ assessment }: { assessment: FeasibilityAssessment }) {
  if (assessment.verdict !== 'easy' && assessment.verdict !== 'likely') return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 bg-success-soft text-success text-caption font-medium">
      <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} />
      {assessment.verdict === 'easy' ? 'Comfortable target' : 'Realistic target'}
    </span>
  );
}
