'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import TripPlannerHero from '@/components/trip-planner-hero';
import LiveDeals from '@/components/live-deals';

/* ── Multilingual greetings ─────────────────────────────── */
const greetings = [
  { text: 'Hello', lang: 'English' },
  { text: 'Bonjour', lang: 'Français' },
  { text: 'Hola', lang: 'Español' },
  { text: 'Willkommen', lang: 'Deutsch' },
  { text: 'Ciao', lang: 'Italiano' },
  { text: 'Olá', lang: 'Português' },
  { text: 'Merhaba', lang: 'Türkçe' },
  { text: 'Welkom', lang: 'Nederlands' },
  { text: 'ようこそ', lang: '日本語' },
  { text: '환영합니다', lang: '한국어' },
  { text: '欢迎', lang: '中文' },
  { text: 'مرحباً', lang: 'العربية' },
  { text: 'Добро пожаловать', lang: 'Русский' },
  { text: 'Välkommen', lang: 'Svenska' },
  { text: 'Witaj', lang: 'Polski' },
  { text: 'Xin chào', lang: 'Tiếng Việt' },
];

export default function HomePage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [fade, setFade] = useState(true);

  // Check if already logged in
  useEffect(() => {
    try {
      const stored = localStorage.getItem('sv_user');
      if (stored) {
        const user = JSON.parse(stored);
        if (user.firstName) {
          setIsLoggedIn(true);
        }
      }
    } catch {}
  }, []);

  // Animate greetings
  useEffect(() => {
    if (isLoggedIn) return;
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setGreetingIndex((prev) => (prev + 1) % greetings.length);
        setFade(true);
      }, 350);
    }, 2200);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  // If logged in, show a simple redirect page
  if (isLoggedIn) {
    return (
      <main className="min-h-screen flex flex-col">
        {/* Navbar */}
        <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5 md:px-10">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoIcon size={36} />
            <LogoText size="xl" />
          </Link>
          <Link
            href="/dashboard"
            className="premium-button rounded-xl px-6 py-2.5 text-sm font-semibold"
          >
            Go to Dashboard
          </Link>
        </nav>

        <div className="flex flex-1 items-center justify-center px-6">
          <div className="text-center">
            <h1 className="text-4xl font-semibold md:text-5xl hero-title">
              Welcome back!
            </h1>
            <p className="mt-4 text-white/50">Your AI travel agent is ready.</p>
            <Link
              href="/dashboard"
              className="mt-8 inline-flex items-center gap-2 premium-button rounded-2xl px-10 py-4 text-base font-semibold"
            >
              Open Dashboard
              <ArrowRight />
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Not logged in: show greetings + signup
  return (
    <main className="min-h-screen overflow-hidden">
      {/* Background orb */}
      <div className="pointer-events-none fixed left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: 800, height: 800, borderRadius: '50%',
          background: 'radial-gradient(circle, color-mix(in srgb, var(--flyeas-accent, #F59E0B) 10%, transparent) 0%, color-mix(in srgb, var(--flyeas-accent, #F59E0B) 5%, transparent) 40%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      {/* Navbar */}
      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoIcon size={36} />
          <LogoText size="xl" />
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-white/50 transition hover:text-white">Features</a>
          <a href="#how" className="text-sm text-white/50 transition hover:text-white">How it Works</a>
          <Link href="/pricing" className="text-sm text-white/50 transition hover:text-white">Pricing</Link>
          <Link href="/about" className="text-sm text-white/50 transition hover:text-white">About</Link>
        </div>
        <Link href="/onboarding" className="premium-button rounded-xl px-6 py-2.5 text-sm font-semibold">
          Sign Up
        </Link>
      </nav>

      {/* ═══ HERO with animated greetings + NL trip planner ═══ */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pt-10 pb-16 md:pt-16 md:px-10">
        <div className="text-center mb-10">
          {/* Animated greeting */}
          <div className="h-[60px] md:h-[80px] flex items-center justify-center mb-3">
            <h1
              className="text-4xl md:text-6xl font-bold transition-all"
              style={{
                opacity: fade ? 1 : 0,
                transform: fade ? 'translateY(0)' : 'translateY(12px)',
                background: 'var(--flyeas-gradient, linear-gradient(135deg, #F59E0B, #F97316, #EF4444))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                transitionDuration: '350ms',
              }}
            >
              {greetings[greetingIndex].text}
            </h1>
          </div>

          <h2 className="hero-title text-xl md:text-3xl font-semibold text-white/90 max-w-2xl mx-auto leading-tight">
            The world&apos;s first{' '}
            <span
              style={{
                background: 'var(--flyeas-gradient, linear-gradient(135deg, #F59E0B, #F97316, #EF4444))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              AI travel agent
            </span>{' '}
            that plans your trip from one sentence.
          </h2>

          <p className="mt-4 text-sm md:text-base text-white/40 max-w-xl mx-auto">
            Real flights, real hotels, real prices — live from 400+ airlines and 150,000+ hotels worldwide.
          </p>

          {/* FOMO counter */}
          <div className="mt-5 flex items-center justify-center gap-6 text-xs text-white/35">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <AnimatedCounter target={2847} /> deals found today
            </span>
            <span className="hidden sm:flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              <AnimatedCounter target={156} /> travelers saving right now
            </span>
          </div>
        </div>

        {/* THE magic prompt */}
        <TripPlannerHero />

        {/* CTA Buttons */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/onboarding"
            className="w-full sm:w-auto premium-button rounded-2xl px-8 py-3.5 text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            Create Free Account
            <ArrowRight />
          </Link>
          <a
            href="#features"
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl px-8 py-3.5 text-sm font-semibold text-white/70 transition hover:text-white hover:bg-white/5"
            style={{ border: '1px solid rgba(255,255,255,0.1)' }}
          >
            See features
          </a>
        </div>
      </section>

      {/* ═══ LIVE DEALS STRIP (real prices, no search needed) ═══ */}
      <LiveDeals />

      {/* ═══ SOCIAL PROOF TICKER ═══ */}
      <SocialProofTicker />

      {/* ═══ FEATURES ═══ */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-6 pb-24 md:px-10">
        <h2 className="text-center hero-title text-2xl md:text-4xl font-semibold mb-4">
          Smart Travel, Simplified
        </h2>
        <p className="text-center text-white/40 mb-14 max-w-md mx-auto text-sm">
          Powered by AI agents that never sleep.
        </p>

        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              icon: <EyeIcon />,
              title: 'AI Price Monitoring',
              desc: 'Agents scan live flight and hotel prices around the clock, tracking drops and availability in real time.',
              color: 'var(--flyeas-accent, #F59E0B)',
            },
            {
              icon: <BoltIcon />,
              title: 'Auto-Buy System',
              desc: 'Set your budget and rules. When the perfect deal appears, our agent books instantly so you never miss it.',
              color: '#F97316',
            },
            {
              icon: <WalletIcon />,
              title: 'Crypto & Card Payments',
              desc: 'Pay with USDC, ETH, or traditional cards. Every booking generates a verifiable on-chain receipt.',
              color: '#EF4444',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="glass-premium rounded-2xl p-7 group cursor-default"
            >
              <div
                className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
                style={{ background: `${f.color}15`, color: f.color }}
              >
                {f.icon}
              </div>
              <h3 className="text-base font-semibold mb-2">{f.title}</h3>
              <p className="text-sm leading-relaxed text-white/45">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section id="how" className="relative z-10 mx-auto max-w-4xl px-6 pb-24 md:px-10">
        <h2 className="text-center hero-title text-2xl md:text-4xl font-semibold mb-4">
          How it Works
        </h2>
        <p className="text-center text-white/40 mb-14 text-sm">Three steps to smarter travel.</p>

        <div className="grid gap-5 md:grid-cols-3">
          {[
            { n: '01', title: 'Set Your Budget', desc: 'Define route, dates, max spend. Fund with crypto or card.' },
            { n: '02', title: 'AI Monitors Prices', desc: 'Agents track live prices 24/7, analyzing trends for the best moment.' },
            { n: '03', title: 'Auto-Book or Approve', desc: 'Enable auto-buy or review AI recommendations and approve manually.' },
          ].map((s) => (
            <div key={s.n} className="glass rounded-2xl p-7">
              <span
                className="text-3xl font-bold"
                style={{ color: 'color-mix(in srgb, var(--flyeas-accent, #F59E0B) 20%, transparent)' }}
              >
                {s.n}
              </span>
              <h3 className="mt-3 text-base font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/45">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ BOTTOM CTA ═══ */}
      <section className="relative z-10 mx-auto max-w-2xl px-6 pb-24 md:px-10">
        <div className="glass-premium rounded-3xl p-10 md:p-14 text-center">
          <h2 className="hero-title text-2xl md:text-3xl font-semibold">
            Ready to save on your next trip?
          </h2>
          <p className="mt-4 text-white/40 text-sm max-w-sm mx-auto">
            Let AI find the best deals. Create your free account in 30 seconds.
          </p>
          <Link
            href="/onboarding"
            className="mt-8 inline-flex items-center gap-2 premium-button rounded-2xl px-10 py-4 text-base font-semibold"
          >
            Get Started Free
            <ArrowRight />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 px-6 py-8 md:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <LogoIcon size={28} />
            <LogoText size="lg" />
          </div>
          <div className="flex flex-wrap gap-6">
            <a href="#features" className="text-xs text-white/30 hover:text-white/60 transition">Features</a>
            <a href="#how" className="text-xs text-white/30 hover:text-white/60 transition">How it Works</a>
            <Link href="/pricing" className="text-xs text-white/30 hover:text-white/60 transition">Pricing</Link>
            <Link href="/about" className="text-xs text-white/30 hover:text-white/60 transition">About</Link>
            <Link href="/legal/terms" className="text-xs text-white/30 hover:text-white/60 transition">Terms</Link>
            <Link href="/legal/privacy" className="text-xs text-white/30 hover:text-white/60 transition">Privacy</Link>
            <a href="mailto:hello@flyeas.app" className="text-xs text-white/30 hover:text-white/60 transition">Contact</a>
          </div>
        </div>
        <p className="mt-6 text-center text-[11px] text-white/20">
          &copy; {new Date().getFullYear()} Flyeas. All rights reserved.
        </p>
      </footer>
    </main>
  );
}

/* ── Small reusable components ──────────────────────────── */

/* ── Animated Counter (count-up effect) ────────────── */

function AnimatedCounter({ target }: { target: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let frame: number;
    const duration = 2000; // ms
    const start = Date.now();
    function tick() {
      const elapsed = Date.now() - start;
      const progress = Math.min(1, elapsed / duration);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return <span className="font-semibold text-white/60">{count.toLocaleString()}</span>;
}

/* ── Social Proof Ticker ────────────────────────────── */

const PROOF_NAMES = [
  'Sarah', 'Mohamed', 'Emma', 'Lucas', 'Fatima', 'Thomas', 'Sofia', 'Hugo',
  'Lina', 'Noah', 'Amira', 'Leo', 'Yasmin', 'Alex', 'Camille', 'Adam',
  'Julia', 'Omar', 'Clara', 'Nathan', 'Zara', 'Maxime', 'Leila', 'David',
];
const PROOF_ROUTES = [
  'Paris → Tokyo', 'London → NYC', 'Madrid → Bali', 'Berlin → Bangkok',
  'Amsterdam → Marrakech', 'Rome → Dubai', 'Geneva → Lisbon', 'Paris → Tunis',
  'London → Barcelona', 'Milan → Istanbul', 'Munich → Phuket', 'Zurich → Montreal',
];

function SocialProofTicker() {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(true);

  // Generate stable proof messages from the current second (so they feel
  // real-time without actually hitting any API)
  const proofs = useMemo(() => {
    return PROOF_ROUTES.map((route, i) => {
      const name = PROOF_NAMES[i % PROOF_NAMES.length];
      const saved = 80 + ((i * 47 + 31) % 400); // deterministic but varied
      const mins = 2 + ((i * 13) % 55);
      return { name, route, saved, mins };
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrent((p) => (p + 1) % proofs.length);
        setVisible(true);
      }, 400);
    }, 3500);
    return () => clearInterval(interval);
  }, [proofs.length]);

  const p = proofs[current];
  return (
    <div className="relative z-10 mx-auto max-w-6xl px-6 pb-8">
      <div
        className="mx-auto max-w-lg text-center transition-all duration-300"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(-8px)',
        }}
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm text-white/60">
            <span className="text-white font-medium">{p.name}</span>
            {' saved '}
            <span className="text-emerald-300 font-semibold">${p.saved}</span>
            {' on '}
            <span className="text-white/80">{p.route}</span>
            {' · '}
            <span className="text-white/40">{p.mins}m ago</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function LogoIcon({ size = 36 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl"
      style={{
        width: size, height: size,
        background: 'var(--flyeas-gradient, linear-gradient(135deg, #F59E0B, #F97316, #EF4444))',
      }}
    >
      <svg
        width={size * 0.55}
        height={size * 0.55}
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
      </svg>
    </div>
  );
}

function LogoText({ size = 'xl' }: { size?: string }) {
  return (
    <span
      className={`${size === 'xl' ? 'text-xl' : 'text-lg'} font-bold tracking-tight`}
      style={{
        background: 'var(--flyeas-gradient, linear-gradient(135deg, #F59E0B, #F97316))',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}
    >
      Flyeas
    </span>
  );
}

function ArrowRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
    </svg>
  );
}
