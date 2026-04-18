'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useLocale } from '@/lib/i18n';

/* ── Types ── */

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

/* ── Constants ── */

const STORAGE_KEY = 'flyeas_chat_history';
const MAX_MESSAGES = 50;

/* ── Helpers ── */

function renderMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('- ') || line.startsWith('\u2022 ')) {
      const content = line.startsWith('- ') ? line.slice(2) : line.slice(2);
      return (
        <div key={i} className="flex gap-2 ml-0.5 my-0.5">
          <span className="text-[var(--flyeas-accent)] mt-px text-[10px]">{'\u25CF'}</span>
          <span>{renderInline(content)}</span>
        </div>
      );
    }
    if (line.trim() === '') return <div key={i} className="h-1.5" />;
    return (
      <div key={i} className="my-0.5">
        {renderInline(line)}
      </div>
    );
  });
}

function renderInline(t: string): React.ReactNode {
  const parts = t.split(/(\*\*[^*]+\*\*|https?:\/\/[^\s]+)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-white">
          {p.slice(2, -2)}
        </strong>
      );
    }
    if (/^https?:\/\//.test(p)) {
      return (
        <a
          key={i}
          href={p}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-[var(--flyeas-accent)] hover:text-[var(--flyeas-accent)]/80 break-all"
        >
          {p}
        </a>
      );
    }
    return p;
  });
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

function loadHistory(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Message[];
    return Array.isArray(parsed) ? parsed.slice(-MAX_MESSAGES) : [];
  } catch (_) {
    return [];
  }
}

function saveHistory(messages: Message[]) {
  try {
    const trimmed = messages.slice(-MAX_MESSAGES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (_) {}
}

/* ── Result Card Component ── */

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
              <span className="text-white/20">{'\u2192'}</span>
              <span className="font-semibold text-white/80">{card.to}</span>
              {card.arrival && <span className="text-white/30">{formatClock(card.arrival)}</span>}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-white/40">
              <span>{formatDur(card.durationMinutes)}</span>
              <span>{'\u00B7'}</span>
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
            {card.stars > 0 && <span className="text-[var(--flyeas-accent)]">{'\u2605'.repeat(card.stars)}</span>}
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

/* ── Plane Icon ── */

function PlaneIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#D4A24C"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  );
}

/* ── Typing Indicator ── */

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-3 max-w-[88%]">
        <div
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full self-end"
          style={{
            background: 'linear-gradient(135deg, rgba(212,162,76,0.2), rgba(212,162,76,0.05))',
            border: '1px solid rgba(212,162,76,0.2)',
          }}
        >
          <PlaneIcon size={13} />
        </div>
        <div
          className="flex items-center gap-2 rounded-2xl rounded-bl-md px-4 py-3"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="flex gap-1 items-center">
            <div className="w-2 h-2 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-[11px] text-white/30 ml-1">Searching...</span>
        </div>
      </div>
    </div>
  );
}

/* ── Main Chat Panel ── */

export default function ChatPanel() {
  const pathname = usePathname();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const QUICK_ACTIONS = [
    t('chat.findFlight'),
    t('chat.findHotel'),
    t('chat.bestTime'),
    t('chat.howItWorks'),
    t('chat.createMission'),
    t('chat.comparePrices'),
  ];

  const showFab = pathname !== '/' && !pathname?.startsWith('/legal') && !pathname?.startsWith('/onboarding');

  // Load history on mount
  useEffect(() => {
    setMounted(true);
    const stored = loadHistory();
    if (stored.length > 0) {
      setMessages(stored);
    } else {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: t('chat.welcome'),
          timestamp: Date.now(),
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist history
  useEffect(() => {
    if (mounted && messages.length > 0) saveHistory(messages);
  }, [messages, mounted]);

  // Auto-scroll to bottom
  const scroll = useCallback(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), []);
  useEffect(() => {
    scroll();
  }, [messages, loading, scroll]);

  // Focus input when opened (retry focus in case animation delays)
  useEffect(() => {
    if (!open) return;
    const timers = [50, 200, 400].map((delay) =>
      setTimeout(() => inputRef.current?.focus(), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [open]);

  // Escape to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) setOpen(false);
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  }, [input]);

  function clearChat() {
    const fresh: Message[] = [
      {
        id: 'welcome',
        role: 'assistant',
        content: t('chat.welcome'),
        timestamp: Date.now(),
      },
    ];
    setMessages(fresh);
    saveHistory(fresh);
  }

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: msg,
      timestamp: Date.now(),
    };

    setMessages((p) => [...p, userMsg]);
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
          content: t('chat.connectionError'),
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
      // Re-focus input after sending
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      {/* Floating button */}
      {!open && showFab && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50 flex h-[52px] w-[52px] md:h-12 md:w-12 items-center justify-center rounded-full transition-all duration-300 hover:scale-105 active:scale-95"
          style={{
            background: 'rgba(212,162,76,0.15)',
            border: '1px solid rgba(212,162,76,0.3)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 0 20px rgba(212,162,76,0.2)',
          }}
          aria-label="Open AI assistant"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D4A24C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <span
            className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#09090B]"
            style={{ background: '#22c55e' }}
          />
        </button>
      )}

      {/* Backdrop — only covers viewport when open */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:bg-black/25"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Chat panel — mobile fullscreen, desktop floating */}
      {open && (
        <div
          className="fixed z-50 flex flex-col inset-0 md:inset-auto md:bottom-6 md:right-6 md:w-[400px] md:h-[600px] md:max-h-[calc(100vh-3rem)] md:rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(9,9,11,0.98)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,162,76,0.05)',
            animation: 'flyeas-slide-up 0.35s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(212,162,76,0.2), rgba(212,162,76,0.05))',
                  border: '1px solid rgba(212,162,76,0.25)',
                }}
              >
                <PlaneIcon size={20} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">{t('chat.title')}</h2>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[11px] text-white/40">{t('chat.subtitle')}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/5 transition"
                aria-label={t('chat.clearChat')}
                title={t('chat.clearChat')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" />
                  <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
              </button>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/5 transition"
                aria-label={t('chat.close')}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4" style={{ scrollBehavior: 'smooth' }}>
            {messages.map((msg) => (
              <div key={msg.id}>
                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex items-end gap-2.5 max-w-[88%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    {msg.role === 'assistant' ? (
                      <div
                        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
                        style={{
                          background: 'linear-gradient(135deg, rgba(212,162,76,0.2), rgba(212,162,76,0.05))',
                          border: '1px solid rgba(212,162,76,0.2)',
                        }}
                      >
                        <PlaneIcon size={13} />
                      </div>
                    ) : (
                      <div
                        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white/70"
                        style={{
                          background: 'rgba(255,255,255,0.08)',
                          border: '1px solid rgba(255,255,255,0.12)',
                        }}
                      >
                        U
                      </div>
                    )}

                    <div
                      className={`rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
                        msg.role === 'user' ? 'rounded-br-md' : 'rounded-bl-md'
                      }`}
                      style={
                        msg.role === 'user'
                          ? {
                              background: 'rgba(212,162,76,0.1)',
                              border: '1px solid rgba(212,162,76,0.2)',
                              color: 'white',
                            }
                          : {
                              background: 'rgba(255,255,255,0.03)',
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
                            color: 'rgba(255,255,255,0.25)',
                            textAlign: msg.role === 'user' ? 'right' : 'left',
                          }}
                        >
                          {formatTime(msg.timestamp)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {msg.cards && msg.cards.length > 0 && (
                  <div className="mt-2 space-y-2 ml-9">
                    {msg.cards.map((c, idx) => (
                      <ResultCardView key={idx} card={c} featured={idx === 0} />
                    ))}
                  </div>
                )}

                {msg.quickActions && msg.quickActions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 ml-9">
                    {msg.quickActions.map((a) => (
                      <button
                        key={a}
                        onClick={() => send(a)}
                        disabled={loading}
                        className="rounded-full px-3 py-1.5 text-[11px] font-medium transition disabled:opacity-40"
                        style={{
                          background: 'rgba(212,162,76,0.08)',
                          border: '1px solid rgba(212,162,76,0.15)',
                          backdropFilter: 'blur(8px)',
                          WebkitBackdropFilter: 'blur(8px)',
                          color: '#D4A24C',
                        }}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && <TypingIndicator />}

            <div ref={endRef} />
          </div>

          {/* Quick Action Chips */}
          {!loading && messages.length <= 2 && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-2 flex-shrink-0">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action}
                  onClick={() => send(action)}
                  disabled={loading}
                  className="rounded-full px-3 py-1.5 text-xs font-medium transition hover:bg-white/[0.06] disabled:opacity-40"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    color: 'rgba(255,255,255,0.55)',
                  }}
                >
                  {action}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--line-1)', paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}>
            <div
              className="flex items-end gap-2 rounded-2xl px-3 py-2 transition-all focus-within:border-[rgba(212,162,76,0.3)]"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('chat.placeholder')}
                rows={1}
                autoComplete="off"
                spellCheck={true}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 outline-none resize-none py-1.5 leading-5 max-h-[140px]"
                style={{ fontFamily: 'inherit' }}
              />
              <button
                type="button"
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-all disabled:opacity-25 active:scale-95"
                style={{
                  background:
                    input.trim() && !loading
                      ? 'linear-gradient(135deg, #D4A24C, #F97316)'
                      : 'rgba(255,255,255,0.04)',
                  border: '1px solid transparent',
                }}
                aria-label="Send message"
              >
                {loading ? (
                  <span className="h-3.5 w-3.5 rounded-full border-[1.5px] border-white/30 border-t-white animate-spin" />
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={input.trim() ? 'white' : 'rgba(255,255,255,0.4)'}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12l14-7-3 7 3 7z" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-[10px] text-white/20 text-center mt-2 hidden md:block">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}

    </>
  );
}
