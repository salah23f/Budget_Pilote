'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TripPlannerHero from '@/components/trip-planner-hero';
import LiveDeals from '@/components/live-deals';
import { Accordion, AccordionItem } from '@/components/ui/accordion';
import { ArrowRight, Check, Minus, ShieldCheck, Lock, Globe, CreditCard } from 'lucide-react';

/* ──────────────────────────────────────────────────────────
   Landing V_FINAL — merge V_A density + V_B polish.

   Sections (8):
     1. Hero + demo (V_B editorial)
     2. How it works — 3 steps (V_A, restyled)
     3. How a watch works — mission visual (V_B)
     4. Comparison table — Flyeas vs 3 competitors (V_A structured)
     5. Live deals now (V_A component)
     6. Pricing (V_B clean)
     7. FAQ — 6 questions (V_A count, V_B style)
     8. Footer (V_B)
   ────────────────────────────────────────────────────────── */

const TIERS = [
  {
    name: 'Free', price: 0, cadence: 'Always',
    pitch: 'Watch one trip. Daily deal digest.',
    cta: 'Begin', ctaHref: '/onboarding', highlight: false,
    items: ['1 live watch', '3 searches / day', 'Price outlook', 'Deal alerts, daily'],
  },
  {
    name: 'Pro', price: 9, cadence: 'per month',
    pitch: 'Unlimited watches. Real-time alerts. 3x points.',
    cta: 'Start Pro trial', ctaHref: '/onboarding', highlight: true,
    items: ['Unlimited watches', '15-minute monitoring', '90 days of history', 'Optional auto-book', '3x loyalty points'],
  },
  {
    name: 'Elite', price: 29, cadence: 'per month',
    pitch: 'Dedicated concierge. 5x points. Priority support.',
    cta: 'Go Elite', ctaHref: '/onboarding', highlight: false,
    items: ['Everything in Pro', '5-minute monitoring', 'Dedicated concierge', 'Full price history', '5x points'],
  },
];

const FAQ = [
  { q: 'How do you know the "typical" price?', a: 'For every route, we analyze 60-500 recent fares across the last 180 days, normalized for season and day-of-week. We show the median, interquartile range, and your position in that distribution.' },
  { q: "What if my budget isn't realistic?", a: "We tell you, calmly and specifically, before you commit. You'll see which lever (dates, airports, stops) would move your feasibility the most." },
  { q: 'Do I have to let you auto-book?', a: 'No. Auto-book is an optional advanced toggle, off by default. You get most of the value without it.' },
  { q: 'Do you hide any fees?', a: 'No. The number you see is the number you pay. Taxes and required fees are always included up-front.' },
  { q: 'How many currencies and languages do you support?', a: '32 languages and 85+ currencies. Switch anytime from the header. Conversions use live rates refreshed every six hours.' },
  { q: 'Can I cancel Pro anytime?', a: 'Yes. No contracts, no lock-in. If you cancel mid-cycle you keep Pro until the period ends.' },
];

const GREETINGS = [
  { text: 'Hello', lang: 'English' },
  { text: 'Bonjour', lang: 'Francais' },
  { text: 'Guten Tag', lang: 'Deutsch' },
  { text: 'Hola', lang: 'Espanol' },
];

/* ── Comparison data ── */
const COMPARE_ROWS = [
  { feature: 'Price vs route history', flyeas: true, skyscanner: false, google: false, kiwi: false },
  { feature: 'Unrealistic budget detection', flyeas: true, skyscanner: false, google: false, kiwi: false },
  { feature: '24/7 price monitoring', flyeas: true, skyscanner: false, google: true, kiwi: false },
  { feature: 'Auto-book at target', flyeas: true, skyscanner: false, google: false, kiwi: false },
  { feature: 'Transparent recommendations', flyeas: true, skyscanner: false, google: false, kiwi: false },
  { feature: 'Zero hidden fees', flyeas: true, skyscanner: true, google: true, kiwi: false },
];

export default function LandingPage() {
  const [gi, setGi] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setGi((p) => (p + 1) % GREETINGS.length); setVisible(true); }, 300);
    }, 3600);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-ink-950 text-pen-1">
      <TopNav />

      {/* ═══ 1. Hero + demo ═══ */}
      <section>
        <div className="mx-auto max-w-wide px-6 lg:px-12 pt-20 lg:pt-28 pb-20 lg:pb-24">
          <div className="grid lg:grid-cols-[0.95fr_1.05fr] gap-12 lg:gap-20 items-start">
            <div className="lg:pt-6">
              <p className="text-micro uppercase text-pen-3 mb-5 flex items-center gap-2">
                <span className="inline-block transition-opacity duration-300" style={{ opacity: visible ? 1 : 0 }}>
                  {GREETINGS[gi].text}
                </span>
                <span className="h-1 w-1 rounded-full bg-pen-3/60" />
                <span>A travel concierge</span>
              </p>
              <h1 className="editorial text-[44px] md:text-[60px] leading-[1.02]">
                Know the real price.<br />
                <em className="italic text-accent">Then</em> decide.
              </h1>
              <p className="mt-6 text-body-lg text-pen-2 max-w-[460px] leading-relaxed">
                Flyeas shows you what any flight typically costs, whether today&apos;s fare is good,
                and quietly watches the price until it lands.
              </p>
              <div className="mt-10 flex items-center gap-3">
                <Link href="/onboarding" className="premium-button inline-flex items-center gap-2 rounded-md px-5 py-3 text-body font-semibold">
                  Begin <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </Link>
                <Link href="#how" className="inline-flex items-center gap-2 rounded-md px-5 py-3 text-body text-pen-2 hover:text-pen-1 transition">
                  How it works
                </Link>
              </div>
              {/* Trust badges inline */}
              <div className="mt-8 flex flex-wrap items-center gap-4 text-caption text-pen-3">
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.5} /> SSL encrypted</span>
                <span className="inline-flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" strokeWidth={1.5} /> Stripe verified</span>
                <span className="inline-flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" strokeWidth={1.5} /> GDPR compliant</span>
                <span className="inline-flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" strokeWidth={1.5} /> 32 languages</span>
              </div>
            </div>
            <div className="lg:sticky lg:top-24">
              <p className="text-micro uppercase text-pen-3 mb-3">Try it now — live data, no login</p>
              <div className="rounded-lg border border-line-1 bg-ink-900 p-4">
                <TripPlannerHero />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 2. How it works — 3 steps ═══ */}
      <section id="how" className="border-t border-line-1 bg-ink-900">
        <div className="mx-auto max-w-wide px-6 lg:px-12 py-20 lg:py-24">
          <p className="text-micro uppercase text-pen-3 mb-3">How it works</p>
          <h2 className="editorial text-h1 mb-12">Three steps. One decision.</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { num: '01', title: 'Describe your trip', body: 'Type a route, pick dates (or a month, or a season), set a budget. One sentence is enough.' },
              { num: '02', title: 'We watch the market', body: 'Every few minutes, we check 400+ airlines. You see where the price sits vs its own history — and whether your target is realistic.' },
              { num: '03', title: 'You decide', body: 'When a matching fare appears, we explain why it fits. You book on the partner site, or let us auto-book. Your call.' },
            ].map((s) => (
              <div key={s.num} className="rounded-lg border border-line-1 bg-ink-800 p-6">
                <span className="text-micro font-mono text-accent">{s.num}</span>
                <h3 className="text-body-lg text-pen-1 font-semibold mt-3">{s.title}</h3>
                <p className="text-body text-pen-2 mt-2 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 3. How a watch works — visual ═══ */}
      <section className="border-t border-line-1">
        <div className="mx-auto max-w-wide px-6 lg:px-12 py-20 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
            <div>
              <p className="text-micro uppercase text-pen-3 mb-4">Inside a watch</p>
              <h2 className="editorial text-h1 max-w-[460px]">
                Set a trip. Set a target. <em className="italic text-accent">Forget about it.</em>
              </h2>
              <p className="mt-5 text-body text-pen-2 max-w-[460px] leading-relaxed">
                We pull 60-500 historical fares for your route, tell you honestly whether your
                target is realistic, then check every few minutes until a matching offer appears.
              </p>
              <p className="mt-4 text-body text-pen-2 max-w-[460px] leading-relaxed">
                Each alert explains itself: how far below typical the price is, how confident
                we are, what the trade-offs are. No unexplained picks, ever.
              </p>
            </div>
            <MissionVisual />
          </div>
        </div>
      </section>

      {/* ═══ 4. Comparison table ═══ */}
      <section className="border-t border-line-1 bg-ink-900">
        <div className="mx-auto max-w-wide px-6 lg:px-12 py-20 lg:py-24">
          <p className="text-micro uppercase text-pen-3 mb-3">How we compare</p>
          <h2 className="editorial text-h1 mb-10">Not another flight search.</h2>

          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-left min-w-[600px]">
              <thead>
                <tr className="border-b border-line-1">
                  <th className="text-caption text-pen-3 font-normal pb-3 pr-4 w-[40%]">Feature</th>
                  <th className="text-caption text-accent font-semibold pb-3 px-4">Flyeas</th>
                  <th className="text-caption text-pen-3 font-normal pb-3 px-4">Skyscanner</th>
                  <th className="text-caption text-pen-3 font-normal pb-3 px-4">Google Flights</th>
                  <th className="text-caption text-pen-3 font-normal pb-3 px-4">Kiwi</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row, i) => (
                  <tr key={i} className="border-b border-line-1">
                    <td className="text-body text-pen-1 py-3 pr-4">{row.feature}</td>
                    <td className="py-3 px-4">{row.flyeas ? <Check className="w-4 h-4 text-success" strokeWidth={2} /> : <Minus className="w-4 h-4 text-pen-3" strokeWidth={1.5} />}</td>
                    <td className="py-3 px-4">{row.skyscanner ? <Check className="w-4 h-4 text-pen-3" strokeWidth={2} /> : <Minus className="w-4 h-4 text-pen-3" strokeWidth={1.5} />}</td>
                    <td className="py-3 px-4">{row.google ? <Check className="w-4 h-4 text-pen-3" strokeWidth={2} /> : <Minus className="w-4 h-4 text-pen-3" strokeWidth={1.5} />}</td>
                    <td className="py-3 px-4">{row.kiwi ? <Check className="w-4 h-4 text-pen-3" strokeWidth={2} /> : <Minus className="w-4 h-4 text-pen-3" strokeWidth={1.5} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ═══ 5. Live deals ═══ */}
      <section className="border-t border-line-1">
        <div className="mx-auto max-w-wide px-6 lg:px-12 py-20 lg:py-24">
          <p className="text-micro uppercase text-pen-3 mb-3">Right now</p>
          <h2 className="editorial text-h1 mb-8">Deals we found today.</h2>
          <LiveDeals />
        </div>
      </section>

      {/* ═══ 6. Pricing ═══ */}
      <section id="pricing" className="border-t border-line-1 bg-ink-900">
        <div className="mx-auto max-w-wide px-6 lg:px-12 py-20 lg:py-24">
          <div className="max-w-[560px] mb-12">
            <p className="text-micro uppercase text-pen-3 mb-3">Membership</p>
            <h2 className="editorial text-h1">Three tiers. No surprises.</h2>
            <p className="mt-3 text-body text-pen-2">Start free — the price outlook and one live watch are always included.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {TIERS.map((tier) => <PricingCard key={tier.name} tier={tier} />)}
          </div>
        </div>
      </section>

      {/* ═══ 7. FAQ — 6 questions ═══ */}
      <section className="border-t border-line-1">
        <div className="mx-auto max-w-prose px-6 lg:px-12 py-20 lg:py-24">
          <p className="text-micro uppercase text-pen-3 mb-3">Briefly answered</p>
          <h2 className="editorial text-h1 mb-10">Questions.</h2>
          <Accordion>
            {FAQ.map((item, idx) => (
              <AccordionItem key={idx} title={item.q} defaultOpen={idx === 0}>
                <p className="text-body text-pen-2 leading-relaxed">{item.a}</p>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ═══ 8. Footer ═══ */}
      <Footer />
    </div>
  );
}

/* ══════════ Components ══════════ */

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
          <Link href="#how" className="text-body text-pen-2 hover:text-pen-1 transition">How it works</Link>
          <Link href="#pricing" className="text-body text-pen-2 hover:text-pen-1 transition">Pricing</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/onboarding" className="text-body text-pen-2 hover:text-pen-1 transition px-3 py-2">Sign in</Link>
          <Link href="/onboarding" className="premium-button inline-flex items-center gap-2 rounded-md px-4 py-2 text-body">Begin</Link>
        </div>
      </div>
    </header>
  );
}

function LogoMark() {
  return (
    <span className="flex items-center justify-center w-7 h-7 rounded-md" style={{ background: 'var(--ink-700)', border: '1px solid var(--line-2)' }} aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
      </svg>
    </span>
  );
}

function MissionVisual() {
  return (
    <div className="rounded-lg overflow-hidden border border-line-1" style={{ background: 'var(--ink-800)' }}>
      <div className="p-6 border-b border-line-1 flex items-center justify-between">
        <div>
          <p className="text-micro uppercase text-pen-3">Your watch</p>
          <p className="editorial text-h2 mt-1">Paris → Tokyo</p>
          <p className="text-caption text-pen-3 mt-1">July · 2 weeks · economy</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-caption text-accent bg-accent-soft">Watching</span>
      </div>
      <div className="p-6 space-y-4">
        <div className="flex items-baseline justify-between"><span className="text-caption text-pen-3">Your target</span><span className="font-mono text-body text-pen-1">$640</span></div>
        <div className="flex items-baseline justify-between"><span className="text-caption text-pen-3">Typical for this route</span><span className="font-mono text-body text-pen-2">$780</span></div>
        <div className="flex items-baseline justify-between"><span className="text-caption text-pen-3">Best price today</span><span className="font-mono text-body-lg text-accent">$712</span></div>
        <div className="pt-4 border-t border-line-1">
          <svg viewBox="0 0 200 48" className="w-full h-12" aria-hidden="true">
            <polyline points="0,30 25,26 50,28 75,22 100,18 125,24 150,14 175,18 200,12" fill="none" stroke="var(--accent)" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
            <polyline points="0,30 25,26 50,28 75,22 100,18 125,24 150,14 175,18 200,12 200,48 0,48" fill="var(--accent)" fillOpacity="0.06" />
          </svg>
          <div className="flex justify-between mt-2 text-micro uppercase text-pen-3"><span>30 days ago</span><span>Today</span></div>
        </div>
      </div>
    </div>
  );
}

function PricingCard({ tier }: { tier: typeof TIERS[number] }) {
  const hl = tier.highlight;
  return (
    <div className={`rounded-lg border p-8 transition-colors ${hl ? 'border-line-3' : 'border-line-1 hover:border-line-2'}`} style={{ background: hl ? 'var(--ink-700)' : 'var(--ink-800)' }}>
      <div className="flex items-center justify-between mb-4">
        <p className="editorial text-h2 text-pen-1">{tier.name}</p>
        {hl && <span className="inline-flex items-center rounded-sm px-2 py-0.5 text-micro uppercase bg-accent-soft text-accent font-semibold">Recommended</span>}
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        {tier.price === 0 ? <span className="editorial text-[40px] leading-none text-pen-1">Free</span> : (
          <><span className="editorial text-[40px] leading-none text-pen-1">${tier.price}</span><span className="text-caption text-pen-3">{tier.cadence}</span></>
        )}
      </div>
      <p className="text-body text-pen-2 mb-8">{tier.pitch}</p>
      <Link href={tier.ctaHref} className={`block text-center w-full rounded-md py-3 text-body font-medium transition ${hl ? 'premium-button' : 'secondary-button'}`}>
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
    <footer className="border-t border-line-1 bg-ink-950">
      <div className="mx-auto max-w-wide px-6 lg:px-12 py-20">
        <div className="grid md:grid-cols-[1.5fr_1fr_1fr_1fr] gap-12 mb-12">
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4">
              <LogoMark />
              <span className="editorial text-body-lg text-pen-1">Flyeas</span>
            </Link>
            <p className="text-caption text-pen-2 max-w-[320px] leading-relaxed">
              A travel concierge that quotes every route against its own history, then watches the price until it lands.
            </p>
          </div>
          <FooterCol title="Product" items={[
            { href: '/flights', label: 'Flights' }, { href: '/hotels', label: 'Hotels' },
            { href: '/missions', label: 'Watches' }, { href: '/rewards', label: 'Rewards' },
            { href: '/referral', label: 'Invite & earn' },
          ]} />
          <FooterCol title="Company" items={[
            { href: '/about', label: 'About' }, { href: '/blog', label: 'Journal' },
            { href: '/legal/terms', label: 'Terms' }, { href: '/legal/privacy', label: 'Privacy' },
          ]} />
          <FooterCol title="Account" items={[
            { href: '/onboarding', label: 'Sign in' }, { href: '/onboarding', label: 'Create account' },
            { href: '#pricing', label: 'Pricing' }, { href: '/settings', label: 'Preferences' },
          ]} />
        </div>
        <div className="pt-8 border-t border-line-1 flex flex-wrap items-center justify-between gap-4">
          <p className="text-caption text-pen-3">&copy; {new Date().getFullYear()} Flyeas. All rights reserved.</p>
          <p className="text-caption text-pen-3">Prices in live USD. Converts to your currency.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: Array<{ href: string; label: string }> }) {
  return (
    <div>
      <p className="text-micro uppercase text-pen-3 mb-4">{title}</p>
      <ul className="space-y-2.5">
        {items.map((i) => <li key={i.label}><Link href={i.href} className="text-caption text-pen-2 hover:text-pen-1 transition">{i.label}</Link></li>)}
      </ul>
    </div>
  );
}
