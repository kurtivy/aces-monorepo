import { useState, useEffect, useCallback, useRef } from 'react';
import type { TokenMetrics } from '@/lib/api/tokens';
import { fetchTokenHealth } from '@/lib/api/token-health';
import { subscribeToMarketCapUpdates } from '@/lib/tradingview/market-cap-events';

interface BondingDataSubset {
  bondingPercentage: number;
  isBonded: boolean;
  currentSupply: string;
  tokensBondedAt: string;
}

interface UseTokenMetricsResult {
  metrics: TokenMetrics | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  circulatingSupply: number | null;
  currentPriceUsd: number;
  bondingData: BondingDataSubset | null;
  marketCapUsd: number;
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
  const metricsRef = useRef<TokenMetrics | null>(null);
  const [circulatingSupply, setCirculatingSupply] = useState<number | null>(null);
  const [currentPriceUsd, setCurrentPriceUsd] = useState<number>(0);
  const [bondingData, setBondingData] = useState<BondingDataSubset | null>(null);
  const [marketCapUsd, setMarketCapUsd] = useState<number>(0);
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
      const previousMetrics = metricsRef.current;

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
            previousMetrics?.liquidityUsd !== null &&
            previousMetrics?.liquidityUsd !== undefined
              ? previousMetrics.liquidityUsd
              : healthData.metricsData.liquidityUsd,
          liquiditySource:
            healthData.metricsData.liquidityUsd === null &&
            previousMetrics?.liquiditySource !== null &&
            previousMetrics?.liquiditySource !== undefined
              ? previousMetrics.liquiditySource
              : healthData.metricsData.liquiditySource,
        };

        if (
          healthData.metricsData.liquidityUsd === null &&
          previousMetrics?.liquidityUsd !== null &&
          previousMetrics?.liquidityUsd !== undefined
        ) {
          console.log(
            '[useTokenMetrics] ⚠️ Preserving previous liquidity value:',
            previousMetrics.liquidityUsd,
            'source:',
            previousMetrics.liquiditySource,
          );
        }

        setMetrics(updatedMetrics);
        metricsRef.current = updatedMetrics;

        // Extract circulatingSupply from bondingData with safe parsing
        if (healthData.bondingData?.currentSupply) {
          const parsed = parseFloat(healthData.bondingData.currentSupply);
          setCirculatingSupply(Number.isFinite(parsed) ? parsed : null);
        } else {
          setCirculatingSupply(null);
        }

        // Extract currentPriceUsd from marketCapData
        if (healthData.marketCapData?.currentPriceUsd !== undefined) {
          const priceUsd = healthData.marketCapData.currentPriceUsd;
          setCurrentPriceUsd(Number.isFinite(priceUsd) ? priceUsd : 0);
        } else {
          setCurrentPriceUsd(0);
        }

        // Extract latest market cap (USD)
        if (healthData.marketCapData?.marketCapUsd !== undefined) {
          const latestMarketCapUsd = healthData.marketCapData.marketCapUsd;
          setMarketCapUsd(Number.isFinite(latestMarketCapUsd) ? latestMarketCapUsd : 0);
        }

        // Extract bonding data for progression components
        if (healthData.bondingData) {
          setBondingData({
            bondingPercentage: healthData.bondingData.bondingPercentage || 0,
            isBonded: healthData.bondingData.isBonded || false,
            currentSupply: healthData.bondingData.currentSupply || '0',
            tokensBondedAt: healthData.bondingData.tokensBondedAt || '30000000',
          });
        } else {
          setBondingData(null);
        }

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
  }, [tokenAddress]);

  useEffect(() => {
    if (!tokenAddress) {
      setMetrics(null);
      metricsRef.current = null;
      setCirculatingSupply(null);
      setCurrentPriceUsd(0);
      setBondingData(null);
      setMarketCapUsd(0);
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

  useEffect(() => {
    if (!tokenAddress) {
      return;
    }

    const normalizedAddress = tokenAddress.toLowerCase();

    const unsubscribe = subscribeToMarketCapUpdates((update) => {
      if (update.tokenAddress !== normalizedAddress) {
        return;
      }

      if (Number.isFinite(update.marketCapUsd) && update.marketCapUsd > 0) {
        setMarketCapUsd(update.marketCapUsd);
      }

      if (
        update.currentPriceUsd !== undefined &&
        Number.isFinite(update.currentPriceUsd) &&
        update.currentPriceUsd > 0
      ) {
        setCurrentPriceUsd(update.currentPriceUsd);
      }

      if (
        update.circulatingSupply !== undefined &&
        Number.isFinite(update.circulatingSupply) &&
        update.circulatingSupply > 0
      ) {
        setCirculatingSupply(update.circulatingSupply);
      }
    });

    return unsubscribe;
  }, [tokenAddress]);

  return {
    metrics,
    loading,
    error,
    refetch: fetchMetrics,
    circulatingSupply,
    currentPriceUsd,
    bondingData,
    marketCapUsd,
  };
}
