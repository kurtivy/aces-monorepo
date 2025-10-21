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
      '0x380A787B82EdaA484144a9B78EEC93D2639f3828', // Base Mainnet factory implementation (NEW)
    FACTORY_PROXY:
      process.env.NEXT_PUBLIC_PROXY_ADDRESS_BASE_MAINNET ||
      '0x84976E3C31a073a4E2fE6Bf19C613538b41633c9', // Base Mainnet factory proxy (NEW - main interaction point)
    AERODROME_ROUTER:
      process.env.NEXT_PUBLIC_AERODROME_ROUTER_BASE_MAINNET ||
      '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43', // Aerodrome Router on Base Mainnet
    ACES_SWAP:
      process.env.NEXT_PUBLIC_SWAP_ADDRESS_MAINNET ||
      '0xD884a65b36D6b435f49e01BfD1dBB4643E97D57b', // Base Mainnet AcesSwapNewest
  },
} as const;

// Get addresses for current network
export function getContractAddresses(chainId: number = 8453) {
  // Default to Base Mainnet for production
  switch (chainId) {
    case 84532: // Base Sepolia (Testnet)
      return CONTRACT_ADDRESSES.baseSepolia;
    case 8453: // Base Mainnet (Production)
      return CONTRACT_ADDRESSES.baseMainnet;
    default:
      console.warn(
        `⚠️ Unsupported chain ID: ${chainId}. Only Base Sepolia (84532) and Base Mainnet (8453) are supported. Defaulting to Base Mainnet.`,
      );
      return CONTRACT_ADDRESSES.baseMainnet;
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
  DEFAULT_CHAIN_ID: parseInt(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || '8453'), // Base Mainnet
  NETWORK_NAME: process.env.NEXT_PUBLIC_NETWORK_NAME || 'baseMainnet',
} as const;
