'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';

/**
 * Revolutionary natural-language trip planner hero.
 *
 * The user types ONE sentence like "4 days in Barcelona from Paris next month
 * under $800" and instantly gets a complete trip plan with:
 *  - Real flights (live from Kiwi.com / Sky-Scrapper)
 *  - Real hotels (live from Sky-Scrapper with photos)
 *  - Budget check (total vs. their constraint)
 *
 * This is Flyeas's unique differentiator vs. every other travel site.
 */

interface Flight {
  id: string;
  airline: string;
  airlineCode: string;
  flightNumber: string;
  priceUsd: number;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  stops: number;
  originIata: string;
  destinationIata: string;
  logoUrl?: string;
  deepLink?: string;
}

interface Hotel {
  id: string;
  name: string;
  stars: number;
  priceUsd: number;
  pricePerNight: number;
  guestRating: number;
  reviewCount: number;
  address: string;
  photos: string[];
  partner?: string;
}

interface PlanResult {
  success: boolean;
  error?: string;
  parsed: {
    origin?: string;
    destination?: string;
    departDate?: string;
    returnDate?: string;
    nights?: number;
    budget?: number;
    travelers: number;
  };
  flights: Flight[];
  hotels: Hotel[];
  flightsError?: string;
  hotelsError?: string;
  destinationName?: string;
  summary?: {
    cheapestFlight: number;
    cheapestHotelTotal: number;
    estimatedTotal: number;
    withinBudget?: boolean;
    budget?: number;
  };
}

const EXAMPLE_PROMPTS = [
  '4 days in Barcelona from Paris next month under $800',
  'Cheap flight from London to Tokyo in December',
  'A week in Dubai from New York with 2 travelers',
  'Weekend in Rome from Madrid',
  'Budget trip to Bali from Sydney',
];

function formatTime(iso: string): string {
  if (!iso) return '--:--';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch (_) {
    return iso.slice(0, 5);
  }
}

function formatDuration(mins: number): string {
  if (!mins) return '--';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export default function TripPlannerHero() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [typed, setTyped] = useState('');
  const [listening, setListening] = useState(false);
  const [copied, setCopied] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Rotating typewriter placeholder — slowed down so humans can actually
  // read each example prompt before it cycles.
  useEffect(() => {
    if (prompt || loading || result) return;
    const full = EXAMPLE_PROMPTS[placeholderIdx];
    let i = 0;
    let cancelled = false;
    setTyped('');
    const type = () => {
      if (cancelled) return;
      if (i < full.length) {
        setTyped(full.slice(0, i + 1));
        i++;
        // Slower typing: 55-85ms per char (was 40-70ms)
        setTimeout(type, 55 + Math.random() * 30);
      } else {
        // Hold the fully-typed example for 4s (was 2.2s) before cycling
        setTimeout(() => {
          if (!cancelled) setPlaceholderIdx((p) => (p + 1) % EXAMPLE_PROMPTS.length);
        }, 4000);
      }
    };
    type();
    return () => {
      cancelled = true;
    };
  }, [placeholderIdx, prompt, loading, result]);

  const handlePlan = useCallback(
    async (text?: string) => {
      const q = (text ?? prompt).trim();
      if (!q || loading) return;
      setPrompt(q);
      setLoading(true);
      setResult(null);

      // Update URL so the plan is shareable
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('q', q);
        window.history.replaceState({}, '', url.toString());
      } catch (_) {}

      try {
        const res = await fetch('/api/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: q }),
        });
        const data = await res.json();
        setResult(data);
        setTimeout(
          () => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
          100
        );
      } catch (err: any) {
        setResult({
          success: false,
          error: err?.message || 'Network error',
          parsed: { travelers: 1 },
          flights: [],
          hotels: [],
        });
      } finally {
        setLoading(false);
      }
    },
    [prompt, loading]
  );

  // Auto-run from shareable URL on mount
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('q');
      if (q) {
        setPrompt(q);
        // Kick off after a tiny delay so the UI shows the prompt
        setTimeout(() => handlePlan(q), 200);
      }
    } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Voice support detection
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setVoiceSupported(!!SR);
  }, []);

  function startVoice() {
    if (typeof window === 'undefined') return;
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.onresult = (e: any) => {
      const transcript = e.results[0]?.[0]?.transcript || '';
      if (transcript) {
        setPrompt(transcript);
        setTimeout(() => handlePlan(transcript), 300);
      }
    };
    recognitionRef.current = rec;
    try {
      rec.start();
    } catch (_) {
      setListening(false);
    }
  }

  function stopVoice() {
    try {
      recognitionRef.current?.stop();
    } catch (_) {}
    setListening(false);
  }

  async function sharePlan() {
    if (!prompt) return;
    const url = new URL(window.location.origin);
    url.searchParams.set('q', prompt);
    const shareUrl = url.toString();
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'My Flyeas trip plan',
          text: prompt,
          url: shareUrl,
        });
        return;
      }
    } catch (_) {}
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Prompt box */}
      <div
        className="relative rounded-2xl overflow-hidden transition-all bg-[#111113] border border-white/[0.08] shadow-xl"
      >
        <div className="flex items-center gap-3 px-5 pt-5">
          <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
          <p className="text-[11px] uppercase tracking-[0.1em] text-white/30 font-medium">
            Describe your trip — live prices in seconds
          </p>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handlePlan();
            }
          }}
          placeholder={typed || EXAMPLE_PROMPTS[0]}
          rows={2}
          disabled={loading}
          className="w-full bg-transparent px-5 pt-4 pb-4 text-base md:text-lg text-white/90 placeholder:text-white/20 outline-none resize-none font-light tracking-wide"
          style={{ fontFamily: 'inherit', lineHeight: '1.6' }}
        />

        <div className="flex items-center justify-between px-5 pb-5 flex-wrap gap-3">
          <div className="flex items-center gap-2 text-[11px] text-white/40">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 4v4l2 2" strokeLinecap="round" />
            </svg>
            <span>Live data · Kiwi.com · Sky-Scrapper</span>
          </div>
          <div className="flex items-center gap-2">
            {voiceSupported && (
              <button
                onClick={listening ? stopVoice : startVoice}
                disabled={loading}
                aria-label={listening ? 'Stop listening' : 'Speak your trip'}
                title={listening ? 'Stop listening' : 'Speak your trip'}
                className="flex h-11 w-11 items-center justify-center rounded-xl transition disabled:opacity-40"
                style={{
                  background: listening
                    ? 'linear-gradient(135deg, #EF4444, #F97316)'
                    : 'rgba(255,255,255,0.04)',
                  border: listening
                    ? '1px solid rgba(239,68,68,0.4)'
                    : '1px solid rgba(255,255,255,0.08)',
                  animation: listening ? 'pulse 1.5s ease-in-out infinite' : undefined,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={listening ? 'white' : 'rgba(255,255,255,0.6)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 10a7 7 0 0014 0" />
                  <path d="M12 17v4" />
                  <path d="M8 21h8" />
                </svg>
              </button>
            )}
            {result?.success && prompt && (
              <button
                onClick={sharePlan}
                className="flex items-center gap-1.5 px-3 h-11 rounded-xl text-xs font-semibold transition"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.7)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <path d="M8.59 13.51l6.83 3.98" />
                  <path d="M15.41 6.51l-6.82 3.98" />
                </svg>
                {copied ? 'Copied!' : 'Share'}
              </button>
            )}
            <button
              onClick={() => handlePlan()}
              disabled={loading || !prompt.trim()}
              className="rounded-xl px-6 h-11 text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-40 bg-accent text-white hover:bg-accent-light transition-colors"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Planning…
                </>
              ) : (
                <>
                  Plan my trip
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Example chips */}
      {!result && !loading && (
        <div className="mt-4 flex flex-wrap gap-2 justify-center">
          {EXAMPLE_PROMPTS.slice(0, 3).map((ex) => (
            <button
              key={ex}
              onClick={() => handlePlan(ex)}
              className="text-[11px] px-3 py-1.5 rounded-full transition hover:bg-white/[0.06] bg-white/[0.02] border border-white/[0.06]"
              style={{
                color: 'rgba(255,255,255,0.4)',
              }}
            >
              "{ex}"
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {result && (
        <div ref={resultsRef} className="mt-8 space-y-5">
          {!result.success && result.error && (
            <div
              className="rounded-2xl p-5 bg-amber-500/[0.04] border border-amber-500/15"
            >
              <p className="text-sm text-amber-200">{result.error}</p>
            </div>
          )}

          {result.success && (
            <>
              {/* Summary card */}
              <div
                className="rounded-2xl p-6 bg-emerald-500/[0.04] border border-emerald-500/15"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-emerald-300/80 font-bold">
                      Trip plan for {result.destinationName || result.parsed.destination}
                    </p>
                    <p className="text-lg md:text-xl font-semibold text-white mt-1">
                      {result.parsed.origin ? `${result.parsed.origin} → ` : ''}
                      {result.parsed.destination}
                      {result.parsed.nights ? ` · ${result.parsed.nights} ${result.parsed.nights === 1 ? 'night' : 'nights'}` : ''}
                      {result.parsed.travelers > 1 ? ` · ${result.parsed.travelers} travelers` : ''}
                    </p>
                    <p className="text-xs text-white/50 mt-1">
                      {result.parsed.departDate}
                      {result.parsed.returnDate ? ` → ${result.parsed.returnDate}` : ''}
                    </p>
                  </div>
                  {result.summary && result.summary.estimatedTotal > 0 && (
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-widest text-white/40">Estimated total</p>
                      <p className="text-2xl md:text-3xl font-bold text-emerald-300">
                        ${result.summary.estimatedTotal}
                      </p>
                      {result.summary.budget && (
                        <p
                          className={`text-xs mt-0.5 font-medium ${result.summary.withinBudget ? 'text-emerald-400' : 'text-red-300'}`}
                        >
                          {result.summary.withinBudget ? '✓ within' : '✗ over'} ${result.summary.budget} budget
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Flights */}
              {result.flights.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs uppercase tracking-widest font-bold text-amber-300/80 px-1">
                    Top {result.flights.length} flights
                  </h3>
                  {result.flights.map((f, i) => (
                    <div
                      key={f.id}
                      className="rounded-xl p-4 transition"
                      style={{
                        background: i === 0 ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)',
                        border: i === 0 ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {f.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={f.logoUrl} alt={f.airline} className="w-full h-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <span className="text-xs font-bold text-amber-300">{f.airlineCode}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-white truncate">{f.airline}</p>
                            {i === 0 && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold uppercase tracking-wider">
                                Best
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-white/50 mt-0.5">
                            <span>{f.originIata}</span>
                            <span className="text-white/30">{formatTime(f.departureTime)}</span>
                            <span className="text-white/20">→</span>
                            <span>{f.destinationIata}</span>
                            <span className="text-white/30">{formatTime(f.arrivalTime)}</span>
                            <span className="text-white/20">·</span>
                            <span>{formatDuration(f.durationMinutes)}</span>
                            <span className="text-white/20">·</span>
                            <span>{f.stops === 0 ? 'Nonstop' : `${f.stops} stop`}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-lg font-bold text-white">${f.priceUsd}</p>
                            <p className="text-[10px] text-white/40">per person</p>
                          </div>
                          {f.deepLink ? (
                            <a
                              href={f.deepLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs px-3 py-1.5 rounded-lg font-semibold transition"
                              style={{
                                background: 'linear-gradient(135deg, #D4A24C, #F97316)',
                                color: 'white',
                              }}
                            >
                              Book
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {result.flightsError && (
                <p className="text-xs text-white/40 text-center">
                  Flights unavailable for this route right now. {result.flightsError}
                </p>
              )}

              {/* Hotels */}
              {result.hotels.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs uppercase tracking-widest font-bold text-amber-300/80 px-1">
                    Top {result.hotels.length} hotels
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {result.hotels.map((h) => (
                      <div
                        key={h.id}
                        className="rounded-xl overflow-hidden"
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        {h.photos[0] ? (
                          <div
                            className="h-32 bg-white/5"
                            style={{
                              backgroundImage: `url(${h.photos[0]})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                            }}
                          />
                        ) : (
                          <div
                            className="h-32"
                            style={{
                              background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(239,68,68,0.12))',
                            }}
                          />
                        )}
                        <div className="p-3">
                          <p className="text-sm font-semibold text-white truncate">{h.name}</p>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-white/50">
                            {h.stars > 0 && (
                              <span className="text-amber-300">
                                {'★'.repeat(h.stars)}
                              </span>
                            )}
                            {h.guestRating > 0 && (
                              <span className="text-emerald-300">{h.guestRating}/10</span>
                            )}
                          </div>
                          {h.address && (
                            <p className="text-[10px] text-white/35 mt-1 truncate">{h.address}</p>
                          )}
                          <div className="flex items-end justify-between mt-2">
                            <div>
                              <p className="text-base font-bold text-white">${h.pricePerNight || h.priceUsd}</p>
                              <p className="text-[9px] text-white/35">per night</p>
                            </div>
                            <p className="text-[10px] text-white/35">
                              ${h.priceUsd} total
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.hotelsError && (
                <p className="text-xs text-white/40 text-center">
                  Hotels unavailable. {result.hotelsError}
                </p>
              )}

              {/* CTA — save as mission */}
              <div className="text-center pt-2">
                <Link
                  href="/missions/new"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-amber-300 hover:text-amber-200 transition"
                >
                  Save as AI Mission → monitor prices 24/7
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
