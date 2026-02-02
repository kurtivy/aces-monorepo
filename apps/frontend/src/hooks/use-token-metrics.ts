import { useState, useEffect, useCallback, useRef } from 'react';
import type { TokenMetrics } from '@/lib/api/tokens';
import type { TokenHealthData } from '@/lib/api/token-health';
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
  rewardSupply: number | null;
  currentPriceUsd: number;
  bondingData: BondingDataSubset | null;
  marketCapUsd: number;
}

export interface UseTokenMetricsOptions {
  refreshIntervalMs?: number;
  /** Pre-fetched health (e.g. from listing?includeHealth=1). When set, skips initial REST fetch and shows data immediately. */
  initialHealth?: TokenHealthData | null;
}

/**
 * Fetches and tracks token metrics. When initialHealth is provided (e.g. from listing+health in one request),
 * state is seeded immediately and no duplicate health fetch is made; polling/WS still run for updates.
 */
export function useTokenMetrics(
  tokenAddress: string | undefined,
  options: UseTokenMetricsOptions | number = {},
): UseTokenMetricsResult {
  const opts = typeof options === 'number' ? { refreshIntervalMs: options } : options;
  const refreshIntervalMs = opts.refreshIntervalMs ?? 30000;
  const initialHealth = opts.initialHealth;
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

      // Bonding curve removed - always set to 100% bonded (DEX mode)
      setBondingData({
        bondingPercentage: 100,
        isBonded: true,
        currentSupply: '0',
        tokensBondedAt: '0',
      });

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

        // Bonding curve removed - circulatingSupply comes from marketCapData now
        // Sticky update: do not overwrite with null when missing/invalid
        if (healthData.marketCapData?.circulatingSupply !== undefined) {
          const supply = healthData.marketCapData.circulatingSupply;
          setCirculatingSupply((prev) =>
            Number.isFinite(supply) && supply > 0 ? supply : (prev ?? null),
          );
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

        // Bonding curve removed - always set bonding data to null
        // All tokens are now in DEX mode (100% bonded)
        setBondingData({
          bondingPercentage: 100,
          isBonded: true,
          currentSupply: '0',
          tokensBondedAt: '0',
        });

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

  // Seed state from pre-fetched health (e.g. listing+health in one request) to avoid duplicate fetch and show data immediately.
  const applyHealthToState = useCallback((healthData: TokenHealthData) => {
    if (healthData.metricsData) {
      const m = healthData.metricsData;
      const updatedMetrics: TokenMetrics = {
        contractAddress: m.contractAddress,
        volume24hUsd: m.volume24hUsd,
        volume24hAces: m.volume24hAces,
        marketCapUsd: m.marketCapUsd,
        tokenPriceUsd: m.tokenPriceUsd,
        holderCount: m.holderCount,
        totalFeesUsd: m.totalFeesUsd,
        totalFeesAces: m.totalFeesAces,
        dexFeesUsd: m.dexFeesUsd ?? 0,
        dexFeesAces: m.dexFeesAces ?? '0',
        bondingFeesUsd: m.bondingFeesUsd ?? 0,
        bondingFeesAces: m.bondingFeesAces ?? '0',
        liquidityUsd: m.liquidityUsd,
        liquiditySource: m.liquiditySource,
      };
      setMetrics(updatedMetrics);
      metricsRef.current = updatedMetrics;
    }
    if (healthData.marketCapData) {
      const mc = healthData.marketCapData;
      if (Number.isFinite(mc.circulatingSupply) && mc.circulatingSupply > 0) {
        setCirculatingSupply(mc.circulatingSupply);
      }
      if (Number.isFinite(mc.currentPriceUsd) && mc.currentPriceUsd > 0) {
        setCurrentPriceUsd(mc.currentPriceUsd);
      }
      if (Number.isFinite(mc.marketCapUsd)) {
        setMarketCapUsd(mc.marketCapUsd);
      }
      if (
        mc.rewardSupply !== undefined &&
        Number.isFinite(mc.rewardSupply) &&
        mc.rewardSupply > 0
      ) {
        setRewardSupply(mc.rewardSupply);
      }
    }
    setBondingData({
      bondingPercentage: 100,
      isBonded: true,
      currentSupply: '0',
      tokensBondedAt: '0',
    });
    setError(null);
    setLoading(false);
    restFetchedRef.current = true;
  }, []);

  useEffect(() => {
    setMetrics(null);
    metricsRef.current = null;
    restFetchedRef.current = false;
    setCirculatingSupply(null);
    setRewardSupply(null);
    setCurrentPriceUsd(0);
    setBondingData(null);
    setMarketCapUsd(0);
    setLoading(true);
    setError(null);
    lastUpdateTimestampRef.current = 0;

    if (!tokenAddress) {
      setLoading(false);
      return;
    }

    // When health was pre-fetched with listing, seed state immediately and skip REST fetch.
    if (initialHealth) {
      applyHealthToState(initialHealth);
      return;
    }

    fetchMetrics();
    // initialHealth intentionally omitted: used only for initial seed so we don't overwrite later WS/poll updates
  }, [tokenAddress, refreshIntervalMs, fetchMetrics, wsConnected, applyHealthToState]);

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
