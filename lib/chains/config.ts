import { ChainConfig } from '../types';

export const SUPPORTED_CHAINS: Record<number, ChainConfig> = {
  // Base Sepolia (testnet - FREE)
  84532: {
    id: 84532,
    name: 'Base Sepolia',
    shortName: 'Base',
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
  },
  // OP Sepolia (testnet - FREE)
  11155420: {
    id: 11155420,
    name: 'OP Sepolia',
    shortName: 'Optimism',
    rpcUrl: 'https://sepolia.optimism.io',
    explorerUrl: 'https://sepolia-optimistic.etherscan.io',
    usdcAddress: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
  },
  // Sepolia (testnet - FREE)
  11155111: {
    id: 11155111,
    name: 'Sepolia',
    shortName: 'Sepolia',
    rpcUrl: 'https://rpc.sepolia.org',
    explorerUrl: 'https://sepolia.etherscan.io',
    usdcAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
  },
};

export const DEFAULT_CHAIN_ID = 84532; // Base Sepolia

export function getChain(chainId: number): ChainConfig | undefined {
  return SUPPORTED_CHAINS[chainId];
}

export function getDefaultChain(): ChainConfig {
  return SUPPORTED_CHAINS[DEFAULT_CHAIN_ID];
}

export function getAllChains(): ChainConfig[] {
  return Object.values(SUPPORTED_CHAINS);
}
