'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface MissionOffer {
  id: string;
  airline: string;
  price: number;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: number;
  carbonKg?: number;
  cabinBag?: boolean;
  score?: number;
  label?: string;
}

interface AgentDecision {
  action: string;
  confidence: number;
  reason: string;
  selectedOffer?: string;
}

interface MissionData {
  id: string;
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  status: string;
  maxBudget: number;
  autoBuyThreshold?: number;
  ecoPreference?: string;
  deposited?: number;
  available?: number;
  used?: number;
  offers?: MissionOffer[];
  agentDecision?: AgentDecision;
}

export default function MissionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [mission, setMission] = useState<MissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/mission/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((data) => {
        setMission(data.mission ?? data);
        setError(false);
      })
      .catch(() => {
        setError(true);
        setMission(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const actionColor = (a: string) => {
    if (a === 'AUTO_BUY') return 'success' as const;
    if (a === 'RECOMMEND') return 'highlight' as const;
    return 'warning' as const;
  };

  /* Loading state */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          <p className="text-sm text-white/40">Loading mission...</p>
        </div>
      </div>
    );
  }

  /* Empty / error state */
  if (error || !mission) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass rounded-2xl p-10 text-center max-w-md">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 mx-auto mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
          </div>
          <p className="text-white/50 text-sm">Mission not found or still loading</p>
          <Button variant="secondary" size="sm" className="mt-6" onClick={() => router.push('/missions')}>
            Back to Missions
          </Button>
        </div>
      </div>
    );
  }

  const offers = mission.offers ?? [];
  const agentDecision = mission.agentDecision;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8 space-y-6 fade-in">
      {/* Header */}
      <Card padding="lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <Badge variant="success">{mission.status}</Badge>
              <span className="text-xs text-white/30 font-mono">#{id}</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              {mission.origin} <span className="text-amber-300">{'\u2192'}</span> {mission.destination}
            </h1>
            <p className="text-sm text-white/50 mt-2">
              {mission.departDate}
              {mission.returnDate ? ` \u2013 ${mission.returnDate}` : ''}
              {mission.ecoPreference ? ` \u00b7 Eco: ${mission.ecoPreference}` : ''}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-xs text-white/45 uppercase tracking-wider">Budget</p>
              <p className="text-xl font-bold text-white mt-1">${mission.maxBudget}</p>
            </div>
            {mission.autoBuyThreshold != null && (
              <div className="glass rounded-xl p-4 text-center">
                <p className="text-xs text-white/45 uppercase tracking-wider">Auto-buy</p>
                <p className="text-xl font-bold text-amber-300 mt-1">${mission.autoBuyThreshold}</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* Offers */}
          {offers.length > 0 ? (
            <Card padding="lg">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-white">Top Offers</h2>
                <span className="text-xs text-white/40">{offers.length} options found</span>
              </div>
              <div className="space-y-3">
                {offers.map((offer, idx) => (
                  <div
                    key={offer.id}
                    className={`rounded-xl p-4 transition-all duration-200 ${
                      idx === 0
                        ? 'border border-amber-400/25 bg-amber-400/[0.07]'
                        : 'bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12]'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm font-semibold text-white">{offer.airline}</span>
                          {idx === 0 && <Badge variant="highlight" size="sm">Best</Badge>}
                          {offer.label && <Badge variant="default" size="sm">{offer.label}</Badge>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-white/50">
                          <span>{offer.departureTime} {'\u2192'} {offer.arrivalTime}</span>
                          <span>{'\u00b7'}</span>
                          <span>{offer.duration}</span>
                          <span>{'\u00b7'}</span>
                          <span>{offer.stops === 0 ? 'Nonstop' : `${offer.stops} stop`}</span>
                          {offer.carbonKg != null && (
                            <>
                              <span>{'\u00b7'}</span>
                              <span>{offer.carbonKg} kg CO2</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {offer.score != null && (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${offer.score}%`,
                                  background: offer.score >= 85 ? 'linear-gradient(90deg, #D4A24C, #10b981)' : 'linear-gradient(90deg, #F97316, #D4A24C)',
                                }}
                              />
                            </div>
                            <span className="text-xs text-white/50 w-6">{offer.score}</span>
                          </div>
                        )}
                        <p className="text-xl font-bold text-white min-w-[70px] text-right">${offer.price}</p>
                        <Button variant={idx === 0 ? 'primary' : 'secondary'} size="sm">Select</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card padding="lg">
              <div className="flex flex-col items-center py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/5 mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </div>
                <p className="text-white/50 text-sm">No offers found yet. The agent is still searching.</p>
              </div>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Agent Decision */}
          {agentDecision && (
            <Card padding="md">
              <h3 className="text-xs font-semibold text-white/45 uppercase tracking-widest mb-4">Agent Decision</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant={actionColor(agentDecision.action)} size="md">
                    {agentDecision.action === 'RECOMMEND' ? 'Recommending' : agentDecision.action}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-400"
                        style={{ width: `${agentDecision.confidence}%` }}
                      />
                    </div>
                    <span className="text-xs text-white/60 font-mono">{agentDecision.confidence}%</span>
                  </div>
                </div>
                <p className="text-sm text-white/70 leading-relaxed">{agentDecision.reason}</p>
              </div>
            </Card>
          )}

          {/* Budget Pool */}
          {mission.deposited != null && (
            <Card padding="md">
              <h3 className="text-xs font-semibold text-white/45 uppercase tracking-widest mb-4">Budget Pool</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Deposited</span>
                  <span className="text-white font-semibold">${mission.deposited} USDC</span>
                </div>
                {mission.available != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Available</span>
                    <span className="text-emerald-300 font-semibold">${mission.available} USDC</span>
                  </div>
                )}
                {mission.used != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Used</span>
                    <span className="text-white/60">${mission.used} USDC</span>
                  </div>
                )}
                <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden mt-2">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${((mission.deposited - (mission.used ?? 0)) / mission.deposited) * 100}%`,
                      background: 'linear-gradient(90deg, #D4A24C, #10b981)',
                    }}
                  />
                </div>
              </div>
            </Card>
          )}

          {/* Back button */}
          <Button
            variant="secondary"
            fullWidth
            size="lg"
            onClick={() => router.push('/missions')}
            icon={
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 9H3M3 9l5-5M3 9l5 5" />
              </svg>
            }
          >
            Back to Missions
          </Button>
        </div>
      </div>
    </div>
  );
}
