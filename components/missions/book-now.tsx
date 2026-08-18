'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Book a fare without leaving the screen it is shown on.
 *
 * A mission costs nothing to start, so there is no authorised budget to
 * capture here. The traveller sees a real fare, presses once, and pays
 * exactly that fare — Stripe mounts inline, right under the offer.
 *
 * Sequence:
 *   1. POST /book        → payment intent for this proposal only
 *   2. confirmPayment()  → card, Apple Pay or Google Pay, in place
 *   3. POST /confirm     → server re-verifies the payment, marks booked
 *
 * Step 3 matters: the server never trusts the browser's word that the
 * payment happened. It re-reads the intent from Stripe and checks the
 * amount, the mission and the proposal before releasing the booking.
 */

/** Mirror the design-system tokens into Stripe Elements. */
function themedAppearance() {
  const styles = getComputedStyle(document.documentElement);
  const cssVar = (n: string) => styles.getPropertyValue(n).trim();
  const isDark = document.documentElement.classList.contains('dark');
  const variables: Record<string, string> = {
    borderRadius: '12px',
    fontFamily: 'system-ui, sans-serif',
  };
  const map: Record<string, string> = {
    colorPrimary: '--accent',
    colorBackground: '--ink-800',
    colorText: '--pen-1',
    colorTextSecondary: '--pen-2',
    colorTextPlaceholder: '--pen-3',
    colorDanger: '--danger',
  };
  for (const [k, token] of Object.entries(map)) {
    const v = cssVar(token);
    if (v) variables[k] = v;
  }
  return { theme: isDark ? ('night' as const) : ('stripe' as const), variables };
}

export function BookNow({
  missionId,
  proposalId,
  amountUsd,
  onBooked,
  t,
}: {
  missionId: string;
  proposalId: string;
  amountUsd: number;
  onBooked: () => void;
  t: (k: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [stripePromise, setStripePromise] = useState<any>(null);
  const [Elements, setElements] = useState<any>(null);
  const [appearance, setAppearance] = useState<any>(null);

  // Stripe.js is heavy and most visitors never reach a proposal, so it is
  // only fetched once the traveller actually asks to book.
  const start = useCallback(async () => {
    setError(null);
    setLoading(true);
    setOpen(true);
    try {
      const res = await fetch(`/api/missions/${missionId}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || t('proposal.book.error'));
        return;
      }
      setClientSecret(json.clientSecret);
      setAppearance(themedAppearance());

      const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (!key) {
        setError('Payments are not configured.');
        return;
      }
      const [{ loadStripe }, rsj] = await Promise.all([
        import('@stripe/stripe-js'),
        import('@stripe/react-stripe-js'),
      ]);
      setStripePromise(loadStripe(key));
      setElements(() => rsj.Elements);
    } catch (err: any) {
      setError(err?.message || t('proposal.book.error'));
    } finally {
      setLoading(false);
    }
  }, [missionId, proposalId, t]);

  if (!open) {
    return (
      <div className="mt-4">
        <button
          type="button"
          onClick={start}
          className="premium-button w-full rounded-md px-5 py-3 text-body font-semibold"
        >
          {t('proposal.book.cta')} · ${amountUsd}
        </button>
        <p className="mt-2 text-caption text-pen-3 text-center">
          {t('proposal.book.sub')}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-line-2 bg-ink-900 p-4">
      {error && (
        <p className="mb-3 rounded-md bg-danger-soft px-3 py-2 text-caption text-danger">
          {error}
        </p>
      )}

      {loading && !clientSecret && (
        <div className="flyeas-shimmer h-24 rounded-md" aria-label="Loading payment" />
      )}

      {clientSecret && Elements && stripePromise && (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
          <PayForm
            missionId={missionId}
            proposalId={proposalId}
            amountUsd={amountUsd}
            onBooked={onBooked}
            onError={setError}
            t={t}
          />
        </Elements>
      )}
    </div>
  );
}

function PayForm({
  missionId,
  proposalId,
  amountUsd,
  onBooked,
  onError,
  t,
}: {
  missionId: string;
  proposalId: string;
  amountUsd: number;
  onBooked: () => void;
  onError: (m: string) => void;
  t: (k: string) => string;
}) {
  const [hooks, setHooks] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    import('@stripe/react-stripe-js').then((m) => {
      if (alive) setHooks(m);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!hooks) {
    return <div className="flyeas-shimmer h-24 rounded-md" />;
  }

  return (
    <InnerForm
      hooks={hooks}
      missionId={missionId}
      proposalId={proposalId}
      amountUsd={amountUsd}
      onBooked={onBooked}
      onError={onError}
      t={t}
      busy={busy}
      setBusy={setBusy}
    />
  );
}

function InnerForm({
  hooks,
  missionId,
  proposalId,
  amountUsd,
  onBooked,
  onError,
  t,
  busy,
  setBusy,
}: any) {
  const { PaymentElement, useStripe, useElements } = hooks;
  const stripe = useStripe();
  const elements = useElements();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    onError('');
    try {
      const { error: submitErr } = await elements.submit();
      if (submitErr) {
        onError(submitErr.message || t('proposal.book.error'));
        return;
      }

      // Stay on this screen — no redirect unless the bank demands one.
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });
      if (error) {
        onError(error.message || t('proposal.book.error'));
        return;
      }
      if (paymentIntent?.status !== 'succeeded') {
        onError(t('proposal.book.error'));
        return;
      }

      // The server re-checks this payment against Stripe before booking.
      const res = await fetch(`/api/missions/${missionId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId, paymentIntentId: paymentIntent.id }),
      });
      const json = await res.json();
      if (!json.success) {
        onError(json.error || t('proposal.book.error'));
        return;
      }
      onBooked();
    } catch (err: any) {
      onError(err?.message || t('proposal.book.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <PaymentElement options={{ layout: 'tabs' }} />
      <button
        type="submit"
        disabled={busy || !stripe}
        className="premium-button mt-4 w-full rounded-md px-5 py-3 text-body font-semibold disabled:opacity-50"
      >
        {busy ? t('proposal.book.paying') : `${t('proposal.book.cta')} · $${amountUsd}`}
      </button>
      <p className="mt-2 text-caption text-pen-3 text-center">
        {t('proposal.book.sub')}
      </p>
    </form>
  );
}
