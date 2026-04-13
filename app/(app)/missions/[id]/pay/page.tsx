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
 * Wallet rail:
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
import { encodeFunctionData } from 'viem';
import { usePrivy, useSendTransaction, useWallets } from '@privy-io/react-auth';
import type { Mission } from '@/lib/types';

// Minimal ABI fragments for the two calls we need
const USDC_APPROVE_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const ESCROW_DEPOSIT_ABI = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'id', type: 'bytes32' },
      { name: 'budget', type: 'uint256' },
      { name: 'autoBuyLimit', type: 'uint256' },
      { name: 'expiresAt', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

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
    } catch {}

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
      <div className="max-w-xl mx-auto p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-3/4 bg-white/5 rounded" />
          <div className="h-48 bg-white/5 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <Card>
          <p className="text-red-300">{error || 'Mission not found'}</p>
          <div className="mt-4">
            <Link href="/missions" className="text-sm text-amber-300 underline">
              ← Back
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
          className="text-xs text-white/40 hover:text-white"
        >
          ← Back to cockpit
        </Link>
        <h1 className="text-2xl font-semibold text-white mt-2">
          Fund your mission
        </h1>
        <p className="text-sm text-white/50 mt-1">
          {mission.originCity || mission.origin} →{' '}
          {mission.destinationCity || mission.destination} ·{' '}
          {mission.departDate}
        </p>
      </header>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/40">
              Mission budget
            </p>
            <p className="text-3xl font-semibold text-white mt-1">
              ${mission.maxBudgetUsd}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-white/40">
              Auto-buy under
            </p>
            <p className="text-xl font-semibold text-white mt-1">
              {mission.autoBuyThresholdUsd
                ? `$${mission.autoBuyThresholdUsd}`
                : '—'}
            </p>
          </div>
        </div>
        <p className="text-xs text-white/40 mt-4 pt-4 border-t border-white/5">
          {mission.paymentRail === 'wallet' ? (
            <>
              Your USDC is deposited into the non-custodial{' '}
              <code className="text-amber-300">MissionEscrow</code> contract.
              You keep the private key. Withdraw anytime.
            </>
          ) : (
            <>
              Stripe authorizes the full amount on your card but does not
              charge it. Any unused budget is released back automatically.
            </>
          )}
        </p>
      </Card>

      {mission.paymentRail === 'stripe' ? (
        <StripePaySection
          missionId={mission.id}
          clientSecret={data.stripe?.clientSecret}
          publishableKey={data.stripe?.publishableKey}
          liveMode={data.stripe?.liveMode}
          amount={mission.maxBudgetUsd}
        />
      ) : (
        <WalletPaySection
          missionId={mission.id}
          wallet={data.wallet}
          onDepositConfirmed={() => router.push(`/missions/${mission.id}/cockpit`)}
        />
      )}
    </div>
  );
}

/* ==================================================================
   Stripe section — Elements + manual-capture confirm
   ================================================================ */

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
  const [loadError, setLoadError] = useState<string | null>(null);

  // Lazy-load Stripe.js + react-stripe-js on the client only
  useEffect(() => {
    if (!publishableKey) {
      setLoadError(
        'Stripe publishable key missing. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.'
      );
      return;
    }
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
        <p className="text-red-300 text-sm">{loadError}</p>
      </Card>
    );
  }

  if (!clientSecret) {
    return (
      <Card>
        <p className="text-amber-300 text-sm">
          No active Stripe hold for this mission. Go back and create the
          mission again — the client secret is only returned once at
          creation time.
        </p>
      </Card>
    );
  }

  if (!Elements || !PaymentElement || !stripePromise) {
    return (
      <Card>
        <div className="animate-pulse h-32 bg-white/5 rounded" />
      </Card>
    );
  }

  return (
    <Card>
      {liveMode === false && (
        <div className="mb-3 p-2 rounded bg-amber-500/10 border border-amber-400/30 text-amber-300 text-xs">
          ⚡ Stripe test mode — use 4242 4242 4242 4242
        </div>
      )}
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          appearance: {
            theme: 'night' as const,
            variables: {
              colorPrimary: '#f59e0b',
              colorBackground: '#0c0a09',
              colorText: '#fafaf9',
              borderRadius: '10px',
              fontFamily: 'system-ui, sans-serif',
            },
          },
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
    return <div className="animate-pulse h-32 bg-white/5 rounded" />;
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
        <p className="text-sm text-red-300 bg-red-500/10 border border-red-400/30 p-2 rounded">
          {error}
        </p>
      )}
      <Button type="submit" disabled={!stripe || submitting} className="w-full">
        {submitting ? 'Authorizing…' : `Place $${amount} hold`}
      </Button>
      <p className="text-[11px] text-white/30 text-center">
        Your card is authorized — not charged. Released in 7 days if no flight
        is found.
      </p>
    </form>
  );
}

/* ==================================================================
   Wallet section — USDC approve + escrow deposit via Privy
   ================================================================ */

function WalletPaySection({
  missionId,
  wallet,
  onDepositConfirmed,
}: {
  missionId: string;
  wallet?: PayData['wallet'];
  onDepositConfirmed: () => void;
}) {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();

  const [phase, setPhase] = useState<
    'idle' | 'approving' | 'depositing' | 'verifying' | 'done' | 'error'
  >('idle');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const activeWallet = wallets?.[0];
  const chainId = Number(
    process.env.NEXT_PUBLIC_ESCROW_CHAIN_ID || DEFAULT_CHAIN_ID
  );

  const runDepositFlow = useCallback(async () => {
    if (!wallet) {
      setErr('Wallet rail not configured');
      setPhase('error');
      return;
    }
    try {
      // Step 1 — USDC.approve(escrow, budget)
      setPhase('approving');
      setMsg('Step 1/2 · Approving USDC spend for the escrow');
      const approveData = encodeFunctionData({
        abi: USDC_APPROVE_ABI,
        functionName: 'approve',
        args: [wallet.escrowAddress as `0x${string}`, BigInt(wallet.approvalAmount)],
      });
      await sendTransaction({
        to: wallet.usdcAddress as `0x${string}`,
        data: approveData,
        chainId,
      } as any);

      // Step 2 — MissionEscrow.deposit(id, budget, autoBuyLimit, expiresAt)
      setPhase('depositing');
      setMsg('Step 2/2 · Depositing USDC into MissionEscrow');
      const depositData = encodeFunctionData({
        abi: ESCROW_DEPOSIT_ABI,
        functionName: 'deposit',
        args: [
          wallet.depositArgs.id as `0x${string}`,
          BigInt(wallet.depositArgs.budget),
          BigInt(wallet.depositArgs.autoBuyLimit),
          BigInt(wallet.depositArgs.expiresAt),
        ],
      });
      const depositRes = (await sendTransaction({
        to: wallet.escrowAddress as `0x${string}`,
        data: depositData,
        chainId,
      } as any)) as any;

      const depositTxHash =
        depositRes?.transactionHash || depositRes?.hash || 'unknown';

      // Step 3 — tell the server to verify on-chain state
      setPhase('verifying');
      setMsg('Verifying on-chain deposit…');
      const res = await fetch(`/api/missions/${missionId}/confirm-deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depositTxHash }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Confirm-deposit failed');
      }

      setPhase('done');
      setMsg('Funds escrowed. The agent is now watching.');
      setTimeout(onDepositConfirmed, 1500);
    } catch (error: any) {
      console.error('[wallet-pay]', error);
      setErr(error?.message || 'Wallet flow failed');
      setPhase('error');
    }
  }, [wallet, missionId, sendTransaction, chainId, onDepositConfirmed]);

  if (!wallet) {
    return (
      <Card>
        <p className="text-amber-300 text-sm">
          Wallet deposit payload missing for this mission.
        </p>
      </Card>
    );
  }

  if (!ready) {
    return (
      <Card>
        <div className="animate-pulse h-16 bg-white/5 rounded" />
      </Card>
    );
  }

  if (!authenticated || !activeWallet) {
    return (
      <Card>
        <p className="text-white/70 mb-3">
          Connect a wallet that holds at least ${wallet.approvalAmount ? (Number(wallet.approvalAmount) / 1e6).toFixed(0) : '?'} USDC on {wallet.chain}.
        </p>
        <Button onClick={() => login()} className="w-full">
          Connect wallet
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-2 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="text-white/50">Chain</span>
          <span className="text-white capitalize">{wallet.chain}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/50">USDC contract</span>
          <code className="text-xs text-white/70">
            {wallet.usdcAddress.slice(0, 6)}…{wallet.usdcAddress.slice(-4)}
          </code>
        </div>
        <div className="flex justify-between">
          <span className="text-white/50">Escrow contract</span>
          <code className="text-xs text-white/70">
            {wallet.escrowAddress.slice(0, 6)}…{wallet.escrowAddress.slice(-4)}
          </code>
        </div>
        <div className="flex justify-between">
          <span className="text-white/50">Your wallet</span>
          <code className="text-xs text-white/70">
            {activeWallet.address.slice(0, 6)}…{activeWallet.address.slice(-4)}
          </code>
        </div>
      </div>

      {msg && (
        <div className="mb-3 p-2 rounded bg-sky-500/10 border border-sky-400/30 text-sky-300 text-xs">
          {msg}
        </div>
      )}
      {err && (
        <div className="mb-3 p-2 rounded bg-red-500/10 border border-red-400/30 text-red-300 text-xs">
          {err}
        </div>
      )}

      <Button
        onClick={runDepositFlow}
        disabled={phase !== 'idle' && phase !== 'error'}
        className="w-full"
      >
        {phase === 'idle' || phase === 'error'
          ? 'Approve + Deposit USDC'
          : phase === 'approving'
          ? 'Approving…'
          : phase === 'depositing'
          ? 'Depositing…'
          : phase === 'verifying'
          ? 'Verifying…'
          : 'Done'}
      </Button>

      <p className="text-[11px] text-white/30 text-center mt-3">
        Two on-chain transactions. Gas is paid in ETH on {wallet.chain}.
      </p>
    </Card>
  );
}
