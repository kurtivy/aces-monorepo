/**
 * Hybrid Trade History Hook
 *
 * Uses WebSocket for real-time updates, with REST API fallback for historical data.
 * Drop-in replacement for use-trade-history.ts with backward compatibility.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRealtimeTrades, type RealtimeTrade } from '@/hooks/websocket/use-realtime-trades';
import type { DatabaseListing } from '@/types/rwa/section.types';
import { TokensApi } from '@/lib/api/tokens';
import { DexApi } from '@/lib/api/dex';

export type TradeSource = 'BONDING' | 'DEX';

export interface TradeHistoryEntry {
  id: string;
  source: TradeSource;
  direction: 'buy' | 'sell';
  tokenAmount: string;
  counterAmount: string;
  timestamp: number;
  txHash?: string;
  trader?: string;
  priceInCounter?: number;
  priceUsd?: string | number | null;
  totalUsd?: string | number | null;
  acesUsdAtExecution?: string | number | null;
  marginalPriceInAces?: string;
}

interface TradeHistoryOptions {
  intervalMs?: number; // Ignored for WebSocket, kept for compatibility
  dexMeta?: DatabaseListing['dex'] | null;
}

/**
 * Transform WebSocket RealtimeTrade to TradeHistoryEntry
 * Maps source: 'goldsky' | 'bitquery' to TradeSource: 'BONDING' | 'DEX'
 */
const transformTrade = (trade: RealtimeTrade): TradeHistoryEntry => {
  // Map WebSocket sources to TradeSource
  // - 'goldsky' → 'BONDING' (bonding curve trades)
  // - 'bitquery' → 'DEX' (DEX trades from BitQuery)
  const source: TradeSource = trade.source === 'goldsky' ? 'BONDING' : 'DEX';

  return {
    id: trade.id || trade.transactionHash,
    source,
    direction: trade.isBuy ? 'buy' : 'sell',
    tokenAmount: trade.tokenAmount || '0',
    counterAmount: trade.acesAmount || '0',
    timestamp: trade.timestamp,
    txHash: trade.transactionHash,
    trader: trade.trader,
    priceInCounter: parseFloat(trade.pricePerToken) || 0,
    priceUsd: trade.priceUsd,
    totalUsd: null, // Will be calculated in the component
    marginalPriceInAces: trade.pricePerToken,
  };
};

export const useTradeHistory = (tokenAddress: string, options: TradeHistoryOptions = {}) => {
  const { dexMeta } = options;
  const [historicalTrades, setHistoricalTrades] = useState<TradeHistoryEntry[]>([]);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(false);
  const [historicalError, setHistoricalError] = useState<string | null>(null);
  const [hasFreshTrades, setHasFreshTrades] = useState(false); // 🔥 NEW: Track if we have recent trades
  const [restFallbackAllowed, setRestFallbackAllowed] = useState(false);

  const WEBSOCKET_PRIORITY_TIMEOUT_MS = 5000;

  // Determine if token is graduated to DEX
  const isDexLive = dexMeta?.isDexLive ?? false;

  // Connect to WebSocket for real-time trades
  // Backend subscribes to BOTH Goldsky (bonding) AND BitQuery (DEX) automatically
  const {
    trades: allRealtimeTrades,
    isConnected,
    isConnecting,
    error: wsError,
  } = useRealtimeTrades(tokenAddress, {
    maxTrades: 100,
    autoReconnect: true,
    debug: true, // 🔍 ENABLED: Debug logging to diagnose WebSocket issues
  });

  // 🔥 AUTO-DETECT: If we're receiving BitQuery trades, token is on DEX
  const hasBitQueryTrades = useMemo(() => {
    const hasBitQuery = allRealtimeTrades.some((trade) => trade.source === 'bitquery');
    // console.log('[TradeHistory] 🔍 Checking for BitQuery trades:', {
    //   totalTrades: allRealtimeTrades.length,
    //   hasBitQuery,
    //   sources: allRealtimeTrades.map((t) => t.source),
    // });
    return hasBitQuery;
  }, [allRealtimeTrades]);

  // Use auto-detected graduation OR explicit dexMeta flag
  const effectiveIsDexLive = isDexLive || hasBitQueryTrades;

  // 🔥 NEW: Filter trades by source based on graduation state
  // IMPORTANT: Always include BitQuery trades if they exist (auto-detection)
  const realtimeTrades = useMemo(() => {
    // Check if we have ANY BitQuery trades (even if effectiveIsDexLive is false)
    const hasAnyBitQueryTrades = allRealtimeTrades.some((t) => t.source === 'bitquery');

    // If we have BitQuery trades OR token is graduated, show BitQuery trades
    if (effectiveIsDexLive || hasAnyBitQueryTrades) {
      // Token graduated OR has BitQuery trades: Show BitQuery (DEX) trades
      // But keep recent Goldsky trades for transition period (last 5 minutes)
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const filtered = allRealtimeTrades.filter((trade) => {
        if (trade.source === 'bitquery') {
          return true; // Always show DEX trades (BitQuery)
        }
        // Show Goldsky trades from last 5 minutes (transition period)
        return trade.source === 'goldsky' && trade.timestamp > fiveMinutesAgo;
      });

      // console.log('[TradeHistory] 🔍 Filtering trades (DEX mode):', {
      //   totalRealtimeTrades: allRealtimeTrades.length,
      //   bitqueryTrades: allRealtimeTrades.filter((t) => t.source === 'bitquery').length,
      //   goldskyTrades: allRealtimeTrades.filter((t) => t.source === 'goldsky').length,
      //   filteredCount: filtered.length,
      //   effectiveIsDexLive,
      //   hasAnyBitQueryTrades,
      // });

      return filtered;
    } else {
      // Token bonding: Show Goldsky trades only
      const filtered = allRealtimeTrades.filter((trade) => trade.source === 'goldsky');

      // console.log('[TradeHistory] 🔍 Filtering trades (Bonding mode):', {
      //   totalRealtimeTrades: allRealtimeTrades.length,
      //   goldskyTrades: filtered.length,
      //   bitqueryTrades: allRealtimeTrades.filter((t) => t.source === 'bitquery').length,
      // });

      return filtered;
    }
  }, [allRealtimeTrades, effectiveIsDexLive]);

  // 🔥 NEW: Check if WebSocket trades are fresh (< 5 minutes old)
  const areTradesFresh = useMemo(() => {
    if (realtimeTrades.length === 0) return false;

    const FRESHNESS_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    const mostRecentTrade = realtimeTrades[0]; // Trades are sorted newest first

    if (!mostRecentTrade || !mostRecentTrade.timestamp) return false;

    const tradeAge = now - mostRecentTrade.timestamp;
    const isFresh = tradeAge < FRESHNESS_THRESHOLD_MS;

    return isFresh;
  }, [realtimeTrades]);

  // Give WebSocket a head start before falling back to REST
  useEffect(() => {
    if (!tokenAddress) {
      setRestFallbackAllowed(false);
      return;
    }

    setRestFallbackAllowed(false);
    const timer = setTimeout(() => {
      setRestFallbackAllowed(true);
    }, WEBSOCKET_PRIORITY_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [tokenAddress]);

  // If WebSocket errors, allow REST fallback immediately
  // If WebSocket connects successfully with fresh data, reset the fallback flag
  useEffect(() => {
    if (wsError) {
      setRestFallbackAllowed(true);
    } else if (isConnected && areTradesFresh && realtimeTrades.length > 0) {
      // WebSocket connected and has fresh data - disable REST fallback
      setRestFallbackAllowed(false);
    }
  }, [wsError, isConnected, areTradesFresh, realtimeTrades.length]);

  // Fetch historical trades from REST API when WebSocket is empty or has stale data
  useEffect(() => {
    const fetchHistoricalTrades = async () => {
      // 🔥 NEW: Fetch historical trades if:
      // 1. WebSocket is not connecting AND (no trades OR trades are stale)
      // 2. Don't fetch if we're still connecting (wait for WebSocket first)
      const shouldFetch = restFallbackAllowed && (!areTradesFresh || realtimeTrades.length === 0);

      if (!shouldFetch) {
        // If we have fresh trades, mark as ready
        if (areTradesFresh && realtimeTrades.length > 0) {
          setHasFreshTrades(true);
        }
        return;
      }

      setIsLoadingHistorical(true);
      setHistoricalError(null);
      setHasFreshTrades(false); // Reset until we get fresh data

      try {
        // Check if token is graduated OR if we detected BitQuery trades (auto-graduation)
        const shouldFetchDex = effectiveIsDexLive || hasBitQueryTrades;

        if (shouldFetchDex) {
          // Token is graduated or has DEX trades - fetch DEX trades
          const dexResult = await DexApi.getTrades(tokenAddress, 80); // Updated to 80

          if (dexResult.success && dexResult.data) {
            // Handle both array format and nested data format
            const tradesArray = Array.isArray(dexResult.data)
              ? dexResult.data
              : Array.isArray((dexResult.data as any)?.data)
                ? (dexResult.data as any).data
                : [];

            const dexTrades: TradeHistoryEntry[] = tradesArray.map((trade: any, index: number) => ({
              id: `dex-${trade.txHash || trade.transactionHash || `${trade.timestamp}-${index}`}`,
              source: 'DEX' as TradeSource,
              direction: trade.direction || (trade.isBuy ? 'buy' : 'sell'),
              tokenAmount: trade.amountToken || trade.amount0 || '0',
              counterAmount: trade.amountCounter || trade.amount1 || trade.acesAmount || '0',
              timestamp:
                typeof trade.timestamp === 'number' ? trade.timestamp : Number(trade.timestamp),
              txHash: trade.txHash || trade.transactionHash || trade.hash,
              trader: trade.trader || trade.sender,
              priceInCounter: trade.priceInCounter,
              priceUsd: trade.priceInUsd || trade.priceUsd,
              totalUsd: trade.totalUsd,
            }));

            setHistoricalTrades(dexTrades);
            setHasFreshTrades(true); // ✅ Mark as fresh after successful fetch
            const buyCount = dexTrades.filter((t) => t.direction === 'buy').length;
            const sellCount = dexTrades.filter((t) => t.direction === 'sell').length;
          } else {
            console.warn('[TradeHistory] DEX trades fetch failed or returned no data:', dexResult);
            setHasFreshTrades(true); // Even on failure, don't block forever
          }
        } else {
          // Token still bonding - fetch bonding curve trades
          const bondingResult = await TokensApi.getTrades(tokenAddress, 80); // Updated to 80

          if (bondingResult.success && bondingResult.data) {
            const payload = bondingResult.data as any;
            const tradePayload = Array.isArray(payload?.data)
              ? payload.data
              : Array.isArray(payload)
                ? payload
                : [];

            const bondingTrades: TradeHistoryEntry[] = tradePayload.map((trade: any) => ({
              id: `bonding-${trade.id}`,
              source: 'BONDING' as TradeSource,
              direction: (trade.isBuy ? 'buy' : 'sell') as 'buy' | 'sell',
              tokenAmount: trade.tokenAmount || '0',
              counterAmount: trade.acesTokenAmount || '0',
              timestamp: Number(trade.createdAt) * 1000,
              txHash: trade.id,
              trader: trade.trader?.id,
              marginalPriceInAces: trade.marginalPriceInAces,
            }));

            setHistoricalTrades(bondingTrades);
            setHasFreshTrades(true); // ✅ Mark as fresh after successful fetch
            const buyCount = bondingTrades.filter((t) => t.direction === 'buy').length;
            const sellCount = bondingTrades.filter((t) => t.direction === 'sell').length;
          } else {
            setHasFreshTrades(true); // Even on failure, don't block forever
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch historical trades';
        setHistoricalError(errorMsg);
        console.error('[TradeHistory] ❌ Error fetching historical trades:', err);
        setHasFreshTrades(true); // Don't block forever on error
      } finally {
        setIsLoadingHistorical(false);
      }
    };

    fetchHistoricalTrades();
  }, [
    tokenAddress,
    isConnected,
    isConnecting,
    realtimeTrades.length,
    effectiveIsDexLive,
    hasBitQueryTrades,
    areTradesFresh, // 🔥 NEW: Re-fetch when freshness changes
    restFallbackAllowed,
  ]);

  // Combine WebSocket trades (transformed) with historical REST trades
  const trades = useMemo(() => {
    // Transform WebSocket trades
    const transformedRealtimeTrades = realtimeTrades.map(transformTrade);

    // console.log('[TradeHistory] 🔄 Merging trades:', {
    //   realtimeCount: realtimeTrades.length,
    //   transformedRealtimeCount: transformedRealtimeTrades.length,
    //   historicalCount: historicalTrades.length,
    //   realtimeSources: realtimeTrades.map((t) => t.source),
    //   historicalSources: historicalTrades.map((t) => t.source),
    // });

    // Merge both arrays and deduplicate by trade ID (txHash or id)
    const tradeMap = new Map<string, TradeHistoryEntry>();

    // Add historical trades first (older data)
    for (const trade of historicalTrades) {
      const key = trade.txHash || trade.id;
      if (key && !tradeMap.has(key)) {
        tradeMap.set(key, trade);
      }
    }

    // Add real-time trades (newer data, will overwrite duplicates)
    let addedCount = 0;
    let duplicateCount = 0;
    for (const trade of transformedRealtimeTrades) {
      const key = trade.txHash || trade.id;
      if (key) {
        if (tradeMap.has(key)) {
          duplicateCount++;
          // Overwrite with newer real-time data
          tradeMap.set(key, trade);
        } else {
          addedCount++;
          tradeMap.set(key, trade);
        }
      } else {
        console.warn('[TradeHistory] ⚠️ Trade missing txHash and id:', trade);
      }
    }

    // Convert map to array, sort by timestamp (newest first), and limit
    const result = Array.from(tradeMap.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 100); // Limit to 100 trades

    // Log buy/sell distribution for debugging
    if (result.length > 0) {
      const buyCount = result.filter((t) => t.direction === 'buy').length;
      const sellCount = result.filter((t) => t.direction === 'sell').length;
      const dexCount = result.filter((t) => t.source === 'DEX').length;
      const bondingCount = result.filter((t) => t.source === 'BONDING').length;

      // console.log(
      //   `[TradeHistory] 📊 Final trade distribution: ${buyCount} buys, ${sellCount} sells (total: ${result.length})`,
      //   {
      //     realtime: transformedRealtimeTrades.length,
      //     historical: historicalTrades.length,
      //     added: addedCount,
      //     duplicates: duplicateCount,
      //     sources: { DEX: dexCount, BONDING: bondingCount },
      //   },
      // );
    }

    return result;
  }, [realtimeTrades, historicalTrades]);

  // Log connection status changes and data source filtering
  useEffect(() => {
    if (isConnected) {
      const goldskyCount = allRealtimeTrades.filter((t) => t.source === 'goldsky').length;
      const bitqueryCount = allRealtimeTrades.filter((t) => t.source === 'bitquery').length;
      // console.log('[TradeHistory] ✅ WebSocket connected for', tokenAddress, {
      //   isDexLive,
      //   effectiveIsDexLive: effectiveIsDexLive,
      //   autoDetected: hasBitQueryTrades && !isDexLive,
      //   source: effectiveIsDexLive ? 'BitQuery (DEX)' : 'Goldsky (Bonding)',
      //   goldskyTrades: goldskyCount,
      //   bitqueryTrades: bitqueryCount,
      //   filteredTrades: realtimeTrades.length,
      // });

      // Log auto-detection if it happened
      if (hasBitQueryTrades && !isDexLive) {
        // console.log('[TradeHistory] 🎓 Auto-detected DEX graduation: Receiving BitQuery trades');
      }
    } else if (isConnecting) {
      // console.log('[TradeHistory] 🔄 WebSocket connecting...', tokenAddress);
    } else {
      // console.log('[TradeHistory] ❌ WebSocket disconnected for', tokenAddress);
    }
  }, [
    isConnected,
    isConnecting,
    tokenAddress,
    isDexLive,
    effectiveIsDexLive,
    hasBitQueryTrades,
    allRealtimeTrades,
    realtimeTrades,
  ]);

  // 🔥 NEW: Loading state now considers trade freshness
  // Show loading if:
  // 1. We're connecting/loading AND have no trades, OR
  // 2. We have trades but they're not fresh yet (still fetching fresh data)
  const isLoading =
    ((isConnecting || isLoadingHistorical) && trades.length === 0) ||
    (!hasFreshTrades && trades.length > 0);

  const error = wsError || historicalError;

  return {
    trades,
    isLoading,
    error,
    isConnected,
    hasFreshTrades, // 🔥 NEW: Export freshness state
    refresh: () => {
      setHistoricalTrades([]);
      setHasFreshTrades(false);
      // This will trigger the useEffect to re-fetch
    },
  };
};
