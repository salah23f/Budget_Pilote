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

function statusColor(status: string): string {
  switch (status) {
    case 'monitoring':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30';
    case 'proposal_pending':
      return 'bg-amber-500/15 text-amber-300 border-amber-400/30';
    case 'awaiting_payment':
      return 'bg-sky-500/15 text-sky-300 border-sky-400/30';
    case 'booked':
      return 'bg-violet-500/15 text-violet-300 border-violet-400/30';
    case 'cancelled':
    case 'expired':
      return 'bg-white/5 text-white/40 border-white/10';
    default:
      return 'bg-white/5 text-white/60 border-white/10';
  }
}

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
      <div className="max-w-5xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-1/2 bg-white/5 rounded" />
          <div className="h-40 bg-white/5 rounded-xl" />
          <div className="h-60 bg-white/5 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !mission) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card>
          <p className="text-red-300">{error || 'Mission not found'}</p>
          <div className="mt-4">
            <Link href="/missions" className="text-sm text-amber-300 underline">
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

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-semibold text-white">
              {mission.originCity || mission.origin}
              <span className="text-white/30 mx-2">→</span>
              {mission.destinationCity || mission.destination}
            </h1>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusColor(
                mission.status
              )}`}
            >
              {mission.status.replace(/_/g, ' ')}
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 text-white/60 border border-white/10">
              {mission.paymentRail === 'wallet' ? '🔗 Wallet · USDC' : '💳 Card · Stripe'}
            </span>
          </div>
          <p className="text-sm text-white/50 mt-1">
            {mission.departDate}
            {mission.returnDate ? ` → ${mission.returnDate}` : ' · one-way'} ·{' '}
            {mission.passengers} pax · {mission.cabinClass}
          </p>
        </div>
        <div className="flex gap-2">
          {ACTIVE_STATUSES.has(mission.status) && (
            <>
              <Button
                variant="ghost"
                onClick={handleCheckNow}
                disabled={!!busy}
              >
                {busy === 'check' ? 'Checking…' : '🔍 Check now'}
              </Button>
              <Button
                variant="ghost"
                onClick={handleCancel}
                disabled={!!busy}
              >
                Cancel mission
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Payment / hold panel */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/40">
              {mission.paymentRail === 'wallet' ? 'Escrowed' : 'Held on card'}
            </p>
            <p className="text-3xl font-semibold text-white mt-1">
              {formatUsd(heldUsd)}
            </p>
            <p className="text-xs text-white/40 mt-1">
              of {formatUsd(mission.maxBudgetUsd)} max budget
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/40">
              Auto-buy below
            </p>
            <p className="text-3xl font-semibold text-white mt-1">
              {mission.autoBuyThresholdUsd
                ? formatUsd(mission.autoBuyThresholdUsd)
                : '—'}
            </p>
            <p className="text-xs text-white/40 mt-1">
              {mission.autoBuyThresholdUsd
                ? 'agent buys instantly'
                : 'always ask me first'}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/40">
              Best seen
            </p>
            <p className="text-3xl font-semibold text-white mt-1">
              {mission.bestSeenPrice ? formatUsd(mission.bestSeenPrice) : '—'}
            </p>
            <p className="text-xs text-white/40 mt-1">
              {mission.lastCheckedAt
                ? `checked ${timeAgo(mission.lastCheckedAt)}`
                : 'not yet checked'}
            </p>
          </div>
        </div>

        {/* Budget gauge */}
        {mission.bestSeenPrice && (
          <div className="mt-6">
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-white/30 mt-1.5">
              <span>$0</span>
              {mission.autoBuyThresholdUsd && (
                <span>auto @ {formatUsd(mission.autoBuyThresholdUsd)}</span>
              )}
              <span>max {formatUsd(mission.maxBudgetUsd)}</span>
            </div>
          </div>
        )}
      </Card>

      {/* Statistical prediction panel — the brain of the agent */}
      {prediction && <PredictionPanel snapshot={prediction} />}

      {/* Pending proposal */}
      {pendingProposal && <ProposalCard
        proposal={pendingProposal}
        onConfirm={() => handleConfirm(pendingProposal.id)}
        onDecline={() => handleDecline(pendingProposal.id)}
        busy={busy}
      />}

      {/* Completed / auto-bought */}
      {completedProposal && (
        <BookedCard proposal={completedProposal} mission={mission} />
      )}

      {/* Awaiting payment CTA */}
      {mission.status === 'awaiting_payment' && (
        <Card>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex-1">
              <p className="text-white font-medium">
                {mission.paymentRail === 'wallet'
                  ? 'Approve USDC and deposit into the escrow to start monitoring.'
                  : 'Add your card to place the authorization hold.'}
              </p>
              <p className="text-sm text-white/50 mt-1">
                Your funds stay with you until the agent finds a matching
                flight.{' '}
                {mission.paymentRail === 'stripe'
                  ? 'Stripe holds the authorization — never charged until we find your flight.'
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
        <h2 className="text-sm font-semibold text-white/70 mb-3">
          Activity log
        </h2>
        <div className="space-y-2">
          {data?.proposals.length === 0 && (
            <p className="text-sm text-white/30">
              No agent actions yet. The monitor runs every few hours, or click
              "Check now" above to trigger a scan.
            </p>
          )}
          {data?.proposals.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5 text-sm"
            >
              <div>
                <p className="text-white/80">
                  {p.status === 'auto_bought'
                    ? '⚡ Auto-bought'
                    : p.status === 'confirmed'
                    ? '✅ Confirmed'
                    : p.status === 'declined'
                    ? '✖ Declined'
                    : p.status === 'expired'
                    ? '⏳ Expired'
                    : '📨 Proposal sent'}
                </p>
                <p className="text-xs text-white/40">
                  {p.offerSnapshot.airline} · {formatUsd(p.offerSnapshot.priceUsd)}{' '}
                  · {timeAgo(p.createdAt)}
                </p>
              </div>
              {p.captureTxHash && (
                <a
                  href={`https://basescan.org/tx/${p.captureTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-amber-300 underline font-mono"
                >
                  {p.captureTxHash.slice(0, 10)}…
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <Link
          href="/missions"
          className="text-sm text-white/40 hover:text-white transition-colors"
        >
          ← All missions
        </Link>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------
// Sub-components (hoisted per React best practices — never defined
// inside the parent component so they don't re-mount on every render)
// -------------------------------------------------------------------

function ProposalCard({
  proposal,
  onConfirm,
  onDecline,
  busy,
}: {
  proposal: MissionProposal;
  onConfirm: () => void;
  onDecline: () => void;
  busy: string | null;
}) {
  const o = proposal.offerSnapshot;
  return (
    <Card className="border-amber-400/30 bg-amber-500/[0.02]">
      <div className="flex items-start gap-3">
        <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse mt-2" />
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wider text-amber-300 font-semibold">
            Agent found a match
          </p>
          <p className="text-lg text-white mt-1">{proposal.reason}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-center">
        <div className="flex items-center gap-3">
          {o.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={o.logoUrl}
              alt={o.airline}
              className="h-10 w-10 rounded-lg bg-white/5"
            />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center text-xs text-white/60">
              {o.airlineCode || '?'}
            </div>
          )}
          <div>
            <p className="text-white font-medium">{o.airline}</p>
            <p className="text-xs text-white/40">
              {o.originIata} → {o.destinationIata} ·{' '}
              {o.stops === 0 ? 'Non-stop' : `${o.stops} stop${o.stops > 1 ? 's' : ''}`}{' '}
              · {Math.floor(o.durationMinutes / 60)}h{' '}
              {o.durationMinutes % 60}m
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-white">
            ${o.priceUsd}
          </p>
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <Button onClick={onConfirm} disabled={!!busy}>
          {busy === 'confirm' ? 'Charging…' : 'Confirm & Book'}
        </Button>
        <Button variant="ghost" onClick={onDecline} disabled={!!busy}>
          Not this one
        </Button>
      </div>
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
        <div className="flex items-start gap-3">
          <div className="h-2 w-2 rounded-full bg-sky-400 animate-pulse mt-2" />
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wider text-sky-300 font-semibold">
              Agent intelligence · learning
            </p>
            <p className="text-sm text-white mt-1">
              Flyeas is building a statistical baseline for this route. I have{' '}
              <span className="text-white font-semibold">
                {coverage.samples}
              </span>{' '}
              observation{coverage.samples === 1 ? '' : 's'} so far — I'll start
              making confident predictions once I've seen around 10 price
              points. In the meantime I'm watching the market and recording
              every scan.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const actionColor =
    prediction.action === 'BUY_NOW'
      ? { border: 'border-emerald-400/30', bg: 'bg-emerald-500/[0.04]', text: 'text-emerald-300', label: 'STRONG BUY' }
      : prediction.action === 'WAIT'
      ? { border: 'border-sky-400/30', bg: 'bg-sky-500/[0.04]', text: 'text-sky-300', label: 'WAIT' }
      : { border: 'border-amber-400/30', bg: 'bg-amber-500/[0.03]', text: 'text-amber-300', label: 'MONITOR' };

  const confidencePct = Math.round(prediction.confidence * 100);
  const pricesForSparkline = sparkline.map((p) => p.priceUsd);
  const sparklineMin = pricesForSparkline.length > 0 ? Math.min(...pricesForSparkline) : 0;
  const sparklineMax = pricesForSparkline.length > 0 ? Math.max(...pricesForSparkline) : 1;
  const sparklineRange = Math.max(1, sparklineMax - sparklineMin);

  return (
    <Card className={`${actionColor.border} ${actionColor.bg}`}>
      {/* Top: action badge + confidence */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-white/40 font-semibold">
            Agent intelligence
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-lg font-bold tracking-tight ${actionColor.text}`}
            >
              {actionColor.label}
            </span>
            <span className="text-[11px] text-white/40">
              · {coverage.samples} samples · {coverage.label}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wider text-white/40 font-semibold">
            Confidence
          </p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-white">{confidencePct}</span>
            <span className="text-xs text-white/40">%</span>
          </div>
        </div>
      </div>

      {/* Confidence meter */}
      <div className="mt-3">
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className={`h-full transition-all duration-700 ${
              prediction.action === 'BUY_NOW'
                ? 'bg-emerald-400'
                : prediction.action === 'WAIT'
                ? 'bg-sky-400'
                : 'bg-amber-400'
            }`}
            style={{ width: `${confidencePct}%` }}
          />
        </div>
      </div>

      {/* Reason — the natural-language explanation */}
      <p className="text-sm text-white/80 mt-4 leading-relaxed">
        {prediction.reason}
      </p>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/5">
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
        <div className="mt-5 pt-4 border-t border-white/5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-wider text-white/40 font-semibold">
              30-day price memory
            </p>
            <p className="text-[10px] text-white/30 font-mono">
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
                        ? 'rgba(245, 158, 11, 0.8)'
                        : 'rgba(255, 255, 255, 0.18)',
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
        <details className="mt-4 pt-3 border-t border-white/5">
          <summary className="text-[11px] uppercase tracking-wider text-white/40 font-semibold cursor-pointer hover:text-white/60">
            Raw statistics ▾
          </summary>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-3 text-xs">
            <MiniStat label="mean" value={`$${Math.round(baseline.mean)}`} />
            <MiniStat label="median" value={`$${Math.round(baseline.median)}`} />
            <MiniStat label="σ" value={`$${Math.round(baseline.stdev)}`} />
            <MiniStat label="p10" value={`$${Math.round(baseline.p10)}`} />
            <MiniStat label="p50" value={`$${Math.round(baseline.p50)}`} />
            <MiniStat label="p90" value={`$${Math.round(baseline.p90)}`} />
          </div>
          <p className="text-[10px] text-white/30 mt-3 font-mono">
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
      <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
        {label}
      </p>
      <p className="text-base font-semibold text-white mt-0.5 font-mono">
        {value}
      </p>
      {sub && <p className="text-[10px] text-white/40 mt-0.5">{sub}</p>}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase text-white/30 font-mono">{label}</p>
      <p className="text-xs text-white/70 font-mono">{value}</p>
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
    <Card className="border-emerald-400/30 bg-emerald-500/[0.03]">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-emerald-400/15 flex items-center justify-center text-emerald-300 text-lg">
          ✓
        </div>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wider text-emerald-300 font-semibold">
            {proposal.status === 'auto_bought' ? 'Auto-bought' : 'Booked'}
          </p>
          <p className="text-lg text-white">
            {o.airline} · {formatUsd(captured)}
          </p>
          {refunded > 0 && (
            <p className="text-sm text-emerald-300 mt-1">
              💰 {formatUsd(refunded)} released back to your{' '}
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
            className="block w-full text-center bg-white text-black py-2.5 rounded-lg font-medium hover:bg-white/90 transition-colors"
          >
            Complete booking on Kiwi →
          </a>
          <p className="text-[11px] text-white/30 text-center mt-2">
            Deep-link pre-fills this exact flight. Kiwi is the IATA-accredited
            merchant that issues the ticket.
          </p>
        </div>
      )}
    </Card>
  );
}
