'use client';

import Link from 'next/link';
import { useState } from 'react';

/**
 * Pricing page — 3 tiers (Free / Pro / Elite). This is the most
 * visited page by investors and the #1 conversion driver for the
 * freemium model.
 */

const TIERS = [
  {
    name: 'Free',
    price: 0,
    annual: 0,
    desc: 'Get started with AI travel intelligence',
    cta: 'Get started',
    ctaHref: '/onboarding',
    highlight: false,
    features: [
      '1 active mission',
      '3 flight searches / day',
      'Basic price predictions',
      'Deal alerts (daily digest)',
      'Price calendar view',
      'Flyeas Points: 1× (2 pts per $1)',
      'Community support',
    ],
    limits: [
      'No auto-buy',
      'No priority monitoring',
    ],
  },
  {
    name: 'Pro',
    price: 9.99,
    annual: 79,
    desc: 'For serious travelers who want the AI to work 24/7',
    cta: 'Start Pro trial',
    ctaHref: '/onboarding',
    highlight: true,
    badge: 'Most popular',
    features: [
      'Unlimited missions',
      'Unlimited searches',
      'Full statistical predictions (z-score, percentiles, trends)',
      'Auto-buy when price is right',
      'Price calendar heatmap',
      'Priority monitoring (every 15 min)',
      'Real-time push alerts',
      'Price history (90 days)',
      'Flyeas Points: 3× (6 pts per $1)',
      'Priority support',
    ],
    limits: [],
  },
  {
    name: 'Elite',
    price: 29.99,
    annual: 249,
    desc: 'Premium experience with dedicated AI agent',
    cta: 'Go Elite',
    ctaHref: '/onboarding',
    highlight: false,
    features: [
      'Everything in Pro',
      'Dedicated AI travel advisor',
      'Group trip builder',
      'Business & First class tracking',
      'Multi-city mission planning',
      'Exclusive 48h early access deals',
      'Flyeas Points: 5× (10 pts per $1)',
      'Crypto payments (USDC, no fees)',
      'White-glove onboarding',
    ],
    limits: [],
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(true);

  return (
    <div className="py-6">
      <div className="mx-auto max-w-5xl px-4">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            Simple, transparent pricing
          </h1>
          <p className="text-white/50 mt-3 max-w-md mx-auto text-sm">
            Start free. Upgrade when you want the full power of AI-driven travel booking.
          </p>

          {/* Monthly / Annual toggle */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <span className={`text-sm ${!annual ? 'text-white' : 'text-white/40'}`}>Monthly</span>
            <button
              type="button"
              onClick={() => setAnnual(!annual)}
              className="relative h-7 w-12 rounded-full transition-colors"
              style={{ background: annual ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)' }}
            >
              <div
                className="absolute top-1 h-5 w-5 rounded-full bg-white transition-transform"
                style={{ transform: annual ? 'translateX(24px)' : 'translateX(4px)' }}
              />
            </button>
            <span className={`text-sm ${annual ? 'text-white' : 'text-white/40'}`}>
              Annual
              <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300">
                Save 35%
              </span>
            </span>
          </div>
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl p-6 flex flex-col transition-all ${
                tier.highlight ? 'scale-[1.02] md:scale-105' : ''
              }`}
              style={{
                background: tier.highlight
                  ? 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.04))'
                  : 'rgba(255,255,255,0.02)',
                border: tier.highlight
                  ? '1px solid rgba(245,158,11,0.3)'
                  : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {tier.badge && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    background: 'var(--flyeas-gradient, linear-gradient(135deg, #E8A317, #EF4444))',
                    color: 'white',
                  }}
                >
                  {tier.badge}
                </div>
              )}

              <h3 className="text-lg font-semibold text-white">{tier.name}</h3>
              <p className="text-xs text-white/40 mt-1 mb-4">{tier.desc}</p>

              {/* Price */}
              <div className="mb-6">
                {tier.price === 0 ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">$0</span>
                    <span className="text-sm text-white/40">forever</span>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">
                      ${annual ? Math.round(tier.annual / 12) : tier.price}
                    </span>
                    <span className="text-sm text-white/40">/month</span>
                  </div>
                )}
                {tier.price > 0 && annual && (
                  <p className="text-xs text-white/30 mt-1">
                    ${tier.annual}/year · billed annually
                  </p>
                )}
              </div>

              {/* CTA */}
              <Link
                href={tier.ctaHref}
                className={`block text-center rounded-xl px-5 py-3 text-sm font-semibold transition-all mb-6 ${
                  tier.highlight
                    ? 'text-white'
                    : 'text-white/80 hover:text-white'
                }`}
                style={{
                  background: tier.highlight
                    ? 'var(--flyeas-gradient, linear-gradient(135deg, #E8A317, #F97316, #EF4444))'
                    : 'rgba(255,255,255,0.05)',
                  border: tier.highlight ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  boxShadow: tier.highlight ? '0 6px 20px rgba(245,158,11,0.25)' : 'none',
                }}
              >
                {tier.cta}
              </Link>

              {/* Features */}
              <div className="flex-1 space-y-2.5">
                {tier.features.map((f) => (
                  <div key={f} className="flex items-start gap-2">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="2"
                      strokeLinecap="round"
                      className="mt-0.5 flex-shrink-0"
                    >
                      <path d="M3 8.5l3.5 3.5L13 5" />
                    </svg>
                    <span className="text-sm text-white/70">{f}</span>
                  </div>
                ))}
              </div>

              {/* Limits */}
              {tier.limits && tier.limits.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                  {tier.limits.map((l) => (
                    <div key={l} className="flex items-start gap-2">
                      <span className="text-white/20 text-xs mt-0.5">—</span>
                      <span className="text-xs text-white/35">{l}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom trust section */}
        <div className="mt-14 text-center">
          <p className="text-white/30 text-xs mb-4">Trusted by travelers worldwide</p>
          <div className="flex items-center justify-center gap-8 text-white/20">
            <div className="text-center">
              <p className="text-2xl font-bold text-white/60">230+</p>
              <p className="text-[10px] uppercase tracking-wider">Airports</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white/60">400+</p>
              <p className="text-[10px] uppercase tracking-wider">Airlines</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white/60">24/7</p>
              <p className="text-[10px] uppercase tracking-wider">AI Monitoring</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white/60">$0</p>
              <p className="text-[10px] uppercase tracking-wider">Until you fly</p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h2 className="text-lg font-semibold text-white text-center mb-6">Questions?</h2>
          <div className="space-y-3">
            {[
              { q: 'Is the Free plan really free?', a: 'Yes. No credit card required. You only pay the 5% service fee when you actually book a flight through Flyeas.' },
              { q: 'What does "auto-buy" mean?', a: 'You set a budget and a threshold. When our AI finds a flight below your threshold AND our statistical model confirms it\'s a good deal, we automatically capture the funds and give you a one-click booking link. Your card is never charged more than the actual price.' },
              { q: 'Can I pay with crypto?', a: 'Yes. Elite users can deposit USDC into a non-custodial smart contract on Base. Gas costs ~$0.01 per transaction. You keep your keys and can withdraw anytime.' },
              { q: 'How does the AI predict prices?', a: 'We track prices on every route over time and compute statistical baselines (mean, standard deviation, trend slope, percentile rank). When a price is significantly below the historical average with high confidence, the agent acts.' },
              { q: 'Can I cancel anytime?', a: 'Yes. Cancel your Pro or Elite subscription at any time. No lock-in, no penalties. Active mission holds are released back to your card immediately.' },
            ].map(({ q, a }) => (
              <details key={q} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <summary className="text-sm font-medium text-white cursor-pointer hover:text-amber-300 transition-colors">{q}</summary>
                <p className="text-sm text-white/50 mt-2 leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
