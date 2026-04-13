'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWallet } from '@/components/wallet-provider';
import ConnectWalletButton from '@/components/connect-wallet-button';

function WalletContent() {
  const { walletAddress } = useWallet();
  const searchParams = useSearchParams();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(0);

  // Check for success/cancel from Stripe redirect
  const success = searchParams.get('success');
  const depositAmount = searchParams.get('amount');

  useEffect(() => {
    if (success === 'true' && depositAmount) {
      setBalance((prev) => prev + Number(depositAmount));
      // Save to localStorage
      const newBalance = balance + Number(depositAmount);
      localStorage.setItem('sv_balance', String(newBalance));
    }
  }, [success, depositAmount]);

  // Load saved balance
  useEffect(() => {
    const saved = localStorage.getItem('sv_balance');
    if (saved) setBalance(Number(saved));
  }, []);

  async function handleDeposit() {
    const num = Number(amount);
    if (!num || num < 1) return;
    setLoading(true);

    try {
      const res = await fetch('/api/payments/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: num }),
      });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Payment failed');
      }
    } catch {
      alert('Network error');
    } finally {
      setLoading(false);
    }
  }

  const presetAmounts = [25, 50, 100, 250];

  return (
    <div className="py-2">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold mb-8">Wallet</h1>

        {/* Success message */}
        {success === 'true' && (
          <div className="mb-6 rounded-2xl p-4" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <p className="text-sm text-emerald-400 font-medium">Payment successful! ${depositAmount} added to your pool.</p>
          </div>
        )}

        {/* Balance Card */}
        <div className="glass rounded-2xl p-6 mb-6">
          <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1">Budget Pool Balance</p>
          <p className="text-4xl font-bold text-white">${balance.toFixed(2)}</p>
          <p className="text-xs text-white/30 mt-2">Available for auto-buy and instant booking</p>
        </div>

        {/* Deposit Section */}
        <div className="glass rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Add Funds</h2>

          {/* Preset amounts */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {presetAmounts.map((preset) => (
              <button
                key={preset}
                onClick={() => setAmount(String(preset))}
                className="rounded-xl py-2.5 text-sm font-medium transition"
                style={{
                  background: amount === String(preset) ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                  border: amount === String(preset) ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  color: amount === String(preset) ? '#F59E0B' : 'rgba(255,255,255,0.6)',
                }}
              >
                ${preset}
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <div className="mb-4">
            <label className="block text-[11px] font-medium text-white/40 uppercase tracking-wider mb-1.5">Custom amount (USD)</label>
            <input
              className="glass-input w-full text-lg font-semibold"
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* Pay button */}
          <button
            onClick={handleDeposit}
            disabled={loading || !amount || Number(amount) < 1}
            className="premium-button w-full rounded-2xl py-3.5 text-[15px] font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Processing...
              </>
            ) : (
              `Deposit $${Number(amount || 0).toFixed(2)}`
            )}
          </button>

          <div className="flex items-center justify-center gap-2 mt-3">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="rgba(34,197,94,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="10" height="7" rx="1.5" /><path d="M3 4V2.5a3 3 0 016 0V4" />
            </svg>
            <span className="text-[11px] text-white/30">Secure payment via Stripe</span>
          </div>
        </div>

        {/* Crypto Wallet Section */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Crypto Wallet</h2>

          {walletAddress ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: '#22C55E', boxShadow: '0 0 8px rgba(34,197,94,0.4)' }} />
                <span className="text-sm text-emerald-400 font-medium">Connected</span>
              </div>
              <p className="font-mono text-sm text-white/50 break-all">{walletAddress}</p>
              <p className="text-xs text-white/25 mt-2">USDC deposits on Base, Optimism, and Ethereum</p>
            </div>
          ) : (
            <div className="flex flex-col items-center py-4">
              <p className="text-sm text-white/40 mb-4">Connect wallet for crypto deposits</p>
              <ConnectWalletButton />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={<div className="py-2"><div className="mx-auto max-w-3xl"><h1 className="text-3xl font-semibold mb-8">Wallet</h1><p className="text-white/40">Loading...</p></div></div>}>
      <WalletContent />
    </Suspense>
  );
}
