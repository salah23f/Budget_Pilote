'use client';

import { MiniKitProvider } from '@worldcoin/minikit-js/minikit-provider';
import { PrivyProvider } from '@privy-io/react-auth';

export function Providers({ children }: { children: React.ReactNode }) {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!privyAppId) {
    return <MiniKitProvider>{children}</MiniKitProvider>;
  }

  return (
    <MiniKitProvider>
      <PrivyProvider
        appId={privyAppId}
        config={{
          loginMethods: ['email', 'wallet'],
          embeddedWallets: {
            ethereum: {
              createOnLogin: 'users-without-wallets',
            },
          },
        }}
      >
        {children}
      </PrivyProvider>
    </MiniKitProvider>
  );
}