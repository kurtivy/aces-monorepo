import { useState, useEffect, useCallback } from 'react';
import { TokensApi, type TokenMetrics } from '@/lib/api/tokens';

interface UseTokenMetricsResult {
  metrics: TokenMetrics | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook to fetch and track token metrics with real-time polling
 * Polls backend API every 30 seconds for fresh data
 *
 * @param tokenAddress - The contract address of the token
 * @param refreshIntervalMs - Polling interval in milliseconds (default: 30000 = 30s)
 * @returns Token metrics data, loading state, and error state
 */
export function useTokenMetrics(
  tokenAddress: string | undefined,
  refreshIntervalMs: number = 30000,
): UseTokenMetricsResult {
  const [metrics, setMetrics] = useState<TokenMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (!tokenAddress) {
      setLoading(false);
      return;
    }

    try {
      const result = await TokensApi.getTokenMetrics(tokenAddress);

      if (result.success) {
        // Preserve previous liquidity value if new value is null but we had a valid value before
        // This prevents flickering when ACES price is temporarily unavailable
        const updatedMetrics = { ...result.data };
        if (
          result.data.liquidityUsd === null &&
          metrics?.liquidityUsd !== null &&
          metrics?.liquidityUsd !== undefined
        ) {
          updatedMetrics.liquidityUsd = metrics.liquidityUsd;
          updatedMetrics.liquiditySource = metrics.liquiditySource;
          console.log(
            '[useTokenMetrics] ⚠️ Preserving previous liquidity value:',
            metrics.liquidityUsd,
            'source:',
            metrics.liquiditySource,
          );
        }

        setMetrics(updatedMetrics);
        setError(null);
      } else {
        console.error('[useTokenMetrics] ❌ Failed to fetch metrics:', result.error);
        setError(result.error);
        // Keep previous metrics on error to avoid flickering
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch token metrics';
      console.error('[useTokenMetrics] ❌ Exception fetching metrics:', err);
      setError(errorMessage);
      // Keep previous metrics on error
    } finally {
      setLoading(false);
    }
  }, [tokenAddress, metrics]);

  useEffect(() => {
    if (!tokenAddress) {
      setMetrics(null);
      setLoading(false);
      setError(null);
      return;
    }

    // Initial fetch
    fetchMetrics();

    // Poll every refreshIntervalMs
    const interval = setInterval(fetchMetrics, refreshIntervalMs);

    return () => clearInterval(interval);
  }, [tokenAddress, refreshIntervalMs, fetchMetrics]);

  return {
    metrics,
    loading,
    error,
    refetch: fetchMetrics,
  };
}
