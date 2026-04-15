'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';

type FlightCard = {
  kind: 'flight';
  airline: string;
  flightNumber?: string;
  from: string;
  to: string;
  priceUsd: number;
  durationMinutes: number;
  stops: number;
  departure?: string;
  arrival?: string;
};

type HotelCard = {
  kind: 'hotel';
  name: string;
  stars: number;
  pricePerNight?: number;
  totalPrice?: number;
  guestRating?: number;
  reviewCount?: number;
  address?: string;
};

type ResultCard = FlightCard | HotelCard;

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number | null;
  quickActions?: string[];
  cards?: ResultCard[];
};

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hi! I'm **Flyeas** — your AI travel agent.\n\nAsk me to find live flights, real hotels, or compare prices for any route in the world.",
  timestamp: null,
  quickActions: ['Find a flight', 'Find a hotel', 'Best time to book?', 'How it works'],
};

function renderMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('- ')) {
      return (
        <div key={i} className="flex gap-2 ml-0.5 my-0.5">
          <span className="text-[var(--flyeas-accent)] mt-px text-[10px]">●</span>
          <span>{bold(line.slice(2))}</span>
        </div>
      );
    }
    if (line.trim() === '') return <div key={i} className="h-1.5" />;
    return (
      <div key={i} className="my-0.5">
        {bold(line)}
      </div>
    );
  });
}

function bold(t: string): React.ReactNode {
  return t.split(/(\*\*[^*]+\*\*)/).map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? (
      <strong key={i} className="font-semibold text-white">
        {p.slice(2, -2)}
      </strong>
    ) : (
      p
    )
  );
}

function formatTime(ts: number | null): string {
  if (ts === null) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatClock(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch (_) {
    return '';
  }
}

function formatDur(mins: number): string {
  if (!mins) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m ? ` ${m}m` : ''}`;
}

function ResultCardView({ card, featured }: { card: ResultCard; featured?: boolean }) {
  const borderColor = featured ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.08)';
  const bg = featured ? 'rgba(245,158,11,0.07)' : 'rgba(255,255,255,0.03)';

  if (card.kind === 'flight') {
    return (
      <div className="rounded-xl p-3" style={{ background: bg, border: `1px solid ${borderColor}` }}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-semibold text-white truncate">{card.airline}</span>
              {featured && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-[color-mix(in_srgb,var(--flyeas-accent)_25%,transparent)] text-[var(--flyeas-accent)] font-bold uppercase tracking-wider">
                  Best
                </span>
              )}
              {card.flightNumber && (
                <span className="text-[10px] text-white/35 font-mono">{card.flightNumber}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-white/55">
              <span className="font-semibold text-white/80">{card.from}</span>
              {card.departure && <span className="text-white/30">{formatClock(card.departure)}</span>}
              <span className="text-white/20">→</span>
              <span className="font-semibold text-white/80">{card.to}</span>
              {card.arrival && <span className="text-white/30">{formatClock(card.arrival)}</span>}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-white/40">
              <span>{formatDur(card.durationMinutes)}</span>
              <span>·</span>
              <span>{card.stops === 0 ? 'Nonstop' : `${card.stops} stop`}</span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-base font-bold text-white leading-none">${card.priceUsd}</p>
            <p className="text-[9px] text-white/35 mt-0.5">per person</p>
          </div>
        </div>
      </div>
    );
  }

  // Hotel card
  return (
    <div className="rounded-xl p-3" style={{ background: bg, border: `1px solid ${borderColor}` }}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-semibold text-white truncate">{card.name}</span>
            {featured && (
              <span className="text-[8px] px-1 py-0.5 rounded bg-[color-mix(in_srgb,var(--flyeas-accent)_25%,transparent)] text-[var(--flyeas-accent)] font-bold uppercase tracking-wider">
                Top
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 text-[10px]">
            {card.stars > 0 && <span className="text-[var(--flyeas-accent)]">{'★'.repeat(card.stars)}</span>}
            {card.guestRating ? (
              <span className="text-emerald-300 font-semibold">
                {card.guestRating}/10
                {card.reviewCount ? <span className="text-white/40 font-normal ml-0.5">({card.reviewCount})</span> : null}
              </span>
            ) : null}
          </div>
          {card.address && (
            <p className="text-[10px] text-white/35 mt-0.5 truncate">{card.address}</p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-base font-bold text-white leading-none">
            ${card.pricePerNight || card.totalPrice}
          </p>
          <p className="text-[9px] text-white/35 mt-0.5">{card.pricePerNight ? 'per night' : 'total'}</p>
        </div>
      </div>
    </div>
  );
}

export default function ChatPanel() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Only show chat FAB on dashboard
  const showFab = pathname === '/dashboard';

  // Hydrate welcome timestamp after mount (avoids server/client time mismatch)
  useEffect(() => {
    setMounted(true);
    setMessages((prev) =>
      prev.map((m) => (m.id === 'welcome' && m.timestamp === null ? { ...m, timestamp: Date.now() } : m))
    );
  }, []);

  const scroll = useCallback(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), []);
  useEffect(() => {
    scroll();
  }, [messages, scroll]);
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) setOpen(false);
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    setMessages((p) => [
      ...p,
      { id: `u-${Date.now()}`, role: 'user', content: msg, timestamp: Date.now() },
    ]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: messages
            .filter((m) => m.id !== 'welcome')
            .slice(-10)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      setMessages((p) => [
        ...p,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: data.message ?? "Sorry, I couldn't process that.",
          timestamp: Date.now(),
          quickActions: data.quickActions?.length ? data.quickActions : undefined,
          cards: Array.isArray(data.cards) ? data.cards : undefined,
        },
      ]);
    } catch (_) {
      setMessages((p) => [
        ...p,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: 'Connection error. Please try again.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* ── Floating button — dashboard only ── */}
      {!open && showFab && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 lg:bottom-6 lg:right-5 z-[90] flex h-14 w-14 items-center justify-center rounded-2xl shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl"
          style={{
            background: 'var(--flyeas-gradient, linear-gradient(135deg, #E8A317, #F97316, #EF4444))',
            boxShadow: '0 8px 30px color-mix(in srgb, var(--flyeas-accent, #E8A317) 40%, transparent)',
          }}
          aria-label="Open AI assistant"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <span
            className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#09090B]"
            style={{ background: '#22c55e' }}
          />
        </button>
      )}

      {/* ── Backdrop ── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Chat panel ── */}
      <div
        className="fixed z-50 flex flex-col transition-all duration-300 ease-out"
        style={{
          bottom: open ? 0 : '-100%',
          right: 0,
          width: '100%',
          maxWidth: 420,
          height: open ? '100dvh' : 0,
          opacity: open ? 1 : 0,
        }}
      >
        <div
          className="flex h-full flex-col"
          style={{
            background: '#09090B',
            borderLeft: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '-10px 0 50px rgba(0,0,0,0.5)',
          }}
        >
          {/* ── Header ── */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: 'var(--flyeas-gradient, linear-gradient(135deg, #E8A317, #F97316, #EF4444))' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Flyeas AI</h2>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[11px] text-white/40">Live · worldwide search</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/5 transition"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>

          {/* ── Messages ── */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4" style={{ scrollBehavior: 'smooth' }}>
            {messages.map((msg) => (
              <div key={msg.id}>
                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
                      msg.role === 'user' ? 'rounded-br-md' : 'rounded-bl-md'
                    }`}
                    style={
                      msg.role === 'user'
                        ? { background: 'linear-gradient(135deg, #92400E, #B45309)', color: 'white' }
                        : {
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            color: 'rgba(255,255,255,0.85)',
                          }
                    }
                  >
                    {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                    {mounted && msg.timestamp !== null && (
                      <div
                        className="mt-1.5 text-[10px]"
                        style={{
                          color: msg.role === 'user' ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.25)',
                          textAlign: msg.role === 'user' ? 'right' : 'left',
                        }}
                      >
                        {formatTime(msg.timestamp)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Rich cards (real flight/hotel results rendered inline) */}
                {msg.cards && msg.cards.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {msg.cards.map((c, idx) => (
                      <ResultCardView key={idx} card={c} featured={idx === 0} />
                    ))}
                  </div>
                )}

                {msg.quickActions && msg.quickActions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 pl-0.5">
                    {msg.quickActions.map((a) => (
                      <button
                        key={a}
                        onClick={() => send(a)}
                        disabled={loading}
                        className="rounded-lg px-3 py-1.5 text-[11px] font-medium transition hover:bg-[color-mix(in_srgb,var(--flyeas-accent)_15%,transparent)] disabled:opacity-40"
                        style={{
                          background: 'rgba(245,158,11,0.08)',
                          border: '1px solid rgba(245,158,11,0.15)',
                          color: '#FCD34D',
                        }}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div
                  className="flex items-center gap-2 rounded-2xl rounded-bl-md px-4 py-3"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-[color-mix(in_srgb,var(--flyeas-accent)_60%,transparent)]"
                        style={{ animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite` }}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] text-white/30 ml-1">Searching live data…</span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* ── Input ── */}
          <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything…"
                disabled={loading}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/25 outline-none transition"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-all disabled:opacity-25"
                style={{
                  background:
                    input.trim() && !loading
                      ? 'var(--flyeas-gradient, linear-gradient(135deg, #E8A317, #F97316))'
                      : 'rgba(255,255,255,0.04)',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13" />
                  <path d="M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes bounce {
          0%,
          60%,
          100% {
            transform: translateY(0);
            opacity: 0.4;
          }
          30% {
            transform: translateY(-4px);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}
