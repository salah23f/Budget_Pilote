'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import type { Mission } from '@/lib/types';

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  monitoring: { bg: 'bg-emerald-500/10', text: 'text-emerald-300', label: 'Watching' },
  proposal_pending: { bg: 'bg-amber-500/10', text: 'text-amber-300', label: 'Proposal' },
  awaiting_payment: { bg: 'bg-sky-500/10', text: 'text-sky-300', label: 'Awaiting payment' },
  booked: { bg: 'bg-violet-500/10', text: 'text-violet-300', label: 'Booked' },
  completed: { bg: 'bg-white/5', text: 'text-white/50', label: 'Completed' },
  cancelled: { bg: 'bg-white/5', text: 'text-white/30', label: 'Cancelled' },
  expired: { bg: 'bg-white/5', text: 'text-white/30', label: 'Expired' },
  draft: { bg: 'bg-white/5', text: 'text-white/30', label: 'Draft' },
};

function formatUsd(n: number | undefined): string {
  if (!n) return '—';
  return `$${Math.round(n).toLocaleString()}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMissions = useCallback(async () => {
    try {
      // Try the new missions-db store first (file-backed)
      const res = await fetch('/api/missions/list', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.missions)) {
          setMissions(data.missions);
          setError(null);
          return;
        }
      }
      // If the new store isn't wired, we get an empty list which is fine
      setMissions([]);
    } catch (err: any) {
      setError(err?.message || 'Failed to load missions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMissions();
  }, [fetchMissions]);

  return (
    <div className="py-2">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Missions</h1>
            <p className="text-sm text-white/40 mt-1">
              Your AI agents monitoring flights and hotels 24/7
            </p>
          </div>
          <Link
            href="/missions/new"
            className="premium-button rounded-xl px-6 py-3 text-sm font-semibold text-white no-underline inline-block text-center"
            style={{
              background: 'var(--flyeas-gradient, linear-gradient(135deg, #F59E0B, #F97316, #EF4444))',
              boxShadow: '0 6px 20px color-mix(in srgb, var(--flyeas-accent, #F59E0B) 25%, transparent)',
            }}
          >
            + New Mission
          </Link>
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-white/[0.02] animate-pulse" style={{ border: '1px solid rgba(255,255,255,0.05)' }} />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-2xl p-4 bg-red-500/5 border border-red-400/20 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Missions list */}
        {!loading && missions.length > 0 && (
          <div className="grid gap-3">
            {missions.map((m) => {
              const st = STATUS_STYLES[m.status] || STATUS_STYLES.draft;
              return (
                <Link
                  key={m.id}
                  href={`/missions/${m.id}/cockpit`}
                  className="block rounded-2xl p-5 transition-all hover:bg-white/[0.03]"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Route */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-semibold text-white">
                          {m.originCity || m.origin}
                          <span className="text-white/30 mx-1.5">→</span>
                          {m.destinationCity || m.destination}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${st.bg} ${st.text}`}>
                          {st.label}
                        </span>
                        {m.paymentRail && (
                          <span className="text-[10px] text-white/30">
                            {m.paymentRail === 'wallet' ? '🔗 USDC' : '💳 Card'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/40 mt-1">
                        {m.departDate}{m.returnDate ? ` → ${m.returnDate}` : ''} · {m.passengers} pax · {m.cabinClass}
                      </p>
                    </div>

                    {/* Budget + best price */}
                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <p className="text-[10px] uppercase text-white/30">Budget</p>
                        <p className="text-sm font-semibold text-white">{formatUsd(m.maxBudgetUsd)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-white/30">Best seen</p>
                        <p className={`text-sm font-semibold ${m.bestSeenPrice && m.bestSeenPrice <= m.maxBudgetUsd ? 'text-emerald-300' : 'text-white/60'}`}>
                          {formatUsd(m.bestSeenPrice)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-white/30">Checked</p>
                        <p className="text-xs text-white/40">
                          {m.lastCheckedAt ? timeAgo(m.lastCheckedAt) : 'never'}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!loading && missions.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center text-center max-w-sm mx-auto py-16">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full mb-6"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="24" cy="24" r="18" />
                <circle cx="24" cy="24" r="12" />
                <circle cx="24" cy="24" r="6" />
                <circle cx="24" cy="24" r="1.5" fill="rgba(255,255,255,0.2)" />
                <path d="M24 6v4" /><path d="M24 38v4" /><path d="M6 24h4" /><path d="M38 24h4" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white/70 mb-2">No active missions</h2>
            <p className="text-sm text-white/40 mb-8">
              Create a mission to start monitoring flight and hotel prices with AI. Set a budget, and the agent will auto-buy when the price is right.
            </p>
            <Link
              href="/missions/new"
              className="premium-button rounded-xl px-6 py-3 text-sm font-semibold text-white no-underline"
              style={{
                background: 'var(--flyeas-gradient, linear-gradient(135deg, #F59E0B, #F97316, #EF4444))',
                boxShadow: '0 6px 20px color-mix(in srgb, var(--flyeas-accent, #F59E0B) 25%, transparent)',
              }}
            >
              Create your first mission
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
