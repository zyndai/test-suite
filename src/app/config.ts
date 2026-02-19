export const config = {
  // x402 API endpoint URL
  apiUrl: '',

  // Privy app ID for wallet authentication
  privyAppId: 'cmcylok2k02cjky0mkccqj5to',

  // Chain configuration
  chain: {
    name: 'Base Sepolia',
    id: 84532,
    idHex: '0x14a34',
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
  },

  // Faucet settings
  faucet: {
    amount: '0.01',
    currency: 'ETH',
  },

  // App metadata
  app: {
    name: 'Zynd Tester',
    description: 'Test x402 payment-enabled APIs and claim testnet tokens',
  },

  // Local storage keys
  storage: {
    conversations: 'zynd-conversations',
    activeConversation: 'zynd-active-conversation',
    apiUrl: 'zynd-api-url',
  },
} as const;
