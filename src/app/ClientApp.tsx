'use client';

import { PrivyProvider } from "@privy-io/react-auth";
import { baseSepolia } from "viem/chains";
import { config } from './config';
import Index from './Home';

export default function ClientApp() {
  return (
    <PrivyProvider
      appId={config.privyAppId}
      config={{
        appearance: { theme: 'light' },
        supportedChains: [baseSepolia]
      }}
    >
      <Index />
    </PrivyProvider>
  );
}
