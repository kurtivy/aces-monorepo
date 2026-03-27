/** Re-export from tokenData.ts — single source of truth for token config. */
import { RWA_TOKENS } from "./tokenData";

/**
 * Active tokens with on-chain config, used by reseedTokens mutation.
 * Derived from the main RWA_TOKENS registry.
 */
export const RWA_TOKEN_SEEDS = RWA_TOKENS
  .filter((t) => t.contractAddress && t.isActive)
  .map((t) => ({
    contractAddress: t.contractAddress!,
    symbol: t.symbol,
    name: t.name,
    decimals: t.decimals ?? 18,
    chainId: t.chainId ?? 8453,
    phase: t.phase ?? "DEX_TRADING",
    priceSource: t.priceSource ?? "DEX",
    isActive: t.isActive,
  }));
