import { useState, useEffect, useCallback, useRef } from 'react';
import type { TokenMetrics } from '@/lib/api/tokens';
import { fetchTokenHealth } from '@/lib/api/token-health';
import { subscribeToMarketCapUpdates } from '@/lib/tradingview/market-cap-events';
import { useRealtimeMetrics } from '@/hooks/websocket/use-realtime-metrics';

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
 * Hook to fetch and track token metrics with real-time WebSocket updates
 * Uses WebSocket for instant updates, falls back to REST API polling if WebSocket unavailable
 *
 * @param tokenAddress - The contract address of the token
 * @param refreshIntervalMs - Polling interval in milliseconds for REST fallback (default: 30000 = 30s)
 * @returns Token metrics data, loading state, and error state
 */
export function useTokenMetrics(
  tokenAddress: string | undefined,
  refreshIntervalMs: number = 30000, // 🔥 UPDATED: 30s polling for REST fallback only (WebSocket is primary)
): UseTokenMetricsResult {
  const [metrics, setMetrics] = useState<TokenMetrics | null>(null);
  const metricsRef = useRef<TokenMetrics | null>(null);
  const [circulatingSupply, setCirculatingSupply] = useState<number | null>(null);
  const [currentPriceUsd, setCurrentPriceUsd] = useState<number>(0);
  const [bondingData, setBondingData] = useState<BondingDataSubset | null>(null);
  const [marketCapUsd, setMarketCapUsd] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🚀 NEW: Use WebSocket for real-time metrics updates
  const {
    metrics: wsMetrics,
    isConnected: wsConnected,
    error: wsError,
  } = useRealtimeMetrics(tokenAddress, {
    fallbackToPolling: true, // Fallback to REST if WebSocket fails
    pollingInterval: refreshIntervalMs,
    debug: false,
  });

  // Sync WebSocket metrics to state
  useEffect(() => {
    if (wsMetrics && wsConnected) {
      // Update metrics from WebSocket
      const updatedMetrics: TokenMetrics = {
        contractAddress: wsMetrics.tokenAddress,
        volume24hUsd: wsMetrics.volume24hUsd ?? metricsRef.current?.volume24hUsd ?? 0,
        volume24hAces: wsMetrics.volume24hAces || metricsRef.current?.volume24hAces || '0',
        marketCapUsd: wsMetrics.marketCapUsd ?? metricsRef.current?.marketCapUsd ?? 0,
        tokenPriceUsd: wsMetrics.currentPriceUsd ?? metricsRef.current?.tokenPriceUsd ?? 0,
        holderCount: metricsRef.current?.holderCount || 0,
        totalFeesUsd: metricsRef.current?.totalFeesUsd || 0,
        totalFeesAces: metricsRef.current?.totalFeesAces || '0',
        liquidityUsd: wsMetrics.liquidityUsd ?? metricsRef.current?.liquidityUsd ?? null,
        liquiditySource: wsMetrics.liquiditySource ?? metricsRef.current?.liquiditySource ?? null,
      };

      setMetrics(updatedMetrics);
      metricsRef.current = updatedMetrics;

      // Update individual state values
      if (wsMetrics.currentPriceUsd !== undefined && wsMetrics.currentPriceUsd > 0) {
        setCurrentPriceUsd(wsMetrics.currentPriceUsd);
      }

      if (wsMetrics.marketCapUsd !== undefined && wsMetrics.marketCapUsd > 0) {
        setMarketCapUsd(wsMetrics.marketCapUsd);
      }

      if (wsMetrics.circulatingSupply !== undefined && wsMetrics.circulatingSupply !== null) {
        setCirculatingSupply(wsMetrics.circulatingSupply);
      }

      setError(null);
      setLoading(false);
    } else if (wsError && !wsConnected) {
      // Only set error if WebSocket failed and we're not connected
      setError(wsError);
    }
  }, [wsMetrics, wsConnected, wsError]);

  const fetchMetrics = useCallback(async () => {
    // Skip REST fetch if WebSocket is connected (WebSocket is primary source)
    if (wsConnected) {
      return;
    }

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
        // Sticky update: do not overwrite with null when missing/invalid
        if (healthData.bondingData?.currentSupply) {
          const parsed = parseFloat(healthData.bondingData.currentSupply);
          setCirculatingSupply((prev) => (Number.isFinite(parsed) ? parsed : (prev ?? null)));
        }

        // Extract currentPriceUsd from marketCapData
        // Sticky update: keep last good price on invalid/missing data
        if (healthData.marketCapData?.currentPriceUsd !== undefined) {
          const priceUsd = healthData.marketCapData.currentPriceUsd;
          setCurrentPriceUsd((prev) =>
            Number.isFinite(priceUsd) && priceUsd > 0 ? priceUsd : prev,
          );
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
  }, [tokenAddress, wsConnected]);

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

    // Initial fetch only if WebSocket is not connected
    // WebSocket hook handles its own initial fetch
    if (!wsConnected) {
      fetchMetrics();

      // Poll every refreshIntervalMs only if WebSocket is not connected
      const interval = setInterval(fetchMetrics, refreshIntervalMs);

      return () => clearInterval(interval);
    }
  }, [tokenAddress, refreshIntervalMs, fetchMetrics, wsConnected]);

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

      // 🔥 FIX: Removed circulatingSupply update to prevent flickering
      // Only use backend RPC polling (SOURCE 1) as single source of truth
      // Chart datafeed events can have stale/inconsistent values causing oscillation
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
