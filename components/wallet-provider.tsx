'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ethers } from 'ethers';

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
};

type WalletContextType = {
  walletAddress: string | null;
  isConnecting: boolean;
  providerReady: boolean;
  detectedWallet: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

/**
 * Wait for window.ethereum to be injected (MetaMask and others inject with a delay).
 * Polls every 500ms for up to 3 seconds.
 */
function waitForEthereum(maxWaitMs = 3000): Promise<EthereumProvider | undefined> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(undefined);
      return;
    }

    const win = window as Window & { ethereum?: EthereumProvider };

    // Already available
    if (win.ethereum) {
      resolve(win.ethereum);
      return;
    }

    const interval = 500;
    let elapsed = 0;

    const timer = setInterval(() => {
      elapsed += interval;
      if (win.ethereum) {
        clearInterval(timer);
        resolve(win.ethereum);
      } else if (elapsed >= maxWaitMs) {
        clearInterval(timer);
        resolve(undefined);
      }
    }, interval);
  });
}

function getEthereumProvider(): EthereumProvider | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { ethereum?: EthereumProvider }).ethereum;
}

function detectWalletName(provider: EthereumProvider): string {
  if (provider.isMetaMask) return 'MetaMask';
  if (provider.isCoinbaseWallet) return 'Coinbase Wallet';
  return 'Browser Wallet';
}

export default function WalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [providerReady, setProviderReady] = useState(false);
  const [detectedWallet, setDetectedWallet] = useState<string | null>(null);

  // Wait for provider on mount with retry
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const ethereum = await waitForEthereum();

      if (cancelled) return;

      if (ethereum) {
        setProviderReady(true);
        setDetectedWallet(detectWalletName(ethereum));

        // Check for existing connection
        try {
          const accounts = (await ethereum.request({
            method: 'eth_accounts',
          })) as string[];

          if (!cancelled && accounts.length > 0) {
            setWalletAddress(accounts[0]);
          }
        } catch (error) {
          console.error('Failed to check wallet connection:', error);
        }

        // Listen for account changes
        const handleAccountsChanged = (...args: unknown[]) => {
          const accounts = (args[0] ?? []) as string[];
          if (!accounts.length) {
            setWalletAddress(null);
          } else {
            setWalletAddress(accounts[0]);
          }
        };

        ethereum.on?.('accountsChanged', handleAccountsChanged);

        return () => {
          ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
        };
      } else {
        setProviderReady(false);
      }
    }

    const cleanupPromise = init();

    return () => {
      cancelled = true;
      cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, []);

  const connectWallet = useCallback(async () => {
    const ethereum = getEthereumProvider();

    if (!ethereum) {
      // No wallet detected -- offer to install MetaMask
      const shouldInstall = window.confirm(
        'No Ethereum wallet detected.\n\nWould you like to install MetaMask to connect your wallet?'
      );
      if (shouldInstall) {
        window.open('https://metamask.io/download/', '_blank');
      }
      return;
    }

    setIsConnecting(true);

    try {
      const provider = new ethers.BrowserProvider(ethereum as any);
      const accounts = (await provider.send('eth_requestAccounts', [])) as string[];

      if (accounts.length > 0) {
        setWalletAddress(accounts[0]);
      }
    } catch (error) {
      console.error('Wallet connection failed:', error);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    setWalletAddress(null);
  }, []);

  const value = useMemo(
    () => ({
      walletAddress,
      isConnecting,
      providerReady,
      detectedWallet,
      connectWallet,
      disconnectWallet,
    }),
    [walletAddress, isConnecting, providerReady, detectedWallet, connectWallet, disconnectWallet]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);

  if (!context) {
    throw new Error('useWallet must be used inside WalletProvider');
  }

  return context;
}
