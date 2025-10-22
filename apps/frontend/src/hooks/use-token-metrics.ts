import { useState, useEffect, useCallback } from 'react';
import { TokensApi, type TokenMetrics } from '@/lib/api/tokens';
import { fetchTokenHealth } from '@/lib/api/token-health';

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
      // Use unified health endpoint (automatically deduped)
      const healthData = await fetchTokenHealth(tokenAddress, 8453, 'usd');

      if (healthData.metricsData) {
        // Preserve previous liquidity value if new value is null but we had a valid value before
        // This prevents flickering when ACES price is temporarily unavailable
        const updatedMetrics: TokenMetrics = {
          contractAddress: healthData.metricsData.contractAddress,
          volume24hUsd: healthData.metricsData.volume24hUsd,
          volume24hAces: healthData.metricsData.volume24hAces,
          marketCapUsd: healthData.metricsData.marketCapUsd,
          tokenPriceUsd: healthData.metricsData.tokenPriceUsd,
          holderCount: healthData.metricsData.holderCount,
          totalFeesUsd: healthData.metricsData.totalFeesUsd,
          totalFeesAces: healthData.metricsData.totalFeesAces,
          liquidityUsd:
            healthData.metricsData.liquidityUsd === null &&
            metrics?.liquidityUsd !== null &&
            metrics?.liquidityUsd !== undefined
              ? metrics.liquidityUsd
              : healthData.metricsData.liquidityUsd,
          liquiditySource:
            healthData.metricsData.liquidityUsd === null &&
            metrics?.liquiditySource !== null &&
            metrics?.liquiditySource !== undefined
              ? metrics.liquiditySource
              : healthData.metricsData.liquiditySource,
        };

        if (
          healthData.metricsData.liquidityUsd === null &&
          metrics?.liquidityUsd !== null &&
          metrics?.liquidityUsd !== undefined
        ) {
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
        console.error('[useTokenMetrics] ❌ No metrics data in health response');
        setError('No metrics data available');
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
