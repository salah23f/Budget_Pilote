'use client';

import { useState, useEffect } from 'react';
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

/* ── Pricing tiers ─────────────────────────────── */
const TIERS = [
  {
    name: 'Free',
    price: 0,
    desc: 'Get started with AI travel intelligence',
    cta: 'Get started',
    highlight: false,
    features: [
      '1 active mission',
      '3 flight searches / day',
      'Basic price predictions',
      'Deal alerts (daily digest)',
      'Price calendar view',
      'Community support',
    ],
  },
  {
    name: 'Pro',
    price: 9.99,
    desc: 'AI works 24/7 to find your best deals',
    cta: 'Start Pro trial',
    highlight: true,
    badge: 'Most popular',
    features: [
      'Unlimited missions & searches',
      'Full statistical predictions',
      'Auto-buy when price is right',
      'Priority monitoring (15 min)',
      'Real-time push alerts',
      'Price history (90 days)',
      '3x loyalty points',
      'Priority support',
    ],
  },
  {
    name: 'Elite',
    price: 29.99,
    desc: 'Premium experience with dedicated AI agent',
    cta: 'Go Elite',
    highlight: false,
    features: [
      'Everything in Pro',
      'Dedicated AI travel advisor',
      'Group trip builder',
      'Business & First class tracking',
      'Multi-city mission planning',
      '5x loyalty points',
      'Crypto payments (USDC)',
      'White-glove onboarding',
    ],
  },
];

/* (No fake testimonials — reviews come from real users only) */

/* ── FAQ ─────────────────────────────── */
const FAQ_ITEMS = [
  {
    q: 'How does Flyeas find cheaper flights?',
    a: 'Our AI agents monitor live prices from 400+ airlines 24/7 using real-time APIs. We use statistical analysis (z-scores, percentile rankings, trend detection) to identify when a price is genuinely below its historical average for that route.',
  },
  {
    q: 'Is auto-buy safe? Will it charge my card without asking?',
    a: 'Auto-buy only triggers when the price drops below your specified threshold AND our AI model confirms it\'s a genuine deal. Your card is authorized (not charged) upfront — we only capture the exact amount when a matching deal is found. You can cancel anytime.',
  },
  {
    q: 'What airlines and hotels do you search?',
    a: 'We search across 400+ airlines and 150,000+ hotels worldwide through our live API partners. Results include major carriers, low-cost airlines, and boutique hotels — all with real-time pricing.',
  },
  {
    q: 'Can I pay with cryptocurrency?',
    a: 'Yes. Elite plan users can deposit USDC into a smart contract escrow on Base, Optimism, Arbitrum, or Polygon. The funds remain in your custody until the agent finds your deal. Every booking generates a verifiable on-chain receipt.',
  },
  {
    q: 'How is this different from Google Flights or Skyscanner?',
    a: 'Those tools show you prices right now. Flyeas monitors prices over time, predicts optimal buy moments using statistical models, and can auto-book when the price hits your target — even at 3am. Think of it as a personal trading bot, but for flights.',
  },
  {
    q: 'Is my data secure?',
    a: 'We use Stripe for card payments (PCI-DSS compliant, no card data touches our servers) and Supabase for data storage with row-level security. Crypto payments are non-custodial — you retain your private keys at all times.',
  },
];

export default function HomePage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('sv_user');
      if (stored) {
        const user = JSON.parse(stored);
        if (user.firstName) setIsLoggedIn(true);
      }
    } catch {}
  }, []);

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

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email || subscribing) return;
    setSubscribing(true);
    try {
      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSubscribed(true);
    } catch {} finally {
      setSubscribing(false);
    }
  }

  if (isLoggedIn) {
    return (
      <main className="min-h-screen flex flex-col">
        <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5 md:px-10">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoIcon size={36} />
            <LogoText size="xl" />
          </Link>
          <Link href="/dashboard" className="premium-button rounded-xl px-6 py-2.5 text-sm font-semibold">
            Go to Dashboard
          </Link>
        </nav>
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="text-center">
            <h1 className="text-4xl font-semibold md:text-5xl hero-title">Welcome back!</h1>
            <p className="mt-4 text-white/50">Your AI travel agent is ready.</p>
            <Link href="/dashboard" className="mt-8 inline-flex items-center gap-2 premium-button rounded-2xl px-10 py-4 text-base font-semibold">
              Open Dashboard
              <ArrowRight />
            </Link>
          </div>
        </div>
      </main>
    );
  }

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

      {/* ═══ NAVBAR ═══ */}
      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoIcon size={36} />
          <LogoText size="xl" />
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-white/50 transition hover:text-white">Features</a>
          <a href="#how" className="text-sm text-white/50 transition hover:text-white">How it Works</a>
          <a href="#pricing" className="text-sm text-white/50 transition hover:text-white">Pricing</a>
          <a href="#testimonials" className="text-sm text-white/50 transition hover:text-white">Why Flyeas</a>
          <Link href="/about" className="text-sm text-white/50 transition hover:text-white">About</Link>
        </div>
        <Link href="/onboarding" className="premium-button rounded-xl px-6 py-2.5 text-sm font-semibold">
          Sign Up
        </Link>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pt-10 pb-16 md:pt-16 md:px-10">
        <div className="text-center mb-10">
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
            <span style={{ background: 'var(--flyeas-gradient, linear-gradient(135deg, #F59E0B, #F97316, #EF4444))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              AI travel agent
            </span>{' '}
            that plans your trip from one sentence.
          </h2>

          <p className="mt-4 text-sm md:text-base text-white/40 max-w-xl mx-auto">
            Real flights, real hotels, real prices — live from 400+ airlines and 150,000+ hotels worldwide.
          </p>

          {/* Live status — real data only */}
          <div className="mt-5 flex items-center justify-center gap-4 text-xs text-white/35">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live prices from 400+ airlines
            </span>
            <span className="hidden sm:flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              Updated every 30 minutes
            </span>
          </div>
        </div>

        <TripPlannerHero />

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <div className="flex flex-col items-center">
            <span className="inline-block text-[10px] text-emerald-400 font-medium mb-2">
              + 50 bonus points on signup
            </span>
            <Link href="/onboarding" className="w-full sm:w-auto premium-button rounded-2xl px-8 py-3.5 text-sm font-semibold inline-flex items-center justify-center gap-2">
              Create Free Account
              <ArrowRight />
            </Link>
          </div>
          <a href="#features" className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl px-8 py-3.5 text-sm font-semibold text-white/70 transition hover:text-white hover:bg-white/5" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            See features
          </a>
        </div>
      </section>

      {/* ═══ LIVE DEALS ═══ */}
      <LiveDeals />

      {/* (Social proof ticker removed — no fake data) */}

      {/* ═══ TRUSTED BY / PARTNERS ═══ */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-16 md:px-10">
        <p className="text-center text-xs text-white/25 uppercase tracking-widest mb-8">Powered by industry leaders</p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
          <PartnerLogo name="Kiwi.com" />
          <PartnerLogo name="Stripe" />
          <PartnerLogo name="Supabase" />
          <PartnerLogo name="Vercel" />
          <PartnerLogo name="Resend" />
        </div>
      </section>

      {/* ═══ TRUST BADGES ═══ */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-12 md:px-10">
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
          {[
            {
              label: 'Stripe Verified Payments',
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              ),
            },
            {
              label: '256-bit SSL Encryption',
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              ),
            },
            {
              label: 'GDPR Compliant',
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 12h2l1-3h2l1 3h2" />
                  <path d="M9 15h6" />
                </svg>
              ),
            },
            {
              label: 'No Hidden Fees',
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
            },
          ].map((badge) => (
            <div key={badge.label} className="flex items-center gap-1.5 text-white/15">
              {badge.icon}
              <span className="text-[11px] text-white/25">{badge.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-6 pb-24 md:px-10">
        <h2 className="text-center hero-title text-2xl md:text-4xl font-semibold mb-4">Smart Travel, Simplified</h2>
        <p className="text-center text-white/40 mb-14 max-w-md mx-auto text-sm">Powered by AI agents that never sleep.</p>

        <div className="grid gap-5 md:grid-cols-3">
          {[
            { icon: <EyeIcon />, title: 'AI Price Monitoring', desc: 'Agents scan live flight and hotel prices around the clock, tracking drops and availability in real time.', color: 'var(--flyeas-accent, #F59E0B)' },
            { icon: <BoltIcon />, title: 'Auto-Buy System', desc: 'Set your budget and rules. When the perfect deal appears, our agent books instantly so you never miss it.', color: '#F97316' },
            { icon: <ShieldIcon />, title: 'Secure Payments', desc: 'Pay with Stripe or USDC. Card is authorized but not charged until a deal is found. Full PCI compliance.', color: '#10B981' },
            { icon: <ChartIcon />, title: 'Statistical Predictions', desc: 'Z-scores, percentile rankings, and trend analysis tell you exactly when to buy vs. when to wait.', color: '#3B82F6' },
            { icon: <GlobeIcon />, title: '400+ Airlines', desc: 'Real-time prices from major carriers and low-cost airlines worldwide. No cached or stale data.', color: '#8B5CF6' },
            { icon: <WalletIcon />, title: 'Crypto & Card', desc: 'Pay with USDC on Base, Optimism, Arbitrum, or Polygon. Every booking generates a verifiable on-chain receipt.', color: '#EF4444' },
          ].map((f) => (
            <div key={f.title} className="glass-premium rounded-2xl p-7 group cursor-default">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110" style={{ background: `${f.color}15`, color: f.color }}>
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
        <h2 className="text-center hero-title text-2xl md:text-4xl font-semibold mb-4">How it Works</h2>
        <p className="text-center text-white/40 mb-14 text-sm">Three steps to smarter travel.</p>

        <div className="grid gap-5 md:grid-cols-3">
          {[
            { n: '01', title: 'Describe Your Trip', desc: 'Type a sentence like "Paris to Tokyo, next March, under $600". Our AI understands dates, budgets, and preferences.', icon: <SearchIcon /> },
            { n: '02', title: 'AI Monitors 24/7', desc: 'Your personal agent tracks live prices, analyzes trends, and calculates the statistical probability of further drops.', icon: <PulseIcon /> },
            { n: '03', title: 'Book or Auto-Buy', desc: 'Review AI recommendations with full reasoning, or enable auto-buy to capture deals instantly — even while you sleep.', icon: <CheckCircleIcon /> },
          ].map((s) => (
            <div key={s.n} className="glass rounded-2xl p-7 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(245,158,11,0.08)', color: 'var(--flyeas-accent, #F59E0B)' }}>
                {s.icon}
              </div>
              <span className="text-sm font-bold text-white/20">Step {s.n}</span>
              <h3 className="mt-2 text-base font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/45">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ WHY FLYEAS ═══ */}
      <section id="testimonials" className="relative z-10 mx-auto max-w-5xl px-6 pb-24 md:px-10">
        <h2 className="text-center hero-title text-2xl md:text-4xl font-semibold mb-4">Why Travelers Choose Flyeas</h2>
        <p className="text-center text-white/40 mb-14 text-sm">Real capabilities, no marketing fluff.</p>

        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              stat: '400+',
              label: 'Airlines searched in real time',
              desc: 'Live prices from Kiwi.com and Sky-Scrapper APIs. No cached or stale data — every search hits real availability.',
              icon: <GlobeIcon />,
            },
            {
              stat: '24/7',
              label: 'AI monitoring on your missions',
              desc: 'Set a budget and let the agent watch prices around the clock. It uses z-scores and trend analysis to find the optimal buy moment.',
              icon: <PulseIcon />,
            },
            {
              stat: '$0',
              label: 'Charged until a deal is found',
              desc: 'Your card is authorized but never charged until the agent finds a flight within your budget. Cancel anytime, full release.',
              icon: <ShieldIcon />,
            },
          ].map((item) => (
            <div key={item.label} className="glass rounded-2xl p-7 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(245,158,11,0.08)', color: 'var(--flyeas-accent, #F59E0B)' }}>
                {item.icon}
              </div>
              <p className="text-3xl font-bold mb-1" style={{ background: 'var(--flyeas-gradient, linear-gradient(135deg, #F59E0B, #F97316))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {item.stat}
              </p>
              <p className="text-sm font-semibold text-white/80 mb-3">{item.label}</p>
              <p className="text-sm text-white/40 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ HOW FLYEAS COMPARES ═══ */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-24 md:px-10">
        <h2 className="text-center hero-title text-2xl md:text-4xl font-semibold mb-4">How Flyeas Compares</h2>
        <p className="text-center text-white/40 mb-14 text-sm">Feature-by-feature against the industry leaders</p>

        <div className="glass rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-5 py-4 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">Feature</th>
                {['Flyeas', 'Skyscanner', 'Kiwi', 'Google Flights', 'Hopper'].map((name) => (
                  <th
                    key={name}
                    className={`px-4 py-4 text-center text-xs font-semibold uppercase tracking-wider ${name === 'Flyeas' ? 'text-white' : 'text-white/40'}`}
                    style={name === 'Flyeas' ? { background: 'linear-gradient(180deg, rgba(245,158,11,0.12) 0%, rgba(249,115,22,0.06) 100%)' } : undefined}
                  >
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {([
                { feature: 'AI Agent 24/7', values: ['check', 'dash', 'dash', 'dash', 'dash'] },
                { feature: 'Auto-Buy', values: ['check', 'dash', 'dash', 'dash', 'dash'] },
                { feature: 'Price Predictions', values: ['check', 'dash', 'dash', 'basic', 'basic'] },
                { feature: 'Transparent AI', values: ['check', 'dash', 'dash', 'dash', 'dash'] },
                { feature: 'Crypto Payments', values: ['check', 'dash', 'dash', 'dash', 'dash'] },
                { feature: 'Flights + Hotels', values: ['check', 'check', 'check', 'check', 'check'] },
                { feature: 'No Redirect Booking', values: ['dash', 'dash', 'check', 'dash', 'check'] },
              ] as const).map((row, i) => (
                <tr key={row.feature} className={i < 6 ? 'border-b border-white/5' : ''}>
                  <td className="px-5 py-3.5 text-white/60 font-medium">{row.feature}</td>
                  {row.values.map((val, j) => (
                    <td
                      key={j}
                      className="px-4 py-3.5 text-center"
                      style={j === 0 ? { background: 'linear-gradient(180deg, rgba(245,158,11,0.08) 0%, rgba(249,115,22,0.03) 100%)' } : undefined}
                    >
                      {val === 'check' ? (
                        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block">
                          <path d="M4 10l4 4 8-8" />
                        </svg>
                      ) : val === 'basic' ? (
                        <span className="text-xs font-medium text-amber-400">Basic</span>
                      ) : (
                        <span className="text-white/20">&mdash;</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section id="pricing" className="relative z-10 mx-auto max-w-5xl px-6 pb-24 md:px-10">
        <h2 className="text-center hero-title text-2xl md:text-4xl font-semibold mb-4">Simple, Transparent Pricing</h2>
        <p className="text-center text-white/40 mb-14 text-sm">Start free. Upgrade when you need more power.</p>

        <div className="grid gap-5 md:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-2xl p-7 flex flex-col ${tier.highlight ? 'glass-premium ring-1' : 'glass'}`}
              style={tier.highlight ? { ringColor: 'var(--flyeas-accent, #F59E0B)', borderColor: 'rgba(245,158,11,0.3)', border: '1px solid rgba(245,158,11,0.3)' } : undefined}
            >
              {tier.badge && (
                <span className="inline-block self-start text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full mb-4" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                  {tier.badge}
                </span>
              )}
              <h3 className="text-lg font-bold">{tier.name}</h3>
              <div className="mt-2 mb-1">
                <span className="text-3xl font-bold">{tier.price === 0 ? 'Free' : `$${tier.price}`}</span>
                {tier.price > 0 && <span className="text-sm text-white/40">/month</span>}
              </div>
              <p className="text-xs text-white/40 mb-6">{tier.desc}</p>
              <ul className="space-y-2.5 mb-8 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-white/60">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                      <path d="M4 10l4 4 8-8" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/onboarding"
                className={`w-full text-center rounded-xl py-3 text-sm font-semibold transition ${tier.highlight ? 'premium-button' : 'hover:bg-white/10'}`}
                style={!tier.highlight ? { border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' } : undefined}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section id="faq" className="relative z-10 mx-auto max-w-3xl px-6 pb-24 md:px-10">
        <h2 className="text-center hero-title text-2xl md:text-4xl font-semibold mb-4">Frequently Asked Questions</h2>
        <p className="text-center text-white/40 mb-14 text-sm">Everything you need to know.</p>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="glass rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left"
              >
                <span className="text-sm font-semibold text-white/80 pr-4">{item.q}</span>
                <svg
                  width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round"
                  className={`flex-shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`}
                >
                  <path d="M5 8l5 5 5-5" />
                </svg>
              </button>
              <div
                className="overflow-hidden transition-all duration-300"
                style={{ maxHeight: openFaq === i ? '300px' : '0px', opacity: openFaq === i ? 1 : 0 }}
              >
                <p className="px-6 pb-5 text-sm text-white/45 leading-relaxed">{item.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ BOTTOM CTA ═══ */}
      <section className="relative z-10 mx-auto max-w-2xl px-6 pb-24 md:px-10">
        <div className="glass-premium rounded-3xl p-10 md:p-14 text-center">
          <h2 className="hero-title text-2xl md:text-3xl font-semibold">Ready to save on your next trip?</h2>
          <p className="mt-4 text-white/40 text-sm max-w-sm mx-auto">
            Let AI find the best deals. Create your free account in 30 seconds.
          </p>
          <Link href="/onboarding" className="mt-8 inline-flex items-center gap-2 premium-button rounded-2xl px-10 py-4 text-base font-semibold">
            Get Started Free
            <ArrowRight />
          </Link>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="relative z-10 border-t border-white/5 px-6 py-12 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <LogoIcon size={32} />
                <LogoText size="lg" />
              </div>
              <p className="text-xs text-white/30 leading-relaxed max-w-xs">
                AI-powered travel agent that monitors prices 24/7, predicts optimal buy moments, and auto-books within your budget.
              </p>
              {/* Social icons */}
              <div className="flex gap-3 mt-5">
                <a href="https://twitter.com/flyeasapp" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-white/5 transition text-white/30 hover:text-white/60">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a href="https://github.com/flyeas" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-white/5 transition text-white/30 hover:text-white/60">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
                </a>
              </div>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-4">Product</h4>
              <ul className="space-y-2.5">
                <li><a href="#features" className="text-xs text-white/30 hover:text-white/60 transition">Features</a></li>
                <li><Link href="/pricing" className="text-xs text-white/30 hover:text-white/60 transition">Pricing</Link></li>
                <li><a href="#how" className="text-xs text-white/30 hover:text-white/60 transition">How it Works</a></li>
                <li><a href="#faq" className="text-xs text-white/30 hover:text-white/60 transition">FAQ</a></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-4">Company</h4>
              <ul className="space-y-2.5">
                <li><Link href="/about" className="text-xs text-white/30 hover:text-white/60 transition">About</Link></li>
                <li><Link href="/blog" className="text-xs text-white/30 hover:text-white/60 transition">Blog</Link></li>
                <li><a href="mailto:hello@flyeas.app" className="text-xs text-white/30 hover:text-white/60 transition">Contact</a></li>
              </ul>
            </div>

            {/* Popular Routes */}
            <div>
              <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-4">Popular Routes</h4>
              <ul className="space-y-2.5">
                <li><Link href="/flights" className="text-xs text-white/30 hover:text-white/60 transition">Flights from Paris</Link></li>
                <li><Link href="/flights" className="text-xs text-white/30 hover:text-white/60 transition">Flights from London</Link></li>
                <li><Link href="/hotels" className="text-xs text-white/30 hover:text-white/60 transition">Hotels in Dubai</Link></li>
                <li><Link href="/hotels" className="text-xs text-white/30 hover:text-white/60 transition">Hotels in Barcelona</Link></li>
                <li><Link href="/flights" className="text-xs text-white/30 hover:text-white/60 transition">Cheap flights to Tokyo</Link></li>
                <li><Link href="/flights" className="text-xs text-white/30 hover:text-white/60 transition">Cheap flights to New York</Link></li>
              </ul>
            </div>

            {/* Legal + Newsletter */}
            <div>
              <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-4">Legal</h4>
              <ul className="space-y-2.5 mb-6">
                <li><Link href="/legal/terms" className="text-xs text-white/30 hover:text-white/60 transition">Terms of Service</Link></li>
                <li><Link href="/legal/privacy" className="text-xs text-white/30 hover:text-white/60 transition">Privacy Policy</Link></li>
              </ul>

              <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Newsletter</h4>
              {subscribed ? (
                <p className="text-xs text-emerald-400">Subscribed. Welcome aboard!</p>
              ) : (
                <form onSubmit={handleSubscribe} className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    className="flex-1 min-w-0 rounded-lg px-3 py-2 text-xs text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                  <button type="submit" disabled={subscribing} className="premium-button rounded-lg px-3 py-2 text-xs font-semibold">
                    {subscribing ? '...' : 'Join'}
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="border-t border-white/5 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-[11px] text-white/20">
              &copy; {new Date().getFullYear()} Flyeas. All rights reserved.
            </p>
            <p className="text-[11px] text-white/15">
              Built with Next.js, Supabase, Stripe, and AI.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ── Small reusable components ──────────────────────────── */

/* (AnimatedCounter removed — no fake counters) */

/* (Fake social proof ticker removed — no simulated data) */

/* ── Partner Logo ────────────────────────────── */

function PartnerLogo({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 text-white/20 hover:text-white/40 transition">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="4" />
        <path d="M8 12h8M12 8v8" />
      </svg>
      <span className="text-sm font-medium">{name}</span>
    </div>
  );
}

function LogoIcon({ size = 36 }: { size?: number }) {
  return (
    <div className="flex items-center justify-center rounded-xl" style={{ width: size, height: size, background: 'var(--flyeas-gradient, linear-gradient(135deg, #F59E0B, #F97316, #EF4444))' }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
      </svg>
    </div>
  );
}

function LogoText({ size = 'xl' }: { size?: string }) {
  return (
    <span className={`${size === 'xl' ? 'text-xl' : 'text-lg'} font-bold tracking-tight`} style={{ background: 'var(--flyeas-gradient, linear-gradient(135deg, #F59E0B, #F97316))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
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

function ShieldIcon() {
  return (
    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function PulseIcon() {
  return (
    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h3l3-9 6 18 3-9h3" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
