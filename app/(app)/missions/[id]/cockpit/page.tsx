'use client';

/**
 * Mission Cockpit — the single surface investors see to understand
 * the whole payment loop. Shows:
 *
 *   - Live mission status (watching / proposal / booked / cancelled)
 *   - Funds held (Stripe authorization or on-chain USDC balance)
 *   - Budget gauge + auto-buy threshold
 *   - Pending proposals with Confirm / Decline actions
 *   - Post-capture: "Booked for $X, $Y released back to you" + deep-link
 *   - Manual "Check now" button to trigger an agent sweep outside cron
 *
 * Polls GET /api/missions/[id] every 5 seconds while the mission is
 * in an active state.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { BookNow } from '@/components/missions/book-now';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Mission, MissionProposal } from '@/lib/types';

type CockpitData = {
  mission: Mission;
  proposals: MissionProposal[];
  onchain: {
    budgetUsd: number;
    autoBuyLimitUsd: number;
    spentUsd: number;
    remainingUsd: number;
    expiresAt: string;
    active: boolean;
  } | null;
};

type PredictionSnapshot = {
  coverage: { samples: number; confidence: number; label: string };
  baseline: {
    n: number;
    mean: number;
    median: number;
    stdev: number;
    min: number;
    max: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    trendSlopePerDay: number;
    trendR2: number;
  } | null;
  prediction: {
    action: 'BUY_NOW' | 'MONITOR' | 'WAIT';
    confidence: number;
    zScore: number;
    percentile: number;
    trend: 'falling' | 'rising' | 'stable' | 'unknown';
    trendSlopePerDay: number;
    expectedSavingsIfWait: number;
    probabilityBeaten7d: number;
    sampleCount: number;
    reason: string;
  } | null;
  sparkline: Array<{ date: string; priceUsd: number }>;
  daysUntilDeparture: number;
};

const POLL_MS = 5000;
const ACTIVE_STATUSES = new Set([
  'awaiting_payment',
  'monitoring',
  'proposal_pending',
]);

/* Status → semantic tone (3 tones max + muted) — mirrors MissionCard */
type StatusTone = 'neutral' | 'success' | 'warning' | 'muted';

const STATUS_TONE: Record<string, StatusTone> = {
  monitoring: 'neutral',
  proposal_pending: 'success',
  awaiting_payment: 'warning',
  booked: 'success',
  completed: 'muted',
  cancelled: 'muted',
  expired: 'muted',
  draft: 'muted',
};

const TONE_CLASSES: Record<StatusTone, { pill: string; dot: string }> = {
  neutral: { pill: 'bg-ink-600 text-pen-2', dot: 'bg-pen-3 pulse-live' },
  success: { pill: 'bg-success-soft text-success', dot: 'bg-success' },
  warning: { pill: 'bg-warning-soft text-warning', dot: 'bg-warning' },
  muted: { pill: 'bg-ink-600 text-pen-3', dot: 'bg-line-3' },
};

const STATUS_LABEL: Record<string, string> = {
  monitoring: 'Watching',
  proposal_pending: 'Fare found',
  awaiting_payment: 'Action required',
  booked: 'Booked',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired',
  draft: 'Draft',
};

function formatUsd(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

function timeAgo(iso: string | undefined): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

/* Display-only: how long until an ISO timestamp (proposal deadlines) */
function timeUntil(iso: string | undefined): string {
  if (!iso) return '';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'soon';
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

export default function MissionCockpitPage() {
  const params = useParams<{ id: string }>();
  const missionId = params?.id;
  const router = useRouter();

  const [data, setData] = useState<CockpitData | null>(null);
  const [prediction, setPrediction] = useState<PredictionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!missionId) return;
    try {
      // Fetch mission state and statistical prediction in parallel —
      // both routes are fast (no upstream API calls) and the UI needs
      // them together for a coherent snapshot.
      const [missionRes, predictionRes] = await Promise.all([
        fetch(`/api/missions/${missionId}`, { cache: 'no-store' }),
        fetch(`/api/missions/${missionId}/prediction`, { cache: 'no-store' }),
      ]);

      const missionJson = await missionRes.json();
      const predictionJson = await predictionRes.json().catch(() => null);

      if (missionJson.success) {
        setData({
          mission: missionJson.mission,
          proposals: missionJson.proposals || [],
          onchain: missionJson.onchain || null,
        });
        setError(null);
      } else {
        setError(missionJson.error || 'Mission not found');
      }

      if (predictionJson?.success) {
        setPrediction({
          coverage: predictionJson.coverage,
          baseline: predictionJson.baseline,
          prediction: predictionJson.prediction,
          sparkline: predictionJson.sparkline || [],
          daysUntilDeparture: predictionJson.daysUntilDeparture,
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [missionId]);

  // Initial fetch + polling while the mission is still active
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!data) return;
    if (!ACTIVE_STATUSES.has(data.mission.status)) return;
    const t = setInterval(fetchData, POLL_MS);
    return () => clearInterval(t);
  }, [data, fetchData]);

  // --- Derived values --------------------------------------------
  const mission = data?.mission;
  const pendingProposal = useMemo(
    () => data?.proposals.find((p) => p.status === 'pending') || null,
    [data]
  );
  const completedProposal = useMemo(
    () =>
      data?.proposals.find(
        (p) => p.status === 'confirmed' || p.status === 'auto_bought'
      ) || null,
    [data]
  );

  // --- Actions ---------------------------------------------------
  async function handleCheckNow() {
    if (!mission) return;
    setBusy('check');
    try {
      await fetch(`/api/missions/${mission.id}/propose`, { method: 'POST' });
      await fetchData();
    } finally {
      setBusy(null);
    }
  }

  async function handleConfirm(proposalId: string) {
    if (!mission) return;
    setBusy('confirm');
    try {
      const res = await fetch(`/api/missions/${mission.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Confirm failed');
      }
      await fetchData();
    } finally {
      setBusy(null);
    }
  }

  async function handleDecline(proposalId: string) {
    if (!mission) return;
    setBusy('decline');
    try {
      await fetch(`/api/missions/${mission.id}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId }),
      });
      await fetchData();
    } finally {
      setBusy(null);
    }
  }

  async function handleCancel() {
    if (!mission) return;
    if (
      !confirm(
        'Cancel this mission? Your authorization hold will be released immediately.'
      )
    )
      return;
    setBusy('cancel');
    try {
      await fetch(`/api/missions/${mission.id}/cancel`, { method: 'POST' });
      await fetchData();
    } finally {
      setBusy(null);
    }
  }

  // --- Render ----------------------------------------------------
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-4 md:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-1/2 bg-ink-600 rounded-md" />
          <div className="h-40 bg-ink-600 rounded-lg" />
          <div className="h-60 bg-ink-600 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !mission) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card>
          <p className="text-body text-danger">{error || 'Mission not found'}</p>
          <div className="mt-4">
            <Link href="/missions" className="text-sm text-accent hover:underline">
              ← Back to missions
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // Decide which "held" number to show. For Stripe: the authorized
  // amount in cents. For wallet: the on-chain remaining balance.
  const heldUsd =
    mission.paymentRail === 'stripe'
      ? (mission.stripeAuthorizedAmount || 0) / 100 -
        (mission.stripeCapturedAmount || 0) / 100
      : data?.onchain?.remainingUsd ?? mission.budgetDepositedUsd ?? 0;

  const capturedUsd =
    mission.paymentRail === 'stripe'
      ? (mission.stripeCapturedAmount || 0) / 100
      : data?.onchain?.spentUsd ?? 0;

  const progressPct = mission.bestSeenPrice
    ? Math.max(
        0,
        Math.min(100, (mission.bestSeenPrice / mission.maxBudgetUsd) * 100)
      )
    : 0;

  const tone = STATUS_TONE[mission.status] ?? 'muted';
  const toneCls = TONE_CLASSES[tone];
  const budgetDelta =
    mission.bestSeenPrice != null
      ? mission.maxBudgetUsd - mission.bestSeenPrice
      : null;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${toneCls.pill}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${toneCls.dot}`} />
            {STATUS_LABEL[mission.status] ?? mission.status.replace(/_/g, ' ')}
          </span>
          <span className="inline-flex items-center rounded-full bg-ink-600 px-2.5 py-0.5 text-[11px] text-pen-3">
            {mission.paymentRail === 'wallet' ? 'Wallet · USDC' : 'Card · Stripe'}
          </span>
        </div>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="editorial text-[28px] md:text-[32px] leading-tight text-pen-1">
              {mission.destinationCity || mission.destination}
              <span className="text-pen-3 text-body-lg font-sans ml-2">
                from {mission.originCity || mission.origin}
              </span>
            </h1>
            <p className="text-caption text-pen-3 mt-1">
              {mission.departDate}
              {mission.returnDate ? ` → ${mission.returnDate}` : ' · one-way'} ·{' '}
              {mission.passengers} traveler{mission.passengers > 1 ? 's' : ''} ·{' '}
              {mission.cabinClass} · budget {formatUsd(mission.maxBudgetUsd)}
            </p>
          </div>
          {ACTIVE_STATUSES.has(mission.status) && (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCheckNow}
                disabled={!!busy}
              >
                {busy === 'check' ? 'Checking…' : 'Check now'}
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Price hero + funds panel */}
      <Card>
        <p className="text-[11px] uppercase tracking-wider text-pen-3 font-medium">
          Best fare seen
        </p>
        <div className="flex items-baseline gap-3 flex-wrap mt-1.5">
          <span className="num text-[30px] font-semibold text-pen-1 leading-none">
            {mission.bestSeenPrice ? formatUsd(mission.bestSeenPrice) : '—'}
          </span>
          {budgetDelta != null && (
            <span
              className={`num text-body font-medium ${
                budgetDelta >= 0 ? 'text-success' : 'text-warning'
              }`}
            >
              {`${budgetDelta >= 0 ? '−' : '+'}$${Math.round(
                Math.abs(budgetDelta)
              ).toLocaleString('en-US')} ${
                budgetDelta >= 0 ? 'under budget' : 'over budget'
              }`}
            </span>
          )}
        </div>

        {/* Budget gauge */}
        {mission.bestSeenPrice && (
          <div className="mt-5">
            <div className="h-1.5 rounded-full bg-ink-600 overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="num flex justify-between text-[10px] text-pen-3 mt-1.5">
              <span>$0</span>
              {mission.autoBuyThresholdUsd && (
                <span>auto-buy @ {formatUsd(mission.autoBuyThresholdUsd)}</span>
              )}
              <span>max {formatUsd(mission.maxBudgetUsd)}</span>
            </div>
          </div>
        )}

        {/* Secondary stats — one quiet line, not competing cards */}
        <div className="mt-5 pt-4 border-t border-line-1 flex flex-wrap gap-x-6 gap-y-1.5 text-caption text-pen-3">
          <span>
            {mission.paymentRail === 'wallet' ? 'Escrowed' : 'Held on card'}{' '}
            <span className="num font-medium text-pen-2">{formatUsd(heldUsd)}</span>
          </span>
          {capturedUsd > 0 && (
            <span>
              Spent{' '}
              <span className="num font-medium text-pen-2">
                {formatUsd(capturedUsd)}
              </span>
            </span>
          )}
          <span>
            {mission.autoBuyThresholdUsd ? (
              <>
                Auto-buy below{' '}
                <span className="num font-medium text-pen-2">
                  {formatUsd(mission.autoBuyThresholdUsd)}
                </span>
              </>
            ) : (
              'We always ask before booking'
            )}
          </span>
        </div>
      </Card>

      {/* Statistical prediction panel — the brain of the agent */}
      {prediction && <PredictionPanel snapshot={prediction} />}

      {/* Pending proposal */}
      {pendingProposal && <ProposalCard
        proposal={pendingProposal}
        mission={mission}
        onConfirm={() => handleConfirm(pendingProposal.id)}
        onDecline={() => handleDecline(pendingProposal.id)}
        onBooked={fetchData}
        busy={busy}
      />}

      {/* Completed / auto-bought */}
      {completedProposal && (
        <BookedCard proposal={completedProposal} mission={mission} />
      )}

      {/* Awaiting payment CTA */}
      {mission.status === 'awaiting_payment' && (
        <Card className="border-warning/25">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex-1">
              <p className="text-body font-medium text-pen-1">
                {mission.paymentRail === 'wallet'
                  ? 'Approve USDC and deposit into the escrow to start monitoring.'
                  : 'Add your card to place the authorization hold.'}
              </p>
              <p className="text-body text-pen-2 mt-1">
                Your funds stay with you until we find a matching flight.{' '}
                {mission.paymentRail === 'stripe'
                  ? 'Stripe holds the authorization — nothing is charged until we find your flight.'
                  : 'USDC sits in a non-custodial smart contract — withdraw anytime.'}
              </p>
            </div>
            <Button
              onClick={() =>
                router.push(`/missions/${mission.id}/pay`)
              }
            >
              Complete payment →
            </Button>
          </div>
        </Card>
      )}

      {/* History */}
      <div>
        <h2 className="text-[11px] uppercase tracking-wider text-pen-3 font-medium mb-3">
          Activity
        </h2>
        <div className="space-y-2">
          {data?.proposals.length === 0 && (
            <p className="text-body text-pen-3">
              Nothing logged yet. We check every few hours — or use "Check
              now" above to run a scan.
            </p>
          )}
          {data?.proposals.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 p-3 rounded-md bg-ink-800 border border-line-1 text-body"
            >
              <div>
                <p
                  className={
                    p.status === 'auto_bought' || p.status === 'confirmed'
                      ? 'text-success font-medium'
                      : p.status === 'pending'
                      ? 'text-pen-1 font-medium'
                      : 'text-pen-3'
                  }
                >
                  {p.status === 'auto_bought'
                    ? 'Auto-booked'
                    : p.status === 'confirmed'
                    ? 'Confirmed'
                    : p.status === 'declined'
                    ? 'Declined'
                    : p.status === 'expired'
                    ? 'Expired'
                    : 'Proposal sent'}
                </p>
                <p className="num text-caption text-pen-3 mt-0.5">
                  {p.offerSnapshot.airline} · {formatUsd(p.offerSnapshot.priceUsd)}{' '}
                  · {timeAgo(p.createdAt)}
                </p>
              </div>
              {p.captureTxHash && (
                <a
                  href={`https://basescan.org/tx/${p.captureTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-accent hover:underline font-mono"
                >
                  {p.captureTxHash.slice(0, 10)}…
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Heartbeat + footer (danger zone stays quiet) */}
      <div>
        <p className="text-caption text-pen-3">
          {mission.lastCheckedAt
            ? `Checked ${timeAgo(mission.lastCheckedAt)}`
            : 'Not checked yet'}
          {prediction?.coverage
            ? ` · ${prediction.coverage.samples} fares analyzed`
            : ''}
        </p>
        <div className="flex items-center justify-between gap-3 border-t border-line-1 mt-3 pt-4">
          <Link
            href="/missions"
            className="text-body text-pen-3 hover:text-pen-1 transition-colors"
          >
            ← All missions
          </Link>
          {ACTIVE_STATUSES.has(mission.status) && (
            <button
              onClick={handleCancel}
              disabled={!!busy}
              className="text-caption text-danger/80 hover:text-danger hover:underline disabled:opacity-50"
            >
              {busy === 'cancel' ? 'Cancelling…' : 'Cancel mission'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------
// Sub-components (hoisted per React best practices — never defined
// inside the parent component so they don't re-mount on every render)
// -------------------------------------------------------------------

/** Copy for the inline booking panel. The cockpit is English-first; the
 *  panel takes a lookup so it can be dropped into a localised screen. */
const BOOK_COPY: Record<string, string> = {
  'proposal.book.cta': 'Book this fare',
  'proposal.book.sub': "You're paying for this fare only. Nothing was charged before now.",
  'proposal.book.paying': 'Confirming your booking…',
  'proposal.book.done': 'Booked. Your confirmation is on its way.',
  'proposal.book.error': "That payment didn't go through. Nothing was charged.",
};

function ProposalCard({
  proposal,
  mission,
  onConfirm,
  onDecline,
  onBooked,
  busy,
}: {
  proposal: MissionProposal;
  mission: Mission;
  onConfirm: () => void;
  onDecline: () => void;
  onBooked: () => void;
  busy: string | null;
}) {
  const o = proposal.offerSnapshot;
  return (
    <Card className="border-success/25 bg-ink-800 shadow-elev-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          We found a match
        </p>
        {proposal.expiresAt && (
          <p className="num text-caption text-pen-3">
            {timeUntil(proposal.expiresAt) === 'soon'
              ? 'Expires soon'
              : `Expires in ${timeUntil(proposal.expiresAt)}`}
          </p>
        )}
      </div>
      <p className="text-body-lg text-pen-1 mt-2 leading-relaxed">
        {proposal.reason}
      </p>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-center">
        <div className="flex items-center gap-3">
          {o.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={o.logoUrl}
              alt={o.airline}
              className="h-10 w-10 rounded-md bg-ink-600"
            />
          ) : (
            <div className="h-10 w-10 rounded-md bg-ink-600 flex items-center justify-center text-caption text-pen-2">
              {o.airlineCode || '?'}
            </div>
          )}
          <div>
            <p className="text-body font-medium text-pen-1">{o.airline}</p>
            <p className="num text-caption text-pen-3">
              {o.originIata} → {o.destinationIata} ·{' '}
              {o.stops === 0 ? 'Non-stop' : `${o.stops} stop${o.stops > 1 ? 's' : ''}`}{' '}
              · {Math.floor(o.durationMinutes / 60)}h{' '}
              {o.durationMinutes % 60}m
            </p>
          </div>
        </div>
        <div className="md:text-right">
          <p className="num text-[28px] font-semibold text-pen-1">
            ${o.priceUsd}
          </p>
        </div>
      </div>

      {/* Two paths. An auto-buy mission already authorised the budget, so
          confirming just captures it. Every other mission has taken nothing
          so far — the traveller pays this fare, here, now. */}
      {mission.stripePaymentIntentId ? (
        <div className="mt-5 flex flex-col sm:flex-row gap-2">
          <Button onClick={onConfirm} disabled={!!busy}>
            {busy === 'confirm' ? 'Booking…' : 'Book this fare'}
          </Button>
          <Button variant="ghost" onClick={onDecline} disabled={!!busy}>
            Decline
          </Button>
        </div>
      ) : (
        <>
          <BookNow
            missionId={mission.id}
            proposalId={proposal.id}
            amountUsd={o.priceUsd}
            onBooked={onBooked}
            t={(k) => BOOK_COPY[k] ?? k}
          />
          <button
            type="button"
            onClick={onDecline}
            disabled={!!busy}
            className="mt-2 w-full text-caption text-pen-3 hover:text-pen-1 transition-colors"
          >
            Not this one
          </button>
        </>
      )}
    </Card>
  );
}

/* ==================================================================
   Prediction panel — the cockpit's statistical brain
   ================================================================ */

function PredictionPanel({ snapshot }: { snapshot: PredictionSnapshot }) {
  const { coverage, baseline, prediction, sparkline, daysUntilDeparture } =
    snapshot;

  // Cold-start state: we're still learning this route
  if (!prediction || coverage.samples < 5) {
    return (
      <Card>
        <div className="flex items-start gap-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-pen-3 pulse-live mt-[7px]" />
          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-wider text-pen-3 font-medium">
              Price intelligence · learning
            </p>
            <p className="text-body text-pen-2 mt-1 leading-relaxed">
              We're building a price baseline for this route —{' '}
              <span className="num font-medium text-pen-1">
                {coverage.samples}
              </span>{' '}
              observation{coverage.samples === 1 ? '' : 's'} so far. Confident
              calls start around 10 price points; until then we keep watching
              and record every scan.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const action =
    prediction.action === 'BUY_NOW'
      ? { text: 'text-success', label: 'Buy now' }
      : prediction.action === 'WAIT'
      ? { text: 'text-pen-1', label: 'Wait' }
      : { text: 'text-pen-1', label: 'Keep watching' };

  const confidencePct = Math.round(prediction.confidence * 100);
  const pricesForSparkline = sparkline.map((p) => p.priceUsd);
  const sparklineMin = pricesForSparkline.length > 0 ? Math.min(...pricesForSparkline) : 0;
  const sparklineMax = pricesForSparkline.length > 0 ? Math.max(...pricesForSparkline) : 1;
  const sparklineRange = Math.max(1, sparklineMax - sparklineMin);

  return (
    <Card>
      {/* Top: one readable recommendation */}
      <p className="text-[11px] uppercase tracking-wider text-pen-3 font-medium">
        Our read on this fare
      </p>
      <div className="flex items-baseline gap-2 flex-wrap mt-1">
        <span className={`text-body-lg font-semibold ${action.text}`}>
          {action.label}
        </span>
        <span className="num text-caption text-pen-3">
          {confidencePct}% confidence · {coverage.samples} samples · {coverage.label}
        </span>
      </div>

      {/* Reason — the natural-language explanation */}
      <p className="text-body text-pen-2 mt-3 leading-relaxed">
        {prediction.reason}
      </p>

      {/* Stats grid — quiet */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-4 border-t border-line-1">
        <Stat label="Z-score" value={formatZ(prediction.zScore)} sub={zScoreInterpretation(prediction.zScore)} />
        <Stat
          label="Percentile"
          value={`${prediction.percentile}`}
          sub={`${prediction.percentile <= 20 ? 'top 20%' : prediction.percentile <= 50 ? 'below median' : 'above median'}`}
        />
        <Stat
          label="Trend"
          value={trendIcon(prediction.trend)}
          sub={`${prediction.trendSlopePerDay > 0 ? '+' : ''}${prediction.trendSlopePerDay.toFixed(1)}/day`}
        />
        <Stat
          label="Beat in 7d"
          value={`${Math.round(prediction.probabilityBeaten7d * 100)}%`}
          sub={prediction.expectedSavingsIfWait > 0 ? `~$${Math.round(prediction.expectedSavingsIfWait)} if you wait` : 'likely now'}
        />
      </div>

      {/* 30-day sparkline */}
      {sparkline.length >= 3 && (
        <div className="mt-5 pt-4 border-t border-line-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-wider text-pen-3 font-medium">
              30-day price memory
            </p>
            <p className="num text-[10px] text-pen-3">
              ${Math.round(sparklineMin)} – ${Math.round(sparklineMax)}
            </p>
          </div>
          <div className="flex items-end gap-0.5 h-12">
            {sparkline.map((point, i) => {
              const height =
                ((point.priceUsd - sparklineMin) / sparklineRange) * 100;
              return (
                <div
                  key={point.date}
                  className="flex-1 rounded-sm transition-colors"
                  style={{
                    height: `${Math.max(6, height)}%`,
                    background:
                      i === sparkline.length - 1
                        ? 'var(--accent)'
                        : 'var(--line-2)',
                  }}
                  title={`${point.date}: $${point.priceUsd}`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Baseline reveal (investor-grade transparency) */}
      {baseline && (
        <details className="mt-4 pt-3 border-t border-line-1">
          <summary className="text-[11px] uppercase tracking-wider text-pen-3 font-medium cursor-pointer hover:text-pen-2">
            Raw statistics ▾
          </summary>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-3 text-caption">
            <MiniStat label="mean" value={`$${Math.round(baseline.mean)}`} />
            <MiniStat label="median" value={`$${Math.round(baseline.median)}`} />
            <MiniStat label="σ" value={`$${Math.round(baseline.stdev)}`} />
            <MiniStat label="p10" value={`$${Math.round(baseline.p10)}`} />
            <MiniStat label="p50" value={`$${Math.round(baseline.p50)}`} />
            <MiniStat label="p90" value={`$${Math.round(baseline.p90)}`} />
          </div>
          <p className="num text-[10px] text-pen-3 mt-3">
            {baseline.n} samples · trend R² {baseline.trendR2.toFixed(2)} · {daysUntilDeparture}d until departure
          </p>
        </details>
      )}
    </Card>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-pen-3 font-medium">
        {label}
      </p>
      <p className="num text-body-lg font-semibold text-pen-1 mt-0.5">
        {value}
      </p>
      {sub && <p className="text-[10px] text-pen-3 mt-0.5">{sub}</p>}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-pen-3">{label}</p>
      <p className="num text-caption text-pen-2">{value}</p>
    </div>
  );
}

function formatZ(z: number): string {
  return `${z >= 0 ? '+' : ''}${z.toFixed(2)}`;
}

function zScoreInterpretation(z: number): string {
  if (z <= -1.5) return 'deep bargain';
  if (z <= -0.5) return 'below average';
  if (z <= 0.5) return 'fair price';
  if (z <= 1.5) return 'above average';
  return 'expensive';
}

function trendIcon(trend: 'falling' | 'rising' | 'stable' | 'unknown'): string {
  if (trend === 'falling') return '↘';
  if (trend === 'rising') return '↗';
  if (trend === 'stable') return '→';
  return '?';
}

function BookedCard({
  proposal,
  mission,
}: {
  proposal: MissionProposal;
  mission: Mission;
}) {
  const o = proposal.offerSnapshot;
  const captured =
    proposal.captureAmountCents != null
      ? proposal.captureAmountCents / 100
      : o.priceUsd;
  const refunded =
    mission.paymentRail === 'stripe' && mission.stripeAuthorizedAmount
      ? mission.stripeAuthorizedAmount / 100 - captured
      : mission.maxBudgetUsd - captured;

  return (
    <Card className="border-success/25">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-success-soft flex items-center justify-center text-success">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3 8.5L6.5 12L13 4.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-[11px] uppercase tracking-wider text-success font-semibold">
            {proposal.status === 'auto_bought' ? 'Auto-booked' : 'Booked'}
          </p>
          <p className="num text-body-lg text-pen-1">
            {o.airline} · {formatUsd(captured)}
          </p>
          {refunded > 0 && (
            <p className="num text-body text-success mt-1">
              {formatUsd(refunded)} released back to your{' '}
              {mission.paymentRail === 'wallet' ? 'wallet' : 'card'}
            </p>
          )}
        </div>
      </div>
      {proposal.bookingDeepLink && (
        <div className="mt-4">
          <a
            href={proposal.bookingDeepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="premium-button block w-full text-center py-2.5 rounded-md text-sm"
          >
            Complete booking on Kiwi →
          </a>
          <p className="text-[11px] text-pen-3 text-center mt-2">
            Deep-link pre-fills this exact flight. Kiwi is the IATA-accredited
            merchant that issues the ticket.
          </p>
        </div>
      )}
    </Card>
  );
}
