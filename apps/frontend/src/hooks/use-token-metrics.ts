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

    console.log('[useTokenMetrics] 🎯 Fetching metrics for:', tokenAddress);

    try {
      const result = await TokensApi.getTokenMetrics(tokenAddress);

      console.log('[useTokenMetrics] 📊 API response:', result);

      if (result.success) {
        setMetrics(result.data);
        setError(null);
        console.log('[useTokenMetrics] ✅ Metrics updated:', result.data);
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
  }, [tokenAddress]);

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
