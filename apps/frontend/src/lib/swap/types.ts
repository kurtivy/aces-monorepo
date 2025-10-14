import type { ethers } from 'ethers';

/**
 * Result of a blockchain transaction
 */
export interface TransactionResult {
  success: boolean;
  hash?: string;
  receipt?: ethers.ContractReceipt;
  error?: string;
}

/**
 * Parameters for executing a swap
 */
export interface SwapParams {
  tokenAddress: string;
  amount: string;
  paymentAsset: 'ACES' | 'USDC' | 'USDT' | 'ETH' | 'WETH';
}

/**
 * Result of input validation
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Token metadata configuration
 */
export interface TokenMetadata {
  symbol: string;
  address: string;
  decimals: number;
  icon: string;
  isBase?: boolean;
}

/**
 * Supported payment assets for swaps
 */
export type PaymentAsset = 'ACES' | 'USDC' | 'USDT' | 'ETH' | 'WETH';

/**
 * Swap mode: bonding curve or DEX
 */
export type SwapMode = 'bonding' | 'dex';

/**
 * Status callback for transaction progress
 */
export type StatusCallback = (status: string) => void;

/**
 * DEX quote response from API
 */
export interface DexQuoteResponse {
  inputAmount: string;
  inputAmountRaw: string;
  expectedOutput: string;
  minOutputRaw: string;
  path: string[];
  routes?: Array<{ from: string; to: string; stable: boolean }>;
  priceImpact?: string;
  [key: string]: any;
}

/**
 * Balance state for multiple tokens
 */
export interface TokenBalances {
  ACES: string;
  TOKEN: string;
  USDC: string;
  USDT: string;
  ETH: string;
}

/**
 * Contract instances used for swaps
 */
export interface SwapContracts {
  provider: ethers.providers.Web3Provider | null;
  signer: ethers.Signer | null;
  factoryContract: ethers.Contract | null;
  acesContract: ethers.Contract | null;
  tokenContract: ethers.Contract | null;
  currentChainId: number | null;
  isInitialized: boolean;
  initializationError: string | null;
}
