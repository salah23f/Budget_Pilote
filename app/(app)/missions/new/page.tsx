'use client';

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale } from '@/lib/i18n';
import { AirportInput } from '@/components/ui/airport-input';
import { StepShell, FlowNav, FieldError } from '@/components/missions/flow/flow-shell';
import { Check, Minus, Plus } from 'lucide-react';

/**
 * Mission creation — conversational flow.
 *
 * One question per screen, ~6 screens, phase-segmented progress,
 * Back never destroys input, draft autosaved locally (30-day TTL).
 * Replaces the previous 1,100-line single-form wizard.
 *
 * Screens: where → when → who → budget → what matters → review → done.
 * POST /api/missions/create (Stripe rail) then hands off to the
 * deposit page — the honest "your mission is created" moment.
 */

type CabinClass = 'economy' | 'premium_economy' | 'business';

interface FlowForm {
  origin: string;
  originSkyId: string;
  originEntityId: string;
  destination: string;
  destinationSkyId: string;
  destinationEntityId: string;
  departDate: string;
  returnDate: string;
  passengers: number;
  budget: string;
  autoBookEnabled: boolean;
  autoBook: string;
  cheapest: boolean;
  direct: boolean;
  bag: boolean;
  eco: boolean;
  cabinClass: CabinClass;
}

const EMPTY_FORM: FlowForm = {
  origin: '',
  originSkyId: '',
  originEntityId: '',
  destination: '',
  destinationSkyId: '',
  destinationEntityId: '',
  departDate: '',
  returnDate: '',
  passengers: 1,
  budget: '',
  autoBookEnabled: false,
  autoBook: '',
  cheapest: true,
  direct: false,
  bag: true,
  eco: false,
  cabinClass: 'economy',
};

const STEPS = ['where', 'when', 'who', 'budget', 'matters', 'review'] as const;
type StepId = (typeof STEPS)[number];

// phase → steps mapping for the segmented progress bar
const PHASES: { key: string; steps: StepId[] }[] = [
  { key: 'flow.phase.trip', steps: ['where', 'when', 'who'] },
  { key: 'flow.phase.rules', steps: ['budget', 'matters'] },
  { key: 'flow.phase.review', steps: ['review'] },
];

const DRAFT_KEY = 'flyeas_mission_flow_draft';
const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export default function NewMissionPage() {
  return (
    <Suspense fallback={null}>
      <MissionFlow />
    </Suspense>
  );
}

function MissionFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLocale();

  const [form, setForm] = useState<FlowForm>(EMPTY_FORM);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [resumedDraft, setResumedDraft] = useState(false);
  // After editing from the review screen, "Next" returns straight to review
  const returnToReview = useRef(false);
  const [hydrated, setHydrated] = useState(false);

  const step = STEPS[stepIndex];

  /* ── Draft: restore on mount, save on change ── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.ts && Date.now() - parsed.ts < DRAFT_TTL_MS && parsed.form) {
          setForm({ ...EMPTY_FORM, ...parsed.form });
          setStepIndex(Math.min(Number(parsed.step) || 0, STEPS.length - 1));
          setResumedDraft(true);
        }
      }
    } catch {}
    // URL prefill fills an empty destination, never overwrites a draft
    const dest = searchParams?.get('destination');
    if (dest) {
      setForm((f) => (f.destination ? f : { ...f, destination: dest }));
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated || createdId) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, step: stepIndex, ts: Date.now() }));
    } catch {}
  }, [form, stepIndex, hydrated, createdId]);

  const patch = useCallback((p: Partial<FlowForm>) => {
    setForm((f) => ({ ...f, ...p }));
    setError(null);
  }, []);

  /* ── Validation per step ── */
  function validate(current: StepId): string | null {
    switch (current) {
      case 'where':
        if (!form.origin || !form.destination) return t('flow.where.error');
        return null;
      case 'when':
        if (!form.departDate) return t('flow.when.error');
        if (form.returnDate && form.returnDate < form.departDate) return t('flow.when.errorOrder');
        return null;
      case 'budget': {
        const b = Number(form.budget);
        if (!Number.isFinite(b) || b <= 0) return t('flow.budget.error');
        if (form.autoBookEnabled) {
          const a = Number(form.autoBook);
          if (!Number.isFinite(a) || a <= 0 || a > b) return t('flow.budget.autoError');
        }
        return null;
      }
      default:
        return null;
    }
  }

  function goNext() {
    const problem = validate(step);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    if (step === 'review') {
      void submit();
      return;
    }
    if (returnToReview.current) {
      returnToReview.current = false;
      setStepIndex(STEPS.indexOf('review'));
      return;
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function goBack() {
    setError(null);
    if (returnToReview.current) {
      returnToReview.current = false;
      setStepIndex(STEPS.indexOf('review'));
      return;
    }
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function editFromReview(target: StepId) {
    returnToReview.current = true;
    setError(null);
    setStepIndex(STEPS.indexOf(target));
  }

  /* ── Submit ── */
  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/missions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: form.origin,
          originSkyId: form.originSkyId || undefined,
          originEntityId: form.originEntityId || undefined,
          destination: form.destination,
          destinationSkyId: form.destinationSkyId || undefined,
          destinationEntityId: form.destinationEntityId || undefined,
          departDate: form.departDate,
          returnDate: form.returnDate || undefined,
          passengers: form.passengers,
          maxBudgetUsd: Number(form.budget),
          autoBuyThresholdUsd: form.autoBookEnabled ? Number(form.autoBook) : undefined,
          cabinClass: form.cabinClass,
          cabinBagRequired: form.bag,
          stopsPreference: form.direct ? 'direct' : 'any',
          ecoPreference: form.eco ? 'eco' : 'balanced',
          pricePriority: form.cheapest ? 'cheapest' : 'balanced',
          paymentRail: 'stripe',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success || !data?.mission?.id) {
        throw new Error(data?.error || t('flow.review.error'));
      }
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      setCreatedId(data.mission.id);
    } catch (e: any) {
      setError(e?.message || t('flow.review.error'));
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Progress segments ── */
  const segments = useMemo(() => {
    return PHASES.map((phase) => {
      const idxs = phase.steps.map((s) => STEPS.indexOf(s));
      const first = idxs[0];
      const last = idxs[idxs.length - 1];
      let fill = 0;
      if (stepIndex > last) fill = 1;
      else if (stepIndex >= first) fill = (stepIndex - first + 1) / phase.steps.length;
      return { label: t(phase.key), fill };
    });
  }, [stepIndex, t]);

  const phaseKicker = t(PHASES.find((p) => p.steps.includes(step))!.key);

  if (createdId) {
    return <DoneScreen t={t} missionId={createdId} onLater={() => router.push('/missions')} />;
  }

  return (
    <div className="pb-44">
      {resumedDraft && stepIndex > 0 && (
        <p className="mx-auto max-w-[560px] mt-2 text-caption text-pen-3">
          {t('flow.draft.resumed')}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          goNext();
        }}
      >
        {step === 'where' && (
          <StepShell kicker={phaseKicker} title={t('flow.where.title')} sub={t('flow.where.sub')}>
            <div className="grid gap-4">
              <AirportInput
                label={t('flow.where.from')}
                value={form.origin}
                placeholder={t('flow.where.fromPlaceholder')}
                onChange={(s) => patch({ origin: s.code, originSkyId: s.skyId, originEntityId: s.entityId })}
              />
              <AirportInput
                label={t('flow.where.to')}
                value={form.destination}
                placeholder={t('flow.where.toPlaceholder')}
                onChange={(s) => patch({ destination: s.code, destinationSkyId: s.skyId, destinationEntityId: s.entityId })}
              />
            </div>
            <FieldError message={error} />
          </StepShell>
        )}

        {step === 'when' && (
          <StepShell kicker={phaseKicker} title={t('flow.when.title')} sub={t('flow.when.sub')}>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-caption text-pen-2 block mb-1.5">{t('flow.when.depart')}</span>
                <input
                  type="date"
                  className="glass-input"
                  value={form.departDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => patch({ departDate: e.target.value })}
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="text-caption text-pen-2 block mb-1.5">{t('flow.when.return')}</span>
                <input
                  type="date"
                  className="glass-input"
                  value={form.returnDate}
                  min={form.departDate || undefined}
                  onChange={(e) => patch({ returnDate: e.target.value })}
                />
              </label>
            </div>
            <FieldError message={error} />
          </StepShell>
        )}

        {step === 'who' && (
          <StepShell kicker={phaseKicker} title={t('flow.who.title')} sub={t('flow.who.sub')}>
            <div className="flex items-center justify-between rounded-lg border border-line-1 bg-ink-800 px-5 py-4 max-w-[320px]">
              <span className="text-body text-pen-1">{t('flow.who.travelers')}</span>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  aria-label="−"
                  onClick={() => patch({ passengers: Math.max(1, form.passengers - 1) })}
                  className="flex items-center justify-center w-9 h-9 rounded-full border border-line-2 text-pen-1 hover:bg-ink-600 transition disabled:opacity-40"
                  disabled={form.passengers <= 1}
                >
                  <Minus className="w-4 h-4" strokeWidth={2} />
                </button>
                <span className="num text-body-lg font-semibold text-pen-1 w-6 text-center">{form.passengers}</span>
                <button
                  type="button"
                  aria-label="+"
                  onClick={() => patch({ passengers: Math.min(9, form.passengers + 1) })}
                  className="flex items-center justify-center w-9 h-9 rounded-full border border-line-2 text-pen-1 hover:bg-ink-600 transition disabled:opacity-40"
                  disabled={form.passengers >= 9}
                >
                  <Plus className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>
            </div>
          </StepShell>
        )}

        {step === 'budget' && (
          <StepShell kicker={phaseKicker} title={t('flow.budget.title')} sub={t('flow.budget.sub')}>
            <label className="block max-w-[320px]">
              <span className="text-caption text-pen-2 block mb-1.5">{t('flow.budget.label')}</span>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-body-lg text-pen-3">$</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  className="glass-input num !pl-8 !text-[22px] !py-3 font-semibold"
                  value={form.budget}
                  onChange={(e) => patch({ budget: e.target.value })}
                  autoFocus
                />
              </div>
            </label>

            {/* Optional auto-book — off by default, honest framing */}
            <div className="mt-6 rounded-lg border border-line-1 bg-ink-800 p-4 max-w-[420px]">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.autoBookEnabled}
                  onChange={(e) => patch({ autoBookEnabled: e.target.checked })}
                  className="mt-1 accent-[var(--accent)]"
                />
                <span>
                  <span className="text-body text-pen-1 font-medium block">{t('flow.budget.autoTitle')}</span>
                  <span className="text-caption text-pen-3">{t('flow.budget.autoSub')}</span>
                </span>
              </label>
              {form.autoBookEnabled && (
                <label className="block mt-3 pl-7">
                  <span className="text-caption text-pen-2 block mb-1.5">{t('flow.budget.autoLabel')}</span>
                  <div className="relative max-w-[200px]">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-body text-pen-3">$</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      className="glass-input num !pl-8"
                      value={form.autoBook}
                      onChange={(e) => patch({ autoBook: e.target.value })}
                    />
                  </div>
                </label>
              )}
            </div>
            <FieldError message={error} />
          </StepShell>
        )}

        {step === 'matters' && (
          <StepShell kicker={phaseKicker} title={t('flow.matters.title')} sub={t('flow.matters.sub')}>
            <div className="grid gap-2.5">
              <PriorityChip
                checked={form.cheapest}
                onToggle={() => patch({ cheapest: !form.cheapest })}
                title={t('flow.matters.cheapest')}
                sub={t('flow.matters.cheapestSub')}
              />
              <PriorityChip
                checked={form.direct}
                onToggle={() => patch({ direct: !form.direct })}
                title={t('flow.matters.direct')}
                sub={t('flow.matters.directSub')}
              />
              <PriorityChip
                checked={form.bag}
                onToggle={() => patch({ bag: !form.bag })}
                title={t('flow.matters.bag')}
                sub={t('flow.matters.bagSub')}
              />
              <PriorityChip
                checked={form.eco}
                onToggle={() => patch({ eco: !form.eco })}
                title={t('flow.matters.eco')}
                sub={t('flow.matters.ecoSub')}
              />
            </div>

            <label className="block mt-6 max-w-[280px]">
              <span className="text-caption text-pen-2 block mb-1.5">{t('flow.matters.cabin')}</span>
              <select
                className="glass-input"
                value={form.cabinClass}
                onChange={(e) => patch({ cabinClass: e.target.value as CabinClass })}
              >
                <option value="economy">{t('flow.cabin.economy')}</option>
                <option value="premium_economy">{t('flow.cabin.premium_economy')}</option>
                <option value="business">{t('flow.cabin.business')}</option>
              </select>
            </label>
          </StepShell>
        )}

        {step === 'review' && (
          <StepShell kicker={phaseKicker} title={t('flow.review.title')} sub={t('flow.review.sub')}>
            <div className="grid gap-3">
              <ReviewCard
                label={t('flow.review.trip')}
                onEdit={() => editFromReview('where')}
                editLabel={t('flow.review.edit')}
              >
                <p className="editorial text-[20px] text-pen-1">
                  {form.origin} <span className="text-pen-3">→</span> {form.destination}
                </p>
                <p className="text-caption text-pen-3 mt-1">
                  {form.departDate}
                  {form.returnDate ? ` → ${form.returnDate}` : ''} · {form.passengers}{' '}
                  {form.passengers > 1 ? t('mission.travelers') : t('mission.traveler')}
                </p>
              </ReviewCard>

              <ReviewCard
                label={t('flow.review.budget')}
                onEdit={() => editFromReview('budget')}
                editLabel={t('flow.review.edit')}
              >
                <p className="num text-[22px] font-semibold text-pen-1">
                  ${Number(form.budget || 0).toLocaleString('en-US')}
                </p>
                <p className="text-caption text-pen-3 mt-1">
                  {form.autoBookEnabled && Number(form.autoBook) > 0
                    ? `${t('flow.review.autoOn')} $${Number(form.autoBook).toLocaleString('en-US')}`
                    : t('flow.review.autoOff')}
                </p>
              </ReviewCard>

              <ReviewCard
                label={t('flow.review.preferences')}
                onEdit={() => editFromReview('matters')}
                editLabel={t('flow.review.edit')}
              >
                <p className="text-body text-pen-1">
                  {[
                    form.cheapest ? t('flow.matters.cheapest') : null,
                    form.direct ? t('flow.matters.direct') : null,
                    form.bag ? t('flow.matters.bag') : null,
                    form.eco ? t('flow.matters.eco') : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </p>
                <p className="text-caption text-pen-3 mt-1">{t(`flow.cabin.${form.cabinClass}`)}</p>
              </ReviewCard>
            </div>

            <p className="text-caption text-pen-3 mt-5 leading-relaxed">{t('flow.review.finePrint')}</p>
            <FieldError message={error} />
          </StepShell>
        )}

        {/* Submit-on-Enter target */}
        <button type="submit" className="hidden" aria-hidden />
      </form>

      <FlowNav
        segments={segments}
        backLabel={t('flow.back')}
        nextLabel={step === 'review' ? t('flow.review.launch') : t('flow.next')}
        onBack={goBack}
        onNext={goNext}
        nextBusy={submitting}
        showBack={stepIndex > 0}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Sub-components
   ══════════════════════════════════════════════════════════ */

function PriorityChip({
  checked,
  onToggle,
  title,
  sub,
}: {
  checked: boolean;
  onToggle: () => void;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-all duration-default ${
        checked
          ? 'border-accent/40 bg-accent-soft'
          : 'border-line-1 bg-ink-800 hover:border-line-2'
      }`}
    >
      <span
        className={`flex items-center justify-center w-5 h-5 rounded-full border shrink-0 mt-0.5 transition ${
          checked ? 'bg-accent border-accent text-accent-ink' : 'border-line-3 bg-transparent'
        }`}
      >
        {checked && <Check className="w-3 h-3" strokeWidth={3} />}
      </span>
      <span>
        <span className="text-body text-pen-1 font-medium block">{title}</span>
        <span className="text-caption text-pen-3">{sub}</span>
      </span>
    </button>
  );
}

function ReviewCard({
  label,
  editLabel,
  onEdit,
  children,
}: {
  label: string;
  editLabel: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line-1 bg-ink-800 p-4 shadow-elev-1">
      <div className="flex items-center justify-between mb-2">
        <p className="text-micro uppercase tracking-widest text-pen-3">{label}</p>
        <button
          type="button"
          onClick={onEdit}
          className="text-caption text-accent hover:text-accent-hover transition font-medium"
        >
          {editLabel}
        </button>
      </div>
      {children}
    </div>
  );
}

function DoneScreen({
  t,
  missionId,
  onLater,
}: {
  t: (k: string) => string;
  missionId: string;
  onLater: () => void;
}) {
  return (
    <div className="mx-auto max-w-[480px] pt-16 sm:pt-24 text-center px-4">
      {/* Check draws itself in ~350ms — the whole celebration */}
      <svg viewBox="0 0 48 48" className="w-16 h-16 mx-auto" fill="none" aria-hidden>
        <circle cx="24" cy="24" r="22" stroke="var(--accent)" strokeOpacity="0.25" strokeWidth="2" />
        <path
          d="M14 25l7 7 13-15"
          stroke="var(--accent)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="check-draw"
        />
      </svg>
      <h2 className="editorial text-[28px] text-pen-1 mt-6">{t('flow.done.title')}</h2>
      <p className="text-body text-pen-2 mt-3 leading-relaxed">{t('flow.done.sub')}</p>
      <div className="mt-8 flex flex-col items-center gap-3">
        <Link
          href={`/missions/${missionId}/cockpit`}
          className="premium-button inline-flex items-center justify-center rounded-md px-7 py-3 text-body font-semibold w-full sm:w-auto"
        >
          {t('flow.done.cta')}
        </Link>
        <button
          type="button"
          onClick={onLater}
          className="text-caption text-pen-3 hover:text-pen-1 transition py-1"
        >
          {t('flow.done.later')}
        </button>
      </div>
    </div>
  );
}
