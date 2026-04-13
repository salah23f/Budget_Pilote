/**
 * MissionEscrow on-chain client (viem).
 *
 * Reads mission state from the MissionEscrow contract and, when
 * configured with AGENT_PRIVATE_KEY, can trigger auto-buy releases
 * (the only action the backend is ever allowed to do on-chain — it
 * cannot withdraw, cannot deposit, and cannot exceed the user's
 * per-mission auto-buy limit — those constraints are enforced by the
 * contract itself).
 *
 * Environment:
 *   NEXT_PUBLIC_ESCROW_CHAIN       — 'base' | 'optimism' | 'arbitrum' | 'polygon'
 *   NEXT_PUBLIC_ESCROW_ADDRESS     — 0x... of the deployed MissionEscrow
 *   NEXT_PUBLIC_ESCROW_USDC        — 0x... of USDC on that chain
 *   NEXT_PUBLIC_ESCROW_MERCHANT    — 0x... of the whitelisted merchant (Flyeas ops)
 *   AGENT_PRIVATE_KEY              — 0x... server-only key for agentRelease()
 *   ESCROW_RPC_URL                 — (optional) custom RPC endpoint
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
} from 'viem';
import { base, optimism, arbitrum, polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

export const MISSION_ESCROW_ABI = [
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
  {
    type: 'function',
    name: 'agentRelease',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'id', type: 'bytes32' },
      { name: 'merchant', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'offerHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'userRelease',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'id', type: 'bytes32' },
      { name: 'merchant', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'offerHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getMission',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [
      { name: 'user', type: 'address' },
      { name: 'budget', type: 'uint256' },
      { name: 'autoBuyLimit', type: 'uint256' },
      { name: 'spent', type: 'uint256' },
      { name: 'remaining', type: 'uint256' },
      { name: 'expiresAt', type: 'uint256' },
      { name: 'active', type: 'bool' },
    ],
  },
  {
    type: 'function',
    name: 'trustedMerchants',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// Minimal ERC-20 ABI for the USDC approval step on the frontend.
export const ERC20_ABI = [
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
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;

// ------------------------------------------------------------------
// Chain + contract configuration
// ------------------------------------------------------------------
const CHAINS = { base, optimism, arbitrum, polygon } as const;

/**
 * Canonical USDC contract addresses. Used as defaults if
 * NEXT_PUBLIC_ESCROW_USDC is not set. Always verify against the
 * official USDC deployment list before using in production.
 */
export const USDC_ADDRESSES = {
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
  optimism: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' as Address,
  arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as Address,
  polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as Address,
};

export function getEscrowChainName():
  | 'base'
  | 'optimism'
  | 'arbitrum'
  | 'polygon' {
  const raw = (process.env.NEXT_PUBLIC_ESCROW_CHAIN || 'base').toLowerCase();
  if (raw in CHAINS) return raw as any;
  return 'base';
}

export function getEscrowChain() {
  return CHAINS[getEscrowChainName()];
}

export function getEscrowAddress(): Address | null {
  const addr = process.env.NEXT_PUBLIC_ESCROW_ADDRESS;
  if (!addr || !addr.startsWith('0x')) return null;
  return addr as Address;
}

export function getEscrowUsdcAddress(): Address {
  const fromEnv = process.env.NEXT_PUBLIC_ESCROW_USDC;
  if (fromEnv && fromEnv.startsWith('0x')) return fromEnv as Address;
  return USDC_ADDRESSES[getEscrowChainName()];
}

export function getMerchantAddress(): Address | null {
  const addr = process.env.NEXT_PUBLIC_ESCROW_MERCHANT;
  if (!addr || !addr.startsWith('0x')) return null;
  return addr as Address;
}

export function isEscrowConfigured(): boolean {
  return !!getEscrowAddress() && !!getMerchantAddress();
}

// ------------------------------------------------------------------
// Viem clients
// ------------------------------------------------------------------
export function publicEscrowClient() {
  const rpc = process.env.ESCROW_RPC_URL;
  return createPublicClient({
    chain: getEscrowChain(),
    transport: rpc ? http(rpc) : http(),
  });
}

function agentWalletClient() {
  const key = process.env.AGENT_PRIVATE_KEY;
  if (!key) throw new Error('AGENT_PRIVATE_KEY is not configured');
  const account = privateKeyToAccount(
    (key.startsWith('0x') ? key : `0x${key}`) as Hex
  );
  const rpc = process.env.ESCROW_RPC_URL;
  return createWalletClient({
    account,
    chain: getEscrowChain(),
    transport: rpc ? http(rpc) : http(),
  });
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
/**
 * Deterministically turn a mission UUID into a bytes32 escrow id.
 */
export function missionIdToBytes32(missionId: string): Hex {
  return keccak256(stringToHex(`flyeas:mission:${missionId}`));
}

/**
 * Convert a USDC amount from whole dollars to the 6-decimal on-chain
 * representation (USDC has 6 decimals everywhere).
 */
export function toUsdcBaseUnits(amountUsd: number): bigint {
  return BigInt(Math.round(amountUsd * 1_000_000));
}

export function fromUsdcBaseUnits(base: bigint): number {
  return Number(base) / 1_000_000;
}

// ------------------------------------------------------------------
// Read: mission state
// ------------------------------------------------------------------
export async function readMissionState(missionId: string) {
  const address = getEscrowAddress();
  if (!address) throw new Error('Escrow address not configured');
  const client = publicEscrowClient();
  const id = missionIdToBytes32(missionId);
  const [user, budget, autoBuyLimit, spent, remaining, expiresAt, active] =
    (await client.readContract({
      address,
      abi: MISSION_ESCROW_ABI,
      functionName: 'getMission',
      args: [id],
    })) as readonly [Address, bigint, bigint, bigint, bigint, bigint, boolean];

  return {
    user,
    budgetUsd: fromUsdcBaseUnits(budget),
    autoBuyLimitUsd: fromUsdcBaseUnits(autoBuyLimit),
    spentUsd: fromUsdcBaseUnits(spent),
    remainingUsd: fromUsdcBaseUnits(remaining),
    expiresAt: new Date(Number(expiresAt) * 1000).toISOString(),
    active,
  };
}

// ------------------------------------------------------------------
// Write: agent-initiated auto-release
// ------------------------------------------------------------------
/**
 * Release USDC from the escrow to the Flyeas merchant address. Only
 * callable for offers that were below the mission's auto-buy limit —
 * the contract itself enforces this so a backend bug cannot
 * accidentally release more.
 */
export async function agentReleaseOnChain(params: {
  missionId: string;
  amountUsd: number;
  offerId: string;
}): Promise<{ txHash: Hex }> {
  const escrow = getEscrowAddress();
  const merchant = getMerchantAddress();
  if (!escrow) throw new Error('Escrow address not configured');
  if (!merchant) throw new Error('Merchant address not configured');

  const wallet = agentWalletClient();
  const id = missionIdToBytes32(params.missionId);
  const offerHash = keccak256(stringToHex(`flyeas:offer:${params.offerId}`));
  const amount = toUsdcBaseUnits(params.amountUsd);

  const txHash = await wallet.writeContract({
    address: escrow,
    abi: MISSION_ESCROW_ABI,
    functionName: 'agentRelease',
    args: [id, merchant, amount, offerHash],
  } as any);

  return { txHash };
}

/**
 * Build the calldata the USER needs to sign for a deposit. The backend
 * never sends this tx — it only tells the frontend what to ask the
 * user's wallet to sign.
 */
export function buildDepositCallData(params: {
  missionId: string;
  budgetUsd: number;
  autoBuyLimitUsd: number;
  expiresAtIso: string;
}) {
  const id = missionIdToBytes32(params.missionId);
  const budget = toUsdcBaseUnits(params.budgetUsd);
  const autoBuyLimit = toUsdcBaseUnits(params.autoBuyLimitUsd);
  const expiresAt = BigInt(Math.floor(new Date(params.expiresAtIso).getTime() / 1000));
  return {
    address: getEscrowAddress(),
    abi: MISSION_ESCROW_ABI,
    functionName: 'deposit' as const,
    args: [id, budget, autoBuyLimit, expiresAt] as const,
  };
}

/**
 * Build the calldata the USER needs to sign for a manual release of an
 * above-threshold offer they've confirmed.
 */
export function buildUserReleaseCallData(params: {
  missionId: string;
  amountUsd: number;
  offerId: string;
}) {
  const escrow = getEscrowAddress();
  const merchant = getMerchantAddress();
  if (!escrow || !merchant) return null;
  const id = missionIdToBytes32(params.missionId);
  const offerHash = keccak256(stringToHex(`flyeas:offer:${params.offerId}`));
  const amount = toUsdcBaseUnits(params.amountUsd);
  return {
    address: escrow,
    abi: MISSION_ESCROW_ABI,
    functionName: 'userRelease' as const,
    args: [id, merchant, amount, offerHash] as const,
  };
}
