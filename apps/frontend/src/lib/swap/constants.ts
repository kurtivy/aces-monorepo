/**
 * Default slippage tolerance in basis points (1% = 100 bps)
 */
export const DEFAULT_SLIPPAGE_BPS = 100;

/**
 * Deadline buffer for DEX swaps in seconds (10 minutes)
 */
export const SWAP_DEADLINE_BUFFER_SECONDS = 60 * 10;

/**
 * Supported assets for DEX swaps
 */
export const SUPPORTED_DEX_ASSETS = ['ACES', 'USDC', 'USDT', 'ETH', 'WETH'] as const;

/**
 * Network-specific DEX token addresses
 */
export const DEX_TOKEN_ADDRESSES = {
  // Base Mainnet (8453)
  8453: {
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base Mainnet USDC
    WETH: '0x4200000000000000000000000000000000000006', // Base Mainnet WETH
    USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', // Base Mainnet USDT
  },
  // Base Sepolia (84532)
  84532: {
    USDC:
      process.env.NEXT_PUBLIC_AERODROME_USDC_ADDRESS_SEPOLIA ||
      '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC (example)
    WETH:
      process.env.NEXT_PUBLIC_AERODROME_WETH_ADDRESS_SEPOLIA ||
      '0x4200000000000000000000000000000000000006', // Base Sepolia WETH
    USDT: process.env.NEXT_PUBLIC_AERODROME_USDT_ADDRESS_SEPOLIA || '0', // Base Sepolia USDT (if available)
  },
} as const;

/**
 * Get DEX token addresses for a specific chain
 */
export function getDexTokenAddresses(chainId: number = 84532) {
  return (
    DEX_TOKEN_ADDRESSES[chainId as keyof typeof DEX_TOKEN_ADDRESSES] || DEX_TOKEN_ADDRESSES[84532]
  );
}

/**
 * Fallback addresses for DEX tokens (uses mainnet by default for backward compatibility)
 * @deprecated Use getDexTokenAddresses(chainId) instead for network-specific addresses
 */
export const DEX_FALLBACK_ADDRESSES = {
  USDC:
    process.env.NEXT_PUBLIC_AERODROME_USDC_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  ETH:
    process.env.NEXT_PUBLIC_AERODROME_WETH_ADDRESS || '0x4200000000000000000000000000000000000006',
  USDT:
    process.env.NEXT_PUBLIC_AERODROME_USDT_ADDRESS || '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
} as const;

/**
 * Token decimal configuration
 */
export const TOKEN_DECIMALS = {
  ACES: 18,
  USDC: 6,
  USDT: 6,
  ETH: 18,
  WETH: 18,
  LAUNCHPAD: 18,
} as const;

/**
 * Polling intervals
 */
export const POLLING_INTERVALS = {
  BALANCE_REFRESH: 30000, // 30 seconds
  QUOTE_DEBOUNCE: 500, // 500ms
} as const;

/**
 * Number of confirmations to wait for approval transactions
 * Helps prevent reorg issues
 */
export const APPROVAL_CONFIRMATIONS = 2;

/**
 * Price quote debounce delay in milliseconds
 */
export const PRICE_QUOTE_DEBOUNCE_MS = 1000;

/**
 * Slippage tolerance constants
 */
export const MAX_SLIPPAGE_BPS = 5000; // 50%
export const MIN_SLIPPAGE_BPS = 10; // 0.1%

/**
 * Preset slippage options (in basis points)
 */
export const SLIPPAGE_PRESETS = [50, 100, 200]; // 0.5%, 1%, 2%

/**
 * Quote auto-refresh interval in milliseconds
 */
export const QUOTE_AUTO_REFRESH_MS = 10000; // 10 seconds
