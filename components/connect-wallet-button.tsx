'use client';

import { useWallet } from '@/components/wallet-provider';

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function ConnectWalletButton() {
  const { walletAddress, isConnecting, connectWallet, disconnectWallet, detectedWallet } = useWallet();

  if (walletAddress) {
    return (
      <div className="space-y-2">
        <div
          className="glass flex items-center gap-3 rounded-2xl px-5 py-3"
          style={{ border: '1px solid rgba(34,197,94,0.25)' }}
        >
          {/* Green dot */}
          <span
            className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
            style={{
              background: '#22c55e',
              boxShadow: '0 0 8px rgba(34,197,94,0.5)',
            }}
          />
          {/* Address */}
          <span className="font-mono text-sm text-white/90">{shortenAddress(walletAddress)}</span>
          {/* Wallet name */}
          {detectedWallet && (
            <span className="text-xs text-white/40">({detectedWallet})</span>
          )}
          {/* Disconnect */}
          <button
            type="button"
            onClick={disconnectWallet}
            className="ml-auto text-xs font-medium text-red-400/70 hover:text-red-400 transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={connectWallet}
        disabled={isConnecting}
        className="premium-button flex w-full items-center justify-center gap-3 rounded-2xl px-5 py-3.5 text-sm font-semibold transition-all disabled:opacity-50"
      >
        {/* MetaMask fox icon */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
          <path d="M16 14h2" />
        </svg>
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </button>
      <p className="text-center text-xs text-white/30">
        or pay with card at checkout
      </p>
    </div>
  );
}
