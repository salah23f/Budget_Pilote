import Link from 'next/link';
import { ArrowRight, Check, ChevronDown, Minus } from 'lucide-react';
import { SiteNav } from '@/components/landing/site-nav';
import { SiteFooter } from '@/components/landing/site-footer';
import { MissionCard } from '@/components/landing/mission-card';

/* ──────────────────────────────────────────────────────────
   Flyeas landing — "the concierge mandate".

   Positioning: not a comparison site, not a planner. You give
   Flyeas a mission (destination, dates, budget, priorities);
   it watches prices around the clock, calls the right moment,
   and can book within your budget.

   Server Component — no state anywhere. The hero mission card
   is a static mock; FAQ uses native <details> disclosure.

   Sections (7):
     1. Hero + mission card
     2. How it works (#how)
     3. The difference — comparison table (#difference)
     4. Proof — 3 factual stats
     5. Pricing (#pricing)
     6. FAQ (#faq)
     7. Footer
   ────────────────────────────────────────────────────────── */

/* ── Copy data ── */

const STEPS = [
  {
    num: '01',
    title: 'Tell us your trip',
    body: 'Destination, dates, travelers, and the budget you want to stay under — that’s your mission.',
  },
  {
    num: '02',
    title: 'We watch around the clock',
    body: 'Flyeas checks fares day and night and learns how prices on your route actually move.',
  },
  {
    num: '03',
    title: 'Book at the right moment',
    body: 'When the price is right, we tell you — or book it for you, within the budget you set.',
  },
];

const COMPARE_ROWS: Array<{
  feature: string;
  flyeas: boolean;
  google: boolean;
  hopper: boolean;
  otas: boolean;
}> = [
  { feature: 'Watches prices 24/7', flyeas: true, google: true, hopper: true, otas: false },
  { feature: 'Tells you when to book', flyeas: true, google: false, hopper: true, otas: false },
  { feature: 'Books it for you, within your budget', flyeas: true, google: false, hopper: false, otas: false },
  { feature: 'Manages the whole trip — flight, hotel, car', flyeas: true, google: false, hopper: false, otas: false },
];

const STATS = [
  { value: 'Every 30 min', label: 'fares re-checked on every active mission' },
  { value: '84 €', label: 'average saved per completed mission since March' },
  { value: '0 €', label: 'in booking fees unless we save you money' },
];

const TIERS = [
  {
    name: 'Free',
    price: '0 €',
    cadence: 'always',
    pitch: 'One mission at a time, watched around the clock.',
    cta: 'Start free',
    highlight: false,
    items: [
      '1 active mission',
      'Fares checked every 30 minutes',
      'Price outlook on every route',
      'Daily deal digest',
    ],
  },
  {
    name: 'Pro',
    price: '9 €',
    cadence: 'per month',
    pitch: 'Unlimited missions, checked every 15 minutes.',
    cta: 'Start Pro trial',
    highlight: true,
    items: [
      'Unlimited missions',
      'Fares checked every 15 minutes',
      '90 days of price history',
      'Optional auto-book',
      '3× loyalty points',
    ],
  },
  {
    name: 'Elite',
    price: '29 €',
    cadence: 'per month',
    pitch: 'A dedicated concierge on every trip.',
    cta: 'Go Elite',
    highlight: false,
    items: [
      'Everything in Pro',
      'Fares checked every 5 minutes',
      'Dedicated concierge',
      'Full price history',
      '5× loyalty points',
    ],
  },
];

const FAQ = [
  {
    q: 'How does Flyeas make money?',
    a: 'Pro and Elite memberships, plus a small success fee when we book below your budget. If a mission ends without savings, you owe nothing beyond the fare itself — and we take no hidden commissions from airlines.',
  },
  {
    q: 'Can I cancel a mission?',
    a: 'Anytime, in one click, from your dashboard. The watch stops immediately and any held deposit is released the same day. Missions also close themselves once your travel dates pass.',
  },
  {
    q: 'What happens if the price never drops?',
    a: 'We tell you, plainly. If fares on your route are rising, we recommend booking sooner rather than later — waiting is only our advice when the data supports it. You never pay for a mission that doesn’t deliver.',
  },
  {
    q: 'Is my payment held safely?',
    a: 'Yes. Deposits are held by Stripe, our payment processor — Flyeas never sees or stores your card details. Money only moves when you approve a booking, or when auto-book triggers inside the rules you set.',
  },
  {
    q: 'Do I have to let Flyeas book for me?',
    a: 'No. Auto-book is off by default. Most travelers start with recommendations only, then turn it on once the calls have earned their trust.',
  },
];

/* ── Page ── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ink-950 text-pen-1">
      <SiteNav />

      {/* ═══ 1. Hero ═══ */}
      <section>
        <div className="mx-auto max-w-wide px-6 pb-20 pt-16 lg:px-12 lg:pb-28 lg:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
            <div>
              <p className="mb-5 text-micro uppercase text-pen-3">Flight &amp; hotel concierge</p>
              <h1 className="editorial text-[34px] leading-[1.05] sm:text-[46px] lg:text-[58px]">
                You know where you&rsquo;re going.
                <br />
                <em className="italic text-accent">Leave the price to us.</em>
              </h1>
              <p className="mt-6 max-w-[480px] text-body-lg leading-relaxed text-pen-2">
                Give Flyeas a mission — destination, dates, and a budget. We watch fares around
                the clock, call the right moment, and can book it the second your price appears.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link
                  href="/onboarding"
                  className="premium-button inline-flex items-center gap-2 rounded-md px-5 py-3 text-body font-semibold"
                >
                  Start a mission <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </Link>
                <Link
                  href="#how"
                  className="inline-flex items-center gap-2 rounded-md px-5 py-3 text-body text-pen-2 transition hover:text-pen-1"
                >
                  See how it works
                </Link>
              </div>
              <p className="mt-6 text-caption text-pen-3">
                Free to start &middot; No card required &middot; Cancel a mission anytime
              </p>
            </div>

            <div>
              <p className="mb-3 text-micro uppercase text-pen-3">Inside a mission</p>
              <MissionCard />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 2. How it works ═══ */}
      <section id="how" className="border-t border-line-1 bg-ink-900 scroll-mt-16">
        <div className="mx-auto max-w-wide px-6 py-20 lg:px-12 lg:py-24">
          <p className="mb-3 text-micro uppercase text-pen-3">How it works</p>
          <h2 className="editorial mb-12 text-h1">Hand it off in a minute.</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.num} className="rounded-lg border border-line-1 bg-ink-800 p-6 shadow-elev-1">
                <span className="num text-micro font-semibold text-accent">{step.num}</span>
                <h3 className="mt-3 text-body-lg font-semibold text-pen-1">{step.title}</h3>
                <p className="mt-2 text-body leading-relaxed text-pen-2">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 3. The difference ═══ */}
      <section id="difference" className="border-t border-line-1 scroll-mt-16">
        <div className="mx-auto max-w-wide px-6 py-20 lg:px-12 lg:py-24">
          <p className="mb-3 text-micro uppercase text-pen-3">The difference</p>
          <h2 className="editorial mb-4 text-h1 max-w-[560px]">
            They make you search. <em className="italic text-accent">Flyeas works for you.</em>
          </h2>
          <p className="mb-10 max-w-[520px] text-body leading-relaxed text-pen-2">
            Search engines end where the real work begins. A mission keeps going until you&rsquo;re
            booked — or tells you honestly why you shouldn&rsquo;t be yet.
          </p>

          <div className="overflow-hidden rounded-lg border border-line-1 bg-ink-800 shadow-elev-1">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="border-b border-line-1">
                    <th className="w-[40%] px-6 py-4 text-caption font-normal text-pen-3">&nbsp;</th>
                    <th className="px-4 py-4 text-caption font-semibold text-accent">Flyeas</th>
                    <th className="px-4 py-4 text-caption font-normal text-pen-3">Google Flights</th>
                    <th className="px-4 py-4 text-caption font-normal text-pen-3">Hopper</th>
                    <th className="px-4 py-4 text-caption font-normal text-pen-3">Online agencies</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row, i) => (
                    <tr key={row.feature} className={i < COMPARE_ROWS.length - 1 ? 'border-b border-line-1' : ''}>
                      <td className="px-6 py-4 text-body text-pen-1">{row.feature}</td>
                      <CompareCell active={row.flyeas} highlight />
                      <CompareCell active={row.google} />
                      <CompareCell active={row.hopper} />
                      <CompareCell active={row.otas} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 4. Proof ═══ */}
      <section className="border-t border-line-1 bg-ink-900">
        <div className="mx-auto max-w-wide px-6 py-20 lg:px-12 lg:py-24">
          <p className="mb-3 text-micro uppercase text-pen-3">Proof, not promises</p>
          <h2 className="editorial mb-12 text-h1">Quiet work you can measure.</h2>
          <div className="grid divide-y divide-line-1 rounded-lg border border-line-1 bg-ink-800 shadow-elev-1 md:grid-cols-3 md:divide-x md:divide-y-0">
            {STATS.map((stat) => (
              <div key={stat.label} className="p-8">
                <p className="editorial num text-[34px] leading-none text-pen-1 sm:text-[38px]">
                  {stat.value}
                </p>
                <p className="mt-3 max-w-[240px] text-body leading-relaxed text-pen-2">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 5. Pricing ═══ */}
      <section id="pricing" className="border-t border-line-1 scroll-mt-16">
        <div className="mx-auto max-w-wide px-6 py-20 lg:px-12 lg:py-24">
          <div className="mb-12 max-w-[560px]">
            <p className="mb-3 text-micro uppercase text-pen-3">Membership</p>
            <h2 className="editorial text-h1">Simple tiers. No surprises.</h2>
            <p className="mt-3 text-body text-pen-2">
              Every plan includes a live mission and the price outlook. Paid tiers add speed,
              history, and hands.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {TIERS.map((tier) => (
              <PricingCard key={tier.name} tier={tier} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 6. FAQ ═══ */}
      <section id="faq" className="border-t border-line-1 bg-ink-900 scroll-mt-16">
        <div className="mx-auto max-w-prose px-6 py-20 lg:px-12 lg:py-24">
          <p className="mb-3 text-micro uppercase text-pen-3">Honest answers</p>
          <h2 className="editorial mb-10 text-h1">Questions we actually get.</h2>
          <div className="border-t border-line-1">
            {FAQ.map((item) => (
              <details key={item.q} className="group border-b border-line-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-body-lg font-medium text-pen-1 [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-pen-3 transition-transform group-open:rotate-180"
                    strokeWidth={1.8}
                  />
                </summary>
                <p className="pb-5 text-body leading-relaxed text-pen-2">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 7. Footer ═══ */}
      <SiteFooter />
    </div>
  );
}

/* ── Local pieces ── */

function CompareCell({ active, highlight = false }: { active: boolean; highlight?: boolean }) {
  return (
    <td className="px-4 py-4">
      {active ? (
        <Check
          className={`h-4 w-4 ${highlight ? 'text-accent' : 'text-pen-3'}`}
          strokeWidth={2}
          aria-label="Yes"
        />
      ) : (
        <Minus className="h-4 w-4 text-pen-3" strokeWidth={1.5} aria-label="No" />
      )}
    </td>
  );
}

function PricingCard({ tier }: { tier: (typeof TIERS)[number] }) {
  const hl = tier.highlight;
  return (
    <div
      className={`rounded-lg border p-8 transition-colors ${
        hl
          ? 'border-line-3 bg-ink-700 shadow-elev-2'
          : 'border-line-1 bg-ink-800 shadow-elev-1 hover:border-line-2'
      }`}
    >
      <div className="mb-4 flex items-center justify-between">
        <p className="editorial text-h2 text-pen-1">{tier.name}</p>
        {hl && (
          <span className="inline-flex items-center rounded-full bg-accent-soft px-2 py-0.5 text-micro font-semibold uppercase text-accent">
            Recommended
          </span>
        )}
      </div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="editorial num text-[40px] leading-none text-pen-1">{tier.price}</span>
        <span className="text-caption text-pen-3">{tier.cadence}</span>
      </div>
      <p className="mb-8 text-body text-pen-2">{tier.pitch}</p>
      <Link
        href="/onboarding"
        className={`block w-full rounded-md py-3 text-center text-body font-medium transition ${
          hl ? 'premium-button' : 'secondary-button'
        }`}
      >
        {tier.cta}
      </Link>
      <ul className="mt-8 space-y-3 border-t border-line-1 pt-6">
        {tier.items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-caption text-pen-2">
            <Check className="mt-px h-4 w-4 shrink-0 text-pen-3" strokeWidth={1.8} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
