import { useState, useEffect, useCallback } from 'react';

interface TokenData {
  symbol: string;
  name: string;
  currentPriceACES: string;
  volume24h: string;
  updatedAt: string;
}

interface UseTokenDataResult {
  tokenData: TokenData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook to fetch token data including 24h volume
 * Polls API every 30 seconds (optimized for backend caching)
 *
 * 🔥 PHASE 4: This endpoint has less critical data, so 30s polling is optimal.
 * Backend caches token data, so responses are fast even at this interval.
 */
export function useTokenData(tokenAddress?: string): UseTokenDataResult {
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTokenData = useCallback(async () => {
    if (!tokenAddress) {
      setLoading(false);
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const url = apiUrl
        ? `${apiUrl}/api/v1/tokens/${tokenAddress}`
        : `/api/v1/tokens/${tokenAddress}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        setTokenData(result.data);
        setError(null);
      } else {
        throw new Error('Invalid token data received');
      }
    } catch (err) {
      console.error('[useTokenData] Failed to fetch token data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch token data');
    } finally {
      setLoading(false);
    }
  }, [tokenAddress]);

  useEffect(() => {
    if (!tokenAddress) {
      setLoading(false);
      return;
    }

    // Initial fetch
    fetchTokenData();

    // Poll every 30 seconds
    const interval = setInterval(fetchTokenData, 30000);

    return () => clearInterval(interval);
  }, [tokenAddress, fetchTokenData]);

  return {
    tokenData,
    loading,
    error,
    refetch: fetchTokenData,
  };
}
