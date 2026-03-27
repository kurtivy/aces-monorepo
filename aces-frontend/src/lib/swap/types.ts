import type { Address, Hash } from "viem";

export type SwapMode = "bonding" | "dex";

export type SwapDirection = "buy" | "sell";

export interface TransactionResult {
  success: boolean;
  hash?: Hash;
  error?: string;
}

// ── Swap route types (returned by quote hook, consumed by swap service) ──

/** A single hop in a swap route */
export interface SwapHop {
  tokenIn: Address;
  tokenOut: Address;
  poolType: "v2" | "cl";
  /** Whether this is a stable pair (V2 only, false for CL) */
  stable: boolean;
  /** CL tick spacing (0 for V2 hops) */
  tickSpacing: number;
  /** On-chain pool address */
  poolAddress: Address;
}

/** Full route descriptor for swap execution */
export interface SwapRoute {
  /** Ordered token addresses in the path */
  path: Address[];
  /** Pool info for each hop */
  hops: SwapHop[];
  /** True if any hop uses a CL pool (determines Universal Router vs V2 Router) */
  hasSlipstream: boolean;
  /** Raw input amount (in token's smallest unit) */
  inputAmountRaw: bigint;
  /** Raw estimated output before slippage (in output token's smallest unit) */
  estimatedOutputRaw: bigint;
}

export interface DexQuoteResponse {
  inputAmount: string;
  inputAmountRaw: string;
  expectedOutput: string;
  minOutputRaw: string;
  path: string[];
  routes?: Array<{ from: string; to: string; stable: boolean }>;
  priceImpact?: string;
  isSlipstream?: boolean;
  tickSpacing?: number;
  poolAddress?: string;
}

export interface TokenBalances {
  ACES: string;
  TOKEN: string;
  USDC: string;
  USDT: string;
  ETH: string;
}

export interface SwapPricing {
  tokenPriceUsd: number;
  acesPriceUsd: number;
}

export interface TokenMetadata {
  symbol: string;
  address: string;
  decimals: number;
  isBase?: boolean;
}
