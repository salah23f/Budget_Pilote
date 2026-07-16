'use client';

/**
 * Mission payment page — the moment where real money actually moves.
 *
 * Stripe rail:
 *   - Lazy-load Stripe.js + Elements on first mount
 *   - Collect card via PaymentElement
 *   - Confirm with stripe.confirmPayment() — Stripe authorizes the
 *     full budget but does not capture yet (manual capture flow)
 *   - On success, redirect to the cockpit — the webhook will flip
 *     the mission state from 'awaiting_payment' → 'monitoring'
 *
 * Wallet rail (HIDDEN — product decision, Stripe only for this version):
 *   The full wallet flow is kept below behind WALLET_RAIL_ENABLED so it
 *   can be reactivated later. While the flag is false, WalletPaySection
 *   is never rendered, so no Privy hook runs (PrivyProvider is not
 *   mounted in this build and usePrivy() would crash at runtime).
 *   - Connect via Privy (already wired elsewhere in the app)
 *   - Call USDC.approve(escrow, budget) — one tx
 *   - Call MissionEscrow.deposit(id, budget, autoBuyLimit, expiresAt)
 *   - Report the deposit txHash back to /api/missions/[id]/confirm-deposit
 *     which verifies on-chain state and flips the mission state
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Mission } from '@/lib/types';
import nextDynamic from 'next/dynamic';

// Wallet rail ships in its own chunk — zero cost while the flag is off
const WalletPaySection = nextDynamic(() => import('./wallet-pay-section'), { ssr: false });

// Product decision: Stripe only for this release. Flip to true to bring
// the wallet rail back (requires PrivyProvider to be mounted again).
const WALLET_RAIL_ENABLED: boolean = false;

// Base mainnet chain id (8453). Override via NEXT_PUBLIC_ESCROW_CHAIN_ID.
const DEFAULT_CHAIN_ID = 8453;

type PayData = {
  mission: Mission;
  stripe?: {
    clientSecret: string;
    publishableKey: string | null;
    liveMode: boolean;
  };
  wallet?: {
    chain: string;
    escrowAddress: string;
    usdcAddress: string;
    merchantAddress: string;
    depositArgs: {
      id: string;
      budget: string;
      autoBuyLimit: string;
      expiresAt: string;
    };
    approvalAmount: string;
  };
};

export default function MissionPayPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const missionId = params?.id;

  const [data, setData] = useState<PayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load mission + stored create-time payment payload from session
  useEffect(() => {
    if (!missionId) return;
    try {
      const cached = sessionStorage.getItem(`flyeas:mission:${missionId}:pay`);
      if (cached) {
        setData(JSON.parse(cached));
        setLoading(false);
        return;
      }
    } catch (_) {}

    // Fallback: fetch mission but we won't have the stripe client secret
    fetch(`/api/missions/${missionId}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) {
          setError(json.error || 'Mission not found');
        } else {
          setData({ mission: json.mission });
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load mission');
        setLoading(false);
      });
  }, [missionId]);

  if (loading) {
    return (
      <div className="max-w-xl mx-auto p-4 md:p-6 space-y-4">
        <div className="h-4 w-28 rounded-md flyeas-shimmer" />
        <div className="h-9 w-3/4 rounded-md flyeas-shimmer" />
        <div className="h-40 rounded-lg flyeas-shimmer" />
        <div className="h-64 rounded-lg flyeas-shimmer" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto p-4 md:p-6">
        <Card>
          <p className="text-body text-danger">{error || 'Mission not found'}</p>
          <div className="mt-4">
            <Link
              href="/missions"
              className="text-caption text-pen-2 hover:text-pen-1 underline underline-offset-4 transition-colors duration-default"
            >
              ← Back to missions
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const mission = data.mission;

  return (
    <div className="max-w-xl mx-auto p-4 md:p-6 space-y-5">
      <header>
        <Link
          href={`/missions/${mission.id}/cockpit`}
          className="text-caption text-pen-3 hover:text-pen-1 transition-colors duration-default"
        >
          ← Back to cockpit
        </Link>
        <p className="text-micro uppercase tracking-wider text-pen-3 mt-4">
          Secure your mission
        </p>
        <h1 className="editorial text-h1 text-pen-1 mt-1">
          {mission.destinationCity || mission.destination}
          <span className="font-sans text-body-lg text-pen-3 ml-2.5">
            from {mission.originCity || mission.origin}
          </span>
        </h1>
        <p className="text-caption text-pen-3 mt-1.5">
          {mission.departDate}
          {mission.returnDate ? ` → ${mission.returnDate}` : ''}
        </p>
      </header>

      <Card>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-micro uppercase tracking-wider text-pen-3">
              Refundable hold
            </p>
            <p className="num text-h1 font-semibold text-pen-1 mt-1">
              ${mission.maxBudgetUsd}
            </p>
          </div>
          <div className="text-right">
            <p className="text-micro uppercase tracking-wider text-pen-3">
              Auto-buy under
            </p>
            <p className="num text-h2 font-semibold text-pen-1 mt-1">
              {mission.autoBuyThresholdUsd
                ? `$${mission.autoBuyThresholdUsd}`
                : '—'}
            </p>
          </div>
        </div>
        <div className="h-px bg-line-1 my-4" />
        <p className="text-body text-pen-2 leading-relaxed">
          A refundable hold of ${mission.maxBudgetUsd} secures your mission.
          You&apos;re only charged if we book — any unused amount is released
          back to your card automatically.
        </p>
      </Card>

      {/* Wallet rail hidden for this release — Stripe only. */}
      {WALLET_RAIL_ENABLED && mission.paymentRail === 'wallet' ? (
        <WalletPaySection
          missionId={mission.id}
          wallet={data.wallet}
          onDepositConfirmed={() => router.push(`/missions/${mission.id}/cockpit`)}
        />
      ) : (
        <StripePaySection
          missionId={mission.id}
          clientSecret={data.stripe?.clientSecret}
          publishableKey={data.stripe?.publishableKey}
          liveMode={data.stripe?.liveMode}
          amount={mission.maxBudgetUsd}
        />
      )}
    </div>
  );
}

/* ==================================================================
   Stripe section — Elements + manual-capture confirm
   ================================================================ */

/** Build the Elements appearance from the design-system CSS variables
 *  so the card form matches the current theme (light or .dark). */
function themedStripeAppearance() {
  const styles = getComputedStyle(document.documentElement);
  const cssVar = (name: string) => styles.getPropertyValue(name).trim();
  const isDark = document.documentElement.classList.contains('dark');

  const variables: Record<string, string> = {
    borderRadius: '12px',
    fontFamily: 'system-ui, sans-serif',
  };
  const tokenMap: Record<string, string> = {
    colorPrimary: '--accent',
    colorBackground: '--ink-800',
    colorText: '--pen-1',
    colorTextSecondary: '--pen-2',
    colorTextPlaceholder: '--pen-3',
    colorDanger: '--danger',
  };
  for (const [key, token] of Object.entries(tokenMap)) {
    const value = cssVar(token);
    if (value) variables[key] = value;
  }

  return {
    theme: isDark ? ('night' as const) : ('stripe' as const),
    variables,
  };
}

function StripePaySection({
  missionId,
  clientSecret,
  publishableKey,
  liveMode,
  amount,
}: {
  missionId: string;
  clientSecret?: string;
  publishableKey?: string | null;
  liveMode?: boolean;
  amount: number;
}) {
  const [stripePromise, setStripePromise] = useState<any>(null);
  const [Elements, setElementsComp] = useState<any>(null);
  const [PaymentElement, setPEComp] = useState<any>(null);
  const [appearance, setAppearance] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Lazy-load Stripe.js + react-stripe-js on the client only
  useEffect(() => {
    if (!publishableKey) {
      setLoadError(
        'Stripe publishable key missing. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.'
      );
      return;
    }
    setAppearance(themedStripeAppearance());
    (async () => {
      try {
        const [{ loadStripe }, rsj] = await Promise.all([
          import('@stripe/stripe-js'),
          import('@stripe/react-stripe-js'),
        ]);
        setStripePromise(loadStripe(publishableKey));
        setElementsComp(() => rsj.Elements);
        setPEComp(() => rsj.PaymentElement);
      } catch (err: any) {
        setLoadError(
          `Failed to load Stripe.js. Run npm install @stripe/stripe-js @stripe/react-stripe-js. (${err?.message || 'unknown'})`
        );
      }
    })();
  }, [publishableKey]);

  if (loadError) {
    return (
      <Card>
        <p className="text-body text-danger">{loadError}</p>
      </Card>
    );
  }

  if (!clientSecret) {
    return (
      <Card>
        <div className="rounded-md bg-warning-soft p-3">
          <p className="text-body text-warning">
            No active hold found for this mission. The secure payment form is
            only available right after a mission is created — please go back
            and create the mission again.
          </p>
        </div>
      </Card>
    );
  }

  if (!Elements || !PaymentElement || !stripePromise) {
    return (
      <Card>
        <div className="h-32 rounded-md flyeas-shimmer" />
      </Card>
    );
  }

  return (
    <Card>
      {liveMode === false && (
        <div className="mb-4 rounded-md bg-warning-soft px-3 py-2 text-caption text-warning">
          Stripe test mode — use card 4242 4242 4242 4242.
        </div>
      )}
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          appearance: appearance || undefined,
        }}
      >
        <StripeConfirmForm
          clientSecret={clientSecret}
          amount={amount}
          missionId={missionId}
          PaymentElement={PaymentElement}
        />
      </Elements>
    </Card>
  );
}

function StripeConfirmForm({
  clientSecret,
  amount,
  missionId,
  PaymentElement,
}: {
  clientSecret: string;
  amount: number;
  missionId: string;
  PaymentElement: any;
}) {
  const [useStripeHook, setUseStripeHook] = useState<any>(null);
  const [useElementsHook, setUseElementsHook] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const mod = await import('@stripe/react-stripe-js');
      setUseStripeHook(() => mod.useStripe);
      setUseElementsHook(() => mod.useElements);
    })();
  }, []);

  if (!useStripeHook || !useElementsHook) {
    return <div className="h-32 rounded-md flyeas-shimmer" />;
  }

  return (
    <StripeConfirmInner
      clientSecret={clientSecret}
      amount={amount}
      missionId={missionId}
      PaymentElement={PaymentElement}
      useStripe={useStripeHook}
      useElements={useElementsHook}
    />
  );
}

function StripeConfirmInner({
  clientSecret,
  amount,
  missionId,
  PaymentElement,
  useStripe,
  useElements,
}: {
  clientSecret: string;
  amount: number;
  missionId: string;
  PaymentElement: any;
  useStripe: () => any;
  useElements: () => any;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message || 'Form error');
      setSubmitting(false);
      return;
    }

    const result = await stripe.confirmPayment({
      elements,
      clientSecret,
      redirect: 'if_required',
      confirmParams: {
        return_url: `${window.location.origin}/missions/${missionId}/cockpit`,
      },
    });

    if (result.error) {
      setError(result.error.message || 'Payment failed');
      setSubmitting(false);
      return;
    }

    // Authorization succeeded. Stripe webhook will flip mission status.
    window.location.href = `/missions/${missionId}/cockpit`;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <p className="text-body text-danger bg-danger-soft rounded-md p-3">
          {error}
        </p>
      )}
      <Button type="submit" disabled={!stripe || submitting} className="w-full">
        {submitting
          ? 'Placing your hold…'
          : `Place refundable $${amount} hold`}
      </Button>
      <div className="secure-badge w-full justify-center text-center">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span>
          Secured by Stripe. Your card is authorized, not charged — the hold is
          released within 7 days if we don&apos;t book.
        </span>
      </div>
    </form>
  );
}
