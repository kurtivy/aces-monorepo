/**
 * RPC Provider Utility
 *
 * Safe, minimal ethers v5 provider factory for Next.js.
 * Works in server + client contexts without touching global fetch.
 */

import './patch-fetch-referrer'; // must run before ethers (ethers v5 sets referrer = "client" which Node rejects)
import { ethers } from 'ethers';

/* -------------------------------------------------------------------------- */
/*                                  Constants                                 */
/* -------------------------------------------------------------------------- */

export const BASE_MAINNET = {
  name: 'base',
  chainId: 8453,
  defaultRpc: 'https://mainnet.base.org',
};

export const BASE_SEPOLIA = {
  name: 'base-sepolia',
  chainId: 84532,
  defaultRpc: 'https://sepolia.base.org',
};

/* -------------------------------------------------------------------------- */
/*                               RPC URL Helpers                               */
/* -------------------------------------------------------------------------- */

/**
 * Returns a validated RPC URL.
 * Never returns an empty string.
 */
function normalizeRpcUrl(url?: string, fallback?: string): string {
  if (typeof url === 'string' && url.trim().length > 0) {
    return url.trim();
  }
  if (fallback) return fallback;
  throw new Error('No valid RPC URL provided');
}

/**
 * Get Base Mainnet RPC URL
 */
export function getBaseMainnetRpcUrl(): string {
  return normalizeRpcUrl(
    process.env.QUICKNODE_BASE_URL ||
      process.env.NEXT_PUBLIC_QUICKNODE_BASE_URL ||
      process.env.BASE_MAINNET_RPC_URL ||
      process.env.NEXT_PUBLIC_BASE_MAINNET_RPC_URL,
    BASE_MAINNET.defaultRpc,
  );
}

/**
 * Get Base Sepolia RPC URL
 */
export function getBaseSepoliaRpcUrl(): string {
  return normalizeRpcUrl(
    process.env.BASE_SEPOLIA_RPC_URL || process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL,
    BASE_SEPOLIA.defaultRpc,
  );
}

/**
 * Backwards-compatible default RPC getter
 * (used by your existing code)
 */
export function getDefaultRpcUrl(): string {
  return getBaseMainnetRpcUrl();
}

/* -------------------------------------------------------------------------- */
/*                            Provider Factory APIs                            */
/* -------------------------------------------------------------------------- */

/**
 * Create an ethers provider for Base Mainnet.
 *
 * Uses StaticJsonRpcProvider to avoid:
 * - network detection calls
 * - "could not detect network" errors
 */
export function createBaseMainnetProvider(): ethers.providers.StaticJsonRpcProvider {
  return new ethers.providers.StaticJsonRpcProvider(getBaseMainnetRpcUrl(), {
    name: BASE_MAINNET.name,
    chainId: BASE_MAINNET.chainId,
  });
}

/**
 * Create an ethers provider for Base Sepolia.
 */
export function createBaseSepoliaProvider(): ethers.providers.StaticJsonRpcProvider {
  return new ethers.providers.StaticJsonRpcProvider(getBaseSepoliaRpcUrl(), {
    name: BASE_SEPOLIA.name,
    chainId: BASE_SEPOLIA.chainId,
  });
}

/**
 * Generic provider creator (used by your API routes).
 *
 * NOTE:
 * - No fetch overrides
 * - No referrer mutation
 * - Safe for server & client
 */
export function createRpcProvider(
  rpcUrl: string,
  network?: { name: string; chainId: number },
): ethers.providers.JsonRpcProvider {
  if (network) {
    return new ethers.providers.StaticJsonRpcProvider(rpcUrl, network);
  }

  return new ethers.providers.JsonRpcProvider(rpcUrl);
}
