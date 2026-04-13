'use client';

import { useState } from 'react';
import { encodeFunctionData, keccak256, stringToHex } from 'viem';
import { useSendTransaction } from '@privy-io/react-auth';

const receiptAbi = [
  {
    type: 'function',
    name: 'executeBooking',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'missionHash', type: 'bytes32' },
      { name: 'offerId', type: 'string' },
      { name: 'priceUsd', type: 'uint256' },
      { name: 'bookingRef', type: 'string' },
      { name: 'receiptCidOrHash', type: 'string' },
    ],
    outputs: [],
  },
] as const;

export function BookOnchainButton({
  missionId,
  offerId,
  priceUsd,
}: {
  missionId: string;
  offerId: string;
  priceUsd: number;
}) {
  const { sendTransaction } = useSendTransaction();
  const [status, setStatus] = useState<string | null>(null);

  async function onBook() {
    const contract = process.env.NEXT_PUBLIC_RECEIPT_CONTRACT as `0x${string}` | undefined;

    if (!contract || contract === '0xYourReceiptContract') {
      setStatus('Missing NEXT_PUBLIC_RECEIPT_CONTRACT');
      return;
    }

    try {
      setStatus('Sending transaction...');
      const missionHash = keccak256(stringToHex(missionId));
      const bookingRef = `BP-${missionId.slice(0, 8)}-${offerId}`;
      const receiptHash = `receipt-${missionId}-${offerId}`;

      const data = encodeFunctionData({
        abi: receiptAbi,
        functionName: 'executeBooking',
        args: [
          missionHash,
          offerId,
          BigInt(Math.round(priceUsd)),
          bookingRef,
          receiptHash,
        ],
      });

      await sendTransaction({
        to: contract,
        data,
        chainId: Number(process.env.NEXT_PUBLIC_DEST_CHAIN_ID || '11155420'),
      });

      setStatus('Transaction sent');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Transaction failed');
    }
  }

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <button onClick={onBook}>Book onchain</button>
      {status ? <p style={{ fontSize: 12 }}>{status}</p> : null}
    </div>
  );
}
