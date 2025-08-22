// Contract and currency types for ICO functionality

export type Currency = 'ETH' | 'USDC' | 'USDT';

export interface CurrencyInfo {
  symbol: Currency;
  name: string;
  decimals: number;
  address?: `0x${string}`; // undefined for ETH (native)
  isNative: boolean;
}

export const SUPPORTED_CURRENCIES: Record<Currency, CurrencyInfo> = {
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    isNative: true,
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base Mainnet USDC
    isNative: false,
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', // Base Mainnet USDT
    isNative: false,
  },
} as const;

// Placeholder interface for the pre-contract (will be updated when ready)
export interface PreContractInterface {
  // Function to buy tokens with USDC
  buyWithUSDC: (tokenAmount: bigint, maxUSDCCost: bigint) => Promise<`0x${string}`>;

  // Function to buy tokens with USDT
  buyWithUSDT: (tokenAmount: bigint, maxUSDTCost: bigint) => Promise<`0x${string}`>;

  // Get quote for USDC purchase (returns USDC cost for given token amount)
  getUSDCQuote: (tokenAmount: bigint) => Promise<bigint>;

  // Get quote for USDT purchase (returns USDT cost for given token amount)
  getUSDTQuote: (tokenAmount: bigint) => Promise<bigint>;
}

// ERC20 token interface for approvals
export interface ERC20Interface {
  approve: (spender: `0x${string}`, amount: bigint) => Promise<`0x${string}`>;
  allowance: (owner: `0x${string}`, spender: `0x${string}`) => Promise<bigint>;
  balanceOf: (account: `0x${string}`) => Promise<bigint>;
}

// Enhanced quote result that includes currency-specific data
export interface MultiCurrencyQuoteResult {
  tokensOut: bigint;
  cost: bigint; // Cost in the selected currency
  currency: Currency;
  pricePerToken: bigint; // Price per token in the selected currency
  usdCost: number;
  usdPerToken: number;
  // For non-ETH currencies, show the conversion path
  conversionPath?: {
    inputAmount: bigint; // Amount of input currency (USDC/USDT)
    ethAmount: bigint; // Estimated ETH amount after conversion
    tokenAmount: bigint; // Final token amount from bonding curve
  };
}

// Balance information for all supported currencies
export interface WalletBalances {
  ETH: bigint;
  USDC: bigint;
  USDT: bigint;
  tokens: bigint; // User's token balance
}

// Purchase flow state
export interface PurchaseFlow {
  currency: Currency;
  amount: number; // Amount in currency units (USD for stablecoins, ETH for ETH)
  needsApproval: boolean;
  approvalAmount?: bigint;
  estimatedGas: bigint;
  phase: 'approval' | 'purchase' | 'complete';
}
