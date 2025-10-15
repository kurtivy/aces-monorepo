// Contract addresses for different networks
export const CONTRACT_ADDRESSES = {
  // Base Sepolia (Chain ID: 84532) - TESTNET
  baseSepolia: {
    ACES_TOKEN:
      process.env.NEXT_PUBLIC_ACES_TOKEN_ADDRESS_BASE_SEPOLIA ||
      '0xF6b0c828ee8098120AFa90CEb11f80e6Fd4e2F1e', // Base Sepolia ACES token
    FACTORY_IMPLEMENTATION:
      process.env.NEXT_PUBLIC_FACTORY_ADDRESS_BASE_SEPOLIA ||
      '0xEC8556468B88A4422c786c4acBA61f556Eb592A4', // Base Sepolia factory implementation
    FACTORY_PROXY:
      process.env.NEXT_PUBLIC_PROXY_ADDRESS_BASE_SEPOLIA ||
      '0x7e224ae4e6235bF18BBcb79cc2B5d04a7a6F8d1D', // Base Sepolia factory proxy (main interaction point)
    AERODROME_ROUTER: process.env.NEXT_PUBLIC_AERODROME_ROUTER_BASE_SEPOLIA || '', // Optional: only if a testnet router exists
  },
  // Base Mainnet (Chain ID: 8453) - PRODUCTION
  baseMainnet: {
    ACES_TOKEN:
      process.env.NEXT_PUBLIC_ACES_TOKEN_ADDRESS_BASE_MAINNET ||
      '0x55337650856299363c496065C836B9C6E9dE0367', // Base Mainnet ACES token
    FACTORY_IMPLEMENTATION:
      process.env.NEXT_PUBLIC_FACTORY_ADDRESS_BASE_MAINNET ||
      '0x4678ff6Abcec33080364D17858458bDe4D1fEFf5', // Base Mainnet factory implementation
    FACTORY_PROXY:
      process.env.NEXT_PUBLIC_PROXY_ADDRESS_BASE_MAINNET ||
      '0xFAa139E3Fb1fb11271F743324405cB24f9bbD81e', // Base Mainnet factory proxy (main interaction point)
    AERODROME_ROUTER: process.env.NEXT_PUBLIC_AERODROME_ROUTER_BASE_MAINNET || '', // ⚠️ REQUIRED for DEX trades
    ACES_SWAP:
      process.env.NEXT_PUBLIC_ACES_SWAP_ADDRESS_BASE_MAINNET ||
      '0x9EeC0656f7DE220877DC55FdB56cf3d56E97034d', // Base Mainnet AcesSwapNew
  },
} as const;

// Get addresses for current network
export function getContractAddresses(chainId: number = 84532) {
  // Default to Base Sepolia for testnet development
  switch (chainId) {
    case 84532: // Base Sepolia (Testnet)
      return CONTRACT_ADDRESSES.baseSepolia;
    case 8453: // Base Mainnet (Production)
      return CONTRACT_ADDRESSES.baseMainnet;
    default:
      console.warn(
        `⚠️ Unsupported chain ID: ${chainId}. Only Base Sepolia (84532) and Base Mainnet (8453) are supported. Defaulting to Base Sepolia.`,
      );
      return CONTRACT_ADDRESSES.baseSepolia;
  }
}

// Validation function - checks if all required contracts are configured
export function validateContractAddresses(chainId: number): boolean {
  const addresses = getContractAddresses(chainId);

  // All networks need ACES_TOKEN and FACTORY_PROXY for trading to work
  const hasRequiredContracts = Boolean(
    addresses.ACES_TOKEN && addresses.FACTORY_PROXY && addresses.AERODROME_ROUTER,
  );

  if (!hasRequiredContracts && chainId === 8453) {
    console.error(
      '❌ Base Mainnet contracts not fully configured! Set:\n' +
        '  - NEXT_PUBLIC_FACTORY_ADDRESS_BASE_MAINNET\n' +
        '  - NEXT_PUBLIC_PROXY_ADDRESS_BASE_MAINNET\n' +
        '  - NEXT_PUBLIC_AERODROME_ROUTER_BASE_MAINNET',
    );
  }

  return hasRequiredContracts;
}

// Network configuration
export const NETWORK_CONFIG = {
  DEFAULT_CHAIN_ID: parseInt(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || '84532'), // Base Sepolia
  NETWORK_NAME: process.env.NEXT_PUBLIC_NETWORK_NAME || 'baseSepolia',
} as const;
