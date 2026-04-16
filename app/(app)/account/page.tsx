'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSubscriptionStore } from '@/lib/store/subscription-store';
import { useIdentity, useIdentityStore } from '@/lib/store/identity-store';
import { User, Mail, Pencil, Check } from 'lucide-react';

const PLANS = [
  { tier: 'free' as const, name: 'Free', price: 0, features: ['5 searches/day', '1 active mission', 'Basic filters'] },
  { tier: 'pro' as const, name: 'Pro', price: 9.99, features: ['Unlimited searches', '10 active missions', 'Price history', 'Priority alerts', 'Auto-buy'] },
  { tier: 'elite' as const, name: 'Elite', price: 19.99, features: ['Everything in Pro', 'Unlimited missions', 'AI concierge', 'Group trips', 'Priority support'] },
];

export default function AccountPage() {
  const { plan, trialActive, appliedCoupon, payments, startTrial, setPlan, applyCoupon, removeCoupon, getTrialDaysLeft } = useSubscriptionStore();
  const [couponInput, setCouponInput] = useState('');
  const [couponMessage, setCouponMessage] = useState<{ success: boolean; text: string } | null>(null);

  const currentPlan = PLANS.find((p) => p.tier === plan) || PLANS[0];
  const trialDays = getTrialDaysLeft();

  function handleApplyCoupon() {
    const result = applyCoupon(couponInput);
    setCouponMessage({ success: result.success, text: result.message });
    if (result.success) setCouponInput('');
    setTimeout(() => setCouponMessage(null), 4000);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8 space-y-8">
      <h1 className="editorial text-h1 text-pen-1">Account</h1>

      {/* ─── Identity block (read-only, edit inline) ─── */}
      <IdentityBlock />

      {/* Current plan */}
      <Card padding="lg" className="glass-premium">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">{currentPlan.name} Plan</h2>
              {trialActive && trialDays > 0 && (
                <Badge variant="highlight" size="sm">Trial · {trialDays} days left</Badge>
              )}
            </div>
            <p className="text-sm text-white/40 mt-1">
              {currentPlan.price === 0 ? 'Free forever' : `$${currentPlan.price}/month`}
            </p>
            {appliedCoupon && (
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="success" size="sm">🎟️ {appliedCoupon.code} — {appliedCoupon.discountPercent}% off</Badge>
                <button onClick={removeCoupon} className="text-[10px] text-white/25 hover:text-red-400 transition">Remove</button>
              </div>
            )}
          </div>
          {plan === 'free' && !trialActive && (
            <Button variant="primary" size="md" onClick={startTrial}>
              Start 7-Day Free Trial
            </Button>
          )}
          {plan !== 'free' && (
            <Link href="/pricing">
              <Button variant="secondary" size="md">Change Plan</Button>
            </Link>
          )}
        </div>
      </Card>

      {/* Plan comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((p) => {
          const isCurrent = p.tier === plan;
          const discount = appliedCoupon ? appliedCoupon.discountPercent : 0;
          const discountedPrice = p.price * (1 - discount / 100);
          return (
            <Card
              key={p.tier}
              padding="md"
              className={isCurrent ? 'ring-2 ring-amber-500/30' : ''}
            >
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-white">{p.name}</h3>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    {discount > 0 && p.price > 0 && (
                      <span className="text-sm text-white/25 line-through">${p.price}</span>
                    )}
                    <span className="text-2xl font-bold text-white">
                      ${discount > 0 && p.price > 0 ? discountedPrice.toFixed(2) : p.price}
                    </span>
                    {p.price > 0 && <span className="text-xs text-white/30">/mo</span>}
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {p.features.map((f) => (
                    <li key={f} className="text-xs text-white/50 flex items-start gap-2">
                      <span className="text-emerald-400 mt-0.5">✓</span> {f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <Badge variant="success" size="sm" className="w-full justify-center">Current Plan</Badge>
                ) : (
                  <Button
                    variant={p.tier === 'pro' ? 'primary' : 'secondary'}
                    size="sm"
                    fullWidth
                    onClick={() => setPlan(p.tier)}
                  >
                    {p.price > currentPlan.price ? 'Upgrade' : p.price === 0 ? 'Downgrade' : 'Switch'}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Coupon code */}
      <Card padding="md">
        <h3 className="text-sm font-semibold text-white mb-3">🎟️ Promo Code</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value)}
            placeholder="Enter code..."
            className="glass-input flex-1 rounded-xl text-sm font-mono uppercase"
          />
          <Button variant="secondary" size="md" onClick={handleApplyCoupon}>Apply</Button>
        </div>
        {couponMessage && (
          <p className={`text-xs mt-2 ${couponMessage.success ? 'text-emerald-400' : 'text-red-400'}`}>
            {couponMessage.text}
          </p>
        )}
      </Card>

      {/* Payment history */}
      <Card padding="md">
        <h3 className="text-sm font-semibold text-white mb-3">💳 Payment History</h3>
        {payments.length === 0 ? (
          <p className="text-xs text-white/30 text-center py-6">No payments yet</p>
        ) : (
          <div className="space-y-2">
            {[...payments].reverse().map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div>
                  <p className="text-xs font-medium text-white">{p.plan} Plan</p>
                  <p className="text-[10px] text-white/25">
                    {new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">${p.amount}</span>
                  <Badge variant={p.status === 'succeeded' ? 'success' : 'warning'} size="sm">{p.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ── IdentityBlock — read-only with inline edit ── */

function IdentityBlock() {
  const { firstName, lastName, email, initials, isKnown } = useIdentity();
  const updateIdentity = useIdentityStore((s) => s.update);
  const [editing, setEditing] = useState(false);
  const [editFirst, setEditFirst] = useState('');
  const [editLast, setEditLast] = useState('');

  function startEdit() {
    setEditFirst(firstName);
    setEditLast(lastName);
    setEditing(true);
  }

  function saveEdit() {
    const patch: Record<string, string> = {};
    if (editFirst.trim() !== firstName) patch.firstName = editFirst.trim();
    if (editLast.trim() !== lastName) patch.lastName = editLast.trim();
    if (Object.keys(patch).length > 0) {
      updateIdentity(patch);
    }
    setEditing(false);
  }

  return (
    <div className="rounded-lg border border-line-1 bg-ink-800 p-6">
      <div className="flex items-center justify-between mb-5">
        <p className="text-micro uppercase text-pen-3">Your identity</p>
        {!editing && (
          <button
            onClick={startEdit}
            className="inline-flex items-center gap-1.5 text-caption text-pen-2 hover:text-pen-1 transition"
          >
            <Pencil className="w-3 h-3" strokeWidth={1.8} />
            Edit
          </button>
        )}
        {editing && (
          <button
            onClick={saveEdit}
            className="inline-flex items-center gap-1.5 text-caption text-accent hover:text-pen-1 transition"
          >
            <Check className="w-3 h-3" strokeWidth={2} />
            Save
          </button>
        )}
      </div>

      {!editing ? (
        <div className="flex items-center gap-4">
          <div
            className="flex items-center justify-center w-12 h-12 rounded-lg text-body font-semibold text-accent"
            style={{ background: 'var(--accent-soft)' }}
          >
            {initials}
          </div>
          <div>
            <p className="text-body-lg text-pen-1 font-medium">
              {isKnown ? `${firstName}${lastName ? ` ${lastName}` : ''}` : 'Not set'}
            </p>
            {email && <p className="text-caption text-pen-3 mt-0.5">{email}</p>}
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-micro uppercase text-pen-3 block mb-1">First name</span>
            <input
              className="glass-input"
              value={editFirst}
              onChange={(e) => setEditFirst(e.target.value)}
              autoFocus
            />
          </label>
          <label className="block">
            <span className="text-micro uppercase text-pen-3 block mb-1">Last name</span>
            <input
              className="glass-input"
              value={editLast}
              onChange={(e) => setEditLast(e.target.value)}
            />
          </label>
          {email && (
            <div className="sm:col-span-2">
              <span className="text-micro uppercase text-pen-3 block mb-1">Email</span>
              <p className="text-body text-pen-2">{email}</p>
              <p className="text-caption text-pen-3 mt-1">Managed through authentication</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
