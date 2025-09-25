// Contract addresses for different networks
export const CONTRACT_ADDRESSES = {
  sepolia: {
    ACES_TOKEN:
      process.env.NEXT_PUBLIC_ACES_TOKEN_ADDRESS_SEPOLIA ||
      '0xD1F6A3FfaED369406A1E85e2231EcBC406B1A1fF',
    FACTORY_IMPLEMENTATION:
      process.env.NEXT_PUBLIC_FACTORY_ADDRESS_SEPOLIA ||
      '0x5791d7E4d27D0EaEE1bf9b0B187e303e4Cbde675',
    FACTORY_PROXY:
      process.env.NEXT_PUBLIC_PROXY_ADDRESS_SEPOLIA || '0xA9b73060722dEd1c99768abB5b17F3648D2Bb91f', // Main interaction point
  },
  // Add mainnet addresses when ready
  mainnet: {
    ACES_TOKEN: process.env.NEXT_PUBLIC_ACES_TOKEN_ADDRESS_MAINNET || '',
    FACTORY_IMPLEMENTATION: process.env.NEXT_PUBLIC_FACTORY_ADDRESS_MAINNET || '',
    FACTORY_PROXY: process.env.NEXT_PUBLIC_PROXY_ADDRESS_MAINNET || '',
  },
} as const;

// Get addresses for current network
export function getContractAddresses(chainId: number = 11155111) {
  // Default to Sepolia
  switch (chainId) {
    case 11155111: // Sepolia
      return CONTRACT_ADDRESSES.sepolia;
    case 1: // Mainnet
      return CONTRACT_ADDRESSES.mainnet;
    default:
      return CONTRACT_ADDRESSES.sepolia;
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
  DEFAULT_CHAIN_ID: parseInt(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || '11155111'),
  NETWORK_NAME: process.env.NEXT_PUBLIC_NETWORK_NAME || 'sepolia',
} as const;
