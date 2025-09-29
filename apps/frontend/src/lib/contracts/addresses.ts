// Contract addresses for different networks
export const CONTRACT_ADDRESSES = {
  // Ethereum Sepolia (Chain ID: 11155111)
  sepolia: {
    ACES_TOKEN:
      process.env.NEXT_PUBLIC_ACES_TOKEN_ADDRESS_SEPOLIA ||
      '0xD1F6A3FfaED369406A1E85e2231EcBC406B1A1fF', // Keep ACES token the same
    FACTORY_IMPLEMENTATION:
      process.env.NEXT_PUBLIC_FACTORY_ADDRESS_SEPOLIA ||
      '0xF0Dd3D1430A86Ebbb08d7587bA0a4AC184383e25', // Updated factory implementation
    FACTORY_PROXY:
      process.env.NEXT_PUBLIC_PROXY_ADDRESS_SEPOLIA || '0xF19683a6772aB7EeE79d25Fca83ea662c8c5FEA0', // Updated proxy address - Main interaction point
  },
  // Base Sepolia (Chain ID: 84532)
  baseSepolia: {
    ACES_TOKEN:
      process.env.NEXT_PUBLIC_ACES_TOKEN_ADDRESS_BASE_SEPOLIA ||
      '0xD1F6A3FfaED369406A1E85e2231EcBC406B1A1fF', // Base Sepolia ACES token
    FACTORY_IMPLEMENTATION:
      process.env.NEXT_PUBLIC_FACTORY_ADDRESS_BASE_SEPOLIA ||
      '0xF0Dd3D1430A86Ebbb08d7587bA0a4AC184383e25', // Base Sepolia factory implementation
    FACTORY_PROXY:
      process.env.NEXT_PUBLIC_PROXY_ADDRESS_BASE_SEPOLIA ||
      '0xF19683a6772aB7EeE79d25Fca83ea662c8c5FEA0', // Base Sepolia factory proxy
  },
  // Add mainnet addresses when ready
  mainnet: {
    ACES_TOKEN: process.env.NEXT_PUBLIC_ACES_TOKEN_ADDRESS_MAINNET || '',
    FACTORY_IMPLEMENTATION: process.env.NEXT_PUBLIC_FACTORY_ADDRESS_MAINNET || '',
    FACTORY_PROXY: process.env.NEXT_PUBLIC_PROXY_ADDRESS_MAINNET || '',
  },
} as const;

// Get addresses for current network
export function getContractAddresses(chainId: number = 84532) {
  // Default to Base Sepolia for testnet development
  switch (chainId) {
    case 11155111: // Ethereum Sepolia
      return CONTRACT_ADDRESSES.sepolia;
    case 84532: // Base Sepolia
      return CONTRACT_ADDRESSES.baseSepolia;
    case 1: // Mainnet
      return CONTRACT_ADDRESSES.mainnet;
    default:
      return CONTRACT_ADDRESSES.baseSepolia; // Default to Base Sepolia
  }
}

// Validation function
export function validateContractAddresses(chainId: number): boolean {
  const addresses = getContractAddresses(chainId);

  return Boolean(
    addresses.ACES_TOKEN && addresses.FACTORY_PROXY && addresses.FACTORY_IMPLEMENTATION,
  );
}

// Network configuration
export const NETWORK_CONFIG = {
  DEFAULT_CHAIN_ID: parseInt(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || '84532'), // Base Sepolia
  NETWORK_NAME: process.env.NEXT_PUBLIC_NETWORK_NAME || 'baseSepolia',
} as const;
