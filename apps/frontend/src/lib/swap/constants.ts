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
export const SUPPORTED_DEX_ASSETS = ['ACES', 'USDC', 'USDT', 'ETH'] as const;

/**
 * Fallback addresses for DEX tokens on Base
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
