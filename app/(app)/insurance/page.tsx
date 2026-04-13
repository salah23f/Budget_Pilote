'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

const PLANS = [
  {
    name: 'Basic',
    price: 29,
    color: '#64748B',
    features: ['Trip cancellation up to $5,000', 'Emergency medical $50,000', 'Baggage loss $1,000', '24/7 assistance hotline'],
    excluded: ['Pre-existing conditions', 'Adventure sports', 'Cancel for any reason'],
  },
  {
    name: 'Standard',
    price: 59,
    color: '#F59E0B',
    popular: true,
    features: ['Trip cancellation up to $10,000', 'Emergency medical $100,000', 'Baggage loss $2,500', 'Trip delay $500', 'Rental car coverage', '24/7 assistance hotline'],
    excluded: ['Cancel for any reason'],
  },
  {
    name: 'Premium',
    price: 99,
    color: '#8B5CF6',
    features: ['Trip cancellation up to $25,000', 'Emergency medical $250,000', 'Baggage loss $5,000', 'Trip delay $1,000', 'Rental car coverage', 'Cancel for any reason', 'Adventure sports coverage', 'Pre-existing conditions', '24/7 concierge service'],
    excluded: [],
  },
];

export default function InsurancePage() {
  const [destination, setDestination] = useState('');
  const [dates, setDates] = useState('');
  const [travelers, setTravelers] = useState(1);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
          <span>🛡️</span> Travel Insurance
        </h1>
        <p className="text-sm text-white/40 mt-1">Protect your trip with comprehensive coverage</p>
      </div>

      <Card padding="lg">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <Input label="Destination" placeholder="Country or region..." value={destination} onChange={(e) => setDestination(e.target.value)} />
          <Input label="Travel Dates" type="date" value={dates} onChange={(e) => setDates(e.target.value)} />
          <Input label="Travelers" type="number" min={1} max={10} value={travelers} onChange={(e) => setTravelers(Number(e.target.value))} />
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => (
          <Card key={plan.name} hoverable padding="none" className={`overflow-hidden card-interactive ${plan.popular ? 'ring-2 ring-amber-500/30' : ''}`}>
            {plan.popular && (
              <div className="text-center py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: 'var(--flyeas-gradient)', color: 'white' }}>
                Most Popular
              </div>
            )}
            <div className="p-6 space-y-5">
              <div>
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-bold" style={{ color: plan.color }}>${plan.price * travelers}</span>
                  <span className="text-xs text-white/30">from / trip</span>
                </div>
                {travelers > 1 && <p className="text-[10px] text-white/25 mt-1">${plan.price} per person</p>}
              </div>

              <div className="space-y-2">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-xs">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span className="text-white/60">{f}</span>
                  </div>
                ))}
                {plan.excluded.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-xs">
                    <span className="text-red-400/50 mt-0.5">✕</span>
                    <span className="text-white/25">{f}</span>
                  </div>
                ))}
              </div>

              <a
                href="https://www.visitorscoverage.com"
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button variant={plan.popular ? 'primary' : 'secondary'} size="md" fullWidth>
                  Get {plan.name}
                </Button>
              </a>
            </div>
          </Card>
        ))}
      </div>

      <p className="text-[10px] text-white/20 text-center">
        Insurance provided by VisitorsCoverage. Prices are indicative — final pricing on provider&apos;s site. Flyeas earns a commission at no extra cost to you.
      </p>
    </div>
  );
}
