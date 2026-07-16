'use client';

import { ArrowLeft, ArrowRight } from 'lucide-react';

/**
 * Flow chrome — Airbnb-style.
 *
 * StepShell: kicker (phase), one H2 question, one optional trust line,
 * then a single input group. Nothing else competes for attention.
 *
 * FlowNav: segmented progress (one segment per phase, continuous fill
 * inside the segment) pinned to the bottom, Back as a ghost link,
 * Next as the only solid button on screen.
 */

export function StepShell({
  kicker,
  title,
  sub,
  children,
}: {
  kicker: string;
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[560px] pt-6 sm:pt-14">
      <p className="text-micro uppercase tracking-widest text-pen-3 mb-3">{kicker}</p>
      <h2 className="editorial text-[26px] sm:text-[32px] leading-tight text-pen-1">{title}</h2>
      {sub && <p className="text-body text-pen-2 mt-2.5 leading-relaxed max-w-[46ch]">{sub}</p>}
      <div className="mt-8">{children}</div>
    </div>
  );
}

export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="text-caption text-danger mt-2">{message}</p>;
}

export function FlowNav({
  segments,
  backLabel,
  nextLabel,
  onBack,
  onNext,
  nextBusy = false,
  showBack = true,
}: {
  /** One entry per phase: fill ratio 0→1 */
  segments: { label: string; fill: number }[];
  backLabel: string;
  nextLabel: string;
  onBack: () => void;
  onNext: () => void;
  nextBusy?: boolean;
  showBack?: boolean;
}) {
  return (
    <div className="fixed left-0 right-0 lg:left-[260px] z-20 bottom-[calc(64px+env(safe-area-inset-bottom,0px))] lg:bottom-0 bg-ink-950/95 border-t border-line-1"
      style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
    >
      {/* Segmented progress */}
      <div className="flex gap-1.5 px-4 pt-3 max-w-[720px] mx-auto w-full">
        {segments.map((s) => (
          <div key={s.label} className="flex-1">
            <div className="h-1 rounded-full bg-ink-600 overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-entrance ease-entrance"
                style={{ width: `${Math.round(Math.min(1, Math.max(0, s.fill)) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Back / Next */}
      <div className="flex items-center justify-between px-4 py-3 max-w-[720px] mx-auto w-full">
        {showBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-body text-pen-2 hover:text-pen-1 transition px-2 py-2 -ml-2 rounded-md"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.8} />
            {backLabel}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={nextBusy}
          className="premium-button inline-flex items-center gap-2 rounded-md px-6 py-2.5 text-body font-semibold disabled:opacity-60"
        >
          {nextLabel}
          <ArrowRight className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
