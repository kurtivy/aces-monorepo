/**
 * Unified Token Health API Client
 * Fetches bonding data, market cap, and metrics in a single request
 * Shared cache across all contexts for optimal performance
 */

import { requestDeduplicator } from '@/lib/utils/request-deduplication';

export interface TokenHealthData {
  bondingData: null; // Bonding curve removed - always null

  metricsData: {
    contractAddress: string;
    volume24hUsd: number;
    volume24hAces: string;
    marketCapUsd: number;
    tokenPriceUsd: number;
    holderCount: number;
    totalFeesUsd: number;
    totalFeesAces: string;
    dexFeesUsd?: number;
    dexFeesAces?: string;
    bondingFeesUsd?: number;
    bondingFeesAces?: string;
    liquidityUsd: number | null;
    liquiditySource: 'bonding_curve' | 'dex' | null;
  } | null;

  marketCapData: {
    marketCapAces: number;
    marketCapUsd: number;
    circulatingSupply: number;
    rewardSupply?: number; // Actual circulating for reward calculations (excludes LP tokens)
    currentPriceAces: number;
    currentPriceUsd: number;
    lastUpdated: number;
  } | null;
}

interface TokenHealthResponse {
  success: boolean;
  data: TokenHealthData;
  timestamp: number;
  error?: string;
}

// Shared cache with TTL
interface CachedData {
  data: TokenHealthData;
  timestamp: number;
}

const cache = new Map<string, CachedData>();
// Keep cache in lockstep with frontend polling cadence so UI reflects fresh bonding data quickly
const CACHE_TTL = 5000;

function getCacheKey(tokenAddress: string, chainId: number, currency: 'usd' | 'aces'): string {
  return `${tokenAddress.toLowerCase()}-${chainId}-${currency}`;
}

function resolveApiBaseUrl(): string {
  // Use relative paths for Next.js API routes
  if (typeof window !== 'undefined') {
    return ''; // Relative path - Next.js will handle routing
  }
  // Server-side: use absolute URL if needed, otherwise relative
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || '';
}

/**
 * Fetch unified token health data
 * Uses request deduplication to prevent multiple simultaneous requests
 * Uses shared cache across all contexts
 */
export async function fetchTokenHealth(
  tokenAddress: string,
  chainId: number = 8453,
  currency: 'usd' | 'aces' = 'usd',
  options: { includeFees?: boolean } = {},
): Promise<TokenHealthData> {
  const { includeFees = false } = options;
  const cacheKey = getCacheKey(tokenAddress, chainId, currency) + (includeFees ? ':fees' : '');

  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Use deduplicator to prevent multiple simultaneous requests
  const dedupeKey = `health-${cacheKey}`;

  return requestDeduplicator.dedupe(dedupeKey, async () => {
    const apiUrl = resolveApiBaseUrl();
    const feesParam = includeFees ? '&includeFees=1' : '';
    const url = `${apiUrl}/api/tokens/${tokenAddress}/health?chainId=${chainId}&currency=${currency}${feesParam}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('RATE_LIMITED');
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const result: TokenHealthResponse = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch token health');
    }

    // Cache the result
    cache.set(cacheKey, {
      data: result.data,
      timestamp: Date.now(),
    });

    return result.data;
  });
}

/**
 * Clear cache for a specific token or all tokens
 */
export function clearHealthCache(tokenAddress?: string, chainId?: number) {
  if (!tokenAddress) {
    cache.clear();
    return;
  }

  const prefix = chainId ? `${tokenAddress.toLowerCase()}-${chainId}` : tokenAddress.toLowerCase();

  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

/**
 * Get cached data without fetching (useful for synchronous access)
 */
export function getCachedHealth(
  tokenAddress: string,
  chainId: number = 8453,
  currency: 'usd' | 'aces' = 'usd',
): TokenHealthData | null {
  const cacheKey = getCacheKey(tokenAddress, chainId, currency);
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  return null;
}
