'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import TripPlannerHero from '@/components/trip-planner-hero';
import LiveDeals from '@/components/live-deals';
import { Accordion, AccordionItem } from '@/components/ui/accordion';
import {
  Eye,
  Zap,
  ShieldCheck,
  BarChart3,
  Globe,
  Wallet,
  Search,
  Activity,
  CheckCircle,
  ArrowRight,

  Plane,
  Check,
} from 'lucide-react';

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

/* ── Features ─────────────────────────────── */
const FEATURES = [
  { icon: Eye, title: 'AI Price Monitoring', desc: 'Agents scan live flight and hotel prices around the clock, tracking drops and availability in real time.', color: '#E8A317' },
  { icon: Zap, title: 'Auto-Buy System', desc: 'Set your budget and rules. When the perfect deal appears, our agent books instantly so you never miss it.', color: '#F97316' },
  { icon: ShieldCheck, title: 'Secure Payments', desc: 'Pay with Stripe or USDC. Card is authorized but not charged until a deal is found. Full PCI compliance.', color: '#10B981' },
  { icon: BarChart3, title: 'Statistical Predictions', desc: 'Z-scores, percentile rankings, and trend analysis tell you exactly when to buy vs. when to wait.', color: '#3B82F6' },
  { icon: Globe, title: '400+ Airlines', desc: 'Real-time prices from major carriers and low-cost airlines worldwide. No cached or stale data.', color: '#8B5CF6' },
  { icon: Wallet, title: 'Crypto & Card', desc: 'Pay with USDC on Base, Optimism, Arbitrum, or Polygon. Every booking generates a verifiable on-chain receipt.', color: '#EF4444' },
];

export default function HomePage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [fade, setFade] = useState(true);
  // FAQ state removed — now using Accordion component
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
          <Link href="/dashboard" className="inline-flex items-center gap-2 bg-gradient-to-r from-accent-light to-accent-dark text-white rounded-xl px-6 py-2.5 text-sm font-semibold shadow-glow hover:shadow-glow-lg transition-all">
            Go to Dashboard
          </Link>
        </nav>
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold font-display md:text-5xl text-text-primary tracking-tight">Welcome back!</h1>
            <p className="mt-4 text-text-muted">Your AI travel agent is ready.</p>
            <Link href="/dashboard" className="mt-8 inline-flex items-center gap-2 bg-gradient-to-r from-accent-light to-accent-dark text-white rounded-2xl px-10 py-4 text-base font-semibold shadow-glow hover:shadow-glow-lg hover:-translate-y-0.5 transition-all">
              Open Dashboard
              <ArrowRight className="w-[18px] h-[18px]" />
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden">
      {/* Background orb — static, no animation */}
      <div className="pointer-events-none fixed left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-40"
        style={{
          background: 'radial-gradient(circle, color-mix(in srgb, var(--flyeas-accent) 8%, transparent) 0%, transparent 70%)',
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
          <a href="#features" className="text-sm text-text-muted transition hover:text-text-primary">Features</a>
          <a href="#how" className="text-sm text-text-muted transition hover:text-text-primary">How it Works</a>
          <a href="#pricing" className="text-sm text-text-muted transition hover:text-text-primary">Pricing</a>
          <a href="#testimonials" className="text-sm text-text-muted transition hover:text-text-primary">Why Flyeas</a>
          <Link href="/about" className="text-sm text-text-muted transition hover:text-text-primary">About</Link>
        </div>
        <Link href="/onboarding" className="bg-gradient-to-r from-accent-light to-accent-dark text-white rounded-xl px-6 py-2.5 text-sm font-semibold shadow-glow hover:shadow-glow-lg hover:-translate-y-0.5 transition-all">
          Sign Up
        </Link>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pt-10 pb-16 md:pt-16 md:px-10">
        <div className="text-center mb-10">
          <div className="h-[60px] md:h-[80px] flex items-center justify-center mb-3">
            <h1
              className="text-4xl md:text-6xl font-bold font-display gradient-text transition-all"
              style={{
                opacity: fade ? 1 : 0,
                transform: fade ? 'translateY(0)' : 'translateY(12px)',
                transitionDuration: '350ms',
              }}
            >
              {greetings[greetingIndex].text}
            </h1>
          </div>

          <h2 className="font-display text-xl md:text-3xl font-semibold text-text-primary/90 max-w-2xl mx-auto leading-tight tracking-tight">
            The world&apos;s first{' '}
            <span className="gradient-text">AI travel agent</span>{' '}
            that plans your trip from one sentence.
          </h2>

          <p className="mt-4 text-sm md:text-base text-text-muted max-w-xl mx-auto">
            Real flights, real hotels, real prices — live from 400+ airlines and 150,000+ hotels worldwide.
          </p>

          {/* Live status */}
          <div className="mt-5 flex items-center justify-center gap-4 text-xs text-text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live prices from 400+ airlines
            </span>
            <span className="hidden sm:flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
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
            <Link href="/onboarding" className="w-full sm:w-auto bg-gradient-to-r from-accent-light to-accent-dark text-white rounded-2xl px-8 py-3.5 text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-glow hover:shadow-glow-lg hover:-translate-y-0.5 transition-all">
              Create Free Account
              <ArrowRight className="w-[18px] h-[18px]" />
            </Link>
          </div>
          <a href="#features" className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl px-8 py-3.5 text-sm font-semibold text-text-secondary transition hover:text-text-primary hover:bg-white/5 border border-border-default">
            See features
          </a>
        </div>
      </section>

      {/* ═══ LIVE DEALS ═══ */}
      <LiveDeals />

      {/* ═══ TRUSTED BY / PARTNERS ═══ */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-16 md:px-10">
        <p className="text-center text-xs text-text-muted/60 uppercase tracking-[0.15em] mb-8 font-medium">Powered by industry leaders</p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
          {['Kiwi.com', 'Stripe', 'Supabase', 'Vercel', 'Resend'].map((name) => (
            <span key={name} className="text-sm font-medium text-text-muted/40 hover:text-text-muted/70 transition">{name}</span>
          ))}
        </div>
      </section>

      {/* ═══ TRUST BADGES ═══ */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-12 md:px-10">
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
          {[
            { label: 'Stripe Verified Payments', icon: ShieldCheck },
            { label: '256-bit SSL Encryption', icon: ShieldCheck },
            { label: 'GDPR Compliant', icon: Globe },
            { label: 'No Hidden Fees', icon: CheckCircle },
          ].map((badge) => (
            <div key={badge.label} className="flex items-center gap-1.5 text-text-muted/30">
              <badge.icon className="w-4 h-4" strokeWidth={1.5} />
              <span className="text-[11px]">{badge.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-6 pb-24 md:px-10">
        <h2 className="text-center font-display text-2xl md:text-4xl font-semibold mb-4 text-text-primary tracking-tight">Smart Travel, Simplified</h2>
        <p className="text-center text-text-muted mb-14 max-w-md mx-auto text-sm">Powered by AI agents that never sleep.</p>

        {/* Bento grid */}
        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            const isLarge = i === 0 || i === 3;
            return (
              <div
                key={f.title}
                className={`bg-surface-card border border-border-subtle rounded-2xl p-7 group cursor-default transition-all hover:border-border-default ${isLarge ? 'md:col-span-2' : ''}`}
              >
                <div
                  className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
                  style={{ background: `${f.color}12`, color: f.color }}
                >
                  <Icon className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <h3 className="text-base font-semibold font-display mb-2 text-text-primary">{f.title}</h3>
                <p className="text-sm leading-relaxed text-text-secondary">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section id="how" className="relative z-10 mx-auto max-w-4xl px-6 pb-24 md:px-10">
        <h2 className="text-center font-display text-2xl md:text-4xl font-semibold mb-4 text-text-primary tracking-tight">How it Works</h2>
        <p className="text-center text-text-muted mb-14 text-sm">Three steps to smarter travel.</p>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            { n: '01', title: 'Describe Your Trip', desc: 'Type a sentence like "Paris to Tokyo, next March, under $600". Our AI understands dates, budgets, and preferences.', icon: Search },
            { n: '02', title: 'AI Monitors 24/7', desc: 'Your personal agent tracks live prices, analyzes trends, and calculates the statistical probability of further drops.', icon: Activity },
            { n: '03', title: 'Book or Auto-Buy', desc: 'Review AI recommendations with full reasoning, or enable auto-buy to capture deals instantly — even while you sleep.', icon: CheckCircle },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.n} className="bg-surface-card border border-border-subtle rounded-2xl p-7 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/8 text-accent">
                  <Icon className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <span className="text-sm font-bold text-text-muted/40 font-display">Step {s.n}</span>
                <h3 className="mt-2 text-base font-semibold font-display text-text-primary">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══ WHY FLYEAS ═══ */}
      <section id="testimonials" className="relative z-10 mx-auto max-w-5xl px-6 pb-24 md:px-10">
        <h2 className="text-center font-display text-2xl md:text-4xl font-semibold mb-4 text-text-primary tracking-tight">Why Travelers Choose Flyeas</h2>
        <p className="text-center text-text-muted mb-14 text-sm">Real capabilities, no marketing fluff.</p>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            { stat: '400+', label: 'Airlines searched in real time', desc: 'Live prices from Kiwi.com and Sky-Scrapper APIs. No cached or stale data — every search hits real availability.', icon: Globe },
            { stat: '24/7', label: 'AI monitoring on your missions', desc: 'Set a budget and let the agent watch prices around the clock. It uses z-scores and trend analysis to find the optimal buy moment.', icon: Activity },
            { stat: '$0', label: 'Charged until a deal is found', desc: 'Your card is authorized but never charged until the agent finds a flight within your budget. Cancel anytime, full release.', icon: ShieldCheck },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="bg-surface-card border border-border-subtle rounded-2xl p-7 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/8 text-accent">
                  <Icon className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <p className="text-3xl font-bold font-display mb-1 gradient-text">{item.stat}</p>
                <p className="text-sm font-semibold text-text-primary/80 mb-3">{item.label}</p>
                <p className="text-sm text-text-secondary leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══ HOW FLYEAS COMPARES ═══ */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-24 md:px-10">
        <h2 className="text-center font-display text-2xl md:text-4xl font-semibold mb-4 text-text-primary tracking-tight">How Flyeas Compares</h2>
        <p className="text-center text-text-muted mb-14 text-sm">Feature-by-feature against the industry leaders</p>

        <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="px-5 py-4 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Feature</th>
                {['Flyeas', 'Skyscanner', 'Kiwi', 'Google Flights', 'Hopper'].map((name) => (
                  <th
                    key={name}
                    className={`px-4 py-4 text-center text-xs font-semibold uppercase tracking-wider ${name === 'Flyeas' ? 'text-text-primary' : 'text-text-muted'}`}
                    style={name === 'Flyeas' ? { background: 'rgba(232,163,23,0.08)' } : undefined}
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
                <tr key={row.feature} className={i < 6 ? 'border-b border-border-subtle' : ''}>
                  <td className="px-5 py-3.5 text-text-secondary font-medium">{row.feature}</td>
                  {row.values.map((val, j) => (
                    <td
                      key={j}
                      className="px-4 py-3.5 text-center"
                      style={j === 0 ? { background: 'rgba(232,163,23,0.05)' } : undefined}
                    >
                      {val === 'check' ? (
                        <Check className="w-[18px] h-[18px] text-emerald-500 inline-block" strokeWidth={2.5} />
                      ) : val === 'basic' ? (
                        <span className="text-xs font-medium text-accent">Basic</span>
                      ) : (
                        <span className="text-text-muted/30">&mdash;</span>
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
        <h2 className="text-center font-display text-2xl md:text-4xl font-semibold mb-4 text-text-primary tracking-tight">Simple, Transparent Pricing</h2>
        <p className="text-center text-text-muted mb-14 text-sm">Start free. Upgrade when you need more power.</p>

        <div className="grid gap-4 md:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-2xl p-7 flex flex-col transition-all ${
                tier.highlight
                  ? 'bg-surface-card border-2 border-accent/30 shadow-glow scale-[1.02]'
                  : 'bg-surface-card border border-border-subtle'
              }`}
            >
              {tier.badge && (
                <span className="inline-block self-start text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full mb-4 bg-accent/15 text-accent">
                  {tier.badge}
                </span>
              )}
              <h3 className="text-lg font-bold font-display text-text-primary">{tier.name}</h3>
              <div className="mt-2 mb-1">
                <span className="text-3xl font-bold font-display text-text-primary">{tier.price === 0 ? 'Free' : `$${tier.price}`}</span>
                {tier.price > 0 && <span className="text-sm text-text-muted">/month</span>}
              </div>
              <p className="text-xs text-text-muted mb-6">{tier.desc}</p>
              <ul className="space-y-2.5 mb-8 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-text-secondary">
                    <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/onboarding"
                className={`w-full text-center rounded-xl py-3 text-sm font-semibold transition-all min-h-[44px] flex items-center justify-center ${
                  tier.highlight
                    ? 'bg-gradient-to-r from-accent-light to-accent-dark text-white shadow-glow hover:shadow-glow-lg'
                    : 'border border-border-default text-text-secondary hover:bg-white/5 hover:text-text-primary'
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section id="faq" className="relative z-10 mx-auto max-w-3xl px-6 pb-24 md:px-10">
        <h2 className="text-center font-display text-2xl md:text-4xl font-semibold mb-4 text-text-primary tracking-tight">Frequently Asked Questions</h2>
        <p className="text-center text-text-muted mb-14 text-sm">Everything you need to know.</p>

        <div className="bg-surface-card border border-border-subtle rounded-2xl px-6">
          <Accordion>
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem key={i} title={item.q}>
                {item.a}
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ═══ BOTTOM CTA ═══ */}
      <section className="relative z-10 mx-auto max-w-2xl px-6 pb-24 md:px-10">
        <div className="glass-premium rounded-3xl p-10 md:p-14 text-center">
          <h2 className="font-display text-2xl md:text-3xl font-semibold text-text-primary tracking-tight">Ready to save on your next trip?</h2>
          <p className="mt-4 text-text-muted text-sm max-w-sm mx-auto">
            Let AI find the best deals. Create your free account in 30 seconds.
          </p>
          <Link href="/onboarding" className="mt-8 inline-flex items-center gap-2 bg-gradient-to-r from-accent-light to-accent-dark text-white rounded-2xl px-10 py-4 text-base font-semibold shadow-glow hover:shadow-glow-lg hover:-translate-y-0.5 transition-all">
            Get Started Free
            <ArrowRight className="w-[18px] h-[18px]" />
          </Link>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="relative z-10 border-t border-border-subtle px-6 py-12 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <LogoIcon size={32} />
                <LogoText size="lg" />
              </div>
              <p className="text-xs text-text-muted/60 leading-relaxed max-w-xs">
                AI-powered travel agent that monitors prices 24/7, predicts optimal buy moments, and auto-books within your budget.
              </p>
              {/* Social icons */}
              <div className="flex gap-3 mt-5">
                <a href="https://twitter.com/flyeasapp" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-white/5 transition text-text-muted/40 hover:text-text-muted">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a href="https://github.com/flyeas" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-white/5 transition text-text-muted/40 hover:text-text-muted">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
                </a>
              </div>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">Product</h4>
              <ul className="space-y-2.5">
                <li><a href="#features" className="text-xs text-text-muted/50 hover:text-text-secondary transition">Features</a></li>
                <li><Link href="/pricing" className="text-xs text-text-muted/50 hover:text-text-secondary transition">Pricing</Link></li>
                <li><a href="#how" className="text-xs text-text-muted/50 hover:text-text-secondary transition">How it Works</a></li>
                <li><a href="#faq" className="text-xs text-text-muted/50 hover:text-text-secondary transition">FAQ</a></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">Company</h4>
              <ul className="space-y-2.5">
                <li><Link href="/about" className="text-xs text-text-muted/50 hover:text-text-secondary transition">About</Link></li>
                <li><Link href="/blog" className="text-xs text-text-muted/50 hover:text-text-secondary transition">Blog</Link></li>
                <li><a href="mailto:hello@flyeas.app" className="text-xs text-text-muted/50 hover:text-text-secondary transition">Contact</a></li>
              </ul>
            </div>

            {/* Popular Routes */}
            <div>
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">Popular Routes</h4>
              <ul className="space-y-2.5">
                <li><Link href="/flights" className="text-xs text-text-muted/50 hover:text-text-secondary transition">Flights from Paris</Link></li>
                <li><Link href="/flights" className="text-xs text-text-muted/50 hover:text-text-secondary transition">Flights from London</Link></li>
                <li><Link href="/hotels" className="text-xs text-text-muted/50 hover:text-text-secondary transition">Hotels in Dubai</Link></li>
                <li><Link href="/hotels" className="text-xs text-text-muted/50 hover:text-text-secondary transition">Hotels in Barcelona</Link></li>
                <li><Link href="/flights" className="text-xs text-text-muted/50 hover:text-text-secondary transition">Cheap flights to Tokyo</Link></li>
                <li><Link href="/flights" className="text-xs text-text-muted/50 hover:text-text-secondary transition">Cheap flights to New York</Link></li>
              </ul>
            </div>

            {/* Legal + Newsletter */}
            <div>
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">Legal</h4>
              <ul className="space-y-2.5 mb-6">
                <li><Link href="/legal/terms" className="text-xs text-text-muted/50 hover:text-text-secondary transition">Terms of Service</Link></li>
                <li><Link href="/legal/privacy" className="text-xs text-text-muted/50 hover:text-text-secondary transition">Privacy Policy</Link></li>
              </ul>

              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Newsletter</h4>
              {subscribed ? (
                <p className="text-xs text-emerald-400">Subscribed. Welcome aboard!</p>
              ) : (
                <form onSubmit={handleSubscribe} className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    className="flex-1 min-w-0 rounded-lg px-3 py-2 text-xs text-text-primary outline-none bg-surface-card border border-border-subtle focus:border-accent/30 transition"
                  />
                  <button type="submit" disabled={subscribing} className="bg-gradient-to-r from-accent-light to-accent-dark text-white rounded-lg px-3 py-2 text-xs font-semibold">
                    {subscribing ? '...' : 'Join'}
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="border-t border-border-subtle pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-[11px] text-text-muted/40">
              &copy; {new Date().getFullYear()} Flyeas. All rights reserved.
            </p>
            <p className="text-[11px] text-text-muted/30">
              Built with Next.js, Supabase, Stripe, and AI.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ── Small reusable components ──────────────────────────── */

function LogoIcon({ size = 36 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl bg-gradient-to-br from-accent-light to-accent-dark"
      style={{ width: size, height: size }}
    >
      <Plane className="text-white" style={{ width: size * 0.45, height: size * 0.45 }} strokeWidth={2} />
    </div>
  );
}

function LogoText({ size = 'xl' }: { size?: string }) {
  return (
    <span className={`${size === 'xl' ? 'text-xl' : 'text-lg'} font-bold font-display tracking-tight gradient-text`}>
      Flyeas
    </span>
  );
}
