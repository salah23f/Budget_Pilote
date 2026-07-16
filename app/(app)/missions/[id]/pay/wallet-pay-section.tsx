'use client';

import { useState, useCallback } from 'react';
import { encodeFunctionData } from 'viem';
import { usePrivy, useSendTransaction, useWallets } from '@privy-io/react-auth';
import type { Mission } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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

/* ==================================================================
   Wallet section — USDC approve + escrow deposit via Privy
   NOT RENDERED in this release (WALLET_RAIL_ENABLED = false).
   Kept intact so the rail can be reactivated. All Privy hooks live
   inside this component, so they never run while it is unmounted.
   ================================================================ */

export default function WalletPaySection({
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
      setMsg('Step 1/2 · Approving the deposit');
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
      setMsg('Step 2/2 · Depositing your budget into escrow');
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
      setMsg('Verifying your deposit…');
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
      setMsg('Funds secured. The agent is now watching.');
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
        <p className="text-body text-warning">
          Wallet deposit details are missing for this mission.
        </p>
      </Card>
    );
  }

  if (!ready) {
    return (
      <Card>
        <div className="h-16 rounded-md flyeas-shimmer" />
      </Card>
    );
  }

  if (!authenticated || !activeWallet) {
    return (
      <Card>
        <p className="text-body text-pen-2 mb-4">
          Connect a wallet that holds at least ${wallet.approvalAmount ? (Number(wallet.approvalAmount) / 1e6).toFixed(0) : '?'} on {wallet.chain}.
        </p>
        <Button onClick={() => login()} className="w-full">
          Connect wallet
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-2 mb-4 text-body">
        <div className="flex justify-between">
          <span className="text-pen-2">Chain</span>
          <span className="text-pen-1 capitalize">{wallet.chain}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-pen-2">Deposit contract</span>
          <code className="num text-caption text-pen-2">
            {wallet.usdcAddress.slice(0, 6)}…{wallet.usdcAddress.slice(-4)}
          </code>
        </div>
        <div className="flex justify-between">
          <span className="text-pen-2">Escrow contract</span>
          <code className="num text-caption text-pen-2">
            {wallet.escrowAddress.slice(0, 6)}…{wallet.escrowAddress.slice(-4)}
          </code>
        </div>
        <div className="flex justify-between">
          <span className="text-pen-2">Your wallet</span>
          <code className="num text-caption text-pen-2">
            {activeWallet.address.slice(0, 6)}…{activeWallet.address.slice(-4)}
          </code>
        </div>
      </div>

      {msg && (
        <div className="mb-3 rounded-md bg-accent-soft px-3 py-2 text-caption text-accent">
          {msg}
        </div>
      )}
      {err && (
        <div className="mb-3 rounded-md bg-danger-soft px-3 py-2 text-caption text-danger">
          {err}
        </div>
      )}

      <Button
        onClick={runDepositFlow}
        disabled={phase !== 'idle' && phase !== 'error'}
        className="w-full"
      >
        {phase === 'idle' || phase === 'error'
          ? 'Approve and deposit'
          : phase === 'approving'
          ? 'Approving…'
          : phase === 'depositing'
          ? 'Depositing…'
          : phase === 'verifying'
          ? 'Verifying…'
          : 'Done'}
      </Button>

      <p className="text-caption text-pen-3 text-center mt-3">
        Two on-chain transactions. Network fees apply on {wallet.chain}.
      </p>
    </Card>
  );
}
