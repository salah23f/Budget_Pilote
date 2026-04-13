'use client';

import { useLoginWithEmail, usePrivy } from '@privy-io/react-auth';
import { useState } from 'react';

export default function AuthCard() {
  const privyEnabled = !!process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!privyEnabled) {
    return (
      <div className="rounded-xl border p-4">
        <h3 className="font-semibold">Privy not configured yet</h3>
        <p className="text-sm opacity-80">
          Add NEXT_PUBLIC_PRIVY_APP_ID in .env.local to enable email login and embedded wallets.
        </p>
      </div>
    );
  }

  return <AuthCardInner />;
}

function AuthCardInner() {
  const { ready, authenticated, user, logout } = usePrivy();
  const { sendCode, loginWithCode } = useLoginWithEmail();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);

  if (!ready) {
    return <div className="rounded-xl border p-4">Loading auth...</div>;
  }

  if (authenticated) {
    return (
      <div className="rounded-xl border p-4 space-y-2">
        <p>Logged in as {user?.email?.address ?? 'wallet user'}</p>
        <button className="rounded-lg border px-3 py-2" onClick={logout}>
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <input
        className="w-full rounded-lg border px-3 py-2"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      {!sent ? (
        <button
          className="rounded-lg border px-3 py-2"
          onClick={async () => {
            await sendCode({ email });
            setSent(true);
          }}
        >
          Send code
        </button>
      ) : (
        <>
          <input
            className="w-full rounded-lg border px-3 py-2"
            placeholder="OTP code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button
            className="rounded-lg border px-3 py-2"
            onClick={async () => {
              await loginWithCode({ code });
            }}
          >
            Verify code
          </button>
        </>
      )}
    </div>
  );
}