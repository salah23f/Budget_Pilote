'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

/* ------------------------------------------------------------------ */
/*  Insurance plans with real coverage details                          */
/* ------------------------------------------------------------------ */

const PLANS = [
  {
    name: 'Basic',
    priceBase: 29,
    pricePerDay: 3.5,
    color: '#64748B',
    icon: '🛡️',
    provider: 'VisitorsCoverage',
    features: [
      { text: 'Trip cancellation up to $5,000', included: true },
      { text: 'Emergency medical $50,000', included: true },
      { text: 'Baggage loss $1,000', included: true },
      { text: '24/7 assistance hotline', included: true },
      { text: 'Trip delay coverage', included: false },
      { text: 'Rental car coverage', included: false },
      { text: 'Cancel for any reason', included: false },
      { text: 'Adventure sports', included: false },
    ],
  },
  {
    name: 'Standard',
    priceBase: 49,
    pricePerDay: 5.5,
    color: '#F59E0B',
    icon: '🛡️✨',
    popular: true,
    provider: 'VisitorsCoverage',
    features: [
      { text: 'Trip cancellation up to $10,000', included: true },
      { text: 'Emergency medical $100,000', included: true },
      { text: 'Baggage loss $2,500', included: true },
      { text: 'Trip delay $500/day', included: true },
      { text: 'Rental car collision coverage', included: true },
      { text: '24/7 assistance hotline', included: true },
      { text: 'Cancel for any reason', included: false },
      { text: 'Pre-existing conditions', included: false },
    ],
  },
  {
    name: 'Premium',
    priceBase: 79,
    pricePerDay: 8,
    color: '#8B5CF6',
    icon: '🛡️👑',
    provider: 'VisitorsCoverage',
    features: [
      { text: 'Trip cancellation up to $25,000', included: true },
      { text: 'Emergency medical $250,000', included: true },
      { text: 'Medical evacuation $500,000', included: true },
      { text: 'Baggage loss $5,000', included: true },
      { text: 'Trip delay $1,000/day', included: true },
      { text: 'Rental car collision coverage', included: true },
      { text: 'Cancel for any reason (75% refund)', included: true },
      { text: 'Adventure sports coverage', included: true },
      { text: 'Pre-existing conditions', included: true },
      { text: '24/7 concierge service', included: true },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Affiliate link builder                                              */
/* ------------------------------------------------------------------ */

function buildAffiliateLink(plan: typeof PLANS[0], params: {
  destination: string;
  departDate: string;
  returnDate: string;
  travelers: number;
  age: number;
}): string {
  const base = 'https://www.visitorscoverage.com';
  const query = new URLSearchParams({
    destination: params.destination || '',
    start_date: params.departDate || '',
    end_date: params.returnDate || '',
    travelers: String(params.travelers || 1),
    age: String(params.age || 30),
    plan_type: plan.name.toLowerCase(),
    utm_source: 'flyeas',
    utm_medium: 'referral',
    utm_campaign: 'travel_insurance',
  });
  return `${base}/travel-insurance?${query.toString()}`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export default function InsurancePage() {
  const [destination, setDestination] = useState('');
  const [departDate, setDepartDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [travelers, setTravelers] = useState(1);
  const [age, setAge] = useState(30);
  const [configured, setConfigured] = useState(false);

  const days = useMemo(() => {
    if (!departDate || !returnDate) return 7;
    return Math.max(1, Math.ceil((new Date(returnDate).getTime() - new Date(departDate).getTime()) / 86400000));
  }, [departDate, returnDate]);

  function handleConfigure(e: React.FormEvent) {
    e.preventDefault();
    if (destination && departDate && returnDate) setConfigured(true);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
          <span>🛡️</span> Travel Insurance
        </h1>
        <p className="text-sm text-white/40 mt-1">Protect your trip — coverage from VisitorsCoverage</p>
      </div>

      {/* Trip details form */}
      <Card padding="lg">
        <form onSubmit={handleConfigure}>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-end">
            <Input label="Destination" placeholder="Country..." value={destination} onChange={(e) => setDestination(e.target.value)} />
            <Input label="Departure" type="date" value={departDate} onChange={(e) => setDepartDate(e.target.value)} />
            <Input label="Return" type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
            <Input label="Travelers" type="number" min={1} max={10} value={travelers} onChange={(e) => setTravelers(Number(e.target.value))} />
            <Button type="submit" variant="primary" size="lg" fullWidth>Get Quotes</Button>
          </div>
        </form>
      </Card>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const totalPrice = Math.round((plan.priceBase + plan.pricePerDay * days) * travelers);
          const perPerson = Math.round(plan.priceBase + plan.pricePerDay * days);
          const link = buildAffiliateLink(plan, { destination, departDate, returnDate, travelers, age });

          return (
            <Card
              key={plan.name}
              hoverable
              padding="none"
              className={`overflow-hidden card-interactive ${plan.popular ? 'ring-2 ring-amber-500/30' : ''}`}
            >
              {plan.popular && (
                <div className="text-center py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: 'var(--flyeas-gradient)', color: 'white' }}>
                  Recommended
                </div>
              )}
              <div className="p-6 space-y-5">
                {/* Plan header */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{plan.icon}</span>
                    <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-3">
                    <span className="text-3xl font-bold" style={{ color: plan.color }}>
                      ${configured ? totalPrice : plan.priceBase}
                    </span>
                    <span className="text-xs text-white/30">
                      {configured ? `total · ${days} days` : 'from / trip'}
                    </span>
                  </div>
                  {configured && travelers > 1 && (
                    <p className="text-[10px] text-white/25 mt-1">${perPerson} per person</p>
                  )}
                </div>

                {/* Features */}
                <div className="space-y-2">
                  {plan.features.map((f) => (
                    <div key={f.text} className="flex items-start gap-2 text-xs">
                      <span className={`mt-0.5 ${f.included ? 'text-emerald-400' : 'text-white/15'}`}>
                        {f.included ? '✓' : '✕'}
                      </span>
                      <span className={f.included ? 'text-white/60' : 'text-white/20'}>{f.text}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <a href={link} target="_blank" rel="noopener noreferrer" className="block">
                  <Button
                    variant={plan.popular ? 'primary' : 'secondary'}
                    size="md"
                    fullWidth
                  >
                    {configured ? `Get ${plan.name} — $${totalPrice}` : `Get ${plan.name} Quote`}
                  </Button>
                </a>

                {/* Provider */}
                <p className="text-[9px] text-white/20 text-center">
                  via {plan.provider}
                </p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Trust signals */}
      <Card padding="md">
        <div className="flex flex-wrap justify-center gap-6 text-center">
          <div>
            <p className="text-lg font-bold text-white">A+ Rated</p>
            <p className="text-[10px] text-white/30">BBB Accredited</p>
          </div>
          <div>
            <p className="text-lg font-bold text-white">4.7★</p>
            <p className="text-[10px] text-white/30">Trustpilot Rating</p>
          </div>
          <div>
            <p className="text-lg font-bold text-white">1M+</p>
            <p className="text-[10px] text-white/30">Travelers Protected</p>
          </div>
          <div>
            <p className="text-lg font-bold text-white">24/7</p>
            <p className="text-[10px] text-white/30">Global Assistance</p>
          </div>
        </div>
      </Card>

      <p className="text-[10px] text-white/15 text-center">
        Insurance provided by VisitorsCoverage and partner underwriters. Prices are estimates — final pricing determined on provider&apos;s site. Flyeas earns a referral commission at no extra cost to you.
      </p>
    </div>
  );
}
