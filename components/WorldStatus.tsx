'use client';

import { MiniKit } from '@worldcoin/minikit-js';

export function WorldStatus() {
  const inWorld = typeof window !== 'undefined' && MiniKit.isInstalled();

  return (
    <div className="card">
      <h3>World status</h3>
      <p>{inWorld ? 'Opened inside World App' : 'Opened in a normal browser'}</p>
    </div>
  );
}
