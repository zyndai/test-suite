'use client';

import { PrivyProvider } from "@privy-io/react-auth";
import { baseSepolia } from "viem/chains"
import Index from './Home';

export default function Home() {

  return (
    <PrivyProvider
      appId="cmcylok2k02cjky0mkccqj5to"
      config={{
        appearance: { theme: 'light' },
        supportedChains: [baseSepolia]
      }}
    >
      <Index/>
    </PrivyProvider>
  );
}
