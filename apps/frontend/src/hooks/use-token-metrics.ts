import { useState, useEffect, useCallback, useRef } from 'react';
import type { TokenMetrics } from '@/lib/api/tokens';
import { fetchTokenHealth } from '@/lib/api/token-health';
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
  rewardSupply: number | null; // Actual circulating for reward calculations (excludes LP tokens)
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
  const restFetchedRef = useRef<boolean>(false); // ensure one REST fetch per token to seed fee fields
  const lastUpdateTimestampRef = useRef<number>(0); // Track last update timestamp
  const [circulatingSupply, setCirculatingSupply] = useState<number | null>(null);
  const [rewardSupply, setRewardSupply] = useState<number | null>(null); // For reward calculations
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
    debug: false, // Debug logging disabled (all phases verified)
  });

  // Sync WebSocket metrics to state
  useEffect(() => {
    if (wsMetrics && wsConnected) {
      // 🔥 FIX: Check if this is a new update by comparing timestamps
      // This ensures we process every WebSocket message, even if values appear unchanged
      const currentTimestamp = wsMetrics.timestamp || Date.now();
      const isNewUpdate = currentTimestamp > lastUpdateTimestampRef.current;

      if (!isNewUpdate && lastUpdateTimestampRef.current > 0) {
        // Skip duplicate updates (same timestamp), but still process first update
        return;
      }

      lastUpdateTimestampRef.current = currentTimestamp;

      // 🔥 FIX: Always create new object reference to trigger React re-renders
      // Use WebSocket values when available, otherwise preserve current values
      // This ensures partial updates don't lose data while still triggering re-renders
      const previousMetrics = metricsRef.current;
      const updatedMetrics: TokenMetrics = {
        contractAddress: wsMetrics.tokenAddress,
        // Use WebSocket value if provided, otherwise keep previous value
        // 🔥 FIX: Prevent volume from decreasing significantly (should only increase or stay stable)
        // This is a safeguard in case of edge cases (allows up to 5% drop for normal pruning of old trades)
        volume24hUsd:
          wsMetrics.volume24hUsd !== undefined
            ? previousMetrics?.volume24hUsd !== undefined &&
              previousMetrics.volume24hUsd > 0 &&
              wsMetrics.volume24hUsd < previousMetrics.volume24hUsd * 0.95 // Allow <5% drop for pruning
              ? previousMetrics.volume24hUsd // Keep previous if significant drop detected
              : wsMetrics.volume24hUsd
            : (previousMetrics?.volume24hUsd ?? 0),
        volume24hAces:
          wsMetrics.volume24hAces !== undefined && wsMetrics.volume24hAces !== null
            ? wsMetrics.volume24hAces
            : previousMetrics?.volume24hAces || '0',
        marketCapUsd:
          wsMetrics.marketCapUsd !== undefined
            ? wsMetrics.marketCapUsd
            : (previousMetrics?.marketCapUsd ?? 0),
        tokenPriceUsd:
          wsMetrics.currentPriceUsd !== undefined
            ? wsMetrics.currentPriceUsd
            : (previousMetrics?.tokenPriceUsd ?? 0),
        holderCount: previousMetrics?.holderCount || 0,
        totalFeesUsd: previousMetrics?.totalFeesUsd || 0,
        totalFeesAces: previousMetrics?.totalFeesAces || '0',
        // 🔥 FIX: Handle null explicitly for liquidity (null means no liquidity, undefined means no update)
        liquidityUsd:
          wsMetrics.liquidityUsd !== undefined
            ? wsMetrics.liquidityUsd
            : (previousMetrics?.liquidityUsd ?? null),
        liquiditySource:
          wsMetrics.liquiditySource !== undefined
            ? wsMetrics.liquiditySource
            : (previousMetrics?.liquiditySource ?? null),
        // DEX/Bonding fee breakdown (may not be present on WS messages yet)
        dexFeesUsd:
          wsMetrics.dexFeesUsd !== undefined
            ? wsMetrics.dexFeesUsd
            : (previousMetrics?.dexFeesUsd ?? 0),
        dexFeesAces:
          wsMetrics.dexFeesAces !== undefined
            ? wsMetrics.dexFeesAces
            : (previousMetrics?.dexFeesAces ?? '0'),
        bondingFeesUsd:
          wsMetrics.bondingFeesUsd !== undefined
            ? wsMetrics.bondingFeesUsd
            : (previousMetrics?.bondingFeesUsd ?? 0),
        bondingFeesAces:
          wsMetrics.bondingFeesAces !== undefined
            ? wsMetrics.bondingFeesAces
            : (previousMetrics?.bondingFeesAces ?? '0'),
      };

      // 🔥 FIX: Always update state to trigger re-render
      // This ensures React detects changes from WebSocket partial updates
      setMetrics(updatedMetrics);
      metricsRef.current = updatedMetrics;

      // 🔥 FIX: Update individual state values with sticky behavior
      // Zero values treated as "no data" - keep last positive value until new positive arrives
      if (wsMetrics.currentPriceUsd !== undefined) {
        setCurrentPriceUsd((prev) => {
          const newPrice = wsMetrics.currentPriceUsd!;
          // Accept positive values only (0 means no transactions yet = no data)
          if (newPrice > 0) {
            // Update metricsRef to stay in sync
            if (metricsRef.current) {
              metricsRef.current.tokenPriceUsd = newPrice;
            }
            return newPrice;
          }
          // If we had a previous value and now get 0, keep previous (sticky)
          // If we never had a value (prev === 0), stay at 0 (no data yet)
          return prev > 0 ? prev : 0;
        });
      }

      if (wsMetrics.marketCapUsd !== undefined) {
        setMarketCapUsd((prev) => {
          const newMcap = wsMetrics.marketCapUsd!;
          if (newMcap > 0) {
            // Update metricsRef to stay in sync
            if (metricsRef.current) {
              metricsRef.current.marketCapUsd = newMcap;
            }
            return newMcap;
          }
          return prev > 0 ? prev : 0;
        });
      }

      if (wsMetrics.circulatingSupply !== undefined) {
        setCirculatingSupply((prev) => {
          const newSupply = wsMetrics.circulatingSupply;
          if (newSupply !== null && newSupply !== undefined && newSupply > 0) {
            return newSupply;
          }
          // Keep previous positive value, or null if never had one
          return prev !== null && prev > 0 ? prev : null;
        });
      }

      // 🔥 NEW: Extract rewardSupply for reward calculations (excludes LP tokens)
      if (wsMetrics.rewardSupply !== undefined) {
        setRewardSupply((prev) => {
          const newSupply = wsMetrics.rewardSupply;
          if (newSupply !== null && newSupply !== undefined && newSupply > 0) {
            return newSupply;
          }
          // Keep previous positive value, or null if never had one
          return prev !== null && prev > 0 ? prev : null;
        });
      }

      // 🔥 NEW: Extract bonding data from WebSocket metrics
      if (wsMetrics.bondingData) {
        setBondingData({
          bondingPercentage: wsMetrics.bondingData.bondingPercentage,
          isBonded: wsMetrics.bondingData.isBonded,
          currentSupply: wsMetrics.bondingData.currentSupply,
          tokensBondedAt: wsMetrics.bondingData.tokensBondedAt,
        });
      }

      setError(null);
      setLoading(false);
    } else if (wsError && !wsConnected) {
      // Only set error if WebSocket failed and we're not connected
      setError(wsError);
    }
  }, [wsMetrics, wsConnected, wsError]);

  const fetchMetrics = useCallback(async () => {
    // Always perform one REST fetch per token to seed fields missing from WS (e.g., fees)
    if (restFetchedRef.current) {
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
          dexFeesUsd: healthData.metricsData.dexFeesUsd ?? metricsRef.current?.dexFeesUsd ?? 0,
          dexFeesAces: healthData.metricsData.dexFeesAces ?? metricsRef.current?.dexFeesAces ?? '0',
          bondingFeesUsd:
            healthData.metricsData.bondingFeesUsd ?? metricsRef.current?.bondingFeesUsd ?? 0,
          bondingFeesAces:
            healthData.metricsData.bondingFeesAces ?? metricsRef.current?.bondingFeesAces ?? '0',
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
        restFetchedRef.current = true;

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

        // 🔥 NEW: Extract rewardSupply for reward calculations (excludes LP tokens)
        if (healthData.marketCapData?.rewardSupply !== undefined) {
          const rewardSupplyValue = healthData.marketCapData.rewardSupply;
          setRewardSupply((prev) =>
            Number.isFinite(rewardSupplyValue) && rewardSupplyValue > 0
              ? rewardSupplyValue
              : (prev ?? null),
          );
        }

        // Extract bonding data for progression components
        if (healthData.bondingData) {
          setBondingData({
            bondingPercentage: healthData.bondingData.bondingPercentage || 0,
            isBonded: healthData.bondingData.isBonded || false,
            currentSupply: healthData.bondingData.currentSupply || '0',
            tokensBondedAt: healthData.bondingData.tokensBondedAt || '700000000',
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
    // 🔥 CRITICAL FIX: Clear state immediately on token switch
    setMetrics(null);
    metricsRef.current = null;
    restFetchedRef.current = false;
    setCirculatingSupply(null);
    setRewardSupply(null);
    setCurrentPriceUsd(0);
    setBondingData(null);
    setMarketCapUsd(0);
    setLoading(true); // Show loading during transition
    setError(null);

    // 🔥 CRITICAL FIX: Reset timestamp ref so all updates are accepted
    lastUpdateTimestampRef.current = 0;

    if (!tokenAddress) {
      setLoading(false);
      return;
    }

    // 🔥 REMOVED: No more polling here
    // useRealtimeMetrics hook handles all WebSocket + fallback polling exclusively
    // Keeping fetchMetrics function available only for explicit manual refetch if needed
  }, [tokenAddress, refreshIntervalMs, fetchMetrics, wsConnected]);

  // 🔥 REMOVED: Chart event subscription
  // Previously subscribed to subscribeToMarketCapUpdates which caused fluctuation
  // Now using only WebSocket metrics from useRealtimeMetrics + REST fallback
  // Both already include market cap from dedicated MarketCapService (single source of truth)

  return {
    metrics,
    loading,
    error,
    refetch: fetchMetrics,
    circulatingSupply,
    rewardSupply,
    currentPriceUsd,
    bondingData,
    marketCapUsd,
  };
}
