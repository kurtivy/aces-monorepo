import { useEffect, useMemo, useState } from 'react';
import { TokensApi, type TradeData } from '@/lib/api/tokens';
import { DexApi, type DexTradeResponse } from '@/lib/api/dex';
import type { DatabaseListing } from '@/types/rwa/section.types';

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
}

interface TradeHistoryOptions {
  intervalMs?: number;
  dexMeta?: DatabaseListing['dex'] | null;
}

export const useTradeHistory = (tokenAddress: string, options: TradeHistoryOptions = {}) => {
  const { intervalMs = 2500, dexMeta } = options; // 2.5 seconds for real-time updates (matches chart)

  const shouldUseDex = Boolean(dexMeta?.isDexLive);

  const [trades, setTrades] = useState<TradeHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const bondingCutoffMs = useMemo(() => {
    if (!dexMeta?.bondingCutoff) return null;
    const parsed = Date.parse(dexMeta.bondingCutoff);
    return Number.isNaN(parsed) ? null : parsed;
  }, [dexMeta?.bondingCutoff]);

  // Debug log on mount and when key props change
  // useEffect(() => {
  //   console.log('[TradeHistory] Hook initialized/updated:', {
  //     tokenAddress,
  //     shouldUseDex,
  //     dexMeta,
  //     bondingCutoffMs,
  //   });
  // }, [tokenAddress, shouldUseDex, bondingCutoffMs]);

  const fetchTrades = async () => {
    if (!tokenAddress) {
      // console.log('[TradeHistory] No token address provided');
      return;
    }

    try {
      // Only show loading on first load or after an error
      if (trades.length === 0 || error) {
        setIsLoading(true);
      }
      setError(null);

      // Fetch bonding curve trades
      const bondingResult = await TokensApi.getTrades(tokenAddress, 100);
      let bondingTrades: TradeHistoryEntry[] = [];

      if (bondingResult.success) {
        const payload = bondingResult.data as any;

        const tradePayload: TradeData[] = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload)
            ? (payload as TradeData[])
            : [];

        bondingTrades = tradePayload.map((trade) => ({
          id: `bonding-${trade.id}`,
          source: 'BONDING' as TradeSource,
          direction: trade.isBuy ? 'buy' : 'sell',
          tokenAmount: trade.tokenAmount,
          counterAmount: trade.acesTokenAmount,
          timestamp: Number(trade.createdAt) * 1000,
          txHash: trade.id,
          trader: trade.trader?.id,
        }));
      } else if (bondingResult.error) {
        console.error('[TradeHistory] Bonding API error:', bondingResult.error);
        setError(bondingResult.error);
      }

      let dexTrades: TradeHistoryEntry[] = [];

      if (shouldUseDex) {
        const dexResult = await DexApi.getTrades(tokenAddress, 100);

        if (dexResult.success) {
          const payload = dexResult.data as any;

          const dexArray: DexTradeResponse[] = Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload)
              ? (payload as DexTradeResponse[])
              : [];

          // Log first few raw DEX trades to debug price issues
          if (dexArray.length > 0) {
            dexArray.slice(0, 3).forEach((trade, idx) => {
              console.log(`Trade ${idx + 1}:`, {
                direction: trade.direction,
                amountToken: trade.amountToken,
                amountCounter: trade.amountCounter,
                priceInCounter: trade.priceInCounter,
                priceInUsd: trade.priceInUsd,
                txHash: trade.txHash,
              });
            });
          }

          dexTrades = dexArray.map((trade) => ({
            id: `dex-${trade.txHash ?? trade.timestamp}`,
            source: 'DEX' as TradeSource,
            direction: trade.direction,
            tokenAmount: trade.amountToken,
            counterAmount: trade.amountCounter,
            timestamp: Number(trade.timestamp),
            txHash: trade.txHash,
            trader: trade.trader,
            priceInCounter: trade.priceInCounter,
            priceUsd: trade.priceInUsd,
          }));
        } else if (dexResult.error) {
          console.warn('[TradeHistory] Failed to fetch DEX trades:', dexResult.error);
        }
      } else {
        console.log('[TradeHistory] ❌ shouldUseDex is FALSE, skipping DEX trades fetch');
      }

      if (bondingCutoffMs) {
        //  const beforeFilter = bondingTrades.length;
        bondingTrades = bondingTrades.filter((trade) => trade.timestamp < bondingCutoffMs);
      }

      const combinedTrades = [...dexTrades, ...bondingTrades]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 100);

      setTrades((prevTrades) => {
        if (prevTrades.length === 0) {
          // console.log('[TradeHistory] Setting initial trades:', combinedTrades.length);
          return combinedTrades;
        }

        const prevIds = new Set(prevTrades.map((trade) => trade.id));
        const newEntries = combinedTrades.filter((trade) => !prevIds.has(trade.id));

        if (newEntries.length === 0) {
          // console.log('[TradeHistory] No new trades to add');
          return prevTrades;
        }

        // console.log(`[TradeHistory] Adding ${newEntries.length} new trades`);
        const merged = [...newEntries, ...prevTrades].sort((a, b) => b.timestamp - a.timestamp);
        return merged.slice(0, 100);
      });

      setIsConnected(true);
      setError(null);
    } catch (error) {
      console.error('[TradeHistory] Trade history fetch error:', error);
      setError('Network error while fetching trades');
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!tokenAddress) {
      setTrades([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Check if polling should be disabled (useful for development)
    const disablePolling = process.env.NEXT_PUBLIC_DISABLE_TRADE_POLLING === 'true';

    if (disablePolling) {
      console.log('⏸️  Trade history polling disabled via NEXT_PUBLIC_DISABLE_TRADE_POLLING=true');
      setTrades([]);
      setIsLoading(false);
      setIsConnected(false);
      return;
    }

    console.log('[TradeHistory] Polling enabled, starting trade history fetch');

    let intervalId: NodeJS.Timeout | null = null;

    // Initial fetch
    fetchTrades();

    // Set up interval for continuous updates
    intervalId = setInterval(fetchTrades, intervalMs);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      setIsConnected(false);
    };
  }, [tokenAddress, intervalMs, shouldUseDex, bondingCutoffMs]);

  return {
    trades,
    isLoading,
    error,
    isConnected,
    refresh: fetchTrades,
  };
};
