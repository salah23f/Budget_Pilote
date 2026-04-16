'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import TripPlannerHero from '@/components/trip-planner-hero';
import { Accordion, AccordionItem } from '@/components/ui/accordion';
import { PriceDisplay } from '@/components/ui/price-display';
import { useSavingsStore } from '@/lib/store/savings-store';
import { ArrowRight, Check } from 'lucide-react';

/* ──────────────────────────────────────────────────────────
   Landing — editorial travel brand.
   See docs/design-system.md for tokens.
   No gradients. No glows. No emojis. Serif for moments that matter.
   ────────────────────────────────────────────────────────── */

const TIERS = [
  {
    name: 'Free',
    price: 0,
    cadence: 'Always',
    pitch: 'One live mission. Daily deal digest.',
    cta: 'Begin',
    ctaHref: '/onboarding',
    highlight: false,
    items: [
      '1 active mission',
      '3 searches per day',
      'Deal alerts, daily',
      'Price calendar view',
    ],
  },
  {
    name: 'Pro',
    price: 9,
    cadence: 'per month',
    pitch: 'Auto-book when your target hits. 3× loyalty points.',
    cta: 'Start Pro trial',
    ctaHref: '/onboarding',
    highlight: true,
    items: [
      'Unlimited missions',
      'Auto-buy on target',
      '15-minute monitoring',
      '90 days of price history',
      '3× loyalty points',
    ],
  },
  {
    name: 'Elite',
    price: 29,
    cadence: 'per month',
    pitch: 'Dedicated concierge. Real-time alerts. 5× points.',
    cta: 'Go Elite',
    ctaHref: '/onboarding',
    highlight: false,
    items: [
      'Everything in Pro',
      '5-minute monitoring',
      'Dedicated AI concierge',
      'Full price history',
      '5× loyalty points',
      'Priority support',
    ],
  },
];

const FAQ = [
  {
    q: 'How do you get real prices?',
    a: 'We query live inventory from 400+ airline APIs and 2 million hotels. No stale caches, no bait. You see the price your chosen provider actually charges at that second.',
  },
  {
    q: 'Do you hide any fees?',
    a: 'No. The number you see is the number you pay. Taxes and required fees are included. Optional extras like baggage are shown separately with clear labels.',
  },
  {
    q: 'What does a mission actually do?',
    a: 'You pick a route, a window, and a target price. We watch every inventory refresh until the offer beats your target, then we alert you — or auto-book if you set that. You can cancel anytime.',
  },
  {
    q: 'Why does Flyeas keep commissions instead of rebating them?',
    a: 'We keep a small partner commission, and we return a meaningful share as loyalty points (redeemable against future trips). This keeps the tool free to use while keeping incentives aligned.',
  },
  {
    q: 'Can I cancel Pro anytime?',
    a: 'Yes. No contracts, no lock-in. If you cancel mid-cycle you keep Pro until the period ends.',
  },
  {
    q: 'Do you support my currency and language?',
    a: '32 languages and 85+ currencies. Switch anytime from the header. Conversions use live rates refreshed every six hours.',
  },
];

/* ── Editorial greetings (rotates in the hero eyebrow) ── */
const GREETINGS = [
  { text: 'Hello', lang: 'English' },
  { text: 'Bonjour', lang: 'Français' },
  { text: 'Guten Tag', lang: 'Deutsch' },
  { text: 'Hola', lang: 'Español' },
  { text: 'Ciao', lang: 'Italiano' },
  { text: 'こんにちは', lang: '日本語' },
  { text: '안녕하세요', lang: '한국어' },
  { text: 'مرحباً', lang: 'العربية' },
  { text: 'Olá', lang: 'Português' },
];

export default function LandingPage() {
  const [gi, setGi] = useState(0);
  const [visible, setVisible] = useState(true);
  const totalSaved = useSavingsStore((s) => s.totalSaved);

  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setGi((p) => (p + 1) % GREETINGS.length);
        setVisible(true);
      }, 300);
    }, 3200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-ink-950 text-pen-1">
      <TopNav />

      {/* ───────────────────────────────── Hero ───────────────────────────────── */}
      <section className="border-b border-line-1">
        <div className="mx-auto max-w-wide px-6 lg:px-12 py-16 lg:py-24">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">
            {/* Left — editorial copy */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <span className="flex items-center gap-2 text-micro uppercase text-pen-3">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                  </span>
                  Live · 400+ carriers
                </span>
                <span className="text-micro uppercase text-pen-3">
                  <span
                    className={`inline-block transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
                  >
                    {GREETINGS[gi].text}
                  </span>
                </span>
              </div>

              <h1 className="editorial text-[40px] md:text-display leading-[1.05]">
                Watch prices.<br />
                Book on <em className="italic text-accent">your</em> terms.
              </h1>

              <p className="mt-6 text-body-lg text-pen-2 max-w-[540px]">
                Flyeas is a travel concierge that watches flight and hotel prices around the clock,
                so you never book on the wrong day again. Set a target. Let the mission run.
                Buy when it makes sense.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/onboarding"
                  className="premium-button inline-flex items-center gap-2 rounded-md px-5 py-3 text-body"
                >
                  Begin
                  <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </Link>
                <Link
                  href="/flights"
                  className="secondary-button inline-flex items-center gap-2 rounded-md px-5 py-3 text-body"
                >
                  Browse flights
                </Link>
              </div>

              <div className="mt-10 flex items-center gap-6 text-caption text-pen-3">
                <span>No credit card required</span>
                <span className="h-1 w-1 rounded-full bg-pen-3/60" />
                <span>32 languages · 85+ currencies</span>
              </div>
            </div>

            {/* Right — editorial visual (minimalist globe with a single arc) */}
            <div className="order-first lg:order-last">
              <HeroVisual />
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────── Try it — natural language ─────────────────────────── */}
      <section className="border-b border-line-1 bg-ink-900">
        <div className="mx-auto max-w-wide px-6 lg:px-12 py-16 lg:py-20">
          <div className="max-w-[680px] mb-10">
            <p className="text-micro uppercase text-pen-3 mb-3">Try it now</p>
            <h2 className="editorial text-h1">
              Tell us where you're going. Get prices in seconds.
            </h2>
            <p className="mt-3 text-body text-pen-2">
              One sentence is enough. Real flights, real hotels, real prices.
            </p>
          </div>
          <TripPlannerHero />
        </div>
      </section>

      {/* ─────────────────────────────── Product 1 ─────────────────────────────── */}
      <ProductSection
        eyebrow="Around the clock"
        title="The search that never sleeps"
        body="Airlines change prices up to 30 times a day. We check every route you care about every few minutes, and tell you the moment a better fare appears. No browser tabs, no refresh button, no second-guessing."
        stat={
          totalSaved > 0
            ? { label: 'Saved by our users this year', value: totalSaved * 120, currencyConvert: true }
            : { label: 'Routes monitored this week', value: 128_400, currencyConvert: false }
        }
        align="left"
      />

      {/* ─────────────────────────────── Product 2 ─────────────────────────────── */}
      <ProductSection
        eyebrow="The mission"
        title="A concierge that closes the deal"
        body="Pick a route, a window, a price you'd happily pay. We watch. When the market moves, you're the first to know. Set auto-book and we close the deal the moment it beats your number — even at 3 a.m."
        visual={<MissionVisual />}
        align="right"
      />

      {/* ─────────────────────────────── Product 3 ─────────────────────────────── */}
      <ProductSection
        eyebrow="Transparent pricing"
        title="One number. End to end."
        body="The price on the card is the price on your statement. Taxes, required fees, currency — all included from the first screen. If we think a partner will add a surprise charge later, we warn you before you click book."
        visual={<PriceBreakdownVisual />}
        align="left"
      />

      {/* ─────────────────────────────── Comparison ─────────────────────────────── */}
      <section className="border-y border-line-1 bg-ink-900">
        <div className="mx-auto max-w-content px-6 lg:px-12 py-20 lg:py-24">
          <p className="text-micro uppercase text-pen-3 mb-4">How we differ</p>
          <h2 className="editorial text-h1 max-w-[720px]">
            Skyscanner tells you. Google helps you decide.<br />
            <em className="italic text-accent">We book.</em>
          </h2>
          <div className="mt-10 grid md:grid-cols-3 gap-8 md:gap-12 text-body text-pen-2">
            <p>
              Most aggregators hand you off to a partner the moment you decide. We stay with you —
              monitoring, predicting, and closing — until you've actually flown.
            </p>
            <p>
              Instead of stale "typical prices," we show you 180 days of real history for the exact
              route and date you're looking at. You decide with data, not guesses.
            </p>
            <p>
              We earn from airline and hotel partners, not from hiding extras.
              That's why the price you see is the price you pay.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────── Social proof ─────────────────────────────── */}
      <section className="border-b border-line-1">
        <div className="mx-auto max-w-wide px-6 lg:px-12 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <Stat value="400+" label="Airlines tracked" />
            <Stat value="2M+" label="Hotels worldwide" />
            <Stat value="32" label="Languages" />
            <Stat value="85+" label="Currencies" />
          </div>
        </div>
      </section>

      {/* ─────────────────────────────── Pricing ─────────────────────────────── */}
      <section className="border-b border-line-1">
        <div className="mx-auto max-w-wide px-6 lg:px-12 py-20 lg:py-24">
          <div className="max-w-[640px] mb-12">
            <p className="text-micro uppercase text-pen-3 mb-3">Membership</p>
            <h2 className="editorial text-h1">Three tiers. No surprises.</h2>
            <p className="mt-3 text-body text-pen-2">
              Start free. Upgrade when the missions pay for themselves — usually on the second trip.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {TIERS.map((tier) => (
              <PricingCard key={tier.name} tier={tier} />
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────── FAQ ─────────────────────────────── */}
      <section className="border-b border-line-1 bg-ink-900">
        <div className="mx-auto max-w-prose px-6 lg:px-12 py-20 lg:py-24">
          <p className="text-micro uppercase text-pen-3 mb-3">Questions, briefly answered</p>
          <h2 className="editorial text-h1 mb-8">Frequently asked.</h2>
          <Accordion>
            {FAQ.map((item, idx) => (
              <AccordionItem
                key={idx}
                title={item.q}
                defaultOpen={idx === 0}
              >
                <p className="text-body text-pen-2 leading-relaxed">{item.a}</p>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ─────────────────────────────── Final CTA ─────────────────────────────── */}
      <section className="border-b border-line-1">
        <div className="mx-auto max-w-wide px-6 lg:px-12 py-24 text-center">
          <h2 className="editorial text-[36px] md:text-display leading-[1.05] max-w-[780px] mx-auto">
            The next trip starts with a number.<br />
            <em className="italic text-accent">Name it.</em>
          </h2>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href="/onboarding"
              className="premium-button inline-flex items-center gap-2 rounded-md px-6 py-3.5"
            >
              Start your first mission
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Components
   ────────────────────────────────────────────────────────── */

function TopNav() {
  return (
    <header className="topbar-glass sticky top-0 z-40">
      <div className="mx-auto max-w-wide px-6 lg:px-12 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark />
          <span className="editorial text-body-lg text-pen-1 tracking-tight">Flyeas</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          <Link href="/flights" className="text-body text-pen-2 hover:text-pen-1 transition">Flights</Link>
          <Link href="/hotels" className="text-body text-pen-2 hover:text-pen-1 transition">Hotels</Link>
          <Link href="/missions" className="text-body text-pen-2 hover:text-pen-1 transition">Missions</Link>
          <Link href="/#pricing" className="text-body text-pen-2 hover:text-pen-1 transition">Pricing</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/onboarding"
            className="text-body text-pen-2 hover:text-pen-1 transition px-3 py-2"
          >
            Sign in
          </Link>
          <Link
            href="/onboarding"
            className="premium-button inline-flex items-center gap-2 rounded-md px-4 py-2 text-body"
          >
            Begin
          </Link>
        </div>
      </div>
    </header>
  );
}

function LogoMark() {
  return (
    <span
      className="flex items-center justify-center w-7 h-7 rounded-md"
      style={{ background: 'var(--ink-700)', border: '1px solid var(--line-2)' }}
      aria-hidden="true"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
      </svg>
    </span>
  );
}

/* ─── Hero visual: a minimalist globe with a single arc ─── */
function HeroVisual() {
  return (
    <div
      className="relative rounded-xl overflow-hidden border border-line-1"
      style={{
        background: 'var(--ink-900)',
        aspectRatio: '1 / 1',
        maxWidth: '560px',
        margin: '0 auto',
      }}
    >
      <svg viewBox="0 0 400 400" className="w-full h-full">
        <defs>
          <radialGradient id="globeFill" cx="0.45" cy="0.4" r="0.6">
            <stop offset="0%" stopColor="#1D1D22" />
            <stop offset="100%" stopColor="#0B0B0D" />
          </radialGradient>
          <linearGradient id="arcFill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#D4A24C" stopOpacity="0" />
            <stop offset="50%" stopColor="#D4A24C" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#D4A24C" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Globe */}
        <circle cx="200" cy="200" r="140" fill="url(#globeFill)" stroke="#252528" strokeWidth="1" />

        {/* Meridians */}
        {[-60, -30, 0, 30, 60].map((rot) => (
          <ellipse
            key={rot}
            cx="200"
            cy="200"
            rx={140 * Math.abs(Math.cos((rot * Math.PI) / 180))}
            ry="140"
            fill="none"
            stroke="#1A1A1D"
            strokeWidth="0.8"
          />
        ))}

        {/* Parallels */}
        {[40, 80, 120].map((r) => (
          <ellipse
            key={r}
            cx="200"
            cy="200"
            rx="140"
            ry={r}
            fill="none"
            stroke="#1A1A1D"
            strokeWidth="0.8"
          />
        ))}

        {/* Horizon line */}
        <line x1="60" y1="200" x2="340" y2="200" stroke="#252528" strokeWidth="0.8" />

        {/* Single elegant arc — the flight */}
        <path
          d="M 90 210 Q 200 70 320 195"
          fill="none"
          stroke="url(#arcFill)"
          strokeWidth="1.5"
          strokeDasharray="6 4"
        >
          <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="4s" repeatCount="indefinite" />
        </path>

        {/* Origin + destination markers */}
        <circle cx="90" cy="210" r="3.5" fill="#D4A24C" />
        <circle cx="90" cy="210" r="8" fill="none" stroke="#D4A24C" strokeWidth="1" opacity="0.3" />
        <circle cx="320" cy="195" r="3.5" fill="#D4A24C" />
        <circle cx="320" cy="195" r="8" fill="none" stroke="#D4A24C" strokeWidth="1" opacity="0.3" />

        {/* Tiny plane icon travelling along the arc */}
        <g>
          <animateMotion dur="6s" repeatCount="indefinite" path="M 90 210 Q 200 70 320 195" rotate="auto" />
          <path d="M -4 0 L 4 0 L 6 -2 L 7 -2 L 6 0 L 7 0 L 7 1 L 6 1 L 7 3 L 6 3 L 4 1 L -4 1 L -6 2 L -7 2 L -6 1 L -7 1 L -7 0 L -6 0 L -7 -2 L -6 -2 Z" fill="#F5F5F1" transform="scale(0.9)" />
        </g>

        {/* Label — handwritten feel */}
        <text x="90" y="235" fill="#A9A9A4" fontSize="11" fontFamily="var(--font-editorial)" fontStyle="italic">Paris</text>
        <text x="290" y="175" fill="#A9A9A4" fontSize="11" fontFamily="var(--font-editorial)" fontStyle="italic">Tokyo</text>
      </svg>

      {/* Subtle caption */}
      <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between">
        <div>
          <p className="text-micro uppercase text-pen-3">Watching since</p>
          <p className="text-caption text-pen-2 font-mono mt-0.5">03:12 GMT</p>
        </div>
        <div className="text-right">
          <p className="text-micro uppercase text-pen-3">Best today</p>
          <p className="text-body text-pen-1 font-mono mt-0.5">$642</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Reusable editorial product section ─── */
function ProductSection({
  eyebrow,
  title,
  body,
  visual,
  stat,
  align,
}: {
  eyebrow: string;
  title: string;
  body: string;
  visual?: React.ReactNode;
  stat?: { label: string; value: number; currencyConvert?: boolean };
  align: 'left' | 'right';
}) {
  const copyOrder = align === 'left' ? 'lg:order-first' : 'lg:order-last';
  const visualOrder = align === 'left' ? 'lg:order-last' : 'lg:order-first';

  return (
    <section className="border-b border-line-1">
      <div className="mx-auto max-w-wide px-6 lg:px-12 py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div className={copyOrder}>
            <p className="text-micro uppercase text-pen-3 mb-3">{eyebrow}</p>
            <h2 className="editorial text-h1">{title}</h2>
            <p className="mt-5 text-body-lg text-pen-2 max-w-[520px]">{body}</p>
          </div>
          <div className={visualOrder}>
            {visual ? (
              visual
            ) : stat ? (
              <StatVisual stat={stat} />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function StatVisual({ stat }: { stat: { label: string; value: number; currencyConvert?: boolean } }) {
  return (
    <div
      className="rounded-xl p-10 md:p-12 border border-line-1"
      style={{ background: 'var(--ink-900)' }}
    >
      <p className="text-micro uppercase text-pen-3">{stat.label}</p>
      <div className="mt-3">
        {stat.currencyConvert ? (
          <PriceDisplay usd={stat.value} size="2xl" className="editorial !font-medium text-[56px] leading-none" />
        ) : (
          <span className="editorial text-[56px] leading-none text-pen-1 font-medium">
            {stat.value.toLocaleString()}
          </span>
        )}
      </div>
      <div className="mt-6 pt-6 border-t border-line-1">
        <p className="text-caption text-pen-3">
          Updated every six hours. Figures are real and verifiable in your account once you sign in.
        </p>
      </div>
    </div>
  );
}

function MissionVisual() {
  return (
    <div
      className="rounded-xl overflow-hidden border border-line-1"
      style={{ background: 'var(--ink-900)' }}
    >
      {/* Mock mission cockpit */}
      <div className="p-6 border-b border-line-1 flex items-center justify-between">
        <div>
          <p className="text-micro uppercase text-pen-3">Mission</p>
          <p className="editorial text-h2 mt-1">Paris → Tokyo</p>
          <p className="text-caption text-pen-3 mt-1">Dec 14 – Dec 22 · Business</p>
        </div>
        <span className="highlight-badge">Watching</span>
      </div>

      <div className="p-6 space-y-4">
        <div className="flex items-baseline justify-between">
          <span className="text-caption text-pen-3">Target</span>
          <span className="font-mono text-body text-pen-1">$2,400</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-caption text-pen-3">Current best</span>
          <span className="font-mono text-body-lg text-accent">$2,510</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-caption text-pen-3">30-day low</span>
          <span className="font-mono text-body text-pen-2">$2,340</span>
        </div>

        {/* Sparkline — clean minimal */}
        <div className="pt-4 border-t border-line-1">
          <svg viewBox="0 0 200 40" className="w-full h-10">
            <polyline
              points="0,28 25,22 50,24 75,18 100,14 125,20 150,12 175,16 200,10"
              fill="none"
              stroke="#D4A24C"
              strokeWidth="1.2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <polyline
              points="0,28 25,22 50,24 75,18 100,14 125,20 150,12 175,16 200,10 200,40 0,40"
              fill="#D4A24C"
              fillOpacity="0.06"
            />
          </svg>
          <div className="flex justify-between mt-2 text-micro uppercase text-pen-3">
            <span>Nov 14</span>
            <span>Today</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PriceBreakdownVisual() {
  return (
    <div
      className="rounded-xl overflow-hidden border border-line-1"
      style={{ background: 'var(--ink-900)' }}
    >
      <div className="p-6 border-b border-line-1">
        <p className="text-micro uppercase text-pen-3">Invoice</p>
        <p className="editorial text-h2 mt-1">Total due</p>
      </div>
      <div className="p-6 space-y-3 font-mono text-body">
        <Row label="Base fare" value="$486.00" />
        <Row label="Taxes" value="$87.40" />
        <Row label="Carrier fees" value="$12.00" />
        <Row label="Seat (12A)" value="$32.00" />
        <Row label="Baggage (1 × 23kg)" value="$45.00" />
        <div className="h-px bg-line-1 my-2" />
        <Row label="Payment processing" value="included" muted />
        <Row label="Flyeas service" value="included" muted />
        <div className="h-px bg-line-1 my-2" />
        <div className="flex items-baseline justify-between pt-2">
          <span className="text-body font-sans text-pen-1 font-medium">Total</span>
          <span className="text-body-lg text-pen-1 font-medium">$662.40</span>
        </div>
        <p className="text-caption text-pen-3 font-sans pt-2">No fees added at checkout.</p>
      </div>
    </div>
  );
}

function Row({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between items-baseline ${muted ? 'text-pen-3' : 'text-pen-2'}`}>
      <span className="font-sans text-caption">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="editorial text-[32px] md:text-[40px] leading-none text-pen-1 font-medium">{value}</p>
      <p className="mt-2 text-caption text-pen-3">{label}</p>
    </div>
  );
}

function PricingCard({ tier }: { tier: typeof TIERS[number] }) {
  const isHighlight = tier.highlight;
  return (
    <div
      className={`rounded-lg border p-8 transition-colors ${
        isHighlight ? 'border-line-3' : 'border-line-1 hover:border-line-2'
      }`}
      style={{
        background: isHighlight ? 'var(--ink-700)' : 'var(--ink-800)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="editorial text-h2 text-pen-1">{tier.name}</p>
        {isHighlight && <span className="highlight-badge">Recommended</span>}
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        {tier.price === 0 ? (
          <span className="editorial text-[40px] leading-none text-pen-1">Free</span>
        ) : (
          <>
            <span className="editorial text-[40px] leading-none text-pen-1">${tier.price}</span>
            <span className="text-caption text-pen-3">{tier.cadence}</span>
          </>
        )}
      </div>
      <p className="text-body text-pen-2 mb-8">{tier.pitch}</p>
      <Link
        href={tier.ctaHref}
        className={`block text-center w-full rounded-md py-3 text-body font-medium transition ${
          isHighlight
            ? 'premium-button'
            : 'secondary-button'
        }`}
      >
        {tier.cta}
      </Link>
      <ul className="mt-8 space-y-3 border-t border-line-1 pt-6">
        {tier.items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-caption text-pen-2">
            <Check className="w-4 h-4 text-pen-3 shrink-0 mt-px" strokeWidth={1.8} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Footer() {
  return (
    <footer className="bg-ink-900">
      <div className="mx-auto max-w-wide px-6 lg:px-12 py-16">
        <div className="grid md:grid-cols-[1.5fr_1fr_1fr_1fr] gap-10 md:gap-16 mb-12">
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4">
              <LogoMark />
              <span className="editorial text-body-lg text-pen-1">Flyeas</span>
            </Link>
            <p className="text-caption text-pen-2 max-w-[320px] leading-relaxed">
              A travel concierge that watches prices, negotiates with inventory, and books on your terms.
            </p>
          </div>
          <FooterColumn
            title="Product"
            items={[
              { href: '/flights', label: 'Flights' },
              { href: '/hotels', label: 'Hotels' },
              { href: '/cars', label: 'Cars' },
              { href: '/insurance', label: 'Insurance' },
              { href: '/missions', label: 'Missions' },
              { href: '/rewards', label: 'Rewards' },
              { href: '/referral', label: 'Invite & earn' },
            ]}
          />
          <FooterColumn
            title="Company"
            items={[
              { href: '/about', label: 'About' },
              { href: '/blog', label: 'Journal' },
              { href: '/legal/terms', label: 'Terms' },
              { href: '/legal/privacy', label: 'Privacy' },
            ]}
          />
          <FooterColumn
            title="Account"
            items={[
              { href: '/onboarding', label: 'Sign in' },
              { href: '/onboarding', label: 'Create account' },
              { href: '/#pricing', label: 'Pricing' },
              { href: '/settings', label: 'Preferences' },
            ]}
          />
        </div>

        <div className="pt-8 border-t border-line-1 flex flex-wrap items-center justify-between gap-4">
          <p className="text-caption text-pen-3">© {new Date().getFullYear()} Flyeas. All rights reserved.</p>
          <p className="text-caption text-pen-3">Prices in live USD, converted to your currency.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, items }: { title: string; items: Array<{ href: string; label: string }> }) {
  return (
    <div>
      <p className="text-micro uppercase text-pen-3 mb-4">{title}</p>
      <ul className="space-y-2.5">
        {items.map((i) => (
          <li key={i.label}>
            <Link href={i.href} className="text-caption text-pen-2 hover:text-pen-1 transition">
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
